/**
 * Fuente pixel propia, de ancho variable, con acentos y ñ.
 * Celda de 11 filas: 0-1 acento de mayúscula, 2-8 cuerpo (línea base en 8), 9-10 descendente.
 * Cada línea: <letra> <fila de arriba> <filas separadas por |>
 */

import { Buf } from "./pixel.js";
import { rgba } from "./palette.js";

const GLYPHS = String.raw`
A 2 .###.|#...#|#...#|#####|#...#|#...#|#...#
B 2 ####.|#...#|#...#|####.|#...#|#...#|####.
C 2 .###.|#...#|#....|#....|#....|#...#|.###.
D 2 ####.|#...#|#...#|#...#|#...#|#...#|####.
E 2 #####|#....|#....|####.|#....|#....|#####
F 2 #####|#....|#....|####.|#....|#....|#....
G 2 .###.|#...#|#....|#.###|#...#|#...#|.####
H 2 #...#|#...#|#...#|#####|#...#|#...#|#...#
I 2 ###|.#.|.#.|.#.|.#.|.#.|###
J 2 ..###|...#.|...#.|...#.|#..#.|#..#.|.##..
K 2 #...#|#..#.|#.#..|##...|#.#..|#..#.|#...#
L 2 #....|#....|#....|#....|#....|#....|#####
M 2 #...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#
N 2 #...#|##..#|#.#.#|#..##|#...#|#...#|#...#
O 2 .###.|#...#|#...#|#...#|#...#|#...#|.###.
P 2 ####.|#...#|#...#|####.|#....|#....|#....
Q 2 .###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#
R 2 ####.|#...#|#...#|####.|#.#..|#..#.|#...#
S 2 .####|#....|#....|.###.|....#|....#|####.
T 2 #####|..#..|..#..|..#..|..#..|..#..|..#..
U 2 #...#|#...#|#...#|#...#|#...#|#...#|.###.
V 2 #...#|#...#|#...#|#...#|.#.#.|.#.#.|..#..
W 2 #...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#
X 2 #...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#
Y 2 #...#|#...#|.#.#.|..#..|..#..|..#..|..#..
Z 2 #####|....#|...#.|..#..|.#...|#....|#####
a 4 .###.|....#|.####|#...#|.####
b 2 #....|#....|####.|#...#|#...#|#...#|####.
c 4 .###|#...|#...|#...|.###
d 2 ....#|....#|.####|#...#|#...#|#...#|.####
e 4 .###.|#...#|#####|#....|.###.
f 2 ..##|.#..|####|.#..|.#..|.#..|.#..
g 4 .####|#...#|#...#|#...#|.####|....#|.###.
h 2 #....|#....|####.|#...#|#...#|#...#|#...#
i 2 #|.|#|#|#|#|#
j 2 ..#|...|..#|..#|..#|..#|..#|..#|##.
k 2 #...|#...|#..#|#.#.|##..|#.#.|#..#
l 2 #.|#.|#.|#.|#.|#.|.#
m 4 ####.|#.#.#|#.#.#|#.#.#|#.#.#
n 4 ###.|#..#|#..#|#..#|#..#
o 4 .##.|#..#|#..#|#..#|.##.
p 4 ###.|#..#|#..#|#..#|###.|#...|#...
q 4 .###|#..#|#..#|#..#|.###|...#|...#
r 4 #.##|##..|#...|#...|#...
s 4 .###|#...|.##.|...#|###.
t 3 .#.|###|.#.|.#.|.#.|..#
u 4 #..#|#..#|#..#|#..#|.###
v 4 #...#|#...#|.#.#.|.#.#.|..#..
w 4 #...#|#.#.#|#.#.#|#.#.#|.#.#.
x 4 #...#|.#.#.|..#..|.#.#.|#...#
y 4 #..#|#..#|#..#|#..#|.###|...#|.##.
z 4 ####|...#|.##.|#...|####
0 2 .###.|#...#|#..##|#.#.#|##..#|#...#|.###.
1 2 .#.|##.|.#.|.#.|.#.|.#.|###
2 2 .###.|#...#|....#|...#.|..#..|.#...|#####
3 2 ####.|....#|....#|.###.|....#|....#|####.
4 2 ...#.|..##.|.#.#.|#..#.|#####|...#.|...#.
5 2 #####|#....|####.|....#|....#|#...#|.###.
6 2 .###.|#....|#....|####.|#...#|#...#|.###.
7 2 #####|....#|...#.|..#..|..#..|..#..|..#..
8 2 .###.|#...#|#...#|.###.|#...#|#...#|.###.
9 2 .###.|#...#|#...#|.####|....#|....#|.###.
. 8 #
, 8 .#|#.
: 5 #|.|.|#
; 5 .#|..|..|.#|#.
! 2 #|#|#|#|#|.|#
? 2 .##.|#..#|...#|..#.|.#..|....|.#..
¡ 2 #|.|#|#|#|#|#
¿ 2 ..#.|....|..#.|.#..|#...|#..#|.##.
' 2 #|#
" 2 #.#|#.#
- 5 ###
+ 4 .#.|###|.#.
/ 2 ..#|..#|.#.|.#.|.#.|#..|#..
( 2 .#|#.|#.|#.|#.|#.|.#
) 2 #.|.#|.#|.#|.#|.#|#.
[ 2 ##|#.|#.|#.|#.|#.|##
] 2 ##|.#|.#|.#|.#|.#|##
· 5 #
% 2 ##...|##..#|...#.|..#..|.#...|#..##|...##
* 3 #.#|.#.|#.#
< 3 ..#|.#.|#..|.#.|..#
> 3 #..|.#.|..#|.#.|#..
= 4 ###|...|###
_ 9 #####
× 4 #.#|.#.|#.#
→ 3 ..#..|...#.|#####|...#.|..#..
← 3 ..#..|.#...|#####|.#...|..#..
↑ 2 ..#..|.###.|#.#.#|..#..|..#..|..#..|..#..
↓ 2 ..#..|..#..|..#..|..#..|#.#.#|.###.|..#..
▶ 3 #..|##.|###|##.|#..
▼ 4 #####|.###.|..#..
♥ 3 .#.#.|#####|#####|.###.|..#..
`;

