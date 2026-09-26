# Stones en línea (prueba para 2+ personas)

Construido el 2026-09-23 en la rama `online`, a pedido de Leo: "todo debería ser parte de que estás
en el mismo mundo". Rehecho a fondo el 26-sep ("que todos miren los mismos objetos, los mismos
enemigos, todo"): un solo enlace, todo lo nuevo compartido, una sola hora, avance en el servidor,
reconexión sola y lista de jugadores.

## Cómo se arranca

```bash
npm run online                                   # compila y arranca en http://127.0.0.1:5190
cloudflared tunnel --url http://127.0.0.1:5190   # enlace público para el celular o el amigo
```

**Un solo enlace para todo**: `https://<enlace>/`. En el título:

- **Solo** → Continuar / Nueva partida (la partida de siempre, guardada en este aparato).
- **En línea** → pide el nombre (recuerda el último), revisa que el servidor conteste (4 s) y recarga
  la página con `?online=1&nombre=…`. Si no contesta: "El servidor no responde" → Reintentar / Jugar solo.
- Ya en línea: **Continuar** (tu avance del servidor) / **Empezar de cero** (pregunta antes de borrar) /
  **Cambiar nombre** / **Jugar solo** (vuelve al modo de un jugador sin tocar tu avance en línea).

El atajo `https://<enlace>/?online=1&nombre=Leo` sigue sirviendo (entra directo al menú en línea; si
el servidor no contesta en 4 s, avisa y ofrece "Seguir intentando" o "Jugar solo").

El servidor guarda el mundo **y el avance de cada jugador** en `server/data/world.json` (fuera de git).
Para empezar de cero, se borra ese archivo. `DAY_SECONDS` (240 = un día cada 4 minutos, igual que
jugando solo) se cambia al arrancar. Si el servidor se reinicia, el mundo sigue a la misma hora.

En desarrollo: `npm run server` y el `npm run dev` de siempre (Vite pasa `/net` al 5190).
Para probar sin tocar el de Leo: `npx vite build --outDir /tmp/stones-dist` y
`PORT=5291 DIST=/tmp/stones-dist WORLD_FILE=/tmp/stones-test-world.json STONES_TEST=1 node server/index.mjs`
(`STONES_TEST=1` deja poner la hora del mundo con `{t:"testHour", h}` y anota quién manda cada mapa).

## Qué es de todos y qué es de cada quien

| Del mundo (igual para todos, lo guarda el servidor) | De cada jugador (se guarda en el servidor por nombre) |
|---|---|
| Mercado de cada pueblo y el vaivén de precios | Oro, carga, frío de la escarcha, vida, tónicos |
| La hora y el día (un día cada 4 min; empieza a medianoche) | Fama, deuda (y sus matones), mejoras |
| Sucesos y calor de la Corona por pueblo | Contratos del tablón (cada quien los suyos) |
| Enemigos: los mismos, en el mismo lugar; muertos hasta el día siguiente | Tu yegua y tu carreta (los demás las ven) |
| Los de la noche (salen para todos; tumbados no vuelven esa noche) | El tutorial, rumores oídos, precios vistos |
| Matones del Gremio: vienen por el deudor, pero todos los ven y les pueden pegar | Dónde vas (mapa) |
| Cofres (el primero se lo lleva), rejas y palancas | |
| Pasto y arbustos cortados (vuelven con el día) | |
| Piedras y monedas tiradas: cualquiera las levanta | |
| Aldeanos: caminan igual en todos los aparatos (salen de la hora, sin red) | |
| Refugios y alijos: tienen dueño; el dueño invita. Estante del refugio | |
| Sahra, la arquera: una sola | |
| Buhonero de cada ruta y día (quien llega primero compra) | |

**El avance**: el juego lo manda al servidor al guardar (con 1 s de espera), cada 8 s si cambió algo
y al esconder o cerrar la página. Al entrar se toma el más nuevo entre el del servidor y el del
navegador (el navegador queda como caché: si juegas sin conexión, al volver se sube). El servidor
revisa lo mínimo (que sea un objeto, tipos de oro/carga/vida, tamaño < 200 KB); no es antitrampa.

## Una sola hora

- El servidor manda la hora (cada 2 s, con su reloj: el del celular puede ir adelantado y no importa).
  El día y la noche se ven igual en todos. Mismo largo que solo: 4 minutos.
- El día cambia a **medianoche** del servidor, como jugando solo: ahí vencen contratos, llega el
  cobrador (en un pueblo) y se derrite la escarcha de los estantes. La escarcha que llevas se derrite
  hora por hora, igual que solo.
