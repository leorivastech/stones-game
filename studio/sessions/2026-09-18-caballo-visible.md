# Caballo visible en las rutas

Fecha: 2026-09-18

## Decisión de Leo

Comprar el caballo debe producir un cambio visible. En las ciudades puede quedar fuera de
escena, pero en cada camino tiene que aparecer caminando junto al protagonista.

## Implementado

- El caballo se crea únicamente en `RoadScene` cuando la mejora ya fue comprada.
- Sigue al caminante sin añadir colisiones ni bloquear el paso.
- Tiene un movimiento de marcha y levanta polvo mientras avanzan.
- Conserva sus efectos existentes: capacidad, velocidad y protección ante asaltos.
