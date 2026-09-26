# Stones: de prototipo a juego pro — análisis a fondo (2026-09-25)

Pedido de Leo: "no un juego nuevo; mejoras impresionantes en gráficos, animaciones, UI/UX, mecánicas y
música (con IA local, tenemos 3070)". Este documento es el diagnóstico completo y el plan. Nada de esto
está construido todavía. Capturas de referencia en `studio/analisis-2026-09-25/`.

Rama analizada: `online` (ce2c8e7), Phaser 4.2.1, 480×270, arte 100 % en código.

## Resumen en diez líneas

1. **El arte base es bueno.** Casas con volumen, árboles, personajes 16×24, yegua de 12 cuadros. No es
   el dibujo lo que lo hace ver "de prototipo".
2. Lo que lo delata: **luz plana** (nada emite luz, no hay noche, no hay sombras largas), **todo
   estático** (agua, nieve, árboles, pasto, banderas quietos), **plazas idénticas** copiadas en los seis
   pueblos (adoquín gris con musgo hasta en la nieve), **rutas vacías** con árboles clonados, y **cero
   vida ambiental** (sin partículas, sin nubes, sin pájaros, sin viento).
3. Animación: 3 dibujos de piernas para caminar, ataque sin pose, K.O. es el sprite girado 90°,
   enemigos solo de lado (al subir/bajar se deslizan).
4. UI: el mercado es lo mejor; el resto se abre y cierra en seco, la llegada a un pueblo amontona 4-5
   avisos en 3 s, y el cartel "HOY EN" sale **debajo** del diálogo de intro y caduca sin leerse.
5. Onboarding: 7 páginas de lore antes de mover un dedo; nadie te dice "ve al mercado / la salida está
   al norte".
6. Mecánicas: **el tiempo no corre en la ruta**, el combate es plano (1 daño, sin hitstop, patrón fijo
   380/190/520 ms que se aprende en 10 s), la deuda no tiene dientes, la fama no cambia el mundo.
7. Doce bugs concretos encontrados en código (sección 7).
8. Música: pistas CC0/CC-BY de terceros, sin transiciones adaptativas; SFX sintetizados de 8 bits.
   Sí se puede hacer música y efectos propios con IA local en la 3070 (sección 6).
9. Plan en 5 tandas; las dos primeras (luz + vida + juice) cambian la percepción del juego con
   esfuerzo chico/mediano y sin tocar ni una paleta.
10. Ocho decisiones que necesito de Leo (sección 9) antes de arrancar.

---

## 1. Lo que vi (capturas)

| Captura | Qué se ve | Qué delata |
|---|---|---|
| Título | Ashfen de fondo, logo STONES, "Nueva partida" suelto | Menú sin panel ni jerarquía; logo plano sin brillo; sin opciones/volumen |
| Ashfen | Plaza, casas, NPC quietos | Sin sombras de casas/árboles; HUD de corazones/gemas tosco; NPC como estatuas |
| Frostholm | Misma plaza gris con musgo verde; playa de arena en pueblo de nieve | Copiar-pegar entre pueblos; el bioma no cambia el pueblo |
| Ruta 1 | Verde enorme, 8 árboles clonados, 2 rocas, cornisas de 1 línea | Vacío; sin capa de detalle; sin profundidad |
| Ruta 4 (nieve) | Nieve blanca con puntitos, pinos en bloque | Sin nieve cayendo, sin huellas, sin viento |
| Refugio | Cueva de piedra, mesa, estante | Sin luz de farol; negro plano alrededor |
| Mercado | Tabla clara con OCUPAN/SOBRA | Bien; falta historial de precios y comprar varios |
| Pausa | 5 pestañas, mapa en pergamino | Aparece en seco; texto largo; sin volumen ni salir |
| Celular acostado | Franjas negras a los lados | Zoom fraccionario (píxeles desiguales) |

---

## 2. Gráficos

### Cómo está hecho (para entender qué se puede tocar)

- 480×270, tiles de 16 px, zoom entero en compu; **fraccionario en celular** (`main.js:26`) → píxeles
  desparejos.
