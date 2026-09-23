#!/usr/bin/env python3
"""Junta hojas de contacto (renders/sheet-<toma>.png) de a 4 en una imagen, con el nombre encima.

    python3 sheets.py toma1 toma2 …   → renders/sheets-<n>.png
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
ids = sys.argv[1:]
for n in range(0, len(ids), 4):
    group = ids[n:n + 4]
    inputs, filters = [], []
    for i, cid in enumerate(group):
        inputs += ["-i", str(HERE / f"renders/sheet-{cid}.png")]
        filters.append(f"[{i}:v]drawtext=text='{cid}':x=12:y=12:fontsize=28:fontcolor=yellow:box=1:boxcolor=black@0.7[t{i}]")
    while len(group) < 4:
        inputs += ["-f", "lavfi", "-i", "color=c=black:s=960x540:d=1"]
        filters.append(f"[{len(group)}:v]null[t{len(group)}]")
        group.append("-")
    filters.append("[t0][t1][t2][t3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[out]")
    dest = HERE / f"renders/sheets-{n // 4}.png"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *inputs, "-filter_complex", ";".join(filters), "-map", "[out]", "-frames:v", "1", str(dest)], check=True)
    print(dest)
