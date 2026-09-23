/** Ashfen: pueblo de campos en la costa del golfo. Sale al norte hacia la Ruta 1. */

import { Grid } from "./grid.js";

const W = 40;
const H = 30;

function build() {
  const g = new Grid(W, H, ".");
  // Bosque al norte y a los lados; montañas cerradas al oeste.
  g.rect(0, 0, W, 2, "T");
  g.forestEdges(1, 3, 21, "r");
  g.rect(0, 2, 2, 20, "T");
  g.rect(0, 3, 4, 8, "#");
  g.rect(4, 3, 1, 2, "T");
  g.set(4, 5, "o");
  g.rect(0, 11, 1, 11, "#");
  // Camino norte → plaza → muelle; ramal al paso cerrado del oeste.
  g.road([[19.5, 0], [19.5, 4], [18.5, 8], [19.5, 11]], 4, ":");
  g.road([[19.5, 17], [19.5, 23]], 3, ":");
  g.road([[1, 14.5], [8, 14.5], [14, 14]], 2, ":");
  // Plaza
  g.rect(14, 11, 12, 7, "=");
  // Cultivos con cerca
  g.rect(3, 10, 7, 4, "F");
  g.rect(2, 15, 9, 1, "f");
  g.rect(10, 9, 1, 6, "|");
  g.set(2, 12, "h");
  // Pasto alto, flores y árboles sueltos
  g.ellipse(12, 3.5, 3, 1.3, '"');
  g.ellipse(27, 3, 3, 1.2, '"');
  g.ellipse(34, 13, 2, 2, '"', ".", 9);
  g.scatter(2, 2, 36, 20, ",", 0.035, 5);
  g.ellipse(9, 21, 2, 1, ",");
  g.ellipse(24, 21, 2, 1, ",");
  [[6, 3], [31, 3], [36, 7], [24, 9], [12, 8], [37, 17], [3, 21], [13, 22]].forEach(([x, y]) => g.set(x, y, "t"));
  // Playa y mar
  g.rect(0, 23, W, 2, "_");
  g.rect(0, 25, W, 5, "~");
  g.rect(6, 25, 6, 1, "_");
  g.rect(22, 25, 6, 1, "_");
  g.rect(8, 26, 2, 1, "_");
  g.rect(19, 24, 2, 4, "B");
  g.rect(18, 22, 4, 1, ":");
  g.set(15, 23, "r");
  g.set(24, 24, "c");
  return g.rows();
}

export default {
  id: "ashfen",
  name: "Ashfen",
  subtitle: "Tierras templadas",
  kind: "town",
  town: "ashfen",
  biome: "temperate",
  music: "ashfen",
  grid: build(),
  objects: [
    { type: "house", art: "house-thatch", x: 6, y: 5 },
    { type: "house", art: "house-thatch-b", x: 24, y: 5 },
    { type: "house", art: "house-red", x: 30, y: 7 },
    { type: "house", art: "house-smithy", x: 30, y: 12 },
    { type: "house", art: "house-thatch", x: 4, y: 17 },
    { type: "house", art: "house-red", x: 10, y: 17 },
    { type: "house", art: "house-thatch-b", x: 29, y: 18 },
    { type: "stall", art: "stall-amber", x: 17.5, y: 11 },
    { type: "prop", art: "forge", x: 27.2, y: 13, solid: [4, 14, 24, 14], anim: "forge" },
    { type: "prop", art: "anvil", x: 26.6, y: 15.4, solid: [1, 4, 14, 6] },
    { type: "well", x: 15, y: 15 },
    { type: "prop", art: "lamp", x: 14, y: 10.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 25.4, y: 10.5, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 14, y: 16.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "lamp", x: 25.4, y: 16.4, solid: [2, 22, 6, 5] },
    { type: "prop", art: "banner", x: 16.6, y: 8.5, solid: [0, 26, 4, 5] },
    { type: "prop", art: "banner", x: 22.2, y: 8.5, solid: [0, 26, 4, 5] },
    { type: "prop", art: "barrel", x: 21.2, y: 11.2, solid: [0, 8, 12, 7] },
    { type: "prop", art: "crate", x: 16.2, y: 12.1, solid: [0, 6, 14, 8] },
    { type: "prop", art: "rubble", x: 0, y: 12.6, solid: [0, 10, 56, 24] },
    { type: "sign", x: 21.5, y: 2.5, text: ["↑ RUTA 1 · Calzada del Ámbar", "Al norte: Valkeep, pueblo de montaña."] },
    { type: "sign", x: 4, y: 13.6, text: ["PASO DE MONTAÑA", "Cerrado por derrumbe. Dicen que algún día habrá atajo."] },
    { type: "sign", x: 21.4, y: 23.4, text: ["MUELLE DE ASHFEN", "La barca de Frostholm atraca aquí cuando cruza el golfo."] },
    { type: "prop", art: "boat", x: 20.9, y: 26, onlyIf: "met-ferry" },
    {
      type: "npc", cast: "ferryman", name: "Ceno", x: 21.8, y: 23.6, dir: "left", role: "ferry", onlyIf: "met-ferry",
      talk: ["Mi barca cruza el golfo hasta Frostholm."],
    },
    {
      type: "npc", cast: "merchant", name: "Brena", x: 21.2, y: 13.2, dir: "down", role: "market",
      talk: ["Ámbar de sello, recién sacado de la cantera.", "Valkeep lo paga mejor que nadie. Pero ojo con la calzada."],
    },
    {
      type: "npc", cast: "smith", name: "Oskar", x: 28.4, y: 16.2, dir: "down", role: "smith",
      talk: ["No trabajo para desconocidos."],
    },
    {
      type: "npc", cast: "villager2", name: "Tomasa", x: 17.4, y: 5.4, dir: "down", role: "tutorial",
      talk: [
        "¿Vas a la calzada? Escucha a esta vieja.",
        "Con J o ESPACIO golpeas con el bastón. Sirve también para cortar pasto y arbustos.",
        "K o SHIFT: si lo tocas, ruedas. Si lo mantienes, corres.",
        "L o C te agacha. En el pasto alto nadie te ve.",
        "Los guardias de la Corona revisan a quien lleva piedras a la vista. Los bandidos, en cambio, te las arrancan.",
      ],
    },
    { type: "npc", cast: "villager", name: "Iván", x: 12, y: 16.5, dir: "right", wander: 3, talk: ["El calor de la Corona sube cada vez que alguien vende en la plaza.", "Si viajas a otros pueblos, se enfría."] },
    { type: "npc", cast: "villager3", name: "Rula", x: 26, y: 21, dir: "left", wander: 3, talk: ["Mi hermano cruzó el monte sin pasar el retén.", "Volvió sin botas, pero con toda la carga."] },
    { type: "npc", cast: "villager", name: "Marta", x: 24.6, y: 13.4, dir: "down", role: "inn", talk: ["Posada del Ámbar. Cama y guiso, tres de oro la noche."] },
    { type: "npc", cast: "guard", name: "Guardia", x: 24.4, y: 17.6, dir: "down", role: "townguard", talk: ["En el pueblo no hay problema. En la calzada, sí.", "Quien lleva piedras a la vista, se revisa."] },
  ],
  exits: [{ x: 18, y: 0, w: 4, h: 1, to: "ruta1", entry: "south" }],
  entries: {
    north: { x: 19.5, y: 1.6, dir: "down" },
    start: { x: 19.5, y: 16.6, dir: "up" },
    dock: { x: 19.5, y: 23.2, dir: "up" },
  },
};
