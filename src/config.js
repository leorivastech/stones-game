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
  // Aguante (0-1). Correr lo gasta (se acaba en ~3 s), rodar cuesta un trozo, y se llena en ~2 s
  // tras `delay` ms sin gastar. Sin aguante no se rueda y se corre a paso de caminar.
  stamina: { runDrain: 1 / 3, rollCost: 0.35, regen: 0.5, delay: 500, recoverAt: 0.3 },
  // Rebote al pegarle de frente al escudo de un guardia.
  blockPush: 120,
};

// knock: qué tan lejos sale volando al pegarle (los ligeros más). push: qué tan fuerte te empuja.
export const ENEMY = {
  boar: { hp: 2, speed: 34, charge: 175, sight: 80, damage: 1, knock: 230, push: 190 },
  // El lobo avisa menos, ve más lejos y embiste más rápido.
  wolf: { hp: 2, speed: 46, charge: 215, sight: 96, damage: 1, windup: 380, knock: 210, push: 190 },
  // Persigue a 48 (antes 30: más lento que ir agachado). Si te pierde 3 s se vuelve a enterrar.
  scorpion: { hp: 2, speed: 48, sight: 40, damage: 1, knock: 240, push: 150, lose: 3000 },
  // Patrones: estocada normal, finta (amaga, se para y ataca) y cuchillo a media distancia.
  bandit: {
    hp: 3, speed: 60, lunge: 165, sight: 92, damage: 1, knock: 185, push: 175,
    windup: 380, recover: 520, feint: 0.3, feintFake: 200, feintWait: 250,
    knife: { chance: 0.45, min: 48, max: 120, aim: 320, speed: 170, range: 140, cooldown: 3000, damage: 1 },
  },
  // Escudo al frente: de frente no le entra nada salvo en su `recover`. Embiste corto a 40-70 px.
  guard: {
    hp: 5, speed: 44, chase: 74, sight: 86, fov: 0.62, damage: 2, knock: 120, push: 230,
    windup: 420, recover: 600, shieldArc: 1.0, dash: { min: 40, max: 70, windup: 300, speed: 210, time: 190, cooldown: 2600 },
    searchLook: 3000,
  },
  // Cuchillo del bandido (solo para el empujón que da).
  knife: { push: 110 },
};

// Tiempos de ataque de todos los enemigos: ±25 % al azar en cada ataque.
export const ENEMY_JITTER = 0.25;

// Noche (20:00-5:00): cambia quién ve y quién sale. `extra*`: cuántos enemigos más salen de noche
// (solo jugando solo; en línea los mapas no cambian de tamaño).
export const NIGHT = {
  guardSight: 0.7, // los guardias ven menos… salvo que estés junto a una luz
  banditSight: 1.3,
  extraPerCamp: 1, // un bandido más por campamento
  extraPerAmbush: 1, // un compañero escondido por emboscada
  extraWolves: 1, // un lobo más en rutas de montaña o nieve
};

// Curva por fama (tier 0-4 = títulos Desconocido…Leyenda).
export const FAME_CURVE = {
  banditHpFrom: 3, // desde el título 3, bandidos +1 vida
  guardSightPerTier: 0.1,
};

// Sigilo: cuánto te ven según cómo vas (multiplica la vista del enemigo).
export const STEALTH = {
  crouch: 0.55,
  grassMoving: 0.6, // en pasto alto, caminando normal o corriendo
  lastSeenMark: true, // el guardia que te pierde marca con "?" dónde te vio
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
