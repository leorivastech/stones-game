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
import { rgba } from "./palette.js";

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

// ---------- Piernas ----------
// 0 quieto, 1 paso A, 2 paso B, 3 paso A en el aire (pie alto / pasando), 4 paso B en el aire.
const LEGS = {
  down: [
    ["....oPpooPpo....", "....oPpooPpo....", "...oFFfooFFfo...", "...oooo..oooo..."],
    ["....oPpooPpo....", "....oPpooFFfo...", "...oFFfo.oooo...", "...oooo........."],
    ["....oPpooPpo....", "...oFFfooPpo....", "...oooo.oFFfo...", ".........oooo..."],
    ["....oPpooFFfo...", "....oPpo.oooo...", "...oFFfo........", "...oooo........."],
    ["...oFFfooPpo....", "...oooo.oPpo....", "........oFFfo...", "........oooo...."],
  ],
  side: [
    [".....oPPpo......", ".....oPPpo......", ".....oFFFFo.....", ".....oooooo....."],
    ["....oPpoPpo.....", "...oPpo.oPpo....", "..oFFfo.oFFFo...", "..ooooo.ooooo..."],
    ["....oPpoPpo.....", "...opPo.oPPo....", "..oFFFo.oFFfo...", "..ooooo.ooooo..."],
    // Pasando: una pierna apoyada bajo el cuerpo, el otro pie levantado atrás.
    [".....oPPpo......", "...oFfoPpo......", "...oooFFFFo.....", "......ooooo....."],
    [".....opPPo......", "...oFFopPo......", "...oooFFFFo.....", "......ooooo....."],
  ],
};
LEGS.up = LEGS.down;

/**
 * Ciclo de paso de 6 cuadros por vista: [piernas, cuerpo abajo, brazos].
 * De lado: apoyo A, carga A, pasa, apoyo B, carga B, pasa. De frente/espalda: pie alto, bajando, apoyo.
 * Los brazos van al revés que las piernas (contrafase) y al pasar quedan al centro.
 */
const WALK = {
  side: [[1, 0, 1], [1, 1, 1], [3, 0, 0], [2, 0, -1], [2, 1, -1], [4, 0, 0]],
  down: [[3, 0, 1], [1, 0, 1], [0, 1, 0], [4, 0, -1], [2, 0, -1], [0, 1, 0]],
};
WALK.up = WALK.down;

// Cuerpo agachado (esconderse): el tronco baja y las piernas se doblan.
const CROUCH_LEGS = {
  down: ["...oFFfooFFfo...", "...oooo..oooo..."],
  side: ["....oFFFFFFo....", "....oooooooo...."],
};
CROUCH_LEGS.up = CROUCH_LEGS.down;

