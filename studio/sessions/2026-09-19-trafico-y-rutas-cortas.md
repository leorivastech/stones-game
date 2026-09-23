# 2026-09-19 · Tráfico fantasma y caminos más cortos

## Qué pidió Leo

- En cada camino aparece un caballo y una carreta “siguiéndote”. ¿Es un error o parte del juego?
- Los caminos todavía se sienten largos: se pierde mucho tiempo ahí.

## Qué era el caballo y la carreta

No era el caballo del jugador. `placeTraffic()` ponía un caballo y una carreta
decorativos que recorren el mismo spline, arrancando en el spawn del caminante,
ida y vuelta en loop. Por eso parecía que te seguían.

El caballo **propio** (compra en Valkeep) es otro: camina al lado del monito y
solo existe si ya lo contrataste.

## Qué se hizo

- Se eliminó el tráfico decorativo. El sendero queda para el caminante y, si
  aplica, su caballo comprado.
- Mundo de ruta 1040×700 → **780×520**. Recodo más chico, velocidad 250, llegada
  a 48 px. Caminar ~3 s + el evento.

## Decisión

- Tráfico de extraños en el camino, si vuelve, no arranca pegado al jugador ni
  recorre el mismo spline en loop. O está parado al lado, o viene de frente una vez.
