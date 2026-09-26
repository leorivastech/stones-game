/** Números que se ajustan jugando. Todo en píxeles del juego (480×270). */

export const VIEW_W = 480;
export const VIEW_H = 270;
export const TILE = 16;

export const PLAYER = {
  walk: 82,
  run: 132,
  crouch: 40,
  rollSpeed: 210,
  rollTime: 220,
  rollCooldown: 330,
  attackTime: 250,
  hurtTime: 180,
  invulnTime: 700,
  knockback: 170, // empujón al recibir daño si el golpe no viene de un enemigo con `push`
  // Congelado (ms) al pegar, al matar y al recibir daño.
  hitstop: { hit: 70, kill: 110, hurt: 90 },
  startHearts: 3,
};

// knock: qué tan lejos sale volando al pegarle (los ligeros más). push: qué tan fuerte te empuja.
export const ENEMY = {
  boar: { hp: 2, speed: 34, charge: 175, sight: 80, damage: 1, knock: 230, push: 190 },
  // El lobo avisa menos, ve más lejos y embiste más rápido.
  wolf: { hp: 2, speed: 46, charge: 215, sight: 96, damage: 1, windup: 380, knock: 210, push: 190 },
  scorpion: { hp: 2, speed: 30, sight: 40, damage: 1, knock: 240, push: 150 },
  bandit: { hp: 3, speed: 60, lunge: 165, sight: 92, damage: 1, knock: 185, push: 175 },
  guard: { hp: 5, speed: 44, chase: 74, sight: 86, fov: 0.62, damage: 2, knock: 120, push: 230 },
};

// Sacudida de cámara por evento: [ms, intensidad]. SHAKE_SCALE = 0 la apaga si marea; 0.5 la suaviza.
export const SHAKE_SCALE = 1;
export const SHAKE = {
  hit: [40, 0.002],
  kill: [80, 0.004],
  hurt: [120, 0.006],
  charge: [160, 0.008],
  bump: [80, 0.004],
};

export const DEPTH = {
  ground: -10000,
  decal: -5000,
  cone: -4000,
  fx: 9000,
  ui: 10000,
};

// Ambiente (nieve, arena, hojas, luciérnagas, polvo, sombras de nube). `enabled: false` lo apaga todo.
export const AMBIENT = {
  enabled: true,
  maxParticles: 120,
  clouds: true,
  cloudAlpha: [0.18, 0.25],
  cloudSpeed: [10, 14],
};
