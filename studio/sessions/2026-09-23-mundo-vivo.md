# 2026-09-23 — mundo vivo

**Pedido de Leo:** fama global; la escarcha, ¿cómo se navega?; sucesos con un sistema chico; rumores
sí; deuda sí. "Haz lo que hemos hablado… no olvides las animaciones… mejora todo lo que puedas de
gráficos… impulsa todo el juego".

**Hecho**
- Animaciones: hoja de 8 cuadros por vista (respirar, paso con rebote y brazos, agachado, acción),
  yegua redibujada con 3 vistas, Sahra con arco y pose de disparo.
- `src/economy.js`: mercado de oferta y demanda con las 5 piedras en cada pueblo, días, tope de la
  Corona, carácter de cada piedra. Simulación en `studio/sim/mercado.mjs`.
- `src/director.js`: 9 sucesos y rumores. `src/missions.js`: 5 misiones de historia y pedidos.
- Deuda con el Gremio y cobrador. Fama sólo por misiones, con títulos.
- Refugios (`src/maps/refugios.js`, `src/art/refuge.js`): cueva del Paso Alto, tierra escondida,
  cueva del lago; estante, mesa, catre, corral, cerrojo.
- Tripulación que se lleva y se deja: refugio, posada (posadero en cada pueblo), establo.
- Pulido: mapas chicos centrados, grava de Valkeep cambiada por flores, cueva del lago con nieve.

**Pruebas** (Playwright con teclado real, 36 casos): herrero, tónico, arquera, lago, barca, 8 salidas,
curandera, contratar arquera; partida nueva → encargo → comprar → viajar (días) → vender → fama →
cobrador → escarcha que se derrite; forjar cueva, estante, mejoras, dejar a Sahra, yegua afuera,
redada espantada, comprar tierra, posada, yegua sin hielo. Todas pasan; sin errores en consola.
Revisado también en Canvas.

**Pendiente de Leo:** tono del lore; propuestas de `panorama.md` §3; jugar y decir si los números
se sienten bien.