- Paleta en `art/palette.js` (17 rampas, ~95 colores). Bien pensada.
- ~190 texturas generadas al arrancar (`art/index.js:310-463`), subidas una por una sin atlas.
- El suelo de cada mapa se pinta **píxel a píxel en un solo canvas** (`terrain.js:34-132`): por eso el
  agua y el pasto no pueden animarse hoy.
- Profundidad por `y`; sombras = un blob bajo cada cosa. Cámara sin zoom dinámico, sin luces, sin
  partículas de Phaser, sin postFX.

### Lo que falla (con archivo:línea)

1. **Sin luz ni noche.** Única "luz": rectángulo negro al 30 % en cuevas (`world.js:124`). Faroles,
   fogatas, fraguas y ventanas encendidas no emiten nada.
2. **Agua muerta**, horneada en el suelo (`terrain.js:244-254`); solo un brillo suelto.
3. **Frontera de bioma recta**: el terreno se ondula pero la paleta cambia en el borde exacto del tile
   (`terrain.js:79,85`). Contradice `studio/art.md`.
4. **Sin sombras proyectadas** de árboles ni casas (`props.js:34` solo blob).
5. **Sin partículas ni ambiente**: nieve, arena, hojas, luciérnagas, polvo al correr.
6. **Sin parallax**: ni nubes ni cielo; el suelo grande (576×1600 en rutas) se ve monótono.
7. **Plazas copiadas** entre pueblos; el adoquín lleva musgo verde también en Frostholm.
8. **Contorno igual en todo**: 1 px negro completo; sin lado iluminado.
9. Cono del guardia con `Graphics` y alpha (`enemies.js:538-560`): único vector, desentona.
10. Casas: techo plano sin caballete, humo no determinista, sin variación de tinte.
11. Texto sobre el mundo con sombra pero sin contorno (`title.js:75`, toasts).

### Qué hacer (en código, mismo enfoque; sin generadores de imágenes)

| # | Mejora | Esfuerzo | Impacto | Dónde |
|---|---|---|---|---|
| G1 | **Ciclo día/noche + luces**: velo `MULTIPLY` con color por hora + sprites de luz radial `ADD` en farol/fogata/ventanas/fragua. Funciona en Canvas y WebGL | mediano | 5 | nuevo `engine/daylight.js`; `mapbuild.js:190-210` |
| G2 | **Partículas por bioma**: nieve, arena, hojas/polen, luciérnagas de noche, chispas de fogata, polvo al correr | chico | 4 | nuevo `engine/ambient.js`; `player.js` |
| G3 | **Sombras proyectadas** de árboles y casas (silueta alargada, α 70) orientadas por hora | chico | 4 | `mapbuild.js:86-91`, `art/fx.js` |
| G4 | **Agua animada**: agua a hoja de 3-4 cuadros como sprites sobre el suelo; espuma que late | mediano | 4 | `terrain.js:244`, `mapbuild.js:171` |
| G5 | **Plazas distintas por pueblo**: adoquín sin musgo en nieve, arena apisonada en Duneshade, tablones en Verdelume, piedra oscura en Valkeep | chico | 4 | `terrain.js:228`, mapas de pueblo |
| G6 | **Rutas con capa de detalle**: 3-4 variantes más de árbol por bioma con tinte, tocones, hongos, charcos, huellas, ruinas, cruces de camino; densidad ×2 | mediano | 4 | `props.js`, `biomes.js`, `mapbuild.js:33-39` |
| G7 | **Sombras de nubes** deslizándose (parallax barato) | chico | 3 | `art/fx.js`, `world.js` |
| G8 | **Vaivén**: copas de árboles y pasto alto con 2º cuadro y delay aleatorio; banderas y toldos | chico | 3 | `props.js:51,115`, `mapbuild.js:107-148` |
| G9 | **Frontera de bioma ondulada** + dither de 8 px | chico | 3 | `terrain.js` |
| G10 | **Contorno selectivo** (arriba-izquierda tono medio, abajo-derecha tinta) | chico | 2 | `props.js:38-47`, `pixel.js:128` |
| G11 | **Cono del guardia en píxel** con Bayer | chico | 2 | `enemies.js:538` |
| G12 | **PostFX sutil** solo WebGL (viñeta + bloom leve en luces) | mediano | 2 | `world.js`, `art/ui.js` |
| G13 | **Zoom entero en celular** con franjas | chico | 2 | `main.js:20-28` |
| G14 | **Atlas único** de texturas (rendimiento) | mediano | 2 | `boot.js:20-26` |

