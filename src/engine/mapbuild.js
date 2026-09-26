/**
 * Arma un mapa en la escena: suelo horneado, colisión por celdas y objetos del mundo.
 * Lo dinámico (NPC, enemigos, cofres, rejas) lo pone la escena del mundo.
 */

import { paintGround, paintFlowerBeds, paintWaterSheet, waterRegions, T } from "../art/terrain.js";
import { hash, bayer, smoothNoise } from "../art/pixel.js";
import { pebbles, puddle, footprints, leafLitter } from "../art/props.js";
import { bones } from "../art/biomes.js";
import { num } from "../art/palette.js";
import { DEPTH, TILE } from "../config.js";
import { sunAngle, sunLength, sunStrength } from "./daylight.js";

// "D" = suelo por defecto de la zona: pasto en templado/montaña/selva, arena en desierto, nieve en nieve.
const GROUND = {
  ".": "D", ",": "D", '"': "D", x: "D", t: "D", o: "D", O: "D", b: "D",
  f: "D", "|": "D", h: "D", r: T.DIRT, c: T.DIRT, "^": "D", P: T.FOREST,
  ":": T.DIRT, X: T.DIRT, "=": T.COBBLE, _: T.SAND, "~": T.WATER, g: T.GRAVEL, F: T.FIELD,
  B: T.BRIDGE, "#": T.CLIFF, T: T.FOREST,
  v: T.GRASS, s: T.SNOW, i: T.ICE, I: T.ICE, k: "D", y: "D", e: "D", d: "D", p: "D",
};
const DEFAULT_GROUND = { desert: T.SAND, snow: T.SNOW };

/** Bioma de una celda: el mapa puede partirse en zonas (una ruta cruza de un bioma a otro). */
export function biomeOf(def, cx, cy) {
  return def.biomeAt ? def.biomeAt(cx, cy) : def.biome;
}

// Índices de la capa de colisión.
export const SOLID = 1;
export const LEDGE = 2;
export const BUSH = 3;

const SOLID_CHARS = new Set(["~", "#", "T", "t", "P", "o", "O", "f", "|", "h", "r", "c", "x", "X", "k", "y", "I", "p"]);

// Qué árbol / roca se dibuja según el bioma de la celda. `v` es un número estable por celda (0-11).
// Varias formas y tintes por bioma para que un bosque no se vea de árboles clonados (G6); el árbol
// suelto no usa el roble ancho (los pueblos tienen casas cerca).
const pick = (list) => (v) => list[v % list.length];
const FLORA = {
  temperate: {
    forest: pick(["tree-0", "tree-tall", "tree-1", "tree-wide", "tree-2", "tree-young", "tree-0", "tree-1", "tree-tall", "tree-2", "tree-wide", "tree-1"]),
    single: pick(["tree-0", "tree-1", "tree-tall", "tree-2", "tree-young", "tree-1"]),
    pine: pick(["pine", "pine-tall", "pine", "pine-dark"]),
    rock: "rock", boulder: "boulder",
  },
  mountain: {
    forest: pick(["pine", "pine-tall", "pine-dark", "pine", "pine-small", "pine-tall"]),
    single: pick(["pine", "tree-0", "pine-tall", "tree-young", "pine-small", "tree-tall"]),
    pine: pick(["pine", "pine-tall", "pine-dark", "pine", "pine-tall", "pine-dark"]),
    rock: "rock", boulder: "boulder",
  },
  tropical: {
    forest: pick(["jungle-tree-0", "jungle-tree-1", "jungle-tree-2", "palm-0", "jungle-tree-0", "jungle-tree-2", "jungle-tree-1", "palm-small-1"]),
    single: pick(["palm-0", "palm-1", "palm-small-0", "palm-1", "palm-0", "palm-small-1"]),
    pine: pick(["pine", "pine-tall"]),
    rock: "rock", boulder: "boulder",
  },
  desert: {
    forest: pick(["palm-0", "palm-1", "palm-small-0", "palm-1", "palm-small-1", "palm-0"]),
    single: pick(["palm-0", "palm-1", "palm-small-0", "palm-1"]),
    pine: pick(["pine"]),
    rock: "sand-rock", boulder: "sand-boulder",
  },
  snow: {
    forest: pick(["pine-snow", "pine-snow-tall", "bare-tree", "pine-snow", "pine-snow-small", "pine-snow-tall"]),
    single: pick(["bare-tree", "bare-tree-1", "bare-tree-2"]),
    pine: pick(["pine-snow", "pine-snow-tall", "pine-snow", "pine-snow-small"]),
    rock: "snow-rock", boulder: "snow-boulder",
  },
};

// ---------------------------------------------------------------- sombras proyectadas
//
// Cada objeto alto (árbol, pino, palmera, casa, peñasco, pozo, puesto, letrero, farol) tira una
// sombra: su silueta aplastada y sesgada hacia donde no está el sol (por defecto, luz arriba-
// izquierda → sombra abajo-derecha). Las casas y los puestos, sombra corta a la derecha y abajo.
// La silueta se saca UNA vez por textura (caché "shadow-<clave>"); luego todas las sombras del mapa
// se juntan en una sola capa (sin que se oscurezcan donde se cruzan), con borde tramado Bayer.
// setShadowSun(angle, length, strength) la reorienta; buildMap la engancha al update de la escena con
// sunAngle/sunLength/sunStrength de daylight.js (de noche, la luna: sombra tenue). Cuevas: sombra fija.

