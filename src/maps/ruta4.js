/**
 * Ruta 4 · Paso del Hielo (Duneshade ↔ Frostholm). 36×90 celdas, de norte (Duneshade) a sur (Frostholm).
 *
 *  1. Cañón del desierto (filas 0-27): escorpiones, emboscada, alijo en roca.
 *  2. Tierras rotas (28-39): grava, rocas; la arena se vuelve nieve.
 *  3. Campo nevado (40-58): PUERTA DE LA ESCARCHA (retén) en la fila 58.
 *     Lago helado al oeste (x 3-14, filas 44-65): acertijo de deslizarse; rodea el retén.
 *  4. Bosque nevado (59-89): lobos, alijo en grieta de nieve.
 *
 * Solución del lago (entrando por arriba en x=8): ↓ → ↓ ← ↓ → ↓  (sale por abajo en x=9).
 */

import { Grid } from "./grid.js";
import { hash } from "../art/pixel.js";

const W = 36;
const H = 90;

// Frontera ondulada y continua entre la arena y la nieve.
const biomeAt = (cx, cy) => (cy < 34 + Math.sin(cx * 0.6) * 1.2 + Math.sin(cx * 0.21 + 2) * 1.8 ? "desert" : "snow");

// Lago helado: interior x 4-13, filas 45-64. Entrada (8,44), salida (9,65).
const LAKE = { x0: 3, y0: 44, x1: 14, y1: 65, entry: [8, 44], exit: [9, 65] };
const BLOCKS = [[8, 52], [12, 51], [11, 58], [6, 57], [10, 64], [9, 45], [5, 48], [12, 46], [4, 60], [13, 62]];

function build() {
  const g = new Grid(W, H, ".");
  // Paredes del cañón arriba; pinos nevados abajo.
  for (let y = 0; y < H; y += 1) {
    const l = 3 + Math.floor(hash(0, y >> 1, 4) * 3);
    const r = 3 + Math.floor(hash(1, y >> 1, 4) * 3);
    const ch = y < 30 ? "#" : y < 40 ? "O" : "T";
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

  // ---- 1. Cañón ----
  g.road([[18.5, 0], [15, 10], [20, 20], [17, 28]], 3, ":");
  g.scatter(6, 2, 24, 26, "d", 0.06, 5);
  g.scatter(6, 2, 24, 26, "k", 0.025, 6);
  g.ellipse(25, 16, 3, 2, '"', ".d", 7);
  g.ellipse(9, 8, 2.5, 2, '"', ".d", 8);
  [[10, 21], [24, 6], [26, 24]].forEach(([x, y]) => g.set(x, y, "O"));

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
  return g.rows();
}

export default {
  id: "ruta4",
  name: "Ruta 4",
  subtitle: "Paso del Hielo",
  kind: "route",
  between: ["duneshade", "frostholm"],
  biome: "desert",
  biomeAt,
  music: "road",
  grid: build(),
  objects: [
    { type: "sign", x: 21.2, y: 3.4, text: ["RUTA 4 · PASO DEL HIELO", "↑ Duneshade   ↓ Frostholm"] },
    { type: "sign", x: 21.4, y: 54.6, text: ["PUERTA DE LA ESCARCHA", "Retén de la Corona. Toda piedra se declara."] },
    { type: "sign", x: 11.6, y: 43.4, text: ["LAGO HELADO", "En el hielo no se frena: resbalas hasta chocar.", "Si te pierdes, vuelve a salir por donde entraste."] },
    { type: "barrier", id: "escarcha", x: 16.5, y: 57.3 },
    { type: "refuge", id: "refugio-r4", x: 4.4, y: 42.2, snow: true },
    { type: "chest", id: "r4-lago", x: 12.5, y: 67.4, loot: { gold: 40 } },
    { type: "enemy", kind: "scorpion", x: 12, y: 12 },
    { type: "enemy", kind: "scorpion", x: 23, y: 22 },
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
    { x: 16, y: 0, w: 6, h: 1, to: "duneshade", entry: "south" },
    { x: 16, y: 89, w: 6, h: 1, to: "frostholm", entry: "north" },
  ],
  entries: {
    north: { x: 18.5, y: 1.4, dir: "down" },
    south: { x: 18.5, y: 88.2, dir: "up" },
    refugio: { x: 4.6, y: 43.8, dir: "down" },
  },
};
