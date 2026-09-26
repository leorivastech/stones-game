# Mecánicas — Stones

Estado: **mundo completo y vivo** — 6 pueblos, 5 rutas, barca, 3 refugios, mercado de oferta y
demanda, días, deuda y sucesos. **Las reglas del mercado son provisionales** (Leo, 23-sep: hay que
sentarse a analizarlas y dejarlas claras). 2026-09-23; tanda 4 (26-sep): el tiempo corre en la
ruta, deuda con dientes, sucesos con cuenta atrás, rumores en el mapa, K.O. con castigo; tanda 6
(26-sep): contratos del tablón, mercaderes de a pie, gráfica de precios, opciones de volumen. El rumbo y lo pendiente están en
`panorama.md`; los números del mundo, en `diseno-mundo.md`; el modo en línea, en `online.md`.

## Fantasía jugable

Stones toma de Pokémon la estructura física (pueblo seguro → ruta con identidad → pueblo seguro) y
de Zelda la acción: **los peligros se ven caminando por el mapa** y se resuelven en tiempo real,
sin pantalla de batalla ni turnos. Es un juego **sin final forzoso**: armas tu red de contrabando
en un mundo que cambia día a día. Lo interesante es **prepararse**: qué llevas, a quién llevas,
dónde dejas qué y por qué camino vas.

## Controles

Las teclas van **juntas**, en dos grupos iguales: WASD + **J K L I**, o flechas + **Z X C V**.
Un solo botón de **acción**: con alguien o algo enfrente, hablas o usas; si no, golpeas (23-sep,
pedido de Leo). Las teclas viejas (E, ESPACIO, SHIFT, Q, ENTER) siguen funcionando sin anunciarse.

| Acción | Teclado | Control | Celular |
|---|---|---|---|
| Caminar | WASD / flechas | palanca / cruceta | palanca (dedo en la mitad izquierda) |
| Acción: hablar · usar · comerciar · golpear · elegir en menús | J / Z | A | A |
| Rodar (tocar) · correr (mantener) · salir de menús | K / X | B | B |
| Agacharse · esconderse en el pasto alto | L / C | X | C |
| Beber tónico (2 corazones) | I / V | Y · LB | T |
| Pausa (mapa, carga, fama, mercados, controles) | ESC / P | Start | II |
| Bajar un escalón | caminar hacia abajo contra el borde | — | — |
| Depuración | F1, luego 1-8 (arriba o teclado numérico) | — | — |

**Celular y tableta** (`src/engine/touch.js`): los botones salen solos en pantallas táctiles
(`?touch=1` los fuerza en la compu, `?touch=0` los quita). El juego deja una franja de 100 px a cada
lado para que la palanca y los botones no tapen nada. De pie pide girar el celular. En Android
pasa a pantalla completa al primer toque (iPhone no lo permite desde el navegador).

## Jugador

- **Vida en corazones** (empieza con 3). Cada golpe de jabalí, lobo, escorpión o bandido (y el
  cuchillo) quita **medio corazón**; el del guardia, **uno entero** (`damage` en `src/config.js`,
  en medios corazones).
- **Golpe**, **rodar** (invulnerable), **correr** (mantener K), **agacharse** (en pasto alto nadie te ve).
- **Animación**: paso de 4 cuadros con rebote y brazos, respira cuando está quieto.
- **K.O.** (castigo real, 26-sep): pierdes la mitad de la carga (menos lo que salve tu gente) y el
  20 % del oro, **pasan 12 horas** (fuera de línea), **la yegua se espanta** y se queda en esa ruta
  hasta que vuelvas por ella (al entrar a la ruta se te junta), y despiertas en **tu refugio con
  catre de esa ruta** si tienes uno; si no, en el último pueblo. Si te tumban los matones del Gremio
  no pierdes piedras: ver Deuda.
- **Tónicos** (Verdelume, 12 oro, máx. 3): Q recupera 2 corazones.
- **Hielo**: en el lago helado patinas en línea recta hasta chocar. **La yegua no pisa el hielo.**

