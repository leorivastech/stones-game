# Sesión — mapa: golfo, biomas y atajo 1-3

Leo: el camino 1 a 5 está bien. El 2→3 debe estar **libre**. Las montañas no
bloquean ese tramo: son un **atajo posterior de 1 a 3**, para no pasar por
Valkeep. Valkeep (2) es el pueblo montañoso. Verdelume (3) es la selva.

## Qué es cada ciudad

1. Ashfen — campos normales, costa oeste. Ámbar. Herrero.
2. Valkeep — pueblo de montaña. Vidrio rúnico. Caballo.
3. Verdelume — selva. Perla de lluvia.
4. Duneshade — desierto. Piedra solar. Escolta.
5. Frostholm — hielo, costa este. Cristal de escarcha.

## Geografía

- Camino libre: 1 → 2 → 3 → 4 → 5.
- Mar abajo parte 1 y 5. Barco 1-5 después.
- Atajo de montañas 1→3 después (se salta el 2). Cómo se cruza, pendiente.

## En código (caminos curveados)

Las rutas ya no son un pasillo vertical. `src/routes.js` guarda un spline por tramo:
el camino sube, baja y rodea. Ashfen sale al **norte** hacia Valkeep; el golfo se ve
al sur. Verdelume se cruza de oeste a este. El atajo de montañas 1-3 sigue cerrado.
