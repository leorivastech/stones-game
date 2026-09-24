/** Verdelume: pueblo de canales en la selva. Sur → Ruta 2 (Valkeep). Este → Ruta 3 (Duneshade). */

import { Grid } from "./grid.js";

const W = 40;
const H = 30;

function build() {
  const g = new Grid(W, H, ".");
  // Selva cerrada alrededor.
  g.rect(0, 0, W, 3, "T");
  g.forestEdges(2, 3, 41, "lr");
  g.rect(0, 27, W, 3, "T");
  // Caminos: sur → plaza → este.
  g.road([[18.5, 30], [18.5, 22], [19, 16]], 4, ":");
  g.road([[26, 12], [33, 14.5], [40, 14.5]], 3, ":");
  g.road([[31, 22], [31, 25]], 2, ":");
  // Canal que cruza el pueblo, con dos puentes.
  g.rect(0, 19, W, 2, "~");
  g.rect(0, 18, W, 1, "_", ".Te");
  g.rect(0, 21, W, 1, "_", ".Te");
  g.rect(17, 18, 4, 4, "B");
  g.rect(30, 18, 2, 4, "B");
  // Plaza
  g.rect(13, 8, 13, 8, "=");
  // Huerto de la curandera
  g.rect(5, 23, 6, 3, "F");
  // Helechos, palmas y pasto alto
  g.scatter(3, 3, 34, 24, "e", 0.05, 5);
  [[34, 7], [9, 16], [24, 24], [11, 3]].forEach(([x, y]) => g.set(x, y, "t"));
  g.ellipse(34, 9, 2, 1.5, '"', ".", 6);
  g.ellipse(8, 11, 2, 1.5, '"', ".", 7);
  // Salida este limpia
  g.rect(36, 13, 4, 4, ":");
  return g.rows();
}

export default {
  id: "verdelume",
  name: "Verdelume",
  subtitle: "Selva de lluvia",
  kind: "town",
  town: "verdelume",
  biome: "tropical",
  music: "verdelume",
  ambience: "jungle",
  grid: build(),
  objects: [
    { type: "house", art: "house-jungle", x: 4, y: 3.2 },
    { type: "house", art: "house-jungle-b", x: 28, y: 2.8 },
    { type: "house", art: "house-jungle", x: 32.2, y: 21.6 },
    { type: "house", art: "house-jungle-b", x: 11.5, y: 21.8 },
    { type: "house", art: "house-jungle", x: 3.5, y: 12.5 },
    { type: "stall", art: "stall-rain", x: 17.5, y: 8 },
    { type: "well", x: 22.5, y: 12.2 },
    { type: "prop", art: "lamp", x: 13, y: 7.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 25.4, y: 7.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 13, y: 14.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 25.4, y: 14.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "barrel", x: 16, y: 9.4, solid: [0, 8, 12, 7] },
    { type: "prop", art: "crate", x: 21.2, y: 9.4, solid: [0, 6, 14, 8] },
    { type: "bridge-rails", x0: 17, x1: 20, y0: 19, y1: 20 },
    { type: "bridge-rails", x0: 30, x1: 31, y0: 19, y1: 20 },
    { type: "sign", x: 21.4, y: 26.4, text: ["VERDELUME", "↓ Ruta 2 · Valkeep   → Ruta 3 · Duneshade"] },
    { type: "sign", x: 35.6, y: 12.4, text: ["→ RUTA 3 · SELVA DEL TRÁNSITO", "Al final de la selva empieza el desierto."] },
    {
      type: "npc", cast: "merchant", name: "Oruba", x: 21.3, y: 10.4, dir: "down", role: "market",
      talk: ["Perlas de lluvia: guardan el agua de una tormenta entera.", "Hay días que las pagan como si fueran oro. Otros, ni quién."],
    },
    {
      type: "npc", cast: "healer", name: "Ama", x: 8, y: 22.6, dir: "down", role: "healer",
      talk: ["Raíz de la selva, hervida tres noches.", "Un trago y la herida se cierra."],
    },
    { type: "npc", cast: "villager2", name: "Teo", x: 30, y: 9, dir: "left", wander: 3, talk: ["El vidrio rúnico de Valkeep nos alumbra los canales.", "Si traes, aquí se vende rápido."] },
    { type: "npc", cast: "villager", name: "Nía", x: 16, y: 17, dir: "right", wander: 3, talk: ["En la selva del tránsito hay bandidos que duermen en el pasto.", "Si ves que el pasto se mueve solo, aléjate."] },
    { type: "npc", cast: "villager", name: "Iyá", x: 24.2, y: 10.6, dir: "down", role: "inn", talk: ["Posada del Canal. Se duerme con la lluvia."] },
    { type: "npc", cast: "guard", name: "Guardia", x: 14.2, y: 15.6, dir: "down", role: "townguard", talk: ["La Corona cobra la aduana del paso.", "Aquí sólo cuidamos que nadie se ahogue en el canal."] },
  ],
  exits: [
    { x: 16, y: 29, w: 6, h: 1, to: "ruta2", entry: "north" },
    { x: 39, y: 12, w: 1, h: 6, to: "ruta3", entry: "west" },
  ],
  entries: {
    south: { x: 18.5, y: 28.2, dir: "up" },
    east: { x: 38, y: 14.8, dir: "left" },
    start: { x: 19.5, y: 16.4, dir: "down" },
  },
};
