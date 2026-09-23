# 2026-09-23 — mundo completo

**Pedido de Leo:** hacer todas las ciudades que faltan y meter cosas con valor: el herrero que te
haga un sistema de guardado, escondites en los caminos como las bases secretas de Pokémon, aclarar
caballo y arquero, y dejar todo analizado (economía y piedras) para que la muestra tenga todas las
mecánicas.

**Hecho**
- Diseño y simulación económica en `diseno-mundo.md`.
- Mapas: Ruta 2, Verdelume, Ruta 3, Duneshade, Ruta 4, Frostholm; Valkeep sin derrumbe; muelle de
  Ashfen con barca condicionada.
- Arte: biomas de selva, desierto y nieve; lobo, escorpión, arquera, barquero, curandera, gente del
  desierto y de la nieve; flecha y tónico.
- Mecánicas: herrajes de alijo + ventana del alijo + redadas, curandera y tónicos (Q), arquera
  escolta, barca, patinar en hielo, salidas en los 4 bordes, lobos y escorpiones.
- Pruebas automáticas con teclado real (Playwright): herrero, alijo, redada, tónico, arquera,
  solución del lago, barca, 8 salidas, curandera, contratar arquera, pausa. Todas pasan.

**Retoques tras mirar las capturas**
- Frontera de biomas en tablero de cuadros → línea ondulada.
- Arena y nieve con manchas muy marcadas → manchas más grandes y suaves.
- Grava gris plano (Valkeep) → tierra con guijarros.
- Notas de los menús salían del panel → el panel mide también la nota.

**Pendiente**
- Que Leo juegue la vuelta completa y diga si el ritmo de las rutas y los precios se sienten bien.
