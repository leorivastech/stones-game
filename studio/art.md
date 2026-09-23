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
| `actors.js` | Personajes 16×24 armados por partes (cabeza + cuerpo + piernas) y paletas: caminante, guardia, bandido, aldeanos, mercader, herrero, caballeriza. Caminar en 4 cuadros, agachado, silueta blanca para el daño, rodada (una bola rotada ×4) y K.O. |
| `creatures.js` | Jabalí (caminar, embestida, aturdido), lobo, escorpión (con cuadro enterrado) y caballo de carga con silla (trote de 4 cuadros) |
| `biomes.js` | Flora y rocas de selva, desierto y nieve (palmeras, árboles de selva, helechos, cactus, matorral, rocas de arena y de nieve, árbol pelado, bloque de hielo), huecos de alijo (tronco, roca, grieta; cerrado y con tapa), barca, diana |
| `terrain.js` | El suelo de cada mapa pintado píxel a píxel: bordes orgánicos entre pasto/tierra/arena/agua, sombras del terreno alto, orilla con espuma y profundidad, adoquín con bordillo, surcos de cultivo, tablones de puente, farallón de peñas, flores |
| `props.js` | Árboles (3 variantes + otoño), pinos (y nevados), arbustos, pasto alto (3 variantes, 2 cuadros de vaivén), rocas, peñascos, tocón, tronco, cercas, letrero, barril, caja, heno, farol, pozo, puestos de mercado a rayas, cofre, reja con postes de piedra, palanca, barrera del retén, tienda de campaña, fogata, derrumbe, yunque, fragua, estandarte de la Corona, barandas, borde de salto, humo. Casas en vista 3/4 con techo de paja/teja/pizarra/musgo, muros de revoque/madera/piedra, puerta, ventanas iluminadas con jardinera y chimenea |
| `fx.js` | Barrido del bastón (3 cuadros, rotado a las 4 direcciones), zarpazo rojo de enemigos, polvo, chispas, burbujas `!` `?` `…`, gemas de las 5 piedras, moneda que gira, corazones, pedacitos de pasto y hojas, brillo del agua |
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

- Música CC0 (sin cambios): `public/assets/proto/music/` — Ashfen, camino, Valkeep.
- Muestras CC0 de encuentros: `public/assets/proto/sfx/`. Créditos en `CREDITS.md`.
- **Nuevo**: tonitos sintetizados de 8 bits en `src/sfx.js` (`tone()`): golpe, impacto, daño, rodada,
  corte, recoger, corazón, menú, alerta, sospecha, salto, texto, cofre. No pesan nada.
