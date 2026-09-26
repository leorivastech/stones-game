/**
 * Música y efectos generados con IA local (ACE-Step 1.5 para música, MOSS-SoundEffect v2 para efectos).
 * Sólo datos: qué archivo suena en cada lugar y para cada efecto. Lo usan `music.js`, `sfx.js` y
 * `escuchar.html` (que marca cuál está elegida).
 *
 * Para cambiar una variante: el número en ELEGIDAS (o STINGERS). Los archivos están en
 * public/assets/music-ia/<zona>-<calma|tension>-<n>.ogg y public/assets/sfx-ia/<nombre>-<n>.ogg.
 * Cómo se eligieron (CLAP): studio/musica/README.md y studio/musica/ia/catalogo.json.
 */

export const MUSIC_DIR = "assets/music-ia/";
export const SFX_DIR = "assets/sfx-ia/";

/** Zona → variante elegida de cada capa. Calma y tensión de una zona van en la misma tonalidad y bpm. */
export const ELEGIDAS = {
  title: { calma: 3 },
  ashfen: { calma: 1, tension: 1 },
  valkeep: { calma: 2, tension: 2 },
  verdelume: { calma: 2, tension: 2 },
  duneshade: { calma: 1, tension: 1 },
  frostholm: { calma: 2, tension: 1 },
  mossgrove: { calma: 1, tension: 2 },
  "ruta-pradera": { calma: 1, tension: 1 },
  "ruta-montana": { calma: 2, tension: 2 },
  "ruta-selva": { calma: 2, tension: 1 },
  "ruta-nieve": { calma: 2, tension: 1 },
  "ruta-desierto": { calma: 1, tension: 2 },
  "refugio-cueva": { calma: 1, tension: 1 },
  "refugio-tierra": { calma: 2, tension: 2 },
};

/** Nombre para mostrar, tonalidad y bpm (vienen del prompt de generación). */
export const ZONAS = {
  title: { nombre: "Título", bpm: 90, tono: "D major" },
  ashfen: { nombre: "Ashfen (pueblo del puerto)", bpm: 96, tono: "G major" },
  valkeep: { nombre: "Valkeep", bpm: 84, tono: "D minor" },
  verdelume: { nombre: "Verdelume (selva)", bpm: 104, tono: "A minor" },
  duneshade: { nombre: "Duneshade (desierto)", bpm: 100, tono: "E minor" },
  frostholm: { nombre: "Frostholm (nieve)", bpm: 72, tono: "F major" },
  mossgrove: { nombre: "Mossgrove", bpm: 80, tono: "E minor" },
  "ruta-pradera": { nombre: "Ruta 1 · pradera", bpm: 110, tono: "G major" },
  "ruta-montana": { nombre: "Ruta 2 · Paso Alto (montaña)", bpm: 104, tono: "D minor" },
  "ruta-selva": { nombre: "Ruta 3 · selva → desierto", bpm: 112, tono: "A minor" },
  "ruta-nieve": { nombre: "Ruta 4 · Paso del Hielo", bpm: 100, tono: "F minor" },
  "ruta-desierto": { nombre: "Ruta 5 · desierto", bpm: 106, tono: "E minor" },
  "refugio-cueva": { nombre: "Refugio · cueva", bpm: 66, tono: "C minor" },
  "refugio-tierra": { nombre: "Refugio · tierra escondida", bpm: 78, tono: "C major" },
};

/** Volumen base de la música (las pistas vienen a -18 LUFS, igual que las de antes). */
export const MUSIC_VOLUME = 0.25;

/**
 * Clave vieja que declaran los mapas (`music: "road"`…) → zona IA. El mapa manda sobre la clave
 * (MAP_ZONA): `road-desert` lo usan Ruta 3 y Ruta 5, y Mossgrove declara "verdelume".
 */
export const CLAVE_ZONA = {
  title: "title",
  ashfen: "ashfen",
  valkeep: "valkeep",
  verdelume: "verdelume",
  duneshade: "duneshade",
  frostholm: "frostholm",
  mossgrove: "mossgrove",
  road: "ruta-pradera",
  "road-mountain": "ruta-montana",
  "road-desert": "ruta-desierto",
  "road-snow": "ruta-nieve",
  refuge: "refugio-cueva",
  "refuge-plot": "refugio-tierra",
};
export const MAP_ZONA = {
  ruta1: "ruta-pradera",
  ruta2: "ruta-montana",
  ruta3: "ruta-selva",
  ruta4: "ruta-nieve",
  ruta5: "ruta-desierto",
  mossgrove: "mossgrove",
};

