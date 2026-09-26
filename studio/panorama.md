# Panorama — Stones (actualizado 2026-09-26, tanda 4: tensión)

La fuente de verdad de **qué se decidió, qué está construido, qué se descartó y qué falta decidir**.
El historial fechado vive en `decisions.md`; cómo se juega hoy, en `mechanics.md`.

## La idea en una frase

Un juego de comercio y contrabando **sin final forzoso** (como los de granjita y comercio): vas
armando tu red de piedras de hechizo en un mundo vivo que cambia día a día, ganando fama al vender
lo que cada pueblo ocupa. Ahora también **en línea**: varias personas en el mismo mundo.
Lo interesante es **prepararse**: qué llevas, a quién llevas, dónde dejas qué y por qué camino vas.

## 1. Construido (se puede jugar hoy)

| Tema | Qué hay |
|---|---|
| Mundo | 6 pueblos, 5 rutas, barca, 3 refugios. Mossgrove (bosque) entre el desierto y la nieve. |
| Animación | Paso con rebote y brazos, respirar; yegua con vistas de lado, frente y espalda; Sahra con arco, carcaj y pose de disparo. |
| Días | **El reloj corre en todos los mapas** (26-sep): 4 min reales = 1 día; a medianoche pasa el día aunque estés en la ruta ("Amanece el día N"). Barca: 3 días. Dormir: hasta las 7 del día siguiente. Letreros con "~3 h a pie". |
| Mercado tipo bolsa | Todos los pueblos con las 5 piedras; precio por oferta y demanda; tope de la Corona a la vista; precios "vistos hace N días". |
| Carácter de las piedras | Ámbar con sello (impuesto), vidrio frágil, perla pesada, solar vigilada, escarcha que se derrite (hielera en Frostholm). |
| Mundo vivo | Director chico de 9 sucesos (barajados cada día) con **cuenta atrás** en la pausa, "!" en el mapa y línea en el HUD si le pega a tu pueblo; rumores con fuente (posaderos casi siempre aciertan) marcados con "?" en el mapa; al llegar se comprueban y los falsos se tachan. |
| Deuda | 500 con el Gremio, cuota 40 cada **7 días**. **Con dientes** (26-sep): 1ª falta aviso, 2ª +10 %, 3ª+ dos **matones del Gremio** en la siguiente ruta (30 % del oro o embargan la yegua, 60 para sacarla). Pagar todo: **Mercader libre** (+2 fama, ceremonia). |
| K.O. | Pierdes la mitad de la carga y 20 % del oro, **pasan 12 h**, la yegua se espanta y te espera en esa ruta; despiertas en tu refugio con catre de la ruta, si tienes. |
| Fama = medallas | Vendiendo lo que un pueblo ocupa (+1 por pueblo y día); 5 títulos que abren mejoras. |
| Comercio simple | Llegas, compras y vendes según oferta y demanda. Sin misiones ni pedidos (quitados 23-sep). |
| Buhonero de camino | A veces (35 %) anda uno por la ruta: compra caro y vende barato, pocas piezas. |
| Refugios secretos | Cueva del Paso Alto, tierra escondida de Aurelio (con corral), cueva del lago (fría). Estante, mesa de mejoras, catre, cerrojo; redadas. |
| Gente física | Yegua y Sahra te siguen; se dejan en refugio, posada o establo y se recogen ahí. Yegua sin hielo ni cuevas sin corral. Más gente = te ven de más lejos. |
| Precios revueltos | Sin orden fijo: las ganas de comprar y lo que llega de cada piedra se mueven al azar en todos los pueblos, día con día. |
| Qué vender, claro | Cartel "HOY EN …" al llegar, burbuja con la gema sobre el comerciante, mercado con OCUPAN / SOBRA. |
| Controles | Teclas juntas (WASD + J K L I, o flechas + Z X C V), un solo botón de acción. Celular: palanca y botones en pantalla. |
| Barca | Mapa animado con la barquita cruzando el golfo (~4 s). |
| En línea | Mundo 100 % compartido para varias personas, voz y chat. Rama `online`; ver `online.md`. |

## 2. Decidido con Leo

- Sin final forzoso. Fama **global**, funciona como medallas. Sin misiones ni pedidos: sube al
  vender lo que un pueblo ocupa (esto último es provisional).
