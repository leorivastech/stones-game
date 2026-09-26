/** Catálogo de todo el arte. Boot lo sube a Phaser; lab.html lo muestra ampliado. */

import { castSheet, flashSheet, rollSheet, koFrame, portrait, CASTS } from "./actors.js";
import { paintGround, T } from "./terrain.js";
import * as props from "./props.js";
import * as creatures from "./creatures.js";
import * as biomes from "./biomes.js";
import * as refuge from "./refuge.js";
import * as fx from "./fx.js";
import * as ui from "./ui.js";
import { fontPreview } from "./font.js";
import { Buf, strip } from "./pixel.js";
import { lightArt } from "./lights.js";
import { ambientArt } from "./ambient.js";

export function buildArt() {
  const out = [];
  const add = (key, entry) => out.push({ key, ...entry });
  for (const cast of Object.keys(CASTS)) {
    const sheet = castSheet(cast);
    add(`cast-${cast}`, sheet);
    add(`cast-${cast}-flash`, flashSheet(sheet));
    add(`ko-${cast}`, { buf: koFrame(cast) });
    add(`portrait-${cast}`, { buf: portrait(cast) });
  }
  add("roll", rollSheet());

  // Vegetación y objetos. Lo que se mece (vaivén) es una tira de 2 cuadros: 0 quieto, 1 con la copa
  // corrida 1 px. mapbuild.js la pone como sprite animado con su propio ritmo.
  const sway = (make) => strip([make(0), make(1)]);
  [0, 1, 2].forEach((v) => add(`tree-${v}`, sway((s) => props.tree(v, { sway: s }))));
  add("tree-autumn", sway((s) => props.tree(3, { autumn: true, sway: s })));
  add("pine", sway((s) => props.pine(false, s)));
  add("pine-snow", sway((s) => props.pine(true, s)));
  add("bush", { buf: props.bush() });
  add("bush-berries", { buf: props.bush(true) });
  [0, 1, 2].forEach((v) => add(`tallgrass-${v}`, props.tallGrass(v)));
  add("cutgrass", { buf: props.cutGrass() });
  add("rock", { buf: props.rock() });
  add("boulder", { buf: props.rock(true) });
  add("stump", { buf: props.stump() });
  add("log", { buf: props.log() });
  add("fence", { buf: props.fence() });
  add("fence-v", { buf: props.fence(true) });
  add("sign", { buf: props.sign() });
  add("way-sign", { buf: props.waySign() });
  add("barrel", { buf: props.barrel() });
  add("crate", { buf: props.crate() });
  add("hay", { buf: props.hay() });
  add("lamp", { buf: props.lamp() });
  add("well", { buf: props.well() });
  add("stall-amber", sway((s) => props.stall(["e2", "c4"], ["y3", "r4", "y4"], s)));
  add("stall-rune", sway((s) => props.stall(["v2", "c4"], ["v4", "v3", "b4"], s)));
  add("stall-green", sway((s) => props.stall(["g3", "c3"], ["e3", "y4", "g5"], s)));
  add("stall-rain", sway((s) => props.stall(["w2", "c4"], ["w4", "w5", "w3"], s)));
  add("stall-sun", sway((s) => props.stall(["r3", "y4"], ["y3", "y4", "r4"], s)));
  add("stall-frost", sway((s) => props.stall(["b2", "n4"], ["n3", "w5", "n4"], s)));
  add("chest", props.chest());
  add("gate", props.gate());
  add("lever", props.lever());
  add("barrier", props.barrier());
  add("tent", { buf: props.tent() });
  add("campfire", props.campfire());
  add("rubble", { buf: props.rubble() });
  add("anvil", { buf: props.anvil() });
  add("forge", props.forge());
  add("banner", sway((s) => props.banner(s)));
  add("bridge-rail", { buf: props.bridgeRail() });
  add("ledge", { buf: props.ledge() });
  add("blank16", { buf: new Buf(16, 16) });
  add("smoke", props.smoke());
  const houses = {
    "house-thatch": { roof: "thatch", wall: "plaster", seed: 1 },
    "house-thatch-b": { roof: "thatch", wall: "timber", seed: 2, w: 56, h: 58 },
    "house-red": { roof: "red", wall: "plaster", seed: 3, w: 72, h: 66 },
    "house-slate": { roof: "slate", wall: "stone", seed: 4 },
    "house-slate-b": { roof: "slate", wall: "stone", seed: 5, w: 56, h: 60, windows: 1 },
    "house-smithy": { roof: "red", wall: "stone", seed: 6, w: 64, h: 62, chimney: true },
    "house-stable": { roof: "moss", wall: "timber", seed: 7, w: 80, h: 60, chimney: false },
    // Selva: madera y palma, sin chimenea.
    "house-jungle": { roof: "palm", wall: "timber", seed: 8, w: 60, h: 60, chimney: false },
    "house-jungle-b": { roof: "palm", wall: "timber", seed: 9, w: 52, h: 56, chimney: false, windows: 1 },
    // Desierto: adobe y teja de barro.
    "house-adobe": { roof: "clay", wall: "adobe", seed: 10, w: 64, h: 58, chimney: false },
    "house-adobe-b": { roof: "clay", wall: "adobe", seed: 11, w: 52, h: 54, chimney: false, windows: 1 },
    // Nieve: techo cargado de nieve.
    "house-snow": { roof: "slate", wall: "timber", seed: 12, w: 64, h: 64, snowRoof: true },
    "house-snow-b": { roof: "red", wall: "stone", seed: 13, w: 56, h: 60, snowRoof: true, windows: 1 },
    // Bosque: cabañas de madera con techo de musgo.
    "house-moss": { roof: "moss", wall: "timber", seed: 14, w: 60, h: 60 },
    "house-moss-b": { roof: "moss", wall: "timber", seed: 15, w: 52, h: 56, windows: 1 },
  };
  for (const [key, spec] of Object.entries(houses)) {
    const h = props.house(spec);
    add(key, { buf: h.buf, meta: { door: h.door, roofH: h.roofH } });
  }

  // Criaturas
  add("boar", creatures.boarSheet());
  add("wolf", creatures.wolfSheet());
  add("scorpion", creatures.scorpionSheet());

  // Selva, desierto y nieve
  [0, 1].forEach((v) => add(`palm-${v}`, sway((s) => biomes.palm(v, s))));
  [0, 1].forEach((v) => add(`jungle-tree-${v}`, sway((s) => biomes.jungleTree(v, s))));
  add("fern", { buf: biomes.fern() });
  [0, 1, 2].forEach((v) => add(`cactus-${v}`, { buf: biomes.cactus(v) }));
  add("dry-bush", { buf: biomes.dryBush() });
  add("sand-rock", { buf: biomes.sandRock() });
  add("sand-boulder", { buf: biomes.sandRock(true) });
  add("bare-tree", { buf: biomes.bareTree(true) });
  add("snow-rock", { buf: biomes.snowRock() });
  add("snow-boulder", { buf: biomes.snowRock(true) });
  add("ice-block", { buf: biomes.iceBlock() });
  for (const kind of ["tree", "rock", "snow"]) add(`stash-${kind}`, biomes.stashSpot(kind));
  add("boat", { buf: biomes.boat() });
  add("target", { buf: biomes.targetDummy() });
  add("horse", creatures.horseSheet());
  // Refugios secretos.
  add("cave-door", refuge.caveDoor());
  add("cave-door-snow", refuge.caveDoor(true));
  add("shelf", refuge.shelf());
  add("cot", { buf: refuge.cot() });
  add("workbench", { buf: refuge.workbench() });

  // Efectos: el barrido se dibuja a la derecha y se rota (abajo = 1 giro, izquierda = 2, arriba = 3).
  const slash = fx.slashSheet();
  add("slash-right", slash);
  add("slash-down", fx.rotateSheet(slash, 1));
  add("slash-left", fx.rotateSheet(slash, 2));
  add("slash-up", fx.rotateSheet(slash, 3));
  const clawSlash = fx.slashSheet(["e4", "e3", "e2", "o1"]);
  add("claw-right", clawSlash);
  add("claw-down", fx.rotateSheet(clawSlash, 1));
  add("claw-left", fx.rotateSheet(clawSlash, 2));
  add("claw-up", fx.rotateSheet(clawSlash, 3));
  add("dust", fx.dustSheet());
  add("spark", fx.sparkSheet());
  add("spark-red", fx.sparkSheet("e4", "e2"));
  add("shadow", { buf: fx.shadowBlob(12, 5) });
  add("shadow-big", { buf: fx.shadowBlob(22, 6) });
  add("bubble-alert", { buf: fx.alertBubble() });
  add("bubble-ask", { buf: fx.askBubble() });
  add("bubble-talk", { buf: fx.talkBubble() });
  for (const good of Object.keys(fx.GEM_COLORS)) add(`gem-${good}`, { buf: fx.gem(good) });
  add("coin", fx.coinSheet());
  add("heart-full", { buf: fx.heartIcon(2) });
  add("heart-half", { buf: fx.heartIcon(1) });
  add("heart-empty", { buf: fx.heartIcon(0) });
  add("grass-bits", fx.grassBits());
  add("leaf-bit", { buf: fx.leafBits() });
  add("glint", fx.glintSheet());
  add("sparkle", { buf: fx.sparkleDot() });
  add("stone-burst", fx.stoneBurst());
  add("arrow", { buf: fx.arrow() });
  add("tonic", { buf: fx.tonicIcon() });

  // Interfaz
  add("ui-dark", { buf: ui.panelDark() });
  add("ui-paper", { buf: ui.panelPaper() });
  add("ui-tag", { buf: ui.panelTag() });
  add("ui-slot", { buf: ui.slotIcon(false) });
  add("ui-slot-hidden", { buf: ui.slotIcon(true) });
  [0, 1, 2, 3].forEach((lvl) => add(`ui-eye-${lvl}`, { buf: ui.eyeIcon(lvl) }));
  add("ui-star", { buf: ui.starIcon(true) });
  add("ui-pip-on", { buf: ui.pipIcon(true) });
  add("ui-pip-off", { buf: ui.pipIcon(false) });
  add("ui-key", { buf: ui.keycap(false) });
  add("ui-key-wide", { buf: ui.keycap(true) });
  add("ui-guide-arrow", { buf: ui.guideArrow() });
  add("worldmap", { buf: ui.worldMap() });
  add("logo", { buf: ui.logo() });
  for (const l of lightArt(out)) add(l.key, l); // luz del día: manchas de luz y sol/luna del HUD
  for (const a of ambientArt()) add(a.key, a); // ambiente: partículas por bioma y sombras de nube
  return out;
}

