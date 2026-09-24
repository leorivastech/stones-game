# Mecánicas — Stones

Estado: **mundo completo y vivo** — 5 pueblos, 4 rutas, barca, 3 refugios, mercado de oferta y
demanda, días, deuda, misiones y sucesos. 2026-09-23. El rumbo y lo pendiente están en
`panorama.md`; los números del mundo, en `diseno-mundo.md`.

## Fantasía jugable

Stones toma de Pokémon la estructura física (pueblo seguro → ruta con identidad → pueblo seguro) y
de Zelda la acción: **los peligros se ven caminando por el mapa** y se resuelven en tiempo real,
sin pantalla de batalla ni turnos. Es un juego **sin final forzoso**: armas tu red de contrabando
en un mundo que cambia día a día. Lo interesante es **prepararse**: qué llevas, a quién llevas,
dónde dejas qué y por qué camino vas.

## Controles

| Acción | Teclado | Control |
|---|---|---|
| Caminar | WASD / flechas | palanca / cruceta |
| Golpear con el bastón (también corta pasto y arbustos) | J / ESPACIO | A |
| Rodar (tocar) · correr (mantener) | K / SHIFT | B |
| Agacharse · esconderse en el pasto alto | L / C | X |
| Hablar · usar · comerciar · entrar | E | Y |
| Beber tónico (2 corazones) | Q | LB |
| Pausa (mapa, carga, encargos, mercados, controles) | ESC / ENTER | Start |
| Bajar un escalón | caminar hacia abajo contra el borde | — |
| Depuración | F1, luego 1-8 (arriba o teclado numérico) | — |

## Jugador

- **Vida en corazones** (empieza con 3). Cada golpe quita medio o un corazón.
- **Golpe**, **rodar** (invulnerable), **correr** (mantener K), **agacharse** (en pasto alto nadie te ve).
- **Animación**: paso de 4 cuadros con rebote y brazos, respira cuando está quieto.
- **K.O.**: despiertas en el último pueblo, pierdes la mitad de la carga (menos lo que salve tu
  gente) y el 20 % del oro.
- **Tónicos** (Verdelume, 12 oro, máx. 3): Q recupera 2 corazones.
- **Hielo**: en el lago helado patinas en línea recta hasta chocar. **La yegua no pisa el hielo.**

## El tiempo: días

- Cruzar una ruta de pueblo a pueblo: **2 días**. Barca: **3 días**. Volver al mismo pueblo: 1 día.
  Dormir en el catre de un refugio: 1 día.
- Cada día los pueblos producen y consumen, el calor baja y el director tira los dados de sucesos.
- El día se ve en el HUD. Al llegar a un pueblo avisa cuántos días pasaron.

## Las piedras

| Piedra | La hace | Le falta a | Valor | Carácter |
|---|---|---|---:|---|
| Ámbar de sello | Ashfen | Valkeep | 14 | **Casi legal**: la Corona no la confisca, cobra 2 de impuesto por piedra |
| Vidrio rúnico | Valkeep | Verdelume | 22 | **Frágil**: cada golpe que recibes tiene 30 % de romper una |
| Perla de lluvia | Verdelume | Duneshade | 30 | **Pesada**: ocupa 2 lugares de carga |
| Piedra solar | Duneshade | Frostholm | 36 | **Vigilada**: confiscarla sube 8 de calor por piedra; el soborno cuesta más; vender sube 7 de calor |
| Cristal de escarcha | Frostholm | Ashfen | 44 | **Se derrite**: pierde 9 % de frío por día (3 % con hielera; la mitad por la Ruta 4); se paga en proporción; en 0 es agua |

## Mercado (oferta y demanda)

- **Todos los pueblos compran y venden las 5 piedras.** Cada uno produce mucho de la suya (sobra,
  barata), consume mucho de la que le falta (cara) y poco de las demás.
- El precio sale de **lo que hay contra lo que el pueblo quiere tener**. Comprar vacía, vender
  llena; lo que vendes baja el precio para la siguiente.
- **La Corona** vende a 1,6 × el valor. Un pueblo te paga como mucho el 90 % de eso: por eso te
  compran a ti. El precio de la Corona se ve en la ventana.
- El pueblo te vende 15 % más caro de lo que te compra. El calor del pueblo encarece y paga menos.
- Ventana: 5 filas (llevas · comprar · vender · Corona · hay). ←→ comprar o vender, ↑↓ piedra.
  "Hay" en rojo = falta (la pagan bien), en verde = sobra (barata).
- **Lo que sabes de otros pueblos envejece**: la pausa muestra lo que pagaban "hace N días".
- Simulación: `node studio/sim/mercado.mjs`. Ir en el sentido del círculo gana más; el contrario
  también deja. El caballo da ~35 % más con más calor.

## Deuda con el Gremio

- Empiezas debiendo **500** (la deuda de tu padre). Cada **10 días** un cobrador te para al llegar
  a un pueblo: pagas la cuota (40), todo, o "no tengo" (la deuda sube 25 y vuelve en 5 días).
- Al pagarla toda: "Eres libre". Es la primera meta, no el final.

## Fama y misiones

- La fama **sólo sube con pedidos**. Títulos (las "medallas"): Desconocido 0 · Mensajero 2 ·
  Contrabandista 6 · Mercader de sombra 10 · Leyenda del golfo 16. Abren mejoras.
