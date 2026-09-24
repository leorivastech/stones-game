/**
 * Encargos: la única forma de ganar fama. Lógica pura (sin Phaser).
 *
 * - Pedidos: los comerciantes piden lo que le falta a otro pueblo. Se generan del mercado de hoy.
 * - Las 5 misiones de historia se quitaron el 23-sep (Leo: no quedaba claro cuándo te las piden
 *   ni cuándo se pierden). Siguen en git, commit 519fbb9, por si vuelven con mejor aviso.
 *
 *   misión = { id, title, giver, from, to, good, count, reward, fame, deadline?, lines }
 */

import { GOODS, TOWNS } from "./world.js";
import { GOOD_IDS, STONE, quote } from "./economy.js";

/**
 * Un pedido del comerciante: la piedra que este pueblo vende barata y que otro pueblo necesita.
 * Se arma con el mercado de hoy, así que cambia con los sucesos.
 */
export function orderFor(state, townId, { day, seed = 0 }) {
  const here = TOWNS[townId];
  let best = null;
  for (const g of GOOD_IDS) {
    const buy = quote(state, townId, g).buy;
    if (quote(state, townId, g).stock < 3) continue;
    for (const to of Object.keys(TOWNS)) {
      if (to === townId) continue;
      const gain = quote(state, to, g).sell - buy;
      // Un poco de azar para que no sea siempre el mismo.
      const score = gain + (((seed * 31 + to.length * 7 + g.length) % 5) - 2);
      if (!best || score > best.score) best = { g, to, score, gain };
    }
  }
  if (!best || best.gain < 4) return null;
  const count = STONE[best.g].slots === 2 ? 2 : 3;
  const reward = Math.round(STONE[best.g].value * 0.5 * count);
  return {
    id: `pedido-${townId}-${day}`,
    title: `${count} de ${GOODS[best.g].short} a ${TOWNS[best.to].name}`,
    giver: null,
    from: townId,
    to: best.to,
    good: best.g,
    count,
    reward,
    fame: 1,
    deadline: day + 10,
    lines: [`En ${TOWNS[best.to].name} les falta. Si les llevas ${count}, te pago ${reward} encima de lo que te den.`, `Tienes diez días. Aquí las consigues: ${here.name} las tiene.`],
  };
}
