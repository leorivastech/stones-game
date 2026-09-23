/**
 * Mercado vivo de Stones. Lógica pura: trabaja sobre objetos planos y no conoce Phaser,
 * para poder simularlo en Node (studio/sim) y, algún día, correrlo en un servidor.
 *
 * Cada pueblo tiene existencias de las 5 piedras. Cada día produce su piedra, consume la que
 * necesita y un poco de las demás. El precio sale de lo que hay contra lo que el pueblo quiere
 * tener: si sobra, barato; si falta, caro. Nunca más caro que la Corona: por eso te compran a ti.
 *
 *   estado = { day, market: { pueblo: { piedra: existencias } }, mods: [sucesos activos], heat: { pueblo: n } }
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

/** Frío de la escarcha, de 0 a 100. Se paga en proporción; en 0 ya es agua. */
export const FROST = { meltPerDay: 9, meltWithIcebox: 3 };

/** Días que pasan al viajar. */
export const TRAVEL_DAYS = { route: 2, boat: 3, back: 1 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Qué produce y consume cada pueblo por día y cuánto quiere tener guardado. */
export function baseProfile(townId) {
  const t = TOWNS[townId];
  const prof = {};
  for (const g of GOOD_IDS) prof[g] = { prod: 0.5, cons: 0.5, target: 4 };
  prof[t.produce] = { prod: 3, cons: 0.5, target: 6 };
  prof[t.need] = { prod: 0, cons: 2, target: 10 };
  return prof;
}

/** El perfil con los sucesos activos aplicados (sequía, helada, feria…). */
export function profile(state, townId) {
  const prof = baseProfile(townId);
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
    for (const g of GOOD_IDS) market[id][g] = g === t.produce ? 16 : g === t.need ? 3 : 4;
  }
  return market;
}

export function freshEconomy() {
  return { day: 1, market: initialMarket(), mods: [], heat: Object.fromEntries(TOWN_IDS.map((id) => [id, 0])) };
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
  const buy = Math.min(crown, mid * MARKET.spread + Math.floor(heat / 30));
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

/** Un día: cada pueblo produce y consume (el consumo crece con lo que hay), baja el calor, caducan sucesos. */
export function stepDay(state) {
  state.day += 1;
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