Orden: G1 → G2 → G3 → G5 → G4 → G6 → G7/G8 → resto. Los cuatro primeros cambian la percepción del
juego sin tocar una paleta.

---

## 3. Animaciones

### Lo que hay

- Personajes: 3 vistas × 8 poses = 24 cuadros (`actors.js:584-599`); caminar con 3 dibujos de piernas
  (`actors.js:330-344`) + rebote de 1 px; brazos = mover píxeles de piel 1 px.
- Ataque: **sin pose** (solo el sprite del barrido, `player.js:257`). K.O. = idle rotado 90°
  (`actors.js:640`).
- Rodar: 4 rotaciones. Enemigos: solo vista lateral, 2 cuadros de paso → al moverse en vertical se
  deslizan. Yegua: 12 cuadros, la mejor.
- Nada ambiental se mueve salvo fogata, fragua y humo.
- Golpe: shake 50 ms + tint blanco 120 ms. Recibir daño: flash 140 ms + shake 90 ms.

### Qué hacer

| # | Mejora | Esfuerzo | Impacto | Dónde |
|---|---|---|---|---|
| A1 | **Hitstop + knockback proporcional + parpadeo** (60-90 ms de congelado al pegar; ya lo pide mecánicas M1) | chico | 5 | `world.js:622-646`, `player.js:318`, `enemies.js:95-121` |
| A2 | **Squash & stretch**: aterrizar/rodar (1.15, 0.85), saltar (0.9, 1.1) | chico | 3 | `player.js` |
| A3 | **Pose de ataque real** (brazo extendido, cuerpo inclinado) y **K.O. dibujado tumbado** | mediano | 3 | `actors.js:561-573` |
| A4 | **6 cuadros de paso** (2 piernas más) y **vistas arriba/abajo de enemigos** | mediano | 3 | `actors.js:330`, `creatures.js` |
| A5 | **NPC vivos**: los aldeanos caminan entre 2-3 puntos, se paran, miran; el herrero martilla; el comerciante acomoda | mediano | 4 | `world.js` (NPC), `actors.js` |
| A6 | **Transiciones de mapa tipo iris** (círculo sobre el jugador, 300 ms) en vez de fundido plano | mediano | 3 | `world.js:1624,1740` |
| A7 | **Cierres animados de menús** (escala 0.96 + alpha 100 ms) con un helper único | chico | 3 | `ui.js:377,474,611,685,950` |
| A8 | **Vibración al recibir daño** en celular (`navigator.vibrate(30)`) | chico | 2 | `player.js:318`, `touch.js` |

---

## 4. UI/UX y momentos

Mapa de los 24 momentos con calidad (de 5): título 4 · intro 3 · llegada 4 · HOY EN 4 · acción 4 ·
hablar 3.5 · **mercado 4** · posada 3 · herrero 3.5 · salir de ruta 3.5 · caminar/golpear 4 · retén 4 ·
patrulla 4 · asalto 4 · buhonero 3.5 · cofre 4 · **reja 5** (pan de cámara: el modelo a seguir) ·
refugio 3.5 · **barca 5** · cobrador 3.5 · fama 3 · pausa 3.5 · K.O. 3.5 · en línea 3.5.

### Lo que falla

1. **Avalancha al llegar** (`world.js:141-153`): cartel de lugar (0-2.7 s) + toast de días (0.7 s) +
   escarcha (1.2 s) + cobrador (modal) + HOY EN (7 s); la primera vez, encima la intro de 7 páginas.
   HOY EN sale debajo del diálogo (depth D+4 vs D+10) y caduca sin leerse.