- **Dormir en línea** (posada o catre): te curas y el aviso dice "en línea el día no se salta"; el
  reloj del mundo no se mueve. **K.O. en línea**: pierdes lo mismo y despiertas en el pueblo o tu
  refugio, pero sin saltar horas. (Decidido así por simple: saltarse el tiempo uno solo haría que
  cada quien viviera otro día.) La barca tampoco pasa días en línea.

## Cómo se juega junto

- **Verse**: el otro aparece caminando con su nombre encima (como fantasma: no choca).
- **Enemigos**: el primero que entra a un mapa los "manda" (su aparato los mueve); los demás ven
  lo mismo y sus golpes cuentan. Persiguen al jugador más cercano. Un guardia puede revisar a
  cualquiera; la revisión le sale al revisado. En la foto que manda (10 por segundo) también van el
  "?" del guardia que busca, el parpadeo blanco del golpe, lo que se estiran o aplastan, las nubes
  (! ?), los cuchillos del bandido, los que salen **de noche** y los **matones del Gremio**.
- **Si el que manda se va** (o su pestaña se esconde y deja de moverse 3 s), manda otro de los que
  están ahí: los enemigos vuelven a como empezaron (sin embestidas ni cuchillos a medias) y siguen.
- **Matones**: tras la 3ª falta de la deuda, en la siguiente ruta el deudor pide los matones; los saca
  el que manda el mapa, persiguen sólo al deudor y si lo tumban cobran ellos (oro o yegua). Si el
  deudor se va del mapa, se retiran.
- **Se cae la conexión**: sigues jugando (tus enemigos se mueven en tu aparato); arriba dice "sin
  conexión" y reintenta solo cada vez más espaciado (0.5 s … 8 s). Si pasan 7 s sin saber del
  servidor, corta y reintenta. Al volver: el servidor te dice quién manda, te repite muertos,
  cortes y piedras, y se sube tu avance y los enemigos que tumbaste sin conexión. A los demás, el
  que se quedó sin conexión les desaparece a los ~8 s (sin fantasmas congelados).
- **Refugio**: el primero que pone los herrajes (o compra la tierra de Aurelio) es el dueño. En la
  puerta, el dueño elige "Invitar a Mara" o "Quitar la invitación". Sin invitación dice "Es de Leo".
- **Voz**: mantener el botón **🎤 Mantén para hablar** (abajo a la izquierda) o la tecla **T**; en
  celular, el botón redondo 🎤. La primera vez el navegador pide permiso del micrófono. En el mismo
  mapa se oye más fuerte mientras más cerca; si están en lugares distintos, bajito como radio.
  Arriba dice "hablando ▮▮▮▯▯" (las barritas se mueven si te oye), "acepta el permiso" o "sin
  permiso". Si sueltas y no se captó sonido, el chat dice **"No se oyó nada"**.
- **Revisar la voz desde afuera**: `…/estado` muestra quién está conectado, qué aparato, cómo va su
  micrófono (listo, sin permiso, sin micrófono, ocupado), cuánto audio mandó y qué tan fuerte se oyó
  la última vez (`nivelUltimaVez`: casi 0 = el micrófono no capta nada).
- **Chat**: **Enter** abre la caja (en celular 💬). Mientras escribes el juego no oye el teclado.
- **Barra**: arriba a la izquierda, debajo de los corazones (no choca con el cartel del tutorial ni con
  el de lugar): en línea o no, el día del mundo con su barrita, con quién estás y quién habla. Se
  esconde con la pausa y el mercado; con un diálogo abierto, el chat sube junto a la barra.
- **Pausa → JUGADORES** (sólo en línea): quién está conectado, en qué mapa, quién anda contigo y quién
  habla. **Pausa → MAPA**: un cuadrito azul por jugador. **Rumores**: también cuentan lo que hacen
  los jugadores.
- **Empezar**: el primer jugador en Ashfen, el segundo en Duneshade, y así por turnos.

## Cómo está hecho

- `server/index.mjs`: sirve el juego compilado (`dist/`) y la conexión en vivo en `/net`
  (WebSocket, librería `ws`) por el mismo puerto: un solo túnel alcanza. Decide quién manda en
  cada mapa (y se lo pasa a otro si se va o se congela), pasa los mensajes (posiciones, enemigos,
  matones, chat, voz), lleva el reloj (cada segundo revisa medianoche y mediodía; cada 2 s manda la
  hora) y corta las conexiones muertas (ping; 8 s sin respuesta).
- `server/world.mjs`: el mundo compartido y el avance de cada jugador (`players[nombre].save`). Usa tal
  cual `src/economy.js` y `src/director.js`.
