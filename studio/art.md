# Arte — pixel art

Estado: **rehecho completo en pixel art**. 2026-09-23.

Este proyecto es **Phaser 4, 2D**. No Three.js. Todo el arte es pixel art dibujado en código
(`src/art/`), sin PNG externos. El arte vectorial anterior (formas suaves con antialias) se retiró;
queda en la historia de git (`be15c32`).

## Resolución

- El juego vive en **480×270** píxeles, con cuadros (tiles) de **16 px**.
- Se escala en **múltiplos enteros** (×2, ×3, ×4): en 1920×1080 cada píxel del juego mide 4×4.
  Si el múltiplo entero deja mucho borde en pantallas chicas (<×3), estira un poco.
- `pixelArt: true` + `roundPixels`: sin suavizado, sin medios píxeles.

## Pipeline

1. **Pixel art en código** (`src/art/`): cada textura se pinta en un búfer de píxeles (`Buf`) y
   se sube a Phaser al arrancar (`scenes/boot.js`). Rápido de iterar y sin archivos.
2. **Laboratorio** (`lab.html?z=4&only=cast-&bg=%23417d3b`): muestra cada textura ampliada.
   Todo arte nuevo se revisa ahí antes de entrar al juego.
3. **Final** (`public/assets/final/`): si algún día Leo trae PNG cerrados, se cargan en `boot.js`
   con la misma clave y reemplazan al dibujo en código sin tocar mecánicas.

## Reglas de dibujo

- **Una sola paleta** (`src/art/palette.js`): rampas de oscuro a claro por material (pasto, follaje,
  tierra, piedra, agua, madera, teja, paja, piel, azul Corona, violeta rúnico, oro, rojo, tela,
  olivo bandido, nieve). Si un color no está en la paleta, no se usa.
- **Luz arriba-izquierda** siempre. Volúmenes redondos (copas, rocas) se sombrean como esferas y se
  cuantizan a la rampa; por eso todos los árboles y piedras se ven del mismo mundo.
- **Contorno oscuro** en personajes y objetos (`ink` o el tono más oscuro del material).
  El suelo no lleva contorno.
- **Texturas con manchas, no ruido**: pasto, tierra y arena usan manchas grandes con borde tramado
  (Bayer) y matas/piedritas estampadas. Nunca sal y pimienta píxel por píxel.
- **Sin medios píxeles**: textos centrados con `centerX()` y paneles de ancho par.
- **Sin máscaras de geometría ni `nineslice`** (no se ven en Canvas). Los marcos son imágenes
  a medida (`ninePatch`) cacheadas por tamaño.
- Verificar en **WebGL y en Canvas** (`?renderer=canvas`). Deben verse iguales.

## Qué hay (`src/art/`)

| Archivo | Qué dibuja |
|---|---|
| `pixel.js` | Búfer de píxeles, ruido determinista, tramas Bayer, contornos, rotación exacta de 90°, `ninePatch` |
| `palette.js` | La paleta maestra |
| `font.js` | Fuente propia de ancho variable (7 px de alto, acentos y ñ). Variantes: crema con sombra, oscura, con contorno, oro, rojo, verde, azul, tenue |
| `actors.js` | Personajes 16×24 armados por partes (cabeza + cuerpo + piernas) y paletas: caminante, guardia, bandido, aldeanos, mercader, herrero, caballeriza. 14 cuadros por vista (`POSE`): quieto, respirar, 6 de paso, agachado, acción (arco), preparar y golpe con el arma de su paleta (bastón, espada, cuchillo, martillo), y 2 de cargado (contorno dorado, uno corrido 1 px). Silueta blanca para el daño, rodada y K.O. dibujado tumbado (24×22) |
| `creatures.js` | Jabalí (caminar, embestida, aturdido), lobo, escorpión (con cuadro enterrado), los tres con vistas de frente y de espalda (cuadros 4-7), la **carreta enganchada a la yegua** (`cart-side` 56×30, `cart-down`/`cart-up` 32×46, 4 cuadros con ruedas que giran) y **yegua de carga** 32×28 con 12 cuadros: de lado (cuello arqueado con crin, cabeza larga, manta y alforjas), de frente (con lucero) y de espalda (grupa y cola), 4 de trote cada una |
| `refuge.js` | Refugios: entrada de cueva (boca oscura o con puerta, farol; versión con nieve), estante (vacío o con piedras), catre, mesa de trabajo |
| `biomes.js` | Flora y rocas de selva, desierto y nieve (palmeras, árboles de selva, helechos, cactus, matorral, rocas de arena y de nieve, árbol pelado, bloque de hielo), huecos de alijo (tronco, roca, grieta; cerrado y con tapa), barca, diana |
| `terrain.js` | El suelo de cada mapa pintado píxel a píxel: bordes orgánicos entre pasto/tierra/arena/agua, sombras del terreno alto, orilla con espuma y profundidad, adoquín con bordillo, surcos de cultivo, tablones de puente, farallón de peñas, flores |
| `props.js` | Árboles (3 variantes + otoño), pinos (y nevados), arbustos, pasto alto (3 variantes, 2 cuadros de vaivén), rocas, peñascos, tocón, tronco, cercas, letrero, barril, caja, heno, farol, pozo, puestos de mercado a rayas, cofre, reja con postes de piedra, palanca, barrera del retén, tienda de campaña, fogata, derrumbe, yunque, fragua, estandarte de la Corona, barandas, borde de salto, humo. Casas en vista 3/4 con techo de paja/teja/pizarra/musgo, muros de revoque/madera/piedra, puerta, ventanas iluminadas con jardinera y chimenea |
| `fx.js` | Barrido del bastón (3 cuadros, rotado a las 4 direcciones), barrido cargado amplio (48×48, 4 cuadros), zarpazo rojo de enemigos, polvo, chispas, burbujas `!` `?` `…`, gemas de las 5 piedras, moneda que gira, corazones, pedacitos de pasto y hojas, brillo del agua |
| `ui.js` | Marco oscuro con filo dorado, pergamino, placa, casillas de carga (y de fondo falso), ojo de alerta en 4 niveles, marcas, estrella, tecla, mapa del mundo en pergamino, logo STONES de piedra |

