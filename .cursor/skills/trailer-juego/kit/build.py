#!/usr/bin/env python3
"""Arma index.html (composición HyperFrames) desde un guion + tomas grabadas + voz.

    python3 build.py [guion.json] && npm run check

Editar el guion (y shots.mjs), nunca index.html. Todos los tiempos salen de aquí:
- cada corte dura lo que dice el guion (`dur`); la suma marca el ritmo (cortar en compases de la música);
- la voz empieza con su corte y puede seguir sobre el siguiente, pero nunca pisa otra voz;
- la música baja sola mientras habla el narrador (se pueden unir tramos de la canción con mediaStart);
- los sonidos que el juego hizo durante la grabación (golpes, flechas, pasos…) caen en su cuadro exacto.

Tipos de corte (`beats`):
- toma:    { clip, in, dur, speed?, zoom?, enter?, caption?, kicker?, town?, words?, stamp?, counter?, ticker?, shake?, sfx? }
- tarjeta: { type: "card", dur, text, kicker?, gems?, sfx? }     texto sobre negro (letras que caen, gemas en fila)
- partida: { type: "split", dur, panels: [{clip, in, label?}], skew?, + los mismos textos que una toma }   varias tomas a la vez
- cierre:  { type: "title", clip, in, dur, logo, tagline, cta, credits, gems? }
enter: cut | flash | fade | whip.  town: { name, stone, sub }.  words: ["LÍNEA 1", "LÍNEA 2"] (aparecen en orden; wordsDur para que sigan en los cortes siguientes).
stamp: { text, at }.  counter: { label, to, at?, dur? }.  ticker: [{ stone, name, price, up }].
"""
import json, math, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent
GUION = HERE / (sys.argv[1] if len(sys.argv) > 1 else "guion.json")
G = json.loads(GUION.read_text())
VO = json.loads((HERE / "assets/vo.json").read_text()) if (HERE / "assets/vo.json").exists() else {}
W, H = G.get("size", [1920, 1080])
FPS = G.get("fps", 30)
AUDIO = G.get("audio", {})
FLASH = G.get("flash", {"opacity": 0.85, "dur": 0.3})
LETTERS = G.get("letters", False)  # palabras grandes letra por letra con separación de color
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


def fit_in(clip, media_in, dur, speed, where):
    info = clip_info(clip)
    need = media_in + dur * speed
    if need > info["seconds"] + 1e-3:
        warnings.append(f"{where} ({clip}): pide hasta {need:.2f}s pero la toma dura {info['seconds']:.2f}s → se recorta 'in'")
        media_in = max(0, info["seconds"] - dur * speed)
    return media_in, info


def letters_html(text):
    """Cada letra en su caja, para que caigan una por una."""
    out = []
    for ch in text:
        out.append('<span class="ch sp">&nbsp;</span>' if ch == " " else f'<span class="ch">{esc(ch)}</span>')
    return "".join(out)


# ---------- 1. tiempos de cada corte ----------
beats = []
t = 0.0
for i, b in enumerate(G["beats"]):
    kind = b.get("type", "shot")
    speed = b.get("speed", 1)
    info = None
    if b.get("clip"):
        b["in"], info = fit_in(b["clip"], b.get("in", 0), b["dur"], speed, f"corte {i}")
    beats.append({**b, "kind": kind, "i": i, "t": t, "dur": b["dur"], "speed": speed, "info": info})
    t += b["dur"]
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
    beats[-1]["dur"] += TOTAL - CUT_END

# ---------- 3. HTML ----------
clips_html, over_html, js = [], [], []
add = lambda s: js.append("      " + s)
sfx_marks = []  # (segundo, nombre, volumen)
video_lanes = []


def video_el(vid, clip, media_in, start, dur, speed, style=""):
    lane = next((n for n, end in enumerate(video_lanes) if end <= start + 1e-3), None)
    if lane is None:
        video_lanes.append(0)
        lane = len(video_lanes) - 1
    video_lanes[lane] = start + dur
    rate = f' data-playback-rate="{r3(speed)}"' if speed != 1 else ""
    st = f' style="{style}"' if style else ""
    return (f'<video id="{vid}" class="clip" src="assets/clips/{clip}.mp4" data-start="{r3(start)}" data-duration="{r3(dur)}" '
            f'data-media-start="{r3(media_in)}"{rate} data-track-index="{1 + lane}" muted playsinline{st}></video>')


