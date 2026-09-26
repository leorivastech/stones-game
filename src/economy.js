/**
 * Mercado vivo de Stones. Lógica pura: trabaja sobre objetos planos y no conoce Phaser,
 * para poder simularlo en Node (studio/sim) y, algún día, correrlo en un servidor.
 *
 * Cada pueblo tiene existencias de las 5 piedras. Cada día produce mucho de la suya y un poco de
 * las demás, y consume de todas. Sin orden fijo: las ganas de comprar y lo que llega de cada piedra
 * se mueven solas en todos los pueblos (vaivén) y con los sucesos. El precio sale de lo que hay
 * contra lo que el pueblo quiere tener: si sobra, barato; si falta, caro. Nunca más caro que la
 * Corona: por eso te compran a ti.
 *
 *   estado = { day, market: { pueblo: { piedra: existencias } }, drift: { pueblo: { piedra: {d, s} } },
 *              mods: [sucesos activos], heat: { pueblo: n }, caravans: [viajes recientes de los mercaderes] }
 */

import { GOODS, TOWNS, TOWN_IDS } from "./world.js";

export const GOOD_IDS = Object.keys(GOODS);

/** Valor de referencia y carácter de cada piedra. */
export const STONE = {
  amber: { value: 14, slots: 1, sellHeat: 1, trait: "Casi legal: la Corona sólo cobra impuesto." },
  rune: { value: 22, slots: 1, sellHeat: 3, trait: "Frágil: un golpe puede romper una." },
  rain: { value: 30, slots: 2, sellHeat: 3, trait: "Pesada: ocupa dos lugares." },
  sun: { value: 36, slots: 1, sellHeat: 7, trait: "Vigilada: la Corona la persigue más." },
  frost: { value: 44, slots: 1, sellHeat: 4, trait: "Se derrite lejos del frío." },
};

export const MARKET = {
  crownMarkup: 1.6, // la Corona vende a 1.6 × valor
  crownCut: 0.9, // un pueblo te paga a lo más el 90 % de lo que cobra la Corona
  floor: 0.35, // aunque sobre, no baja de 0.35 × valor
  spread: 1.15, // el pueblo te vende 15 % más caro de lo que te compra
  elasticity: 0.6,
  cap: 24,
  heatDecay: 3, // calor que baja cada día en cada pueblo
};

/**
 * Frío de la escarcha, de 0 a 100. Se paga en proporción; en 0 ya es agua. Desde el 26-sep el tiempo
 * corre también en la ruta (4 min reales = 1 día), así que se derrite por hora y no por tramo:
 * cruzar una ruta (~3 h) le quita ~2-3; un día entero, 20 (7 con hielera). La tierra fría la mitad.
 */
export const FROST = { meltPerDay: 20, meltWithIcebox: 7 };

/**
 * Tiempo de los viajes. A pie ya no hay días fijos: corre el reloj (24 h en 4 min reales, ver
 * src/engine/daylight.js). La barca sí salta 3 días de mar (el golfo es frío: la escarcha pierde la mitad).
 */
export const TRAVEL_DAYS = { boat: 3 };
export const BOAT_COLD = 0.5;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Vaivén: sin orden fijo. Cada pueblo tiene, para cada piedra, cuántas ganas tiene de comprarla
 * (`d`, demanda) y cuánta le llega por su cuenta (`s`, oferta). Cambian solas día con día en todos
 * lados (caminata al azar que vuelve poco a poco a lo normal) y a veces pegan un salto. Así una
 * piedra puede estar cara o barata en cualquier pueblo; no hay "compra aquí y vende en el siguiente".
 */
export const DRIFT = {
  start: 0.45, // qué tan revuelto arranca (desviación en escala logarítmica)
  step: 0.2, // cuánto se mueve cada día
  keep: 0.88, // cuánto conserva del día anterior (el resto vuelve a lo normal)
  jump: 0.015, // probabilidad diaria de un salto por pueblo y piedra
  min: 0.3,
  max: 3,
};

