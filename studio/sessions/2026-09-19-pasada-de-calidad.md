# 2026-09-19 · Pasada de calidad nocturna (detalle y textura)

## Qué pidió Leo

"Tómate el tiempo para mejorar todos los diseños, todo lo que puedas mejorar y dar detalle,
textura. Necesitamos un juego de más calidad." Se fue a dormir; el agente trabajó solo.

## Método

- Harness de capturas a zoom real: 5 pueblos (centro, costa, norte) + rutas en ambos sentidos,
  en Chrome **WebGL** y en Chrome **sin WebGL (Canvas)**. Diferencia por píxel entre ambos:
  < 0.05 % (Frostholm 1.7 % por copos y prompt del mercado). Cero errores de consola en 42 s.
- Nada de máscaras ni efectos que dependan del renderer: solo `Graphics` + imágenes horneadas.

## Qué se encontró y se corrigió

- `addTownAtmosphere` seguía colocando props con coordenadas del pueblo viejo (1400×1000):
  caían fuera del pueblo o en el mar. Reescrito para 1000×700 y por bioma.
- El HUD tapaba los primeros ~90 px del mundo (fila norte de casas, portón y letrero "NORTE").
  La cámara ahora empieza `TOP_PAD` (90 px) arriba del mundo y el piso se pinta hasta ahí.
- La ruta 4 en sentido Frostholm → Duneshade arrancaba en arena con cactus: la mezcla de bioma
  solo aplicaba al destino. Ahora aplica a **cabeza** (origen) y **cola** (destino), tanto en el
  piso como en los props (`biomeAt`).
- Bosque de cactus en el desierto: densidad por bioma (`DENSITY`), el desierto va pelón.
- Calle de Verdelume invisible sobre selva → piso `mud` (barro). Calle de Frostholm parecía
  asfalto → piso `packed` (nieve pisada).

## Qué se hizo (por archivo)

- `src/gfx/bake.js`: props nuevos `cliff`, `boulder`, `cactus`, `tree-bare`, `tree-pine-snow`,
  `lantern`, `stall-side`, `fence`, `roof-snow`, `roof-vines`, `bigleaf`, `reed`, `tuft`, `bones`.
  Puesto principal con toldo a rayas y mercancía sobre la mesa.
- `src/gfx/townground.js`: plaza más chica (132×92) con **bordillo** oscuro, adoquín más claro
  con sombra de canto, brillo central y borde mordido por el bioma. `paintTownDetail` por bioma:
  templado (matas, flores, manchas de pasto), montaña (lajas, grava, matas pálidas), selva
  (charcos con reflejo, hojarasca, raíces, helechos, hojas grandes), desierto (rizos de duna,
  grietas alrededor de la plaza, matas secas), nieve (montículos con sombra azul, placas de
  hielo, huellas junto a las calles). Costa: en Frostholm es **banco de hielo** con grietas y
  témpanos; en Ashfen arena con línea de marea. Agua con crestas que se mueven y espuma que respira.
- `src/scenes/town.js`: plaza con 2 puestos laterales, 4 faroles con brillo cálido, barril, caja,
  banderines; pozo con brillo de agua. `placeLandmarks`: Valkeep con cordón de riscos al norte,
  peñas a los costados y peñascos; Duneshade con palmeras, juncos y cactus; Verdelume con palmeras
  y hojas grandes, doble fila de árboles en las orillas; Frostholm con árboles secos y peñascos
  nevados; Ashfen con cerca y heno. Techos: `roof-snow` en Frostholm, `roof-vines` en Verdelume.
  Velo de luz por bioma, sombras de nubes que cruzan, viñeta suave.
- `src/gfx/route.js`: `paintRouteDetail` (mismo detalle de piso que los pueblos, por bioma y por
  tramo); riscos por las orillas lejanas en la ruta de montaña; paletas de props renovadas
  (peñascos, cactus, huesos, pinos nevados, árboles secos); tintes por bioma en `TINT_OF`.
- `src/gfx/atmosphere.js`: `addAmbientVeil`, `addCloudShadows`, `addWellShimmer`, `addVignette`;
  `addRoadAtmosphere` (obsoleto) eliminado.
- `src/world.js`: Verdelume `path: "mud"`, Frostholm `path: "packed"`.

## Decisiones

- Cada pueblo tiene un **landmark** propio además del bioma (riscos, palmeras, hielo, cerca).
- La plaza es un mercado: puestos, faroles, banderines, pozo. No un disco vacío.
- La mezcla de bioma en ruta va en ambos extremos, y los props siguen al piso.
- El HUD no tapa mundo: la cámara reserva 90 px arriba (`TOP_PAD`).
- Verificar siempre en WebGL **y** Canvas antes de dar algo por hecho.

## Pendiente

- Casas: siguen siendo tres siluetas con tinte + overlay; una variante de adobe para Duneshade
  y una de piedra para Valkeep serían el siguiente salto.
- Leo revisa en su pantalla al despertar.

## Cerrado al final de la noche

- La cinta del camino ya cambia a nieve pisada en el tramo nevado de la ruta 4 (cuatro bandas
  cada vez más cortas y opacas: la nieve gana poco a poco), en ambos sentidos.