- **Sin misiones de historia** (quitadas el 23-sep: no se entendía cuándo te las piden ni cuándo
  se pierden). Tomasa sólo da consejos de controles.
- **Pedidos**: los comerciantes piden llevar 2-3 piedras a donde faltan hoy (10 días, +1 fama).
- Se cumplen vendiendo en el pueblo pedido; se cobran al cerrar la tienda o al llegar.

## Sucesos y rumores (`src/director.js`)

- Baraja chica (9): helada en Frostholm, sequía en Duneshade, feria en Verdelume, veta en Valkeep,
  plaga en Ashfen, barco de la Corona, cargamento agarrado en la aduana, redadas en Duneshade,
  tormenta en el Paso. Cada uno cambia producción, consumo o demanda unos días (y a veces el calor).
  Como mucho 2 a la vez.
- **Rumores**: la gente del pueblo los cuenta. Unos dicen más la verdad que otros; los posaderos
  casi siempre. La pausa guarda los últimos que oíste.

## Refugios secretos

Cuartitos privados, como las bases secretas de Pokémon. Se entra caminando.

| Refugio | Dónde | Cómo se consigue | Tiene |
|---|---|---|---|
| Cueva del Paso Alto | Ruta 2, junto a la cornisa | Herrajes de Oskar (fama 2, 40) | estante, mesa |
| Tierra escondida | Ruta 3, en la selva | Aurelio te la vende (fama 3, 80) | estante, mesa, choza, **corral** |
| Cueva del lago | Ruta 4, junto al lago helado | Herrajes de Oskar | estante, mesa; **la escarcha no se derrite** |

- **Estante**: guardar y sacar piedras (6; 12 con estantes). Lo guardado no se pierde en K.O.,
  robos ni revisiones.
- **Mesa de trabajo**: mejoras — estantes (30), catre (20: dormir un día y curarte), corral (40),
  cerrojo reforzado (60: la Corona no lo encuentra).
- **Redada**: al entrar a la ruta con calor ≥ 60, cada refugio sin cerrojo tiene 50 % de ser
  vaciado. Si dejaste a alguien cuidando, espanta a la patrulla.

## Tu gente: se lleva y se deja caminando

- **Yegua** (Nella, Valkeep, fama 3, 90): +2 lugares, 10 % más rápido en rutas, salva piedras.
  **Sahra** (Duneshade, fama 6, 150): dispara a bandidos y bestias a la vista (1 daño, cada 1,3 s).
- Te siguen en **todos** los mapas. Máximo 2 personas y un caballo.
- **Dejarlos**: háblales en un pueblo o refugio.
  - Refugio: "Quédate aquí" (la yegua sólo si hay corral). Se quedan parados adentro.
  - Posada (hay posadero en cada pueblo): 3 oro por día, se paga al recogerla.
  - Establo de Valkeep: la yegua, 2 oro por día.
- **Recogerlos**: vuelve a donde los dejaste (háblales, o al posadero, o a Nella).
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
- **Ruta 4 · Paso del Hielo** (Duneshade ↔ Frostholm): cañón, Puerta de la Escarcha (retén), lago
  helado para patinar (solución: ↓ → ↓ ← ↓ → ↓) y la cueva del lago; bosque nevado con lobos.
- Con más calor hay más patrullas y ven más lejos. Las salidas funcionan en los 4 bordes.

## Pueblos

| Pueblo | Mercado | Servicio | Posada |
|---|---|---|---|
| Ashfen | Brena | Oskar: herrajes de cueva (fama 2) y fondo falso (fama 10); Tomasa (consejos); barca de Ceno tras conocerlo | Marta |
| Valkeep | Maese Ivo | Nella: yegua y establo | Odo |
| Verdelume | Oruba | Ama: tónicos | Iyá |
| Duneshade | Kader | Sahra: arquera | Nasr |
| Frostholm | Hilde (y la hielera, 25) | Ceno: barca a Ashfen | Sigrid |

Entrar a un pueblo **guarda la partida** y cura.

## Sonido

- Cada pueblo, ruta y refugio tiene su música; debajo suena un ambiente (selva, viento, cueva, olas).
  Tabla completa en `studio/musica/README.md`.
- Si un guardia te persigue suena la música de persecución; 3 s después de perderlo vuelve la del lugar.
- Pasos según el suelo (pasto, piedra, madera, arena, nieve). Arco y flecha de Sahra, gruñidos al
  embestir, escorpión al salir de la arena, armadura del guardia al alarmarse, puertas, cofre,
  palanca, gema al comprar y monedas al vender, fanfarrias de encargo, de nuevo título de fama y de
  deuda pagada.

## Interfaz

- **HUD**: corazones · oro · casillas de carga (la perla ocupa dos; las del fondo falso, rayadas)
  · tónicos · ojo de alerta · fama · **día**.
- **Pausa**: MAPA (pueblos, barca) · CARGA (vida, oro, fama con título, tónicos, deuda, carga con
  frío de la escarcha, refugios, mejoras) · ENCARGOS (misiones y lo que se dice) · MERCADOS (lo que
  pagaban y hace cuántos días) · CONTROLES.
- **Mercado**, **estante** y **mesa** con ventanas propias; diálogos y elecciones con nota.

## Pendiente

- Lore completo y tono (falta decidir con Leo).
- Atajo de montaña Ashfen ↔ Verdelume.
- Música propia de Verdelume, Duneshade y Frostholm.
- En línea (ver `panorama.md`).