/** Paletas por personaje. */
export const CASTS = {
  player: {
    head: "hood", body: "cloak", weapon: "staff",
    map: {
      o: "ink", H: "r2", h: "r1", J: "r3", A: "o1", S: "k3", s: "k2", e: "ink",
      Y: "y3", y: "y1", C: "r2", c: "r1", L: "r3", W: "c3", w: "c2", B: "o2", b: "o4",
      P: "o2", p: "o1", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  guard: {
    head: "helmet", body: "tabard", weapon: "sword",
    map: {
      o: "ink", H: "s3", h: "s2", J: "s5", A: "o1", S: "k3", s: "k2", e: "ink",
      Y: "y3", y: "y1", C: "b2", c: "b1", L: "b3", W: "c3", w: "c2", B: "o1", b: "o3",
      P: "s1", p: "s0", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  bandit: {
    head: "bandit", body: "cloak", weapon: "knife",
    map: {
      o: "ink", H: "l2", h: "l1", J: "l3", A: "ink2", S: "k2", s: "k1", e: "e4",
      Y: "e2", y: "e1", C: "l2", c: "l1", L: "l3", W: "d2", w: "d1", B: "o1", b: "o3",
      P: "d1", p: "d0", F: "o0", f: "ink", M: "e2", m: "e1",
    },
  },
  // Matón del Gremio (deuda con dientes, 26-sep): el mismo embozado del bandido, de morado del
  // Gremio con ribetes de oro del sello.
  thug: {
    head: "bandit", body: "cloak", weapon: "knife",
    map: {
      o: "ink", H: "v1", h: "v0", J: "v2", A: "ink2", S: "k2", s: "k1", e: "y4",
      Y: "y3", y: "y2", C: "v1", c: "v0", L: "v2", W: "s2", w: "s1", B: "y1", b: "o3",
      P: "s1", p: "s0", F: "o0", f: "ink", M: "y2", m: "y1",
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
    head: "hair", body: "tunic", weapon: "hammer",
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
  // Arquera escolta de Duneshade: capucha arena, bufanda turquesa, capa de viaje, arco.
  archer: {
    head: "hood", body: "tunic", gear: "bow",
    map: {
      o: "ink", H: "d4", h: "d3", J: "d5", A: "o1", S: "k2", s: "k1", e: "ink",
      Y: "w3", y: "w2", C: "d3", c: "d2", L: "d4", W: "c3", w: "c2", B: "o1", b: "o4",
      P: "o2", p: "o1", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  // Barquero de Frostholm.
  ferryman: {
    head: "hat", body: "tunic",
    map: {
      o: "ink", H: "b1", h: "b0", J: "b2", A: "c1", S: "k3", s: "k2", e: "ink",
      Y: "c4", y: "c2", C: "b2", c: "b1", L: "b3", W: "c3", w: "c2", B: "o1", b: "o3",
      P: "s2", p: "s1", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  // Curandera de Verdelume.
  healer: {
    head: "hair", body: "tunic",
    map: {
      o: "ink", H: "c2", h: "c1", J: "c4", A: "c2", S: "k2", s: "k1", e: "ink",
      Y: "v4", y: "v3", C: "f3", c: "f2", L: "f4", W: "c3", w: "c2", B: "o1", b: "o3",
      P: "o2", p: "o1", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  // Buhonero de camino: sombrero violeta con cinta de oro, bufanda dorada, capa café de viaje.
  peddler: {
    head: "hat", body: "cloak",
    map: {
      o: "ink", H: "v2", h: "v1", J: "v3", A: "y3", S: "k3", s: "k2", e: "ink",
      Y: "y3", y: "y2", C: "o3", c: "o2", L: "o4", W: "c3", w: "c2", B: "o1", b: "o4",
      P: "o2", p: "o1", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  // Gente del desierto (turbante claro) y de la nieve (capucha de piel).
  desertfolk: {
    head: "hood", body: "tunic",
    map: {
      o: "ink", H: "c3", h: "c2", J: "c4", A: "ink2", S: "k1", s: "k0", e: "ink",
      Y: "r3", y: "r2", C: "c2", c: "c1", L: "c3", W: "c3", w: "c2", B: "r2", b: "o3",
      P: "d3", p: "d2", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
  snowfolk: {
    head: "hood", body: "cloak",
    map: {
      o: "ink", H: "n3", h: "n1", J: "n4", A: "o1", S: "k3", s: "k2", e: "ink",
      Y: "e2", y: "e1", C: "b1", c: "b0", L: "b2", W: "n3", w: "n2", B: "o1", b: "o4",
      P: "s2", p: "s1", F: "o1", f: "o0", M: "l1", m: "l0",
    },
  },
};

/**
 * Mueve las manos (piel en las orillas del cuerpo) para que los brazos se balanceen al caminar.
 * De frente/espalda suben o bajan un píxel; de lado van adelante o atrás.
 */
function swingHands(buf, map, view, top, swing) {
  if (!swing) return;
  const skin = rgba(map.S);
  const hands = [];
  for (let y = top; y < top + 8; y += 1) {
    for (let x = 0; x < FW; x += 1) {
      if (buf.get(x, y) !== skin) continue;
      if (view === "side" ? x >= 4 && x <= 12 : x <= 2 || x >= 13) hands.push([x, y]);
    }
  }
  // Primero se leen todos los rellenos (del dibujo original) y después se mueve.
  const moves = hands.map(([x, y]) => {
    const dx = view === "side" ? swing : 0;
    const dy = view === "side" ? 0 : x <= 2 ? swing : -swing;
    const fill = view === "side" ? buf.get(x - dx, y) : buf.get(x, y - 1);
    return { x, y, dx, dy, fill };
  });
  for (const m of moves) buf.set(m.x, m.y, m.fill);
  for (const m of moves) buf.set(m.x + m.dx, m.y + m.dy, skin);
}

/** Arco en la espalda (quieto y caminando) o tensado al frente (acción). */
function drawBow(buf, map, view, drop, aiming) {
  // Madera oscura para que se lea sobre la ropa clara; cuerda y flecha claras.
  const wood = "o2";
  const lit = "o4";
  const string = "c4";
  const shaft = "t3";
  const feather = "e3";
  const tip = "s5";
  const skin = map.S;
  const arc = (pts) => pts.forEach(([x, y], i) => buf.set(x, y + drop, i === Math.floor(pts.length / 2) ? lit : wood));
  if (!aiming) {
    // Carcaj con plumas rojas y arco colgado a la espalda.
    if (view === "down") {
      buf.set(13, 10 + drop, feather); buf.set(14, 11 + drop, wood); buf.set(14, 12 + drop, wood);
    } else if (view === "up") {
      buf.rect(10, 12 + drop, 2, 6, "o2");
      buf.vline(10, 12 + drop, 6, "o3");
      buf.set(10, 11 + drop, feather); buf.set(11, 11 + drop, feather); buf.set(11, 10 + drop, "c4");
      arc([[3, 12], [4, 13], [4, 14], [4, 15], [4, 16], [4, 17], [3, 18]]);
      for (let y = 13; y <= 17; y += 1) buf.set(3, y + drop, string);
    } else {
      buf.rect(3, 12 + drop, 2, 5, "o2");
      buf.set(3, 11 + drop, feather); buf.set(4, 11 + drop, feather);
    }
    return;
  }
  if (view === "side") {
    arc([[12, 10], [13, 11], [14, 12], [14, 13], [14, 14], [14, 15], [14, 16], [13, 17], [12, 18]]);
    for (let y = 11; y <= 17; y += 1) buf.set(10, y + drop, string);
    for (let x = 8; x <= 14; x += 1) buf.set(x, 14 + drop, shaft);
    buf.set(15, 14 + drop, tip);
    buf.set(7, 13 + drop, feather); buf.set(7, 15 + drop, feather);
    buf.set(10, 14 + drop, skin); buf.set(14, 14 + drop, skin);
  } else if (view === "down") {
    // Hacia el frente: arco vertical en la mano izquierda, cuerda tensada hacia la cara.
    arc([[3, 9], [2, 10], [1, 11], [1, 12], [1, 13], [1, 14], [1, 15], [2, 16], [3, 17]]);
    for (let y = 10; y <= 16; y += 1) buf.set(4, y + drop, string);
    buf.set(1, 13 + drop, skin);
    buf.set(4, 13 + drop, skin); buf.set(5, 13 + drop, skin);
    buf.set(2, 13 + drop, tip);
  } else {
    arc([[2, 6], [3, 5], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 5], [13, 6]]);
    for (let x = 3; x <= 12; x += 1) buf.set(x, 7 + drop, string);
    for (let y = 1; y <= 8; y += 1) buf.set(8, y + drop, shaft);
    buf.set(8, 0 + drop, tip);
    buf.set(7, 9 + drop, feather); buf.set(9, 9 + drop, feather);
  }
}

// ---------- Armas y poses de golpe ----------
/** Lo que cada quien lleva en la mano al golpear (o martillar). Sin arma: las manos solas. */
const WEAPONS = {
  staff: { len: 7, shaft: "o4", dark: "o2", tip: "y4" },
  sword: { len: 6, shaft: "s5", dark: "s2", tip: "s6", hilt: "y2" },
  knife: { len: 3, shaft: "s5", dark: "s2", tip: "s6", hilt: "o1" },
  hammer: { len: 4, shaft: "o3", dark: "o1", head: ["s2", "s4", "s5"] },
};

/**
 * Pose de golpe por vista: preparación (el arma atrás/arriba) y golpe (brazo extendido, cuerpo
 * inclinado 1 px hacia adelante). `hand` y `shoulder` en coordenadas del cuadro de 16×24;
 * `dir` hacia dónde sale el arma desde la mano; `side` qué mano se mueve (para borrar la de reposo).
 * Van de acuerdo con el barrido de fx.js: arranca arriba y termina adelante-abajo.
 */
const SWING = {
  side: {
    windup: { lean: [-1, 0], legs: 0, shoulder: [8, 14], hand: [4, 10], dir: [-1, -1], side: "mid" },
    strike: { lean: [1, 0], legs: 1, shoulder: [9, 14], hand: [13, 16], dir: [1, 1], side: "mid" },
  },
  down: {
    windup: { lean: [0, -1], legs: 0, shoulder: [13, 14], hand: [14, 10], dir: [0, -1], side: "right" },
    strike: { lean: [0, 1], legs: 0, shoulder: [12, 15], hand: [9, 20], dir: [0, 1], side: "right" },
  },
  up: {
    windup: { lean: [0, 1], legs: 0, shoulder: [2, 15], hand: [1, 11], dir: [0, -1], side: "left" },
    strike: { lean: [0, -1], legs: 0, shoulder: [12, 13], hand: [11, 8], dir: [0, -1], side: "right" },
  },
};

/** Borra la mano de reposo (piel en la orilla del cuerpo) para que no quede una tercera mano. */
function eraseHand(buf, map, top, side) {
  const skin = rgba(map.S);
  const cloth = rgba(map.c);
  for (let y = top; y < top + 8; y += 1) {
    for (let x = 0; x < FW; x += 1) {
      if (buf.get(x, y) !== skin) continue;
      const hit = side === "mid" ? x >= 4 && x <= 12 : side === "left" ? x <= 2 : x >= 13;
      if (hit) buf.set(x, y, cloth);
    }
  }
}

/** Línea de píxeles (Bresenham) de a hacia b, sin el último punto. */
function line(a, b) {
  const pts = [];
  let [x, y] = a;
  const [x1, y1] = b;
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  while (x !== x1 || y !== y1) {
    pts.push([x, y]);
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return pts;
}

/** Brazo (manga + mano) y arma. Lo nuevo que queda fuera de la silueta lleva contorno oscuro. */
function drawArm(buf, map, pose, weaponId, lean, view, phase) {
  const [lx, ly] = lean;
  const sh = [pose.shoulder[0] + lx, pose.shoulder[1] + ly];
  const hand = [pose.hand[0] + lx, pose.hand[1] + ly];
  const drawn = [];
  const put = (x, y, c) => {
    if (!buf.inside(x, y)) return;
    buf.set(x, y, c);
    drawn.push([x, y]);
  };
  for (const [x, y] of line(sh, hand)) put(x, y, map.L);
  put(hand[0], hand[1], map.S);
  const w = WEAPONS[weaponId];
  if (w) {
    const [dx, dy] = pose.dir;
    // En la preparación se ve el arma entera; al golpear la estela de fx.js dibuja el resto.
    const len = phase === "strike" ? Math.min(w.len, view === "side" ? 3 : 3) : w.len;
    for (let i = 1; i <= len; i += 1) {
      const x = hand[0] + dx * i;
      const y = hand[1] + dy * i;
      const last = i === len;
      let c = w.shaft;
      if (i === 1 && w.hilt) c = w.hilt;
      else if (last && w.tip) c = w.tip;
      put(x, y, c);
      // Sombra del lado de abajo/derecha para que el palo tenga cuerpo (como en el barrido).
      if (weaponId === "staff" && !last && (dx !== 0 && dy !== 0)) put(x, y + 1, w.dark);
    }
    if (w.head) {
      // Cabeza del martillo: 3 píxeles cruzados a la punta.
      const ex = hand[0] + dx * (len + 1);
      const ey = hand[1] + dy * (len + 1);
      const [px, py] = dx === 0 ? [1, 0] : dy === 0 ? [0, 1] : [1, -1];
      put(ex - px, ey - py, w.head[0]);
      put(ex, ey, w.head[1]);
      put(ex + px, ey + py, w.head[2]);
    }
  }
  // Contorno: sólo alrededor de lo nuevo y sólo sobre lo transparente.
  const ink = rgba(map.o);
  const mark = new Set(drawn.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of drawn) {
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox;
      const ny = y + oy;
      if (!buf.inside(nx, ny) || mark.has(`${nx},${ny}`)) continue;
      // Encima del cuerpo también: así el brazo se lee contra la ropa del mismo color.
      buf.set(nx, ny, ink);
    }
  }
}

/** Cargando (ataque cargado): el contorno se vuelve dorado. `dx` corre el dibujo 1 px (temblor). */
function glowed(src, dx = 0) {
  const out = new Buf(src.w, src.h);
  out.blit(src, dx, 0);
  const rim = rgba("y4");
  const ink = rgba("ink");
  const copy = out.clone();
  for (let y = 0; y < out.h; y += 1) {
    for (let x = 0; x < out.w; x += 1) {
      if (copy.get(x, y) !== ink) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => !(copy.get(x + ox, y + oy) >>> 24));
      if (edge) out.set(x, y, rim);
    }
  }
  return out;
}

/**
 * Un cuadro. `legs`: 0 quieto, 1 paso A, 2 paso B, 3/4 pie en el aire. `bob`: el cuerpo baja 1 px
 * al apoyar el pie. `swing`: brazos (−1/0/1). `nod`: la cabeza baja 1 px (respirar). `act`: pose de
 * acción (arco). `swingPose`: "windup" o "strike" (golpe con el arma de su paleta).
 */
function frame(cast, dir, { legs = 0, bob = 0, swing = 0, nod = 0, crouch = false, act = false, swingPose = null } = {}) {
  const { head, body, map, gear, weapon } = CASTS[cast];
  const buf = new Buf(FW, FH);
  const view = dir === "up" ? "up" : dir === "side" ? "side" : "down";
  const pose = swingPose ? SWING[view][swingPose] : null;
  const [lx, ly] = pose ? pose.lean : [0, 0];
  const drop = crouch ? 3 : bob;
  if (crouch) buf.stamp(CROUCH_LEGS[view], map, 0, 22);
  else buf.stamp(LEGS[view][pose ? pose.legs : legs], map, 0, 20);
  buf.stamp(BODIES[body][view], map, lx, 12 + drop + ly);
  swingHands(buf, map, view, 12 + drop + ly, swing);
  if (pose) eraseHand(buf, map, 12 + drop + ly, pose.side);
  if (gear === "bow" && view === "up") drawBow(buf, map, view, drop, act);
  // De espalda, el brazo que prepara va detrás de la cabeza; lo demás, encima.
  const armFirst = false;
  if (armFirst) drawArm(buf, map, pose, weapon, [lx, ly], view, swingPose);
  buf.stamp(HEADS[head][view], map, lx, drop + nod + ly);
  if (gear === "bow" && view !== "up") drawBow(buf, map, view, drop, act);
  if (pose && !armFirst) drawArm(buf, map, pose, weapon, [lx, ly], view, swingPose);
  return buf;
}

/**
 * Posición de cada pose dentro de una vista (14 cuadros por vista): quieto, respirar, 6 de paso,
 * agachado, acción (arco), preparar golpe, golpe, cargado (brilla) y cargado corrido 1 px (tiembla).
 */
export const POSE = { idle: 0, breathe: 1, walk: [2, 3, 4, 5, 6, 7], crouch: 8, act: 9, windup: 10, strike: 11, charge: [12, 13] };
const PER_VIEW = 14;

/** Hoja de un personaje: 3 vistas × 14 cuadros (ver POSE). */
export function castSheet(cast) {
  const frames = [];
  for (const dir of ["down", "up", "side"]) {
    const walk = WALK[dir === "side" ? "side" : dir].map(([legs, bob, swing]) => frame(cast, dir, { legs, bob, swing }));
    const windup = frame(cast, dir, { swingPose: "windup" });
    frames.push(
      frame(cast, dir),
      frame(cast, dir, { nod: 1 }),
      ...walk,
      frame(cast, dir, { crouch: true }),
      frame(cast, dir, { act: true }),
      windup,
      frame(cast, dir, { swingPose: "strike" }),
      glowed(windup),
      glowed(windup, 1),
    );
  }
  return strip(frames);
}

export const SHEET_INDEX = { down: 0, up: PER_VIEW, side: PER_VIEW * 2 };

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

/**
 * Tirado en el piso (K.O.), 24×22: boca arriba con la cabeza a la izquierda, dibujado tumbado
 * (no el cuadro de pie girado): brazos abiertos por encima de la cabeza, piernas separadas, cabeza
 * ladeada, ojos cerrados y el arma caída a un lado.
 */
export function koFrame(cast) {
  const { head, body, map, weapon } = CASTS[cast];
  // Se arma de pie en un lienzo más ancho (24×24, figura en x=4) y al final se acuesta (giro exacto).
  const X = 4;
  const b = new Buf(24, 24);
  b.stamp(["...oPpo..oPpo...", "..oPpo....oPpo..", ".oFFfo....oFFfo.", ".ooooo....ooooo."], map, X, 20);
  const torso = new Buf(16, 8);
  torso.stamp(BODIES[body].down, map);
  // Sin manos a los lados: los brazos se abren.
  const skin = rgba(map.S);
  for (let y = 0; y < 8; y += 1) for (const x of [0, 1, 14, 15]) if (torso.get(x, y) === skin) torso.set(x, y, rgba(map.c));
  b.blit(torso, X, 12);
  // Brazos abiertos hacia arriba y afuera (en diagonal, dos píxeles de grueso) con la mano abierta.
  const pts = [];
  const put = (x, y, c) => { b.set(x, y, c); pts.push([x, y]); };
  for (const flip of [false, true]) {
    const fx = (x) => (flip ? 23 - x : x);
    [[X + 1, 13], [X, 12], [X - 1, 11], [X - 2, 10]].forEach(([x, y]) => { put(fx(x), y, map.L); put(fx(x), y + 1, map.C); });
    put(fx(X - 3), 9, map.S); put(fx(X - 3), 10, map.s); put(fx(X - 2), 9, map.S);
  }
  // La cabeza ladeada 1 px (cuello flojo).
  b.stamp(HEADS[head].down, map, X + 1, 1);
  // Contorno alrededor de los brazos nuevos.
  const ink = rgba(map.o);
  for (const [x, y] of pts) {
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (b.inside(x + ox, y + oy) && !(b.get(x + ox, y + oy) >>> 24)) b.set(x + ox, y + oy, ink);
    }
  }
  // Acostado: la cabeza a la izquierda (tres giros de 90° a la derecha = uno a la izquierda).
  const lying = b.rotated().rotated().rotated(); // 24×24; la figura ocupa las filas 1-22
  const out = new Buf(24, 22);
  out.blit(lying, 0, -1);
  // El arma cayó junto al cuerpo.
  const w = WEAPONS[weapon];
  if (w) {
    const n = weapon === "staff" ? 14 : weapon === "sword" ? 8 : weapon === "hammer" ? 6 : 4;
    const x0 = 6;
    const y = 20;
    for (let i = 0; i < n; i += 1) {
      const c = i === n - 1 ? (w.tip ?? w.shaft) : i === 0 && w.hilt ? w.hilt : w.shaft;
      out.set(x0 + i, y, c);
      out.set(x0 + i, y + 1, "ink");
      if (!(out.get(x0 + i, y - 1) >>> 24)) out.set(x0 + i, y - 1, "ink");
    }
    out.set(x0 - 1, y, "ink");
    out.set(x0 + n, y, "ink");
    if (w.head) { out.set(x0 + n, y - 1, w.head[1]); out.set(x0 + n, y, w.head[0]); out.set(x0 + n + 1, y, "ink"); }
  }
  return out;
}

/**
 * Retrato para los diálogos: 24×24 con marco. Cabeza y hombros del cuadro de frente, a tamaño real
 * (×1), sobre un fondo cálido; el marco oscuro con filo dorado, como los paneles.
 */
export function portrait(cast) {
  const src = frame(cast, "down");
  const b = new Buf(24, 24);
  b.rect(0, 0, 24, 24, "ink");
  b.rect(1, 1, 22, 22, "y1");
  b.rect(2, 2, 20, 20, "o1");
  b.rect(2, 2, 20, 9, "o2");
  // Filas 0-19 del personaje (cabeza y hombros), centradas; lo de abajo queda cortado por el marco.
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < FW; x += 1) {
      const c = src.get(x, y);
      if (c >>> 24) b.set(4 + x, 3 + y, c);
    }
  }
  // Marco encima: tapa lo que se sale por abajo.
  b.rect(2, 22, 20, 1, "y1");
  b.rect(1, 23, 22, 1, "ink");
  b.set(1, 1, "y3");
  b.set(22, 1, "y2");
  return b;
}