def flash_at(at, opacity=None, dur=None):
    add(f'tl.set("#flash", {{ opacity: {opacity or FLASH["opacity"]} }}, {r3(at)});')
    add(f'tl.to("#flash", {{ opacity: 0, duration: {r3(dur or FLASH["dur"])}, ease: "power2.out" }}, {r3(at + 0.01)});')


def shake_at(target, at, strength=1.0):
    for n, (dx, dy) in enumerate([(14, -8), (-12, 6), (9, 5), (-6, -4), (3, 2), (0, 0)]):
        add(f'tl.set("{target}", {{ x: {round(dx * strength)}, y: {round(dy * strength)} }}, {r3(at + n * 0.045)});')


def enter_fx(b, start, target):
    enter = b.get("enter", "cut")
    if enter == "flash":
        flash_at(start, b.get("flashOpacity"), min(b.get("flashDur", FLASH["dur"]), b["dur"] - 0.04))
    elif enter == "fade":
        if start > 0:
            add(f'tl.to("#dip", {{ opacity: 1, duration: 0.3, ease: "power1.in" }}, {r3(start - 0.3)});')
        else:
            add('tl.set("#dip", { opacity: 1 }, 0);')
        add(f'tl.to("#dip", {{ opacity: 0, duration: 0.6, ease: "power1.out" }}, {r3(start)});')
    elif enter == "whip":
        add(f'tl.fromTo("{target}", {{ x: 220, filter: "blur(14px)" }}, {{ x: 0, filter: "blur(0px)", duration: 0.3, ease: "power3.out" }}, {r3(start)});')
        sfx_marks.append((start, AUDIO.get("whipSfx", "swing"), AUDIO.get("whipVolume", 0.5)))


RGB_SHADOWS = [
    "22px 0 rgba(255,50,90,0.9), -22px 0 rgba(40,230,255,0.9)",
    "9px 0 rgba(255,50,90,0.85), -9px 0 rgba(40,230,255,0.85)",
    "7px 0 #1b1422, -7px 0 #1b1422, 0 7px #1b1422, 0 -7px #1b1422, 7px 7px #1b1422, -7px 7px #1b1422, 7px -7px #1b1422, -7px -7px #1b1422, 0 16px 0 rgba(27,20,34,0.65)",
]


def caption(i, b, start, dur):
    cid = f"cap-{i}"
    kicker = f'<span class="kicker">{esc(b["kicker"])}</span>' if b.get("kicker") else ""
    letters = b.get("letters", LETTERS)
    word = letters_html(b["caption"]) if letters else esc(b["caption"])
    over_html.append(f'      <div id="{cid}" class="clip caption" data-start="{r3(start + 0.05)}" data-duration="{r3(dur - 0.05)}" data-track-index="30">'
                     f'<div class="cap-in">{kicker}<span class="cap-word">{word}</span></div></div>')
    if letters:
        # Letras que caen escalonadas, con la separación de color que se asienta en tres pasos.
        add(f'tl.fromTo("#{cid} .ch", {{ y: -140, autoAlpha: 0, scale: 1.9, rotation: -14 }}, {{ y: 0, autoAlpha: 1, scale: 1, rotation: 0, duration: 0.26, stagger: 0.028, ease: "back.out(2.2)" }}, {r3(start + 0.05)});')
        for n, sh in enumerate(RGB_SHADOWS):
            add(f'tl.set("#{cid} .cap-word", {{ textShadow: "{sh}" }}, {r3(start + 0.05 + n * 0.1) if n else 0});')
        if b.get("kicker"):
            add(f'tl.fromTo("#{cid} .kicker", {{ x: -260, autoAlpha: 0 }}, {{ x: 0, autoAlpha: 1, duration: 0.25, ease: "power3.out" }}, {r3(start + 0.12)});')
        add(f'tl.to("#{cid} .cap-in", {{ scale: 1.07, duration: {r3(max(0.1, dur - 0.48))}, ease: "none" }}, {r3(start + 0.3)});')
        add(f'tl.to("#{cid} .cap-in", {{ autoAlpha: 0, scale: 1.35, filter: "blur(8px)", duration: 0.15, ease: "power2.in" }}, {r3(start + dur - 0.16)});')
    else:
        add(f'tl.set("#{cid} .cap-in", {{ scale: 1.7, autoAlpha: 0, x: 0, y: 0 }}, 0);')
        add(f'tl.to("#{cid} .cap-in", {{ scale: 1, autoAlpha: 1, duration: 0.2, ease: "back.out(1.6)" }}, {r3(start + 0.1)});')
        add(f'tl.set("#{cid} .cap-in", {{ x: -8 }}, {r3(start + 0.3)});')
        add(f'tl.to("#{cid} .cap-in", {{ x: 0, duration: 0.18, ease: "elastic.out(1, 0.3)" }}, {r3(start + 0.31)});')
        add(f'tl.to("#{cid} .cap-in", {{ scale: 1.06, duration: {r3(max(0.1, dur - 0.55))}, ease: "none" }}, {r3(start + 0.32)});')
        add(f'tl.to("#{cid} .cap-in", {{ autoAlpha: 0, scale: 1.25, duration: 0.18, ease: "power2.in" }}, {r3(start + dur - 0.2)});')
    if AUDIO.get("captionSfx"):
        sfx_marks.append((start + 0.06, AUDIO["captionSfx"], AUDIO.get("captionVolume", 0.45)))