## El tiempo: el reloj corre (26-sep)

- **Un día = 4 minutos reales** (0,1 h por segundo; `DAY_SECONDS` en `src/engine/daylight.js`), en
  **todos** los mapas: pueblo, ruta o refugio. Ya no hay días fijos por ruta.
- **A medianoche pasa el día** donde estés: los pueblos producen y consumen, el calor baja, el
  director tira los dados de sucesos, se derrite la escarcha de los alijos y sale el aviso
  "Amanece el día N" (en fila con los demás avisos). Si estás en un pueblo y toca, llega el cobrador.
- **La escarcha de tu carga se derrite hora por hora** (ver Piedras).
- **Letreros de salida**: "Valkeep · ~3 h a pie" (sale del largo de la ruta y el paso; con la
  yegua, un poco menos). Al acercarte: "→ Valkeep, ~3 h a pie · llegas hacia las 14 h".
- **Resultados del viaje**: "VIAJE N", horas de camino, día y hora de llegada, oro, piedras, calor,
  fama y la escarcha que se derritió en el camino.
- **Barca**: salta **3 días** (+72 h, misma hora); el golfo es frío (la escarcha pierde la mitad).
  Se ve el mapa con la barquita cruzando (unos 3 s, A lo adelanta).
- **Dormir** (posada, 8 oro, o catre de refugio): te curas y despiertas **a las 7 del día
  siguiente** (si ya pasó la medianoche, a las 7 de hoy).
- **En línea** el día lo manda el servidor (uno cada 3 min) y nadie lo adelanta: ni viajar, ni
  dormir, ni el K.O.

## Las piedras

| Piedra | La hace | Valor | Carácter |
|---|---|---:|---|
| Ámbar de sello | Ashfen | 14 | **Casi legal**: la Corona no la confisca, cobra 2 de impuesto por piedra |
| Vidrio rúnico | Valkeep | 22 | **Frágil**: cada golpe que recibes tiene 30 % de romper una |
| Perla de lluvia | Verdelume | 30 | **Pesada**: ocupa 2 lugares de carga |
| Piedra solar | Duneshade | 36 | **Vigilada**: confiscarla sube 8 de calor por piedra; el soborno cuesta más; vender sube 7 de calor |
| Cristal de escarcha | Frostholm | 44 | **Se derrite**: pierde 20 % de frío por día, hora por hora (7 % con hielera); la mitad en la Ruta 4, en Frostholm y en la barca; nada en la cueva fría; se paga en proporción; en 0 es agua |

## Mercado (oferta y demanda)

- **Todos los pueblos compran y venden las 5 piedras.** Cada uno produce más de la suya y un poco
  de las demás, y consume de todas.
- **Sin orden fijo** (23-sep, Leo: "que bajen y suban en todos lados, no nomás en el orden"). Ya no
  hay "a cada pueblo le falta la del vecino". Cada pueblo tiene, por piedra, **ganas de comprar** y
  **lo que le llega**, y las dos se mueven solas día con día en todos lados (caminata al azar que
  vuelve poco a poco a lo normal, con saltos de vez en cuando), además de los sucesos. Así cualquier
  piedra puede estar cara o barata en cualquier pueblo. Números en `DRIFT` (`src/economy.js`); se
  guarda con la partida (`drift`).
- Los rumores verdaderos traen noticias del mercado de otros pueblos: "Vengo de Duneshade: allá
  andan buscando perla de lluvia", "En Valkeep les sobra piedra solar: la dan barata".
- El precio sale de **lo que hay contra lo que el pueblo quiere tener**. Comprar vacía, vender
  llena; lo que vendes baja el precio para la siguiente.
- **La Corona** vende a 1,6 × el valor. Un pueblo te paga como mucho el 90 % de eso: por eso te
  compran a ti. El precio de la Corona se ve en la ventana.
- El pueblo te vende 15 % más caro de lo que te compra. El calor del pueblo encarece y paga menos,
  las dos cosas **en proporción** (hasta 25 % con calor 100; antes al comprar sumaba oro fijo y
  castigaba más a las piedras baratas).
