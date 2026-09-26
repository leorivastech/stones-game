# 2026-09-26 — plan: en línea a fondo, audio 100 % IA y refugios escondidos

Pedido de Leo (26-sep, 12:50–13:05), para hacer en cuanto se renueven los créditos (13:10). Leo se fue:
hay que hacerlo TODO sin preguntar. Regla: lo sencillo a subagentes Opus; la sesión principal dirige,
revisa con capturas y commitea por bloque (sin firma de Claude). Worktree
`~/Development/stones_Game/.claude/worktrees/pixel-remake`, rama `online`.

## A. En línea (Leo: "que todos miren los mismos objetos, los mismos enemigos, todo")

1. **Un solo enlace**: en el título, "En línea" / "Solo" (y pedir nombre al elegir En línea). Sin
   `?online=1` a mano; el parámetro puede seguir funcionando. Si el servidor no responde, avisa y
   ofrece jugar Solo.
2. **Todo lo nuevo compartido**: enemigos extra de noche, matones del Gremio (aparecen para el
   deudor pero todos los ven y pueden pelear), "?" del guardia que busca, escala/parpadeo de golpes,
   cuchillos del bandido, carreta y yegua de otros, aldeanos que caminan (mismo recorrido para todos:
   deterministas por día/hora), cofres y detalles.
3. **Una sola hora del mundo**: mismo largo de día en línea y solo (4 min), la noche igual para todos;
   decidir qué hacen dormir y el K.O. en línea (p. ej. dormir = te saltas el tiempo tú solo con un
   fundido y el mundo sigue; o se quita el salto en línea) y documentarlo.
4. **Progreso en el servidor por nombre** (oro, carga, fama, deuda, mejoras, contratos, yegua): se
   sigue desde cualquier aparato; el navegador queda como caché.
5. **Qué es de todos y qué de cada quien**: contratos por jugador; cofres/buhonero/Sahra de todos;
   dejarlo claro en `studio/online.md`.
6. **Reconectar solo** sin perder nada y sin fantasmas congelados (quitar al que se va tras X s).
7. **Lista de jugadores** conectados y dónde están (pausa y mapa).
8. **Probar voz y chat** con todo lo nuevo (dos navegadores; celular si se puede con `?touch=1`).
9. Hosting fijo: NO (lo decide Leo, puede costar).

## B. Audio 100 % IA (Leo: "que todo sea inteligencia artificial completamente")

Generar con MOSS en la 3070 (script `studio/musica/ia/generar.py`, reanudable, lanzado con
`setsid nohup`) y conectar los que siguen viejos: `OLD_SFX` de `src/sfx.js` (armor, arrow-hit, coin,
die, jingle-free, jingle-mission, lever, splash, swing, swing2, ui-error, ui-move, ui-ok),
`assets/proto/sfx` (chop, draw, latch, sack), el ambiente `assets/ambience/cave.ogg`. Los jingles y
tonos de menú: con ACE-Step (clips cortos) o MOSS. Al final no debe quedar ningún archivo de audio
viejo cargado por el juego (el trailer puede seguir usando los suyos).

## C. Refugios escondidos (Leo: "4 o 5 más, muy escondidos; el del campesino hay que buscarlo")

- Hoy hay 3 (Cueva del Paso Alto en ruta2, Tierra escondida de Aurelio en ruta3, cueva del lago en
  ruta4) y "están muy a la vista". Esconder más la entrada de los 3 (dentro del bosque, detrás de
  arbustos que se cortan, sendero que no se ve desde el camino, sin letrero), sobre todo la tierra
  de Aurelio ("te tuvieras que ir adentrito, buscándolo").
- **Agregar 4 o 5 refugios nuevos**, uno en ruta1, ruta5 y los que falten, cada uno bien escondido
  (cueva tras cascada o derrumbe, sótano en ruinas, cabaña en el pantano, grieta en el desierto…),
  con su mapa chico en `src/maps/refugios.js`, estante/catre/mesa como los otros, precio y fama para
  comprarlo, y que funcionen en línea (dueño que invita).
- Pista para encontrarlos: rumores que los insinúan ("dicen que detrás del derrumbe…").

## Orden

B (el script de GPU corre solo) → A y C en paralelo con archivos repartidos → prueba de punta a punta
(solo y en línea con dos navegadores) → reconstruir `dist` y reiniciar SOLO el servidor de Stones
(`node server/index.mjs` en :5190; el túnel `morgan-trio-prostate-responses.trycloudflare.com` sigue
si no se reinicia cloudflared) → nota de resultado aquí y memoria.

## Encargo extra (26-sep, ~14:05)

Leo: "con el último video en descargas, córtalo y haz un nuevo trailer con todo lo nuevo" (/trailer-juego).
Video fuente: `~/Downloads/2026-09-26 14-00-27.mp4` (188 s, grabación de Leo jugando; no tocarlo).
Salida esperada: `~/Downloads/stones-trailer-v4.mp4`, guion en `trailer/guion-v4.json`.

Estado al lanzar: C (refugios) terminado sin commit; A (en línea) y B (audio IA) trabajando.
Servidor para el celular: copia estable en `/tmp/stones-live` (HEAD 4f41e1a) en :5190; túnel
https://net-historic-acute-brown.trycloudflare.com (los reinicios de la compu lo tumban y cambia).
Al terminar A y B: commit por bloque, reconstruir desde el worktree real y servir eso en :5190.
