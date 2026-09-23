"""Baja la música candidata (music.json) a raw/ y la convierte a OGG normalizado en out/.

Normaliza a -18 LUFS (EBU R128) para que todas suenen parejo. Estéreo, 44.1 kHz, OGG q4.
"""
import io
import json
import pathlib
import subprocess
import sys
import urllib.request
import zipfile

HERE = pathlib.Path(__file__).parent
RAW = HERE / "raw"
OUT = HERE / "out"
RAW.mkdir(exist_ok=True)
OUT.mkdir(exist_ok=True)

items = json.loads((HERE / "music.json").read_text())
for it in items:
    ext = it["url"].rsplit(".", 1)[-1].lower()
    raw = RAW / f"{it['id']}.{ext if ext != 'zip' else it['zipMember'].rsplit('.', 1)[-1]}"
    if not raw.exists():
        try:
            req = urllib.request.Request(it["url"], headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(req, timeout=120).read()
        except Exception as e:  # noqa: BLE001
            print("FALLÓ", it["id"], e)
            continue
        if ext == "zip":
            z = zipfile.ZipFile(io.BytesIO(data))
            member = next(n for n in z.namelist() if n.endswith(it["zipMember"]))
            data = z.read(member)
        raw.write_bytes(data)
    out = OUT / f"{it['id']}.ogg"
    if not out.exists():
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", "loudnorm=I=-18:TP=-1.5:LRA=11",
               "-ar", "44100", "-ac", "2", "-c:a", "libvorbis", "-q:a", "4", str(out)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode:
            print("FFMPEG FALLÓ", it["id"], r.stderr[:300])
            continue
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)],
                         capture_output=True, text=True).stdout.strip()
    it["duration"] = round(float(dur or 0))
    it["file"] = out.name
    it["kb"] = out.stat().st_size // 1024
    print(f"ok {it['id']:16} {it['duration']:4}s {it['kb']:5} KB  {it['title']}")

(HERE / "music_done.json").write_text(json.dumps(items, ensure_ascii=False, indent=1))