- Ventana: 5 filas (llevas · te cobran · te pagan · aquí). ←→ comprar o vender, ↑↓ piedra.
  "Aquí" dice **OCUPAN** (verde: te la pagan bien, con ▲ junto al precio) o **SOBRA** (dorado:
  cómprala barata y llévala). Ocupan = falta o paga ≥ 110 % del valor; sobra = sobra o cuesta ≤ 85 %.
- **Se ve sin abrir la ventana** (23-sep, Leo: "no está claro qué puedes vender"):
  - Al llegar a un pueblo sale el cartel **HOY EN …**: lo tuyo que aquí pagan bien, lo que ocupan
    (con "+fama" si todavía da) y lo que sobra, con sus gemas. Una vez por pueblo y por día.
  - Sobre el comerciante flota una burbuja con la gema que ahí ocupan.
- **Lo que sabes de otros pueblos envejece**: la pausa muestra lo que pagaban "hace N días".
- **Gráfica de precio** (U6, 26-sep): en el mercado, el renglón elegido lleva una mini gráfica
  (30×12 px) con lo que te pagaban los últimos 7 días que viste ese pueblo (el de hoy en oro, se mueve
  mientras vendes) y una flecha contra el precio anterior: ▲ verde si subió 5 % o más, ▼ roja si
  bajó, "-" si igual. Se guarda en `priceLog` (`recordSeen` / `priceHistory` en `src/state.js`).
- **Mercaderes de a pie** (M10, 26-sep): cada día 1 o 2 arrieros simulados (≈1,1 viajes por día)
  compran en un pueblo y venden en uno vecino (o por la barca) la piedra que allá paga al menos 35 %
  más; mueven 2-4 piedras de verdad (vacían donde compran, llenan donde venden). La gente lo cuenta:
  "Ayer un mercader vendió 4 perlas en Valkeep (las compró en Verdelume)" — en los rumores, en la
  pausa (MERCADOS, abajo) y, en línea, en las noticias del servidor. Números en `MERCHANTS`
  (`src/economy.js`); corren dentro de `stepDay`, igual solo y en línea (`server/world.mjs`).
- **Producción y consumo ×3** (26-sep). Con el reloj que corre, un tramo dura ~0,4 días en vez de 2
  y el mercado casi no se reponía entre visitas. Ahora su piedra: produce 5,4 y consume 1,5 al día
  (antes 1,8/0,5); las demás 1,8/2,4 (antes 0,6/0,8). Lo que cada pueblo quiere tener no cambia.
  `PROFILE` en `src/economy.js`.
- Simulación: `node studio/sim/mercado.mjs`. Con el vaivén ya no hay un sentido que gane siempre.
  Desde el 26-sep cuenta un tramo (ruta + pueblo) como 0,4 días y paga al cobrador; imprime la
  **ganancia media por tramo** de 300 corridas (con lo pagado al Gremio):

  | Caso (oro por tramo) | Antes del reloj (ceb3ce7, 2 días/tramo) | Reloj, sin cambios | + mercaderes | + mercaderes y ×3 (hoy) |
  |---|---:|---:|---:|---:|
  | A pie, sentido del círculo | 24,4 | 18,8 | 13,6 | **20,8** |
  | Caballo, sentido del círculo | 27,6 | 21,3 | 14,8 | **23,9** |
  | A pie, contrario | 25,7 | 22,3 | 15,7 | **24,9** |
  | Caballo, contrario | 29,5 | 24,6 | 17,4 | **28,0** |
  | Caballo + hielera | 29,8 | 24,0 | 16,8 | **27,6** |

  Con la cuota de 40 cada 7 días nunca falla; 70-94 % de las corridas quedan libres de deuda hacia
  el día 22-29 (1,5-2 h reales).

## Buhonero de camino

