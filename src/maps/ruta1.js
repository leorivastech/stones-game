/**
 * Ruta 1 · Calzada del Ámbar (Ashfen ↔ Valkeep). 36×100 celdas.
 *
 * De sur a norte:
 *  1. Pradera: sendero en curva, pasto alto con jabalíes, bordes que sólo se bajan de un salto.
 *  2. Río: un solo puente.
 *  3. Bifurcación: la calzada pasa por el retén de la Corona; el sendero del bosque
 *     (tapado por arbustos que hay que cortar) rodea por el campamento de bandidos.
 *  4. Farallón: la reja del camino está cerrada desde el norte. La primera vez se rodea
 *     por el desvío del este; arriba hay una palanca que la abre para siempre (atajo).
 *  5. Subida de montaña hasta Valkeep.
 */

import { Grid } from "./grid.js";

const W = 36;
const H = 100;

function build() {
  const g = new Grid(W, H, ".");
  g.forestEdges(2, 4, 7);

  // ---- 5. Montaña (filas 0-30): paredes de roca con pinos arriba ----
  for (let y = 0; y < 31; y += 1) {
    const l = 5 + Math.round(Math.sin(y * 0.35) * 1.5);
    const r = 6 + Math.round(Math.cos(y * 0.3) * 1.5);
    g.rect(0, y, l, 1, "P");
    g.rect(W - r, y, r, 1, "P");
    g.set(l, y, "#");
    g.set(W - r - 1, y, "#");
  }
  g.road([[17.5, 0], [17, 9], [15, 17], [16.5, 25], [17.5, 31]], 4, ":");
  g.ellipse(11, 20, 2.6, 2.2, '"', ".g", 13);
  g.ellipse(24, 12, 2.4, 2, '"', ".g", 17);
  // Nicho del cofre: sólo se entra cortando el arbusto del este.
  g.rect(6, 8, 7, 1, "#");
  g.rect(6, 12, 7, 1, "#");
  g.rect(6, 8, 1, 5, "#");
  g.rect(12, 9, 1, 3, "#");
  g.rect(7, 9, 5, 3, "g");
  g.set(12, 10, "b");
  [[9, 5], [25, 6], [22, 20], [10, 27], [26, 27], [13, 9]].forEach(([x, y]) => g.set(x, y, "o"));
  [[24, 3], [8, 24]].forEach(([x, y]) => g.set(x, y, "O"));

  // ---- 4. Farallón (filas 37-39): reja en el camino, desvío por el este ----
  g.rect(0, 37, W, 2, "#");
  g.rect(16, 37, 3, 2, ":");
  g.rect(28, 37, 2, 2, '"');
  g.road([[17.5, 31], [17.5, 44]], 3, ":");
  // Desvío: sube por el este entre pasto alto.
  g.road([[19, 44], [26, 42], [28.5, 39]], 2, ":");
  g.road([[28.5, 36], [27, 33], [20, 32]], 2, ":");
  g.ellipse(27, 34, 3, 2, '"', ".", 3);
  g.ellipse(24, 42, 2.5, 1.5, '"', ".", 4);
  g.rect(30, 30, 3, 10, "T");

  // ---- 3. Bifurcación (filas 44-72) ----
  // Calzada adoquinada con retén
  g.road([[22, 72], [22, 66], [25.5, 62], [25.5, 54], [21, 48], [17.5, 44]], 4, "=");
  // Sendero del bosque: entra al oeste, pasa el campamento y vuelve a la calzada
  g.rect(4, 49, 14, 18, "T");
  g.road([[19, 66], [13, 64], [9, 59], [9, 53], [13, 50], [19, 48]], 2, ":");
  g.ellipse(9, 56, 4, 3, ":");
  g.set(17, 65, "b");
  g.set(16, 65, "b");
  g.set(18, 66, "b");
  g.ellipse(13, 63, 2, 1.2, '"', ":", 5);
  g.ellipse(6, 61, 1.5, 2, '"', ":T", 6);
  g.ellipse(12, 51, 2, 1.2, '"', ":T", 8);
  // Bosque denso al este de la calzada
  g.rect(29, 46, 4, 26, "T");
  g.ellipse(30, 58, 2, 3, '"', ".T", 11);
  // Cerco del retén: no se rodea por el pasto.
  g.rect(18, 60, 6, 1, "f");
  g.rect(28, 60, 1, 1, "f");

  // ---- 2. Río (filas 74-77) ----
  g.rect(0, 74, W, 4, "~");
  g.rect(0, 73, W, 1, "_", ".T");
  g.rect(0, 78, W, 1, "_", ".T");
  g.rect(21, 72, 3, 8, "B");
  g.road([[22, 80], [22, 72]], 3, ":", "._");

  // ---- 1. Pradera (filas 80-99) ----
  g.road([[18, 99], [18, 95], [12.5, 90], [12.5, 86], [19, 82], [22, 80]], 3, ":");
  g.ellipse(24, 92, 4, 2.5, '"', ".", 21);
  g.ellipse(7, 84, 2.5, 3, '"', ".", 22);
  g.ellipse(27, 84, 3, 2, '"', ".", 23);
  g.rect(20, 88, 10, 1, "^");
  g.rect(4, 94, 8, 1, "^");
  g.scatter(4, 80, 28, 19, ",", 0.05, 25);
  [[6, 97], [30, 97], [16, 91], [29, 81], [5, 88], [24, 86]].forEach(([x, y]) => g.set(x, y, "t"));
  [[9, 92], [26, 95]].forEach(([x, y]) => g.set(x, y, "o"));
  return g.rows();
}

