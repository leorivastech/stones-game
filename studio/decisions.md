# Decisiones

Regla: una línea por decisión, con fecha. No borrar: si se revierte, se agrega otra línea.

## 2026-09-18

- **Sí** — El repo es un *AI game studio*: chat → `studio/` → código → recargar.
- **Sí** — Phaser 4.2.1, 2D, Arcade. No editor. No Unity. No Three.js salvo que Leo lo pida explícito.
- **Sí** — Assets de prueba en `public/assets/proto/` o `src/gfx/`. Finales en `public/assets/final/`.
- **Pendiente** — Cerrar historia (nombre del caminante, si hay otros personajes, si hay final).
- **Pendiente** — Vista: de arriba (borrador) vs plataformas de lado.
- **Pendiente** — Combos de piedras (1 slot ahora, 2 más adelante).
- **Recomendado / no cerrado** — El juego real es contrabando de piedras pueblo–pueblo (comercio + carga + plata + riesgo de ruta). No RPG de turnos en v1.
- **Recomendado** — Ilícito = retenes / soborno / asalto. Piedras prohibidas de ficción, no sim de droga real.
- **Recomendado** — Vista de arriba. Crecimiento: mochila → persona → caballo/carreta.
- **Sí** — Primera versión: medieval suave, 2 pueblos grandes, 1 ámbar, eventos de ruta automáticos. Sin turnos.
- **Sí** — El proto del umbral se reemplazó por Ashfen / camino / Valkeep.
- **Sí** — Pueblos más chicos por ahora (1400×1000). El trato es el toldo rojo de la plaza.
- **Sí** — Música de fondo CC0: Old Tower Inn (RandomMind).
- **Sí** — El molde portable no es este repo. Vive en `~/Development/framework-ia-videojuegos` + skill `empezar-juego`. Los `.md` de `studio/` son el prompt; no se agrega un PROMPT por carpeta.
- **Sí** — Primera versión de encuentros de ruta con monitos y caballos (retén, asalto, confiscación, camino quieto). El HUD de arriba fuerza cuál sale, para probarlos.
- **Sí** — SFX CC0 por encuentro (caballo, cuerno, carreta, metal, monedas, cuchillo).
- **Sí** — Clavo: el herrero de la plaza arma escondites en la carga. Cuesta oro. Esa cantidad no la pierdes en retén, asalto ni confiscación.
- **Sí** — El clavo no es de principio: 96 / 180 oro. El loop temprano es comprar → cruzar (con riesgo de verdad) → vender en Valkeep, con gente en la plaza y una meta visible.
- **Sí** — Segunda pasada visual conserva vista, siluetas y estructura; mejora materiales, profundidad Y, atmósfera, props, HUD y escalado sin cambiar de motor ni montar editor.
- **Sí** — La ruta tiene elección espacial: calzada = guardias/confiscación; monte = bandidos. El selector superior sigue siendo herramienta de prueba.
- **Sí** — Se corrigió el valor esperado negativo del viaje cargado. El primer clavo debe llegar cerca del tercer viaje normal.
- **Recomendado / siguiente** — Dar una pista imperfecta antes de salir y medir 10 viajes antes de agregar caballo, ayudante o más piedras.
- **Sí / reemplaza decisión anterior** — El clavo no pertenece al progreso temprano. El herrero existe, pero no muestra precio ni ofrece servicio hasta mucho más adelante.
- **Sí** — Ashfen, camino y Valkeep tienen música distinta; las pistas cambian con fundido entre escenas.
- **Decidido para replantear** — Compra/venta infinita es sólo andamio de prototipo. Antes de más contenido hay que definir cómo se obtiene dinero, quién encarga y quién compra.
- **Recomendado / no cerrado** — Empezar como mensajero con carga adelantada; luego desbloquear comercio con capital propio y compradores clandestinos limitados.
- **Visión de Leo** — Mundo de pueblos y rutas con lectura tipo Pokémon, pero no lineal: el negocio obliga a ir y volver entre ciudades y biomas distintos.
- **Recomendado / no cerrado** — Cada ciudad produce una piedra, necesita otra y tiene calor local. Pedidos limitados y demanda que se recupera evitan una ruta infinita óptima.
- **Recomendado / no cerrado** — Primer mundo de cuatro identidades: templado, tropical, desierto y nieve; una cadena clara de necesidades conecta sus piedras.
- **Recomendado / no cerrado** — Una sola moneda común al principio. Trueques y monedas regionales sólo después de validar que el comercio base sea fácil de leer.
- **Recomendado / no cerrado** — La oposición principal es guardias/gremio, bandidos/rivales y camino/mercado. El riesgo se anuncia y permite respuesta; no depende de castigos aleatorios invisibles.
- **Recomendado / no cerrado** — El calor es por ciudad o ruta y baja al comerciar en otras regiones; así se incentiva la circulación sin cerrar pueblos anteriores.
- **Sí / corrección de Leo** — No hay mapa seleccionable ni viaje rápido. Los pueblos y caminos se recorren físicamente; para llegar más lejos hay que atravesar los pueblos intermedios.
- **Sí** — Primer recorrido físico: Ashfen → Valkeep → Verdelume → Duneshade → Frostholm, con regreso por el mismo camino.
- **Sí** — Paso de montaña en Ashfen y túnel en Frostholm quedan cerrados como promesa de un atajo físico futuro entre los extremos.
- **Sí / prototipo medible** — Cada ciudad tiene stock, pedido, precio y calor propios. Comprar consume stock y sube 2 calor; vender consume pedido, da reputación y sube 6 calor; otros mercados se recuperan al viajar.
- **Sí / prototipo** — Caballo, arquera escolta y fondo falso son preparación, no combate del protagonista. Cambian capacidad, velocidad y pérdida de carga.
- **Sí** — El caballo se consigue físicamente en Valkeep, la escolta en Duneshade y el herrero de Ashfen sólo revela el fondo falso con reputación 14.
- **Sí** — Después de comprarlo, el caballo acompaña visiblemente al caminante en todas las rutas; dentro de las ciudades no aparece.
- **Sí** — El mercado anuncia `E` comprar y `Q` vender sólo al acercarse; ambas teclas se animan y cada operación tiene confirmación visual en el mundo y en pantalla.
- **Propuesto / no cerrado** — Golfo al sur parte Ashfen de Frostholm. Camino libre 1→2→3→4→5 **en curva** (no pasillo recto). Valkeep es pueblo de montaña; Verdelume es selva. Atajos posteriores: barco 1↔5 y montañas 1↔3. En código: `src/routes.js` + puertas en rumbo.

