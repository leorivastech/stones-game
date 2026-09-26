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
// De lado, el segundo paso es la zancada con la otra pierna adelante (sombras cruzadas).
LEGS.side[2] = ["....oPpoPpo.....", "...opPo.oPPo....", "..oFFFo.oFFfo...", "..ooooo.ooooo..."];

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
  // Matón del Gremio (deuda con dientes, 26-sep): el mismo embozado del bandido, de morado del
  // Gremio con ribetes de oro del sello.
  thug: {
    head: "bandit", body: "cloak",
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

/**
 * Un cuadro. `legs`: 0 quieto, 1 paso A, 2 paso B. `bob`: el cuerpo baja 1 px al apoyar el pie.
 * `swing`: brazos (−1/0/1). `nod`: la cabeza baja 1 px (respirar). `act`: pose de acción.
 */
function frame(cast, dir, { legs = 0, bob = 0, swing = 0, nod = 0, crouch = false, act = false } = {}) {
  const { head, body, map, gear } = CASTS[cast];
  const buf = new Buf(FW, FH);
  const view = dir === "up" ? "up" : dir === "side" ? "side" : "down";
  const drop = crouch ? 3 : bob;
  if (crouch) buf.stamp(CROUCH_LEGS[view], map, 0, 22);
  else buf.stamp(LEGS[view][legs], map, 0, 20);
  buf.stamp(BODIES[body][view], map, 0, 12 + drop);
  swingHands(buf, map, view, 12 + drop, swing);
  if (gear === "bow" && view === "up") drawBow(buf, map, view, drop, act);
  buf.stamp(HEADS[head][view], map, 0, drop + nod);
  if (gear === "bow" && view !== "up") drawBow(buf, map, view, drop, act);
  return buf;
}

/** Posición de cada pose dentro de una vista (8 cuadros por vista). */
export const POSE = { idle: 0, breathe: 1, walk: [2, 3, 4, 5], crouch: 6, act: 7 };
const PER_VIEW = 8;

/**
 * Hoja de un personaje: 3 vistas × 8 cuadros
 * (quieto, respirar, paso A, pasar, paso B, pasar, agachado, acción).
 */
export function castSheet(cast) {
  const frames = [];
  for (const dir of ["down", "up", "side"]) {
    frames.push(
      frame(cast, dir),
      frame(cast, dir, { nod: 1 }),
      frame(cast, dir, { legs: 1, bob: 1, swing: 1 }),
      frame(cast, dir),
      frame(cast, dir, { legs: 2, bob: 1, swing: -1 }),
      frame(cast, dir),
      frame(cast, dir, { crouch: true }),
      frame(cast, dir, { act: true }),
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

/** Tirado en el piso (KO): el cuadro de frente, acostado. */
export function koFrame(cast) {
  return frame(cast, "down", 0).rotated();
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