export default {
  id: "ruta1",
  name: "Ruta 1",
  subtitle: "Calzada del Ámbar",
  kind: "route",
  between: ["ashfen", "valkeep"],
  biome: "temperate",
  music: "road",
  grid: build(),
  objects: [
    { type: "sign", x: 20.4, y: 96.5, text: ["RUTA 1 · CALZADA DEL ÁMBAR", "↑ Valkeep   ↓ Ashfen"] },
    { type: "sign", x: 23.6, y: 69.2, text: ["RETÉN DE LA CORONA", "Toda carga de piedras se declara. Por orden del Gremio."] },
    { type: "sign", x: 19.6, y: 68, text: ["(Alguien rayó una flecha hacia el bosque.)", "Abajo dice: \"por aquí no revisan\"."] },
    { type: "sign", x: 20.2, y: 45.5, text: ["FARALLÓN", "La reja se abre desde arriba."] },
    { type: "barrier", id: "reten1", x: 24, y: 59.3 },
    { type: "gate", id: "gate-r1", x: 16, y: 37 },
    { type: "lever", id: "gate-r1", x: 20.5, y: 35.5 },
    { type: "bridge-rails", x0: 21, x1: 23, y0: 74, y1: 77 },
    { type: "prop", art: "tent", x: 5.2, y: 52.6, solid: [2, 12, 30, 12] },
    { type: "prop", art: "campfire", x: 8.5, y: 55.2, anim: "campfire", solid: [2, 10, 12, 6] },
    { type: "prop", art: "log", x: 10.2, y: 56.4, solid: [2, 2, 22, 7] },
    { type: "prop", art: "crate", x: 4.8, y: 57, solid: [0, 6, 14, 8] },
    { type: "chest", id: "r1-camp", x: 12.4, y: 54.2, loot: { gold: 30 } },
    { type: "chest", id: "r1-cliff", x: 9.5, y: 10.8, loot: { heart: 1 } },
    { type: "chest", id: "r1-detour", x: 31, y: 41.4, loot: { gold: 15 } },
    { type: "prop", art: "barrel", x: 27.4, y: 62.8, solid: [0, 8, 12, 7] },
    { type: "prop", art: "banner", x: 20.8, y: 57.4, solid: [0, 26, 4, 5] },
    { type: "prop", art: "banner", x: 29, y: 57.4, solid: [0, 26, 4, 5] },
    // Enemigos
    { type: "enemy", kind: "boar", x: 24, y: 92 },
    { type: "enemy", kind: "boar", x: 7, y: 84 },
    { type: "enemy", kind: "boar", x: 27, y: 35 },
    { type: "enemy", kind: "boar", x: 23, y: 24 },
    { type: "enemy", kind: "bandit", x: 8, y: 57.5 },
    { type: "enemy", kind: "bandit", x: 11, y: 53.5 },
    { type: "enemy", kind: "bandit", x: 6, y: 61, ambush: true },
    { type: "enemy", kind: "bandit", x: 11, y: 20, ambush: true },
    { type: "enemy", kind: "bandit", x: 24, y: 12, ambush: true, minCargo: 2 },
    { type: "enemy", kind: "guard", post: true, x: 23.3, y: 61.6, dir: "down", barrier: "reten1" },
    { type: "enemy", kind: "guard", post: true, x: 28.6, y: 61.6, dir: "down", barrier: "reten1" },
    { type: "enemy", kind: "guard", x: 22, y: 71, patrol: [[22, 71], [22, 66], [25.5, 63]], minHeat: 0 },
    { type: "enemy", kind: "guard", x: 22, y: 50, patrol: [[21, 49], [25.5, 54], [25.5, 57]], minHeat: 20 },
    { type: "enemy", kind: "guard", x: 22, y: 79, patrol: [[22, 80], [19, 83], [22, 80]], minHeat: 45 },
    { type: "npc", cast: "villager3", name: "Arriero", x: 20.4, y: 30.5, dir: "down", talk: ["¿Viste la palanca junto a la reja?", "Ábrela y el próximo viaje te ahorras el rodeo."] },
  ],
  exits: [
    { x: 16, y: 99, w: 4, h: 1, to: "ashfen", entry: "north" },
    { x: 15, y: 0, w: 5, h: 1, to: "valkeep", entry: "south" },
  ],
  entries: {
    south: { x: 18, y: 98.2, dir: "up" },
    north: { x: 17.5, y: 1.4, dir: "down" },
  },
};
