/**
 * Misiones: la única forma de ganar fama. Lógica pura (sin Phaser).
 *
 * - Historia: una por pueblo, en orden del círculo. Cada una enseña el carácter de una piedra
 *   (ámbar con sello, vidrio frágil, perla pesada, solar vigilada, escarcha que se derrite).
 * - Pedidos: los comerciantes piden lo que le falta a otro pueblo. Se generan del mercado de hoy.
 *
 *   misión = { id, title, giver, from, to, good, count, reward, fame, deadline?, lines }
 */

import { GOODS, TOWNS } from "./world.js";
import { GOOD_IDS, STONE, quote } from "./economy.js";

export const STORY = [
  {
    id: "historia-1", from: "ashfen", giverRole: "tutorial", giver: "Tomasa", minFame: 0,
    title: "La primera entrega", to: "valkeep", good: "amber", count: 2, reward: 20, fame: 2,
    lines: [
      "Mi sobrino, Maese Ivo, vende en Valkeep. Le hace falta ámbar.",
      "Llévale dos. El ámbar tiene sello: si la Corona te para, sólo te cobra impuesto.",
    ],
  },
  {
    id: "historia-2", from: "valkeep", giverRole: "market", giver: "Maese Ivo", minFame: 2,
    title: "Vidrio para la selva", to: "verdelume", good: "rune", count: 3, reward: 45, fame: 2,
    lines: [
      "En Verdelume funden mi vidrio para guardar la lluvia. Llévales tres.",
      "Ojo: el vidrio rúnico es frágil. Si te pegan, se raja. Esquiva o no llegas completo.",
    ],
  },
  {
    id: "historia-3", from: "verdelume", giverRole: "market", giver: "Oruba", minFame: 4,
    title: "Agua para el desierto", to: "duneshade", good: "rain", count: 2, reward: 55, fame: 2,
    lines: [
      "Duneshade se seca. Dos perlas de lluvia salvan un pozo entero.",
      "Pesan como piedra de verdad: cada una ocupa dos lugares. Un caballo te ayudaría.",
    ],
  },
  {
    id: "historia-4", from: "duneshade", giverRole: "market", giver: "Kader", minFame: 6,
    title: "Sol para el invierno", to: "frostholm", good: "sun", count: 2, reward: 75, fame: 3,
    lines: [
      "En Frostholm se mueren de frío. Llévales dos piedras solares.",
      "La Corona odia esta piedra: si te la encuentran, se pone peor. Escóndela bien.",
    ],
  },
  {
    id: "historia-5", from: "frostholm", giverRole: "market", giver: "Hilde", minFame: 9,
    title: "Escarcha antes de que se derrita", to: "ashfen", good: "frost", count: 2, reward: 95, fame: 3, days: 7,
    lines: [
      "Ashfen necesita escarcha para guardar la cosecha. Dos cristales, y rápido.",
      "Se derrite lejos del frío: la barca de Ceno o una hielera son tus amigas.",
    ],
  },
];

/** La misión de historia que toca en este pueblo, si hay y si ya tienes la fama. */
export function storyFor(townId, role, { fame, done, active }) {
  const next = STORY.find((m) => !done[m.id]);
  if (!next || next.from !== townId || next.giverRole !== role) return null;
  if (active.some((m) => m.id === next.id) || fame < next.minFame) return null;
  return next;
}

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
