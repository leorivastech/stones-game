# Panorama — Stones (actualizado 2026-09-23 noche)

La fuente de verdad de **qué se decidió, qué está propuesto, qué se descartó y qué falta decidir**.
El historial fechado vive en `decisions.md`; lo ya construido, en `mechanics.md` y `diseno-mundo.md`.

## La idea en una frase

Un juego de comercio y contrabando **sin final forzoso** (como los de granjita y comercio): vas
armando tu red de piedras de hechizo en un mundo vivo que cambia día a día, ganando fama con misiones.
Lo interesante es **prepararse**: qué llevas, a quién llevas, dónde dejas qué y por qué camino vas.

## 1. Ya construido (se puede jugar hoy)

- 5 pueblos (Ashfen, Valkeep, Verdelume, Duneshade, Frostholm), 4 rutas y la barca.
- Pelea en tiempo real: golpe, rodar, correr, esconderse en pasto alto.
- Enemigos: guardias (revisión, soborno), bandidos (roban una piedra), jabalí, lobo, escorpión.
- Mercado: cada pueblo vende una piedra y compra la del anterior. Calor por vender.
- Servicios: herrero (herrajes de alijo, fondo falso), establo (caballo), curandera (tónicos),
  arquera, barquero. Alijos en las rutas con redadas. Lago helado para patinar.
- Modo prueba con F1 y teclas 1-8.

## 2. Decidido — entra

| Tema | Qué |
|---|---|
| **Sin final forzoso** | Mundo abierto que sigue; no hay "se acabó el juego". |
| **Fama = medallas** | La fama sube con **misiones**, no con cada piedra vendida. Cada nivel de fama abre cosas, como las medallas. |
| **Tiempo por días** | Cruzar una ruta o tomar la barca pasa días. Los pueblos producen y consumen mientras caminas. |
| **Mercado tipo bolsa** | Oferta y demanda de verdad: cada pueblo con las 5 piedras; el precio sale de lo que hay contra lo que se necesita. Acaparar y guardar para vender cuando suba. |
| **Mundo vivo** | Sucesos que mueven el mercado (helada, cargamento agarrado, paso cerrado por nevada, feria) y rumores que te cuenta la gente. |
| **Refugios secretos** | Tipo base secreta de Pokémon: cuartito al que entras, con piedras en estantes y gente adentro. Cueva forjada (herrero) y tierra escondida (campesino). Mejoras: estantes, catre, corral, cerrojo reforzado. La Corona puede encontrar uno sin cerrojo si la ruta está muy caliente. 3 en la muestra (Rutas 2, 3 y 4). Reemplazan a los alijos. |
| **Gente física** | Se lleva y se deja **caminando**: refugio, establo (caballos) o posada (gente; cuesta). Máximo 2 personas y un caballo contigo. Mucha gente llama la atención de los guardias. Hay caminos donde el caballo no pasa. El caballo sube a la barca pagando más. |
| **Animaciones** | Personaje menos tieso (rebote, brazos, respiración); caballo redibujado con vistas de lado, frente y espalda; arquera con arco y pose de disparo. |

## 3. Propuesto — espera el sí de Leo

| Tema | Propuesta |
|---|---|
| **Cómo se mide la fama** | Fama **por pueblo**: las misiones de cada pueblo suben su fama, y cada nivel es un "sello" de ese pueblo (5 pueblos = 5 medallas con varios niveles). Alternativa: una sola fama global con rangos. |
| **Carácter de cada piedra** | Ámbar casi legal · rúnico frágil (se rompe si te pegan) · perla pesada (ocupa 2 lugares) · solar muy vigilada · escarcha que se derrite fuera del frío. |
| **Precio de la Corona a la vista** | Cada mercado muestra lo que cobra la Corona; tú vendes más barato. Explica por qué te compran. |
| **Sucesos por reglas** | Un "director" como el de RimWorld: baraja de sucesos con condiciones, probabilidad y duración. La IA sólo ayuda a escribir variantes de rumores. |
| **Rumores con fuente** | Tabernero casi siempre acierta; borracho a veces inventa; guardia sobornado avisa patrullas. |
| **Precios "vistos hace N días"** | Lo que sabes de otros pueblos envejece; los rumores dan información fresca. |
| **Motivo inicial: una deuda** | El caminante le debe al Gremio y por eso empieza. Es la primera meta, no el final: al pagarla, el mundo sigue. |
| **Metas largas sin final** | En qué gastar y para qué seguir: refugios y mejoras, gente, **tu propio puesto en un pueblo** que vende mientras no estás, el acero del herrero. Tu red crece. |
| **Feria de la Corona como evento que se repite** | Cada cierto número de días, gran feria donde compites contra la Corona. No es el final: es el evento grande del calendario, como los festivales de Stardew. |

## 4. Descartado

- **Menú de "quién va" al salir del pueblo** → la gente se lleva físicamente.
- **Final forzoso** (Liga, jefe final) → mundo abierto.
- **Fama por cada piedra vendida** → fama por misiones.
- **Jev u otro modelo decidiendo los sucesos** → cuesta por llamada, necesita internet, sus
  probabilidades no están calibradas y no deja simular partidas para balancear.
- **"Cada pueblo compra una sola piedra"** → mercado tipo bolsa.
- **Alijos como menú de números** → refugios.

## 5. Para después

- **En línea sin juego simultáneo:** los jugadores son parte de la oferta y la demanda; acaparar;
  grupos con refugios compartidos; "alguien salvó tus cosas". La meta ahí: ser la red más fuerte.
- Música propia de Verdelume, Duneshade y Frostholm.
- Trailer con el mundo nuevo.
- Atajo de montaña Ashfen ↔ Verdelume.
- Jev u otro modelo para decisiones de personajes (¿acepta el soborno?), sólo como experimento
  detrás de reglas que funcionan solas.

## 6. Falta decidir

1. **Lore:** tono (serio, aventura ligera o con humor), por qué el caminante entra a la red, por
   qué cada pueblo produce una piedra, quién manda en los caminos.
2. **Fama:** por pueblo o global; qué abre cada nivel.
3. **Las propuestas de la sección 3.**

## 7. Orden de trabajo sugerido

1. Animaciones (no dependen de nada).
2. Lore y fama (decisiones de Leo).
3. Mercado tipo bolsa + días + sucesos + carácter de piedras (con simulación para balancear).
4. Refugios y gente física (establo, posada).
5. Misiones con nombre que dan fama.
6. En línea.
