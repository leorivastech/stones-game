/**
 * Ruta 3 · Selva del Tránsito (Verdelume ↔ Duneshade). 96×36 celdas, de oeste (Verdelume) a este (Duneshade).
 *
 *  1. Selva (x 0-44): cerrada; río con puente; pasto alto con emboscadas; campamento de bandidos
 *     detrás de arbustos (cofre); alijo en tronco hueco.
 *     Dos refugios escondidos (26-sep): la tierra de Aurelio, selva adentro al sur del camino (arbusto
 *     junto a unas flores de luna → vereda que da vueltas → claro con la reja), y la choza del manglar,
 *     en un estero al norte (arbusto junto a una piedra marcada → vereda → tablones hasta el islote).
 *  2. Borde (44-52): la selva se abre y aparece la arena.
 *  3. Desierto (52-95): abierto. Las patrullas ven lejos: hay que ir de roca en roca.
 *     Escorpiones escondidos en la arena. Oasis con palmeras y un alijo en roca partida.
 */

import { Grid } from "./grid.js";
import { hash } from "../art/pixel.js";

const W = 96;
const H = 36;

// Frontera ondulada y continua (el ruido por celda dejaba un tablero de cuadros).
const biomeAt = (cx, cy) => (cx < 48 + Math.sin(cy * 0.7) * 1.4 + Math.sin(cy * 0.23 + 1) * 2 ? "tropical" : "desert");

function build() {
  const g = new Grid(W, H, ".");
  // Bandas de selva arriba y abajo (en el desierto: dunas altas con rocas).
  for (let x = 0; x < W; x += 1) {
    const top = 3 + Math.floor(hash(x >> 1, 0, 12) * 3);
    const bot = 3 + Math.floor(hash(x >> 1, 1, 12) * 3);
    const ch = x < 46 ? "T" : "O";
    for (let y = 0; y < top; y += 1) if (ch === "T" || (x + y) % 3 === 0) g.set(x, y, ch);
    for (let y = H - bot; y < H; y += 1) if (ch === "T" || (x + y) % 3 === 0) g.set(x, y, ch);
    if (ch === "O") { g.rect(x, 0, 1, 1, "x"); g.rect(x, H - 1, 1, 1, "x"); }
  }

  // ---- 1. Selva ----
  g.road([[0, 17.5], [10, 17], [18, 20], [26, 17], [36, 18], [46, 16]], 3, ":");
  g.rect(3, 4, 12, 8, "T");
  g.rect(4, 23, 14, 8, "T");
  g.rect(26, 22, 16, 9, "T");
  // Río que baja de norte a sur, con puente.
  g.rect(20, 0, 3, H, "~");
  g.rect(19, 0, 1, H, "_", ".T");
  g.rect(23, 0, 1, H, "_", ".T");
  g.rect(19, 18, 5, 4, "B");
  // Campamento de bandidos: claro al norte, tras arbustos.
  g.rect(27, 3, 15, 11, "T");
  g.ellipse(34, 8.5, 5, 3.5, ":");
  g.road([[33, 12], [33, 15.5]], 2, ":");
  g.rect(32, 13, 3, 1, "b");
  g.ellipse(9, 14, 3, 2, '"', ".", 3);
  g.ellipse(14, 22, 3, 1.5, '"', ".", 4);
  g.ellipse(29, 19.5, 3, 1.5, '"', ".", 5);
  g.ellipse(40, 13, 3, 2, '"', ".", 6);
  g.scatter(1, 4, 44, 28, "e", 0.05, 7);

  // ---- Refugios escondidos (26-sep) ----
  // Tierra de Aurelio: selva adentro, al sur del camino. Se entra cortando un arbusto en el pasto
  // alto (junto a unas flores de luna) y se sigue una vereda de una celda que da vueltas entre los
  // árboles hasta un claro con la reja y el campesino.
  g.rect(0, 22, 19, 11, "T", '.e"');
  g.trail([[15, 22], [15, 25], [11, 25], [11, 27], [13, 27], [13, 30]]);
  g.rect(4, 29, 9, 3, ".");
  g.set(15, 22, "b");
  g.rect(14, 21, 3, 1, ".");
  // Choza del manglar: un estero escondido en la selva del norte. Otro arbusto en el pasto alto,
  // una vereda y unos tablones sobre el agua hasta el islote.
  g.rect(0, 0, 19, 12, "T", '.e"');
  g.ellipse(11.5, 4, 4.6, 3, "~", "T");
  g.rect(10, 2, 4, 3, ".");
  g.rect(12, 5, 1, 3, "B");
  g.trail([[12, 8], [12, 9], [7, 9], [7, 11]]);
  g.set(7, 11, "b");

  // ---- 2-3. Borde y desierto ----
  g.road([[46, 16], [58, 18], [70, 17], [82, 19], [96, 17.5]], 3, ":");
  // Rocas de cubierta a lo largo de la calzada.
  [[55, 13], [60, 22], [64, 14], [69, 21], [74, 13], [78, 22], [84, 14], [88, 21]].forEach(([x, y]) => g.set(x, y, "O"));
  [[52, 10], [57, 26], [66, 9], [72, 27], [80, 9], [86, 26], [91, 11]].forEach(([x, y]) => g.set(x, y, "o"));
  g.scatter(50, 5, 44, 26, "k", 0.03, 8);
  g.scatter(50, 5, 44, 26, "d", 0.05, 9);
  // Oasis
  g.ellipse(72, 8.5, 4.5, 2.6, "~");
  g.ellipse(72, 8.5, 6, 3.6, "v", ".d");
  [[66, 7], [78, 7], [68, 11], [77, 11]].forEach(([x, y]) => g.set(x, y, "p"));
  g.ellipse(88, 25, 2.5, 1.5, '"', ".", 10);
  return g.rows();
}

