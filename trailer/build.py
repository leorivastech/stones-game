#!/usr/bin/env python3
"""Arma index.html (composición HyperFrames) desde guion.json + tomas grabadas + voz.

    python3 build.py && npm run check

Editar guion.json (y shots.mjs), nunca index.html. Todos los tiempos salen de aquí:
- cada toma dura lo que dice el guion;
- la voz empieza con su toma y puede seguir sobre la siguiente, pero nunca pisa otra voz;
- la música baja sola mientras habla el narrador;
- los sonidos marcados en shots.mjs (sfx) caen en su cuadro exacto.
"""
import json, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent
G = json.loads((HERE / "guion.json").read_text())
VO = json.loads((HERE / "assets/vo.json").read_text()) if (HERE / "assets/vo.json").exists() else {}
W, H = G.get("size", [1920, 1080])
FPS = G.get("fps", 30)
AUDIO = G.get("audio", {})
r3 = lambda v: f"{v:.3f}".rstrip("0").rstrip(".")
warnings = []

VO_LEAD, VO_GAP, END_TAIL = 0.3, 0.25, 0.6


def clip_info(cid):
    p = HERE / f"assets/clips/{cid}.json"
    if not p.exists():
        sys.exit(f"Falta la toma '{cid}': corre  node capture.mjs {cid}")
    return json.loads(p.read_text())