## 2026-09-19

- **Sí / corrección de Leo** — Rutas cortas: un solo recodo (~5 s), evento a mitad y llegada. Mundo de ruta 1040×700. No hay caso en caminos largos donde no pasa nada.
- **Sí / reemplaza 1400×1000** — Pueblos de 1000×700 con cámara a 0.85: se ve casi el pueblo entero. HUD delgado (42 px), aviso de llegada al pie.
- **Sí** — El arte del piso (plaza, camino, agua, transición de bioma) no usa máscaras de geometría: fallan en el navegador de Cursor. Todo es relleno + detalle dibujado.
- **Sí** — Verificación visual siempre contra la pantalla real de Leo (captura de escritorio), no solo Chrome headless.
- **Sí** — Valkeep tiene piso propio `highland` (pasto frío con roca) y pinos; la vegetación de borde de cada pueblo sale de su bioma.
- **Leo** — "Se ve mucho mejor, vas por muy buen camino." Revisa ciudad por ciudad antes de seguir.
- **Sí / reemplaza "elección calzada/monte"** — En las rutas el caminante solo anda por el sendero; no se sale al campo. La zona "monte" con bandidos queda guardada para cuando existan veredas laterales explícitas. Efecto: el asalto ya no sale al azar (sí se puede forzar desde el selector de prueba).
- **Sí** — El agua del golfo (Ashfen, Frostholm) es sólida: muro invisible que sigue la orilla.
- **Sí / pasada nocturna** — Cada pueblo tiene landmark propio además del bioma: riscos y peñascos en Valkeep, palmeras/juncos/cactus en Duneshade, doble fila de selva y enredaderas en Verdelume, banco de hielo, árboles secos y nieve en techos en Frostholm, cerca y heno en Ashfen.
- **Sí** — La plaza es un mercado: puesto principal con toldo a rayas, dos puestos laterales, cuatro faroles, banderines y pozo con agua viva. Más chica (132×92) y con bordillo.
- **Sí** — Detalle de piso por bioma en pueblos y rutas (matas, flores, lajas, charcos, hojarasca, dunas, grietas, montículos, hielo, huellas). Todo dibujado, sin máscaras.
- **Sí** — En ruta, la mezcla de bioma entra por el origen y por el destino; los props siguen al piso. Densidad por bioma: desierto y nieve van pelones.
- **Sí** — La cámara reserva 90 px arriba del mundo (`TOP_PAD`) para que el HUD no tape casas ni portones.
- **Sí** — Luz por bioma (velo suave), sombras de nubes cruzando, viñeta. Verificación en WebGL y en Canvas: se ven iguales.
- **Sí / corrección de Leo** — El caballo y la carreta que iban y venían por el sendero no eran del jugador: era tráfico decorativo que arrancaba en el mismo punto. Se quitó. El caballo propio solo aparece si se compró en Valkeep.
- **Sí / reemplaza 1040×700** — Rutas aún más cortas: mundo 780×520, recodo de ~3 s a 250 px/s. El evento sigue a mitad.
- **Sí** — En el camino se puede volver a la ciudad de origen (andar un poco y regresar al poste de salida). No avanza el mercado. Llegar al final sigue yendo al destino.
- **Sí / reemplaza 780×520** — El campo de la ruta llena la cámara (960×580). El recodo sigue corto; el vacío a la derecha era el mundo más estrecho que la vista.
- **Sí** — El choque de las casas es el muro/puerta, no el sprite entero (tejado y sombra). Se puede pasar detrás.
- **Sí** — Primera versión del retén: interrupt + 3 acciones (`E` revisar, `Q` sobornar, `X` huir). No es combate por turnos. Asalto y confiscación siguen automáticos.
- **Sí / sigue al retén** — Asalto y confiscación usan el mismo interrupt y E/Q/X. Caballo y escolta siguen reduciendo lo que entregás; el fondo falso sigue ocultando 2. No hay combate.
- **Sí / reemplaza HUD 42 px** — Barra más alta y legible: oro, piedras N de M, alerta en 5 estrellas (el calor), fama. Cámara `HUD_PAD` 110.
- **Sí / reemplaza franja opaca** — El HUD no es una barra de borde a borde: chips sueltos, semitransparentes, pegados arriba en una sola fila. Se ve el pueblo detrás.