export default {
  id: "ruta3",
  name: "Ruta 3",
  subtitle: "Selva del Tránsito",
  kind: "route",
  between: ["verdelume", "duneshade"],
  biome: "tropical",
  biomeAt,
  music: "road-desert",
  ambience: "jungle",
  grid: build(),
  objects: [
    { type: "sign", x: 4, y: 15.6, text: ["RUTA 3 · SELVA DEL TRÁNSITO", "← Verdelume   → Duneshade"] },
    { type: "sign", x: 49, y: 13.8, text: ["FIN DE LA SELVA", "La Corona patrulla el desierto: a pleno sol se ve todo."] },
    // Refugios escondidos: sin letrero. Pistas: flores de luna y una piedra marcada junto a cada arbusto.
    { type: "refuge", id: "refugio-r3", x: 8, y: 29.3 },
    {
      type: "npc", cast: "villager3", name: "Aurelio", x: 10.8, y: 30.4, dir: "left", role: "landseller",
      talk: ["¡Me encontraste! Pocos llegan hasta aquí.", "Detrás de esa reja tengo un claro que nadie conoce.", "Ni la Corona. Ni los bandidos."],
    },
    { type: "prop", art: "rare-flowers", x: 14.8, y: 19.55 },
    { type: "refuge", id: "refugio-r3b", x: 12.5, y: 4.7 },
    { type: "prop", art: "marked-stone", x: 5.5, y: 12.1 },
    { type: "prop", art: "tent", x: 31.5, y: 5.2, solid: [2, 12, 30, 12] },
    { type: "prop", art: "campfire", x: 34.5, y: 8, anim: "campfire", solid: [2, 10, 12, 6] },
    { type: "chest", id: "r3-camp", x: 37.4, y: 8.4, loot: { gold: 35 } },
    // Selva
    { type: "enemy", kind: "bandit", x: 9, y: 14, ambush: true },
    { type: "enemy", kind: "bandit", x: 29, y: 19.5, ambush: true },
    { type: "enemy", kind: "bandit", x: 33, y: 9 },
    { type: "enemy", kind: "bandit", x: 36, y: 10 },
    { type: "enemy", kind: "boar", x: 12, y: 20.4 },
    // Desierto
    { type: "enemy", kind: "guard", x: 60, y: 18, patrol: [[56, 18], [66, 17.5]], minHeat: 0 },
    { type: "enemy", kind: "guard", x: 80, y: 18, patrol: [[76, 18], [88, 19]], minHeat: 0 },
    { type: "enemy", kind: "guard", x: 70, y: 22, patrol: [[64, 23], [74, 23]], minHeat: 25 },
    { type: "enemy", kind: "scorpion", x: 62, y: 11 },
    { type: "enemy", kind: "scorpion", x: 76, y: 24 },
    { type: "enemy", kind: "scorpion", x: 86, y: 12 },
  ],
  exits: [
    { x: 0, y: 15, w: 1, h: 6, to: "verdelume", entry: "east" },
    { x: 95, y: 15, w: 1, h: 6, to: "duneshade", entry: "west" },
  ],
  entries: {
    west: { x: 1.4, y: 17.8, dir: "right" },
    east: { x: 94.4, y: 17.8, dir: "left" },
    refugio: { x: 8, y: 30.4, dir: "down" },
    "refugio-r3b": { x: 12.5, y: 5.7, dir: "down" },
  },
};
