#!/usr/bin/env python3
"""Mapa rítmico de la música del trailer: tempo, golpes y cómo sube la energía.

    .venv/bin/python beats.py ../public/assets/music/title.ogg

Escribe assets/beats.json (golpes y compases en segundos + energía por segundo) para cortar las
tomas al ritmo. Imprime un resumen para elegir dónde va cada acto.
"""
import json
import sys
from pathlib import Path

import librosa
import numpy as np

HERE = Path(__file__).parent
src = sys.argv[1] if len(sys.argv) > 1 else "../public/assets/music/title.ogg"
y, sr = librosa.load(src, sr=22050, mono=True)
tempo, frames = librosa.beat.beat_track(y=y, sr=sr)
beats = librosa.frames_to_time(frames, sr=sr)
tempo = float(np.atleast_1d(tempo)[0])

# Energía (RMS) por segundo, normalizada 0-1: dónde la canción crece y dónde respira.
rms = librosa.feature.rms(y=y)[0]
t = librosa.frames_to_time(np.arange(len(rms)), sr=sr)
secs = int(t[-1]) + 1
energy = [float(rms[(t >= s) & (t < s + 1)].mean()) for s in range(secs)]
peak = max(energy)
energy = [round(e / peak, 3) for e in energy]

# Golpes fuertes (onsets con mucha fuerza): buenos para flashes.
onset_env = librosa.onset.onset_strength(y=y, sr=sr)
onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, units="time")
strength = onset_env[librosa.time_to_frames(onsets, sr=sr)]
strong = [round(float(o), 3) for o, s in zip(onsets, strength) if s > np.percentile(strength, 85)]

bars = [round(float(b), 3) for b in beats[::4]]
out = {"src": src, "tempo": round(tempo, 2), "beats": [round(float(b), 3) for b in beats], "bars": bars,
       "strong": strong, "energy": energy}
(HERE / "assets").mkdir(exist_ok=True)
(HERE / "assets/beats.json").write_text(json.dumps(out, indent=1))
print(f"tempo {tempo:.1f} bpm · {len(beats)} golpes · compás cada {60 / tempo * 4:.2f} s")
print("compases:", " ".join(f"{b:.1f}" for b in bars))
print("energía por segundo (0-9):")
line = "".join(str(min(9, int(e * 10))) for e in energy)
for i in range(0, len(line), 60):
    print(f"  {i:3}s {line[i:i + 60]}")
print("golpes fuertes:", " ".join(f"{s:.1f}" for s in strong[:60]))
