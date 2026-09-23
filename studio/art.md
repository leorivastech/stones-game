# Arte — qué puedo hacer yo y qué no

Estado: **regla de pipeline + tercera pasada visual (detalle y textura)**. 2026-09-19.

Este proyecto es **Phaser 4, 2D**. No Three.js. Phaser ya dibuja en WebGL;
Three.js sería otro motor y otro juego.

## Pipeline

1. **Proto en código** (`src/gfx/`): formas, piedras, tiles, UI. Se ve ya.
2. **Proto imagen** (`public/assets/proto/`): mood / concepto si hace falta una imagen.
3. **Final** (`public/assets/final/`): PNG/audio que Leo cierra. El juego los carga en `preload()`.

Nunca mezclar proto y final en la misma carpeta.

## Qué puedo crear yo (rápido, barato, iterable)

| Cosa | Cómo | Calidad |
|---|---|---|
| Piedras, orbes, umbral | `Graphics` + `generateTexture` | Buena para proto y a veces para ship |
| Tiles de piso, ruido, patrones | Canvas / Graphics | Buena para proto |
| Jugador placeholder | Rectángulo o blob pixel | Solo proto |
| UI (marcos, texto, barras) | `Text` + Graphics | Suficiente |
| Polvo, brillo | Particles | Buena |
| Pulso, flotar, shake | Tweens | Buena |
| Beeps / pads simples | WebAudio más adelante | Placeholder |

## Qué no debo fingir que “hago con Three.js”

- Personaje ilustrado con cara y ropa.
- Fondo pintado tipo concepto art dentro del canvas del juego.
- Cinemáticas 3D.
- Música orquestal.

Eso entra por `public/assets/final/` cuando Leo lo tenga (o cuando pidamos una imagen de concepto y la bajemos a `proto/`).

## Para este juego (contrabando)

Pueblos = plazas. El caminante es un spritesheet 4 direcciones (`src/gfx/walker.js`).
Pisos: tiles 96px con zacate, surcos en la tierra y adoquines irregulares.
Encuentros de ruta: guardias, bandidos, caballos y carreta en `src/gfx/npcs.js` (proto, no ilustrados).
El caballo propio usa esa silueta con silla y sólo se muestra en los caminos: acompaña al
caminante de lado, con paso y polvo suaves. No aparece dentro de los pueblos.

## Paleta (medieval suave)

- Pasto: `#4a5c38`
- Tierra: `#6b5340`
- Cobble: `#6e6860`
- Techo: `#8b3a2a`
- Capa del caminante: `#6b3a28`
- Ámbar: `#c45c20`
- Oro / UI: `#c9a227` / `#f0e6d4`

Todo sale de `src/gfx/bake.js` (Graphics → `generateTexture`). Sin PNG.
Casas: silueta irregular, techo de paja asentado sobre el muro (no flotando). Pueblo: 1000×700,
cámara 0.85 con 90 px de margen arriba para el HUD.

## Reglas de dibujo (aprendidas a golpes)

- **Sin máscaras de geometría.** Fallan en el navegador de Cursor. Recorte = matemática
  (punto dentro de elipse/banda) y relleno por tramos (`fillBand`, `sprinkleBand`).
- **Verificar en WebGL y en Canvas.** Si algo se ve distinto entre los dos, está mal hecho.
- Un bioma se lee por **piso + props + landmark + luz**, no solo por el tinte del pasto.
- Detalle en capas: relleno base → manchas grandes → grano fino → props con sombra → luz/velo.

## Por pueblo

| Pueblo | Piso / calle | Detalle de piso | Landmark | Luz |
|---|---|---|---|---|
| Ashfen | pasto / tierra | matas, flores, manchas de pasto | cerca, heno, arena con marea | velo ámbar 4 % |
| Valkeep | highland / tierra | lajas, grava, matas pálidas | cordón de riscos, peñas, peñascos | velo gris 6 % |
| Verdelume | selva / barro | charcos, hojarasca, raíces, helechos | doble fila de árboles, enredaderas en techos | velo verde 7 % |
| Duneshade | arena / tierra | rizos de duna, grietas, matas secas | palmeras, juncos, cactus, huesos | velo cálido 8 % |
| Frostholm | nieve / nieve pisada | montículos, hielo, huellas | banco de hielo, témpanos, nieve en techos, árboles secos | velo frío 10 % |

Plaza común: adoquín con bordillo, puesto a rayas, dos puestos laterales, cuatro faroles con
brillo, banderines, pozo con agua viva. Sobre todo: sombras de nubes que cruzan y viñeta.

## Props horneados (`bake.js`)

Árboles: `tree`, `tree-pine`, `tree-pine-snow`, `tree-palm`, `tree-bare`. Suelo: `bush`, `fern`,
`bigleaf`, `flowers`, `tuft`, `reed`, `cactus`, `rock`, `boulder`, `cliff`, `ore-pile`, `bones`.
Pueblo: `stall`, `stall-side`, `lantern`, `well`, `forge`, `fence`, `banner`, `post`, `gate`,
`barrel`, `crate`, `hay`. Overlays de casa: `roof-snow`, `roof-vines`.

## Segunda pasada visual

- Suelos orgánicos de 96×96: se eliminó el tramado 2×2 que hacía visible una cuadrícula.
- Adoquín irregular con mortero, luz de canto y filas alternadas.
- Árboles, arbustos y casas con tres valores de luz, textura y sombras más legibles.
- Props que cuentan oficio: mineral, barriles, cajas, heno y rocas.
- Cinco regiones legibles con el mismo lenguaje visual: Ashfen verde y polvorienta, Valkeep
  húmeda y arcana, Verdelume selvática, Duneshade arenosa y Frostholm nevada.
- Mapa de prueba (`studio/maps/stones-mapa-atajo-13.png`): Valkeep es pueblo de montaña;
  Verdelume es selva. El camino 2→3 está libre; el atajo de montañas es 1→3.
- Se agregaron tiles generados de selva, arena y nieve; partículas de escarcha y motas rúnicas.
- Profundidad por coordenada Y: el caminante pasa delante o detrás de casas, vegetación y NPCs.
- Partículas discretas de polvo, hojas, humo de chimenea y pisadas.
- HUD enmarcado con jerarquía: recursos a la izquierda, objetivo y riesgo a la derecha.
- Mercado con teclas `E`/`Q` animadas al acercarse, piedra viajando entre puesto y caminante,
  y texto flotante diferente para compra y venta.
- Canvas 16:9 adaptable con `FIT`; conserva 800×450 internos y escala con la ventana.
- Cada pueblo conserva la plaza y la silueta general, pero cambia suelo, tinte de casas,
  vegetación, partículas y mercancía para que el bioma se lea sin cambiar el diseño base.

Esto sigue siendo **arte proto producido en código**, no arte final. El siguiente salto real
de calidad sería cerrar una hoja de personaje y una casa como PNG final, manteniendo la
misma silueta y paleta para reemplazarlas sin tocar mecánicas.

## Música y SFX

Tres identidades CC0 con fundido al cambiar escena:

- **Ashfen:** *A Small Fire Will Do* — guitarra simple, pequeña y hogareña.
- **Camino:** *Iremos Forest Theme Loop* — bosque corto, misterioso y más tenso.
- **Valkeep:** *Mystical RPG Maker Town Theme* — pueblo arcano, más rico que Ashfen.

Archivos en `public/assets/proto/music/`. *The Old Tower Inn* queda como referencia sin uso.

SFX de encuentros (caballo, cuerno, carreta, monedas, cuchillo, metal): `public/assets/proto/sfx/`. Créditos en `CREDITS.md`.
