/**
 * Director de sucesos: el mundo cambia solo, día a día. Lógica pura (sin Phaser), como economy.js.
 *
 * Una baraja chica de sucesos. Cada día, cada suceso que cumple su condición tira un dado.
 * Si sale, se agrega a `state.mods` por unos días: cambia producción, consumo o lo que un pueblo
 * quiere tener, y así se mueven los precios. La gente lo cuenta como rumor.
 *
 * Para crecer: agregar sucesos a DECK. Nada más.
 */

import { TOWNS } from "./world.js";

const MAX_ACTIVE = 2;

/**
 * Cada suceso: id, probabilidad por día, condición opcional, duración, y los cambios que aplica
 * (`field`: prod | cons | target, `mult`). `news`: cómo lo cuenta la gente.
 */
export const DECK = [
  {
    id: "helada-frostholm", chance: 0.05, days: 6,
    mods: [{ town: "frostholm", good: "sun", field: "cons", mult: 2.2 }, { town: "frostholm", good: "sun", field: "target", mult: 1.6 }],
    news: "Cayó una helada en Frostholm: queman piedra solar como leña. La pagan muy bien.",
  },
  {
    id: "sequia-duneshade", chance: 0.05, days: 6,
    mods: [{ town: "duneshade", good: "rain", field: "cons", mult: 2.2 }, { town: "duneshade", good: "rain", field: "target", mult: 1.6 }],
    news: "Sequía en Duneshade: los pozos bajan y la perla de lluvia vale oro.",
  },
  {
    id: "feria-verdelume", chance: 0.03, days: 4,
    mods: [{ town: "verdelume", field: "target", mult: 1.5 }],
    news: "Feria en Verdelume: compran de todo, y caro.",
  },
  {
    id: "mina-valkeep", chance: 0.04, days: 6,
    mods: [{ town: "valkeep", good: "rune", field: "prod", mult: 2.5 }],
    news: "Abrieron una veta nueva en Valkeep: sobra vidrio rúnico, está regalado.",
  },
  {
    id: "plaga-ashfen", chance: 0.04, days: 5,
    mods: [{ town: "ashfen", good: "amber", field: "prod", mult: 0.25 }],
    news: "Plaga en los campos de Ashfen: casi no sale ámbar y el que hay está caro.",
  },
  {
    id: "barco-corona", chance: 0.04, days: 4,
    mods: [{ town: "ashfen", field: "target", mult: 0.6 }],
    news: "Llegó un barco de la Corona a Ashfen: el pueblo está surtido, pagan poco.",
  },
  {
    id: "cargamento-aduana", chance: 0.05, days: 5,
    mods: [{ town: "verdelume", good: "rune", field: "target", mult: 1.6 }],
    heat: { valkeep: 15, verdelume: 15 },
    news: "La Corona agarró un cargamento en la aduana del Paso Alto. Hay más guardias y en Verdelume falta vidrio.",
  },
  {
    id: "redadas-duneshade", chance: 0.04, days: 4,
    heat: { duneshade: 25 },
    mods: [],
    news: "Redadas en Duneshade: la Corona revisa todo lo que entra al desierto.",
  },
  {
    id: "tormenta-paso", chance: 0.04, days: 4,
    mods: [{ town: "frostholm", field: "target", mult: 1.3 }],
    news: "Tormenta en el Paso del Hielo: casi nadie llega a Frostholm y allá les falta de todo.",
  },
];

/**
 * Tira los dados de un día. Agrega sucesos nuevos a `state.mods` (y calor si toca).
 * `rng()` devuelve [0,1). Devuelve los sucesos que empezaron.
 */
export function rollDay(state, rng = Math.random) {
  const active = new Set((state.mods ?? []).map((m) => m.event));
  const started = [];
  for (const ev of DECK) {
    if (active.size + started.length >= MAX_ACTIVE) break;
    if (active.has(ev.id)) continue;
    if (ev.when && !ev.when(state)) continue;
    if (rng() >= ev.chance) continue;
    for (const m of ev.mods) state.mods.push({ ...m, event: ev.id, days: ev.days });
    // Un suceso sin cambios de mercado igual se anota, para que dure y se cuente.
    if (!ev.mods.length) state.mods.push({ event: ev.id, days: ev.days });
    for (const [town, n] of Object.entries(ev.heat ?? {})) {
      state.heat[town] = Math.min(100, (state.heat[town] ?? 0) + n);
    }
    started.push(ev);
  }
  return started;
}

export function activeEvents(state) {
  const ids = [...new Set((state.mods ?? []).map((m) => m.event).filter(Boolean))];
  return ids.map((id) => DECK.find((e) => e.id === id)).filter(Boolean);
}

// ---------- Rumores ----------

/** Rumores falsos que cuenta la gente que habla de más. */
const FAKE = [
  (t) => `Dicen que en ${t} pagan el doble por el ámbar. Yo no me lo creería.`,
  (t) => `Me contaron que la Corona ya no revisa en ${t}. Quién sabe.`,
  (t) => `Un arriero juró que en ${t} regalan perlas. Estaba borracho.`,
  (t) => `Dicen que en ${t} ya nadie compra piedra solar.`,
];

/** Lo que se dice cuando no pasa nada: pistas del mercado de siempre. */
const CALM = [
  "Aquí nadie tiene lo que produce el pueblo vecino. Eso siempre se paga.",
  "El que compra donde sobra y vende donde falta, come caliente.",
  "La escarcha no aguanta el sol del desierto. El barquero de Frostholm lo sabe.",
  "La perla pesa como piedra de verdad. Con caballo sale la cuenta.",
  "Al vidrio rúnico no lo golpees. Se raja nada más de verlo.",
  "Con ámbar la Corona sólo cobra impuesto. Con piedra solar, te encierra.",
];

/**
 * Un rumor para contar. `honest`: qué tanto dice la verdad la fuente (0-1).
 * Con sucesos activos, casi siempre cuenta uno; si miente, inventa algo de otro pueblo.
 */
export function rumor(state, { honest = 0.85, rng = Math.random } = {}) {
  const events = activeEvents(state);
  if (rng() > honest) {
    const towns = Object.values(TOWNS).map((t) => t.name);
    const town = towns[Math.floor(rng() * towns.length)];
    return { text: FAKE[Math.floor(rng() * FAKE.length)](town), true: false };
  }
  if (events.length && rng() < 0.85) {
    const ev = events[Math.floor(rng() * events.length)];
    return { text: ev.news, true: true, event: ev.id };
  }
  return { text: CALM[Math.floor(rng() * CALM.length)], true: true };
}