- Idea de Leo (23-sep): encuentro al azar, pero que se vea una personita. Al entrar a una ruta, 35 %
  de que ande un buhonero (una tirada por ruta y por día; si vuelves ese día, sigue ahí con lo que
  le quedó). Se para sobre el camino, lejos de la entrada, de los enemigos, del retén y de las
  salidas, con una moneda encima. Al entrar avisa: "Por aquí anda un buhonero".
- Te **compra** una piedra (casi siempre una que llevas) entre 125 % y 145 % de su valor, hasta 3.
  Te **vende** otra (nunca escarcha) entre 55 % y 70 % de su valor, 2 o 3 piezas. Sin calor ni fama.
- En línea lo decide el servidor: el mismo para todos, en el mismo lugar (el primero que lo ve
  propone el sitio y el servidor lo guarda); al recargar no se vuelve a tirar el dado.
- Números en `PEDDLER` (`src/state.js`); personaje `peddler` en `src/art/actors.js`.

## Deuda con el Gremio (con dientes, 26-sep)

- Empiezas debiendo **500** (la deuda de tu padre). Cada **7 días** (~28 min reales) un cobrador
  te para en el pueblo: pagas la cuota (**40**), todo, "darle lo que traigo" (si no juntas la
  cuota: abona, cuenta como falta, sin intereses) o "no tengo". Números en `DEBT` (`src/state.js`).
- **Faltas seguidas** (`missed`; vuelven a 0 al pagar la cuota completa). Cada falta: vuelve en 4 días.
  - 1ª: +25 y aviso claro: "La próxima vez que no pagues, el Gremio manda a alguien".
  - 2ª: **+10 % de lo que debes** (al menos 25).
  - 3ª y siguientes: +10 % y, en **la siguiente ruta**, te salen **2 matones del Gremio** (embozados
    de morado y oro, 4 golpes cada uno, no roban piedras). Si te tumban: se cobran el **30 % de tu
    oro** (va a la deuda) o, sin oro, **embargan la yegua** (Nella la devuelve por **60** en el
    establo de Valkeep). Si los tumbas tú, se van de vacío. Salen una vez por falta.
- El HUD lo dice: "Cobrador en N días · deuda X · 2 faltas" (en rojo desde 2 faltas o 2 días).
- **Pagar todo → "Mercader libre"**: ceremonia, **+2 de fama** y el cobrador no vuelve nunca.
  Es la primera meta, no el final.

## Fama

- **Sin misiones** (23-sep, Leo: "nomás llegues, vendas y compres y ya"). Tomasa sólo da consejos de
  controles. Los pedidos volvieron el 26-sep como **contratos del tablón** (abajo), opcionales y claros.
- La fama sube **vendiendo lo que un pueblo ocupa** (etiqueta verde OCUPAN): +1, una vez por pueblo
  y por día (`FAME_PER_SALE` y `isWanted` en `src/state.js`). El cartel "HOY EN …" y el mercado
  avisan "+fama" mientras todavía da.
- Un **contrato** cumplido da +2; uno vencido quita 1 (lo único que baja la fama).
- Títulos (las "medallas"): Desconocido 0 · Mensajero 2 · Contrabandista 6 · Mercader de sombra 10
  · Leyenda del golfo 16. Abren mejoras (herrajes 2, caballo 3, arquera 6, fondo falso 10) y la
  compra de algunos refugios.

## Contratos del tablón (M4, 26-sep)

Decisión de Leo: los pedidos vuelven, pero como **cartel claro** (antes no se sabía cuándo te los
pedían, cuánto tiempo había ni cuándo se perdían).

- **Dónde**: en cada pueblo, junto al posadero, hay un **tablón** ("Contratos"; con pliegos si hoy
  queda algo que tomar). El posadero también lo ofrece en su menú. Al abrirlo suena un pergamino.
- **Qué dice cada uno**: "Lleva 3 piedras solares a Frostholm · hasta el día 9 (quedan 3 d)" y
  "Paga 177 oro (1,3× precio) + 2 fama · si fallas: -1 fama".
- **Cuántos**: 2 o 3 por pueblo y día (el mismo tablón todo el día; lo tomado dice TOMADO). Puedes
  llevar **2 a la vez**.
