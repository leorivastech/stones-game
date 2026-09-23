# 2026-09-19 · Primera versión del retén con elección

Leo pidió probar el retén como el arranque de un combate de Pokémon: corta el
camino de golpe y pide una respuesta corta. No es pelea por turnos ni HP.

## Qué se hizo

- El retén ya no se resuelve solo. Flash, velo y guardias cortan el sendero;
  luego sale el panel `¡RETÉN!` con tres acciones.
- `E` dejar revisar: si hay carga visible, pierde 1; si va vacío o con fondo
  falso, pasa.
- `Q` sobornar: paga el costo de siempre (8 + calor). Si no alcanza el oro,
  avisa y vuelve a ofrecer. El soborno baja 3 de calor en origen y destino.
- `X` huir: suma calor y vuelve a la ciudad de origen (sin avanzar el mercado).
- Asalto, confiscación y camino quieto siguen automáticos en este corte.

## Cómo probar

1. Recargar http://127.0.0.1:5181/
2. En el HUD del camino, clic en `RETÉN`
3. Caminar hasta el poste
4. E / Q / X, o clic en la opción
