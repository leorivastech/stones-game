/**
 * Ruta 2 · Paso Alto (Valkeep ↔ Verdelume). 36×80 celdas, de sur (Valkeep) a norte (Verdelume).
 *
 *  1. Faldas (filas 66-79): pinos y rocas, lobos.
 *  2. El paso (56-65): garganta entre farallones con la ADUANA de la Corona.
 *     · Vereda del este: tapada por un arbusto, pasto alto y lobos; rodea la aduana hacia el norte.
 *     · Cornisa del oeste: bordes que sólo se bajan — atajo de regreso hacia Valkeep.
 *  3. Meseta (42-55): alijo en roca partida.
 *  4. Bajada a la selva (30-41): arroyo con puente.
 *  5. Selva (0-29): árboles gigantes, pasto alto con emboscadas, alijo en tronco hueco.
 */

import { Grid } from "./grid.js";
import { hash } from "../art/pixel.js";

const W = 36;
const H = 80;

/** Abajo montaña, arriba selva, con borde irregular. */
const biomeAt = (cx, cy) => (cy + (hash(cx, cy, 5) - 0.5) * 6 > 38 ? "mountain" : "tropical");

function build() {
  const g = new Grid(W, H, ".");
  // Bordes: pinos abajo, selva arriba.
  for (let y = 0; y < H; y += 1) {
    const l = 3 + Math.floor(hash(0, y >> 1, 8) * 2);
    const r = 3 + Math.floor(hash(1, y >> 1, 8) * 2);
    const ch = y > 38 ? "P" : "T";
    g.rect(0, y, l, 1, ch);
    g.rect(W - r, y, r, 1, ch);
  }

  // ---- 1-2. Faldas y el paso ----
  g.road([[18, 80], [18, 70], [18.5, 62], [18, 55]], 4, ":");
  // Farallones de la garganta, con la aduana en el hueco (fila 60).
  g.rect(4, 56, 12, 9, "#");
  g.rect(22, 56, 10, 9, "#");
  g.rect(16, 60, 1, 1, "f");
  g.rect(21, 60, 1, 1, "f");
  // Cornisa del oeste: pasillo entre el farallón y el borde, con bordes que se bajan.
  g.rect(4, 50, 3, 22, ".");
  g.rect(4, 56, 3, 9, ".");
  g.rect(7, 56, 1, 9, "#");
  g.rect(4, 58, 3, 1, "^");
  g.rect(4, 63, 3, 1, "^");
  g.road([[5.5, 66], [10, 70], [16, 71]], 2, ":", ".");
  // Vereda del este: entra por un arbusto y rodea por el pasto alto.
  g.rect(29, 50, 4, 20, ".");
  g.rect(32, 56, 1, 10, "#");
  g.rect(28, 56, 1, 10, "#");
  g.rect(29, 65, 3, 1, "b");
  g.road([[24, 68], [30, 66.5], [30, 52], [22, 50]], 2, ":", ".\"");
  g.ellipse(30.5, 60, 2, 5, '"', ".:", 3);
  g.ellipse(24, 70, 3, 2, '"', ".", 4);
  [[9, 75], [27, 74], [12, 68], [25, 72]].forEach(([x, y]) => g.set(x, y, "o"));
  [[8, 77], [29, 77]].forEach(([x, y]) => g.set(x, y, "O"));

  // ---- 3. Meseta ----
  g.road([[18, 55], [16, 50], [18, 44]], 3, ":");
  g.ellipse(11, 47, 3, 2, "g", ".", 6);
  g.ellipse(25, 45, 3, 2, '"', ".", 7);
  [[8, 52], [27, 53], [13, 43], [24, 49]].forEach(([x, y]) => g.set(x, y, "o"));

  // ---- 4. Bajada y arroyo ----
  g.road([[18, 44], [21, 38], [17, 32], [18, 28]], 3, ":");
  g.rect(0, 34, W, 2, "~");
  g.rect(16, 33, 4, 4, "B");
  g.rect(0, 33, W, 1, "_", ".T");
  g.rect(0, 36, W, 1, "_", ".P");
  g.ellipse(9, 39, 3, 1.5, "e", ".", 8);
  g.ellipse(27, 40, 3, 1.5, '"', ".", 9);

  // ---- 5. Selva ----
  g.road([[18, 28], [14, 20], [20, 12], [17.5, 0]], 3, ":");
  g.rect(3, 22, 8, 5, "T");
  g.rect(25, 4, 8, 7, "T");
  g.ellipse(24, 22, 4, 3, '"', ".", 10);
  g.ellipse(9, 12, 3, 4, '"', ".", 11);
  g.ellipse(27, 16, 2, 2, '"', ".", 12);
  g.scatter(4, 1, 28, 28, "e", 0.05, 13);
  [[7, 4], [29, 25], [11, 17]].forEach(([x, y]) => g.set(x, y, "t"));
  return g.rows();
}

