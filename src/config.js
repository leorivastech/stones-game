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
  invulnTime: 1000,
  knockback: 170,
  startHearts: 3,
};

export const ENEMY = {
  boar: { hp: 2, speed: 34, charge: 175, sight: 80, damage: 1 },
  // El lobo avisa menos, ve más lejos y embiste más rápido.
  wolf: { hp: 2, speed: 46, charge: 215, sight: 96, damage: 1, windup: 380 },
  scorpion: { hp: 2, speed: 30, sight: 40, damage: 1 },
  bandit: { hp: 3, speed: 60, lunge: 165, sight: 92, damage: 1 },
  guard: { hp: 5, speed: 44, chase: 74, sight: 86, fov: 0.62, damage: 2 },
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