/** Qué texturas del suelo tiran sombra: "cast" = silueta proyectada, "drop" = corta a un lado. */
const NEW_TREES = [
  "tree-tall", "tree-young", "tree-wide", "tree-acacia", "jungle-tree-2", "pine-tall", "pine-small", "pine-dark",
  "pine-snow-tall", "pine-snow-small", "palm-small-0", "palm-small-1",
];
const CASTS = new Set([
  "tree-0", "tree-1", "tree-2", "tree-autumn", "pine", "pine-snow", "palm-0", "palm-1",
  "jungle-tree-0", "jungle-tree-1", "bare-tree", "boulder", "sand-boulder", "snow-boulder",
  "cactus-0", "cactus-1", "cactus-2", "well", "sign", "lamp", "banner",
  ...NEW_TREES, "bare-tree-1", "bare-tree-2", "ruin-column-0", "ruin-column-1", "milestone",
]);
const SHADOW_ALPHA = 0.4;
const SHADOW_INK = num("ink");
// Proyección por píxel de altura: x += h·vx, y += h·vy (desde el pie). Por defecto, sol arriba-izquierda.
const DEFAULT_SUN = { vx: 0.28, vy: 0.4, strength: 1 };
const sun = { ...DEFAULT_SUN };
let activeShadows = null;

const silhouettes = new Map();
let scratch = null;
/** Máscara opaca del cuadro 0 de una textura (lo semitransparente, como la mancha de contacto, no cuenta). */
function silhouette(scene, key) {
  if (silhouettes.has(key)) return silhouettes.get(key);
  const tex = scene.textures.get(key);
  const frame = tex.has(0) ? tex.get(0) : tex.get();
  const src = tex.getSourceImage();
  let sil = null;
  if (src?.getContext) {
    const w = frame.cutWidth;
    const h = frame.cutHeight;
    // Se copia a un lienzo de lectura (willReadFrequently) para no frenar el lienzo de la textura.
    scratch ??= document.createElement("canvas");
    if (scratch.width < w) scratch.width = w;
    if (scratch.height < h) scratch.height = h;
    const sctx = scratch.getContext("2d", { willReadFrequently: true });
    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(src, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
    const px = sctx.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    let base = -1;
    let top = h;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      if (px[(y * w + x) * 4 + 3] >= 200) { mask[y * w + x] = 1; base = y; top = Math.min(top, y); }
    }
    if (base >= 0) sil = { w, h, mask, base, top };
  }
  silhouettes.set(key, sil);
  return sil;
}

const shapes = new Map();
/**
 * Forma de la sombra de una textura para el sol actual (caché "shadow-<clave>[-f]").
 * Devuelve valores por píxel: 3 = sombra llena, 2 = borde (trama 1/2), 1 = halo (trama 1/4).
 */
function shadowShape(scene, key, flip, mode) {
  const id = `shadow-${key}${flip ? "-f" : ""}`;
  const cached = shapes.get(id);
  if (cached && cached.vx === sun.vx && cached.vy === sun.vy) return cached.shape;
  const sil = silhouette(scene, key);
  let shape = null;
  if (sil) {
    const { w, mask, base, top } = sil;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y > base ? 0 : mask[y * w + (flip ? w - 1 - x : x)]);
    let x0;
    let y0;
    let sw;
    let sh;
    let sample;
    if (mode === "drop") {
      // Casas y puestos: la misma silueta corrida unos píxeles; lo que asoma es la sombra.
      const dx = Math.round(sun.vx * 14);
      const dy = Math.max(1, Math.round(sun.vy * 8));
      x0 = Math.min(0, dx); y0 = top + Math.min(0, dy);
      sw = w + Math.abs(dx); sh = base - top + 1 + Math.abs(dy);
      sample = (x, y) => at(x - dx, y - dy);
    } else {
      const hmax = base - top;
      const reach = Math.ceil(hmax * Math.abs(sun.vx));
      x0 = sun.vx < 0 ? -reach : 0; y0 = base;
      sw = w + reach; sh = Math.ceil(hmax * sun.vy) + 1;
      sample = (x, y) => {
        const h = (y - base) / sun.vy;
        return at(Math.round(x - h * sun.vx), Math.round(base - h));
      };
    }
    // Un píxel de margen para el halo.
    const W = sw + 2;
    const H = sh + 2;
    const core = new Uint8Array(W * H);
    for (let y = 0; y < sh; y += 1) for (let x = 0; x < sw; x += 1) core[(y + 1) * W + x + 1] = sample(x0 + x, y0 + y);
    const data = new Uint8Array(W * H);
    const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && core[y * W + x];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const n = on(x - 1, y) + on(x + 1, y) + on(x, y - 1) + on(x, y + 1);
      if (core[y * W + x]) data[y * W + x] = n === 4 ? 3 : 2;
      else if (n) data[y * W + x] = 1;
    }
    shape = { w: W, h: H, ox: x0 - 1, oy: y0 - 1, data };
  }
  shapes.set(id, { vx: sun.vx, vy: sun.vy, shape });
  return shape;
}

const SHADOW_RGBA = (() => {
  const r = (SHADOW_INK >> 16) & 255;
  const g = (SHADOW_INK >> 8) & 255;
  const b = SHADOW_INK & 255;
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
})();

/**
 * Junta todas las sombras del mapa en su lienzo. Donde dos se cruzan no se oscurece más: la trama
 * de cada nivel (3 lleno, 2 medio, 1 cuarto) contiene a la del nivel de abajo, así que basta con
 * entintar cada píxel que pida cualquiera de las sombras. Sólo se recorre el área de las sombras.
 */