const CELL_H = 11;
const LINE_H = 12;
const SPACE = 3;

function parseGlyphs() {
  const out = new Map();
  for (const line of GLYPHS.split("\n")) {
    if (!line.trim()) continue;
    const ch = line[0];
    const [top, body] = line.slice(2).split(" ");
    out.set(ch, { top: Number(top), rows: body.split("|") });
  }
  // Acentos: se arman sobre la letra base.
  const accent = (base, mark, name) => {
    const g = out.get(base);
    const w = g.rows[0].length;
    const upper = base === base.toUpperCase();
    const mid = Math.floor((w - 1) / 2);
    const marks = {
      acute: [[mid + 1, 0], [mid, 1]],
      tilde: [[0, 1], [1, 0], [2, 1], [3, 0]],
      dia: [[0, 1], [w - 1, 1]],
    }[mark];
    const top = upper ? 0 : 2;
    const rows = [];
    const grid = Array.from({ length: g.top + g.rows.length - top }, () => Array(w).fill("."));
    marks.forEach(([x, y]) => { if (x < w) grid[y][x] = "#"; });
    g.rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === "#") grid[g.top - top + y][x] = "#"; }));
    grid.forEach((r) => rows.push(r.join("")));
    out.set(name, { top, rows });
  };
  accent("a", "acute", "á"); accent("e", "acute", "é"); accent("o", "acute", "ó"); accent("u", "acute", "ú");
  accent("n", "tilde", "ñ"); accent("u", "dia", "ü");
  accent("A", "acute", "Á"); accent("E", "acute", "É"); accent("I", "acute", "Í");
  accent("O", "acute", "Ó"); accent("U", "acute", "Ú"); accent("N", "tilde", "Ñ");
  out.set("í", { top: 2, rows: [".#", "#.", "..", "#.", "#.", "#.", "#."] });
  return out;
}

const PARSED = parseGlyphs();