export default {
  id: "ruta2",
  name: "Ruta 2",
  subtitle: "Paso Alto",
  kind: "route",
  between: ["valkeep", "verdelume"],
  biome: "mountain",
  biomeAt,
  music: "road",
  grid: build(),
  objects: [
    { type: "sign", x: 20.8, y: 76.5, text: ["RUTA 2 · PASO ALTO", "↑ Verdelume   ↓ Valkeep"] },
    { type: "sign", x: 21, y: 66.6, text: ["ADUANA DEL PASO", "Toda carga que baje a la selva paga a la Corona."] },
    { type: "sign", x: 25.6, y: 69.2, text: ["(Una marca de pastor en la roca.)", "\"Por el pasto se sube sin aduana. Cuidado con los lobos.\""] },
    { type: "barrier", id: "aduana2", x: 16.5, y: 59.3 },
    { type: "stash", id: "r2-roca", kind: "rock", x: 11, y: 48.2 },
    { type: "stash", id: "r2-tronco", kind: "tree", x: 27.5, y: 20.4 },
    { type: "bridge-rails", x0: 16, x1: 19, y0: 34, y1: 35 },
    { type: "chest", id: "r2-selva", x: 6.5, y: 27.6, loot: { gold: 25 } },
    // Enemigos
    { type: "enemy", kind: "guard", post: true, x: 15.2, y: 61.6, dir: "down", barrier: "aduana2" },
    { type: "enemy", kind: "guard", post: true, x: 21.8, y: 61.6, dir: "down", barrier: "aduana2" },
    { type: "enemy", kind: "guard", x: 18, y: 68, patrol: [[18, 68], [18, 73], [14, 71]], minHeat: 0 },
    { type: "enemy", kind: "guard", x: 18, y: 50, patrol: [[16, 50], [18, 45]], minHeat: 20 },
    { type: "enemy", kind: "guard", x: 18, y: 30, patrol: [[18, 31], [16, 26]], minHeat: 45 },
    { type: "enemy", kind: "wolf", x: 30, y: 62 },
    { type: "enemy", kind: "wolf", x: 30.5, y: 57 },
    { type: "enemy", kind: "wolf", x: 10, y: 75 },
    { type: "enemy", kind: "boar", x: 25, y: 46 },
    { type: "enemy", kind: "bandit", x: 24, y: 22, ambush: true },
    { type: "enemy", kind: "bandit", x: 9, y: 12, ambush: true },
    { type: "enemy", kind: "bandit", x: 27, y: 16, ambush: true, minCargo: 2 },
  ],
  exits: [
    { x: 16, y: 79, w: 5, h: 1, to: "valkeep", entry: "north" },
    { x: 15, y: 0, w: 6, h: 1, to: "verdelume", entry: "south" },
  ],
  entries: {
    south: { x: 18, y: 78.2, dir: "up" },
    north: { x: 17.5, y: 1.4, dir: "down" },
  },
};