function paintShadows(layer) {
  const { scene, W, H, list, tex } = layer;
  const ctx = tex.getContext();
  layer.img ??= ctx.createImageData(W, H);
  const px = new Uint32Array(layer.img.data.buffer);
  px.fill(0);
  for (const it of list) {
    const shape = shadowShape(scene, it.key, it.flip, it.mode);
    if (!shape) continue;
    const bx = it.left + shape.ox;
    const by = it.top + shape.oy;
    for (let y = 0; y < shape.h; y += 1) {
      const wy = by + y;
      if (wy < 0 || wy >= H) continue;
      for (let x = 0; x < shape.w; x += 1) {
        const v = shape.data[y * shape.w + x];
        const wx = bx + x;
        if (!v || wx < 0 || wx >= W) continue;
        if (v === 3 || (v === 2 && bayer(wx, wy) < 0.5) || (v === 1 && bayer(wx, wy) < 0.25)) px[wy * W + wx] = SHADOW_RGBA;
      }
    }
  }
  ctx.putImageData(layer.img, 0, 0);
  tex.refresh();
}

/**
 * Reorienta las sombras del mapa actual. Mismas unidades que daylight.js:
 * `angle` = hacia dónde está el sol en radianes de pantalla (0 derecha, -π/2 arriba; la sombra cae
 * al lado contrario), `length` = largo relativo (0.15 mediodía … 1 al salir/ponerse), `strength`
 * = qué tan marcada (1 de día, ~0.35 con luna). Sólo repinta cuando la sombra cambia de verdad
 * (pasos de 0.05 px por px de altura), así que se puede llamar en cada cuadro.
 */
export function setShadowSun(angle, length = 0.5, strength = 1) {
  const d = angle + Math.PI;
  const q = (v) => Math.round(v * 20) / 20;
  const vx = q(0.75 * length * Math.cos(d));
  const vy = Math.max(0.15, q(0.22 + 0.5 * length * Math.max(0, Math.sin(d))));
  sun.strength = Math.max(0, Math.min(1, strength));
  const changed = vx !== sun.vx || vy !== sun.vy;
  sun.vx = vx;
  sun.vy = vy;
  const layer = activeShadows;
  if (!layer || !layer.image.scene) return;
  layer.image.setAlpha(SHADOW_ALPHA * sun.strength).setVisible(sun.strength > 0.02);
  if (changed) paintShadows(layer);
}

/** Vuelve a la sombra fija de siempre (luz arriba-izquierda). */
export function resetShadowSun() {
  Object.assign(sun, DEFAULT_SUN);
  if (activeShadows?.image.scene) {
    activeShadows.image.setAlpha(SHADOW_ALPHA).setVisible(true);
    paintShadows(activeShadows);
  }
}

// ---------------------------------------------------------------- vaivén

/** Texturas de 2 cuadros que se mecen (copa corrida 1 px en el cuadro 1). */
const SWAYS = new Set([
  "tree-0", "tree-1", "tree-2", "tree-autumn", "pine", "pine-snow", "palm-0", "palm-1",
  "jungle-tree-0", "jungle-tree-1", "banner", ...NEW_TREES,
  "stall-amber", "stall-rune", "stall-green", "stall-rain", "stall-sun", "stall-frost",
]);

function swayAnim(scene, key) {
  const anim = `${key}-sway`;
  if (!scene.anims.exists(anim)) {
    scene.anims.create({ key: anim, frames: [{ key, frame: 0 }, { key, frame: 1 }], frameRate: 1, repeat: -1 });
  }
  return anim;
}

/** Cada uno a su ritmo (1.6-2.4 s por ciclo) y con su retraso, para que no se muevan al unísono. */
function playSway(sprite, anim, seedX, seedY) {
  sprite.play({
    key: anim,
    duration: 1600 + Math.floor(hash(seedX, seedY, 21) * 800),
    delay: Math.floor(hash(seedX, seedY, 22) * 2400),
    startFrame: hash(seedX, seedY, 23) < 0.5 ? 0 : 1,
    showBeforeDelay: true,
  });
}

// ---------------------------------------------------------------- agua animada (G4)
//
// Cada mancha de agua (río, canal, estanque, golfo, oasis) y de hielo lleva su hoja de cuadros
// (terrain.js → paintWaterSheet), recortada a su rectángulo. Todas cambian de cuadro juntas con un
// solo reloj por escena; el desfase va dentro del dibujo (cada ola, orilla y destello a su compás).
// Es una imagen por mancha, no un sprite por celda: el costo no crece con el tamaño del agua.

const WATER_MS = 620;
const ICE_MS = 1100;

/** Hornea las hojas del mapa (una vez por mapa; la textura queda en caché). */
function bakeWater(scene, id, ter, wd, W, H, seed) {
  const out = [];
  for (const [kind, name] of [[T.WATER, "water"], [T.ICE, "ice"]]) {
    waterRegions(ter, W, H, kind).forEach((rect, i) => {
      const sheet = paintWaterSheet(ter, wd, W, rect, { seed, kind });
      const key = `${name}-${id}-${i}`;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const tex = scene.textures.addCanvas(key, sheet.buf.toCanvas());
      for (let k = 0; k < sheet.frames; k += 1) {
        tex.add(k, 0, sheet.across ? k * rect.w : 0, sheet.across ? 0 : k * rect.h, rect.w, rect.h);
      }
      out.push({ key, x: rect.x, y: rect.y, ice: kind === T.ICE, frames: sheet.frames });
    });
  }
  return out;
}