/** Stingers: nombre → variante elegida (stinger-<nombre>-<n>.ogg, ~6 s; misión 4 s y deuda 5 s). */
export const STINGERS = { llegada: 2, fama: 3, cobrador: 3, redada: 2, ko: 3, amanecer: 3, anochecer: 1, mision: 2, deuda: 1 };
export const STINGER_VOLUME = 0.32;

export const musicUrl = (zona, capa, n) => `${MUSIC_DIR}${zona}-${capa}-${n}.ogg`;
export const stingerUrl = (name, n = STINGERS[name]) => `${MUSIC_DIR}stinger-${name}-${n}.ogg`;
export const sfxUrl = (file) => `${SFX_DIR}${file}.ogg`;

/**
 * Ambientes (clave que declaran los mapas → loop IA de 3-5 s). `vol` ya lleva la corrección de
 * sonoridad (los loops IA vienen a pico -3 dB, ~8 dB más fuertes que los de antes a -26 LUFS) y
 * que suenan dos copias desfasadas para tapar la costura del loop. `noche`: otro loop de noche.
 * `cave`: goteo con eco de 10 s (tanda 2, 26-sep).
 */
export const AMBIENTES = {
  jungle: { file: "aves-bosque-1", vol: 0.12, noche: { file: "grillos-noche-2", vol: 0.14 } },
  desert: { file: "arena-viento-1", vol: 0.19 },
  snow: { file: "nieve-viento-1", vol: 0.13 },
  sea: { file: "agua-orilla-1", vol: 0.14 },
  fire: { file: "fogata-1", vol: 0.45 },
  cave: { file: "cueva-goteo-2", vol: 0.8 }, // goteo escaso: -36.5 LUFS contra -26.6 del de antes
};

/**
 * Efectos: clave que usa el juego → archivos IA (se elige uno al azar). `gain` corrige el volumen
 * que pide el juego (calculado contra la muestra de antes que reemplaza). Todo el audio del juego es IA.
 */