2. **Cortes secos**: diálogos, opciones, mercado, estante y pausa se destruyen sin animación; "media
   vuelta" en el retén te **teletransporta 30 px** (`world.js:972`).
3. **Sin onboarding**: intro = lore; los controles llegan por toasts de 2.2 s en la primera ruta. Nadie
   dice "ve al mercado" ni "la salida está al norte". **Sin indicador de objetivo** (deuda solo en pausa).
4. **Feedback incompleto**: el oro no cuenta, no hay monedas volando al vender, sin vibración al daño.
5. `choose` no muestra las teclas (`ui.js:416-443`); mercado y estante sí.
6. Texto largo en pantalla chica (pausa > MERCADOS y FAMA: 3-4 líneas de párrafo).
7. En línea: dos estilos (HUD pixel vs. HTML Pixelify con emoji); la barra puede chocar con el cartel
   de lugar.
8. Tono: el NPC dice cosas de sistema entre paréntesis "(Necesitas fama 2…)".
9. No existe: dormir en la posada, pantalla de resultados del viaje, historial de precios, opciones.

### Qué hacer

| # | Mejora | Esfuerzo | Impacto | Dónde |
|---|---|---|---|---|
| U1 | **Cola de avisos al llegar** (cartel → días → cobrador → HOY EN, uno tras otro); en la primera partida, intro **antes** del fundido | chico | 5 | `world.js:141-153`, `ui.js:172` |
| U2 | **Tutorial de 60 s**: 4 pasos guiados con flecha ("habla con Brena", "vende", "sal al norte") en vez de 7 páginas de lore | mediano | 5 | `world.js:34-42`, `ui.js` |
| U3 | **Objetivo en HUD**: "Cobrador en 3 días · deuda 420" y "Ocupan ámbar en Valkeep" | chico | 4 | `ui.js:47-129` |
| U4 | **Juice de dinero**: oro que cuenta, monedas que vuelan al HUD, flash dorado | chico | 4 | `ui.js:86-91,584-601` |
| U5 | **Retratos en diálogo** (recorte 24×24 del cast del NPC; el arte ya existe) | mediano | 4 | `ui.js:347-371` |
| U6 | **Gráfica de precio** en mercado: 7 días por piedra + flecha de tendencia | mediano | 4 | `ui.js:539-562`, `state.js` |
| U7 | **Salidas señaladas**: letrero con destino y flecha; toast "→ Valkeep, 2 días" | mediano | 4 | `world.js:1728-1747`, mapas |
| U8 | **Pantalla de resultados** al llegar tras ruta: días, oro, piedras, calor, fama | mediano | 4 | `world.js:1125-1136` |
| U9 | **Teclas en `choose`**, comprar de a varios (mantener J) | chico | 3 | `ui.js:416-443,564-604` |
| U10 | **Título con panel**, logo con brillo, opciones (volumen, borrar partida, salir) | mediano | 3 | `title.js`, `ui.js:715-727` |
| U11 | **Fama con ceremonia**: panel 2 s "Nuevo título" con lo que desbloquea | chico | 3 | `ui.js:593-596` |
| U12 | **Cobrador visible** (sprite que llega con pan de cámara, como la reja) | mediano | 3 | `world.js:1263` |
| U13 | **Dormir en la posada** (1 día, cura, cobra) | chico | 3 | `world.js:1470-1491` |
| U14 | **HUD en línea unificado** (misma fuente, mensajes cortos) | mediano | 2 | `hud.js` |

---

## 5. Mecánicas y funciones

### Cómo funciona hoy (números reales)

- **Precio** = `v · ((objetivo+1)/(existencia+1))^0.6`, piso 0.35v, techo Corona 1.6v; venta ≤ 0.9×Corona;
  compra = mid × 1.15 (`economy.js:142-151`). Calor resta hasta 25 % a lo que te pagan.