function placeWater(scene, list) {
  if (!list.length) return;
  const water = [];
  const ice = [];
  for (const it of list) {
    const img = scene.add.image(it.x, it.y, it.key, 0).setOrigin(0, 0).setDepth(DEPTH.ground + 1);
    (it.ice ? ice : water).push(img);
  }
  const tick = (imgs, frames) => {
    let k = 0;
    return () => { k = (k + 1) % frames; for (const img of imgs) img.setFrame(k); };
  };
  if (water.length) scene.time.addEvent({ delay: WATER_MS, loop: true, callback: tick(water, list.find((i) => !i.ice).frames) });
  if (ice.length) scene.time.addEvent({ delay: ICE_MS, loop: true, callback: tick(ice, list.find((i) => i.ice).frames) });
}

// ---------------------------------------------------------------- capa de detalle de las rutas (G6)
//
// Las rutas eran un verde enorme con pocos árboles iguales. Encima del trazado se reparte detalle
// decorativo con ruido (claros vacíos y manchas densas), según el bioma de cada celda:
//  - Calcomanías planas horneadas en el suelo: piedritas, charcos, huellas en el camino, hojarasca
//    bajo el bosque, huesos en el desierto (paintDecals; cero costo al jugar).
//  - Cosas chicas de pie (hongos, arbustos con flores, tocones, helechos, montículos de nieve):
//    sprites ordenados por y, SIN colisión.
//  - Cosas grandes (árboles, troncos caídos, columnas rotas, rocas con nieve): sprites con sombra y
//    vaivén como los demás y con UNA celda sólida. Sólo van en pasto abierto (las 8 vecinas libres y
//    separadas entre sí), así que nunca cierran un paso.
//  - Un mojón al lado de cada cruce de camino (hasta 3 por mapa; chico, sin colisión).
// Nada cae sobre el camino, las salidas, las entradas ni cerca de los objetos, enemigos y rondas del
// mapa. Todo sale de hash(): igual en cada visita y en cada jugador en línea.

const ROADS = new Set([":", "=", "g", "B", "_", "s", "X"]);
const OPEN = new Set([".", ","]);

const DETAIL = {
  temperate: {
    trees: ["tree-tall", "tree-young", "tree-wide", "tree-0", "tree-2", "tree-young", "tree-1", "tree-tall"],
    big: ["log-moss", "ruin-column-0", "ruin-column-1", "ruin-blocks", "boulder", "log-moss"],
    small: ["mushrooms-0", "flower-bush-0", "flower-bush-1", "mushrooms-1", "flower-bush-2", "stump-moss", "mushrooms-1", "stump"],
    floor: ["mushrooms-0", "mushrooms-1", "stump-moss", "fern"],
  },
  mountain: {
    trees: ["pine-small", "pine-tall", "pine-dark", "tree-young", "pine", "pine-small"],
    big: ["log-moss", "ruin-column-0", "ruin-blocks", "boulder", "rock"],
    small: ["mushrooms-1", "stump", "flower-bush-1", "mushrooms-1", "stump-moss", "flower-bush-2"],
    floor: ["mushrooms-1", "stump-moss"],
  },
  tropical: {
    trees: ["jungle-tree-2", "palm-small-0", "jungle-tree-0", "palm-small-1", "jungle-tree-1", "palm-0"],
    big: ["log-moss", "ruin-column-1", "ruin-blocks", "boulder"],
    small: ["fern", "flower-bush-0", "flower-bush-2", "mushrooms-0", "fern", "flower-bush-1"],
    floor: ["fern", "mushrooms-0", "fern"],
  },
  desert: {
    trees: ["tree-acacia", "palm-small-0", "tree-acacia", "palm-small-1"],
    big: ["sand-boulder", "ruin-column-0", "ruin-blocks", "sand-rock", "cactus-0", "cactus-1"],
    small: ["dry-bush", "cactus-small", "dry-bush", "cactus-small", "dry-bush"],
    floor: ["dry-bush"],
  },
  snow: {
    trees: ["pine-snow-small", "pine-snow-tall", "bare-tree-1", "pine-snow", "pine-snow-small", "pine-snow-tall", "bare-tree-2", "pine-snow"],
    big: ["snow-rock", "snow-boulder", "snow-rock", "snow-mound-1"],
    small: ["snow-mound-0", "snow-mound-1", "snow-mound-0", "bare-tree-2"],
    floor: ["snow-mound-0"],
  },
};
// Dónde va el pie de cada cosa respecto del borde de abajo de la celda (como los de la rejilla).
const FOOT = { boulder: 0, "sand-boulder": 0, "snow-boulder": 0, rock: -1, "sand-rock": -1, "snow-rock": -1, "cactus-0": 1, "cactus-1": 1 };
const footOf = (key) => FOOT[key] ?? (CASTS.has(key) && !/ruin|milestone/.test(key) ? 3 : 0);

/** Densidad del detalle: ruido largo (claros y manchas). 0 en los claros, ~1 en lo más tupido. */
function density(id, x, y) {
  const n = smoothNoise(x * 16, y * 16, 128, id.length * 31 + 300) * 0.75 + smoothNoise(x * 16, y * 16, 40, id.length * 31 + 301) * 0.25;
  return Math.max(0, Math.min(1, (n - 0.3) / 0.45));
}

