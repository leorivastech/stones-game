# Mecánicas — Stones

Estado: **muestra jugable del rehecho** (Ashfen · Ruta 1 · Valkeep). 2026-09-23.

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
| Hablar · usar · comerciar | E | Y |
| Pausa (mapa, carga, mercados, controles) | ESC / ENTER | Start |
| Bajar un escalón | caminar hacia abajo contra el borde | — |
| Depuración | F1 (luego 1-6) | — |

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
  pasto, arbustos y jabalíes.

## Enemigos (se ven en el mapa)

| Enemigo | Dónde | Comportamiento |
|---|---|---|
| **Jabalí** | pradera, desvío, montaña | Deambula. Si te ve: escarba (aviso) y **embiste en línea recta**. Si choca con roca o árbol queda aturdido: es el momento de pegarle. 2 golpes. |
| **Bandido** | campamento del bosque, emboscado en pasto alto | Te persigue, se agacha (aviso rojo) y se lanza. **Si te pega con piedras encima, se te cae una**; él corre a levantarla y huye esquivando árboles. Mátalo antes de que salga de pantalla y la suelta. 3 golpes, suelta monedas. |
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

Con más calor aparecen más patrullas (una extra desde calor 20 y otra desde 45) y los guardias ven
20 % más lejos desde calor 45.

## Pueblos

- **Ashfen**: plaza con mercado de ámbar (Brena), herrero Oskar (fondo falso con fama 14), pozo,
  Tomasa (tutorial de controles), aldeanos, guardia; cultivos, playa y muelle sin barco; paso de
  montaña del oeste cerrado por derrumbe.
- **Valkeep**: plaza con mercado de vidrio rúnico (Maese Ivo), pozo, establo de Nella (caballo con
  fama 4), aldeanos con pistas; paso norte a Verdelume cerrado por derrumbe.

Entrar a un pueblo **guarda la partida** y cura. Llegar a un pueblo distinto del anterior **cierra
un viaje**: los mercados se recuperan y el calor se enfría (reglas de `state.js`, sin cambios).

## Mercado

Ventana propia: comprar la piedra del pueblo, vender la que el pueblo pide, salir. Muestra precio,
existencias, pedido, qué llevas y **dónde se paga** lo que compras. Cada operación suena, la gema
vuela al HUD y el oro cambia. Precios, stock, pedido, calor y fama: mismas reglas de antes.

## Cadena de mercancías (sin cambios)

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
| Caballo de carga | Valkeep (Nella) | 4 | 90 | +2 carga, 10 % más rápido en rutas, te sigue en el mapa, 35 % de salvar una piedra de un golpe de bandido |
| Arquera escolta | Duneshade | 8 | 150 | (pueblo aún no construido) |
| Fondo falso | Ashfen (Oskar) | 14 | 240 | 2 casillas ocultas a los guardias (se ven rayadas en el HUD) |

## Interfaz

- **HUD**: corazones · oro · casillas de carga con la gema de cada piedra (las del fondo falso,
  rayadas) · ojo de alerta con 5 marcas (calor del lugar) · fama.
- **Cartel** con nombre y región al entrar a cada lugar.
- **Diálogos** en pergamino con nombre, texto que se escribe y ▼ para seguir.
- **Elecciones** con cursor, opciones grises si no alcanza y una nota bajo la elegida.
- **Pausa** con pestañas: mapa del mundo (pueblos visitados, dónde estás), carga y mejoras,
  mercados conocidos (precios, pedido, calor) y controles.
- **Título** con Ashfen de fondo, "Continuar" si hay partida guardada.

## Pendiente

- Verdelume, Duneshade y Frostholm con sus rutas (el derrumbe de Valkeep las promete).
- Escolta (Duneshade) y atajo por barco / montañas.
- Encargos con nombre y motivo personal del caminante (ver `story.md`).
- Música propia por lugar y efectos finales.