- **Qué piden**: lo que el destino **ocupa hoy** (lo que más paga contra su valor), nunca su propia
  piedra ni escarcha (se derrite: no sería claro). Destinos a 1-3 tramos (la barca cuenta 3), destinos
  y piedras distintos en el mismo tablón. Cantidad: ámbar 3-4, vidrio 2-3, perla 1-2, solar 2-3.
- **Plazo**: un día por tramo + 1 de sobra ("hasta el día N": se puede entregar el día N).
- **Paga**: 1,3 × el precio que pagaba el destino, contado entre 1 y 1,25 veces el valor de la piedra
  (así ni regalado ni loco): ámbar 18-23 c/u, vidrio 29-36, perla 39-49, solar 47-59. +2 de fama.
  Las piedras se las lleva el cliente: no bajan el mercado.
- **HUD**: una línea por contrato, el que vence antes arriba: "Contrato: 2/3 Solar → Frostholm ·
  quedan 2 d" (verde si ya llevas todo, roja el día que vence).
- **Entregar**: al llegar al destino avisa "Contrato: entrégalo en el mercado"; en el mercado hay un
  renglón "Entregar contrato" (el cursor empieza ahí si ya llevas todo). Sello, monedas y cartel
  "CONTRATO CUMPLIDO" con el oro y la fama.
- **Vencer**: si amanece el día N+1 sin entregarlo, sale en la fila de avisos "Contrato vencido: …
  · -1 fama" y se pierde. El día que vence también se avisa.
- **Pausa > CONTRATOS**: los que llevas (plazo, cuánto llevas, pago, castigo) y los últimos cumplidos
  o vencidos.
- En línea: los contratos son de cada quien (no del servidor); el día sí es el del mundo.
- Números en `CONTRACT` (`src/director.js`, que también arma el tablón: `contractOffers`); estado en
  `src/state.js` (`contracts`, `boards`, `contractLog`).

## Sucesos y rumores (`src/director.js`)

- Baraja chica (9): helada en Frostholm, sequía en Duneshade, feria en Verdelume, veta en Valkeep,
  plaga en Ashfen, barco de la Corona, cargamento agarrado en la aduana, redadas en Duneshade,
  tormenta en el Paso. Cada uno cambia producción, consumo o demanda unos días (y a veces el calor).
  Como mucho 2 a la vez.
- Se barajan cada día antes de tirar (antes los del final de la lista tiraban menos por el tope).
- **Cuenta atrás** (26-sep): en la pausa, pestaña MAPA, abajo, "! Helada en Frostholm · quedan 3
  días" y un "!" rojo junto al pueblo en el mapa; en MERCADOS, "!3d" junto al pueblo. Si le pega al
  pueblo donde estás, una línea en el HUD ("Feria en Verdelume · quedan 2 d").
- **Rumores**: la gente del pueblo los cuenta. Unos dicen más la verdad que otros; los posaderos
  casi siempre. La pausa guarda los últimos que oíste.
- **Rumores en el mapa** (26-sep): el que habla de un pueblo pone un "?" dorado junto a él, hasta
  que acabe el suceso (o 4 días). Al llegar a ese pueblo se comprueba: si era falso se **tacha** en
  rojo ("El rumor de aquí era falso"); si era cierto, el "?" se pone verde.

## Refugios secretos

Cuartitos privados, como las bases secretas de Pokémon. Se entra caminando.

| Refugio | Dónde | Cómo se consigue | Tiene |
|---|---|---|---|
| Cueva del Paso Alto | Ruta 2, junto a la cornisa | Herrajes de Oskar (fama 2, 40) | estante, mesa |
| Tierra escondida | Ruta 3, en la selva | Aurelio te la vende (fama 3, 80) | estante, mesa, choza, **corral** |
| Cueva del lago | Ruta 4, junto al lago helado | Herrajes de Oskar | estante, mesa; **la escarcha no se derrite** |

- **Estante**: guardar y sacar piedras (6; 12 con estantes). Lo guardado no se pierde en K.O.,
  robos ni revisiones.
