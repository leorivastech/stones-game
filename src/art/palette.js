/**
 * Paleta maestra. Rampas de oscuro (0) a claro. Luz desde arriba a la izquierda.
 * Todo el arte sale de aquí: si un color no está, no se usa.
 */

export const P = {
  ink: "#1b1422", ink2: "#2b2233", clear: null,

  // Pasto
  g0: "#152e20", g1: "#21472b", g2: "#2f6035", g3: "#417d3b", g4: "#5f9d45", g5: "#8bbf55", g6: "#c1de78",
  // Follaje (más frío que el pasto para separar árboles del piso)
  f0: "#0f261f", f1: "#16372a", f2: "#1f4c33", f3: "#2b6639", f4: "#428542", f5: "#66a54c", f6: "#99c862",
  // Tierra
  d0: "#382218", d1: "#573522", d2: "#7a4f31", d3: "#9c6b41", d4: "#bd8b57", d5: "#dab179", d6: "#eed4a0",
  // Piedra fría
  s0: "#24222c", s1: "#3a3746", s2: "#545168", s3: "#737188", s4: "#9694a7", s5: "#bcbbc8", s6: "#e1e0e9",
  // Agua
  w0: "#11294a", w1: "#18406a", w2: "#225c8e", w3: "#317cac", w4: "#53a2ca", w5: "#8acde0", w6: "#d6f3f5",
  // Madera
  o0: "#2c1813", o1: "#48291b", o2: "#683c24", o3: "#8b5630", o4: "#ae763f", o5: "#cf9a5a",
  // Teja roja
  r0: "#3c1418", r1: "#63201e", r2: "#8d3225", r3: "#b64a2f", r4: "#d66f3e", r5: "#ec9f60",
  // Paja
  t0: "#493518", t1: "#715324", t2: "#987430", t3: "#c09b44", t4: "#dec265", t5: "#f2df98",
  // Piel
  k0: "#4d2921", k1: "#824838", k2: "#b66f4e", k3: "#df9f70", k4: "#f5cb9b",
  // Azul de la Corona (guardias)
  b0: "#14193a", b1: "#222c61", b2: "#33458d", b3: "#4b64b6", b4: "#7891da", b5: "#b1c4f1",
  // Violeta rúnico
  v0: "#29173e", v1: "#422568", v2: "#603992", v3: "#8556be", v4: "#ae86e4", v5: "#dac3f9",
  // Oro
  y0: "#58390b", y1: "#8c5e13", y2: "#c1891e", y3: "#e6b736", y4: "#f7df6f", y5: "#fff5c1",
  // Rojo vivo (corazones, alerta)
  e0: "#480e19", e1: "#7c1925", e2: "#b6292f", e3: "#e0493d", e4: "#f58969",
  // Tela crema
  c0: "#6a5947", c1: "#9b896f", c2: "#c7b799", c3: "#e7dbc1", c4: "#faf3e1",
  // Verde olivo (bandidos)
  l0: "#232416", l1: "#3a3b22", l2: "#545530", l3: "#727242", l4: "#949259",
  // Nieve / hielo
  n0: "#5d7285", n1: "#8198aa", n2: "#a9bfcc", n3: "#cfe0e8", n4: "#eef7fa",
  white: "#ffffff",
};

const cache = new Map();

/** Color de la paleta (o hex suelto) → entero ABGR para Uint32Array. */
export function rgba(name, alpha = 255) {
  const key = `${name}|${alpha}`;
  if (cache.has(key)) return cache.get(key);
  const hex = P[name] ?? name;
  if (!hex) return 0;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const value = ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
  cache.set(key, value);
  return value;
}

export function hex(name) {
  return P[name] ?? name;
}

/** Número 0xRRGGBB para Phaser (tint, fill de rectángulos). */
export function num(name) {
  return parseInt(hex(name).slice(1), 16);
}

/** Paso por una rampa: shade("g3", -1) → "g2". */
export function shade(name, step) {
  if (!/\d$/.test(name)) return name;
  const ramp = name.replace(/\d+$/, "");
  const idx = Number(name.slice(ramp.length));
  let next = idx + step;
  while (next > 0 && !P[`${ramp}${next}`]) next -= 1;
  while (!P[`${ramp}${next}`] && next < 9) next += 1;
  return P[`${ramp}${next}`] ? `${ramp}${next}` : name;
}