- **Investigado / no cerrado** — Programar Roblox Studio desde Cursor, Claude Code o Codex **sí existe** y es oficial: MCP built-in + Script Sync (coding harness). Stones no cambia de motor. Un juego Roblox sería otro repo. En esta máquina el bloqueo es Linux: Vinegar 1.9.4 ya está instalado; el MCP oficial no documenta Linux.
- **Investigado / 2026-09-19** — Sirve como acelerador (MVP, scripts, playtest), no como piloto automático. Costo del puente = $0; se paga el LLM (Cursor Pro ~$20). Linux: Vinegar no oficial; `StudioMCP.exe` ya está en el prefix. Dual-boot Windows es el camino estable. Análisis: `studio/sessions/2026-09-19-roblox-analisis.md`.
- **Probado / 2026-09-19** — Wrapper Wine + `~/.cursor/mcp.json` + handshake MCP OK en Linux. Studio 0.739 se actualizó y colgó (hang al startup). `list_roblox_studios` vacío. Falta una sesión de Studio usable. Sesión: `studio/sessions/2026-09-19-roblox-prueba-mcp.md`.
- **Probado / 2026-09-19** — Reinstalación limpia (LIVE + Vulkan): otra 0.739, mismo hang a ~36 s. Forzar 0.732 (la de agosto) también se queda en el splash con D3D11 y con DXVK. No es instalación corrupta. En Linux hoy Studio no arranca.

## 2026-09-23 — rehecho en pixel art

