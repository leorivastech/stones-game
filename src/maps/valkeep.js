/** Valkeep: pueblo de piedra en las faldas. Entra por el sur desde la Ruta 1; el paso norte está derrumbado. */

import { Grid } from "./grid.js";

const W = 40;
const H = 30;

function build() {
  const g = new Grid(W, H, ".");
  // Farallón al norte con pinos arriba; paso norte (derrumbe) en el centro.
  g.rect(0, 0, W, 3, "P");
  g.rect(0, 3, W, 2, "#");
  g.rect(17, 0, 6, 5, ":");
  g.rect(0, 5, 3, 25, "P");
  g.rect(3, 5, 1, 12, "#");
  g.rect(W - 3, 5, 3, 25, "P");
  g.rect(W - 4, 5, 1, 10, "#");
  g.forestEdges(3, 4, 31);
  // Terraza oeste: farallón bajo detrás de la primera casa.
  g.rect(4, 12, 8, 2, "#");
  g.ellipse(9, 9, 3, 2, "g", ".", 5);
  g.ellipse(31, 12, 3, 2.5, "g", ".", 6);
  g.ellipse(8, 25, 2.5, 1.5, "g", ".", 7);
  // Camino sur → plaza → norte
  g.road([[19.5, 30], [19.5, 24], [20, 19]], 4, ":");
  g.road([[20, 11], [20, 5]], 3, ":");
  g.rect(14, 11, 12, 8, "=");
  g.road([[26, 16], [31, 21.5]], 2, ":");
  // Pasto alto, rocas y pinos sueltos
  g.ellipse(8, 22, 3, 2, '"', ".g", 7);
  g.ellipse(33, 9, 2, 2, '"', ".g", 8);
  [[6, 11], [30, 6], [35, 13], [25, 26], [5, 27], [14, 26]].forEach(([x, y]) => g.set(x, y, "o"));
  [[11, 7], [34, 25], [8, 26], [30, 27], [12, 10]].forEach(([x, y]) => g.set(x, y, "P"));
  g.set(24, 6, "O");
  g.rect(27, 24, 7, 1, "f");
  return g.rows();
}

export default {
  id: "valkeep",
  name: "Valkeep",
  subtitle: "Faldas de montaña",
  kind: "town",
  town: "valkeep",
  biome: "mountain",
  music: "valkeep",
  grid: build(),
  objects: [
    { type: "house", art: "house-slate", x: 5, y: 5.6 },
    { type: "house", art: "house-slate-b", x: 26, y: 5.4 },
    { type: "house", art: "house-slate", x: 5, y: 14.6 },
    { type: "house", art: "house-slate-b", x: 13, y: 20 },
    { type: "house", art: "house-stable", x: 29.5, y: 16.2 },
    { type: "house", art: "house-slate", x: 22, y: 20.5 },
    { type: "stall", art: "stall-rune", x: 17.5, y: 11 },
    { type: "well", x: 22.6, y: 15.2 },
    { type: "prop", art: "lamp", x: 14, y: 10.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 25.4, y: 10.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 14, y: 17.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 25.4, y: 17.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "banner", x: 16.4, y: 8.8, solid: [0, 26, 4, 5] },
    { type: "prop", art: "banner", x: 23, y: 8.8, solid: [0, 26, 4, 5] },
    { type: "prop", art: "rubble", x: 17, y: 2.6, solid: [0, 8, 56, 26] },
    { type: "prop", art: "barrel", x: 16, y: 12.4, solid: [0, 8, 12, 7] },
    { type: "prop", art: "crate", x: 21.3, y: 11.4, solid: [0, 6, 14, 8] },
    { type: "prop", art: "hay", x: 34, y: 22, solid: [0, 4, 18, 8] },
    { type: "prop", art: "hay", x: 27.4, y: 22.4, solid: [0, 4, 18, 8] },
    { type: "sign", x: 21.8, y: 6.4, text: ["PASO DE VERDELUME", "Derrumbe. Cerrado hasta nuevo aviso."] },
    { type: "sign", x: 22, y: 27.4, text: ["VALKEEP", "↓ Ruta 1 · Ashfen"] },
    {
      type: "npc", cast: "merchant", name: "Maese Ivo", x: 21.3, y: 13.4, dir: "down", role: "market",
      talk: ["Vidrio rúnico, fundido por los escribas.", "Traigan ámbar: aquí se paga."],
    },
    {
      type: "npc", cast: "stablehand", name: "Nella", x: 32.4, y: 22.2, dir: "left", role: "stable",
      talk: ["Mis caballos no cargan para cualquiera."],
    },
    { type: "npc", cast: "villager", name: "Anselmo", x: 11, y: 18.5, dir: "right", wander: 3, talk: ["Desde el derrumbe nadie baja a la selva.", "Dicen que Verdelume paga el vidrio rúnico a precio de oro."] },
    { type: "npc", cast: "villager2", name: "Pía", x: 26, y: 26, dir: "left", wander: 3, talk: ["Los jabalíes del farallón embisten en línea recta.", "Hazte a un lado y chocan contra la roca."] },
    { type: "npc", cast: "guard", name: "Guardia", x: 15.2, y: 18.8, dir: "down", role: "townguard", talk: ["El retén de la calzada es del Gremio.", "Nosotros sólo cuidamos la plaza."] },
  ],
  exits: [{ x: 17, y: 29, w: 5, h: 1, to: "ruta1", entry: "north" }],
  entries: {
    south: { x: 19.5, y: 28.2, dir: "up" },
    start: { x: 19.5, y: 19.6, dir: "up" },
  },
};
