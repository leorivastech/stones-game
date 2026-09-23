/**
 * Refugios secretos: mapas chicos a los que se entra desde una ruta.
 * Adentro: estante (guardar piedras), mesa de trabajo (mejoras), catre (si lo compraste) y la gente
 * que dejaste. `refuge` es el id que usan state.js (REFUGES) y los objetos.
 */

import { Grid } from "./grid.js";

/** Cueva: paredes de peña, piso de tierra, túnel de salida abajo. */
function cave(seed, floor = ":") {
  const g = new Grid(16, 12, "#");
  g.ellipse(8, 5.2, 6.6, 4.2, floor, null, seed);
  g.rect(7, 8, 2, 4, floor);
  g.ellipse(11.5, 7, 1.4, 0.9, "g", [floor]);
  return g;
}

function caveR2() {
  const g = cave(4);
  g.set(2, 5, "o");
  g.set(13, 4, "c");
  g.set(13, 5, "r");
  return g.rows();
}

function caveR4() {
  const g = cave(9, ":");
  // Cueva de hielo: bloques de hielo en las orillas.
  [[2, 4], [13, 3], [14, 6]].forEach(([x, y]) => g.set(x, y, "I"));
  g.set(3, 7, "o");
  return g.rows();
}

/** Tierra escondida: un claro en la selva con choza, porche y corral. */
function plotR3() {
  const g = new Grid(26, 18, "T");
  g.ellipse(13, 8, 11, 6.8, ".", null, 7);
  g.rect(12, 13, 2, 5, ":");
  g.ellipse(13, 12, 3, 1.2, ":", ["."]);
  // Corral a la derecha.
  g.rect(18, 4, 6, 1, "f");
  g.rect(18, 10, 6, 1, "f");
  g.rect(23, 5, 1, 5, "|");
  g.set(18, 5, "|");
  g.set(18, 9, "|");
  g.set(21, 6, "h");
  return g.rows();
}

const caveObjects = (id) => [
  { type: "store", id, x: 5, y: 3.9 },
  { type: "bench", id, x: 10.5, y: 3.9 },
  { type: "cot", id, x: 11.6, y: 8.6 },
  { type: "prop", art: "lamp", x: 3.2, y: 7.4, solid: [2, 22, 6, 5] },
];

export const REFUGE_MAPS = {
  "refugio-r2": {
    id: "refugio-r2",
    name: "Cueva del Paso Alto",
    subtitle: "Tu refugio",
    kind: "refuge",
    refuge: "refugio-r2",
    between: ["valkeep", "verdelume"],
    biome: "mountain",
    music: "valkeep",
    dark: true,
    grid: caveR2(),
    objects: caveObjects("refugio-r2"),
    crewSpots: { sahra: [6.5, 6.8], horse: [3.8, 9.4] },
    exits: [{ x: 7, y: 11, w: 2, h: 1, to: "ruta2", entry: "refugio" }],
    entries: { door: { x: 8, y: 9.8, dir: "up" } },
  },
  "refugio-r3": {
    id: "refugio-r3",
    name: "Tierra escondida",
    subtitle: "Tu refugio",
    kind: "refuge",
    refuge: "refugio-r3",
    between: ["verdelume", "duneshade"],
    biome: "tropical",
    music: "ashfen",
    grid: plotR3(),
    objects: [
      { type: "house", art: "house-jungle-b", x: 3.2, y: 1.4 },
      { type: "store", id: "refugio-r3", x: 10.5, y: 5.6 },
      { type: "bench", id: "refugio-r3", x: 14.5, y: 5.6 },
      { type: "cot", id: "refugio-r3", x: 9.4, y: 10.4 },
    ],
    crewSpots: { sahra: [15.5, 9], horse: [21, 8.6] },
    exits: [{ x: 12, y: 17, w: 2, h: 1, to: "ruta3", entry: "refugio" }],
    entries: { door: { x: 13, y: 15.6, dir: "up" } },
  },
  "refugio-r4": {
    id: "refugio-r4",
    name: "Cueva del lago",
    subtitle: "Tu refugio · aquí la escarcha no se derrite",
    kind: "refuge",
    refuge: "refugio-r4",
    between: ["duneshade", "frostholm"],
    biome: "snow",
    music: "valkeep",
    dark: true,
    cold: true,
    grid: caveR4(),
    objects: caveObjects("refugio-r4"),
    crewSpots: { sahra: [6.5, 6.8], horse: [3.8, 9.4] },
    exits: [{ x: 7, y: 11, w: 2, h: 1, to: "ruta4", entry: "refugio" }],
    entries: { door: { x: 8, y: 9.8, dir: "up" } },
  },
};