// ---------- Solo para el laboratorio ----------
const DEMO = [
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GGGGCCCCCCCCCCGGGGGFFFFFGGGG",
  "GGGGCCCCCCCCCCGGGGGFFFFFGGGG",
  "GGGGCCCCCCCCCCGGGGGFFFFFGGGG",
  "GGGGGGGGGGGGGGGGGDDDDGGGGGGG",
  "GGGGGGGGDDDDDDDDDDDDGGGGGGGG",
  "GGGGGGGGDDDDDGGGGGGGGGGGEEEG",
  "GGGGGGGGDDDDGGGGKKKKGGGGEEEG",
  "GGGGGDDDDDGGGGGKOOOOKKGGEEEG",
  "GGGGGDDDDGGGGGGKOOOOOKGGGGGG",
  "GGGGGDDDDGGGGGGKOOOOOKGGGGGG",
  "GGGGDDDDDGGGGGGGGGGGGGGGGGGG",
  "SSSSSSDDDSSSSSSSSSSSSSSSSSSS",
  "SSSSSSSSSSSSSSSSSSSSSSSSSSSS",
  "WWWWWWWWBBBWWWWWWWWWWWWWWWWW",
  "WWWWWWWWBBBWWWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
];
const DEMO_KEY = { G: T.GRASS, C: T.CLIFF, F: T.FIELD, D: T.DIRT, E: T.FOREST, K: T.GRAVEL, O: T.COBBLE, S: T.SAND, W: T.WATER, B: T.BRIDGE, N: T.SNOW, I: T.ICE };