- `src/net/online.js`: conexión, reconexión con espera creciente, vigilante de 7 s, hora del servidor
  (`worldNow`), espejo del mundo, subir el avance (`pushSave`) y la prueba del servidor del título.
- `src/net/worldnet.js`: el mapa actual en línea (fantasmas con su yegua o carreta, enemigos con mando
  y títeres, los de la noche y los matones, daño y revisiones por red, piedras tiradas, arbustos,
  cofres/rejas/refugios en vivo, el día, reconexión).
- `src/entities/enemies.js`: los de la noche salen de un plan con semilla del mapa (igual en todos) con
  ids `n:0`, `n:1`…; matones `t:<nombre>:<n>:<i>`.
- `src/entities/npc.js`: en línea, el recorrido de cada aldeano sale de la hora del servidor.
- `src/net/hud.js` y `src/net/voice.js`: barra, chat, nombre y voz. La voz va **por el mismo
  servidor** (audio de 16 kHz en pedacitos por la conexión del juego; ~32 KB/s mientras alguien
  habla): si el juego se conecta, la voz llega, en cualquier red. La primera versión iba de aparato
  a aparato (WebRTC) y entre compu y celular no conectaba (23-sep, Leo: "no funciona para nada").

## Pruebas (2026-09-26)

Con Playwright, servidor de prueba en 5291 y dos o tres navegadores entrando por el título real
("En línea" → nombre → "Entrar al mundo"): 14 + 26 + 15 comprobaciones, todas bien y sin errores de
consola del juego. Se ven; mismos enemigos en el mismo lugar (≤ 8 px); uno tumba un jabalí y el
otro lo ve morir; el mismo cofre a la vez: sólo uno lo gana; chat; pausa JUGADORES; de noche los
mismos 4 extras en el mismo lugar, uno tumbado no vuelve esa noche y al amanecer se van; los
matones de Beto salen para los dos y van por él; recargar con el navegador vacío devuelve oro y
carga del servidor; tercer jugador ve lo mismo; voz con micrófono falso llega; cortar la red de uno
11 s: los demás dejan de verlo y al volver se reconecta solo; se va el que manda: otro toma el mando
y los enemigos siguen igual; aldeanos en el mismo lugar sin red; la carreta del otro; el "?" del
guardia; parpadeo y estirón; dormir no mueve el reloj; sin servidor avisa y ofrece Solo; atajo del
enlace; y una partida Solo de 1 minuto. Scripts en `/tmp/stones-net/` (t1, t2, t4, t5, t6 y
`lib.mjs`): si se pierden, rehacerlos igual.

## Pruebas (2026-09-23)

Con dos navegadores reales (Playwright): 26 + 5 comprobaciones del mundo compartido (mercado,
noticias, verse, chat, enemigos, piedras, cofre, reja, voz con la tecla T, con el botón de la compu y
desde el celular, refugio, estante, invitación, reloj, revisión a otro jugador, Sahra única,
buhonero igual, celular), 3 de traspaso de mando y 3 de reconexión; más el caso de una entrada que
graba silencio. Las del juego de un jugador siguen pasando. Los scripts vivían en el tmp de la
sesión (two.mjs, two3.mjs, handoff.mjs, reconnect.mjs, nomic.mjs): si se pierden, rehacerlos igual.

**Prueba real (23-sep, Leo y MAR, compu y celular)**: se conectaron, se vieron en Verdelume.
La voz desde el celular llegó; desde la compu no. Pendiente leer `/estado` con la compu de Leo.

## Límites conocidos

- **Voz**: unas décimas de retraso (es "mantén para hablar", no llamada). Sin cancelación de eco
  entre dos aparatos en el mismo cuarto: usar audífonos o separarse.
- **iPhone**: Safari pide el micrófono cada vez y la voz se corta si cambias de app.
- **Lag**: con internet lento, el que no manda ve a los enemigos brincar un poco.
- **Sin conexión** los enemigos se mueven en tu aparato; si te tumban ahí, lo pierdes igual (se guarda).
  Lo que pase en el mapa mientras no hay conexión (piedras tiradas, cofres) no se comparte después,
  salvo los enemigos que tumbaste.
- El cuchillo de un bandido títere apunta al jugador más cercano que ve ese aparato (sólo se ve; el
  daño lo cuenta el que manda).
- **Sin cuentas ni contraseñas**: el nombre es la identidad (prueba entre conocidos). Nada impide
  que alguien use tu nombre. Para abrirlo al público hace falta todo eso.
- El servidor corre en la compu de Leo: si se apaga, se cae el mundo (se guarda cada 4 s). El
  enlace del túnel cambia cada vez que se levanta de nuevo.
