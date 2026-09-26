# Música y sonidos de Stones

Desde el 26-sep-2026 **toda la música y casi todos los efectos son propios**, generados con IA local
(ACE-Step 1.5, MIT; MOSS-SoundEffect v2, Apache-2.0). Cómo se generaron: `ia/README.md`.
Qué archivo suena en cada lugar: **un solo objeto, `src/audio-ia.js`** (`ELEGIDAS`, `STINGERS`,
`AMBIENTES`, `SFX_IA`, `PASOS`). Créditos de lo poco de antes que sigue sonando: `public/assets/CREDITS.md`.

## Escuchar y elegir

Con el juego corriendo (`npm run dev`): **http://127.0.0.1:5181/escuchar.html**

- **Música IA**: cada zona con botones para oír calma, tensión y ambas mezcladas (deslizador de tensión),
  todas las variantes y cuál está ELEGIDA. Los selectores dejan probar otra variante en la mezcla.
- **Stingers** y **Efectos IA** (con la clave del juego que usa cada uno).
- «Antes»: lo de OpenGameArt/Kenney, por si hace falta comparar.

Para cambiar una variante: el número en `ELEGIDAS` (o `STINGERS`) de `src/audio-ia.js`.

## Cómo suena en el juego (`src/music.js`)

- **Capas**: cada zona toca calma y tensión a la vez, en loop y con el mismo largo (misma tonalidad y
  bpm). La tensión sube con la persecución (1), con el calor de la ruta (0.25 con calor ≥45, 0.4 con
  ≥70) o con `setTension(v)`; cruza en 800 ms. Cambiar de zona es un fundido cruzado.
- **Buses**: música / ambiente / efectos (`setVolume(bus, v)`, `getVolume(bus)`; se guardan en
  `localStorage["stones-vol"]`). Falta el control en la pausa.
- **Ducking** (`duckTheme`/`restoreTheme` de `sfx.js`): fundido de 250 ms; también baja el ambiente (menos).
- **Stingers**: `stinger("llegada" | "fama" | "cobrador" | "redada" | "ko" | "amanecer" | "anochecer")` baja
  la música 1.5 s y toca el clip. Amanecer y anochecer ya suenan solos (music.js mira la hora); la
  fanfarria de título de fama (`jingle-fame`) ahora es el stinger `fama`. Los demás falta conectarlos.
- **Ambiente**: loops IA de 3-5 s, dos copias desfasadas para tapar la costura. La selva cambia aves
  por grillos de noche (fundido de 2 s).

### Variantes elegidas (26-sep, por CLAP)

Regla: la de mayor `clap_sim`, prefiriendo `clap_puesto` bajo y duración normal; en empate, la de menos
probabilidad de voz. CLAP es flojo para «calma» (casi todas salen con puesto alto), así que conviene
oírlas. ⚠️ = `clap_prob_voz` > 0.7: escuchar por si suena como canto.

| Zona (clave del mapa) | Calma | Tensión | bpm · tono |
|---|---|---|---|
| Título (`title`) | `title-calma-3` (0.371) | — | 90 · D |
| Ashfen (`ashfen`) | `ashfen-calma-1` (0.278) | `ashfen-tension-1` (0.468, puesto 1) | 96 · G |
| Valkeep (`valkeep`) | `valkeep-calma-2` (0.212, empate; menos voz) | `valkeep-tension-2` (0.299) | 84 · Dm |
| Verdelume (`verdelume`) | `verdelume-calma-2` (0.448) ⚠️ | `verdelume-tension-2` (0.438) ⚠️ | 104 · Am |
| Duneshade (`duneshade`) | `duneshade-calma-1` (0.304) ⚠️ | `duneshade-tension-1` (0.345) ⚠️ | 100 · Em |
| Frostholm (`frostholm`) | `frostholm-calma-2` (0.363) | `frostholm-tension-1` (0.375) ⚠️ | 72 · F |
| Mossgrove (mapa `mossgrove`, declara `verdelume`) | `mossgrove-calma-1` (0.278) | `mossgrove-tension-2` (0.347) ⚠️ | 80 · Em |
| Ruta 1 (`road`) | `ruta-pradera-calma-1` (0.179) ⚠️ | `ruta-pradera-tension-1` (0.539) | 110 · G |
| Ruta 2 (`road-mountain`) | `ruta-montana-calma-2` (0.293) | `ruta-montana-tension-2` (0.479) ⚠️ | 104 · Dm |
| Ruta 3 (mapa `ruta3`, declara `road-desert`) | `ruta-selva-calma-2` (0.434) ⚠️ | `ruta-selva-tension-1` (0.406) ⚠️ | 112 · Am |
| Ruta 4 (`road-snow`) | `ruta-nieve-calma-2` (0.206) ⚠️ | `ruta-nieve-tension-1` (0.359) ⚠️ | 100 · Fm |
| Ruta 5 (`road-desert`) | `ruta-desierto-calma-1` (0.278) ⚠️ | `ruta-desierto-tension-2` (0.394) ⚠️ | 106 · Em |
| Cuevas (`refuge`) | `refugio-cueva-calma-1` (0.129) | `refugio-cueva-tension-1` (0.558, puesto 1) | 66 · Cm |
| Tierra escondida (`refuge-plot`) | `refugio-tierra-calma-2` (0.191) | `refugio-tierra-tension-2` (0.361) | 78 · C |

