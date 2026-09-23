/**
 * Personajes en pixel art. Cuadro de 16×24.
 * Cada cuadro = cabeza (filas 0-11) + cuerpo (12-19) + piernas (20-23).
 * Las letras son partes, no colores: cada personaje trae su propia paleta.
 *
 *  o contorno   H/h/J capucha o casco (base/sombra/luz)   A pelo
 *  S/s piel     e ojo    M máscara   Y/y bufanda o emblema
 *  C/c/L ropa exterior   W/w camisa   B cinto   b bolsa   P/p pantalón   F/f bota
 */

import { Buf, strip } from "./pixel.js";

export const FW = 16;
export const FH = 24;

// ---------- Cabezas ----------
const HEADS = {
  hood: {
    down: [
      "................",
      "......oooo......",
      "....ooHHHHoo....",
      "...oHJJHHHHHo...",
      "..oHJJHHHHHHho..",
      "..oHJHHHHHHHho..",
      ".oHHHAAAAAAHhho.",
      ".oHHASSSSSSAhho.",
      ".ohHSSSSSSSSsho.",
      ".ohHSeSSSSeSsho.",
      ".ohhSeSSSSeSsho.",
      "..ohsSSSSSSsho..",
    ],
    up: [
      "................",
      "......oooo......",
      "....ooHHHHoo....",
      "...oHJJHHHHHo...",
      "..oHJJHHHHHHho..",
      "..oHJHHHHHHHho..",
      ".oHHJHHHHHHHhho.",
      ".oHHHHHHHHHHhho.",
      ".ohHHHHHHHHHhho.",
      ".ohHHHHHHHHHhho.",
      ".ohhHHHHHHHhhho.",
      "..ohhhHHHHhhho..",
    ],
    side: [
      "................",
      ".....oooo.......",
      "...ooHHHHoo.....",
      "..oHJJHHHHHo....",
      ".oHJJHHHHHHHo...",
      ".oHJHHHHHHHHho..",
      ".oHHHHHHAAAAho..",
      ".ohHHHHASSSSSo..",
      ".ohHHHHSSSSSSSo.",
      ".ohhHHHSSSeSSSo.",
      "..ohhHHSSSeSSo..",
      "...ohhhsSSSSo...",
    ],
  },
  helmet: {
    down: [
      "................",
      "......oooo......",
      ".....oJJHHo.....",
      "....oJJHHHHo....",
      "...oJHHHYHHho...",
      "..oJHHHHHHHHho..",
      "oooooooooooooooo",
      ".ohAAAAAAAAAAho.",
      "..oASSSSSSSSAo..",
      "..oSSeSSSSeSSo..",
      "..oSSeSSSSeSSo..",
      "...osSSssSSso...",
    ],
    up: [
      "................",
      "......oooo......",
      ".....oJJHHo.....",
      "....oJJHHHHo....",
      "...oJHHHHHHho...",
      "..oJHHHHHHHHho..",
      "oooooooooooooooo",
      ".ohAAAAAAAAAAho.",
      "..oAAAAAAAAAAo..",
      "..oAAAAAAAAAAo..",
      "..osAAAAAAAAso..",
      "...ossSSSSsso...",
    ],
    side: [
      "................",
      ".....oooo.......",
      "....oJJHHo......",
      "...oJJHHHHo.....",
      "..oJHHHHHHho....",
      ".oJHHHHHHHHho...",
      "ooooooooooooooo.",
      "..ohAAAAASSSo...",
      "..oAAAAASSSSSo..",
      "..oAAAAASSeSSo..",
      "..osAAAASSeSo...",
      "...ossssSSSo....",
    ],
  },
  bandit: {
    down: [
      "................",
      "......oooo......",
      "....ooHHHHoo....",
      "...oHJJHHHHHo...",
      "..oHJJHHHHHHho..",
      "..oHJHHHHHHHho..",
      ".oHHHAAAAAAHhho.",
      ".oHHASSSSSSAhho.",
      ".ohHSeSSSSeSsho.",
      ".ohHMMMMMMMMMho.",
      ".ohhMmMMMMmMMho.",
      "..ohMMMMMMMMho..",
    ],
    up: null, // se usa la capucha de espalda
    side: [
      "................",
      ".....oooo.......",
      "...ooHHHHoo.....",
      "..oHJJHHHHHo....",
      ".oHJJHHHHHHHo...",
      ".oHJHHHHHHHHho..",
      ".oHHHHHHAAAAho..",
      ".ohHHHHASSSSSo..",
      ".ohHHHHSSSeSSSo.",
      ".ohhHHHMMMMMMMo.",
      "..ohhHHMMmMMMo..",
      "...ohhhMMMMMo...",
    ],
  },
  hair: {
    down: [
      "................",
      "................",
      "......oooo......",
      "....ooAAAAoo....",
      "...oAAJJAAAAo...",
      "..oAAJAAAAAAAo..",
      "..oAAAAAAAAAAo..",
      "..oAASSSSSSAAo..",
      "..oASSSSSSSSAo..",
      "..oSSeSSSSeSSo..",
      "..oSSeSSSSeSSo..",
      "...osSSSSSSso...",
    ],
    up: [
      "................",
      "................",
      "......oooo......",
      "....ooAAAAoo....",
      "...oAAJJAAAAo...",
      "..oAAJAAAAAAAo..",
      "..oAAAAAAAAAAo..",
      "..oAAAAAAAAAAo..",
      "..oAAAAAAAAAAo..",
      "..oAAAAAAAAAAo..",
      "..ohAAAAAAAAho..",
      "...ohhSSSShho...",
    ],
    side: [
      "................",
      "................",
      ".....oooo.......",
      "...ooAAAAoo.....",
      "..oAJJAAAAAo....",
      ".oAJAAAAAAAAo...",
      ".oAAAAAAAAAAo...",
      ".oAAAAAASSSSSo..",
      ".oAAAAASSSSSSSo.",
      ".ohAAAASSSeSSSo.",
      "..ohAAASSSeSSo..",
      "...ohhhsSSSSo...",
    ],
  },
  hat: {
    down: [
      "................",
      ".....oooooo.....",
      "....oJJHHHHo....",
      "....oJHHHHHo....",
      "....oYYYYYYo....",
      ".oooHHHHHHHHooo.",
      "oHHHHHHHHHHHHHho",
      ".ooAAAAAAAAAAoo.",
      "..oASSSSSSSSAo..",
      "..oSSeSSSSeSSo..",
      "..oSSeSSSSeSSo..",
      "...osSSSSSSso...",
    ],
    up: [
      "................",
      ".....oooooo.....",
      "....oJJHHHHo....",
      "....oJHHHHHo....",
      "....oYYYYYYo....",
      ".oooHHHHHHHHooo.",
      "oHHHHHHHHHHHHHho",
      ".ooAAAAAAAAAAoo.",
      "..oAAAAAAAAAAo..",
      "..oAAAAAAAAAAo..",
      "..ohAAAAAAAAho..",
      "...ohhSSSShho...",
    ],
    side: [
      "................",
      "....oooooo......",
      "...oJJHHHHo.....",
      "...oJHHHHHo.....",
      "...oYYYYYYo.....",
      "ooHHHHHHHHHooo..",
      "oHHHHHHHHHHHHHo.",
      ".ooAAAAAASSSoo..",
      "..oAAAAASSSSSo..",
      "..oAAAAASSeSSSo.",
      "..ohAAAASSeSSo..",
      "...ohhhsSSSSo...",
    ],
  },
};
HEADS.bandit.up = HEADS.hood.up;

