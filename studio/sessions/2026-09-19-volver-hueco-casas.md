# 2026-09-19 · Volver atrás, hueco de ruta y choque de casas

## Qué pidió Leo

- Al entrar al camino no se puede volver a la ciudad anterior.
- Con el camino más chico queda un espacio vacío a la derecha que no concuerda con el mapa.
- Las casas chocan mal: en unas te paras lejos, en otras te metes demasiado.

## Qué se vio en captura

El mundo de ruta era 780 px de ancho y la cámara a 0.85 enseña ~941 px. A la
derecha se veía el color de fondo, no pasto. El recodo corto no era el
problema: el campo era más estrecho que la pantalla.

Las casas usaban el sprite entero (156×148, tejado + sombra) como cuerpo
estático. El choque no coincidía con el muro.

## Qué se hizo

- Volver: si te alejás ~80 px del inicio y regresás, entras de nuevo a la
  ciudad de origen. Un poste `← ASHFEN` lo marca. No corre el mercado.
- Campo 960×580 para llenar la vista. El recodo sigue de ~3 s, más al centro.
- Cuerpo de casa = ~56% del ancho × 22% del alto, pegado al muro/puerta.
