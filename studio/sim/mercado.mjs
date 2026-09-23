/**
 * Simulación del mercado vivo (src/economy.js). Un comerciante codicioso da vueltas al golfo
 * en el sentido del círculo y otro en el sentido contrario, con 4 y 6 lugares de carga.
 *
 *   node studio/sim/mercado.mjs
 *
 * No cuenta peleas, robos ni revisiones: mide si el mercado solo tiene sentido.
 */

import { freshEconomy, quote, takeFromMarket, giveToMarket, stepDay, STONE, TRAVEL_DAYS, meltAfter, GOOD_IDS } from "../../src/economy.js";

const RING = ["ashfen", "valkeep", "verdelume", "duneshade", "frostholm"];

function run({ slots, loops, reverse = false, icebox = false }) {
  const st = freshEconomy();
  let gold = 40;
  let cargo = Object.fromEntries(GOOD_IDS.map((g) => [g, 0]));
  let chill = 100;
  const load = () => GOOD_IDS.reduce((s, g) => s + cargo[g] * STONE[g].slots, 0);
  const ring = reverse ? [...RING].reverse() : RING;
  const log = [];
  let sold = 0;
  let heatMax = 0;
  for (let lap = 0; lap < loops; lap += 1) {
    for (let i = 0; i < ring.length; i += 1) {
      const town = ring[i];
      const next = ring[(i + 1) % ring.length];
      // Vender todo lo que deje ganancia aquí mejor que en el siguiente pueblo.
      for (const g of GOOD_IDS) {
        while (cargo[g] > 0) {
          const here = quote(st, town, g, chill).sell;
          const there = quote(st, next, g, chill).sell;
          if (here < there * 0.85 && lap < loops - 1) break;
          gold += here;
          cargo[g] -= 1;
          giveToMarket(st, town, g);
          st.heat[town] = Math.min(100, st.heat[town] + STONE[g].sellHeat);
          sold += 1;
        }
      }
      heatMax = Math.max(heatMax, st.heat[town]);
      // Comprar lo que más gane en el siguiente pueblo.
      for (;;) {
        let best = null;
        for (const g of GOOD_IDS) {
          if (load() + STONE[g].slots > slots || st.market[town][g] < 1) continue;
          const q = quote(st, town, g);
          if (q.buy > gold) continue;
          const days = next === "ashfen" && town === "frostholm" ? TRAVEL_DAYS.boat : TRAVEL_DAYS.route;
          const futureChill = g === "frost" ? meltAfter(100, days, { icebox }) : 100;
          const gain = (quote(st, next, g, futureChill).sell - q.buy) / STONE[g].slots;
          if (gain > 2 && (!best || gain > best.gain)) best = { g, gain, price: q.buy };
        }
        if (!best) break;
        if (best.g === "frost") chill = cargo.frost ? Math.round((cargo.frost * chill + 100) / (cargo.frost + 1)) : 100;
        gold -= best.price;
        cargo[best.g] += 1;
        takeFromMarket(st, town, best.g);
        st.heat[town] = Math.min(100, st.heat[town] + 1);
      }
      const days = (town === "frostholm" && next === "ashfen") || (town === "ashfen" && next === "frostholm") ? TRAVEL_DAYS.boat : TRAVEL_DAYS.route;
      for (let d = 0; d < days; d += 1) stepDay(st);
      if (cargo.frost) chill = meltAfter(chill, days, { icebox, cold: town === "duneshade" || town === "frostholm" ? 0.5 : 0 });
      if (cargo.frost && chill <= 0) cargo.frost = 0;
    }
    const worth = gold + GOOD_IDS.reduce((s, g) => s + cargo[g] * STONE[g].value * 0.5, 0);
    log.push(`${Math.round(worth)}`);
  }
  return { log: log.join(" → "), sold, heatMax, day: st.day };
}

const cases = [
  ["a pie, sentido del círculo", { slots: 4, loops: 3 }],
  ["caballo, sentido del círculo", { slots: 6, loops: 3 }],
  ["a pie, sentido contrario", { slots: 4, loops: 3, reverse: true }],
  ["caballo, contrario", { slots: 6, loops: 3, reverse: true }],
  ["caballo + hielera", { slots: 6, loops: 3, icebox: true }],
];
for (const [name, opts] of cases) {
  const r = run(opts);
  console.log(`${name.padEnd(30)} patrimonio por vuelta ${r.log}   vendidas ${r.sold}   calor máx ${r.heatMax}   día ${r.day}`);
}

// Precios de arranque, para ver el mapa del mercado.
const st = freshEconomy();
console.log("\nPrecios día 1 (vende / compra) por pueblo:");
for (const t of RING) {
  console.log(t.padEnd(10), GOOD_IDS.map((g) => { const q = quote(st, t, g); return `${g} ${q.sell}/${q.buy}`; }).join("  "));
}
