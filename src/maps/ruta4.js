/**
 * Ruta 4 · Paso del Hielo (Mossgrove ↔ Frostholm). 36×90 celdas, de norte (Mossgrove) a sur (Frostholm).
 * Hasta el 23-sep empezaba en el desierto; Leo pidió un pueblo de bosque entre el desierto y la nieve.
 *
 *  1. Bosque que sale de Mossgrove (filas 0-27): jabalíes, emboscada.
 *  2. Tierras rotas (28-39): grava, rocas; el bosque se vuelve nieve.
 *  3. Campo nevado (40-58): PUERTA DE LA ESCARCHA (retén) en la fila 58.
 *     Lago helado al oeste (x 3-14, filas 44-65): acertijo de deslizarse; rodea el retén.
 *  4. Bosque nevado (59-89): lobos, cofre. Cueva del lago (refugio frío), escondida entre los pinos
 *     del suroeste: arbusto junto a una piedra marcada (7,73) → vereda → cueva (4,77).
 *
 * Solución del lago (entrando por arriba en x=8): ↓ → ↓ ← ↓ → ↓  (sale por abajo en x=9).
 */

import { Grid } from "./grid.js";
import { hash } from "../art/pixel.js";

const W = 36;
const H = 90;

// Frontera ondulada y continua entre el bosque y la nieve.
const biomeAt = (cx, cy) => (cy < 34 + Math.sin(cx * 0.6) * 1.2 + Math.sin(cx * 0.21 + 2) * 1.8 ? "temperate" : "snow");

// Lago helado: interior x 4-13, filas 45-64. Entrada (8,44), salida (9,65).
const LAKE = { x0: 3, y0: 44, x1: 14, y1: 65, entry: [8, 44], exit: [9, 65] };
const BLOCKS = [[8, 52], [12, 51], [11, 58], [6, 57], [10, 64], [9, 45], [5, 48], [12, 46], [4, 60], [13, 62]];

function build() {
  const g = new Grid(W, H, ".");
  // Bosque arriba; pinos nevados abajo.
  for (let y = 0; y < H; y += 1) {
    const l = 3 + Math.floor(hash(0, y >> 1, 4) * 3);
    const r = 3 + Math.floor(hash(1, y >> 1, 4) * 3);
    const ch = y < 30 ? "T" : y < 40 ? "O" : "T";
    if (ch === "O") {
      for (let x = 0; x < l; x += 1) if ((x + y) % 2 === 0) g.set(x, y, "O");
      for (let x = W - r; x < W; x += 1) if ((x + y) % 2 === 0) g.set(x, y, "O");
      g.set(0, y, "x");
      g.set(W - 1, y, "x");
    } else {
      g.rect(0, y, l, 1, ch);
      g.rect(W - r, y, r, 1, ch);
    }
  }

  // ---- 1. Bosque que sale de Mossgrove ----
  g.road([[18.5, 0], [15, 10], [20, 20], [17, 28]], 3, ":");
  g.rect(24, 3, 5, 6, "T");
  g.rect(6, 14, 5, 6, "T");
  for (const [x, y] of [[10, 4], [26, 12], [8, 24], [27, 26]]) g.set(x, y, "P");
  g.scatter(6, 2, 24, 26, "e", 0.05, 5);
  g.scatter(6, 2, 24, 26, "t", 0.03, 6);
  g.ellipse(25, 16, 3, 2, '"', ".", 7);
  g.ellipse(9, 8, 2.5, 2, '"', ".", 8);
  [[10, 21], [26, 24]].forEach(([x, y]) => g.set(x, y, "o"));

  // ---- 2. Tierras rotas ----
  g.road([[17, 28], [19, 34], [17.5, 40]], 3, ":");
  g.ellipse(10, 32, 4, 2.5, "g", ".", 9);
  g.ellipse(26, 36, 4, 2, "g", ".", 10);
  g.rect(5, 35, 11, 1, "#");
  g.rect(21, 35, 10, 1, "#");
  [[8, 30], [27, 31], [12, 38], [24, 39]].forEach(([x, y]) => g.set(x, y, "o"));

  // ---- 3. Campo nevado, retén y lago ----
  g.road([[17.5, 40], [18.5, 50], [18.5, 60]], 3, ":");
  // Lago helado con paredes de roca.
  g.rect(LAKE.x0, LAKE.y0, LAKE.x1 - LAKE.x0 + 1, LAKE.y1 - LAKE.y0 + 1, "#");
  g.rect(LAKE.x0 + 1, LAKE.y0 + 1, LAKE.x1 - LAKE.x0 - 1, LAKE.y1 - LAKE.y0 - 1, "i");
  g.set(...LAKE.entry, "s");
  g.set(...LAKE.exit, "s");
  for (const [x, y] of BLOCKS) g.set(x, y, "I");
  g.rect(6, 41, 5, 3, "s");
  g.road([[8, 41], [14, 40.5]], 2, "s", ".");
  // Muro del retén: roca a los lados de la barrera (fila 58).
  g.rect(15, 58, 1, 1, "#");
  g.rect(16, 58, 1, 1, "f");
  g.rect(21, 58, 1, 1, "f");
  g.rect(22, 58, 14, 1, "#");
  g.rect(24, 44, 8, 12, "T");
  [[21, 45], [22, 52], [30, 57]].forEach(([x, y]) => g.set(x, y, "y"));

  // ---- 4. Bosque nevado ----
  g.road([[18.5, 60], [17, 72], [19.5, 82], [18.5, 90]], 3, ":");
  g.road([[9, 66], [9, 70], [16, 72]], 2, "s", ".");
  g.rect(3, 73, 10, 9, "T");
  g.rect(24, 62, 8, 8, "T");
  [[22, 76], [12, 68], [26, 84], [6, 85]].forEach(([x, y]) => g.set(x, y, "y"));
  [[14, 80], [24, 72]].forEach(([x, y]) => g.set(x, y, "o"));
  // Refugio escondido (26-sep): la Cueva del lago ya no está a la vista junto al hielo. Al salir del
  // lago, donde los pinos se juntan, un arbusto junto a una piedra marcada tapa una vereda que da
  // vuelta entre los pinos nevados hasta la cueva.
  g.trail([[7, 73], [7, 74], [10, 74], [10, 77], [3, 77]]);
  // Pinos (no árboles pelados) justo enfrente: tapan la boca de la cueva.
  g.rect(2, 78, 9, 1, "P");
  g.set(7, 73, "b");
  return g.rows();
}

