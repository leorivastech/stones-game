#!/usr/bin/env python3
"""Voz del narrador con edge-tts (Microsoft, gratis, necesita red). Una pista por línea de guion.json (o del guion que se le pase).

    .venv/bin/python make_voice.py          # primera vez: python3 -m venv .venv && .venv/bin/pip install edge-tts

Escribe assets/vo-<clave>.mp3 y assets/vo.json (duraciones que build.py usa para medir los cortes).
Solo regenera las líneas que cambiaron (compara el texto guardado en vo.json).
"""
import asyncio, json, subprocess, sys
from pathlib import Path

import edge_tts

HERE = Path(__file__).parent
G = json.loads((HERE / (sys.argv[1] if len(sys.argv) > 1 else "guion.json")).read_text())
V = G["voice"]
OUT = HERE / "assets"
OUT.mkdir(exist_ok=True)
META = OUT / "vo.json"


def duration(p: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(p)],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def tighten(p: Path):
    """Teaser: sin silencio en las orillas y pausas internas de 0.25 s (edge-tts deja casi 1 s)."""
    tmp = p.with_suffix(".tight.mp3")
    af = ("silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.3:stop_silence=0.25:stop_threshold=-45dB,"
          "areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=60,apad=pad_dur=0.15")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(p), "-af", af, "-b:a", "96k", str(tmp)], check=True)
    tmp.replace(p)


async def main():
    old = json.loads(META.read_text()) if META.exists() else {}
    sig = f'{V["voice"]}|{V.get("rate", "+0%")}|{V.get("pitch", "+0Hz")}' + ("|tight" if V.get("tight") else "")
    meta = dict(old)  # conserva las voces de otros guiones (v2, v3...)
    for key, text in G["lines"].items():
        dest = OUT / f"vo-{key}.mp3"
        prev = old.get(key, {})
        if dest.exists() and prev.get("text") == text and prev.get("sig") == sig:
            meta[key] = prev
            continue
        await edge_tts.Communicate(text, V["voice"], rate=V.get("rate", "+0%"), pitch=V.get("pitch", "+0Hz")).save(str(dest))
        if V.get("tight"):
            tighten(dest)
        meta[key] = {"dur": round(duration(dest), 2), "text": text, "sig": sig}
        print(f"{dest.name}  {meta[key]['dur']:.2f}s  {text}")
    META.write_text(json.dumps(meta, indent=1, ensure_ascii=False))


asyncio.run(main())