/** Celdas a no tocar: salidas, entradas, objetos, enemigos y sus rondas. 2 = nada, 1 = nada grande. */
function avoidMask(def, cols, H) {
  const m = new Uint8Array(cols * H);
  const mark = (cx, cy, r, v) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
      if (x >= 0 && y >= 0 && x < cols && y < H) m[y * cols + x] = Math.max(m[y * cols + x], v);
    }
  };
  for (const e of def.exits ?? []) for (let y = e.y; y < e.y + (e.h ?? 1); y += 1) for (let x = e.x; x < e.x + (e.w ?? 1); x += 1) mark(x, y, 3, 2);
  for (const e of Object.values(def.entries ?? {})) mark(e.x, e.y, 3, 2);
  for (const o of def.objects ?? []) {
    mark(o.x, o.y, o.type === "enemy" ? 2 : 1.5, 2);
    if (o.type === "prop" || o.type === "house" || o.type === "stall") mark(o.x + 1, o.y + 1, 2.5, 2);
    if (o.patrol) {
      for (let k = 0; k < o.patrol.length - 1; k += 1) {
        const [x0, y0] = o.patrol[k];
        const [x1, y1] = o.patrol[k + 1];
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
        for (let s = 0; s <= n; s += 1) mark(x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, 1, 2);
      }
    }
  }
  return m;
}

/** Distancia (en celdas, hasta 4) al camino más cercano. */
function roadDistance(at, cols, H) {
  const d = new Uint8Array(cols * H).fill(9);
  const queue = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < cols; x += 1) if (ROADS.has(at(x, y))) { d[y * cols + x] = 0; queue.push(y * cols + x); }
  for (let q = 0; q < queue.length; q += 1) {
    const i = queue[q];
    const x = i % cols;
    const y = (i - x) / cols;
    if (d[i] >= 4) continue;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= H) continue;
      const j = ny * cols + nx;
      if (d[j] > d[i] + 1) { d[j] = d[i] + 1; queue.push(j); }
    }
  }
  return d;
}

/** Cruces de camino: celdas de camino con 3 o más ramales en el anillo de radio 3. */
function junctions(at, cols, H) {
  const ring = [];
  for (let x = -3; x <= 3; x += 1) ring.push([x, -3]);
  for (let y = -2; y <= 3; y += 1) ring.push([3, y]);
  for (let x = 2; x >= -3; x -= 1) ring.push([x, 3]);
  for (let y = 2; y >= -2; y -= 1) ring.push([-3, y]);
  const out = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < cols; x += 1) {
    if (!ROADS.has(at(x, y)) || at(x, y) === "B") continue;
    // Ramales: tramos seguidos de camino en el anillo, de 2 celdas o más (una celda suelta es borde).
    const inside = (i, j) => i >= 0 && j >= 0 && i < cols && j < H;
    const on = ring.map(([ax, ay]) => inside(x + ax, y + ay) && ROADS.has(at(x + ax, y + ay)));
    const startK = on.indexOf(false);
    if (startK < 0) continue;
    let arcs = 0;
    let run = 0;
    for (let k = 1; k <= ring.length; k += 1) {
      if (on[(startK + k) % ring.length]) run += 1;
      else { if (run >= 2) arcs += 1; run = 0; }
    }
    if (arcs >= 3 && !out.some(([jx, jy]) => Math.abs(jx - x) < 7 && Math.abs(jy - y) < 7)) out.push([x, y]);
  }
  return out;
}

/** Calcomanías planas de las rutas, horneadas en el suelo antes de subirlo. */
let decalCache = null;
function paintDecals(buf, def, rows, at, ter, W) {
  decalCache ??= {
    pebbles: Object.fromEntries(["stone", "sand", "snow"].map((t) => [t, [0, 1, 2].map((v) => pebbles(v, t))])),
    puddle: [puddle(0), puddle(1)],
    prints: Object.fromEntries(["dirt", "snow", "sand"].map((soil) => [soil, ["boot", "boot", "hoof", "cart"].map((k) => footprints(k, soil))])),
    leaves: [leafLitter(0), leafLitter(1), leafLitter(2, true)],
    bones: bones(),
  };
  const D = decalCache;
  const cols = rows[0].length;
  const H = rows.length;
  const seed = def.id.length * 17 + 400;
  // La calcomanía sólo va donde el suelo horneado es del terreno esperado (no pisa bordes ni agua).
  const fits = (x0, y0, img, terrain) => {
    for (let y = 0; y < img.h; y += 1) for (let x = 0; x < img.w; x += 1) {
      if (!(img.data[y * img.w + x] >>> 24)) continue;
      const gx = x0 + x;
      const gy = y0 + y;
      if (gx < 0 || gy < 0 || gx >= W || gy * W + gx >= ter.length || !terrain.includes(ter[gy * W + gx])) return false;
    }
    return true;
  };
  const stamp = (img, x0, y0, terrain) => { if (fits(x0, y0, img, terrain)) buf.blit(img, x0, y0); };
  for (let cy = 0; cy < H; cy += 1) for (let cx = 0; cx < cols; cx += 1) {
    const ch = at(cx, cy);
    const biome = biomeOf(def, cx, cy);
    const r = hash(cx, cy, seed);
    const r2 = hash(cx, cy, seed + 1);
    const jx = cx * TILE + Math.floor(hash(cx, cy, seed + 2) * 8);
    const jy = cy * TILE + Math.floor(hash(cx, cy, seed + 3) * 8);
    const dens = density(def.id, cx, cy);
    if (ch === ":" || ch === "_" || ch === "s") {
      // Huellas en el camino: pisadas, herraduras y rodadas de carreta.
      const soil = ch === "s" ? "snow" : ch === "_" || biome === "desert" ? "sand" : "dirt";
      const terr = ch === "s" ? [T.SNOW] : ch === "_" ? [T.SAND] : [T.DIRT, T.SAND];
      if (r < 0.11) stamp(D.prints[soil][Math.floor(r2 * 4)], cx * TILE + 3, cy * TILE, terr);
      else if (r > 0.985 && ch === ":" && biome !== "desert" && biome !== "snow") stamp(D.puddle[r2 < 0.5 ? 0 : 1], cx * TILE - 2, jy, [T.DIRT]);
    } else if (OPEN.has(ch) || ch === "x") {
      const tone = biome === "desert" ? "sand" : biome === "snow" ? "snow" : "stone";
      const terr = biome === "desert" ? [T.SAND] : biome === "snow" ? [T.SNOW] : [T.GRASS];
      if (r < 0.03 + dens * 0.1) stamp(D.pebbles[tone][Math.floor(r2 * 3)], jx, jy + 4, terr);
      else if (r > 0.992 && biome !== "desert" && biome !== "snow") stamp(D.puddle[1], jx - 2, jy + 3, [T.GRASS]);
      else if (r > 0.985 && biome === "desert") stamp(D.bones, jx, jy + 4, [T.SAND]);
    } else if (ch === "T" && (cx + cy) % 2 === 1 && biome !== "desert" && biome !== "snow") {
      // Hojarasca entre los árboles del bosque.
      if (r < 0.45) stamp(D.leaves[Math.floor(r2 * 3)], jx, jy + 4, [T.FOREST, T.GRASS]);
    }
  }
}