`road-desert` lo usan Ruta 3 y Ruta 5: `music.js` las distingue por el id del mapa (`MAP_ZONA`), sin
tocar los mapas. La persecución ya no tiene pista propia: sube la capa de tensión de la zona.

Stingers: `llegada-2`, `fama-3`, `cobrador-3`, `redada-2`, `ko-3`, `amanecer-3`, `anochecer-1` (los
tres de anochecer salieron con CLAP casi 0: oírlos).

### Efectos: IA y de antes

- **IA** (clave del juego → archivo): `coins` (pagar) → moneda-pagar; `coins-sell` → moneda-vender;
  `gem` (comprar) → moneda-comprar; tono `hit` → golpe-baston; tono `bump` → impacto-2; tono `hurt` →
  dano-jugador; `chest` → cofre-abrir; `door-open` → puerta-madera-2; `horse` → relincho-1; `horn` →
  cuerno-guardia; `boar` → jabali-grunido; `growl`/`wolf` → lobo-grunido; `scorpion` → escorpion;
  `bow` → flecha; pasos por suelo → paso-pasto (5-8), paso-piedra/madera/arena/nieve (1-8).
  Claves nuevas sin conectar: `bell` (campana), `scroll` (pergamino), `seal` (sello), `shop`
  (tienda-abrir), `gust` (viento-rafaga).
- **Descartados** por CLAP: `puerta-madera-1` (0.009), `relincho-2` (0.085, puesto 14). `impacto-1` no
  salió (sólo quedó un .wav a medias, borrado). Ninguno dura < 0.1 s ni tiene pico bajo (todos a −3 dB).
- **De antes** (no hay equivalente IA): silbido del bastón (`swing`), flecha que pega (`arrow-hit`),
  armadura, muerte de bicho, palanca, chapuzón, moneda suelta del HUD (`coin`), `draw`, `latch`,
  `sack`, `chop`, fanfarrias `jingle-mission` y `jingle-free`, menú (`ui-move`/`ui-ok`/`ui-error`) y
  el ambiente de cueva. Los tonos de 8 bits sintetizados siguen para menú, texto, salto y alertas.

## Cómo se juntó la música de antes (OpenGameArt/Kenney, ya no suena)

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

- Control de volumen (música / ambiente / efectos) en la pausa: la API ya está (`setVolume`, `getVolume`).
- Conectar los stingers `llegada`, `cobrador`, `redada`, `ko` y los efectos nuevos (`shop`, `bell`,
  `scroll`, `seal`, `horse`, `gust`) en `world.js`/`ui.js`.
- Oír las variantes marcadas ⚠️ y los tres `anochecer` (CLAP no es de fiar para calma ni para stingers).
- Las pistas no fueron hechas para repetirse sin pausa: en la costura del loop hay un fundido corto.
- Silbato de guardia, deslizar en hielo, murmullo de mercado, cueva: no se generaron con IA todavía.