- **Mesa de trabajo**: mejoras — estantes (30), catre (20: dormir hasta las 7 y curarte; y si caes
  K.O. en esa ruta, despiertas aquí), corral (40),
  cerrojo reforzado (60: la Corona no lo encuentra).
- **Redada**: al entrar a la ruta con calor ≥ 60, **cada** refugio sin cerrojo de esa ruta tiene
  50 % de ser vaciado (se revisan todos). Si dejaste a alguien cuidando, espanta a la patrulla.

## Tu gente: se lleva y se deja caminando

- **Yegua** (Nella, Valkeep, fama 3, 90): +2 lugares, 10 % más rápido en rutas, salva piedras.
  **Sahra** (Duneshade, fama 6, 150): dispara a bandidos y bestias a la vista (1 daño, cada 1,3 s).
- Te siguen en **todos** los mapas. Máximo 2 personas y un caballo.
- **Dejarlos**: háblales en un pueblo o refugio.
  - Refugio: "Quédate aquí" (la yegua sólo si hay corral). Se quedan parados adentro.
  - Posada (hay posadero en cada pueblo): 3 oro por día, se paga al recogerla.
  - Establo de Valkeep: la yegua, 2 oro por día.
- **Recogerlos**: vuelve a donde los dejaste (háblales, o al posadero, o a Nella).
- **Yegua espantada** (K.O.): se queda en la ruta donde caíste; al volver a entrar a esa ruta se
  te junta. **Embargada** (matones): Nella la devuelve por 60.
- La yegua **espera afuera** de las cuevas sin corral y **no pisa el hielo**: para cruzar el lago
  hay que dejarla (en la cueva del lago) o ir por el retén.
- Mientras más gente llevas, **los guardias te ven de más lejos** (+20 % por acompañante).
- La barca cobra el doble si llevas la yegua.

## Enemigos (se ven en el mapa)

| Enemigo | Dónde | Comportamiento |
|---|---|---|
| **Jabalí** | pradera, montaña | Te ve, escarba y **embiste en línea recta**; si choca queda aturdido. 2 golpes. |
| **Lobo** | Ruta 2, bosque nevado | Como el jabalí pero ve más lejos, avisa menos y embiste más rápido. |
| **Escorpión** | desierto | **Enterrado**: sale si pasas cerca, persigue lento y pica. |
| **Bandido** | campamentos, pasto alto | Te persigue y se lanza. Si te pega con carga, **se te cae una piedra** y huye con ella. 3 golpes. |
| **Guardia de la Corona** | retenes y patrullas | **Cono de visión**. Con piedras a la vista sospecha (`?`), se alarma (`!`) y te persigue. Si te alcanza → **revisión**. Si le pegas, pelea en serio. |

### Revisión de la Corona

- **Sólo ámbar a la vista**: impuesto de 2 por piedra y pasas (si no pagas, se quedan una).
- Con otras piedras: **dejar revisar** (confiscan lo visible que no es ámbar; el fondo falso
  esconde 2; con solar el calor sube), **sobornar** (`4 + calor/25×2 + piedras sin sello + 2 por
  solar`) o, en el retén, **media vuelta**; en patrulla, **empujar y correr**.

## Rutas

- **Ruta 1 · Calzada del Ámbar** (Ashfen ↔ Valkeep): retén en la calzada o sendero del bosque por
  el campamento; reja con palanca (atajo para siempre); bordes de salto; cofre con corazón extra.
- **Ruta 2 · Paso Alto** (Valkeep ↔ Verdelume): aduana; cornisa del oeste con la cueva-refugio;
  vereda del este tapada; lobos; río.
- **Ruta 3 · Selva del Tránsito** (Verdelume ↔ Duneshade): selva cerrada con campamento y la
  tierra escondida de Aurelio; luego desierto abierto con escorpiones y oasis.
- **Ruta 5 · Cañón del Musgo** (Duneshade ↔ Mossgrove): cañón del desierto con escorpiones y
  emboscada; la arena se vuelve grava y musgo; bosque cerrado con jabalíes, un lobo, pasto alto y un
  cofre escondido tras arbustos.