/**
 * Detalle de pie: árboles y cosas grandes (con una celda sólida) y cosas chicas (sin colisión).
 * Devuelve la lista de lo que hay que poner; las celdas sólidas se marcan antes de armar la colisión.
 */
function planDetail({ def, cols, H, at }) {
  const out = [];
  const avoid = avoidMask(def, cols, H);
  const road = roadDistance(at, cols, H);
  const seed = def.id.length * 19 + 500;
  const bigAt = [];
  const openRing = (x, y) => {
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (!OPEN.has(at(x + dx, y + dy))) return false;
    return true;
  };
  const spaced = (x, y) => !bigAt.some(([bx, by]) => Math.abs(bx - x) <= 2 && Math.abs(by - y) <= 2);
  const canBig = (x, y) => OPEN.has(at(x, y)) && !avoid[y * cols + x] && road[y * cols + x] >= 2 && openRing(x, y) && spaced(x, y);
  const putBig = (key, x, y, flip) => {
    out.push({ key, x: x * TILE + TILE / 2, y: (y + 1) * TILE + footOf(key), flip, solid: [x, y] });
    bigAt.push([x, y]);
  };

  // Mojón en cada cruce de camino (hasta 3 por mapa), a un lado del camino. Es chico: sin colisión.
  for (const [jx, jy] of junctions(at, cols, H).slice(0, 3)) {
    let done = false;
    for (let r = 2; r <= 4 && !done; r += 1) {
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]]) {
        const x = jx + dx;
        const y = jy + dy;
        if (x < 1 || y < 1 || x >= cols - 1 || y >= H - 1) continue;
        if (OPEN.has(at(x, y)) && !avoid[y * cols + x] && road[y * cols + x] === 1 && spaced(x, y)) {
          out.push({ key: "milestone", x: x * TILE + TILE / 2, y: (y + 1) * TILE - 1, flip: false });
          bigAt.push([x, y]);
          done = true;
          break;
        }
      }
    }
  }

  for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < cols - 1; x += 1) {
    const ch = at(x, y);
    const pool = DETAIL[biomeOf(def, x, y)] ?? DETAIL.temperate;
    const dens = density(def.id, x, y);
    const r = hash(x, y, seed);
    const v = Math.floor(hash(x, y, seed + 1) * 97);
    const flip = hash(x, y, seed + 2) < 0.5;
    const i = y * cols + x;
    if (ch === "T" || ch === "P") {
      // Piso del bosque, entre los árboles (el bosque ya es sólido): hongos, tocones, helechos.
      if ((x + y) % 2 === 1 && r < 0.22 * (0.4 + dens) && ch === "T") {
        const key = pool.floor[v % pool.floor.length];
        const jx = Math.round((hash(x, y, seed + 3) - 0.5) * 6);
        out.push({ key, x: x * TILE + TILE / 2 + jx, y: (y + 1) * TILE - 2, flip });
      }
      continue;
    }
    if (!OPEN.has(ch) || avoid[i] >= 2) continue;
    if (dens > 0.15 && r < 0.05 * dens && canBig(x, y)) {
      // Árbol suelto: el doble de probable que lo demás grande.
      putBig(pool.trees[v % pool.trees.length], x, y, flip);
    } else if (dens > 0.25 && r > 1 - 0.02 * dens && canBig(x, y)) {
      putBig(pool.big[v % pool.big.length], x, y, flip);
    } else if (road[i] >= 1 && hash(x, y, seed + 4) < 0.02 + 0.13 * dens) {
      const key = pool.small[v % pool.small.length];
      const jx = Math.round((hash(x, y, seed + 5) - 0.5) * 8);
      const jy = Math.round((hash(x, y, seed + 6) - 0.5) * 4);
      out.push({ key, x: x * TILE + TILE / 2 + jx, y: (y + 1) * TILE - 2 + jy, flip });
    }
  }
  return out;
}

