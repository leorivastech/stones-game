/**
 * Director de sucesos: el mundo cambia solo, día a día. Lógica pura (sin Phaser), como economy.js.
 *
 * Una baraja chica de sucesos. Cada día, cada suceso que cumple su condición tira un dado.
 * Si sale, se agrega a `state.mods` por unos días: cambia producción, consumo o lo que un pueblo
 * quiere tener, y así se mueven los precios. La gente lo cuenta como rumor.
 *
 * Para crecer: agregar sucesos a DECK. Nada más.
 */

import { GOODS, TOWNS, TOWN_IDS } from "./world.js";
import { GOOD_IDS, STONE, quote } from "./economy.js";

const MAX_ACTIVE = 2;

/**
 * Cada suceso: id, pueblo al que le pega (`town`, para el mapa y el HUD), nombre corto (`label`),
 * probabilidad por día, condición opcional, duración, y los cambios que aplica
 * (`field`: prod | cons | target, `mult`). `news`: cómo lo cuenta la gente.
 */
export const DECK = [
  {
    id: "helada-frostholm", town: "frostholm", label: "Helada en Frostholm", chance: 0.05, days: 6,
    mods: [{ town: "frostholm", good: "sun", field: "cons", mult: 2.2 }, { town: "frostholm", good: "sun", field: "target", mult: 1.6 }],
    news: "Cayó una helada en Frostholm: queman piedra solar como leña. La pagan muy bien.",
  },
  {
    id: "sequia-duneshade", town: "duneshade", label: "Sequía en Duneshade", chance: 0.05, days: 6,
    mods: [{ town: "duneshade", good: "rain", field: "cons", mult: 2.2 }, { town: "duneshade", good: "rain", field: "target", mult: 1.6 }],
    news: "Sequía en Duneshade: los pozos bajan y la perla de lluvia vale oro.",
  },
  {
    id: "feria-verdelume", town: "verdelume", label: "Feria en Verdelume", chance: 0.03, days: 4,
    mods: [{ town: "verdelume", field: "target", mult: 1.5 }],
    news: "Feria en Verdelume: compran de todo, y caro.",
  },
  {
    id: "mina-valkeep", town: "valkeep", label: "Veta nueva en Valkeep", chance: 0.04, days: 6,
    mods: [{ town: "valkeep", good: "rune", field: "prod", mult: 2.5 }],
    news: "Abrieron una veta nueva en Valkeep: sobra vidrio rúnico, está regalado.",
  },
  {
    id: "plaga-ashfen", town: "ashfen", label: "Plaga en Ashfen", chance: 0.04, days: 5,
    mods: [{ town: "ashfen", good: "amber", field: "prod", mult: 0.25 }],
    news: "Plaga en los campos de Ashfen: casi no sale ámbar y el que hay está caro.",
  },
  {
    id: "barco-corona", town: "ashfen", label: "Barco de la Corona en Ashfen", chance: 0.04, days: 4,
    mods: [{ town: "ashfen", field: "target", mult: 0.6 }],
    news: "Llegó un barco de la Corona a Ashfen: el pueblo está surtido, pagan poco.",
  },
  {
    id: "cargamento-aduana", town: "verdelume", label: "Aduana: falta vidrio en Verdelume", chance: 0.05, days: 5,
    mods: [{ town: "verdelume", good: "rune", field: "target", mult: 1.6 }],
    heat: { valkeep: 15, verdelume: 15 },
    news: "La Corona agarró un cargamento en la aduana del Paso Alto. Hay más guardias y en Verdelume falta vidrio.",
  },
  {
    id: "redadas-duneshade", town: "duneshade", label: "Redadas en Duneshade", chance: 0.04, days: 4,
    heat: { duneshade: 25 },
    mods: [],
    news: "Redadas en Duneshade: la Corona revisa todo lo que entra al desierto.",
  },
  {
    id: "tormenta-paso", town: "frostholm", label: "Tormenta en el Paso del Hielo", chance: 0.04, days: 4,
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
  // Se baraja antes de recorrer: con el tope de activos, los del final de la lista no tiran menos.
  const deck = [...DECK];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  for (const ev of deck) {
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

/** Sucesos activos con lo que les queda: [{ id, town, label, days }], de los que acaban antes. */
export function eventCountdown(state) {
  const left = {};
  for (const m of state.mods ?? []) if (m.event) left[m.event] = Math.max(left[m.event] ?? 0, m.days ?? 0);
  return Object.entries(left)
    .map(([id, days]) => {
      const ev = DECK.find((e) => e.id === id);
      return ev ? { id, town: ev.town, label: ev.label, days } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.days - b.days);
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
  "Los precios cambian cada día en todos lados. El que escucha, gana.",
  "El que compra donde sobra y vende donde falta, come caliente.",
  "La escarcha no aguanta el sol del desierto. El barquero de Frostholm lo sabe.",
  "La perla pesa como piedra de verdad. Con caballo sale la cuenta.",
  "Al vidrio rúnico no lo golpees. Se raja nada más de verlo.",
  "Con ámbar la Corona sólo cobra impuesto. Con piedra solar, te encierra.",
];

/**
 * Pistas de los refugios escondidos (26-sep): lo que cuenta la gente, sin decir la celda. Cada una
 * insinúa la ruta, la zona y la señal (flores de luna, piedra marcada, ruinas, derrumbe). Siempre
 * son verdad: el "?" queda en la ruta del mapa hasta que das con el refugio.
 */
export const REFUGE_HINTS = [
  { refuge: "refugio-r1", route: "ruta1", text: "Un viejo guardaba sus cosas bajo unas ruinas del bosque, pasando el río de la Calzada del Ámbar. En la orilla crecen flores de luna." },
  { refuge: "refugio-r2", route: "ruta2", text: "Los pastores del Paso Alto rayan una piedra junto a un arbusto. Detrás, entre los pinos del oeste, hay una cueva seca." },
  { refuge: "refugio-r2b", route: "ruta2", text: "Dicen que detrás del derrumbe del Paso Alto se oye agua. La palanca la esconden en el pasto alto." },
  { refuge: "refugio-r3", route: "ruta3", text: "Aurelio, el campesino, se fue a vivir selva adentro, al sur del camino de la Ruta 3. Busca las flores de luna." },
  { refuge: "refugio-r3b", route: "ruta3", text: "En la selva del Tránsito, al norte del camino, hay un estero con una choza vieja. Se llega por unos tablones." },
  { refuge: "refugio-r4", route: "ruta4", text: "Saliendo del lago helado, donde se juntan los pinos nevados, hay una cueva fría. Los que la usan marcan una piedra." },
  { refuge: "refugio-r5", route: "ruta5", text: "En el cañón de la Ruta 5 hay una grieta entre las peñas del oeste. Ahí duermen los que no quieren ser vistos." },
];

/**
 * Un rumor para contar. `honest`: qué tanto dice la verdad la fuente (0-1).
 * Con sucesos activos, casi siempre cuenta uno; si miente, inventa algo de otro pueblo.
 * `hints`: pistas de refugios que el jugador no ha encontrado (de vez en cuando se cuenta una).
 */
export function rumor(state, { honest = 0.85, rng = Math.random, hints = [] } = {}) {
  const events = activeEvents(state);
  if (rng() > honest) {
    const town = TOWN_IDS[Math.floor(rng() * TOWN_IDS.length)];
    return { text: FAKE[Math.floor(rng() * FAKE.length)](TOWNS[town].name), true: false, town };
  }
  if (events.length && rng() < 0.85) {
    const ev = events[Math.floor(rng() * events.length)];
    return { text: ev.news, true: true, event: ev.id, town: ev.town };
  }
  if (hints.length && rng() < 0.22) {
    const h = hints[Math.floor(rng() * hints.length)];
    return { text: h.text, true: true, route: h.route, refuge: h.refuge };
  }
  // Los mercaderes de a pie de estos días: "Ayer un mercader vendió 4 perlas en Valkeep".
  const caravan = (state.caravans ?? []).filter((c) => state.day - c.day <= 2);
  if (caravan.length && rng() < 0.4) {
    const c = caravan[Math.floor(rng() * caravan.length)];
    return { text: caravanNews(c, state.day), true: true, town: c.to };
  }
  // Sin sucesos, casi siempre alguien trae noticias del mercado de otro pueblo (verdaderas).
  if (rng() < 0.7) {
    const news = marketNews(state, rng);
    if (news) return { text: news.text, true: true, town: news.town };
  }
  return { text: CALM[Math.floor(rng() * CALM.length)], true: true };
}

/** Lo más caro o lo más barato de hoy en algún pueblo, dicho como lo cuenta un arriero: { text, town }. */
function marketNews(state, rng) {
  if (!state.market) return null;
  const all = [];
  for (const t of TOWN_IDS) {
    for (const g of GOOD_IDS) {
      const q = quote(state, t, g);
      all.push({ t, g, hot: q.sell / STONE[g].value, cheap: q.buy / STONE[g].value });
    }
  }
  const name = (g) => GOODS[g].name.toLowerCase();
  // Artículo y pronombre de cada piedra: el ámbar, la perla…
  const la = (g) => (["rain", "sun"].includes(g) ? "la" : "el");
  const lo = (g) => (["rain", "sun"].includes(g) ? "la" : "lo");
  if (rng() < 0.65) {
    const top = [...all].sort((a, b) => b.hot - a.hot).slice(0, 3);
    const n = top[Math.floor(rng() * top.length)];
    if (n.hot < 1.1) return null;
    const text = [
      `Vengo de ${TOWNS[n.t].name}: allá andan buscando ${name(n.g)}.`,
      `En ${TOWNS[n.t].name} se les acabó ${la(n.g)} ${name(n.g)}. ${lo(n.g) === "la" ? "La" : "Lo"} están pagando bien.`,
    ][Math.floor(rng() * 2)];
    return { text, town: n.t };
  }
  const low = [...all].sort((a, b) => a.cheap - b.cheap).slice(0, 3);
  const n = low[Math.floor(rng() * low.length)];
  if (n.cheap > 0.85) return null;
  return { text: `En ${TOWNS[n.t].name} les sobra ${name(n.g)}: ${lo(n.g)} dan ${lo(n.g) === "la" ? "barata" : "barato"}.`, town: n.t };
}


// ---------- Mercaderes de a pie (M10) ----------

/** Cómo se cuentan N piedras: "4 perlas", "1 vidrio rúnico", "3 piedras solares". */
export function stonesText(good, n) {
  const one = n === 1;
  switch (good) {
    case "amber": return `${n} ${one ? "piedra" : "piedras"} de ámbar`;
    case "rune": return `${n} ${one ? "vidrio rúnico" : "vidrios rúnicos"}`;
    case "rain": return `${n} ${one ? "perla" : "perlas"}`;
    case "sun": return `${n} ${one ? "piedra solar" : "piedras solares"}`;
    case "frost": return `${n} ${one ? "cristal" : "cristales"} de escarcha`;
    default: return `${n} ${GOODS[good]?.short.toLowerCase() ?? good}`;
  }
}

/**
 * Lo que la gente cuenta de un mercader: "Ayer un mercader vendió 4 perlas en Valkeep (las compró en
 * Verdelume)". `today` null: sin "ayer" (las noticias del servidor ya llevan su día).
 */
export function caravanNews(c, today = null) {
  const ago = today == null ? null : today - c.day;
  const when = ago == null ? "Un mercader" : ago <= 0 ? "Esta mañana un mercader" : ago === 1 ? "Ayer un mercader" : `Hace ${ago} días un mercader`;
  const masc = c.good === "rune" || c.good === "frost";
  const them = c.n === 1 ? (masc ? "lo" : "la") : masc ? "los" : "las";
  return `${when} vendió ${stonesText(c.good, c.n)} en ${TOWNS[c.to].name} (${them} compró en ${TOWNS[c.from].name}).`;
}

// ---------- Contratos del tablón (M4) ----------

/**
 * Contratos claros (26-sep, vuelven los pedidos como cartel): en la posada de cada pueblo, 2 o 3 por
 * día. "Lleva 3 solar a Frostholm hasta el día N: paga 1,3× el precio y 2 de fama; si fallas, −1 de
 * fama". Piden lo que el destino OCUPA hoy. Nunca escarcha (se derrite: no sería claro).
 */
export const CONTRACT = {
  perBoard: [2, 3],
  qty: { amber: [3, 4], rune: [2, 3], rain: [1, 2], sun: [2, 3] },
  payRate: 1.3, // paga 1,3× el precio del destino…
  priceBand: [1, 1.25], // …contado entre 1 y 1,25 veces el valor de la piedra (ni regalado ni loco)
  fame: 2,
  penalty: 1,
  maxActive: 2,
  maxLegs: 3, // hasta 3 tramos de distancia
  slack: 1, // días de sobra además de uno por tramo
};

/** Tramos por tierra entre dos pueblos (la barca cuenta 3: son 3 días de mar). */
export function legsBetween(from, to) {
  const dist = { [from]: 0 };
  const queue = [from];
  while (queue.length) {
    queue.sort((a, b) => dist[a] - dist[b]);
    const cur = queue.shift();
    const t = TOWNS[cur];
    const next = [...Object.values(t.exits ?? {}).map((id) => [id, 1]), ...(t.boat ? [[t.boat, 3]] : [])];
    for (const [id, w] of next) {
      if (!TOWNS[id]) continue;
      const d = dist[cur] + w;
      if (dist[id] == null || d < dist[id]) { dist[id] = d; queue.push(id); }
    }
  }
  return dist[to] ?? Infinity;
}

/** Dado con semilla (mulberry32): el mismo tablón para el mismo pueblo y día. */
export function seededRng(text) {
  let a = 2166136261;
  for (let i = 0; i < text.length; i += 1) a = Math.imul(a ^ text.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Los contratos del tablón de `from` hoy. Para cada destino a 1-3 tramos y cada piedra que no es la
 * del destino, qué tanto la ocupa (lo que paga contra su valor); se eligen los que más, con un poco de
 * azar y destinos distintos. Devuelve [{ id, from, to, good, qty, per, pay, fame, penalty, due, posted }].
 */
export function contractOffers(state, from, rng = seededRng(`${from}-${state.day}`)) {
  const cands = [];
  for (const to of TOWN_IDS) {
    if (to === from) continue;
    const legs = legsBetween(from, to);
    if (legs > CONTRACT.maxLegs) continue;
    for (const g of Object.keys(CONTRACT.qty)) {
      if (g === TOWNS[to].produce) continue;
      const q = quote(state, to, g);
      const need = q.sell / STONE[g].value;
      cands.push({ to, g, legs, sell: q.sell, score: need + rng() * 0.35 });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const [lo, hi] = CONTRACT.perBoard;
  const want = lo + Math.floor(rng() * (hi - lo + 1));
  const picked = [];
  for (const c of cands) {
    if (picked.length >= want) break;
    if (picked.some((p) => p.to === c.to || p.g === c.g)) continue;
    picked.push(c);
  }
  return picked.map((c, i) => {
    const v = STONE[c.g].value;
    const [qlo, qhi] = CONTRACT.qty[c.g];
    const qty = qlo + Math.floor(rng() * (qhi - qlo + 1));
    const ref = Math.min(v * CONTRACT.priceBand[1], Math.max(v * CONTRACT.priceBand[0], c.sell));
    const per = Math.round(ref * CONTRACT.payRate);
    return {
      id: `${from}-${state.day}-${i}`, from, to: c.to, good: c.g, qty, per, pay: per * qty,
      fame: CONTRACT.fame, penalty: CONTRACT.penalty, due: state.day + c.legs + CONTRACT.slack, posted: state.day,
    };
  });
}