- **Ruta 4 · Paso del Hielo** (Mossgrove ↔ Frostholm): bosque con jabalíes que se vuelve nieve,
  Puerta de la Escarcha (retén), lago helado para patinar (solución: ↓ → ↓ ← ↓ → ↓) y la cueva del
  lago; bosque nevado con lobos. (Hasta el 23-sep empezaba en el desierto.)
- Con más calor hay más patrullas y ven más lejos. Las salidas funcionan en los 4 bordes.

## Pueblos

| Pueblo | Mercado | Servicio | Posada |
|---|---|---|---|
| Ashfen | Brena | Oskar: herrajes de cueva (fama 2) y fondo falso (fama 10); Tomasa (consejos); barca de Ceno tras conocerlo | Marta |
| Valkeep | Maese Ivo | Nella: yegua y establo | Odo |
| Verdelume | Oruba | Ama: tónicos | Iyá |
| Duneshade | Kader | Sahra: arquera | Nasr |
| Mossgrove | Ilse (sin piedra propia: compra y vende de todo) | — | Rowan |
| Frostholm | Hilde (y la hielera, 25) | Ceno: barca a Ashfen | Sigrid |

Entrar a un pueblo **guarda la partida** y cura.

## Sonido

- Cada pueblo, ruta y refugio tiene su música; debajo suena un ambiente (selva, viento, cueva, olas).
  Tabla completa en `studio/musica/README.md`.
- Si un guardia te persigue suena la música de persecución; 3 s después de perderlo vuelve la del lugar.
- Pasos según el suelo (pasto, piedra, madera, arena, nieve). Arco y flecha de Sahra, gruñidos al
  embestir, escorpión al salir de la arena, armadura del guardia al alarmarse, puertas, cofre,
  palanca, gema al comprar y monedas al vender, fanfarrias de fama, de nuevo título de fama y de
  deuda pagada.
- **Stingers** (26-sep, conectados): llegada (al llegar a un pueblo tras la ruta o la barca, y
  detrás la campana del pueblo, suave), cobrador, redada (la Corona vacía un refugio), K.O., fama,
  amanecer y anochecer. Tienda al abrir el mercado; pergamino al abrir el tablón; sello al entregar un
  contrato; ráfagas de viento de vez en cuando en el Paso Alto y el Paso del Hielo (máx. una cada
  12 s); el cuchillo del bandido suena con la flecha.
- **Volumen** (pausa > OPCIONES): música, ambiente y efectos de 10 en 10 %; se guarda en el aparato.

## Interfaz

- **HUD**: corazones · oro · casillas de carga (la perla ocupa dos; las del fondo falso, rayadas)
  · tónicos · ojo de alerta · fama · **día** con sol/luna · objetivo (cobrador, faltas, dónde
  ocupan algo, suceso del pueblo).
- **HUD**, además: una línea por contrato que llevas (ver Contratos). El cartel "HOY EN …" se pone
  debajo de esas líneas.
- **Pausa**: MAPA (pueblos, barca, sucesos con cuenta atrás, rumores marcados) · CARGA (vida, oro, fama con título, tónicos, deuda, carga con
  frío de la escarcha, refugios, mejoras) · FAMA (título, cómo sube y lo que se dice) · MERCADOS (lo que
  pagaban y hace cuántos días; abajo, el último mercader) · **CONTRATOS** · CONTROLES · **OPCIONES**
  (volumen de música, ambiente y efectos con ←→ en pasos de 10 %, y "Salir al título", que guarda; ↓
  entra a las opciones, ↑ o K vuelve a las pestañas).
- **Mercado**, **estante** y **mesa** con ventanas propias; diálogos y elecciones con nota.

## Pendiente

- Lore completo y tono (falta decidir con Leo).
- Atajo de montaña Ashfen ↔ Verdelume.
- Música propia de Verdelume, Duneshade y Frostholm.
- En línea (ver `panorama.md`).
