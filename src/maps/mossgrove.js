/**
 * Mossgrove: pueblo de leñadores en un claro del bosque, entre el desierto y la nieve.
 * Norte → Ruta 5 (Duneshade). Sur → Ruta 4 (Frostholm). No saca piedra: compra y vende de todo.
 */

import { Grid } from "./grid.js";

const W = 40;
const H = 30;

function build() {
  const g = new Grid(W, H, ".");
  // Bosque cerrado alrededor: árboles tupidos y pinos viejos.
  g.rect(0, 0, W, 4, "T");
  g.forestEdges(3, 6, 53, "lr");
  g.rect(0, 26, W, 4, "T");
  for (const [x, y] of [[1, 5], [2, 9], [37, 7], [38, 12], [1, 16], [37, 20], [2, 23], [36, 24]]) g.set(x, y, "P");
  // Caminos: norte → plaza → sur.
  g.road([[18.5, 0], [18.5, 7], [19, 10]], 3, ":");
  g.road([[19.5, 18], [19, 24], [19.5, 30]], 3, ":");
  g.road([[26, 14], [31, 16], [31, 19]], 2, ":");
  // Plaza de adoquín en el claro.
  g.rect(13, 10, 14, 8, "=");
  // Islas de bosque dentro del claro, helechos y pasto alto.
  g.rect(33, 4, 3, 3, "T");
  g.rect(8, 22, 4, 3, "T");
  g.scatter(6, 4, 28, 21, "e", 0.05, 11);
  [[10, 12], [29, 9], [25, 22], [14, 6], [33, 21]].forEach(([x, y]) => g.set(x, y, "t"));
  [[11, 5], [30, 23]].forEach(([x, y]) => g.set(x, y, "P"));
  g.ellipse(32, 11, 2, 1.5, '"', ".", 12);
  g.ellipse(9, 16, 2, 1.5, '"', ".", 13);
  // Leña apilada junto a la plaza.
  [[27, 11], [27, 12]].forEach(([x, y]) => g.set(x, y, "h"));
  // Salidas limpias.
  g.rect(16, 0, 6, 2, ":");
  g.rect(17, 28, 6, 2, ":");
  return g.rows();
}

export default {
  id: "mossgrove",
  name: "Mossgrove",
  subtitle: "Bosque de musgo",
  kind: "town",
  town: "mossgrove",
  biome: "temperate",
  music: "verdelume",
  ambience: "jungle",
  grid: build(),
  objects: [
    { type: "house", art: "house-moss", x: 4.5, y: 5.2 },
    { type: "house", art: "house-moss-b", x: 27.5, y: 4.4 },
    { type: "house", art: "house-moss", x: 3.5, y: 17.4 },
    { type: "house", art: "house-moss-b", x: 28.5, y: 19.6 },
    { type: "house", art: "house-moss", x: 12.5, y: 20.2 },
    { type: "stall", art: "stall-green", x: 17.5, y: 10 },
    { type: "well", x: 23.5, y: 14.2 },
    { type: "prop", art: "lamp", x: 13, y: 9.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 25.4, y: 9.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 13, y: 16.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 25.4, y: 16.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "barrel", x: 16, y: 11.4, solid: [0, 8, 12, 7] },
    { type: "prop", art: "crate", x: 21.2, y: 11.4, solid: [0, 6, 14, 8] },
    { type: "sign", x: 21.4, y: 25.4, text: ["MOSSGROVE", "↑ Ruta 5 · Duneshade   ↓ Ruta 4 · Frostholm"] },
    { type: "sign", x: 21.4, y: 3.4, text: ["MOSSGROVE · BOSQUE DE MUSGO", "Aquí nadie saca piedra: todos comercian."] },
    {
      type: "npc", cast: "merchant", name: "Ilse", x: 21.3, y: 12.4, dir: "down", role: "market",
      talk: ["Aquí no sacamos piedra: la compramos y la vendemos toda.", "Lo que hoy me sobra, mañana me falta. Así es el bosque."],
    },
    { type: "npc", cast: "villager", name: "Rowan", x: 15.4, y: 13.6, dir: "right", role: "inn", talk: ["Posada del Musgo. Cama de paja y sopa de hongos."] },
    { type: "npc", cast: "stablehand", name: "Brann", x: 30, y: 13, dir: "left", wander: 3, talk: ["Leñador de toda la vida.", "Del desierto baja gente con piedra solar; de la nieve, con escarcha. Aquí se cruzan."] },
    { type: "npc", cast: "villager3", name: "Maela", x: 9, y: 10, dir: "right", wander: 3, talk: ["Al sur empieza el hielo. Dicen que el lago se patina.", "Yo no me acerco: la Puerta de la Escarcha revisa todo."] },
    { type: "npc", cast: "guard", name: "Guardia", x: 14.2, y: 17.6, dir: "down", role: "townguard", talk: ["La Corona casi no sube hasta el bosque.", "Pero en los caminos sí revisa."] },
  ],
  exits: [
    { x: 16, y: 0, w: 6, h: 1, to: "ruta5", entry: "south" },
    { x: 17, y: 29, w: 6, h: 1, to: "ruta4", entry: "north" },
  ],
  entries: {
    north: { x: 18.5, y: 1.6, dir: "down" },
    south: { x: 19.5, y: 28.2, dir: "up" },
    start: { x: 19.5, y: 18.4, dir: "down" },
  },
};