const PLAZA_DEMO = [
  "..........",
  ".OOOOOOOO.",
  ".OOOOOOOO.",
  ".OOOOOOOO.",
  ".OOOOOOOO.",
  "SSSSSSSSSS",
  "WWWWWWWWWW",
];

// Tres franjas: selva (izq.), desierto (centro) y nieve (der.).
const DEMO2 = [
  "EEEEGGGGGGSSSSSSSSSSNNNNNNNNN",
  "EEGGGGGDDDSSSSSSSSSSNNNNNNNNN",
  "EGGGGGDDDDDDSSSSSSNNNNNIIIINN",
  "GGGGGGDDDDDDDDDSSSNNNNIIIIIIN",
  "GGGWWWWGGGGDDDDDDDDDDNNIIIIIN",
  "GGWWWWWWGGGGSSSSSDDDDDNNIIINN",
  "GGGWWWWGGGGSSSSSSSSSDDDDNNNNN",
  "GGGGGGGGGGSSSSSSSSSSNNNDDDNNN",
  "EEGGGGGGGSSSSSSSSSSSNNNNNDDDN",
];

export function buildLabExtras() {
  const grid = DEMO.map((row) => [...row].map((ch) => DEMO_KEY[ch]));
  const grid2 = DEMO2.map((row) => [...row].map((ch) => DEMO_KEY[ch]));
  const zone = (cx) => (cx < 10 ? "tropical" : cx < 20 ? "desert" : "snow");
  return [
    { key: "terrain-demo", buf: paintGround(grid).buf },
    { key: "terrain-biomes", buf: paintGround(grid2, { biomeAt: (cx) => zone(cx) }).buf },
    // Plazas de cada pueblo (terrain.js, PLAZAS) y orilla helada de Frostholm.
    ...[["warm", "temperate"], ["mountain", "mountain"], ["planks", "tropical"], ["mud", "desert"], ["frost", "snow"], ["moss", "temperate"]]
      .map(([plaza, biome]) => ({ key: `plaza-${plaza}`, buf: paintGround(PLAZA_DEMO.map((row) => [...row].map((ch) => DEMO_KEY[ch] ?? (biome === "desert" ? T.SAND : biome === "snow" ? T.SNOW : T.GRASS))), { biome, plaza }).buf })),
    { key: "font-o", buf: fontPreview("font-o") },
    { key: "font-shadow", buf: fontPreview("font") },
  ];
}
