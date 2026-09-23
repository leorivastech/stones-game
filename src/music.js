/**
 * Música y ambiente por lugar. El SoundManager persiste entre escenas.
 *
 * - Música: una pista por lugar (cada mapa dice `music`). Se baja la primera vez que suena, así el
 *   arranque no espera a todas. Cambia con fundido cruzado.
 * - Ambiente: una capa suave debajo (viento, selva, cueva…). Cada mapa dice `ambience` (o nada).
 *
 * Para agregar una pista: ponerla en public/assets/music/, sumarla aquí y a CREDITS.md.
 */

// Las pistas de assets/music/ vienen normalizadas a -18 LUFS; créditos en public/assets/CREDITS.md.
export const MUSIC = {
  title: { url: "assets/music/title.ogg", volume: 0.3 },
  ashfen: { url: "assets/proto/music/ashfen-small-fire.ogg", volume: 0.24 },
  valkeep: { url: "assets/proto/music/valkeep-mystical-town.ogg", volume: 0.23 },
  verdelume: { url: "assets/music/verdelume.ogg", volume: 0.26 },
  duneshade: { url: "assets/music/duneshade.ogg", volume: 0.26 },
  frostholm: { url: "assets/music/frostholm.ogg", volume: 0.27 },
  road: { url: "assets/proto/music/road-iremos-forest.ogg", volume: 0.25 },
  "road-mountain": { url: "assets/music/road-mountain.ogg", volume: 0.25 },
  "road-desert": { url: "assets/music/road-desert.ogg", volume: 0.25 },
  "road-snow": { url: "assets/music/road-snow.ogg", volume: 0.26 },
  refuge: { url: "assets/music/refuge.ogg", volume: 0.24 },
  "refuge-plot": { url: "assets/music/refuge-plot.ogg", volume: 0.24 },
  chase: { url: "assets/music/chase.ogg", volume: 0.26 },
};

// Capas de ambiente (a -26 LUFS): van debajo de la música.
export const AMBIENCE = {
  jungle: { url: "assets/ambience/jungle.ogg", volume: 0.5 },
  desert: { url: "assets/ambience/desert.ogg", volume: 0.45 },
  snow: { url: "assets/ambience/snow.ogg", volume: 0.45 },
  cave: { url: "assets/ambience/cave.ogg", volume: 0.55 },
  sea: { url: "assets/ambience/sea.ogg", volume: 0.4 },
  fire: { url: "assets/ambience/fire.ogg", volume: 0.4 },
};

/** El lugar de juego actual (para volver después de una persecución). */
export function currentMusicArea() {
  return currentArea;
}

let currentMusic = null;
let currentArea = null;
let currentAmb = null;
let currentAmbName = null;

export function getCurrentMusic() {
  return currentMusic?.isPlaying ? currentMusic : null;
}

export function musicVolume(key) {
  const area = key?.replace(/^music-/, "");
  return MUSIC[area]?.volume ?? 0.24;
}

/** Carga (si hace falta) y llama `then` cuando el audio está listo. */
function ensureAudio(scene, key, url, then) {
  if (scene.cache.audio.exists(key)) {
    then();
    return;
  }
  scene.load.audio(key, url);
  scene.load.once(`filecomplete-audio-${key}`, then);
  scene.load.once("loaderror", (file) => { if (file.key === key) console.warn(`No cargó ${url}`); });
  scene.load.start();
}

function crossfade(scene, previous, next, volume) {
  next.play();
  scene.tweens.add({ targets: next, volume, duration: 900, ease: "Sine.easeOut" });
  if (previous && previous !== next) {
    scene.tweens.add({ targets: previous, volume: 0, duration: 650, ease: "Sine.easeIn", onComplete: () => previous.stop() });
  }
}

export function startMusic(scene, area) {
  const name = MUSIC[area] ? area : "ashfen";
  const config = MUSIC[name];
  if (currentArea === name && currentMusic?.isPlaying) return;
  currentArea = name;
  const key = `music-${name}`;
  const play = () => {
    if (currentArea !== name) return;
    ensureAudio(scene, key, config.url, () => {
      if (currentArea !== name || (currentMusic?.key === key && currentMusic.isPlaying)) return;
      const previous = currentMusic?.isPlaying ? currentMusic : null;
      let next = scene.sound.get(key);
      if (!next) next = scene.sound.add(key, { loop: true, volume: 0 });
      else next.setVolume(0);
      currentMusic = next;
      crossfade(scene, previous, next, config.volume);
    });
  };
  if (scene.sound.locked) scene.sound.once("unlocked", play);
  else play();
}

/** Capa de ambiente. `name` null o desconocido = silencio. */
export function startAmbience(scene, name) {
  const config = AMBIENCE[name];
  if (currentAmbName === (config ? name : null)) return;
  const previous = currentAmb;
  currentAmbName = config ? name : null;
  currentAmb = null;
  if (previous) scene.tweens.add({ targets: previous, volume: 0, duration: 600, onComplete: () => previous.stop() });
  if (!config) return;
  const key = `amb-${name}`;
  const play = () => ensureAudio(scene, key, config.url, () => {
    if (currentAmbName !== name) return;
    let snd = scene.sound.get(key);
    if (!snd) snd = scene.sound.add(key, { loop: true, volume: 0 });
    snd.setVolume(0);
    snd.play();
    currentAmb = snd;
    scene.tweens.add({ targets: snd, volume: config.volume, duration: 1200 });
  });
  if (scene.sound.locked) scene.sound.once("unlocked", play);
  else play();
}
