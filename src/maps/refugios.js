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
  const g = cave(9, "s");
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

/** Sótano bajo las ruinas (Ruta 1): losas viejas, columnas rotas, barriles; la escalera sube al bosque. */
function cellarR1() {
  const g = new Grid(18, 12, "#");
  g.rect(2, 2, 14, 7, ":");
  g.rect(3, 1, 12, 1, ":");
  g.rect(8, 9, 2, 3, ":");
  [[2, 2], [15, 2], [2, 8], [15, 8]].forEach(([x, y]) => g.set(x, y, "#"));
  // Piedras caídas del techo.
  g.set(13, 2, "o");
  g.set(3, 3, "o");
  g.set(3, 7, "r");
  g.set(14, 7, "c");
  g.set(14, 6, "r");
  return g.rows();
}

/** Cueva del manantial (Ruta 2): cueva con un ojo de agua que brota al fondo. */
function caveR2b() {
  const g = cave(12);
  g.ellipse(12, 6.6, 2.2, 1.5, "~", [":", "g"]);
  g.ellipse(12, 6.6, 3.1, 2.2, "g", [":"]);
  g.set(2, 5, "o");
  g.set(13, 3, "o");
  return g.rows();
}

/** Choza del manglar (Ruta 3): un islote de tablas sobre el estero, con la choza y los mangles. */
function hutR3b() {
  const g = new Grid(22, 15, "T");
  g.ellipse(11, 7, 9.6, 6.2, "~", null, 5);
  g.rect(5, 3, 12, 7, "B");
  g.rect(10, 10, 2, 5, "B");
  // Mangles sueltos en el agua y juncos en la orilla.
  [[3, 3], [18, 4], [2, 9], [19, 10], [7, 12], [15, 12]].forEach(([x, y]) => g.set(x, y, "t"));
  return g.rows();
}

/** Grieta del cañón (Ruta 5): un pasillo angosto de arena entre paredes que se abre en una hondonada. */
function creviceR5() {
  const g = new Grid(18, 14, "#");
  g.ellipse(9, 4.6, 6.4, 3.4, ".", null, 3);
  g.trail([[8, 13], [8, 11], [9, 11], [9, 8]]);
  g.rect(8, 11, 2, 3, ".");
  g.set(3, 4, "O");
  g.set(15, 5, "k");
  [[5, 2], [13, 7], [4, 7]].forEach(([x, y]) => g.set(x, y, "d"));
  return g.rows();
}

const caveObjects = (id) => [
  { type: "store", id, x: 5, y: 3.9 },
  { type: "bench", id, x: 10.5, y: 3.9 },
  { type: "cot", id, x: 11.6, y: 8.6 },
  { type: "prop", art: "lamp", x: 3.2, y: 7.4, solid: [2, 22, 6, 5] },
];

