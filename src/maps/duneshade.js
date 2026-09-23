/** Duneshade: pueblo de adobe junto a un oasis. Oeste → Ruta 3 (Verdelume). Sur → Ruta 4 (Frostholm). */

import { Grid } from "./grid.js";

const W = 40;
const H = 30;

function build() {
  const g = new Grid(W, H, ".");
  // Dunas y rocas alrededor.
  for (let x = 0; x < W; x += 1) {
    g.set(x, 0, "x");
    if (x % 3 === 0) g.set(x, 1, "O");
    if (x % 4 === 1) g.set(x, 2, "k");
  }
  for (let y = 0; y < H; y += 1) {
    g.set(W - 1, y, "x");
    if (y % 3 === 1) g.set(W - 2, y, "O");
    if (y % 4 === 2) g.set(W - 3, y, "k");
  }
  g.rect(0, 0, 1, 12, "x");
  g.rect(0, 19, 1, 11, "x");
  g.rect(0, H - 1, 17, 1, "x");
  g.rect(23, H - 1, 17, 1, "x");
  // Caminos: oeste → plaza → sur.
  g.road([[0, 15.5], [8, 15.5], [14, 13]], 4, ":");
  g.road([[20, 17], [20, 24], [19.5, 30]], 4, ":");
  // Plaza
  g.rect(13, 8, 14, 9, "=");
  // Oasis con palmeras
  g.ellipse(31, 20, 4, 2.6, "~");
  g.ellipse(31, 20, 5.5, 3.8, "v", ".");
  [[26, 18], [36, 18], [27, 23], [35, 23], [31, 16]].forEach(([x, y]) => g.set(x, y, "p"));
  // Patio de tiro de la arquera (suroeste)
  g.rect(3, 21, 9, 6, "_");
  g.rect(3, 20, 9, 1, "f");
  // Cactus, matas secas y rocas sueltas
  g.scatter(2, 3, 35, 25, "d", 0.05, 4);
  [[11, 4], [33, 8], [9, 9], [36, 27]].forEach(([x, y]) => g.set(x, y, "k"));
  [[4, 8], [35, 11], [14, 24]].forEach(([x, y]) => g.set(x, y, "o"));
  return g.rows();
}

export default {
  id: "duneshade",
  name: "Duneshade",
  subtitle: "Mar de dunas",
  kind: "town",
  town: "duneshade",
  biome: "desert",
  music: "duneshade",
  ambience: "desert",
  grid: build(),
  objects: [
    { type: "house", art: "house-adobe", x: 3, y: 3.4 },
    { type: "house", art: "house-adobe-b", x: 28, y: 3.2 },
    { type: "house", art: "house-adobe", x: 22.5, y: 3 },
    { type: "house", art: "house-adobe-b", x: 5, y: 10.6 },
    { type: "house", art: "house-adobe", x: 24.6, y: 24.4 },
    { type: "stall", art: "stall-sun", x: 17.5, y: 8 },
    { type: "prop", art: "lamp", x: 13, y: 7.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 26.4, y: 7.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 13, y: 15.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 26.4, y: 15.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "barrel", x: 16, y: 9.4, solid: [0, 8, 12, 7] },
    { type: "prop", art: "crate", x: 21.2, y: 9.4, solid: [0, 6, 14, 8] },
    { type: "prop", art: "target", x: 4, y: 22.2, solid: [4, 18, 10, 6] },
    { type: "prop", art: "target", x: 7, y: 21.6, solid: [4, 18, 10, 6] },
    { type: "prop", art: "hay", x: 10, y: 22.5, solid: [0, 4, 18, 8] },
    { type: "sign", x: 3.6, y: 13.4, text: ["DUNESHADE", "← Ruta 3 · Verdelume   ↓ Ruta 4 · Frostholm"] },
    { type: "sign", x: 22.6, y: 27.4, text: ["↓ RUTA 4 · PASO DEL HIELO", "Del desierto a la nieve en un día de camino."] },
    {
      type: "npc", cast: "merchant", name: "Kader", x: 21.3, y: 10.4, dir: "down", role: "market",
      talk: ["Piedra solar: guarda el calor del mediodía.", "En Frostholm la necesitan para no helarse."],
    },
    {
      type: "npc", cast: "archer", name: "Sahra", x: 8.6, y: 25.2, dir: "up", role: "escort",
      talk: ["No escolto a cualquiera por el desierto."],
    },
    { type: "npc", cast: "desertfolk", name: "Yusra", x: 17, y: 20, dir: "right", wander: 3, talk: ["Las perlas de lluvia llenan nuestros pozos.", "Si traes de Verdelume, se venden en un suspiro."] },
    { type: "npc", cast: "desertfolk", name: "Omar", x: 31, y: 13.6, dir: "down", wander: 2, talk: ["En la arena se esconden escorpiones.", "Si ves la arena temblar, no pises ahí."] },
    { type: "npc", cast: "villager", name: "Nasr", x: 25.2, y: 12.2, dir: "down", role: "inn", talk: ["Posada del Oasis. Agua fresca para quien pague."] },
    { type: "npc", cast: "guard", name: "Guardia", x: 14.2, y: 16.6, dir: "down", role: "townguard", talk: ["En el desierto no hay dónde esconderse.", "Nuestras patrullas ven de lejos."] },
  ],
  exits: [
    { x: 0, y: 12, w: 1, h: 7, to: "ruta3", entry: "east" },
    { x: 17, y: 29, w: 6, h: 1, to: "ruta4", entry: "north" },
  ],
  entries: {
    west: { x: 1.4, y: 15.6, dir: "right" },
    south: { x: 19.6, y: 28.2, dir: "up" },
    start: { x: 20, y: 17.4, dir: "down" },
  },
};
