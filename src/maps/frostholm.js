/** Frostholm: pueblo de nieve en la costa este del golfo. Norte → Ruta 4 (Duneshade). Sur: muelle y barca a Ashfen. */

import { Grid } from "./grid.js";

const W = 40;
const H = 30;

function build() {
  const g = new Grid(W, H, ".");
  // Pinos nevados al norte y a los lados; farallón con el túnel viejo al oeste.
  g.rect(0, 0, W, 2, "T");
  g.forestEdges(1, 3, 51, "r");
  g.rect(0, 2, 3, 18, "T");
  g.rect(0, 8, 5, 5, "#");
  // Caminos: norte → plaza → muelle.
  g.road([[19.5, 0], [19.5, 6], [19, 10]], 4, ":");
  g.road([[19.5, 17], [19.5, 22]], 3, ":");
  g.road([[5, 13.5], [13, 13.5]], 2, ":");
  // Plaza
  g.rect(13, 9, 13, 8, "=");
  // Estanque helado (adorno)
  g.ellipse(32, 11, 3, 2, "i");
  // Costa, muelle y golfo
  g.rect(0, 22, W, 2, "_");
  g.rect(0, 24, W, 6, "~");
  g.rect(4, 23, 5, 1, "~");
  g.rect(30, 23, 6, 1, "~");
  g.rect(19, 22, 2, 6, "B");
  // Nieve alta, árboles pelados, rocas
  [[34, 7], [11, 19], [30, 20], [25, 3]].forEach(([x, y]) => g.set(x, y, "y"));
  [[12, 20], [27, 20], [36, 15]].forEach(([x, y]) => g.set(x, y, "o"));
  return g.rows();
}

export default {
  id: "frostholm",
  name: "Frostholm",
  subtitle: "Paso nevado",
  kind: "town",
  town: "frostholm",
  biome: "snow",
  music: "valkeep",
  grid: build(),
  objects: [
    { type: "house", art: "house-snow", x: 4.5, y: 2.2 },
    { type: "house", art: "house-snow-b", x: 27, y: 2.4 },
    { type: "house", art: "house-snow", x: 5, y: 15.6 },
    { type: "house", art: "house-snow-b", x: 28, y: 14.8 },
    { type: "house", art: "house-snow", x: 10, y: 2.4 },
    { type: "stall", art: "stall-frost", x: 17.5, y: 9 },
    { type: "well", x: 22.5, y: 13.2 },
    { type: "prop", art: "lamp", x: 13, y: 8.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 25.4, y: 8.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 13, y: 15.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 25.4, y: 15.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "crate", x: 16, y: 10.4, solid: [0, 6, 14, 8] },
    { type: "prop", art: "barrel", x: 21.2, y: 10.4, solid: [0, 8, 12, 7] },
    { type: "prop", art: "boat", x: 20.9, y: 25.2 },
    { type: "prop", art: "rubble", x: 0.2, y: 11.2, solid: [0, 10, 56, 24] },
    { type: "bridge-rails", x0: 19, x1: 20, y0: 24, y1: 27 },
    { type: "sign", x: 22, y: 5.6, text: ["FROSTHOLM", "↑ Ruta 4 · Duneshade   ↓ Muelle · barca a Ashfen"] },
    { type: "sign", x: 6.6, y: 13, text: ["TÚNEL VIEJO", "Cerrado. Del otro lado dicen que está Verdelume."] },
    {
      type: "npc", cast: "merchant", name: "Hilde", x: 21.3, y: 11.4, dir: "down", role: "market",
      talk: ["Cristal de escarcha: conserva la comida todo el invierno.", "En Ashfen, al otro lado del golfo, lo pagan caro."],
    },
    {
      type: "npc", cast: "ferryman", name: "Ceno", x: 21.8, y: 22.4, dir: "left", role: "ferry",
      talk: ["Mi barca cruza el golfo hasta Ashfen."],
    },
    { type: "npc", cast: "snowfolk", name: "Björn", x: 16, y: 19, dir: "right", wander: 3, talk: ["La piedra solar de Duneshade nos calienta las casas.", "Sin ella, el invierno se lleva a los viejos."] },
    { type: "npc", cast: "snowfolk", name: "Ylva", x: 33, y: 13.6, dir: "left", wander: 2, talk: ["En el lago del paso te resbalas hasta chocar.", "Mira antes de moverte."] },
    { type: "npc", cast: "villager", name: "Sigrid", x: 24.8, y: 11.2, dir: "down", role: "inn", talk: ["Posada del Muelle. Hay fuego toda la noche."] },
    { type: "npc", cast: "guard", name: "Guardia", x: 14.2, y: 16.6, dir: "down", role: "townguard", talk: ["La puerta de la escarcha la cuida la Corona.", "Aquí sólo cuidamos que el muelle no se congele."] },
  ],
  exits: [{ x: 17, y: 0, w: 6, h: 1, to: "ruta4", entry: "south" }],
  entries: {
    north: { x: 19.5, y: 1.6, dir: "down" },
    dock: { x: 19.5, y: 22.6, dir: "up" },
    start: { x: 19.5, y: 17.4, dir: "up" },
  },
};