export const REFUGE_MAPS = {
  "refugio-r1": {
    id: "refugio-r1",
    name: "Sótano de las ruinas",
    subtitle: "Tu refugio · el catre del viejo sigue aquí",
    kind: "refuge",
    refuge: "refugio-r1",
    between: ["ashfen", "valkeep"],
    biome: "temperate",
    music: "refuge",
    ambience: "cave",
    dark: true,
    grid: cellarR1(),
    objects: [
      { type: "store", id: "refugio-r1", x: 5.5, y: 2.9 },
      { type: "bench", id: "refugio-r1", x: 12.2, y: 4.4 },
      { type: "cot", id: "refugio-r1", x: 4.4, y: 6.6 },
      { type: "prop", art: "ruin-column-0", x: 1.9, y: 1.4, solid: [2, 22, 12, 6] },
      { type: "prop", art: "ruin-column-1", x: 15.1, y: 3.6, solid: [2, 22, 12, 6] },
      { type: "prop", art: "lamp", x: 10.6, y: 7.4, solid: [2, 22, 6, 5] },
    ],
    crewSpots: { sahra: [8.5, 5.5], horse: [8.5, 7.5] },
    exits: [{ x: 8, y: 11, w: 2, h: 1, to: "ruta1", entry: "refugio" }],
    entries: { door: { x: 9, y: 9.8, dir: "up" } },
  },
  "refugio-r2b": {
    id: "refugio-r2b",
    name: "Cueva del manantial",
    subtitle: "Tu refugio · agua fresca que cura",
    kind: "refuge",
    refuge: "refugio-r2b",
    between: ["valkeep", "verdelume"],
    biome: "mountain",
    music: "refuge",
    ambience: "cave",
    dark: true,
    grid: caveR2b(),
    objects: [
      { type: "store", id: "refugio-r2b", x: 4.6, y: 3.9 },
      { type: "bench", id: "refugio-r2b", x: 8.6, y: 3.6 },
      { type: "cot", id: "refugio-r2b", x: 4.2, y: 8.2 },
      { type: "spring", x: 11.4, y: 8.5 },
      { type: "prop", art: "lamp", x: 13.8, y: 3.4, solid: [2, 22, 6, 5] },
    ],
    crewSpots: { sahra: [6.5, 6.8], horse: [3.8, 9.4] },
    exits: [{ x: 7, y: 11, w: 2, h: 1, to: "ruta2", entry: "refugio-r2b" }],
    entries: { door: { x: 8, y: 9.8, dir: "up" } },
  },
  "refugio-r3b": {
    id: "refugio-r3b",
    name: "Choza del manglar",
    subtitle: "Tu refugio · rodeada de agua, nadie la encuentra",
    kind: "refuge",
    refuge: "refugio-r3b",
    between: ["verdelume", "duneshade"],
    biome: "tropical",
    music: "refuge-plot",
    ambience: "jungle",
    grid: hutR3b(),
    objects: [
      { type: "house", art: "house-jungle-b", x: 5.2, y: 0.9 },
      { type: "store", id: "refugio-r3b", x: 11.5, y: 3.9 },
      { type: "bench", id: "refugio-r3b", x: 14.9, y: 3.9 },
      { type: "cot", id: "refugio-r3b", x: 7.2, y: 8.4 },
      { type: "prop", art: "lamp", x: 15.4, y: 7.2, solid: [2, 22, 6, 5] },
      { type: "prop", art: "barrel", x: 5.3, y: 5.2, solid: [0, 8, 12, 7] },
      { type: "prop", art: "crate", x: 6.2, y: 5.6, solid: [0, 6, 14, 8] },
      { type: "prop", art: "log", x: 12.8, y: 8.4, solid: [2, 2, 22, 7] },
    ],
    crewSpots: { sahra: [13.5, 7.5], horse: [10.5, 7.5] },
    exits: [{ x: 10, y: 14, w: 2, h: 1, to: "ruta3", entry: "refugio-r3b" }],
    entries: { door: { x: 11, y: 12.6, dir: "up" } },
  },
  "refugio-r5": {
    id: "refugio-r5",
    name: "Grieta del cañón",
    subtitle: "Tu refugio · la Corona casi no baja aquí",
    kind: "refuge",
    refuge: "refugio-r5",
    between: ["duneshade", "mossgrove"],
    biome: "desert",
    music: "refuge",
    ambience: "desert",
    grid: creviceR5(),
    objects: [
      { type: "store", id: "refugio-r5", x: 6.2, y: 2.9 },
      { type: "bench", id: "refugio-r5", x: 11.4, y: 2.9 },
      { type: "cot", id: "refugio-r5", x: 12.4, y: 6.4 },
      { type: "prop", art: "tent", x: 3.6, y: 4.6, solid: [2, 12, 30, 12] },
      { type: "prop", art: "campfire", x: 8.2, y: 5.2, anim: "campfire", solid: [2, 10, 12, 6] },
    ],
    crewSpots: { sahra: [6.5, 7.2], horse: [9.5, 9.5] },
    exits: [{ x: 8, y: 13, w: 2, h: 1, to: "ruta5", entry: "refugio" }],
    entries: { door: { x: 9, y: 11.8, dir: "up" } },
  },
  "refugio-r2": {
    id: "refugio-r2",
    name: "Cueva del Paso Alto",
    subtitle: "Tu refugio",
    kind: "refuge",
    refuge: "refugio-r2",
    between: ["valkeep", "verdelume"],
    biome: "mountain",
    music: "refuge",
    ambience: "cave",
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
    music: "refuge-plot",
    ambience: "jungle",
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
    music: "refuge",
    ambience: "cave",
    dark: true,
    cold: true,
    grid: caveR4(),
    objects: caveObjects("refugio-r4"),
    crewSpots: { sahra: [6.5, 6.8], horse: [3.8, 9.4] },
    exits: [{ x: 7, y: 11, w: 2, h: 1, to: "ruta4", entry: "refugio" }],
    entries: { door: { x: 8, y: 9.8, dir: "up" } },
  },
};