function gauss(rng) {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Demanda y oferta iniciales, revueltas. */
export function freshDrift(rng = Math.random) {
  const drift = {};
  for (const id of TOWN_IDS) {
    drift[id] = {};
    for (const g of GOOD_IDS) {
      drift[id][g] = {
        d: clamp(Math.exp(gauss(rng) * DRIFT.start), DRIFT.min, DRIFT.max),
        s: clamp(Math.exp(gauss(rng) * DRIFT.start), DRIFT.min, DRIFT.max),
      };
    }
  }
  return drift;
}

/** Un día de vaivén en todos los pueblos. */
export function stepDrift(state, rng = Math.random) {
  state.drift ??= freshDrift(rng);
  for (const id of TOWN_IDS) {
    for (const g of GOOD_IDS) {
      const cur = state.drift[id][g];
      for (const k of ["d", "s"]) {
        let v = Math.log(cur[k]) * DRIFT.keep + gauss(rng) * DRIFT.step;
        if (rng() < DRIFT.jump) v += (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 0.5);
        cur[k] = clamp(Math.exp(v), DRIFT.min, DRIFT.max);
      }
    }
  }
}

/**
 * Qué produce y consume cada pueblo por día y cuánto quiere tener guardado. Cada pueblo saca su
 * piedra (la produce mucho); de las demás, poco y parejo. El vaivén hace el resto.
 */
/**
 * 26-sep: ×3 lo de antes (1.8/0.5 y 0.6/0.8). Con el reloj que corre, un tramo dura ~0.4 días en vez
 * de 2 y el mercado casi no se reponía entre visitas; así la simulación vuelve a dar ~21-28 oro por
 * tramo (antes 24-30), ya con los mercaderes. Lo que un pueblo quiere tener (equilibrio) no cambia.
 */
export const PROFILE = {
  own: { prod: 5.4, cons: 1.5 }, // su piedra: la saca mucho
  other: { prod: 1.8, cons: 2.4 }, // las demás: poco y parejo
  target: 6,
};

export function baseProfile(townId) {
  const t = TOWNS[townId];
  const prof = {};
  for (const g of GOOD_IDS) prof[g] = { ...PROFILE.other, target: PROFILE.target };
  if (t.produce) prof[t.produce] = { ...PROFILE.own, target: PROFILE.target };
  return prof;
}

/** El perfil con el vaivén y los sucesos activos aplicados (sequía, helada, feria…). */
export function profile(state, townId) {
  const prof = baseProfile(townId);
  for (const g of GOOD_IDS) {
    const dr = state.drift?.[townId]?.[g];
    if (!dr) continue;
    prof[g].target *= dr.d;
    prof[g].cons *= dr.d;
    prof[g].prod *= dr.s;
  }
  for (const m of state.mods ?? []) {
    if (m.town && m.town !== townId) continue;
    for (const g of m.good ? [m.good] : GOOD_IDS) {
      if (m.field && prof[g]) prof[g][m.field] *= m.mult;
    }
  }
  return prof;
}

export function initialMarket() {
  const market = {};
  for (const id of TOWN_IDS) {
    const t = TOWNS[id];
    market[id] = {};
    for (const g of GOOD_IDS) market[id][g] = g === t.produce ? 12 : 5;
  }
  return market;
}

export function freshEconomy(rng = Math.random) {
  return { day: 1, market: initialMarket(), mods: [], drift: freshDrift(rng), heat: Object.fromEntries(TOWN_IDS.map((id) => [id, 0])), caravans: [] };
}

/** Precio de una piedra en un pueblo. `chill` (0-100) sólo cuenta para vender escarcha. */
export function quote(state, townId, good, chill = 100) {
  const v = STONE[good].value;
  const stock = state.market[townId][good];
  const target = profile(state, townId)[good].target;
  const heat = state.heat?.[townId] ?? 0;
  const crown = Math.round(v * MARKET.crownMarkup);
  const mid = clamp(v * ((target + 1) / (stock + 1)) ** MARKET.elasticity, v * MARKET.floor, v * MARKET.crownMarkup);
  let sell = Math.min(mid, crown * MARKET.crownCut) * (1 - heat / 400);
  if (good === "frost") sell *= chill / 100;
  // El calor encarece en proporción (igual que descuenta al vender): no castiga más a las baratas.
  const buy = Math.min(crown, mid * MARKET.spread * (1 + heat / 400));
  return {
    good,
    stock: Math.floor(stock),
    sell: Math.max(1, Math.round(sell)),
    buy: Math.max(1, Math.round(buy)),
    crown,
    // Cómo está el pueblo de esta piedra: sobra, normal, falta.
    mood: stock > target * 1.5 ? "sobra" : stock < target * 0.5 ? "falta" : "normal",
  };
}

export function canBuyFrom(state, townId, good) {
  return state.market[townId][good] >= 1;
}

export function takeFromMarket(state, townId, good) {
  state.market[townId][good] = Math.max(0, state.market[townId][good] - 1);
}

export function giveToMarket(state, townId, good) {
  state.market[townId][good] = Math.min(MARKET.cap, state.market[townId][good] + 1);
}

/**
 * Mercaderes de a pie (M10, 26-sep): cada día 1 o 2 arrieros compran en un pueblo y venden en uno
 * vecino lo que allá paga mejor. Mueven existencias de verdad (vacían donde compran, llenan donde
 * venden) y la gente lo cuenta: "Ayer un mercader vendió 4 perlas en Valkeep". Así el mercado cambia
 * por algo más que el azar y conviene escuchar.
 */
export const MERCHANTS = {
  extra: 0.5, // probabilidad de un segundo mercader en el día
  lot: [2, 4], // cuántas piedras mueve
  margin: 1.35, // sólo sale si allá le pagan al menos 35 % más de lo que le cuesta aquí
  keep: 6, // cuántos viajes recientes se recuerdan (para los rumores)
};

/** Vecinos por tierra de cada pueblo (y la barca). */
function neighbors(townId) {
  const t = TOWNS[townId];
  return [...Object.values(t.exits ?? {}), ...(t.boat ? [t.boat] : [])].filter((id) => TOWNS[id]);
}

/** Los mercaderes del día. Devuelve los viajes que hicieron: [{ day, from, to, good, n }]. */
export function merchantsDay(state, rng = Math.random) {
  const trips = [];
  const count = 1 + (rng() < MERCHANTS.extra ? 1 : 0);
  for (let k = 0; k < count; k += 1) {
    const from = TOWN_IDS[Math.floor(rng() * TOWN_IDS.length)];
    const near = neighbors(from);
    if (!near.length) continue;
    const to = near[Math.floor(rng() * near.length)];
    let best = null;
    for (const g of GOOD_IDS) {
      if (state.market[from][g] < 3) continue;
      const ratio = quote(state, to, g).sell / quote(state, from, g).buy;
      if (ratio >= MERCHANTS.margin && (!best || ratio > best.ratio)) best = { g, ratio };
    }
    if (!best) continue;
    const [lo, hi] = MERCHANTS.lot;
    const n = Math.min(lo + Math.floor(rng() * (hi - lo + 1)), Math.floor(state.market[from][best.g] - 1));
    if (n < 2) continue;
    state.market[from][best.g] = Math.max(0, state.market[from][best.g] - n);
    state.market[to][best.g] = Math.min(MARKET.cap, state.market[to][best.g] + n);
    trips.push({ day: state.day, from, to, good: best.g, n });
  }
  state.caravans = [...trips, ...(state.caravans ?? [])].slice(0, MERCHANTS.keep);
  return trips;
}

/** Un día: se mueve el vaivén, cada pueblo produce y consume (el consumo crece con lo que hay), baja el calor, caducan sucesos. */
export function stepDay(state, rng = Math.random) {
  state.day += 1;
  stepDrift(state, rng);
  for (const id of TOWN_IDS) {
    const prof = profile(state, id);
    for (const g of GOOD_IDS) {
      const s = state.market[id][g];
      const { prod, cons, target } = prof[g];
      const next = s + prod - cons * (s / Math.max(0.5, target));
      state.market[id][g] = clamp(Math.round(next * 10) / 10, 0, MARKET.cap);
    }
    if (state.heat) state.heat[id] = Math.max(0, (state.heat[id] ?? 0) - MARKET.heatDecay);
  }
  merchantsDay(state, rng);
  const ended = [];
  state.mods = (state.mods ?? []).filter((m) => {
    m.days -= 1;
    if (m.days <= 0) ended.push(m);
    return m.days > 0;
  });
  return ended;
}

/** Cuánto frío pierde la escarcha en `days` días. `cold`: el viaje fue por tierra fría. */
export function meltAfter(chill, days, { icebox = false, cold = 0 } = {}) {
  const perDay = icebox ? FROST.meltWithIcebox : FROST.meltPerDay;
  return clamp(chill - perDay * days * (1 - cold), 0, 100);
}

/** Frío promedio al juntar piedras de escarcha con frío distinto. */
export function mixChill(countA, chillA, countB, chillB) {
  const n = countA + countB;
  return n ? Math.round((countA * chillA + countB * chillB) / n) : 100;
}