// ---------- Cuerpos ----------
const BODIES = {
  cloak: {
    down: [
      "..oYYYYYYYYYYo..",
      ".oCCYyyyyyyYCCo.",
      ".oCLcWWWWWWcCco.",
      "oCLCcWwWWwWcCCco",
      "oCLCcBBBBBBcCCco",
      "oSCCcWWWWbbcCcSo",
      ".ocCcPPPPPPcCco.",
      "..ooopPPPPpooo..",
    ],
    up: [
      "..oYYYYYYYYYYo..",
      ".oCCYyyyyyyYCCo.",
      ".oCLCCYyCCCCcCo.",
      "oCLCCCYyCCCCCcCo",
      "oCLCCCCyCCCCCcCo",
      "oSLCCCCCCCCCCcSo",
      ".ocCCCCCCCCCcco.",
      "..ooccccccccoo..",
    ],
    side: [
      "...oYYYYYYYYo...",
      "..oCYyyyyyyYo...",
      "..oCLCCCCWWco...",
      ".oCLCCCCCWwco...",
      ".oCLCCCCBBBBo...",
      ".oCLCCCbbSSco...",
      "..ocCCCbbPPco...",
      "...oocccPPoo....",
    ],
  },
  tabard: {
    down: [
      "..ooHHHHHHHHoo..",
      ".oHJCCCCCCCCHho.",
      "oHJoCCYYYYCCohHo",
      "oSJoCCYyyYCCohSo",
      "oSooBBBBBBBBooSo",
      ".o.oCCCCCCCCo.o.",
      "...ocCCCCCCco...",
      "...ooPPPPPPoo...",
    ],
    up: [
      "..ooHHHHHHHHoo..",
      ".oHJCCCCCCCCHho.",
      "oHJoCCCCCCCCohHo",
      "oSJoCCCCCCCCohSo",
      "oSooBBBBBBBBooSo",
      ".o.oCCCCCCCCo.o.",
      "...ocCCCCCCco...",
      "...ooPPPPPPoo...",
    ],
    side: [
      "....oHHHHHHo....",
      "...oHJCCCCCco...",
      "...oJCCYYCCco...",
      "...oJCCYyCCco...",
      "...oSBBBBBBBo...",
      "....oCCCCCCco...",
      "....ocCCCCcco...",
      "....ooPPPPoo....",
    ],
  },
  tunic: {
    down: [
      "...ooCCCCCCoo...",
      "..oCLCCYYCCCco..",
      ".oCLoCCYyCCocCo.",
      ".oSLoCCCCCCocSo.",
      ".oSooBBBBBBooSo.",
      "..o.oCCCCCco.o..",
      "....ocCCCCco....",
      "....oPPPPPPo....",
    ],
    up: [
      "...ooCCCCCCoo...",
      "..oCLCCCCCCCco..",
      ".oCLoCCCCCCocCo.",
      ".oSLoCCCCCCocSo.",
      ".oSooBBBBBBooSo.",
      "..o.oCCCCCco.o..",
      "....ocCCCCco....",
      "....oPPPPPPo....",
    ],
    side: [
      ".....oCCCCo.....",
      "....oCLCCCco....",
      "....oLCCYCco....",
      "....oLCCCSSo....",
      "....oBBBBBBo....",
      "....oCCCCCco....",
      "....ocCCCcco....",
      "....ooPPPPoo....",
    ],
  },
};