## Paleta por lugar

- **Ashfen** (templado): pasto `g`, casas de paja y teja roja, plaza de adoquín, cultivos, playa y golfo.
- **Ruta 1**: pradera → río → bosque denso (follaje `f`) → farallón de peñas → subida de montaña con pinos.
- **Valkeep** (montaña): pasto frío (rampa `f`), casas de piedra con pizarra, pinos, farallón, establo de techo de musgo.
- **Verdelume** (selva): verde hondo saturado, casas de palma, canal con puentes, palmeras.
- **Duneshade** (desierto): arena `d`, casas de adobe con teja de barro, cactus, oasis, dianas.
- **Frostholm** (nieve): nieve `n`, techos nevados, pinos nevados, estanque helado, muelle con barca.
- **Rutas mixtas**: la paleta del suelo se elige por celda (`biomeAt`). La frontera entre biomas es
  una línea ondulada continua: el ruido por celda deja un tablero de cuadros.
- **Grava**: tierra con guijarros, no gris plano (el gris plano se leía como mancha).

## Música y SFX

- Música por lugar (CC0 y CC-BY, normalizada a -18 LUFS): `public/assets/music/` + las tres de antes en
  `public/assets/proto/music/`. Qué suena dónde: `studio/musica/README.md`. Se elige en `escuchar.html`.
- Ambientes (selva, viento, cueva, olas, fogata): `public/assets/ambience/`.
- Efectos Kenney + OpenGameArt (CC0): `public/assets/sfx/`; créditos en `public/assets/CREDITS.md`.
- Muestras CC0 de encuentros: `public/assets/proto/sfx/`. Créditos en `CREDITS.md`.
- **Nuevo**: tonitos sintetizados de 8 bits en `src/sfx.js` (`tone()`): golpe, impacto, daño, rodada,
  corte, recoger, corazón, menú, alerta, sospecha, salto, texto, cofre. No pesan nada.

## Animación de personajes (2026-09-23)

- Hoja de **8 cuadros por vista** (abajo, arriba, lado): quieto, respirar (cabeza baja 1 px),
  4 de paso (pie apoyado = cuerpo 1 px abajo; brazos que se mueven al revés que las piernas),
  agachado y acción. Índices en `POSE` (`src/art/actors.js`); nada de números sueltos.
- Respirar: 700 ms quieto + 380 ms con la cabeza abajo. Paso a 9 cuadros/s, correr a 14.
- **Sahra**: carcaj con plumas rojas y arco a la espalda; al disparar, arco tensado (de lado con
  flecha horizontal; de frente, arco vertical en la mano; de espalda, sobre la cabeza). Madera
  `o2`/`o4` para que no se pierda contra el contorno.
- **Yegua**: voltea según hacia dónde camina (mira unos pasos adelante para no parpadear en diagonal).
- Lección: un cuello hecho de bolitas en diagonal y una silla que sobresale del lomo = camello.
  Cuello corto y arqueado, cabeza que baja hacia el hocico, manta pegada al lomo.

## Más cuadros, golpes y gente viva (2026-09-26)

- **Paso en 6 cuadros** (`WALK` en `actors.js`): de lado apoyo, carga, pasa (pie atrás levantado) ×2; de
  frente/espalda pie alto, bajando, apoyo ×2. Brazos en contrafase. Caminar a 13 cuadros/s, correr a 20.
- **Golpe** (`SWING`): preparar (arma atrás/arriba, cuerpo 1 px hacia atrás) 50 ms y golpe (brazo
  extendido, cuerpo 1 px adelante) al ritmo del barrido de `fx.js`. Bandidos y guardias usan las mismas poses
  al avisar y al lanzarse; el herrero martilla con ellas (`<cast>-work-side`), el comerciante acomoda (`-reach-`).
- **Ataque cargado**: mantener J → pose de preparar; a los 400 ms brilla (contorno `y4`) y tiembla 1 px.
- **K.O.**: boca arriba con la cabeza a la izquierda, brazos abiertos, piernas separadas, arma caída.
- **Animales**: eligen vista (lado/frente/espalda) según su velocidad (`Enemy.viewKey`), con margen para no
  parpadear en diagonal.
