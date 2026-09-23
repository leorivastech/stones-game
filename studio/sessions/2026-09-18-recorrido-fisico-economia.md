# Sesión — recorrido físico, economía y preparación

Leo corrigió una interpretación importante: Stones puede tener un mapa como referencia en el
futuro, pero **no puede usarlo para seleccionar destinos**. La inspiración Pokémon significa
caminar por rutas y atravesar físicamente cada pueblo para llegar al siguiente. Los atajos
deben existir dentro del mundo — túnel, montaña, barco — y desbloquearse jugando.

## Implementado en la prueba

- Cadena caminable: Ashfen → Valkeep → Verdelume → Duneshade → Frostholm, reversible.
- Dos puertas físicas por pueblo; los extremos muestran rutas cerradas para un futuro atajo.
- Cinco mercancías enlazadas: ámbar, vidrio rúnico, perla de lluvia, piedra solar y escarcha.
- Stock, pedido, precios variables, calor local, reputación y recuperación al viajar.
- HUD con carga mixta, calor y probabilidades del camino.
- Caballo en Valkeep, arquera escolta en Duneshade y fondo falso tardío en Ashfen.
- Selva, desierto y nieve generados por código, además de los ambientes existentes.

## Límite consciente

Los encuentros todavía resuelven automáticamente el resultado. Las mejoras ya modifican el
resultado, pero falta convertir retenes y asaltos en decisiones cortas y anunciadas. También
faltan compradores con nombre y la razón personal del caminante.
