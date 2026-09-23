#!/usr/bin/env python3
"""Revisa el último render: formato, volumen general, volumen por segundo (¿se oye la voz sobre la
música?) y una hoja con 8 cuadros sacados del MP4 final.

    python3 check_render.py [renders/archivo.mp4]   → renders/render-sheet.png
"""
import re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent
mp4 = Path(sys.argv[1]) if len(sys.argv) > 1 else max((HERE / "renders").glob("*.mp4"), key=lambda p: p.stat().st_mtime)
run = lambda *a: subprocess.run(a, capture_output=True, text=True).stderr + subprocess.run(a, capture_output=True, text=True).stdout

info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration",
                       "-of", "default=nw=1", str(mp4)], capture_output=True, text=True).stdout
print(mp4.name)
print(" ".join(l for l in info.split()))
dur = float(re.search(r"duration=([\d.]+)", info).group(1))


def vol(start=None, length=None):
    args = ["ffmpeg", "-hide_banner"]
    if start is not None:
        args += ["-ss", str(start), "-t", str(length)]
    args += ["-i", str(mp4), "-af", "volumedetect", "-vn", "-f", "null", "-"]
    out = subprocess.run(args, capture_output=True, text=True).stderr
    m = re.search(r"mean_volume: ([-\d.]+)", out)
    x = re.search(r"max_volume: ([-\d.]+)", out)
    return (float(m.group(1)) if m else None, float(x.group(1)) if x else None)


mean, peak = vol()
print(f"audio total: promedio {mean} dB · pico {peak} dB  (objetivo ≈ -20 promedio, pico < -1)")
row = []
for s in range(int(dur)):
    m, _ = vol(s, 1)
    row.append(f"{s:>2}s {m:>6}")
for i in range(0, len(row), 6):
    print("   " + "  ".join(row[i:i + 6]))

n_frames = int(dur * 30)
picks = [int(n_frames * p) for p in (0.04, 0.16, 0.3, 0.42, 0.55, 0.67, 0.8, 0.93)]
sel = "+".join(f"eq(n\\,{f})" for f in picks)
sheet = HERE / "renders/render-sheet.png"
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(mp4), "-vf", f"select='{sel}',scale=640:360,tile=4x2",
                "-frames:v", "1", str(sheet)], check=True)
print(f"hoja: {sheet}")
