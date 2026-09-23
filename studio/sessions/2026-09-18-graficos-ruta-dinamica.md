# 2026-09-18 — Gráficos, balance y ruta dinámica

Leo pidió mejorar mucho los gráficos sin cambiar la forma que ya le gusta, y analizar la
información guardada para encontrar mecánicas dinámicas que de verdad funcionen.

## Diagnóstico

- La plaza, el caminante, el toldo y el herrero ya daban identidad.
- El tramado de 2×2 del piso se veía como una rejilla y oscurecía la escena.
- El HUD competía con los letreros del mundo.
- El viaje con cuatro piedras tenía valor esperado negativo: demasiado asalto y confiscación.
- En el camino, moverse era tiempo muerto porque el encuentro no dependía del jugador.

## Qué cambió

- Segunda pasada de suelos, adoquín, casas, árboles y props generados en código.
- Polvo, hojas, humo, luz cálida y profundidad por Y.
- HUD jerárquico y canvas 16:9 adaptable.
- El jugador elige con su posición: calzada o monte.
- Probabilidades recalibradas para que el loop normal pague y el clavo siga siendo una meta.

## Dirección

Stones debe tratar de preparar una carga, leer peligro y elegir riesgo; no de caminar mucho
ni de recibir castigos aleatorios. El siguiente prototipo es una pista imperfecta de ruta
antes de salir, medido durante 10 viajes.