def media_len(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def local_audio(src, sub="audio"):
    """Copia al proyecto el audio que vive en el juego (HyperFrames sólo sirve archivos de esta carpeta)."""
    s = (HERE / src).resolve()
    if not s.exists():
        warnings.append(f"no existe el audio {src}: se omite")
        return None
    d = HERE / "assets" / sub / s.name
    d.parent.mkdir(parents=True, exist_ok=True)
    if not d.exists() or d.stat().st_size != s.stat().st_size:
        shutil.copy2(s, d)
    return f"assets/{sub}/{s.name}"


# ---------- 1. tiempos de cada toma ----------
beats = []
t = 0.0
for i, b in enumerate(G["beats"]):
    info = clip_info(b["clip"])
    speed = b.get("speed", 1)
    dur = b["dur"]
    need = b.get("in", 0) + dur * speed
    if need > info["seconds"] + 1e-3:
        warnings.append(f"toma {i} ({b['clip']}): pide hasta {need:.2f}s pero la toma dura {info['seconds']:.2f}s → se recorta 'in'")
        b["in"] = max(0, info["seconds"] - dur * speed)
    beats.append({**b, "i": i, "t": t, "dur": dur, "speed": speed, "info": info})
    t += dur
CUT_END = t

# ---------- 2. voz: con su toma, sin pisarse ----------
vo_windows = []
cursor = 0.0
for b in beats:
    k = b.get("vo")
    if not k:
        continue
    if k not in VO:
        sys.exit(f"Falta la voz '{k}': corre  .venv/bin/python make_voice.py")
    start = max(b["t"] + VO_LEAD, cursor + (VO_GAP if cursor else 0))
    if start > b["t"] + b["dur"]:
        warnings.append(f"la voz {k} empieza después de su toma ({start:.2f}s): acorta la voz anterior o alarga tomas")
    vo_windows.append((k, start, VO[k]["dur"]))
    cursor = start + VO[k]["dur"]
TOTAL = max(CUT_END, cursor + END_TAIL)
if TOTAL > CUT_END:
    # La última toma se estira para cubrir la voz final.
    extra = TOTAL - CUT_END
    last = beats[-1]
    room = last["info"]["seconds"] - (last.get("in", 0) + last["dur"] * last["speed"])
    if room < extra * last["speed"]:
        warnings.append(f"la última toma no alcanza para cubrir la voz: faltan {extra * last['speed'] - room:.2f}s (se congela el último cuadro)")
    last["dur"] += extra

# ---------- 3. HTML de tomas, textos y título ----------
clips_html, caps_html, js = [], [], []
add = lambda s: js.append("      " + s)
for b in beats:
    i, start, dur = b["i"], b["t"], b["dur"]
    src = f"assets/clips/{b['clip']}.mp4"
    rate = f' data-playback-rate="{r3(b["speed"])}"' if b["speed"] != 1 else ""
    clips_html.append(
        f'      <div class="shot" id="shot-{i}"><div class="inner" id="inner-{i}">'
        f'<video id="v-{i}" class="clip" src="{src}" data-start="{r3(start)}" data-duration="{r3(dur)}" '
        f'data-media-start="{r3(b.get("in", 0))}"{rate} data-track-index="{1 + i % 2}" muted playsinline></video></div></div>')
    z0, z1 = b.get("zoom", [1, 1])
    if z0 != 1 or z1 != 1:
        add(f'tl.fromTo("#inner-{i}", {{ scale: {z0} }}, {{ scale: {z1}, duration: {r3(dur)}, ease: "none" }}, {r3(start)});')
    enter = b.get("enter", "cut")
    if enter == "flash":
        add(f'tl.set("#flash", {{ opacity: 0.85 }}, {r3(start)});')
        add(f'tl.to("#flash", {{ opacity: 0, duration: 0.3, ease: "power2.out" }}, {r3(start + 0.01)});')
    elif enter == "fade":
        if start > 0:
            add(f'tl.to("#dip", {{ opacity: 1, duration: 0.3, ease: "power1.in" }}, {r3(start - 0.3)});')
        else:
            add('tl.set("#dip", { opacity: 1 }, 0);')
        add(f'tl.to("#dip", {{ opacity: 0, duration: 0.5, ease: "power1.out" }}, {r3(start)});')
    if b.get("caption"):
        cid = f"cap-{i}"
        # El contenedor lo muestra/oculta HyperFrames; la animación va en el texto interior.
        caps_html.append(f'      <div id="{cid}" class="clip caption" data-start="{r3(start + 0.15)}" data-duration="{r3(dur - 0.15)}" data-track-index="30"><span class="cap-in">{b["caption"]}</span></div>')
        add(f'tl.set("#{cid} .cap-in", {{ scale: 1.6, autoAlpha: 0, x: 0, y: 0 }}, 0);')
        add(f'tl.to("#{cid} .cap-in", {{ scale: 1, autoAlpha: 1, duration: 0.22, ease: "back.out(1.4)" }}, {r3(start + 0.15)});')
        add(f'tl.set("#{cid} .cap-in", {{ x: -6 }}, {r3(start + 0.37)});')
        add(f'tl.to("#{cid} .cap-in", {{ x: 0, duration: 0.18, ease: "elastic.out(1, 0.3)" }}, {r3(start + 0.38)});')
        add(f'tl.to("#{cid} .cap-in", {{ autoAlpha: 0, y: -12, duration: 0.2, ease: "power2.in" }}, {r3(start + dur - 0.22)});')

title_html = ""
tb = next((b for b in beats if b.get("type") == "title"), None)
if tb:
    ts = tb["t"]
    # Sin logo (o sin exportar todavía): el nombre del juego en texto grande.
    logo = tb.get("logo")
    if logo and (HERE / logo).exists():
        logo_html = f'<img id="t-logo" class="logo" src="{logo}" alt="">'
    else:
        if logo:
            warnings.append(f"no existe {logo}: el cierre usa el nombre en texto (exporta el logo con stills en shots.mjs)")
        logo_html = f'<div id="t-logo" class="logo-text">{tb.get("name", G.get("title", "").split("—")[0].strip())}</div>'
    title_html = f'''      <div id="title" class="clip title" data-start="{r3(ts)}" data-duration="{r3(TOTAL - ts)}" data-track-index="40">
        <div id="t-box" class="t-box">
          <div class="veil"></div>
          {logo_html}
          <div id="t-tag" class="tagline">{tb.get("tagline", "")}</div>
          <div id="t-cta" class="cta">{tb.get("cta", "")}</div>
        </div>
      </div>'''
    add(f'tl.fromTo("#title .veil", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.8, ease: "power1.out" }}, {r3(ts)});')
    add(f'tl.fromTo("#t-logo", {{ scale: 1.25, autoAlpha: 0 }}, {{ scale: 1, autoAlpha: 1, duration: 0.7, ease: "power3.out" }}, {r3(ts + 0.5)});')
    add(f'tl.fromTo("#t-tag", {{ y: 20, autoAlpha: 0 }}, {{ y: 0, autoAlpha: 1, duration: 0.5, ease: "power2.out" }}, {r3(ts + 1.3)});')
    add(f'tl.fromTo("#t-cta", {{ autoAlpha: 0, scale: 1.3 }}, {{ autoAlpha: 1, scale: 1, duration: 0.6, ease: "power2.out" }}, {r3(ts + 2.2)});')
    add(f'tl.to(["#t-box", "#stage"], {{ opacity: 0, duration: 0.5, ease: "power1.in" }}, {r3(TOTAL - 0.5)});')

# ---------- 4. audio: voz, música con bajada bajo la voz, sonidos ----------
audio_html = []
for n, (k, s, d) in enumerate(vo_windows):
    audio_html.append(f'      <audio id="vo-{k}" src="assets/vo-{k}.mp3" data-start="{r3(s)}" data-duration="{r3(d)}" data-volume="1" data-track-index="{20 + n % 2}"></audio>')


def beat_time(x):
    if x == "end":
        return TOTAL
    return beats[x]["t"] if isinstance(x, int) else float(x)


for n, m in enumerate(AUDIO.get("music", [])):
    s, e = beat_time(m["from"]), beat_time(m["to"])
    d = e - s
    vol, duck = m.get("volume", 0.6), AUDIO.get("duck", 0.35) * m.get("volume", 0.6)
    fi, fo = m.get("fadeIn", 0.6 if s > 0 else 0.3), m.get("fadeOut", 0.8 if e < TOTAL else 1.6)
    pts = [(0, 0), (fi, vol)]
    for (_, vs, vd) in vo_windows:
        a, b2 = vs - s - 0.2, vs - s + vd + 0.2
        if b2 <= fi or a >= d - fo:
            continue
        pts += [(max(fi, a), vol), (max(fi, a) + 0.25, duck), (min(d - fo, b2) - 0.25, duck), (min(d - fo, b2), vol)]
    pts += [(d - fo, vol), (d, 0)]
    pts = sorted({round(p[0], 3): p for p in pts}.values())
    lane = ",".join(f'{{"t":{r3(max(0, pt))},"v":{r3(v)}}}' for pt, v in pts)
    src = local_audio(m["src"], "music")
    if not src:
        continue
    # Si la canción es más corta que su tramo, se repite con otra pista.
    audio_html.append(f'      <audio id="music-{n}" src="{src}" data-start="{r3(s)}" data-duration="{r3(d)}" data-media-start="{r3(m.get("mediaStart", 0))}" data-track-index="{10 + n % 2}" '
                      f"data-automation='{{\"version\":1,\"lanes\":[{{\"target\":\"volume\",\"points\":[{lane}]}}]}}'></audio>")

sfx_dir = AUDIO.get("sfxDir")
sfx_n = 0
def sfx(name, at):
    global sfx_n
    if not sfx_dir:
        return
    src = local_audio(f"{sfx_dir}/{name}.mp3", "sfx")
    if not src:
        return
    audio_html.append(f'      <audio id="sfx-{sfx_n}" src="{src}" data-start="{r3(at)}" data-duration="{r3(media_len(HERE / src))}"data-volume="{AUDIO.get("sfxVolume", 0.5)}" data-track-index="{50 + sfx_n}"></audio>')
    sfx_n += 1

for b in beats:
    lo, hi = b.get("in", 0), b.get("in", 0) + b["dur"] * b["speed"]
    for ev in b["info"].get("events", []):
        if lo <= ev["t"] < hi:
            sfx(ev["sfx"], b["t"] + (ev["t"] - lo) / b["speed"])
    if b.get("caption") and AUDIO.get("captionSfx"):
        sfx(AUDIO["captionSfx"], b["t"] + 0.12)

# ---------- 5. escribir ----------
tpl = (HERE / "template.tpl").read_text()
for k, v in {
    "{{TITLE}}": G.get("title", "Trailer"), "{{W}}": str(W), "{{H}}": str(H), "{{FPS}}": str(FPS), "{{TOTAL}}": r3(TOTAL),
    "{{CLIPS}}": "\n".join(clips_html), "{{CAPTIONS}}": "\n".join(caps_html), "{{TITLECARD}}": title_html,
    "{{AUDIO}}": "\n".join(audio_html), "{{JS}}": "\n".join(js),
}.items():
    tpl = tpl.replace(k, v)
(HERE / "index.html").write_text(tpl)
print(f"trailer {TOTAL:.2f}s · {len(beats)} tomas · {len(vo_windows)} voces · {sfx_n} sonidos")
for w in warnings:
    print("  ⚠", w)