// ---------- Piernas (0 = quieto, 1 = paso A, 2 = paso B) ----------
const LEGS = {
  down: [
    ["....oPpooPpo....", "....oPpooPpo....", "...oFFfooFFfo...", "...oooo..oooo..."],
    ["....oPpooPpo....", "....oPpooFFfo...", "...oFFfo.oooo...", "...oooo........."],
    ["....oPpooPpo....", "...oFFfooPpo....", "...oooo.oFFfo...", ".........oooo..."],
  ],
  side: [
    [".....oPPpo......", ".....oPPpo......", ".....oFFFFo.....", ".....oooooo....."],
    ["....oPpoPpo.....", "...oPpo.oPpo....", "..oFFfo.oFFFo...", "..ooooo.ooooo..."],
    [".....oPPpo......", ".....oPpPo......", ".....oFFFFo.....", ".....oooooo....."],
  ],
};
LEGS.up = LEGS.down;

// Cuerpo agachado (esconderse): el tronco baja y las piernas se doblan.
const CROUCH_LEGS = {
  down: ["...oFFfooFFfo...", "...oooo..oooo..."],
  side: ["....oFFFFFFo....", "....oooooooo...."],
};
CROUCH_LEGS.up = CROUCH_LEGS.down;

/** Paletas por personaje. */
export const CASTS = {
  player: {
    head: "hood", body: "cloak",
    map: {
      o: "ink", H: "r2", h: "r1", J: "r3", A: "o1", S: "k3", s: "k2", e: "ink",
      Y: "y3", y: "y1", C: "r2", c: "r1", L: "r3", W: "c3", w: "c2", B: "o2", b: "o4",
      P: "o2", p: "o1", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  guard: {
    head: "helmet", body: "tabard",
    map: {
      o: "ink", H: "s3", h: "s2", J: "s5", A: "o1", S: "k3", s: "k2", e: "ink",
      Y: "y3", y: "y1", C: "b2", c: "b1", L: "b3", W: "c3", w: "c2", B: "o1", b: "o3",
      P: "s1", p: "s0", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  bandit: {
    head: "bandit", body: "cloak",
    map: {
      o: "ink", H: "l2", h: "l1", J: "l3", A: "ink2", S: "k2", s: "k1", e: "e4",
      Y: "e2", y: "e1", C: "l2", c: "l1", L: "l3", W: "d2", w: "d1", B: "o1", b: "o3",
      P: "d1", p: "d0", F: "o0", f: "ink", M: "e2", m: "e1",
    },
  },
  villager: {
    head: "hair", body: "tunic",
    map: {
      o: "ink", H: "o2", h: "o1", J: "o4", A: "o2", S: "k3", s: "k2", e: "ink",
      Y: "c3", y: "c2", C: "g3", c: "g2", L: "g4", W: "c3", w: "c2", B: "o1", b: "o3",
      P: "o2", p: "o1", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  villager2: {
    head: "hair", body: "tunic",
    map: {
      o: "ink", H: "t1", h: "t0", J: "t3", A: "t2", S: "k4", s: "k3", e: "ink",
      Y: "y3", y: "y2", C: "v2", c: "v1", L: "v3", W: "c3", w: "c2", B: "o1", b: "o3",
      P: "s2", p: "s1", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  villager3: {
    head: "hair", body: "tunic",
    map: {
      o: "ink", H: "s1", h: "s0", J: "s3", A: "s1", S: "k2", s: "k1", e: "ink",
      Y: "c4", y: "c2", C: "w2", c: "w1", L: "w3", W: "c3", w: "c2", B: "o1", b: "o3",
      P: "o3", p: "o2", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  merchant: {
    head: "hat", body: "tunic",
    map: {
      o: "ink", H: "o3", h: "o2", J: "o4", A: "o1", S: "k3", s: "k2", e: "ink",
      Y: "e2", y: "e1", C: "y2", c: "y1", L: "y3", W: "c3", w: "c2", B: "o1", b: "o3",
      P: "o2", p: "o1", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  smith: {
    head: "hair", body: "tunic",
    map: {
      o: "ink", H: "ink2", h: "ink", J: "s1", A: "ink2", S: "k1", s: "k0", e: "ink",
      Y: "o4", y: "o3", C: "o3", c: "o2", L: "o4", W: "c3", w: "c2", B: "ink2", b: "o3",
      P: "s1", p: "s0", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  stablehand: {
    head: "hat", body: "tunic",
    map: {
      o: "ink", H: "t3", h: "t2", J: "t4", A: "d1", S: "k3", s: "k2", e: "ink",
      Y: "o2", y: "o1", C: "d3", c: "d2", L: "d4", W: "c3", w: "c2", B: "o1", b: "o3",
      P: "b1", p: "b0", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
};

function frame(cast, dir, legIndex, { crouch = false } = {}) {
  const { head, body, map } = CASTS[cast];
  const buf = new Buf(FW, FH);
  const view = dir === "up" ? "up" : dir === "side" ? "side" : "down";
  const drop = crouch ? 3 : 0;
  if (crouch) buf.stamp(CROUCH_LEGS[view], map, 0, 22);
  else buf.stamp(LEGS[view][legIndex], map, 0, 20);
  buf.stamp(BODIES[body][view], map, 0, 12 + drop);
  buf.stamp(HEADS[head][view], map, 0, drop);
  return buf;
}

/**
 * Hoja de un personaje: 3 vistas × (quieto, paso A, quieto, paso B, agachado).
 * Índices: down 0-4, up 5-9, side 10-14.
 */
export function castSheet(cast) {
  const frames = [];
  for (const dir of ["down", "up", "side"]) {
    frames.push(frame(cast, dir, 0), frame(cast, dir, 1), frame(cast, dir, 0), frame(cast, dir, 2));
    frames.push(frame(cast, dir, 0, { crouch: true }));
  }
  return strip(frames);
}

export const SHEET_INDEX = { down: 0, up: 5, side: 10 };

/** Silueta blanca para el destello de daño (funciona también en Canvas). */
export function flashSheet(sheet) {
  const out = sheet.buf.clone();
  for (let i = 0; i < out.data.length; i += 1) if (out.data[i] >>> 24) out.data[i] = 0xffffffff;
  return { ...sheet, buf: out };
}

/** Rodada: bola de capa que gira. Un dibujo, cuatro rotaciones exactas. */
export function rollSheet() {
  const map = CASTS.player.map;
  const ball = new Buf(16, 16);
  ball.stamp([
    "................",
    ".....oooooo.....",
    "...ooHHHHJJoo...",
    "..oHHHHHHHJJHo..",
    "..oHHHHHHHHJHo..",
    ".ohHYYYHHHHHHHo.",
    ".ohYYyYYHHHHHHo.",
    ".ohHyyyYYHHHHHo.",
    ".ohhHHyyYYHHHHo.",
    ".ohhHHHHyYYHHHo.",
    ".ohhhHHHHyyHHho.",
    "..ohhhHHHHHHho..",
    "..oohhhhhhhhoo..",
    "....oohhhhoo....",
    "......oooo......",
    "................",
  ], map);
  const frames = [ball];
  for (let i = 1; i < 4; i += 1) frames.push(frames[i - 1].rotated());
  return strip(frames);
}

/** Tirado en el piso (KO): el cuadro de frente, acostado. */
export function koFrame(cast) {
  return frame(cast, "down", 0).rotated();
}