- **Deuda** 500, cuota 40 cada 10 días, mora +25 y vuelve en 5 (`state.js:63,676-694`). Simulación
  (`studio/sim/mercado.mjs`): 40 → 430-660 oro en 34 días jugando bien; la deuda se paga en ~30-35 días.
- **Fama** +1 por vender lo que "ocupan", una vez por pueblo y día; títulos a 2/6/10/16. Nunca baja.
- **Director**: 9 sucesos, 3-5 %/día, máx. 2 activos; ≈32 % de que empiece uno cada día.
- **Enemigos** (`config.js:398-405`): jabalí hp 2, lobo hp 2, escorpión hp 2, bandido hp 3, guardia
  hp 5. Jugador: 1 daño por golpe siempre; roll con i-frames 280 ms y enfriamiento 330 ms.
- **K.O.**: pierdes ceil(piedras/2) − protección y 20 % del oro; despiertas curado en el último pueblo.
- **Tiempo**: ruta 2 días, barca 3, catre 1; **los días pasan solo al entrar a un pueblo**
  (`world.js:84-87`).
- **En línea**: servidor manda en mercado, reloj (día cada 180 s), dueños, estantes, buhonero; el primer
  jugador en el mapa corre la IA de enemigos (10 snapshots/s).

### Lo que falla

1. **El tiempo no corre en la ruta**: puedes pelear o esperar horas sin coste; escarcha y deuda no
   aprietan mientras juegas.
2. **Combate plano**: 1 daño, sin hitstop, knockback fijo; guardia hp 5 con patrón 420/180/600 ms se
   aprende en 10 s.
3. **IA predecible**: todos los humanoides usan la misma cadena windup→lunge→recover con tiempos fijos;
   nadie flanquea ni coordina. Escorpión persigue a 30 px/s: más lento que agacharse (40).
4. **Sin dificultad creciente**: la fama no cambia nada del mundo.
5. **Economía sin emergencia**: nadie más comercia; vender 6 iguales ya satura (tope 24, objetivo 6).
6. **Deuda sin dientes**: "no tengo" cuesta 25 y se puede ignorar para siempre; `missed` no lo lee nadie.
7. **Muerte suave**: con yegua + Sahra y 2 piedras, pierdes 0.
8. **Sigilo gratis**: pasto alto = invisible total (`enemies.js:516`); sin stamina ni ruido.
9. **Sucesos invisibles**: `m.days` existe pero no hay countdown ni marca en el mapa.
10. **Cofres únicos**: 170 oro + 1 corazón en todo el mundo; luego las rutas no dan nada que explorar.
11. **Buhonero domina**: paga 125-145 % garantizado vs. tope 144 % de pueblo.

### Qué hacer (sin hacerlo otro juego)