def town_label(i, tw, start, dur):
    lid = f"town-{i}"
    gem = f'assets/stills/gem-{tw["stone"]}.png'
    gem_html = f'<img class="gem" src="{gem}" alt="">' if (HERE / gem).exists() else ""
    over_html.append(f'      <div id="{lid}" class="clip lower" data-start="{r3(start + 0.08)}" data-duration="{r3(dur - 0.08)}" data-track-index="32">'
                     f'<div class="lower-in">{gem_html}<div class="lower-txt"><div class="lower-name">{letters_html(tw["name"])}</div>'
                     f'<div class="lower-sub">{esc(tw.get("sub", ""))}</div></div></div></div>')
    add(f'tl.fromTo("#{lid} .lower-in", {{ x: -700, autoAlpha: 0 }}, {{ x: 0, autoAlpha: 1, duration: 0.3, ease: "power3.out" }}, {r3(start + 0.08)});')
    add(f'tl.fromTo("#{lid} .gem", {{ scale: 0.2, rotation: -60 }}, {{ scale: 1, rotation: 0, duration: 0.4, ease: "back.out(2.4)" }}, {r3(start + 0.16)});')
    add(f'tl.fromTo("#{lid} .lower-name .ch", {{ y: -40, autoAlpha: 0 }}, {{ y: 0, autoAlpha: 1, duration: 0.18, stagger: 0.03, ease: "back.out(2)" }}, {r3(start + 0.14)});')
    add(f'tl.to("#{lid} .lower-in", {{ x: -80, autoAlpha: 0, duration: 0.2, ease: "power2.in" }}, {r3(start + dur - 0.22)});')


def words(i, lines, start, dur, at=None):
    wid = f"words-{i}"
    rows = "".join(f'<div class="w-line w{n}">{letters_html(l)}</div>' for n, l in enumerate(lines))
    over_html.append(f'      <div id="{wid}" class="clip words" data-start="{r3(start)}" data-duration="{r3(dur)}" data-track-index="31"><div class="w-in">{rows}</div></div>')
    at = at or [0.05 + n * (dur * 0.35) for n in range(len(lines))]
    for n, a in enumerate(at):
        add(f'tl.fromTo("#{wid} .w{n} .ch", {{ y: 90, autoAlpha: 0, rotationX: -90 }}, {{ y: 0, autoAlpha: 1, rotationX: 0, duration: 0.3, stagger: 0.022, ease: "power3.out" }}, {r3(start + a)});')
        sfx_marks.append((start + a, AUDIO.get("captionSfx", "hit"), AUDIO.get("captionVolume", 0.4) * 0.8))
    add(f'tl.to("#{wid} .w-in", {{ autoAlpha: 0, y: -30, duration: 0.2, ease: "power2.in" }}, {r3(start + dur - 0.22)});')