- Tiempo por días. Mercado tipo bolsa. Mundo vivo con sucesos por reglas y rumores.
- Deuda como motivo para empezar (por ahora).
- Refugios tipo base secreta (cueva forjada, tierra escondida), con mejoras; la Corona los
  encuentra sin cerrojo si la ruta está muy caliente.
- Gente que se lleva y se deja caminando; máximo 2 personas y un caballo; caballo en la barca
  pagando más; caminos donde el caballo no pasa.
- La escarcha **no** se rompe con hielo: se derrite con los días (hielera y refugio frío la cuidan).
- Precios sin orden: cualquier piedra puede estar cara o barata en cualquier pueblo.
- Un pueblo de bosque entre el desierto y la nieve (Mossgrove), sin piedra propia.
- Buhonero que aparece al azar en los caminos, como personita.
- En línea: **todo** es del mismo mundo (enemigos, cofres, rejas, refugios con dueño que invita,
  Sahra única). Voz con "mantén para hablar", por cercanía.

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
- Fama por cada piedra vendida → por vender lo que un pueblo ocupa (una vez por pueblo y día).
- Misiones de historia (23-sep) y pedidos de los comerciantes (23-sep) → no se entendían.
- "A cada pueblo le falta la piedra del vecino" (el orden en círculo) → precios revueltos.
- En línea, enemigos y refugios "de cada quien" → todo compartido.
- Voz directa de aparato a aparato (WebRTC) → no conectaba entre compu y celular; ahora va por el servidor.
- Jev u otro modelo decidiendo los sucesos → cuesta por llamada, necesita internet, sus
  probabilidades no están calibradas y no deja simular para balancear.
- "Cada pueblo compra una sola piedra" → mercado tipo bolsa.
- Alijos en huecos → refugios.

## 5. Para después

- **Jugar en celular y iPad** (Leo lo pidió anotar):
  1. Web: **hecho 23-sep** palanca y botones táctiles, menús con A/B, aviso de girar, franjas para
     que no tapen el juego (×1.34 en iPhone 14 acostado). **Falta**: probarlo en un celular de verdad,
     tiempo de carga; PWA instalable ("Agregar a
     pantalla de inicio", pantalla completa, sin internet; en iOS protege la partida); publicarlo en
     un hosting gratis o en Hostinger.
  2. APK de Android con Capacitor (mismo código). Google Play: 25 USD una vez.
  3. iPhone/iPad en App Store con Capacitor: 99 USD al año, Mac o compilación en la nube
     (Codemagic), TestFlight para probar. Sólo cuando se publique.
- **En línea — PRIMERA PRUEBA HECHA (23-24 sep, rama `online`)**. Pendiente: que la voz desde la
  compu de Leo funcione (probablemente no tiene micrófono real: ver `online.md`), un servidor que no
  dependa de su compu, y cuentas si se abre al público.: mundo compartido de verdad, voz, chat; ver `studio/online.md`. Ideas que siguen: jugadores como parte de la oferta y la demanda; acaparar;
  grupos con refugios compartidos; "alguien salvó tus cosas". `economy.js` y `director.js` ya son
  lógica pura: se pueden mover a un servidor.
- Misiones de historia: quitadas el 23-sep porque no se entendían. Si vuelven, con aviso claro de cuándo te las piden, cuánto tiempo hay y cuándo se pierden.
- Atajo de montaña Ashfen ↔ Verdelume.

## 6. Falta decidir

0. **Sesión para dejar claras las reglas del mercado** (Leo, 23-sep): el vaivén de precios, la fama por vender y el buhonero son provisionales, "para ver cómo se ve".
0b. **Qué rama queda**: `online` tiene todo (sale de `pixel-remake`); ninguna está en `master`. Mezclar cuando Leo diga.

1. Tono del lore y el resto de la historia (por qué cada pueblo tiene su piedra, quién manda en los caminos).
2. Las propuestas de la sección 3.
3. Si los números se sienten bien jugando (día de 4 min fuera de línea y 3 en línea, cuota 40 cada 7
   días, escarcha 20 %/día, fama por vender). Con el tiempo corriendo en la ruta un tramo cuesta
   ~0,4 días en vez de 2: el mercado se recupera menos entre visitas (la simulación da menos oro
   por tramo que antes). Si se siente lento, subir producción/consumo en `economy.js`.
4. Llevar la skill del trailer al molde `~/Development/framework-ia-videojuegos`.