export function buildMap(scene, def) {
  const rows = def.grid;
  const cols = rows[0].length;
  const H = rows.length;
  const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= H ? "x" : rows[y][x]);

  // --- Suelo ---
  const texKey = `ground-${def.id}`;
  if (!scene.textures.exists(texKey)) {
    const grid = rows.map((r, y) => [...r].map((ch, x) => {
      const g = GROUND[ch] ?? "D";
      return g === "D" ? DEFAULT_GROUND[biomeOf(def, x, y)] ?? T.GRASS : g;
    }));
    const seed = def.id.length * 13 + 5;
    const { buf, ter, wd, W: GW, H: GH } = paintGround(grid, {
      biome: def.biome, seed, crispCobble: def.kind === "town",
      biomeAt: def.biomeAt ? (cx, cy) => def.biomeAt(cx, cy) : null, plaza: def.plaza,
    });
    const beds = [];
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === ",") beds.push([x, y]); }));
    paintFlowerBeds(buf, beds, 9);
    if (def.kind === "route") paintDecals(buf, def, rows, at, ter, GW);
    const tex = scene.textures.addCanvas(texKey, buf.toCanvas());
    tex.customData.water = bakeWater(scene, def.id, ter, wd, GW, GH, seed);
  }
  scene.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(DEPTH.ground);
  placeWater(scene, scene.textures.get(texKey).customData.water ?? []);

  // --- Colisión por celdas ---
  const data = rows.map((r, y) => [...r].map((ch, x) => {
    if (ch === "^") return LEDGE;
    if (ch === "b") return BUSH;
    return SOLID_CHARS.has(ch) ? SOLID : -1;
  }));
  // Capa de detalle de las rutas (G6): lo grande ocupa su celda.
  const detail = def.kind === "route" ? planDetail({ def, cols, H, at }) : [];
  for (const d of detail) if (d.solid) data[d.solid[1]][d.solid[0]] = SOLID;
  const tilemap = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
  const tileset = tilemap.addTilesetImage("blank16", "blank16", TILE, TILE, 0, 0);
  const layer = tilemap.createLayer(0, tileset, 0, 0);
  layer.setCollision([SOLID, LEDGE, BUSH]);
  layer.setVisible(false);

  const statics = scene.physics.add.staticGroup();
  const addSolid = (x, y, w, h) => {
    const r = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0xff00ff, 0);
    statics.add(r);
    return r;
  };

  const tallGrass = new Map();
  const bushes = new Map();
  // Sombras proyectadas: se anotan aquí y se pintan todas juntas al final.
  const shadowList = [];
  const castShadow = (img, key, mode = "cast") => {
    const w = img.frame.cutWidth;
    const h = img.frame.cutHeight;
    shadowList.push({
      key, mode, flip: img.flipX,
      left: Math.round(img.x - img.originX * w), top: Math.round(img.y - img.originY * h),
    });
  };
  const place = (key, x, y, opts = {}) => {
    const sway = SWAYS.has(key);
    const img = sway
      ? scene.add.sprite(x, y, key, 0).setOrigin(opts.ox ?? 0.5, opts.oy ?? 1)
      : scene.add.image(x, y, key, opts.frame).setOrigin(opts.ox ?? 0.5, opts.oy ?? 1);
    img.setDepth(opts.depth ?? y);
    if (opts.flip) img.setFlipX(true);
    if (sway) playSway(img, swayAnim(scene, key), Math.round(x), Math.round(y));
    if (CASTS.has(key)) castShadow(img, key);
    return img;
  };

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const ch = at(x, y);
      const px = x * TILE;
      const py = y * TILE;
      const cx = px + TILE / 2;
      const r = hash(x, y, 77);
      const flora = FLORA[biomeOf(def, x, y)] ?? FLORA.temperate;
      const v = Math.floor(hash(x, y, 4) * 12);
      switch (ch) {
        case "T": {
          // Bosque: árbol en tablero de ajedrez, con leve desfase.
          if ((x + y) % 2 === 0) {
            const jx = Math.round((hash(x, y, 3) - 0.5) * 6);
            place(flora.forest(v), cx + jx, py + TILE + 3, { flip: r < 0.5 });
          }
          break;
        }
        case "t":
          place(flora.single(v), cx, py + TILE + 3, { flip: hash(x, y, 9) < 0.5 });
          break;
        case "p":
          place(`palm-${v % 2}`, cx, py + TILE + 3, { flip: hash(x, y, 9) < 0.5 });
          break;
        case "P":
          if ((x + y) % 2 === 0 || !["P", "#"].includes(at(x, y - 1))) {
            place(flora.pine(v), cx + Math.round((r - 0.5) * 4), py + TILE + 3);
          }
          break;
        case "o":
          place(flora.rock, cx, py + TILE - 1);
          break;
        case "O":
          place(flora.boulder, cx + 4, py + TILE);
          break;
        case "k":
          place(`cactus-${v % 3}`, cx, py + TILE + 1, { flip: r < 0.5 });
          break;
        case "y":
          place("bare-tree", cx, py + TILE + 2, { flip: r < 0.5 });
          break;
        case "I":
          place("ice-block", cx, py + TILE);
          break;
        case "e":
          place("fern", cx, py + TILE, { depth: py + TILE - 2, flip: r < 0.5 });
          break;
        case "d":
          place("dry-bush", cx, py + TILE - 1, { depth: py + TILE - 2 });
          break;
        case "b":
          bushes.set(`${x},${y}`, { img: place(hash(x, y, 5) < 0.3 ? "bush-berries" : "bush", cx, py + TILE), x, y });
          break;
        case '"': {
          const variant = Math.floor(hash(x, y, 11) * 3);
          const key = `tallgrass-${variant}`;
          const img = scene.add.sprite(px, py + TILE, key, 0).setOrigin(0, 1).setDepth(py + TILE - 1);
          if (hash(x, y, 12) < 0.5) img.setFlipX(true);
          const entry = { img, x, y, anim: key };
          tallGrass.set(`${x},${y}`, entry);
          // Vaivén continuo; al pasar entre el pasto se sacude (player.rustle) y luego vuelve a mecerse.
          const sway = swayAnim(scene, key);
          playSway(img, sway, x, y);
          img.on("animationcomplete", (anim) => {
            if (!entry.cut && anim.key !== sway) playSway(img, sway, x, y);
          });
          break;
        }
        case "f":
          place("fence", cx, py + TILE);
          break;
        case "|":
          place("fence-v", cx, py + TILE);
          break;
        case "h":
          place("hay", cx, py + TILE - 1);
          break;
        case "r":
          place("barrel", cx, py + TILE - 1);
          break;
        case "c":
          place("crate", cx, py + TILE - 1);
          break;
        case "^":
          place("ledge", px, py, { ox: 0, oy: 0, depth: DEPTH.decal });
          break;
        default:
          break;
      }
    }
  }

  // --- Capa de detalle de las rutas (G6) ---
  for (const d of detail) place(d.key, d.x, d.y, { flip: d.flip });

  // --- Casas, puestos, pozos y adornos ---
  const chimneys = [];
  const flags = scene.registry.get("flags") ?? {};
  for (const obj of def.objects) {
    if (obj.onlyIf && !flags[obj.onlyIf]) continue;
    const ox = obj.x * TILE;
    const oy = obj.y * TILE;
    if (obj.type === "house") {
      const img = scene.add.image(ox, oy, obj.art).setOrigin(0, 0);
      const { width: w, height: h } = img;
      img.setDepth(oy + h - 3);
      castShadow(img, obj.art, "drop");
      addSolid(ox + 3, oy + Math.round(h * 0.34), w - 6, Math.round(h * 0.66) - 3);
      if (!/stable|jungle|adobe/.test(obj.art)) chimneys.push({ x: ox + w - 15, y: oy + 1 });
    } else if (obj.type === "stall") {
      const img = place(obj.art, ox, oy, { ox: 0, oy: 0, depth: oy + 40 });
      castShadow(img, obj.art, "drop");
      addSolid(ox + 1, oy + 22, img.width - 2, 17);
    } else if (obj.type === "well") {
      place("well", ox, oy, { ox: 0, oy: 0, depth: oy + 28 });
      addSolid(ox + 2, oy + 12, 24, 15);
    } else if (obj.type === "sign") {
      // El letrero lo pone la escena (world.js: imagen en (x, y + 2), origen abajo al centro);
      // aquí sólo su sombra, en el mismo lugar.
      shadowList.push({ key: "sign", mode: "cast", flip: false, left: Math.round(ox - 8), top: Math.round(oy + 2 - 18) });
    } else if (obj.type === "prop") {
      const img = obj.anim
        ? scene.add.sprite(ox, oy, obj.art, 0).setOrigin(0, 0).play(obj.anim)
        : place(obj.art, ox, oy, { ox: 0, oy: 0, depth: 0 });
      img.setDepth(oy + img.height - 2);
      if (obj.solid) {
        const [sx, sy, sw, sh] = obj.solid;
        addSolid(ox + sx, oy + sy, sw, sh);
      }
    } else if (obj.type === "bridge-rails") {
      for (let y = obj.y0; y <= obj.y1; y += 1) {
        place("bridge-rail", (obj.x0 - 0.5) * TILE + 8, (y + 1) * TILE);
        place("bridge-rail", (obj.x1 + 1.5) * TILE - 8, (y + 1) * TILE);
      }
    }
  }

  // Humo de chimeneas
  if (chimneys.length) {
    scene.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        const c = chimneys[Math.floor(Math.random() * chimneys.length)];
        const puff = scene.add.sprite(c.x, c.y, "smoke", 0).setDepth(c.y + 200).setAlpha(0.8);
        scene.tweens.add({
          targets: puff, y: c.y - 26, x: c.x + 6 + Math.random() * 6, alpha: 0, duration: 2400,
          onComplete: () => puff.destroy(),
        });
        puff.play("smoke");
      },
    });
  }

  // Capa de sombras: un solo lienzo del tamaño del mapa, debajo de todo lo que está de pie.
  const shadowKey = `shadows-${def.id}`;
  const shadowTex = scene.textures.exists(shadowKey)
    ? scene.textures.get(shadowKey)
    : scene.textures.createCanvas(shadowKey, cols * TILE, H * TILE);
  const shadowImg = scene.add.image(0, 0, shadowKey).setOrigin(0, 0).setDepth(DEPTH.decal + 1);
  // El sol de la hora actual antes de pintar (las cuevas no tienen sol: sombra fija de siempre).
  const reg = scene.registry;
  const followSun = () => setShadowSun(sunAngle(reg), sunLength(reg), sunStrength(reg));
  activeShadows = null;
  if (def.dark) Object.assign(sun, DEFAULT_SUN);
  else followSun();
  shadowImg.setAlpha(SHADOW_ALPHA * sun.strength).setVisible(sun.strength > 0.02);
  activeShadows = { scene, W: cols * TILE, H: H * TILE, list: shadowList, tex: shadowTex, image: shadowImg };
  paintShadows(activeShadows);
  const shadows = activeShadows;
  // Las sombras siguen al sol solas (setShadowSun sólo repinta cuando la sombra cambia de verdad).
  if (!def.dark) scene.events.on("update", followSun);
  scene.events.once("shutdown", () => {
    scene.events.off("update", followSun);
    if (activeShadows === shadows) activeShadows = null;
  });

  return {
    cols, rows: H, W: cols * TILE, H: H * TILE, at, layer, statics, tallGrass, bushes, addSolid, setShadowSun,
    solidAt(px, py) {
      const tile = layer.getTileAtWorldXY(px, py);
      return Boolean(tile && tile.index > 0);
    },
    cellAt(px, py) {
      return at(Math.floor(px / TILE), Math.floor(py / TILE));
    },
  };
}
