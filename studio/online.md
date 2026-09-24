# Stones en línea (prueba para 2+ personas)

Construido el 2026-09-23 en la rama `online`, a pedido de Leo: "todo debería ser parte de que estás
en el mismo mundo". El juego de un jugador sigue igual; lo en línea sólo se prende con `?online=1`.

## Cómo se arranca

```bash
npm run online                                   # compila y arranca en http://127.0.0.1:5190
cloudflared tunnel --url http://127.0.0.1:5190   # enlace público para el celular o el amigo
```

Cada jugador abre `https://<enlace>/?online=1&nombre=Leo` (sin `nombre`, lo pide al entrar).
El servidor guarda el mundo en `server/data/world.json` (fuera de git). Para empezar de cero, se
borra ese archivo. `DAY_SECONDS=180` (un día del mundo cada 3 minutos) se cambia al arrancar.

En desarrollo: `npm run server` y el `npm run dev` de siempre (Vite pasa `/net` al 5190).

## Qué es de todos y qué es tuyo

| Del mundo (igual para todos) | Tuyo (en tu aparato) |
|---|---|
| Mercado de cada pueblo y el vaivén de precios | Oro, carga, vida, tónicos |
| Reloj: un día cada 3 min; viajar ya no pasa días | Deuda, fama, mejoras personales |
| Sucesos y calor de la Corona por pueblo | Tu yegua |
| Enemigos: los mismos; muertos hasta el día siguiente | Tu guardado (uno por nombre) |
| Cofres (el primero se lo lleva), rejas y palancas | |
| Pasto y arbustos cortados (vuelven con el día) | |
| Piedras y monedas tiradas: cualquiera las levanta | |
| Refugios y alijos: tienen dueño; el dueño invita | |
| Estante del refugio (dueño e invitados) | |
| Sahra, la arquera: una sola | |
| Buhonero de cada ruta y día (quien llega primero compra) | |

## Cómo se juega junto

- **Verse**: el otro aparece caminando con su nombre encima (como fantasma: no choca).
- **Enemigos**: el primero que entra a un mapa los "manda" (su aparato los mueve); los demás ven
  lo mismo y sus golpes cuentan. Persiguen al jugador más cercano. Un guardia puede revisar a
  cualquiera; la revisión le sale al revisado.
- **Refugio**: el primero que pone los herrajes (o compra la tierra de Aurelio) es el dueño. En la
  puerta, el dueño elige "Invitar a Mara" o "Quitar la invitación". Sin invitación dice "Es de Leo".
- **Voz**: mantener el botón **🎤 Mantén para hablar** (abajo a la izquierda) o la tecla **T**; en
  celular, el botón redondo 🎤. La primera vez el navegador pide permiso del micrófono. En el mismo
  mapa se oye más fuerte mientras más cerca; si están en lugares distintos, bajito como radio.
  Arriba dice "hablando…", "acepta el permiso" o "sin permiso: dale permiso en el candado".
- **Chat**: **Enter** abre la caja (en celular 💬). Mientras escribes el juego no oye el teclado.
- **Barra de arriba**: en línea o no, el día del mundo con su barrita, con quién estás y quién habla.
- **Pausa → mapa**: dónde anda cada jugador. **Rumores**: también cuentan lo que hacen los jugadores.
- **Empezar**: el primer jugador en Ashfen, el segundo en Duneshade, y así por turnos.

## Cómo está hecho

- `server/index.mjs`: sirve el juego compilado (`dist/`) y la conexión en vivo en `/net`
  (WebSocket, librería `ws`) por el mismo puerto: un solo túnel alcanza. Decide quién manda en
  cada mapa y pasa los mensajes (posiciones, enemigos, chat, voz).
- `server/world.mjs`: el mundo compartido. Usa tal cual `src/economy.js` y `src/director.js`.
- `src/net/online.js`: conexión, reconexión sola, espejo del mundo. `state.js` lo consulta.
- `src/net/worldnet.js`: el mapa actual en línea (fantasmas, enemigos con mando y títeres, daño y
  revisiones por red, piedras tiradas, arbustos, cofres/rejas/refugios en vivo, el día).
- `src/net/hud.js` y `src/net/voice.js`: barra, chat, nombre y voz. La voz va **por el mismo
  servidor** (audio de 16 kHz en pedacitos por la conexión del juego; ~32 KB/s mientras alguien
  habla): si el juego se conecta, la voz llega, en cualquier red. La primera versión iba de aparato
  a aparato (WebRTC) y entre compu y celular no conectaba (23-sep, Leo: "no funciona para nada").

## Pruebas (2026-09-23)

Con dos navegadores reales (Playwright): 24 + 4 comprobaciones del mundo compartido (mercado,
noticias, verse, chat, enemigos, piedras, cofre, reja, voz con audio llegando, refugio, estante,
invitación, reloj, revisión a otro jugador, Sahra única, buhonero igual, celular), 3 de traspaso de
mando y 3 de reconexión. Las del juego de un jugador siguen pasando.

## Límites conocidos

- **Voz**: unas décimas de retraso (es "mantén para hablar", no llamada). Sin cancelación de eco
  entre dos aparatos en el mismo cuarto: usar audífonos o separarse.
- **iPhone**: Safari pide el micrófono cada vez y la voz se corta si cambias de app.
- **Lag**: con internet lento, el que no manda ve a los enemigos brincar un poco.
- **Sin cuentas ni contraseñas**: el nombre es la identidad (prueba entre conocidos). Nada impide
  que alguien use tu nombre. Para abrirlo al público hace falta todo eso.
- El servidor corre en la compu de Leo: si se apaga, se cae el mundo (se guarda cada 4 s).
