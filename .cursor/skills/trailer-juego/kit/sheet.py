#!/usr/bin/env python3
"""Hoja de contacto de las tomas: 4 cuadros por toma (a 10/35/60/85 %) para revisarlas de un vistazo.

    python3 sheet.py [toma ...]     → renders/sheet-<toma>.png
"""
import json, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent
CLIPS = HERE / "assets/clips"
OUT = HERE / "renders"
OUT.mkdir(exist_ok=True)

ids = sys.argv[1:] or sorted(p.stem for p in CLIPS.glob("*.mp4"))
for cid in ids:
    info = json.loads((CLIPS / f"{cid}.json").read_text())
    n = round(info["seconds"] * info["fps"])
    picks = [int(n * p) for p in (0.1, 0.35, 0.6, 0.85)]
    sel = "+".join(f"eq(n\\,{f})" for f in picks)
    dest = OUT / f"sheet-{cid}.png"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(CLIPS / f"{cid}.mp4"),
                    "-vf", f"select='{sel}',scale=960:540:flags=neighbor,tile=2x2", "-frames:v", "1", str(dest)], check=True)
    print(dest)