export const SFX_IA = {
  coins: { files: ["moneda-pagar-1", "moneda-pagar-2"] }, // pagar: mejoras, cuotas, deuda, posada
  "coins-sell": { files: ["moneda-vender-1", "moneda-vender-2"] }, // vender
  gem: { files: ["moneda-comprar-1", "moneda-comprar-2"] }, // comprar piedras
  hit: { files: ["golpe-baston-1", "golpe-baston-2"] }, // el bastón le pega a algo
  bump: { files: ["impacto-2"] },
  hurt: { files: ["dano-jugador-1", "dano-jugador-2"] },
  chest: { files: ["cofre-abrir-1", "cofre-abrir-2"] },
  "door-open": { files: ["puerta-madera-2"] },
  horse: { files: ["relincho-1"] },
  horn: { files: ["cuerno-guardia-1", "cuerno-guardia-2"] },
  boar: { files: ["jabali-grunido-1", "jabali-grunido-2"] },
  growl: { files: ["lobo-grunido-1", "lobo-grunido-2"] },
  wolf: { files: ["lobo-grunido-1", "lobo-grunido-2"] },
  scorpion: { files: ["escorpion-1", "escorpion-2"], gain: 1.3 },
  bow: { files: ["flecha-1", "flecha-2"] },
  // Claves nuevas (todavía nadie las llama; listas para conectar).
  bell: { files: ["campana-pueblo-1", "campana-pueblo-2"] },
  scroll: { files: ["pergamino-1", "pergamino-2"] },
  seal: { files: ["sello-1", "sello-2"] },
  shop: { files: ["tienda-abrir-1", "tienda-abrir-2"] },
  gust: { files: ["viento-rafaga-1", "viento-rafaga-2"] },
  // Tanda 2 (26-sep): reemplazan las muestras CC0 de antes, con las mismas claves. `gain`: la mitad de la
  // diferencia de sonoridad contra la muestra vieja (algunas viejas eran casi inaudibles, como `draw`).
  // Descartadas por CLAP o por oído: armadura-moverse-2, flecha-clavar-3, muerte-criatura-3, cerrojo-1,
  // ui-error-2, ui-ok-2, curar-3, saltar-2, rodar-2 (salió muda), recoger-* (las tres con CLAP < 0).
  armor: { files: ["armadura-golpe-1", "armadura-golpe-2", "armadura-moverse-1"], gain: 0.75 },
  "arrow-hit": { files: ["flecha-clavar-1", "flecha-clavar-2"], gain: 1.4 },
  coin: { files: ["moneda-chica-1", "moneda-chica-2", "moneda-chica-3"], gain: 1.6 },
  die: { files: ["muerte-criatura-1", "muerte-criatura-2"], gain: 0.75 },
  lever: { files: ["palanca-2"], gain: 0.5 },
  splash: { files: ["chapuzon-1", "chapuzon-2"], gain: 0.55 },
  swing: { files: ["baston-ligero-1", "baston-ligero-2"] },
  swing2: { files: ["baston-pesado-1", "baston-pesado-2"], gain: 0.75 },
  latch: { files: ["cerrojo-2"], gain: 1.6 },
  sack: { files: ["costal-1", "costal-2"], gain: 0.9 },
  chop: { files: ["hachazo-1", "hachazo-2"], gain: 1.5 },
  draw: { files: ["desenvainar-1", "desenvainar-2"], gain: 0.5 },
  "ui-move": { files: ["ui-mover-1"] },
  "ui-ok": { files: ["ui-ok-1", "ui-ok-3"], gain: 0.9 },
  "ui-error": { files: ["ui-error-1", "ui-error-3"], gain: 0.7 },
  // Los que eran tonos de 8 bits (los toca `tone()` por TONOS, abajo).
  success: { files: ["ui-exito-2", "ui-exito-3"] },
  heal: { files: ["curar-1", "curar-2"] },
  alert: { files: ["alerta-1", "alerta-2", "alerta-3"] },
  suspect: { files: ["sospecha-1", "sospecha-2"] },
  roll: { files: ["rodar-1"] },
  cut: { files: ["cortar-pasto-1", "cortar-pasto-2"] },
  jump: { files: ["saltar-1"] },
  land: { files: ["aterrizar-1", "aterrizar-2"] },
  charge: { files: ["cargar-1", "cargar-2"] },
};

/**
 * Tonos (`tone(scene, nombre)`, antes sintetizados en 8 bits) → [claves de SFX_IA, volumen]. Se elige una
 * al azar con un poco de variación de tono. `text` (el tecleo del diálogo, 18 ms cada 3 letras) sigue
 * sintetizado a propósito: una muestra tan corta y tan seguida suena peor que el blip.
 */
export const TONOS = {
  swing: [["swing", "swing2"], 0.35],
  hit: [["hit"], 0.5],
  bump: [["bump"], 0.5],
  hurt: [["hurt"], 0.5],
  select: [["ui-move"], 0.3],
  confirm: [["ui-ok"], 0.4],
  deny: [["ui-error"], 0.4],
  pickup: [["coin"], 0.35], // como antes: la moneda (las muestras `recoger` salieron mal)
  chest: [["success"], 0.4],
  heart: [["heal"], 0.4],
  alert: [["alert"], 0.4],
  suspect: [["suspect"], 0.3],
  roll: [["roll"], 0.3],
  cut: [["cut"], 0.35],
  jump: [["jump"], 0.25],
  land: [["land"], 0.25],
  charge: [["charge"], 0.35],
};

/** Claves de efecto que ahora son un stinger (se tocan con `stinger()`, que baja la música). */
export const SFX_STINGER = { "jingle-fame": "fama", "jingle-mission": "mision", "jingle-free": "deuda" };

/** Pasos por suelo (la clave que usa `footstep`) → cortes IA; `gain`: el pasto IA sale más fuerte. */
export const PASOS = {
  grass: { files: [5, 6, 7, 8].map((n) => `paso-pasto-${n}`), gain: 0.55 },
  stone: { files: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `paso-piedra-${n}`), gain: 1 },
  wood: { files: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `paso-madera-${n}`), gain: 0.9 },
  sand: { files: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `paso-arena-${n}`), gain: 0.9 },
  snow: { files: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `paso-nieve-${n}`), gain: 0.9 },
};