def stamp(i, st, start, dur):
    sid = f"stamp-{i}"
    over_html.append(f'      <div id="{sid}" class="clip stamp" data-start="{r3(start)}" data-duration="{r3(dur)}" data-track-index="33"><div class="stamp-in">{esc(st["text"])}</div></div>')
    at = start + st.get("at", 0.5)
    add(f'tl.fromTo("#{sid} .stamp-in", {{ scale: 3.6, autoAlpha: 0, rotation: -30 }}, {{ scale: 1, autoAlpha: 1, rotation: -12, duration: 0.2, ease: "power4.in" }}, {r3(at - 0.2)});')
    flash_at(at, 0.35, 0.25)
    shake_at("#stage", at, 1.3)
    sfx_marks.append((at, st.get("sfx", "armor"), AUDIO.get("hitVolume", 0.65)))


def counter(i, c, start, dur):
    cid = f"count-{i}"
    over_html.append(f'      <div id="{cid}" class="clip counter" data-start="{r3(start)}" data-duration="{r3(dur)}" data-track-index="34">'
                     f'<div class="count-in"><div class="count-label">{esc(c["label"])}</div><div class="count-num">0</div></div></div>')
    at = start + c.get("at", 0.2)
    add(f'tl.fromTo("#{cid} .count-in", {{ x: 300, autoAlpha: 0 }}, {{ x: 0, autoAlpha: 1, duration: 0.3, ease: "power3.out" }}, {r3(at - 0.1)});')
    run = c.get("dur", 1.0)
    steps = max(2, int(run * 20))
    for n in range(steps + 1):
        v = round(c["to"] * (1 - (1 - n / steps) ** 3))
        add(f'tl.set("#{cid} .count-num", {{ textContent: "{c.get("prefix", "")}{v}" }}, {r3(at + run * n / steps)});')
    add(f'tl.fromTo("#{cid} .count-num", {{ scale: 1.5 }}, {{ scale: 1, duration: 0.3, ease: "back.out(3)", immediateRender: false }}, {r3(at + run)});')
    add(f'tl.to("#{cid} .count-in", {{ autoAlpha: 0, duration: 0.2 }}, {r3(start + dur - 0.2)});')
    sfx_marks.append((at + run, c.get("sfx", "coins-sell"), 0.5))


def ticker(i, items, start, dur):
    kid = f"tick-{i}"
    cells = []
    for it in items * 4:
        gem = f'assets/stills/gem-{it["stone"]}.png'
        arrow = '<span class="up">▲</span>' if it.get("up") else '<span class="dn">▼</span>'
        cells.append(f'<span class="t-cell"><img src="{gem}" alt="">{esc(it["name"])} <b>{it["price"]}</b> {arrow}</span>')
    over_html.append(f'      <div id="{kid}" class="clip ticker" data-start="{r3(start)}" data-duration="{r3(dur)}" data-track-index="35"><div class="t-track">{"".join(cells)}</div></div>')
    add(f'tl.fromTo("#{kid}", {{ y: 120 }}, {{ y: 0, duration: 0.25, ease: "power3.out" }}, {r3(start)});')
    add(f'tl.fromTo("#{kid} .t-track", {{ x: 0 }}, {{ x: -{int(560 * dur)}, duration: {r3(dur)}, ease: "none" }}, {r3(start)});')


def overlays(b, i, start, dur):
    """Textos y gráficos encima de la toma. `wordsDur` deja la frase sobre los cortes siguientes."""
    if b.get("caption"):
        caption(i, b, start, dur)
    if b.get("town"):
        town_label(i, b["town"], start, dur)
    if b.get("words"):
        words(i, b["words"], start, b.get("wordsDur", dur), b.get("wordsAt"))
    if b.get("stamp"):
        stamp(i, b["stamp"], start, dur)
    if b.get("counter"):
        counter(i, b["counter"], start, dur)
    if b.get("ticker"):
        ticker(i, b["ticker"], start, dur)