- **Sí / Leo** — Rehacer el juego completo con gráficos nuevos en **pixel art** (480×270, cuadros de 16 px, escala entera), mejor interfaz y encuentros en el mapa estilo Zelda en vez de eventos que aparecen una vez. Leo: "hazlo tú".
- **Sí / reemplaza "el protagonista no pelea" y "sin HP"** — El caminante tiene corazones y un bastón: golpea, rueda, corre y se esconde. Todo en tiempo real, sin turnos ni pantalla de batalla.
- **Sí / reemplaza "rutas cortas ~3 s" (2026-09-19)** — Rutas largas tipo Pokémon (Ruta 1 = 36×100 cuadros) pero sin tramos vacíos: ramales, pasto alto, enemigos, cofres, bordes de salto, reja con palanca que abre un atajo para siempre.
- **Sí** — A quién se le pega: bandidos y animales, sí. A los guardias conviene esquivarlos, esconderse o sobornarlos; si les pegas se vuelven hostiles y el calor se dispara.
- **Sí** — Retén de la Corona físico en la calzada (barrera + guardias + cerco). Alternativa: sendero del bosque por el campamento de bandidos, tapado por arbustos que se cortan. Vuelve la elección calzada/monte, ahora caminable.
- **Sí** — Revisión: dejar revisar (confiscan lo visible, baja el calor) · sobornar (4 + piedras + calor) · media vuelta o empujar y correr.
- **Sí** — Robo de bandido: si te pega con carga, se te cae una piedra al piso; el bandido corre a levantarla y huye. Se recupera si lo alcanzas.
- **Sí** — K.O.: despiertas en el último pueblo, pierdes la mitad de la carga (menos protección) y 20 % del oro. Entrar a un pueblo guarda y cura.
- **Sí** — Controles: J/ESPACIO golpear · K/SHIFT rodar (mantener: correr) · L/C agacharse · E usar · ESC pausa. Control de consola también.
- **Sí** — Arte: todo en código con una paleta maestra (`src/art/palette.js`) y revisión en `lab.html`. Se retiran `src/gfx/` y las escenas `town`/`road`/`play`.
- **Sí** — Muestra primero (Ashfen · Ruta 1 · Valkeep). Verdelume, Duneshade y Frostholm quedan detrás del derrumbe de Valkeep hasta que Leo apruebe el estilo.
- **Se mantiene** — Economía de `state.js` (precios, stock, pedido, calor, fama, mejoras) y música CC0.
- **Pendiente de Leo** — Probar la muestra y decir si sigue el estilo para los otros tres pueblos.

## 2026-09-23 — trailer

- **Sí / Leo** — Skill `trailer-juego` para el framework: abrir el juego, grabarlo, voz TTS, música del juego, HyperFrames. Va también al molde `framework-ia-videojuegos`, solo lo necesario.
- **Sí** — Se graba cuadro a cuadro (`game.step`) en vez de grabar pantalla: sin GPU el navegador va lento y el video sale a tirones.
- **Hecho** — Primer trailer de Stones (34 s, 16:9): `trailer/`, copia en `~/Downloads/stones-trailer.mp4`. Voz es-MX-JorgeNeural; música ashfen → road.

## 2026-09-23 — mundo completo

- **Sí / Leo** — Hacer los tres pueblos que faltaban (Verdelume, Duneshade, Frostholm) con sus rutas (2, 3 y 4) para que la muestra tenga todas las mecánicas. Se quita el derrumbe de Valkeep.
- **Sí / Leo** — "Sistema de guardado" del herrero = **herrajes de alijo** (Oskar, fama 3, 40 oro): los huecos de las rutas se vuelven escondites tipo base secreta de Pokémon, hasta 6 piedras cada uno. Riesgo: redada con calor ≥ 60.
- **Sí** — El caballo sigue (Valkeep). La arquera, que nunca se construyó, ahora existe: **Sahra en Duneshade**, te sigue y dispara a bandidos y bestias.
- **Sí** — Círculo cerrado con la **barca Frostholm ↔ Ashfen** (15 oro). En Ashfen sólo aparece después de conocer a Ceno en Frostholm: la primera vuelta se camina entera.
- **Sí** — Tónicos en Verdelume (Q, 2 corazones, máx. 3) para que el K.O. no sea la única salida en rutas largas.
- **Sí** — Economía ajustada con simulación (`diseno-mundo.md` §3): existencias 8, pedido 6, compra +1 y venta −2 por unidad, calor por venta 5. Con las reglas viejas el caballo no se pagaba.
- **Sí** — Cada ruta enseña algo: aduana y cornisa (2), selva cerrada vs. desierto abierto (3), puerta de la escarcha y lago helado para patinar (4). Enemigos nuevos: lobo y escorpión enterrado.
- **Fuera de la muestra** — Atajo de montaña Ashfen ↔ Verdelume, encargos, música propia de los pueblos nuevos.
