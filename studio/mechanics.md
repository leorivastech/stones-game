# Mecánicas — Stones

Estado: **muestra completa del mundo** — 5 pueblos, 4 rutas y la barca que cierra el círculo.
2026-09-23. El porqué de cada número está en `diseno-mundo.md`.

## Fantasía jugable

Stones toma de Pokémon la estructura física (pueblo seguro → ruta con identidad → pueblo seguro) y
de Zelda la acción: **los peligros se ven caminando por el mapa** y se resuelven en tiempo real,
sin pantalla de batalla ni turnos. El negocio de contrabando obliga a ir y volver entre pueblos.

## Controles

| Acción | Teclado | Control |
|---|---|---|
| Caminar | WASD / flechas | palanca / cruceta |
| Golpear con el bastón (también corta pasto y arbustos) | J / ESPACIO | A |
| Rodar (tocar) · correr (mantener) | K / SHIFT | B |
| Agacharse · esconderse en el pasto alto | L / C | X |
| Hablar · usar · comerciar · abrir alijo | E | Y |
| Beber tónico (2 corazones) | Q | LB |
| Pausa (mapa, carga, mercados, controles) | ESC / ENTER | Start |
| Bajar un escalón | caminar hacia abajo contra el borde | — |
| Depuración | F1 (luego 1-8; 7 = arquera + herrajes, 8 = tónicos) | — |

Cerca de algo con lo que se puede interactuar aparece abajo un indicador `[E] Hablar / Leer /
Abrir / Tirar / Beber / Comerciar`.

## Jugador

- **Vida en corazones** (empieza con 3). Cada golpe quita medio o un corazón.
- **Golpe**: barrido de bastón de ~¼ s, daña todo lo que toque delante; empuja al enemigo.
- **Rodar**: impulso corto con invulnerabilidad; mantener K después de rodar = correr.
- **Agacharse**: más lento; los guardias ven la mitad de lejos. **En pasto alto y agachado nadie te ve.**
- **Daño**: retroceso, destello blanco y un segundo de parpadeo invulnerable.
- **K.O.** (0 corazones): despiertas en el último pueblo, pierdes la mitad de la carga (menos lo
  que salven caballo y escolta) y el 20 % del oro.
- La vida se recupera al entrar a un pueblo y bebiendo del pozo; en el mundo caen corazones del
  pasto, arbustos y jabalíes. **Tónicos** (Verdelume): Q recupera 2 corazones donde sea.
- **Hielo**: sobre el lago helado no hay pasos; al moverte **patinas en línea recta hasta chocar**
  con un bloque o salir del hielo (sin golpe ni rodar mientras patinas).

## Enemigos (se ven en el mapa)

| Enemigo | Dónde | Comportamiento |
|---|---|---|
| **Jabalí** | pradera, desvío, montaña | Deambula. Si te ve: escarba (aviso) y **embiste en línea recta**. Si choca con roca o árbol queda aturdido: es el momento de pegarle. 2 golpes. |
| **Bandido** | campamento del bosque, emboscado en pasto alto | Te persigue, se agacha (aviso rojo) y se lanza. **Si te pega con piedras encima, se te cae una**; él corre a levantarla y huye esquivando árboles. Mátalo antes de que salga de pantalla y la suelta. 3 golpes, suelta monedas. |
| **Lobo** | Ruta 2 y bosque nevado de la Ruta 4 | Como el jabalí pero ve más lejos, avisa menos (0,38 s) y embiste más rápido. |
| **Escorpión** | desierto de las Rutas 3 y 4 | **Enterrado**: sólo se ve una joroba de arena. Sale si pasas a 2,5 cuadros, persigue lento y pica. Si te alejas se vuelve a enterrar. |
| **Guardia de la Corona** | retén y patrullas de la calzada | Patrulla con **cono de visión** dibujado en el suelo (crema tranquilo, amarillo sospecha, rojo alarma). Si te ve **con piedras a la vista**, se llena la sospecha (`?`) y luego alarma (`!`, cuerno): te persigue. Si te alcanza → **revisión**. Si le pegas se vuelve hostil y pelea en serio (1 corazón por golpe) y el calor sube mucho. |

### Revisión de la Corona

Diálogo con tres salidas:

1. **Dejar que revisen**: confiscan las piedras a la vista (el fondo falso esconde 2). El calor baja.
2. **Sobornar**: `4 + piedras a la vista + calor/25×2` oro. Pasas con todo por el resto del viaje.
3. En el retén: **dar media vuelta** (buscar otro camino). En patrulla: **empujar y correr**
   (el guardia queda aturdido un momento, sube el calor y te persigue).

Si vas **sin piedras**, el guardia del retén dice "Pasa." y levanta la barrera.

## Rutas: se van abriendo

**Ruta 1 · Calzada del Ámbar** (Ashfen ↔ Valkeep), 36×100 cuadros, de sur a norte:

1. **Pradera**: sendero en curva, pasto alto con jabalíes, **bordes** que sólo se bajan de un salto
   (atajos de regreso).
2. **Río** con un solo puente.
3. **Bifurcación**:
   - la **calzada adoquinada** pasa por el **retén** (barrera, dos guardias de poste, patrulla);
     cercada para que no se rodee por el pasto;
   - el **sendero del bosque**, tapado por arbustos que hay que **cortar**, rodea por el
     **campamento de bandidos** (tienda, fogata, cofre con 30 de oro). Un letrero rayado lo delata.
4. **Farallón**: la **reja** del camino está cerrada. La primera vez se rodea por el **desvío del
   este** (pasto alto, jabalí, cofre). Arriba hay una **palanca**: al tirarla la cámara muestra la
   reja abrirse y queda **abierta para siempre** (atajo guardado).
5. **Montaña**: paredes de peña con pinos, pasto alto con bandidos emboscados (uno sólo sale si
   llevas 2+ piedras), y un **nicho** cerrado por un arbusto con un cofre de **corazón extra**.

**Ruta 2 · Paso Alto** (Valkeep ↔ Verdelume), 36×80, sur→norte: montaña que se vuelve selva.
**Aduana** en el paso (barrera y dos guardias); por el oeste una **cornisa** con bordes que sólo
se bajan (vuelta sin guardias) y por el este una **vereda** tapada de arbustos y pasto. Lobos, río
con puente, alijos en roca (fila 48) y tronco (fila 20).

**Ruta 3 · Selva del Tránsito** (Verdelume ↔ Duneshade), 96×36, oeste→este: selva cerrada con río,
**campamento de bandidos** y emboscadas; luego desierto abierto donde la vista de los guardias llega
lejos, escorpiones enterrados y un oasis. Alijos en tronco y en el oasis.

**Ruta 4 · Paso del Hielo** (Duneshade ↔ Frostholm), 36×90, norte→sur: cañón del desierto,
tierras rotas, campo nevado con la **Puerta de la Escarcha** (retén) y bosque nevado con lobos.
Al oeste, el **lago helado** rodea el retén: acertijo de patinar (solución desde la entrada de
arriba: ↓ → ↓ ← ↓ → ↓, sale por abajo). Alijos en el cañón y en la nieve; cofre junto al lago.

Con más calor aparecen más patrullas (una extra desde calor 20 y otra desde 45) y los guardias ven
20 % más lejos desde calor 45.

## Pueblos

- **Ashfen**: mercado de ámbar (Brena), **herrero Oskar** (herrajes de alijo y fondo falso), pozo,
  Tomasa (tutorial), guardia; muelle: la barca y Ceno aparecen **después de conocerlo en
  Frostholm**. Paso de montaña del oeste cerrado (fuera de la muestra).
- **Valkeep**: mercado de vidrio rúnico (Maese Ivo), pozo, **establo de Nella** (caballo); salida
  norte a la Ruta 2.
- **Verdelume**: selva con canal y dos puentes; mercado de perlas (Oruba), **curandera Ama**
  (tónicos). Salidas: sur (Ruta 2) y este (Ruta 3).
- **Duneshade**: desierto con oasis; mercado de piedra solar (Kader), **arquera Sahra** con sus
  dianas. Salidas: oeste (Ruta 3) y sur (Ruta 4).
- **Frostholm**: nieve, estanque helado y muelle; mercado de escarcha (Hilde), **barquero Ceno**.
  Salida norte (Ruta 4) y la barca a Ashfen.

Las salidas funcionan en los cuatro bordes del mapa: basta caminar hacia el borde.