for b in beats:
    i, start, dur = b["i"], b["t"], b["dur"]
    if b["kind"] == "card":
        cid = f"card-{i}"
        kicker = f'<div class="kicker">{esc(b["kicker"])}</div>' if b.get("kicker") else ""
        gems = "".join(f'<img class="c-gem" src="assets/stills/gem-{g}.png" alt="">' for g in b.get("gems", []))
        gems_html = f'<div class="c-gems">{gems}</div>' if gems else ""
        size = f' style="font-size:{b["size"]}px"' if b.get("size") else ""
        over_html.append(f'      <div id="{cid}" class="clip card" data-start="{r3(start)}" data-duration="{r3(dur)}" data-track-index="36">'
                         f'<div class="card-in">{kicker}<div class="card-text"{size}>{letters_html(b["text"])}</div>{gems_html}</div></div>')
        add(f'tl.fromTo("#{cid} .card-text .ch", {{ y: -120, autoAlpha: 0, scale: 2, filter: "blur(10px)" }}, {{ y: 0, autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.3, stagger: 0.035, ease: "back.out(2)" }}, {r3(start + 0.05)});')
        for n, sh in enumerate(["16px 0 rgba(255,50,90,0.8), -16px 0 rgba(40,230,255,0.8)", "6px 0 rgba(255,50,90,0.7), -6px 0 rgba(40,230,255,0.7)", "0 10px 0 rgba(140,94,19,0.55)"]):
            add(f'tl.set("#{cid} .card-text", {{ textShadow: "{sh}" }}, {r3(start + 0.05 + n * 0.12) if n else 0});')
        if b.get("gems"):
            add(f'tl.fromTo("#{cid} .c-gem", {{ scale: 0, rotation: -90, autoAlpha: 0 }}, {{ scale: 1, rotation: 0, autoAlpha: 1, duration: 0.35, stagger: 0.12, ease: "back.out(2.6)" }}, {r3(start + 0.45)});')
            for n in range(len(b["gems"])):
                sfx_marks.append((start + 0.47 + n * 0.12, "gem", 0.45))
        add(f'tl.to("#{cid} .card-in", {{ scale: 1.08, duration: {r3(dur - 0.5)}, ease: "none" }}, {r3(start + 0.3)});')
        add(f'tl.to("#{cid} .card-in", {{ autoAlpha: 0, scale: 1.4, filter: "blur(10px)", duration: 0.18, ease: "power2.in" }}, {r3(start + dur - 0.2)});')
        enter_fx(b, start, f"#{cid} .card-in")
        for name in b.get("sfx", []):
            sfx_marks.append((start + 0.05, name, AUDIO.get("hitVolume", 0.6)))
        continue

    if b["kind"] == "split":
        panels = b["panels"]
        n = len(panels)
        skew = b.get("skew", 0)
        gap = b.get("gap", 10)
        parts = []
        for k, p in enumerate(panels):
            x0, x1 = W * k / n, W * (k + 1) / n
            l0, l1 = (x0 + gap / 2) if k else -skew, (x1 - gap / 2) if k < n - 1 else W + skew
            poly = f"polygon({l0 + skew:.0f}px 0, {l1 + skew:.0f}px 0, {l1 - skew:.0f}px {H}px, {l0 - skew:.0f}px {H}px)"
            cx = (x0 + x1) / 2
            p_in, _ = fit_in(p["clip"], p.get("in", 0), dur, p.get("speed", 1), f"panel {i}.{k}")
            vid = video_el(f"v-{i}-{k}", p["clip"], p_in, start, dur, p.get("speed", 1),
                           style=f"transform: translateX({cx - W / 2:.0f}px) scale({p.get('scale', 1.15)});")
            label = f'<div class="p-label" style="left:{cx:.0f}px">{letters_html(p["label"])}</div>' if p.get("label") else ""
            parts.append(f'<div class="panel" id="p-{i}-{k}" style="clip-path: {poly}; -webkit-clip-path: {poly};"><div class="p-inner">{vid}</div></div>{label}')
        clips_html.append(f'      <div class="shot split" id="shot-{i}">{"".join(parts)}</div>')
        # El contenedor no tiene tiempo propio (los videos sí): se muestra sólo durante su corte.
        add(f'tl.set("#shot-{i}", {{ autoAlpha: 0 }}, 0);')
        add(f'tl.set("#shot-{i}", {{ autoAlpha: 1 }}, {r3(start)});')
        add(f'tl.set("#shot-{i}", {{ autoAlpha: 0 }}, {r3(start + dur)});')
        for k in range(n):
            add(f'tl.fromTo("#p-{i}-{k}", {{ y: {H if k % 2 else -H} }}, {{ y: 0, duration: 0.32, ease: "power3.out" }}, {r3(start + k * 0.07)});')
        if any(p.get("label") for p in panels):
            add(f'tl.fromTo("#shot-{i} .p-label .ch", {{ y: 50, autoAlpha: 0 }}, {{ y: 0, autoAlpha: 1, duration: 0.2, stagger: 0.012, ease: "back.out(2)" }}, {r3(start + 0.25)});')
        enter_fx(b, start, f"#shot-{i}")
        overlays(b, i, start, dur)
        if b.get("shake"):
            shake_at("#stage", start + b["shake"])
        for name in b.get("sfx", []):
            sfx_marks.append((start + 0.03, name, AUDIO.get("hitVolume", 0.6)))
        continue

    vid = video_el(f"v-{i}", b["clip"], b.get("in", 0), start, dur, b["speed"])
    clips_html.append(f'      <div class="shot" id="shot-{i}"><div class="inner" id="inner-{i}">{vid}</div></div>')
    z0, z1 = b.get("zoom", [1, 1])
    if z0 != 1 or z1 != 1:
        add(f'tl.fromTo("#inner-{i}", {{ scale: {z0} }}, {{ scale: {z1}, duration: {r3(dur)}, ease: "none" }}, {r3(start)});')
    if b["kind"] != "title":
        enter_fx(b, start, f"#shot-{i}")
    if b.get("shake") and b["kind"] != "title":
        shake_at("#stage", start + (b["shake"] if b["shake"] is not True else 0.05))
    for name in b.get("sfx", []) if b["kind"] != "title" else []:
        sfx_marks.append((start + 0.03, name, AUDIO.get("hitVolume", 0.6)))
    overlays(b, i, start, dur)

