/** Trazo de cada camino. Recodo corto dentro de un campo que llena la cámara. */

import Phaser from "phaser";

// 800/0.85 ≈ 941 de vista: el mundo tiene que ser al menos eso de ancho
// o se ve el color de fondo a los lados (el “espacio vacío” de la derecha).
export const ROUTE_WORLD = { w: 960, h: 580 };
export const PATH_HALF = 40;

// Recodo de ~3 s a pie, centrado en el campo. Extremos cerca del borde.
const ROUTES = {
  "ashfen-valkeep": {
    ground: "grass",
    pave: "dirt",
    biome: "temperate",
    points: [[210, 555], [320, 430], [480, 320], [640, 190], [790, 36]],
  },
  "valkeep-verdelume": {
    ground: "moss",
    pave: "dirt",
    biome: "mountain",
    points: [[210, 555], [330, 420], [490, 330], [660, 190], [830, 36]],
  },
  "verdelume-duneshade": {
    ground: "jungle",
    pave: "dirt",
    biome: "tropical",
    points: [[36, 230], [210, 170], [430, 290], [650, 310], [924, 250]],
  },
  "duneshade-frostholm": {
    ground: "sand",
    pave: "dirt",
    biome: "desert",
    points: [[300, 36], [220, 170], [380, 270], [340, 390], [540, 500], [700, 555]],
  },
};

export function getRoute(from, to) {
  const forward = `${from}-${to}`;
  const spec = ROUTES[forward] ?? ROUTES[`${to}-${from}`];
  if (!spec) {
    return {
      ground: "grass",
      pave: "dirt",
      biome: "temperate",
      points: [[210, 540], [360, 360], [560, 220], [780, 50]],
      reversed: false,
    };
  }
  const reversed = !ROUTES[forward];
  return {
    ...spec,
    points: reversed ? [...spec.points].reverse() : spec.points,
    reversed,
  };
}

export function makeTravelPath(scene, points) {
  const path = scene.add.path(points[0][0], points[0][1]);
  path.splineTo(points.slice(1).map(([x, y]) => new Phaser.Math.Vector2(x, y)));
  return path;
}

export function nearestOnPath(x, y, spaced) {
  let best = Infinity;
  let point = spaced[0];
  for (const candidate of spaced) {
    const d = Phaser.Math.Distance.Between(x, y, candidate.x, candidate.y);
    if (d < best) {
      best = d;
      point = candidate;
    }
  }
  return { point, dist: best };
}

export function distToPath(x, y, spaced) {
  return nearestOnPath(x, y, spaced).dist;
}

/** Devuelve la posición corregida para no salirse del sendero. */
export function clampToPath(x, y, spaced, limit) {
  const { point, dist } = nearestOnPath(x, y, spaced);
  if (dist <= limit) return { x, y };
  const k = limit / dist;
  return { x: point.x + (x - point.x) * k, y: point.y + (y - point.y) * k };
}