| # | Mejora | Esfuerzo | Impacto | Dónde |
|---|---|---|---|---|
| M1 | **Juice de combate**: hitstop 60-90 ms, knockback proporcional, parpadeo 3 cuadros, i-frames solo en roll (bajar invuln 1000→600) | chico | 5 | `player.js:318-332`, `enemies.js:95-121`, `world.js:622` |
| M2 | **El tiempo corre en la ruta**: un día cada X min reales; derrite escarcha y acerca al cobrador; visible en HUD | mediano | 5 | `world.js:84-87`, `state.passDays`, `ui.js` |
| M3 | **Enemigos con patrones** (2-3 por tipo; bandido finta/lanza cuchillo; guardia con escudo de frente, hay que rodear) y tiempos ±25 % | mediano | 5 | `enemies.js:343-490,567-704` |
| M4 | **Contratos opcionales claros** en la posada: "lleva 3 solar a Frostholm antes del día N, paga 1.3× + fama 2", con contador y fallo explícito (vuelven los pedidos, pero como cartel, no como sorpresa) | mediano | 5 | `state.js`, `ui.js`, `director.js` |
| M5 | **Stamina** para correr y rodar (barra corta, 3 s) | chico | 4 | `player.js:137-193`, HUD |
| M6 | **Día/noche que cambia el juego**: de noche guardias ven ×0.7, bandidos ×1.4, mercado cerrado (va con G1) | mediano | 4 | `world.js`, `enemies.sightRange`, `config.ENEMY` |
| M7 | **Curva por fama**: más calor efectivo y hp de bandidos por título; a cambio −5 % en compras | chico | 4 | `world.js:279`, `state.heatLevel`, `economy.quote` |
| M8 | **Deuda con consecuencias**: 3 fallos → matones del Gremio en la ruta y embargo de la yegua; pagar todo = "mercader libre" | mediano | 4 | `state.js:688`, `world.js:1263` |
| M9 | **Eventos con countdown** en HUD/pausa y marca en el mapa | chico | 4 | `director.js`, `ui.js` |
| M10 | **Mercaderes NPC** (1-2 por día mueven el mercado; "ayer alguien vendió 4 perlas aquí") | mediano | 4 | `economy.stepDay`, `world.mjs:nextDay` |
| M11 | **Mejoras de yegua/carreta** (alforjas, herraduras, carreta que no entra a senderos) | mediano | 4 | `state.UPGRADES`, `world.setupCrew` |
| M12 | **Ataque cargado** (mantener J 400 ms → 2 daño, empujón) | mediano | 4 | `player.js:248-272` |
| M13 | **Rumores marcados en el mapa** con caducidad (los falsos se tachan al llegar) | chico | 3 | `state.hearRumor`, `ui.js` mapa |
| M14 | **Sigilo con coste**: agacharse reduce (no anula); pasto alto solo si vas lento; guardias marcan última posición | chico | 3 | `enemies.js:512-535` |
| M15 | **K.O. con castigo real**: 1 día por piedra perdida; yegua "asustada" hasta que vuelvas | chico | 3 | `world.js:994-1018` |
| M16 | **Clima por ruta** ligado a sucesos (tormenta cierra retén, helada quita vista) | mediano | 3 | `director.DECK`, `mapbuild` |

---

## 6. Música y sonido

### Lo que hay (calidad 3/5)

- **13 pistas de 12 autores distintos** (OpenGameArt, CC0 y 3 CC-BY que exigen crédito visible en el
  juego; hoy solo está en `CREDITS.md`), normalizadas a −18 LUFS, con crossfade (`music.js:69-75`) y
  ambiente en capa (selva, desierto, nieve, cueva, mar). Tres pueblos siguen con pistas "proto".
  Resultado: mezcla de orquestal + chill + RPG Maker sin identidad.
- **SFX en tres capas** (`sfx.js`): 49 muestras CC0 (Kenney y otros), tonos sintetizados de 8 bits con
  WebAudio (golpe, daño, menú, alerta…), y un puente que prefiere la muestra si existe. Pasos por suelo
  (2 variantes, repetitivo; "arena" es en realidad alfombra).
- **Ducking a saltos** (`setVolume` sin tween, `sfx.js:131-139`), no afecta al ambiente.
- **Persecución = cambiar la pista entera** (`world.js:1696`); sin capas por calor ni por hora.
- 10 muestras cargadas que nunca se usan (`jingle-buy`, `door-close`, `ui-*`, `horse`, `cart`, `click`,
  `knife`). Ruta 3 (desierto) lleva ambiente de selva (`ruta3.js:77`). Sin buses ni volumen del jugador.
- Un solo `coins` para todo el dinero (12 sitios). Sin sonido al abrir tienda, montar, carreta, clima,
  murmullo de mercado.

### Modelos de IA de audio en la máquina (3070, 8 GB; disco al 90 %, 70 GB libres)

Ya instalados y medidos ayer 25-sep (los usa Lumi; `~/Development/lumi/pruebas/2026-09-25/c-audio/`):

