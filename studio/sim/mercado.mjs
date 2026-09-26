/**
 * Simulación del mercado vivo (src/economy.js). Un comerciante codicioso da vueltas al golfo
 * en el sentido del círculo y otro en el sentido contrario, con 4 y 6 lugares de carga.
 *
 *   node studio/sim/mercado.mjs
 *
 * No cuenta peleas, robos ni revisiones ni contratos: mide si el mercado solo tiene sentido. Los
 * mercaderes de a pie (MERCHANTS) sí van: corren dentro de stepDay.
 *
 * Desde el 26-sep el tiempo corre en la ruta (4 min reales = 1 día): un tramo de pueblo a pueblo
 * (cruzar la ruta ~3 h + comerciar en el pueblo) cuenta como LEG_DAYS; la barca, 3 días. También
 * paga al cobrador (DEBT de src/state.js): la cuota cuando toca y todo en cuanto le sobra.
 */

import { freshEconomy, quote, takeFromMarket, giveToMarket, stepDay, STONE, TRAVEL_DAYS, BOAT_COLD, meltAfter, GOOD_IDS } from "../../src/economy.js";
import { DEBT } from "../../src/state.js";

const RING = ["ashfen", "valkeep", "verdelume", "duneshade", "mossgrove", "frostholm"];
/** Un tramo a pie + el rato en el pueblo, en días del juego (~1.6 min reales). */
const LEG_DAYS = 0.4;
const isBoat = (a, b) => (a === "frostholm" && b === "ashfen") || (a === "ashfen" && b === "frostholm");
const legDays = (a, b) => (isBoat(a, b) ? TRAVEL_DAYS.boat + LEG_DAYS / 2 : LEG_DAYS);
const coldOf = (a, b) => (isBoat(a, b) ? BOAT_COLD : a === "frostholm" || b === "frostholm" ? 0.5 : 0);

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
  let clock = 0;
  const debt = { owed: DEBT.start, due: 1 + DEBT.every, paid: 0, missed: 0, freeDay: null };
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
          const futureChill = g === "frost" ? meltAfter(100, legDays(town, next), { icebox, cold: coldOf(town, next) }) : 100;
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
      const days = legDays(town, next);
      clock += days;
      while (clock >= 1) {
        clock -= 1;
        stepDay(st);
        // El cobrador: la cuota si alcanza; todo en cuanto sobren 150 para seguir comerciando.
        if (debt.owed > 0 && st.day >= debt.due) {
          const cuota = Math.min(DEBT.cuota, debt.owed);
          if (gold >= cuota) { gold -= cuota; debt.owed -= cuota; debt.paid += 1; debt.due = st.day + DEBT.every; }
          else { debt.owed += DEBT.interest; debt.missed += 1; debt.due = st.day + Math.ceil(DEBT.every / 2); }
          if (debt.owed > 0 && gold - debt.owed >= 150) { gold -= debt.owed; debt.owed = 0; }
          if (debt.owed <= 0 && debt.freeDay == null) debt.freeDay = st.day;
        }
      }
      if (cargo.frost) chill = meltAfter(chill, days, { icebox, cold: coldOf(town, next) });
      if (cargo.frost && chill <= 0) cargo.frost = 0;
    }
    const worth = gold + GOOD_IDS.reduce((s, g) => s + cargo[g] * STONE[g].value * 0.5, 0);
    log.push(`${Math.round(worth)}`);
  }
  // Ganancia por tramo: patrimonio final + lo que se le pagó al Gremio − los 40 del arranque.
  const worthEnd = gold + GOOD_IDS.reduce((s, g) => s + cargo[g] * STONE[g].value * 0.5, 0);
  const paidDebt = DEBT.start - debt.owed; // lo abonado al Gremio
  return { log: log.join(" → "), sold, heatMax, day: st.day, debt, perLeg: (worthEnd + paidDebt - 40) / (loops * ring.length) };
}

const cases = [
  ["a pie, sentido del círculo", { slots: 4, loops: 6 }],
  ["caballo, sentido del círculo", { slots: 6, loops: 6 }],
  ["a pie, sentido contrario", { slots: 4, loops: 6, reverse: true }],
  ["caballo, contrario", { slots: 6, loops: 6, reverse: true }],
  ["caballo + hielera", { slots: 6, loops: 6, icebox: true }],
];
console.log(`Deuda ${DEBT.start}, cuota ${DEBT.cuota} cada ${DEBT.every} días · un tramo = ${LEG_DAYS} días, barca ${TRAVEL_DAYS.boat}\n`);
for (const [name, opts] of cases) {
  const r = run(opts);
  const d = r.debt;
  const free = d.freeDay ? `libre el día ${d.freeDay}` : `debe ${d.owed}`;
  console.log(`${name.padEnd(30)} patrimonio por vuelta ${r.log}   vendidas ${r.sold}   calor máx ${r.heatMax}   día ${r.day}   cuotas ${d.paid} · faltas ${d.missed} · ${free}`);
}

// Promedio de muchas corridas: la cifra para comparar con antes (el mercado es al azar).
// Referencia (ceb3ce7, antes del reloj que corre: 2 días por tramo, sin cobrador): 24-30 oro por tramo.
const RUNS = 300;
console.log(`\nGanancia media por tramo (${RUNS} corridas; incluye lo pagado al Gremio):`);
for (const [name, opts] of cases) {
  let sum = 0;
  let free = 0;
  for (let i = 0; i < RUNS; i += 1) {
    const r = run(opts);
    sum += r.perLeg;
    if (r.debt.freeDay) free += 1;
  }
  console.log(`${name.padEnd(30)} ${(sum / RUNS).toFixed(1)} oro/tramo · libres de deuda ${Math.round((free / RUNS) * 100)} %`);
}

// Precios de arranque, para ver el mapa del mercado.
const st = freshEconomy();
console.log("\nPrecios día 1 (vende / compra) por pueblo:");
for (const t of RING) {
  console.log(t.padEnd(10), GOOD_IDS.map((g) => { const q = quote(st, t, g); return `${g} ${q.sell}/${q.buy}`; }).join("  "));
}
