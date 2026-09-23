# Panorama — Stones (actualizado 2026-09-23, noche)

La fuente de verdad de **qué se decidió, qué está construido, qué se descartó y qué falta decidir**.
El historial fechado vive en `decisions.md`; cómo se juega hoy, en `mechanics.md`.

## La idea en una frase

Un juego de comercio y contrabando **sin final forzoso** (como los de granjita y comercio): vas
armando tu red de piedras de hechizo en un mundo vivo que cambia día a día, ganando fama con misiones.
Lo interesante es **prepararse**: qué llevas, a quién llevas, dónde dejas qué y por qué camino vas.

## 1. Construido (se puede jugar hoy)

| Tema | Qué hay |
|---|---|
| Mundo | 5 pueblos, 4 rutas, barca, 3 refugios. |
| Animación | Paso con rebote y brazos, respirar; yegua con vistas de lado, frente y espalda; Sahra con arco, carcaj y pose de disparo. |
| Días | Ruta 2 días, barca 3, volver 1, catre 1. El mundo cambia mientras caminas. |
| Mercado tipo bolsa | Todos los pueblos con las 5 piedras; precio por oferta y demanda; tope de la Corona a la vista; precios "vistos hace N días". |
| Carácter de las piedras | Ámbar con sello (impuesto), vidrio frágil, perla pesada, solar vigilada, escarcha que se derrite (hielera en Frostholm). |
| Mundo vivo | Director chico de 9 sucesos; rumores con fuente (posaderos casi siempre aciertan). |
| Deuda | 500 con el Gremio, cobrador cada 10 días. |
| Fama = medallas | Sólo por misiones; 5 títulos que abren mejoras. |
| Misiones | 5 de historia (una por pueblo, cada una enseña una piedra) + pedidos generados del mercado. |
| Refugios secretos | Cueva del Paso Alto, tierra escondida de Aurelio (con corral), cueva del lago (fría). Estante, mesa de mejoras, catre, cerrojo; redadas. |
| Gente física | Yegua y Sahra te siguen; se dejan en refugio, posada o establo y se recogen ahí. Yegua sin hielo ni cuevas sin corral. Más gente = te ven de más lejos. |

## 2. Decidido con Leo

- Sin final forzoso. Fama **global**, sube con misiones, funciona como medallas.
- Tiempo por días. Mercado tipo bolsa. Mundo vivo con sucesos por reglas y rumores.
- Deuda como motivo para empezar (por ahora).
- Refugios tipo base secreta (cueva forjada, tierra escondida), con mejoras; la Corona los
  encuentra sin cerrojo si la ruta está muy caliente.
- Gente que se lleva y se deja caminando; máximo 2 personas y un caballo; caballo en la barca
  pagando más; caminos donde el caballo no pasa.
- La escarcha **no** se rompe con hielo: se derrite con los días (hielera y refugio frío la cuidan).

## 3. Propuesto, falta el sí de Leo

| Tema | Propuesta |
|---|---|
| **Tono del lore** | Serio, aventura ligera o con humor. Hoy hay lo mínimo: la deuda del padre, la Corona y el Gremio. |
| **Metas largas** | Tu propio puesto en un pueblo que vende mientras no estás; el acero del herrero. |
| **Feria de la Corona** | Evento grande que se repite cada tantos días (como los festivales de Stardew). |
| **Más gente** | Cargador (más carga), explorador (ve patrullas), negociador (sobornos baratos). |

## 4. Descartado

- Menú de "quién va" al salir del pueblo → la gente se lleva físicamente.
- Final forzoso (Liga, jefe final) → mundo abierto.
- Fama por cada piedra vendida → por misiones.
- Jev u otro modelo decidiendo los sucesos → cuesta por llamada, necesita internet, sus
  probabilidades no están calibradas y no deja simular para balancear.
- "Cada pueblo compra una sola piedra" → mercado tipo bolsa.
- Alijos en huecos → refugios.

## 5. Para después

- **Jugar en celular y iPad** (Leo lo pidió anotar):
  1. Web: palanca y botones táctiles, menús que se tocan, aviso de girar a horizontal, revisar texto
     en teléfono (queda ×1.4 en iPhone acostado) y tiempo de carga; PWA instalable ("Agregar a
     pantalla de inicio", pantalla completa, sin internet; en iOS protege la partida); publicarlo en
     un hosting gratis o en Hostinger.
  2. APK de Android con Capacitor (mismo código). Google Play: 25 USD una vez.
  3. iPhone/iPad en App Store con Capacitor: 99 USD al año, Mac o compilación en la nube
     (Codemagic), TestFlight para probar. Sólo cuando se publique.
- **En línea sin juego simultáneo:** jugadores como parte de la oferta y la demanda; acaparar;
  grupos con refugios compartidos; "alguien salvó tus cosas". `economy.js` y `director.js` ya son
  lógica pura: se pueden mover a un servidor.
- Trailer con el mundo nuevo (en curso 23-sep).
- Atajo de montaña Ashfen ↔ Verdelume.

## 6. Falta decidir

1. Tono del lore y el resto de la historia (por qué cada pueblo tiene su piedra, quién manda en los caminos).
2. Las propuestas de la sección 3.
3. Si los números se sienten bien jugando (días por ruta, precio de la deuda, fama de cada misión).
