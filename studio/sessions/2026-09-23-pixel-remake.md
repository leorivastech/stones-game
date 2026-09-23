# 2026-09-23 — Rehecho en pixel art

## Pedido de Leo

Analizar el juego a fondo y rehacerlo muy superior:

1. Gráficos completamente nuevos en **pixel art** bien hecho, inspirados en lo que había.
2. Mejor UI/UX.
3. Encuentros en el camino en vez de eventos sueltos: pelear, correr y esconderse con botones,
   "tipo Pokémon pero sin batalla por turnos, más bien como Zelda".
4. Rutas entretenidas, no una línea recta: que se vaya abriendo otro pedacito de camino.

Respuestas de Leo a las preguntas: "hazlo tú", rutas más largas "pero sí habrá cosas como
enemigos", "sí, adelante" (con las recomendaciones: 16 px a 480×270, pegarle a bandidos y animales
y esquivar guardias, teclado + control, commit previo, muestra primero).

## Qué se hizo

- Commit del estado anterior (`be15c32`) y rama `pixel-remake`.
- **Arte** (`src/art/`): búfer de píxeles, paleta maestra, fuente propia, personajes por moldes y
  paletas, criaturas, terreno pintado píxel a píxel por mapa, objetos, casas, efectos, interfaz,
  logo. Laboratorio `lab.html` para revisar todo ampliado.
- **Mapas** (`src/maps/`): Ashfen, Ruta 1 (pradera, río, retén vs. sendero de bandidos, farallón
  con reja y palanca, montaña) y Valkeep. Trazados con un pequeño lenguaje (`grid.js`).
- **Juego**: jugador con golpe/rodada/carrera/agacharse/salto; jabalí, bandido y guardia con
  estados; revisión de la Corona; robo de piedras; cofres; corazones; K.O.; caballo que sigue.
- **Interfaz**: HUD, cartel de lugar, indicador contextual, avisos, diálogos, elecciones, mercado,
  pausa con mapa/carga/mercados/controles, título con partida guardada.

## Cómo se verificó

Pruebas automáticas en Chromium (Playwright) con capturas: título, intro, compra en Ashfen, pausa,
cada tramo de la ruta, pelea con jabalí y bandidos, robo, guardia que persigue y revisa, soborno,
barrera, cortar arbusto, salto de borde, palanca, K.O., venta en Valkeep, caballo, cofre del
corazón, guardar y continuar. En WebGL y en Canvas. `vite build` sin errores.

## Errores encontrados y corregidos en el camino

- Toques de tecla muy rápidos se perdían entre cuadros → se leen por evento `keydown`.
- La tecla que abre una ventana contaba como "confirmar" → bloqueo breve al abrir; las elecciones
  esperan 0,3 s para que machacar E no elija sin ver.
- `nineslice` no dibuja en Canvas → marcos propios a medida.
- Texto centrado en medio píxel se deformaba → centrado entero.
- La cámara de Phaser 4 no acepta `"Sine.InOut"` → `"Sine.easeInOut"`.
- Referencias viejas (caballo, barrera) sobrevivían al cambiar de mapa → se limpian en `init`.
- Bandido que huía se atascaba en árboles → elige entre 8 rumbos el más libre.

## Siguiente

Que Leo juegue la muestra (`npm run dev`) y diga si sigue el estilo para Verdelume, Duneshade y
Frostholm.