| Modelo | Para qué | Licencia | VRAM | Tiempo real en la 3070 | Estado |
|---|---|---|---|---|---|
| **ACE-Step 1.5** | Música: loops instrumentales por ambiente, acepta bpm/tonalidad/duración | **MIT** | 1.7-2 GB (streaming) | 75 s de música en **10-16 s** (25-32 s con LM 0.6B) | **Instalado** (11 GB) + nodo en el ComfyUI de qwen-image-local |
| **MOSS-SoundEffect v2** | Efectos: golpes, monedas, viento, pasos (8/8 en prueba CLAP) | **Apache-2.0** | 2.4 GB INT8 | **63-71 s por efecto** (bf16 con GPU libre ~20-30 s, no medido) | **Instalado** (11 GB) |
| Stable Audio Open | SFX/ambientes | Stability, registro, gated | 6-7 GB | ~30-60 s | No aporta sobre MOSS; no bajar |
| MusicGen, AudioLDM2, Tango | — | **No comercial** | — | — | Descartados |
| DiffRhythm, YuE | Canciones con voz | — | >8 GB | minutos | No aplican (no son loops) |

Todo local, sin llaves de pago. Un modelo a la vez en la GPU y sin el bot de actas cargado (Lumi ya
tiene `POST /api/gpu/liberar`). No bajar nada nuevo sin limpiar disco.

### Qué hacer (tanda 5)

| # | Mejora | Esfuerzo | Impacto | Cómo |
|---|---|---|---|---|
| S1 | **Música propia por zona** con ACE-Step: 6 pueblos + 5 rutas + refugio + título, 3-4 variantes cada una, misma tonalidad y bpm por zona; se eligen en `escuchar.html` como ahora | mediano | 5 | reutilizar `lumi/app/audio_gen/trabajador_musica.py`; ~1 h de GPU para 50 candidatas |
| S2 | **Capas adaptativas**: por zona, una pista "calma" y una "tensión" en la misma tonalidad/bpm; el calor de la ruta y la persecución suben la capa con tween, no cambian la pista | mediano | 4 | `music.js`, `world.js:1692-1700` |
| S3 | **Ducking con tween** y buses (música / ambiente / SFX) con volumen del jugador en pausa | chico | 3 | `sfx.js:131-139`, `ui.js` pausa |
| S4 | **SFX propios con MOSS** para identidad: monedas (comprar/vender/pagar distintos), golpe/impacto, cofre, puerta, tienda, relincho, cuerno, viento a ráfagas, aves; generar de noche en lote (~1 min cada uno) | mediano | 4 | script en `studio/musica/herramientas/` |
| S5 | **Pasos por bioma** (4 variantes por suelo, más nieve/arena reales), pasos de yegua y de enemigos | chico | 3 | `sfx.js`, `world.js:1679-1686` |
| S6 | **Stingers**: llegada a pueblo, título de fama, cobrador, redada, K.O., amanecer/anochecer (va con G1) | chico | 3 | ACE-Step clips de 3-5 s |
| S7 | Limpieza: quitar las 10 muestras muertas, ambiente correcto en Ruta 3, crédito visible de las CC-BY (o reemplazarlas con S1) | chico | 2 | `sfx.js:42-44`, `ruta3.js:77`, título |

---

## 7. Bugs encontrados en código

1. `state.js:682` `payDebt` parcial (menos de 40 por falta de oro) no reprograma `due`: el cobrador
   vuelve en el siguiente pueblo sin subir `missed`.
2. `state.js:359` `moveStashOnline` al deshacer solo revierte la carga, no `online.world.stashes`.
3. `state.js:363` mezcla de frío al sacar escarcha en línea usa `cargo.frost − 1` como cantidad previa.
4. `director.js:286` `break` con 2 activos: los sucesos al final del DECK (aduana, redadas, tormenta)
   tiran menos veces. Falta barajar antes de recorrer.
5. `enemies.js:473` `this.ambush ? "idle" : "idle"`: el bandido de emboscada nunca vuelve a `hidden`;
   emboscada de un solo uso.
6. `enemies.js:96-106` en línea, dos jugadores pegando al mismo títere pueden duplicar daño (la
   autoridad no revisa invuln del origen).
7. `world.js:87` vs `worldnet.js:354` y `world.js:1670`: en línea, dormir en la cueva fría no protege
   la escarcha más que estar afuera.
