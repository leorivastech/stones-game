/**
 * Arma un mapa en la escena: suelo horneado, colisión por celdas y objetos del mundo.
 * Lo dinámico (NPC, enemigos, cofres, rejas) lo pone la escena del mundo.
 */

import { paintGround, paintFlowerBeds, T } from "../art/terrain.js";
import { hash } from "../art/pixel.js";
import { DEPTH, TILE } from "../config.js";

const GROUND = {
  ".": T.GRASS, ",": T.GRASS, '"': T.GRASS, x: T.GRASS, t: T.GRASS, o: T.GRASS, O: T.GRASS, b: T.GRASS,
  f: T.GRASS, "|": T.GRASS, h: T.GRASS, r: T.DIRT, c: T.DIRT, "^": T.GRASS, P: T.FOREST,
  ":": T.DIRT, X: T.DIRT, "=": T.COBBLE, _: T.SAND, "~": T.WATER, g: T.GRAVEL, F: T.FIELD,
  B: T.BRIDGE, "#": T.CLIFF, T: T.FOREST,
};

// Índices de la capa de colisión.
export const SOLID = 1;
export const LEDGE = 2;
export const BUSH = 3;

const SOLID_CHARS = new Set(["~", "#", "T", "t", "P", "o", "O", "f", "|", "h", "r", "c", "x", "X"]);

export function buildMap(scene, def) {
  const rows = def.grid;
  const cols = rows[0].length;
  const H = rows.length;
  const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= H ? "x" : rows[y][x]);

  // --- Suelo ---
  const texKey = `ground-${def.id}`;
  if (!scene.textures.exists(texKey)) {
    const grid = rows.map((r) => [...r].map((ch) => GROUND[ch] ?? T.GRASS));
    const { buf } = paintGround(grid, { biome: def.biome, seed: def.id.length * 13 + 5, crispCobble: def.kind === "town" });
    const beds = [];
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === ",") beds.push([x, y]); }));
    paintFlowerBeds(buf, beds, 9);
    scene.textures.addCanvas(texKey, buf.toCanvas());
  }
  scene.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(DEPTH.ground);

  // --- Colisión por celdas ---
  const data = rows.map((r, y) => [...r].map((ch, x) => {
    if (ch === "^") return LEDGE;
    if (ch === "b") return BUSH;
    return SOLID_CHARS.has(ch) ? SOLID : -1;
  }));
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
  const place = (key, x, y, opts = {}) => {
    const img = scene.add.image(x, y, key, opts.frame).setOrigin(opts.ox ?? 0.5, opts.oy ?? 1);
    img.setDepth(opts.depth ?? y);
    if (opts.flip) img.setFlipX(true);
    return img;
  };

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const ch = at(x, y);
      const px = x * TILE;
      const py = y * TILE;
      const cx = px + TILE / 2;
      const r = hash(x, y, 77);
      switch (ch) {
        case "T": {
          // Bosque: árbol en tablero de ajedrez, con leve desfase.
          if ((x + y) % 2 === 0) {
            const jx = Math.round((hash(x, y, 3) - 0.5) * 6);
            const variant = Math.floor(hash(x, y, 4) * 3);
            place(`tree-${variant}`, cx + jx, py + TILE + 3, { flip: r < 0.5 });
          }
          break;
        }
        case "t":
          place(`tree-${Math.floor(r * 3)}`, cx, py + TILE + 3, { flip: hash(x, y, 9) < 0.5 });
          break;
        case "P":
          if ((x + y) % 2 === 0 || !["P", "#"].includes(at(x, y - 1))) {
            place(def.biome === "snow" ? "pine-snow" : "pine", cx + Math.round((r - 0.5) * 4), py + TILE + 3);
          }
          break;
        case "o":
          place("rock", cx, py + TILE - 1);
          break;
        case "O":
          place("boulder", cx + 4, py + TILE);
          break;
        case "b":
          bushes.set(`${x},${y}`, { img: place(hash(x, y, 5) < 0.3 ? "bush-berries" : "bush", cx, py + TILE), x, y });
          break;
        case '"': {
          const variant = Math.floor(hash(x, y, 11) * 3);
          const img = scene.add.sprite(px, py + TILE, `tallgrass-${variant}`, 0).setOrigin(0, 1).setDepth(py + TILE - 1);
          if (hash(x, y, 12) < 0.5) img.setFlipX(true);
          tallGrass.set(`${x},${y}`, { img, x, y, anim: `tallgrass-${variant}` });
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
        case "~":
          if (r < 0.05 && at(x, y - 1) === "~" && at(x, y + 1) === "~") {
            const glint = scene.add.sprite(px + 4, py + 6, "glint", 0).setOrigin(0, 0).setDepth(DEPTH.decal);
            glint.play({ key: "glint", delay: Math.floor(hash(x, y, 2) * 2000) });
          }
          break;
        default:
          break;
      }
    }
  }

  // --- Casas, puestos, pozos y adornos ---
  const chimneys = [];
  for (const obj of def.objects) {
    const ox = obj.x * TILE;
    const oy = obj.y * TILE;
    if (obj.type === "house") {
      const img = scene.add.image(ox, oy, obj.art).setOrigin(0, 0);
      const { width: w, height: h } = img;
      img.setDepth(oy + h - 3);
      addSolid(ox + 3, oy + Math.round(h * 0.34), w - 6, Math.round(h * 0.66) - 3);
      if (!obj.art.includes("stable")) chimneys.push({ x: ox + w - 15, y: oy + 1 });
    } else if (obj.type === "stall") {
      const img = scene.add.image(ox, oy, obj.art).setOrigin(0, 0).setDepth(oy + 40);
      addSolid(ox + 1, oy + 22, img.width - 2, 17);
    } else if (obj.type === "well") {
      scene.add.image(ox, oy, "well").setOrigin(0, 0).setDepth(oy + 28);
      addSolid(ox + 2, oy + 12, 24, 15);
    } else if (obj.type === "prop") {
      const img = obj.anim
        ? scene.add.sprite(ox, oy, obj.art, 0).setOrigin(0, 0).play(obj.anim)
        : scene.add.image(ox, oy, obj.art).setOrigin(0, 0);
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

  return {
    cols, rows: H, W: cols * TILE, H: H * TILE, at, layer, statics, tallGrass, bushes, addSolid,
    solidAt(px, py) {
      const tile = layer.getTileAtWorldXY(px, py);
      return Boolean(tile && tile.index > 0);
    },
    cellAt(px, py) {
      return at(Math.floor(px / TILE), Math.floor(py / TILE));
    },
  };
}