Entrar a un pueblo **guarda la partida** y cura. Llegar a un pueblo distinto del anterior **cierra
un viaje**: los mercados se recuperan y el calor se enfría (la barca también cuenta).

## Mercado

Ventana propia: comprar la piedra del pueblo, vender la que el pueblo pide, salir. Muestra precio,
existencias, pedido, qué llevas y **dónde se paga** lo que compras. Cada operación suena, la gema
vuela al HUD y el oro cambia. Reglas nuevas (ajustadas con simulación, `diseno-mundo.md` §3):
existencias hasta 8 y pedido hasta 6; cada compra sube el precio 1 y cada venta baja el pago 2;
comprar suma 1 de calor y vender 5; cada viaje recupera 2 de existencias y pedido.

## Cadena de mercancías

| Ciudad | Produce | Precio base | Necesita | Pago base |
|---|---|---:|---|---:|
| Ashfen | Ámbar de sello | 8 | Cristal de escarcha | 40 |
| Valkeep | Vidrio rúnico | 12 | Ámbar de sello | 17 |
| Verdelume | Perla de lluvia | 15 | Vidrio rúnico | 26 |
| Duneshade | Piedra solar | 18 | Perla de lluvia | 32 |
| Frostholm | Cristal de escarcha | 22 | Piedra solar | 39 |

## Mejoras (preparación)

| Mejora | Dónde | Fama | Costo | Efecto |
|---|---|---:|---:|---|
| Herrajes de alijo | Ashfen (Oskar) | 3 | 40 | abre los alijos de los caminos |
| Caballo de carga | Valkeep (Nella) | 4 | 90 | +2 carga, 10 % más rápido en rutas, te sigue en el mapa, salva piedras de los bandidos |
| Arquera escolta | Duneshade (Sahra) | 8 | 150 | te sigue en las rutas y dispara (1 daño, cada 1,3 s, 7,5 cuadros) a bandidos y bestias a la vista; a guardias sólo si ya son hostiles; salva piedras |
| Fondo falso | Ashfen (Oskar) | 14 | 240 | 2 casillas ocultas a los guardias (se ven rayadas en el HUD) |

Servicios que no son mejora: **tónicos** en Verdelume (12 oro, máximo 3) y **barca**
Frostholm ↔ Ashfen (15 oro, cuenta como viaje: mueve los mercados y enfría el calor).

## Alijos

- Huecos marcados en las rutas (tronco, roca, grieta en la nieve), dos por ruta en las Rutas 2-4.
- Sin herrajes: "aquí cabría un alijo". Con herrajes, la primera vez se clava la tapa (el sprite
  cambia) y se abre la ventana: ↑↓ elige piedra, **→ guarda, ← saca**, hasta 6 por alijo.
- Lo guardado no se pierde en K.O., robos ni revisiones y no ocupa carga.
- **Redada**: al entrar a una ruta con calor ≥ 60, cada alijo con piedras tiene 50 % de ser
  vaciado (se avisa con un letrero rojo; como mucho uno por entrada). La ventana del alijo avisa
  cuando la ruta está caliente.
- La pestaña Carga de la pausa lista los alijos con lo que guardan.

## Interfaz

- **HUD**: corazones · oro · casillas de carga con la gema de cada piedra (las del fondo falso,
  rayadas) · tónicos (sólo si llevas) · ojo de alerta con 5 marcas (calor del lugar) · fama.
- **Cartel** con nombre y región al entrar a cada lugar.
- **Diálogos** en pergamino con nombre, texto que se escribe y ▼ para seguir.
- **Elecciones** con cursor, opciones grises si no alcanza y una nota bajo la elegida.
- **Pausa** con pestañas: mapa del mundo (pueblos visitados, dónde estás, ruta de la barca si ya
  la conoces), carga, tónicos, alijos y mejoras, mercados conocidos (precios, pedido, calor) y
  controles.
- **Alijo**: ventana con carga y alijo lado a lado por piedra.
- **Título** con Ashfen de fondo, "Continuar" si hay partida guardada.

## Pendiente

- Atajo de montaña Ashfen ↔ Verdelume.
- Encargos con nombre y motivo personal del caminante (ver `story.md`).
- Música propia de Verdelume, Duneshade y Frostholm (hoy reusan los tres loops).