8. `world.mjs:239` `peddler()` no persiste `spot` hasta el primer `peddlerOp`; dos clientes a la vez
   proponen sitios distintos y gana el primero en silencio.
9. `world.js:1337` `checkRaids` hace `return` en el primer refugio: con 2 en la misma ruta solo se
   evalúa uno.
10. `state.js:804` en línea, al recargar en mitad de ruta se vuelve a tirar el dado del buhonero.
11. `economy.js:151` el calor suma oro plano al comprar (+3) pero descuenta proporcional al vender: castiga
    más a las piedras baratas (ámbar +21 %, escarcha +5 %).
12. `state.js:81` `trips` se incrementa y no se usa. `studio/mechanics.md` dice "golpe quita medio o un
    corazón" y en código jabalí/bandido quitan 1 medio, guardia 2.

---

## 8. Plan por tandas

Cada tanda es una sesión de trabajo cerrada, se prueba con Playwright + a mano, y se documenta.

| Tanda | Qué entra | Esfuerzo total | Qué cambia |
|---|---|---|---|
| **1. Luz y vida** | G1 día/noche + luces, G2 partículas por bioma, G3 sombras proyectadas, G7 nubes, G8 vaivén, G5 plazas por pueblo | mediano | La primera impresión: el mundo respira |
| **2. Juice** | M1/A1 hitstop + knockback, A2 squash, U4 dinero que cuenta y vuela, A7 cierres animados, A8 vibración, U9 teclas en choose, U11 fama con ceremonia | chico | Todo lo que tocas responde |
| **3. Llegar y entender** | U1 cola de avisos, U2 tutorial 60 s, U3 objetivo en HUD, U7 salidas señaladas, U8 resultados del viaje, U5 retratos, U13 posada | mediano | Ya no hay "qué hago ahora" |
| **4. Tensión** | M2 tiempo en ruta, M3 patrones de enemigo, M5 stamina, M6 noche que cambia el juego, M7 curva por fama, M8 deuda con dientes, M9 countdown, bugs §7 | mediano-grande | El juego aprieta y da metas |
| **5. Sonido propio** | Música por bioma/estado generada en local, capas adaptativas (calma/alerta/persecución), SFX propios, pasos por suelo, stingers | mediano | Identidad sonora (sección 6) |
| **6. Profundidad** (después) | M4 contratos, M10 mercaderes NPC, M11 yegua/carreta, M12 ataque cargado, U6 gráfica de precio, G4 agua animada, G6 rutas con detalle, A4/A5 más cuadros y NPC vivos | grande | Horas de juego |

Fuera de este plan, y con razón: cambiar el estilo de arte, motor 3D, modelos generados por IA para
personajes (regla de Leo, 25-sep: arte dibujado en código).

---

## 9. Decisiones que necesito de Leo

1. **Orden de tandas**: ¿1-2-3 como propongo (gráficos primero) o 3 primero (que se entienda) y luego
   gráficos?
2. **Noche**: ¿día/noche visual nada más (tanda 1) o que cambie el juego (mercado cerrado, más
   bandidos; tanda 4)?
3. **Tiempo en ruta** (M2): ¿cuántos minutos reales por día en la ruta? (propuesta: 4 min; en línea
   ya son 3).
4. **Contratos** (M4): los pedidos se quitaron porque "no se entendían". ¿Los traemos de vuelta como
   cartel claro en la posada con contador, o quedan fuera?
5. **Deuda con dientes** (M8): ¿matones y embargo, o algo más suave (solo intereses)?
6. **Tutorial** (U2): ¿reemplaza a las 7 páginas de lore o la intro se queda y el tutorial va después?
7. **Música con IA**: ¿música propia para las 6 zonas + 3 estados, o solo los huecos (ver sección 6)?
   Hay que bajar modelos (GB) y correr en la 3070; nada de llaves de pago.
8. **Rama**: sigo en `online` (tiene todo) y sin mezclar a `master` hasta que digas.
