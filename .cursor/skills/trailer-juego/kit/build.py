#!/usr/bin/env python3
"""Arma index.html (composición HyperFrames) desde guion.json + tomas grabadas + voz.

    python3 build.py && npm run check

Editar guion.json (y shots.mjs), nunca index.html. Todos los tiempos salen de aquí:
- cada corte dura lo que dice el guion (`dur`); la suma marca el ritmo (cortar en compases de la música);
- la voz empieza con su corte y puede seguir sobre el siguiente, pero nunca pisa otra voz;
- la música baja sola mientras habla el narrador;
- los sonidos que el juego hizo durante la grabación (golpes, flechas, pasos…) caen en su cuadro exacto.

Tipos de corte (`beats`):
- toma:   { clip, in, dur, speed?, zoom?, enter?, caption?, kicker?, town?, shake?, sfx? }
- tarjeta: { type: "card", dur, text, kicker?, sfx? }            texto sobre negro
- cierre: { type: "title", clip, in, dur, logo, tagline, cta, credits }
enter: cut | flash | fade | whip.  town: { name, stone, sub } = rótulo del pueblo.
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
esc = lambda s: str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
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


# ---------- 1. tiempos de cada corte ----------
beats = []
t = 0.0
for i, b in enumerate(G["beats"]):
    kind = b.get("type", "shot")
    info = clip_info(b["clip"]) if b.get("clip") else None
    speed = b.get("speed", 1)
    dur = b["dur"]
    if info:
        need = b.get("in", 0) + dur * speed
        if need > info["seconds"] + 1e-3:
            warnings.append(f"corte {i} ({b['clip']}): pide hasta {need:.2f}s pero la toma dura {info['seconds']:.2f}s → se recorta 'in'")
            b["in"] = max(0, info["seconds"] - dur * speed)
    beats.append({**b, "kind": kind, "i": i, "t": t, "dur": dur, "speed": speed, "info": info})
    t += dur
CUT_END = t

# ---------- 2. voz: con su corte, sin pisarse ----------
vo_windows = []
cursor = 0.0
for b in beats:
    k = b.get("vo")
    if not k:
        continue
    if k not in VO:
        sys.exit(f"Falta la voz '{k}': corre  .venv/bin/python make_voice.py")
    start = max(b["t"] + b.get("voAt", VO_LEAD), cursor + (VO_GAP if cursor else 0))
    if start > b["t"] + b["dur"]:
        warnings.append(f"la voz {k} empieza después de su corte ({start:.2f}s): acorta la voz anterior o alarga cortes")
    vo_windows.append((k, start, VO[k]["dur"]))
    cursor = start + VO[k]["dur"]
TOTAL = max(CUT_END, cursor + END_TAIL)
if TOTAL > CUT_END:
    extra = TOTAL - CUT_END
    last = beats[-1]
    if last["info"]:
        room = last["info"]["seconds"] - (last.get("in", 0) + last["dur"] * last["speed"])
        if room < extra * last["speed"]:
            warnings.append(f"el último corte no alcanza para cubrir la voz: faltan {extra * last['speed'] - room:.2f}s")
    last["dur"] += extra

# ---------- 3. HTML ----------
clips_html, over_html, js = [], [], []
add = lambda s: js.append("      " + s)
sfx_marks = []  # (segundo, nombre, volumen)

for b in beats:
    i, start, dur = b["i"], b["t"], b["dur"]
    if b["kind"] == "card":
        cid = f"card-{i}"
        kicker = f'<div class="kicker">{esc(b["kicker"])}</div>' if b.get("kicker") else ""
        over_html.append(f'      <div id="{cid}" class="clip card" data-start="{r3(start)}" data-duration="{r3(dur)}" data-track-index="36">'
                         f'<div class="card-in">{kicker}<div class="card-text">{esc(b["text"])}</div></div></div>')
        add(f'tl.fromTo("#{cid} .card-in", {{ autoAlpha: 0, scale: 1.12 }}, {{ autoAlpha: 1, scale: 1, duration: 0.55, ease: "power3.out" }}, {r3(start + 0.05)});')
        add(f'tl.to("#{cid} .card-in", {{ scale: 1.04, duration: {r3(dur - 0.95)}, ease: "none" }}, {r3(start + 0.64)});')
        add(f'tl.to("#{cid} .card-in", {{ autoAlpha: 0, duration: 0.25, ease: "power2.in" }}, {r3(start + dur - 0.28)});')
        for name in b.get("sfx", []):
            sfx_marks.append((start + 0.05, name, AUDIO.get("hitVolume", 0.6)))
        continue

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
        add(f'tl.to("#dip", {{ opacity: 0, duration: 0.6, ease: "power1.out" }}, {r3(start)});')
    elif enter == "whip":
        # Barrido: la toma nueva entra corrida y borrosa, y se asienta.
        add(f'tl.fromTo("#shot-{i}", {{ x: 220, filter: "blur(14px)" }}, {{ x: 0, filter: "blur(0px)", duration: 0.3, ease: "power3.out" }}, {r3(start)});')
        sfx_marks.append((start, AUDIO.get("whipSfx", "swing"), AUDIO.get("whipVolume", 0.5)))
    if b.get("shake"):
        at = start + (b["shake"] if isinstance(b["shake"], (int, float)) and b["shake"] is not True else 0.05)
        for n, (dx, dy) in enumerate([(14, -8), (-12, 6), (9, 5), (-6, -4), (3, 2), (0, 0)]):
            add(f'tl.set("#stage", {{ x: {dx}, y: {dy} }}, {r3(at + n * 0.045)});')
    for name in b.get("sfx", []):
        sfx_marks.append((start + 0.03, name, AUDIO.get("hitVolume", 0.6)))

    if b.get("caption"):
        cid = f"cap-{i}"
        kicker = f'<span class="kicker">{esc(b["kicker"])}</span>' if b.get("kicker") else ""
        over_html.append(f'      <div id="{cid}" class="clip caption" data-start="{r3(start + 0.1)}" data-duration="{r3(dur - 0.1)}" data-track-index="30">'
                         f'<div class="cap-in">{kicker}<span class="cap-word">{esc(b["caption"])}</span></div></div>')
        add(f'tl.set("#{cid} .cap-in", {{ scale: 1.7, autoAlpha: 0, x: 0, y: 0 }}, 0);')
        add(f'tl.to("#{cid} .cap-in", {{ scale: 1, autoAlpha: 1, duration: 0.2, ease: "back.out(1.6)" }}, {r3(start + 0.1)});')
        add(f'tl.set("#{cid} .cap-in", {{ x: -8 }}, {r3(start + 0.3)});')
        add(f'tl.to("#{cid} .cap-in", {{ x: 0, duration: 0.18, ease: "elastic.out(1, 0.3)" }}, {r3(start + 0.31)});')
        add(f'tl.to("#{cid} .cap-in", {{ scale: 1.06, duration: {r3(max(0.1, dur - 0.55))}, ease: "none" }}, {r3(start + 0.32)});')
        add(f'tl.to("#{cid} .cap-in", {{ autoAlpha: 0, scale: 1.25, duration: 0.18, ease: "power2.in" }}, {r3(start + dur - 0.2)});')
        if AUDIO.get("captionSfx"):
            sfx_marks.append((start + 0.08, AUDIO["captionSfx"], AUDIO.get("captionVolume", 0.45)))

    if b.get("town"):
        tw = b["town"]
        lid = f"town-{i}"
        gem = f'assets/stills/gem-{tw["stone"]}.png'
        gem_html = f'<img class="gem" src="{gem}" alt="">' if (HERE / gem).exists() else ""
        over_html.append(f'      <div id="{lid}" class="clip lower" data-start="{r3(start + 0.2)}" data-duration="{r3(dur - 0.2)}" data-track-index="32">'
                         f'<div class="lower-in">{gem_html}<div class="lower-txt"><div class="lower-name">{esc(tw["name"])}</div>'
                         f'<div class="lower-sub">{esc(tw.get("sub", ""))}</div></div></div></div>')
        add(f'tl.fromTo("#{lid} .lower-in", {{ x: -700, autoAlpha: 0 }}, {{ x: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out" }}, {r3(start + 0.2)});')
        add(f'tl.fromTo("#{lid} .gem", {{ scale: 0.2, rotation: -40 }}, {{ scale: 1, rotation: 0, duration: 0.5, ease: "back.out(2)" }}, {r3(start + 0.35)});')
        add(f'tl.to("#{lid} .lower-in", {{ x: -80, autoAlpha: 0, duration: 0.3, ease: "power2.in" }}, {r3(start + dur - 0.32)});')

# Barras de cine.
for lb in G.get("letterbox", []):
    s, e = lb["from"], lb.get("to", "end")
    e = TOTAL if e == "end" else e
    add(f'tl.to(["#lb-top", "#lb-bot"], {{ height: {lb.get("size", 110)}, duration: 0.6, ease: "power2.inOut" }}, {r3(s)});')
    if e < TOTAL:
        add(f'tl.to(["#lb-top", "#lb-bot"], {{ height: 0, duration: 0.5, ease: "power2.inOut" }}, {r3(e - 0.5)});')

title_html = ""
tb = next((b for b in beats if b["kind"] == "title"), None)
if tb:
    ts = tb["t"]
    slam = ts + tb.get("slamAt", 0.6)
    logo = tb.get("logo")
    if logo and (HERE / logo).exists():
        logo_html = f'<img id="t-logo" class="logo" src="{logo}" alt="">'
    else:
        if logo:
            warnings.append(f"no existe {logo}: el cierre usa el nombre en texto")
        logo_html = f'<div id="t-logo" class="logo-text">{esc(tb.get("name", G.get("title", "").split("—")[0].strip()))}</div>'
    credits = f'<div id="t-credits" class="credits">{esc(tb["credits"])}</div>' if tb.get("credits") else ""
    title_html = f'''      <div id="title" class="clip title" data-start="{r3(ts)}" data-duration="{r3(TOTAL - ts)}" data-track-index="40">
        <div id="t-box" class="t-box">
          <div class="veil"></div>
          <div id="t-rays" class="rays"></div>
          {logo_html}
          <div id="t-tag" class="tagline">{esc(tb.get("tagline", ""))}</div>
          <div id="t-cta" class="cta">{esc(tb.get("cta", ""))}</div>
          {credits}
        </div>
      </div>'''
    add(f'tl.fromTo("#title .veil", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.8, ease: "power1.out" }}, {r3(ts)});')
    add(f'tl.fromTo("#t-rays", {{ opacity: 0, scale: 0.6, rotation: 0 }}, {{ opacity: 0.55, scale: 1, rotation: 40, duration: {r3(TOTAL - slam)}, ease: "none" }}, {r3(slam)});')
    # El logo cae de golpe: grande → su tamaño, destello y sacudida.
    add(f'tl.fromTo("#t-logo", {{ scale: 2.4, autoAlpha: 0 }}, {{ scale: 1, autoAlpha: 1, duration: 0.32, ease: "power4.in" }}, {r3(slam - 0.32)});')
    add(f'tl.set("#flash", {{ opacity: 0.9 }}, {r3(slam)});')
    add(f'tl.to("#flash", {{ opacity: 0, duration: 0.5, ease: "power2.out" }}, {r3(slam + 0.01)});')
    for n, (dx, dy) in enumerate([(18, -10), (-14, 8), (10, 6), (-7, -5), (4, 2), (0, 0)]):
        add(f'tl.set("#t-box", {{ x: {dx}, y: {dy} }}, {r3(slam + n * 0.05)});')
    add(f'tl.to("#t-logo", {{ scale: 1.05, duration: {r3(max(0.5, TOTAL - slam - 1))}, ease: "none" }}, {r3(slam + 0.4)});')
    add(f'tl.fromTo("#t-tag", {{ y: 24, autoAlpha: 0 }}, {{ y: 0, autoAlpha: 1, duration: 0.5, ease: "power2.out" }}, {r3(slam + 1.0)});')
    add(f'tl.fromTo("#t-cta", {{ autoAlpha: 0, scale: 1.3 }}, {{ autoAlpha: 1, scale: 1, duration: 0.6, ease: "power2.out" }}, {r3(slam + 2.0)});')
    if credits:
        add(f'tl.fromTo("#t-credits", {{ autoAlpha: 0 }}, {{ autoAlpha: 0.85, duration: 0.8 }}, {r3(slam + 2.8)});')
    add(f'tl.to(["#t-box", "#stage"], {{ opacity: 0, duration: 0.8, ease: "power1.in" }}, {r3(TOTAL - 0.8)});')
    for name in tb.get("sfx", []):
        sfx_marks.append((slam, name, AUDIO.get("hitVolume", 0.6)))

# ---------- 4. audio ----------
audio_html = []
for n, (k, s, d) in enumerate(vo_windows):
    audio_html.append(f'      <audio id="vo-{k}" src="assets/vo-{k}.mp3" data-start="{r3(s)}" data-duration="{r3(d)}" data-volume="{AUDIO.get("voVolume", 1)}" data-track-index="{20 + n % 2}"></audio>')


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
    if m.get("duck", True):
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
    audio_html.append(f'      <audio id="music-{n}" src="{src}" data-start="{r3(s)}" data-duration="{r3(d)}" data-media-start="{r3(m.get("mediaStart", 0))}" data-track-index="{10 + n % 2}" '
                      f"data-automation='{{\"version\":1,\"lanes\":[{{\"target\":\"volume\",\"points\":[{lane}]}}]}}'></audio>")

sfx_dirs = AUDIO.get("sfxDirs", [])
skip = set(AUDIO.get("skipSfx", []))
sfx_n = 0


def find_sfx(name):
    for d in sfx_dirs:
        for ext in (".ogg", ".mp3", ".wav"):
            if (HERE / d / f"{name}{ext}").exists():
                return f"{d}/{name}{ext}"
    return None


placed = set()
lanes = []  # fin del último sonido de cada carril


def sfx(name, at, vol):
    global sfx_n
    if name in skip:
        return
    # El mismo sonido en el mismo cuadro sólo una vez (el juego a veces lo pide dos veces).
    key = (name, round(at * 30))
    if key in placed:
        return
    placed.add(key)
    path = find_sfx(name)
    if not path:
        warnings.append(f"no encuentro el sonido '{name}'")
        return
    src = local_audio(path, "sfx")
    if not src:
        return
    dur = media_len(HERE / src)
    # Carril libre: el primero donde el sonido anterior ya terminó.
    lane = next((n for n, end in enumerate(lanes) if end <= at - 0.01), None)
    if lane is None:
        lanes.append(0)
        lane = len(lanes) - 1
    lanes[lane] = at + dur
    audio_html.append(f'      <audio id="sfx-{sfx_n}" src="{src}" data-start="{r3(at)}" data-duration="{r3(dur)}" data-volume="{r3(min(1, vol))}" data-track-index="{50 + lane}"></audio>')
    sfx_n += 1


gain = AUDIO.get("sfxGain", 1.0)
for b in beats:
    if not b["info"]:
        continue
    lo, hi = b.get("in", 0), b.get("in", 0) + b["dur"] * b["speed"]
    for ev in b["info"].get("events", []):
        if lo <= ev["t"] < hi:
            vol = ev.get("vol", AUDIO.get("sfxVolume", 0.5)) * gain
            if ev["sfx"].startswith("step-"):
                vol *= AUDIO.get("stepGain", 0.6)
            sfx(ev["sfx"], b["t"] + (ev["t"] - lo) / b["speed"], vol)
for at, name, vol in sfx_marks:
    sfx(name, at, vol)

# ---------- 5. escribir ----------
tpl = (HERE / "template.tpl").read_text()
for k, v in {
    "{{TITLE}}": G.get("title", "Trailer"), "{{W}}": str(W), "{{H}}": str(H), "{{FPS}}": str(FPS), "{{TOTAL}}": r3(TOTAL),
    "{{CLIPS}}": "\n".join(clips_html), "{{CAPTIONS}}": "\n".join(over_html), "{{TITLECARD}}": title_html,
    "{{AUDIO}}": "\n".join(audio_html), "{{JS}}": "\n".join(js),
}.items():
    tpl = tpl.replace(k, v)
(HERE / "index.html").write_text(tpl)
print(f"trailer {TOTAL:.2f}s · {len(beats)} cortes · {len(vo_windows)} voces · {sfx_n} sonidos")
for w in warnings:
    print("  ⚠", w)
