"""Copia música elegida, efectos, ambientes y candidatas al proyecto, y escribe los créditos."""
import json
import pathlib
import shutil
import sys

HERE = pathlib.Path(__file__).parent
ROOT = pathlib.Path(sys.argv[1])

# Lugar del juego → candidata elegida por defecto.
CHOSEN = {
    "verdelume": "verdelume-a",
    "duneshade": "duneshade-a",
    "frostholm": "frostholm-b",
    "road-mountain": "ruta2-a",
    "road-desert": "ruta3-a",
    "road-snow": "ruta4-a",
    "refuge": "cueva-a",
    "refuge-plot": "tierra-a",
    "title": "titulo-a",
    "chase": "persecucion-a",
}

music = json.loads((HERE / "music_done.json").read_text())
by_id = {m["id"]: m for m in music}

mdir = ROOT / "public/assets/music"
sdir = ROOT / "public/assets/sfx"
adir = ROOT / "public/assets/ambience"
cdir = ROOT / "studio/musica/candidatas"
for d in (mdir, sdir, adir, cdir):
    d.mkdir(parents=True, exist_ok=True)

for area, cid in CHOSEN.items():
    shutil.copy(HERE / "out" / f"{cid}.ogg", mdir / f"{area}.ogg")
for m in music:
    shutil.copy(HERE / "out" / m["file"], cdir / m["file"])
for f in (HERE / "sfx_out").glob("*.ogg"):
    shutil.copy(f, sdir / f.name)
for f in (HERE / "amb_out").glob("*.ogg"):
    shutil.copy(f, adir / f.name)

# Manifiesto para la página de escuchar (se sube a git; los .ogg candidatos no).
manifest = [{k: m[k] for k in ("id", "for", "title", "author", "license", "page", "duration", "file")} | {"chosen": CHOSEN.get(m["for"]) == m["id"]} for m in music]
(ROOT / "studio/musica/candidatas.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))

credits = json.loads((HERE / "sfx_credits.json").read_text())
lines = ["# Créditos de audio", "", "Todo es de uso libre. CC0 = dominio público (el crédito es cortesía).",
         "CC-BY = hay que dar crédito (aquí y en los créditos del juego).", "", "## Música por lugar", ""]
for area, cid in CHOSEN.items():
    m = by_id[cid]
    lines += [f"- **{area}** → *{m['title']}* — {m['author']} · {m['license']} · {m['page']}", f"  - `music/{area}.ogg`"]
lines += ["", "Pistas de antes (siguen en uso): ver `proto/CREDITS.md` (Ashfen, Valkeep, Ruta 1).", "",
          "## Efectos", ""]
for name, c in sorted(credits["sfx"].items()):
    lines.append(f"- `sfx/{name}.ogg` — {c['credit']} (origen: `{c['src']}`)")
lines += ["", "## Ambientes", ""]
for name, c in sorted(credits["amb"].items()):
    lines.append(f"- `ambience/{name}.ogg` — {c['credit']} (origen: `{c['src']}`)")
(ROOT / "public/assets/CREDITS.md").write_text("\n".join(lines) + "\n")
print("ok", len(CHOSEN), "pistas,", len(credits["sfx"]), "efectos,", len(credits["amb"]), "ambientes,", len(music), "candidatas")
