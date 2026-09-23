# Mecánicas — Stones

Estado: **primera prueba de red comercial caminable**. 2026-09-18.

## Fantasía jugable

Stones toma de Pokémon la estructura física: pueblo seguro → ruta → pueblo seguro. No toma
su progresión lineal. El negocio obliga a volver porque los pedidos, precios y riesgos cambian.
No hay selector de destinos ni viaje rápido.

Recorrido en código hoy (línea):

`Ashfen → Valkeep → Verdelume → Duneshade → Frostholm`

Propuesta de mapa (no implementada): herradura de tierra y mar al sur.

`Ashfen (campos, costa O) → Valkeep (montaña) → Verdelume (selva) → Duneshade (desierto) → Frostholm (hielo, costa E)`

El golfo parte 1 de 5. Los caminos se recorren en curva (suben, bajan, rodean). El tramo 2→3 está libre. Atajos posteriores: barco 1↔5 y montañas 1↔3.

## Controles

| Tecla | Acción |
|---|---|
| WASD / flechas | Caminar por pueblos y caminos. |
| E | En pueblo: comprar o contratar. En un encuentro: revisar / entregar. |
| Q | En pueblo: vender. En un encuentro: sobornar o pagar el paso. |
| X | En un encuentro: huir a la ciudad de origen. |
| Clic arriba | Forzar el próximo evento del camino; herramienta de pruebas. |

Al acercarse al puesto aparecen dos botones animados en la parte baja: `E` muestra qué se
compra y su costo; `Q` muestra qué se vende y cuánto paga. Si una acción no está disponible,
el mismo botón explica si falta oro, espacio, mercancía, stock o pedido. Al completar una
operación, la piedra viaja visualmente entre el puesto y el personaje y aparece el cambio de
carga/oro; una tecla inválida tiembla.

En el camino, al alejarte un poco del inicio puedes **volver** a la ciudad de origen
(poste `← ASHFEN`, etc.). Llegar al final sigue yendo al destino y ahí sí corre el mercado.
El HUD muestra el riesgo de retén y confiscación antes de llegar al poste.

## Cadena de mercancías

| Ciudad | Bioma | Produce | Precio base | Necesita | Pago base |
|---|---|---|---:|---|---:|
| Ashfen | Templado | Ámbar de sello | 8 | Cristal de escarcha | 40 |
| Valkeep | Montaña | Vidrio rúnico | 12 | Ámbar de sello | 17 |
| Verdelume | Tropical | Perla de lluvia | 15 | Vidrio rúnico | 26 |
| Duneshade | Desierto | Piedra solar | 18 | Perla de lluvia | 32 |
| Frostholm | Nieve | Cristal de escarcha | 22 | Piedra solar | 39 |

Oro inicial: 40. Capacidad inicial: 4. Se usa una sola moneda común en esta prueba.

## Sistema medible de mercado

Cada ciudad guarda cuatro números reales en el estado:

- **Stock** de su producto: empieza en 5. Cada compra quita 1.
- **Pedido** de la piedra que necesita: empieza en 4. Cada venta quita 1.
- **Precio:** comprar unidades seguidas encarece el stock; vender unidades seguidas reduce el pago.
- **Calor local:** comprar suma 2; vender suma 6. Afecta precios y riesgo de la ruta.

Al completar un camino:

- Las ciudades que no fueron el origen recuperan 1 stock.
- Las ciudades que no fueron el destino recuperan 1 pedido.
- Origen y destino pierden 1 calor; las demás pierden 8.

Por eso repetir un solo trayecto satura al comprador y mantiene caliente la zona. Seguir
viajando deja que otros mercados se recuperen. El HUD enseña **oro**, **piedras N de M**,
**alerta** (5 estrellas = calor) y **fama** en chips sueltos, sin tapar el pueblo.

## Riesgo

Las probabilidades usan carga visible y el calor promedio de origen/destino:

- En la calzada, más carga y calor aumentan retén y confiscación.
- En el monte, más carga y calor aumentan asalto.
- Viajar vacío sigue pudiendo provocar una revisión o un asalto menor, pero no pierde carga.

Los tres encuentros cortan el camino (flash, velo, NPCs) y esperan una respuesta.
No hay HP ni turnos. Camino quieto sigue siendo una pasada automática.

- **Retén** — `E` pierde 1 visible o pasa con fondo falso. `Q` paga 8+calor y enfría.
  `X` vuelve al origen y sube calor.
- **Asalto** — `E` entrega la mitad de la carga, menos caballo/escolta. `Q` paga el
  paso (6 + lo amenazado × 2) y conservás todo. `X` huye con menos calor que el retén.
- **Confiscación** — el carro llega primero y después pregunta. `E` entrega lo visible
  (el fondo falso oculta 2). `Q` es un soborno más caro (12+calor) y enfría más.
  `X` huye y calienta más: te viste de la requisa.

## “Combate” por preparación

El protagonista no pelea. Cambia sus probabilidades y pérdidas antes del viaje:

| Mejora | Lugar | Requisito | Costo | Efecto actual |
|---|---|---:|---:|---|
| Caballo de carga | Valkeep | Reputación 4 | 90 | +2 capacidad, más velocidad, salva 1 unidad en asaltos y acompaña visiblemente al caminante en las rutas. |
| Arquera escolta | Duneshade | Reputación 8 | 150 | Salva otra unidad en asaltos. |
| Fondo falso | Herrero de Ashfen | Reputación 14 | 240 | Oculta 2 unidades ante retenes y confiscación. |

El herrero no revela la mejora ni el precio al principio: dice `sin encargos`. Esto mantiene
el fondo falso como progreso tardío. Las mejoras se compran hablando físicamente con su NPC;
no desde un menú de mapa.

El caballo comprado no aparece dentro de las ciudades. Al entrar a cualquier camino aparece
al lado del caminante, lo sigue y camina con él; así la mejora también se siente en el mundo,
no sólo como números de capacidad y velocidad.

## Qué ya prueba este corte

- Atravesar pueblos y rutas, no teletransportarse.
- Cinco biomas y cinco mercancías enlazadas.
- Elegir cuánto comprar con inventario mixto.
- Ver demanda agotarse, precios cambiar y calor subir/bajar.
- Ver el riesgo de retén y confiscación en el HUD del camino.
- Sentir cómo caballo, escolta y escondite cambian una pérdida.
- En retén, asalto y confiscación, elegir entregar / pagar / huir.

## Todavía pendiente

- Encargo tutorial y compradores con nombre.
- Rumor previo que explique por qué cambió el peligro.
- Motivo personal del caminante y razón definitiva de la prohibición.
- Convertir la línea norte-sur en herradura + golfo (`studio/maps/stones-mapa-atajo-13.png`).
- Atajos posteriores: barco 1↔5 y montañas 1↔3 (cómo se cruzan, después).
- Música propia para Verdelume, Duneshade y Frostholm; por ahora reutilizan los tres loops proto.