/** Variantes de color. Sin tint: cada variante es su propia textura (sirve en Canvas y WebGL). */
export const FONT_VARIANTS = {
  font: { color: "c4", shadow: "ink2" },
  "font-dark": { color: "ink" },
  "font-o": { color: "c4", outline: "ink" },
  "font-gold": { color: "y4", outline: "ink" },
  "font-red": { color: "e4", outline: "ink" },
  "font-green": { color: "g6", outline: "ink" },
  "font-blue": { color: "b5", outline: "ink" },
  "font-dim": { color: "c1", shadow: "ink" },
};

function buildAtlas({ color, outline, shadow }) {
  const pad = outline ? 1 : 0;
  const extra = shadow ? 1 : 0;
  const entries = [...PARSED.entries()];
  const cellW = 7 + pad * 2 + extra;
  const cellH = CELL_H + pad * 2 + extra;
  const perRow = 16;
  const buf = new Buf(cellW * perRow, cellH * Math.ceil(entries.length / perRow));
  const chars = {};
  const main = rgba(color);
  entries.forEach(([ch, g], i) => {
    const w = g.rows.reduce((m, r) => Math.max(m, r.length), 0);
    const ox = (i % perRow) * cellW;
    const oy = Math.floor(i / perRow) * cellH;
    const glyph = new Buf(w + pad * 2 + extra, CELL_H + pad * 2 + extra);
    g.rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c !== "#") return;
      if (shadow) glyph.set(x + pad + 1, g.top + y + pad + 1, rgba(shadow));
    }));
    g.rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === "#") glyph.set(x + pad, g.top + y + pad, main);
    }));
    if (outline) glyph.outline(outline, { diagonal: true });
    buf.blit(glyph, ox, oy);
    chars[ch.codePointAt(0)] = { x: ox, y: oy, width: glyph.w, height: glyph.h, xOffset: -pad, yOffset: -pad, xAdvance: w + 1 };
  });
  chars[32] = { x: 0, y: 0, width: 0, height: 0, xOffset: 0, yOffset: 0, xAdvance: SPACE };
  return { buf, chars };
}

/** Registra todas las variantes como BitmapFont en la caché de Phaser. */
export function registerFonts(scene) {
  for (const [key, spec] of Object.entries(FONT_VARIANTS)) {
    const { buf, chars } = buildAtlas(spec);
    const texture = scene.textures.addCanvas(key, buf.toCanvas());
    const W = buf.w;
    const H = buf.h;
    const data = { font: key, size: CELL_H, lineHeight: LINE_H, chars: {} };
    for (const [code, c] of Object.entries(chars)) {
      data.chars[code] = {
        x: c.x, y: c.y, width: c.width, height: c.height,
        centerX: Math.floor(c.width / 2), centerY: Math.floor(c.height / 2),
        xOffset: c.xOffset, yOffset: c.yOffset, xAdvance: c.xAdvance,
        data: {}, kerning: {},
        u0: c.x / W, v0: 1 - c.y / H, u1: (c.x + c.width) / W, v1: 1 - (c.y + c.height) / H,
      };
      if (c.width && c.height) texture.add(String.fromCodePoint(Number(code)), 0, c.x, c.y, c.width, c.height);
    }
    scene.cache.bitmapFont.add(key, { data, texture: key, frame: null });
  }
}

/** Ancho en píxeles de un texto con esta fuente (para centrar a mano). */
export function textWidth(text) {
  let w = 0;
  for (const ch of text) {
    if (ch === " ") { w += SPACE; continue; }
    const g = PARSED.get(ch);
    w += g ? g.rows.reduce((m, r) => Math.max(m, r.length), 0) + 1 : 4;
  }
  return Math.max(0, w - 1);
}

/**
 * Centra un BitmapText en X usando píxeles enteros. Con origen 0.5 un texto de ancho
 * impar queda en medio píxel y las letras se deforman al escalar.
 */
export function centerX(t) {
  t.setOrigin(0, t.originY);
  t.x = Math.round(t.x - textWidth(t.text) / 2);
  return t;
}

export const FONT_SIZE = CELL_H;
export const FONT_LINE = LINE_H;

/** Para el laboratorio de arte. */
export function fontPreview(variant = "font-o") {
  return buildAtlas(FONT_VARIANTS[variant]).buf;
}
