# Música y sonidos de Stones

Todo es de licencia libre: **CC0** (dominio público) o **CC-BY** (hay que dar crédito). Nada de
CC-BY-SA, NC ni licencias propias (Pixabay, Sonniss). Créditos del juego: `public/assets/CREDITS.md`.

## Escuchar y elegir

Con el juego corriendo (`npm run dev`): **http://127.0.0.1:5181/escuchar.html**

- Música candidata por lugar (la que dice EN USO es la del juego), ambientes y efectos.
- Las candidatas viven en `studio/musica/candidatas/` (no se suben a git: ~50 MB). La lista está en
  `candidatas.json`.

## Qué suena dónde

| Lugar | Música | Ambiente |
|---|---|---|
| Título | Little Epic Journey (Zhelanov, CC-BY 4.0) | — |
| Ashfen | A Small Fire Will Do (CC0, de antes) | olas |
| Valkeep | Mystical RPG Maker Town Theme (CC0, de antes) | — |
| Verdelume | I think I'd stay (jungle chill) (Emmntt, CC0) | selva |
| Duneshade | Desert Loop (iamoneabe, CC0) | viento del desierto |
| Frostholm | Winter Wind (wipics, CC0) | viento de nieve |
| Ruta 1 | Iremos Forest (CC0, de antes) | — |
| Ruta 2 | Medieval: Exploration (RandomMind, CC0) | — |
| Ruta 3 | Shifting Sands of Ma-Kali (Hitctrl, CC-BY 3.0) | selva |
| Ruta 4 | frozen orchard (Bobjt, CC0) | viento de nieve |
| Cuevas | Cave Theme (HaelDB, CC0) | cueva |
| Tierra escondida | Tavern (yd, CC0) | selva |
| Persecución | Medieval: Battle (RandomMind, CC0) — suena cuando un guardia te persigue | — |

Efectos (Kenney y OpenGameArt, CC0): arco, flecha, bastón, golpes, armadura, muerte, lobo, jabalí,
escorpión, pasos por suelo (pasto, piedra, madera, arena, nieve), puertas, cofre, palanca, monedas,
gema, menú y fanfarrias (encargo, fama, deuda pagada).

## Cambiar una pista

1. Elegir el código en `escuchar.html` (por ejemplo `duneshade-b`).
2. En `herramientas/install.py`, poner ese código en `CHOSEN` para su lugar.
3. Correr las herramientas (abajo) o, más corto, copiar `candidatas/<código>.ogg` a
   `public/assets/music/<lugar>.ogg` y actualizar `CREDITS.md` y `candidatas.json`.

## Rehacer todo desde cero

Las herramientas trabajan en una carpeta temporal (bajan a `raw/`, `packs/`, `zips/`):

```bash
cp -r studio/musica/herramientas /tmp/stones-audio && cd /tmp/stones-audio
python3 get_music.py      # baja y normaliza la música candidata (-18 LUFS)
bash get_sfx.sh           # baja paquetes de efectos (Kenney, OpenGameArt)
python3 make_sfx.py       # recorta y normaliza efectos y ambientes
python3 install.py ~/Development/stones_Game   # copia al proyecto y escribe CREDITS.md
```

El ambiente del mar se recortó a mano (90 s de *Sea and river wave sounds*, RandomMind, CC0).

## Qué falta

- Relincho de caballo, escorpión real, silbato de guardia, deslizar en hielo, murmullo de mercado:
  están en freesound (CC0) pero bajar requiere cuenta. Lista en la sesión `2026-09-23-musica.md`.
- Probar los puntos de repetición de cada pista jugando.
