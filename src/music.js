/** Música global por lugar. El SoundManager persiste entre escenas. */

export const MUSIC = {
  ashfen: { key: "music-ashfen", volume: 0.24 },
  road: { key: "music-road", volume: 0.25 },
  valkeep: { key: "music-valkeep", volume: 0.23 },
};

let currentMusic = null;
let currentArea = null;

export function getCurrentMusic() {
  return currentMusic?.isPlaying ? currentMusic : null;
}

export function musicVolume(key) {
  return Object.values(MUSIC).find((entry) => entry.key === key)?.volume ?? 0.24;
}

export function startMusic(scene, area) {
  const config = MUSIC[area] ?? MUSIC.ashfen;
  if (currentArea === area && currentMusic?.isPlaying) return;

  const play = () => {
    if (currentArea === area && currentMusic?.isPlaying) return;

    const previous = currentMusic?.isPlaying ? currentMusic : null;
    let next = scene.sound.get(config.key);
    if (!next) next = scene.sound.add(config.key, { loop: true, volume: 0 });
    else next.setVolume(0);

    next.play();
    currentMusic = next;
    currentArea = area;

    scene.tweens.add({
      targets: next,
      volume: config.volume,
      duration: 900,
      ease: "Sine.easeOut",
    });

    if (previous && previous !== next) {
      scene.tweens.add({
        targets: previous,
        volume: 0,
        duration: 650,
        ease: "Sine.easeIn",
        onComplete: () => previous.stop(),
      });
    }
  };

  if (scene.sound.locked) scene.sound.once("unlocked", play);
  else play();
}