# Barras de cine.
for lb in G.get("letterbox", []):
    s, e = lb["from"], lb.get("to", "end")
    e = TOTAL if e == "end" else e
    add(f'tl.to(["#lb-top", "#lb-bot"], {{ height: {lb.get("size", 110)}, duration: 0.5, ease: "power2.inOut" }}, {r3(s)});')
    if e < TOTAL:
        add(f'tl.to(["#lb-top", "#lb-bot"], {{ height: 0, duration: 0.4, ease: "power2.inOut" }}, {r3(e - 0.4)});')

title_html = ""
tb = next((b for b in beats if b["kind"] == "title"), None)
if tb:
    ts = tb["t"]
    slam = ts + tb.get("slamAt", 0.6)
    logo = tb.get("logo")
    has_logo = logo and (HERE / logo).exists()
    if has_logo:
        logo_html = (f'<div id="t-logo" class="logo-wrap"><img class="logo" src="{logo}" alt="">'
                     f'<div class="sweep-mask" style="-webkit-mask-image:url({logo});mask-image:url({logo})"><div class="sweep"></div></div></div>')
    else:
        if logo:
            warnings.append(f"no existe {logo}: el cierre usa el nombre en texto")
        logo_html = f'<div id="t-logo" class="logo-text">{esc(tb.get("name", G.get("title", "").split("—")[0].strip()))}</div>'
    shards = "".join(f'<img class="shard sh{n}" src="assets/stills/gem-{g}.png" alt="">' for n, g in enumerate(tb.get("gems", [])))
    credits = f'<div id="t-credits" class="credits">{esc(tb["credits"])}</div>' if tb.get("credits") else ""
    title_html = f'''      <div id="title" class="clip title" data-start="{r3(ts)}" data-duration="{r3(TOTAL - ts)}" data-track-index="40">
        <div id="t-box" class="t-box">
          <div class="veil"></div>
          <div id="t-rays" class="rays"></div>
          <div id="t-ring" class="ring"></div>
          {shards}
          {logo_html}
          <div id="t-tag" class="tagline">{letters_html(tb.get("tagline", ""))}</div>
          <div id="t-cta" class="cta">{esc(tb.get("cta", ""))}</div>
          {credits}
        </div>
      </div>'''
    add(f'tl.fromTo("#title .veil", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6, ease: "power1.out" }}, {r3(ts)});')
    add(f'tl.fromTo("#t-rays", {{ opacity: 0, scale: 0.6, rotation: 0 }}, {{ opacity: 0.6, scale: 1, rotation: 40, duration: {r3(TOTAL - slam)}, ease: "none" }}, {r3(slam)});')
    add(f'tl.fromTo("#t-logo", {{ scale: 2.6, autoAlpha: 0 }}, {{ scale: 1, autoAlpha: 1, duration: 0.3, ease: "power4.in" }}, {r3(slam - 0.3)});')
    flash_at(slam, 1, 0.6)
    add(f'tl.fromTo("#t-ring", {{ scale: 0.2, autoAlpha: 1 }}, {{ scale: 10, autoAlpha: 0, duration: 1.0, ease: "power2.out" }}, {r3(slam)});')
    # Esquirlas: cada gema sale disparada hacia afuera girando.
    dirs = [(-760, -330, -300), (720, -360, 280), (-880, 260, 220), (840, 300, -260), (40, -470, 360), (-120, 480, -200)]
    for n in range(len(tb.get("gems", []))):
        dx, dy, rot = dirs[n % len(dirs)]
        add(f'tl.fromTo("#title .sh{n}", {{ x: 0, y: 0, scale: 0.4, rotation: 0, autoAlpha: 1 }}, {{ x: {dx}, y: {dy}, scale: 1.3, rotation: {rot}, autoAlpha: 0, duration: 1.3, ease: "power3.out" }}, {r3(slam)});')
    shake_at("#t-box", slam, 1.4)
    add(f'tl.to("#t-logo", {{ scale: 1.05, duration: {r3(max(0.5, TOTAL - slam - 1))}, ease: "none" }}, {r3(slam + 0.35)});')
    if has_logo:
        add(f'tl.fromTo("#t-logo .sweep", {{ x: -1500 }}, {{ x: 1500, duration: 0.9, ease: "power2.inOut" }}, {r3(slam + 0.7)});')
    add(f'tl.fromTo("#t-tag .ch", {{ y: 30, autoAlpha: 0 }}, {{ y: 0, autoAlpha: 1, duration: 0.25, stagger: 0.02, ease: "back.out(2)" }}, {r3(slam + 0.9)});')
    add(f'tl.fromTo("#t-cta", {{ autoAlpha: 0, scale: 1.4 }}, {{ autoAlpha: 1, scale: 1, duration: 0.5, ease: "power2.out" }}, {r3(slam + 1.7)});')
    if credits:
        add(f'tl.fromTo("#t-credits", {{ autoAlpha: 0 }}, {{ autoAlpha: 0.85, duration: 0.6 }}, {r3(slam + 2.3)});')
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
placed = set()
lanes = []  # fin del último sonido de cada carril


