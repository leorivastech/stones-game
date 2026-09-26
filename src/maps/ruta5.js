/**
 * Ruta 5 · Cañón del Musgo (Duneshade ↔ Mossgrove). 36×64 celdas, de norte (Duneshade) a sur (Mossgrove).
 *
 *  1. Cañón del desierto (filas 0-27): escorpiones, emboscada. Grieta del cañón (refugio escondido) en
 *     la pared del oeste, detrás de un palmar: piedra marcada (11,13) → hueco entre palmas → grieta (5,13).
 *  2. Tierra que se vuelve musgo (28-35): grava y rocas; la arena da paso al pasto.
 *  3. Bosque cerrado (36-63): jabalíes, un lobo, pasto alto para esconderse, un cofre entre los árboles.
 */

import { Grid } from "./grid.js";
import { hash } from "../art/pixel.js";

const W = 36;
const H = 64;

// Frontera ondulada entre la arena y el bosque.
const biomeAt = (cx, cy) => (cy < 31 + Math.sin(cx * 0.55) * 1.2 + Math.sin(cx * 0.19 + 1) * 1.6 ? "desert" : "temperate");

function build() {
  const g = new Grid(W, H, ".");
  // Paredes del cañón arriba; rocas en la frontera; bosque abajo.
  for (let y = 0; y < H; y += 1) {
    const l = 3 + Math.floor(hash(0, y >> 1, 6) * 3);
    const r = 3 + Math.floor(hash(1, y >> 1, 6) * 3);
    const ch = y < 28 ? "#" : y < 36 ? "O" : "T";
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
  g.road([[18.5, 0], [21, 9], [16, 19], [18, 28]], 3, ":");
  g.scatter(6, 2, 24, 25, "d", 0.06, 15);
  g.scatter(6, 2, 24, 25, "k", 0.025, 16);
  g.ellipse(26, 13, 2.5, 2, '"', ".d", 17);
  g.ellipse(9, 21, 2.5, 2, '"', ".d", 18);
  [[11, 6], [25, 22], [27, 4]].forEach(([x, y]) => g.set(x, y, "O"));
  // Refugio escondido (26-sep): la Grieta del cañón, en la pared del oeste, detrás de un palmar
  // (un ojo de agua viejo). Se entra de lado, por un hueco entre las palmas y una peña.
  g.rect(3, 10, 6, 3, "#");
  g.rect(3, 14, 6, 1, "p");
  [[4, 15], [7, 15], [2, 13], [9, 12]].forEach(([x, y]) => g.set(x, y, "p"));
  g.rect(4, 13, 6, 1, ".");
  g.set(10, 14, "O");
  [[8, 16], [10, 12], [5, 16]].forEach(([x, y]) => g.set(x, y, "d"));

  // ---- 2. Tierra que se vuelve musgo ----
  g.road([[18, 28], [16.5, 33], [18.5, 37]], 3, ":");
  g.ellipse(10, 31, 4, 2, "g", ".", 19);
  g.ellipse(26, 33, 4, 2, "g", ".", 20);
  [[8, 34], [28, 30], [12, 29]].forEach(([x, y]) => g.set(x, y, "o"));

  // ---- 3. Bosque cerrado ----
  g.road([[18.5, 37], [21, 46], [16.5, 55], [18.5, 64]], 3, ":");
  g.rect(5, 39, 8, 6, "T");
  g.rect(25, 41, 6, 9, "T");
  g.rect(6, 50, 6, 7, "T");
  g.rect(26, 55, 5, 5, "T");
  for (const [x, y] of [[14, 40], [24, 52], [13, 58], [23, 60], [8, 47], [28, 38]]) g.set(x, y, "P");
  g.scatter(6, 37, 24, 26, "e", 0.05, 21);
  g.scatter(6, 37, 24, 26, "t", 0.03, 22);
  g.ellipse(12, 46, 2.5, 2, '"', ".", 23);
  g.ellipse(23, 57, 2.5, 2, '"', ".", 24);
  // Claro escondido con un cofre, tapado por arbustos.
  g.rect(27, 50, 4, 4, ".");
  g.set(26, 51, "b");
  g.set(26, 52, "b");
  return g.rows();
}

export default {
  id: "ruta5",
  name: "Ruta 5",
  subtitle: "Cañón del Musgo",
  kind: "route",
  between: ["duneshade", "mossgrove"],
  biome: "desert",
  biomeAt,
  music: "road-desert",
  ambience: "desert",
  grid: build(),
  objects: [
    { type: "sign", x: 21.4, y: 3.4, text: ["RUTA 5 · CAÑÓN DEL MUSGO", "↑ Duneshade   ↓ Mossgrove"] },
    { type: "sign", x: 21.6, y: 35.4, text: ["BOSQUE DE MUSGO", "Los jabalíes no perdonan. En el pasto alto, agachado, nadie te ve."] },
    { type: "chest", id: "r5-claro", x: 29, y: 52, loot: { gold: 25 } },
    // Refugio escondido: sin letrero. Pista: una piedra marcada en la boca del pedregal.
    { type: "refuge", id: "refugio-r5", x: 5.5, y: 13.95 },
    { type: "prop", art: "marked-stone", x: 11.1, y: 13.2 },
    { type: "enemy", kind: "scorpion", x: 12, y: 13 },
    { type: "enemy", kind: "scorpion", x: 24, y: 20 },
    { type: "enemy", kind: "bandit", x: 26, y: 14, ambush: true },
    { type: "enemy", kind: "bandit", x: 10, y: 46, ambush: true, minCargo: 2 },
    { type: "enemy", kind: "boar", x: 22, y: 42 },
    { type: "enemy", kind: "boar", x: 14, y: 53 },
    { type: "enemy", kind: "wolf", x: 24, y: 58 },
    { type: "enemy", kind: "guard", x: 18, y: 30, patrol: [[18, 29], [17, 36]], minHeat: 30 },
  ],
  exits: [
    { x: 16, y: 0, w: 6, h: 1, to: "duneshade", entry: "south" },
    { x: 16, y: 63, w: 6, h: 1, to: "mossgrove", entry: "north" },
  ],
  entries: {
    north: { x: 18.5, y: 1.4, dir: "down" },
    south: { x: 18.5, y: 62.2, dir: "up" },
    refugio: { x: 7.6, y: 13.8, dir: "right" },
  },
};