export default {
  id: "ruta4",
  name: "Ruta 4",
  subtitle: "Paso del Hielo",
  kind: "route",
  between: ["mossgrove", "frostholm"],
  biome: "temperate",
  biomeAt,
  music: "road-snow",
  ambience: "snow",
  grid: build(),
  objects: [
    { type: "sign", x: 21.2, y: 3.4, text: ["RUTA 4 · PASO DEL HIELO", "↑ Mossgrove   ↓ Frostholm"] },
    { type: "sign", x: 21.4, y: 54.6, text: ["PUERTA DE LA ESCARCHA", "Retén de la Corona. Toda piedra se declara."] },
    { type: "sign", x: 11.6, y: 43.4, text: ["LAGO HELADO", "En el hielo no se frena: resbalas hasta chocar.", "Si te pierdes, vuelve a salir por donde entraste."] },
    { type: "barrier", id: "escarcha", x: 16.5, y: 57.3 },
    // Faroles del paso: de noche, bajo su luz los guardias ven como de día.
    { type: "prop", art: "lamp", x: 14.1, y: 57.9, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 22.6, y: 57.9, solid: [2, 22, 6, 5] },
    { type: "refuge", id: "refugio-r4", x: 4.5, y: 77.95, snow: true },
    { type: "prop", art: "marked-stone", x: 8.2, y: 72.1 },
    // Un pino alto justo delante de la boca: desde el camino no se ve la cueva.
    { type: "prop", art: "pine-snow-tall", x: 3.65, y: 75.95 },
    { type: "chest", id: "r4-lago", x: 12.5, y: 67.4, loot: { gold: 40 } },
    { type: "enemy", kind: "boar", x: 12, y: 12 },
    { type: "enemy", kind: "boar", x: 23, y: 22 },
    { type: "enemy", kind: "bandit", x: 25, y: 16, ambush: true },
    { type: "enemy", kind: "bandit", x: 9, y: 8, ambush: true, minCargo: 2 },
    { type: "enemy", kind: "guard", post: true, x: 15.2, y: 59.6, dir: "down", barrier: "escarcha" },
    { type: "enemy", kind: "guard", post: true, x: 21.8, y: 59.6, dir: "up", barrier: "escarcha" },
    { type: "enemy", kind: "guard", x: 19, y: 48, patrol: [[18.5, 44], [18.5, 54]], minHeat: 0 },
    { type: "enemy", kind: "guard", x: 18, y: 66, patrol: [[18, 63], [17, 71]], minHeat: 20 },
    { type: "enemy", kind: "wolf", x: 26, y: 72 },
    { type: "enemy", kind: "wolf", x: 28, y: 74 },
    { type: "enemy", kind: "wolf", x: 8, y: 86 },
  ],
  exits: [
    { x: 16, y: 0, w: 6, h: 1, to: "mossgrove", entry: "south" },
    { x: 16, y: 89, w: 6, h: 1, to: "frostholm", entry: "north" },
  ],
  entries: {
    north: { x: 18.5, y: 1.4, dir: "down" },
    south: { x: 18.5, y: 88.2, dir: "up" },
    refugio: { x: 6.4, y: 77.8, dir: "right" },
  },
};