def find_sfx(name):
    for d in sfx_dirs:
        for ext in (".ogg", ".mp3", ".wav"):
            if (HERE / d / f"{name}{ext}").exists():
                return f"{d}/{name}{ext}"
    return None


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
    lane = next((n for n, end in enumerate(lanes) if end <= at - 0.01), None)
    if lane is None:
        lanes.append(0)
        lane = len(lanes) - 1
    lanes[lane] = at + dur
    audio_html.append(f'      <audio id="sfx-{sfx_n}" src="{src}" data-start="{r3(at)}" data-duration="{r3(dur)}" data-volume="{r3(min(1, vol))}" data-track-index="{50 + lane}"></audio>')
    sfx_n += 1


gain = AUDIO.get("sfxGain", 1.0)
for b in beats:
    sources = []
    if b["kind"] == "split":
        sources = [(p["clip"], p.get("in", 0), p.get("speed", 1)) for p in b["panels"][: b.get("soundPanels", 1)]]
    elif b.get("clip"):
        sources = [(b["clip"], b.get("in", 0), b["speed"])]
    for clip, lo, speed in sources:
        info = clip_info(clip)
        hi = lo + b["dur"] * speed
        for ev in info.get("events", []):
            if lo <= ev["t"] < hi:
                vol = ev.get("vol", AUDIO.get("sfxVolume", 0.5)) * gain
                if ev["sfx"].startswith("step-"):
                    vol *= AUDIO.get("stepGain", 0.6)
                sfx(ev["sfx"], b["t"] + (ev["t"] - lo) / speed, vol)
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
