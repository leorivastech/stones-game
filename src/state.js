/**
 * Estado de la partida. Vive en this.registry de Phaser.
 * El mercado (precios, existencias, días) es lógica pura en economy.js; aquí sólo se guarda y se lee.
 */

import { GOODS, TOWNS, TOWN_IDS } from "./world.js";
import {
  GOOD_IDS, STONE, TRAVEL_DAYS, freshEconomy, freshDrift, quote, takeFromMarket, giveToMarket, stepDay, meltAfter, mixChill,
} from "./economy.js";
import { rollDay, rumor as makeRumor, activeEvents, eventCountdown } from "./director.js";
import { online, send, request, isWorldFlag, canUse } from "./net/online.js";

export { GOODS, TOWNS } from "./world.js";
export { STONE, TRAVEL_DAYS, BOAT_COLD, GOOD_IDS, FROST } from "./economy.js";

export const UPGRADES = {
  stashKit: { id: "stashKit", name: "Herrajes de cueva", cost: 40, reputation: 2, effect: "puerta y cerrojo para las cuevas de los caminos" },
  horse: { id: "horse", name: "Caballo de carga", cost: 90, reputation: 3, effect: "+2 lugares · más rápido · salva piedras" },
  icebox: { id: "icebox", name: "Hielera de serrín", cost: 25, reputation: 0, effect: "la escarcha se derrite mucho más lento" },
  escort: { id: "escort", name: "Arquera escolta", cost: 150, reputation: 6, effect: "dispara a bandidos y bestias" },
  hideout: { id: "hideout", name: "Fondo falso", cost: 240, reputation: 10, effect: "oculta 2 piedras ante guardias" },
};

/** Niveles de fama: las "medallas" del caminante. Sube vendiendo lo que un pueblo ocupa. */
export const FAME_TITLES = [
  { min: 0, name: "Desconocido" },
  { min: 2, name: "Mensajero" },
  { min: 6, name: "Contrabandista" },
  { min: 10, name: "Mercader de sombra" },
  { min: 16, name: "Leyenda del golfo" },
];

export const STASH_CAPACITY = 6;

/**
 * Refugios secretos (tipo base secreta de Pokémon). Cada uno es un mapa chico al que se entra.
 * Cueva: la abre el herrero (herrajes). Tierra escondida: se le compra a un campesino.
 */
export const REFUGES = {
  "refugio-r2": { route: "ruta2", kind: "cave", name: "Cueva del Paso Alto", corral: false, cold: false },
  "refugio-r3": { route: "ruta3", kind: "plot", name: "Tierra escondida", corral: true, cold: false, price: 80, fame: 3 },
  "refugio-r4": { route: "ruta4", kind: "cave", name: "Cueva del lago", corral: false, cold: true },
};

export const REFUGE_UPGRADES = {
  shelves: { name: "Estantes", cost: 30, effect: "+6 lugares para piedras" },
  cot: { name: "Catre", cost: 20, effect: "dormir hasta mañana y curarte" },
  corral: { name: "Corral", cost: 40, effect: "aquí se puede quedar el caballo" },
  lock: { name: "Cerrojo reforzado", cost: 60, effect: "la Corona no lo encuentra" },
};

/** La gente (y animales) que te acompañan. Se llevan y se dejan caminando. */
export const CREW = {
  horse: { name: "la yegua", upgrade: "horse", animal: true },
  sahra: { name: "Sahra", upgrade: "escort", animal: false },
};
/** Lo que cobran por día la posada (gente) y el establo (caballo). */
export const LODGING = { inn: 3, stable: 2 };
/** Dormir una noche en la posada: te curas y despiertas a las 7 del día siguiente. */
export const INN_SLEEP = 8;
export const STASH_RAID_HEAT = 60;
export const TONIC = { cost: 12, max: 3, heal: 4 };
export const BOAT_FARE = 15;
/**
 * La deuda con el Gremio: el motivo para empezar. Un cobrador pasa cada `every` días (26-sep: 7 días
 * de 4 min, ~28 min reales). Faltas seguidas (`missed`, vuelve a 0 al pagar la cuota completa):
 * 1ª sube `interest` y avisa; 2ª sube `rate` (10 %) de lo que debes; 3ª y siguientes, además, en la
 * siguiente ruta te esperan 2 matones (`thugs`): si te tumban se cobran `thugCut` del oro, o embargan
 * la yegua (vuelve pagando `horseFine` en el establo de Valkeep). Pagar todo: "Mercader libre" (+`freeFame`).
 */
export const DEBT = {
  start: 500, cuota: 40, every: 7, interest: 25, rate: 0.1,
  thugsAt: 3, thugs: 2, thugHp: 4, thugCut: 0.3, horseFine: 60, freeFame: 2,
};
/** El ámbar con sello: la Corona no lo confisca, cobra impuesto. */
export const AMBER_TAX = 2;
/** Probabilidad de que un golpe rompa un vidrio rúnico. */
export const RUNE_BREAK = 0.3;

function cargoRecord() {
  return Object.fromEntries(GOOD_IDS.map((id) => [id, 0]));
}

export function freshRun() {
  const eco = freshEconomy();
  return {
    gold: 40,
    cargo: cargoRecord(),
    chill: 100,
    baseCapacity: 4,
    reputation: 0,
    trips: 0,
    currentTown: online.on && online.start ? online.start : "ashfen",
    lastRoute: null,
    day: eco.day,
    market: eco.market,
    drift: eco.drift,
    mods: eco.mods,
    heat: eco.heat,
    seen: {},
    rumors: [],
    debt: { owed: DEBT.start, due: 1 + DEBT.every, missed: 0 },
    fameSold: {},
    upgrades: { stashKit: false, horse: false, icebox: false, escort: false, hideout: false },
    crew: {},
    // Vida en medios corazones.
    hp: 6,
    maxHp: 6,
    tonics: 0,
    // Alijos de los caminos: { id: { amber: 2, …, chill } }
    stashes: {},
    flags: {},
    mapId: online.on && online.start ? online.start : "ashfen",
    // Hora del día (0-24): la mueve src/engine/daylight.js.
    hour: 8,
    // Cómo ibas al salir del último pueblo (para los resultados del viaje al llegar).
    tripStart: null,
  };
}

// ---------- Registro ----------

function getRecord(registry, key, fallback) {
  return registry.get(key) ?? fallback;
}

function setRecordValue(registry, key, id, value, fallback = {}) {
  registry.set(key, { ...getRecord(registry, key, fallback), [id]: value });
}

/** Copia del estado económico para trabajar con economy.js. */
export function econ(registry) {
  // El vaivén de precios se crea una vez por partida y se guarda. Las partidas viejas lo reciben
  // aquí, igual que los pueblos que se agregaron después (Mossgrove).
  const saved = registry.get("drift");
  if (!saved || TOWN_IDS.some((t) => !saved[t])) registry.set("drift", { ...freshDrift(), ...(saved ?? {}) });
  const fresh = freshEconomy();
  return {
    day: registry.get("day") ?? 1,
    market: { ...fresh.market, ...structuredClone(registry.get("market") ?? {}) },
    drift: structuredClone(registry.get("drift")),
    mods: structuredClone(registry.get("mods") ?? []),
    heat: { ...fresh.heat, ...(registry.get("heat") ?? {}) },
  };
}

function commit(registry, st) {
  registry.set("day", st.day);
  registry.set("market", st.market);
  registry.set("drift", st.drift);
  registry.set("mods", st.mods);
  registry.set("heat", st.heat);
}

// ---------- Básicos ----------

export function gold(registry) {
  return registry.get("gold") ?? 0;
}

export function day(registry) {
  return registry.get("day") ?? 1;
}

export function reputation(registry) {
  return registry.get("reputation") ?? 0;
}

export function fameTitle(value) {
  return [...FAME_TITLES].reverse().find((t) => value >= t.min).name;
}

export function nextFameTitle(value) {
  return FAME_TITLES.find((t) => t.min > value) ?? null;
}

export function addFame(registry, amount) {
  registry.set("reputation", reputation(registry) + amount);
}

export function cargo(registry) {
  return getRecord(registry, "cargo", cargoRecord());
}

export function cargoOf(registry, goodId) {
  return cargo(registry)[goodId] ?? 0;
}

/** Número de piedras. */
export function stones(registry) {
  return Object.values(cargo(registry)).reduce((sum, amount) => sum + amount, 0);
}

/** Lugares ocupados: la perla de lluvia pesa por dos. */
export function load(registry) {
  const c = cargo(registry);
  return GOOD_IDS.reduce((sum, g) => sum + (c[g] ?? 0) * STONE[g].slots, 0);
}

export function fits(registry, good) {
  return load(registry) + STONE[good].slots <= capacity(registry);
}

export function hasUpgrade(registry, id) {
  return Boolean(getRecord(registry, "upgrades", {})[id]);
}

export function capacity(registry) {
  return (registry.get("baseCapacity") ?? 4) + (partyHas(registry, "horse") ? 2 : 0);
}

export function hiddenCapacity(registry) {
  return hasUpgrade(registry, "hideout") ? 2 : 0;
}

export function visibleStones(registry) {
  return Math.max(0, stones(registry) - hiddenCapacity(registry));
}

/** Piedras a la vista que no son ámbar (el ámbar con sello sólo paga impuesto). */
export function contrabandVisible(registry) {
  return Math.max(0, visibleStones(registry) - cargoOf(registry, "amber"));
}

export function ambushProtection(registry) {
  return (partyHas(registry, "horse") ? 1 : 0) + (partyHas(registry, "sahra") ? 1 : 0);
}

// ---------- Tripulación ----------

/**
 * Dónde está cada quien: "party" (contigo), "stable:<pueblo>", "inn:<pueblo>", "refuge:<id>",
 * "wait:<mapa>" (el caballo esperando afuera de una cueva), "scared:<ruta>" (la yegua se espantó
 * cuando caíste: te espera en esa ruta) o "seized" (embargada por el Gremio: se recupera en el establo
 * de Valkeep). Si lo tienes y no hay registro, va contigo.
 */
export function crewAt(registry, who) {
  const rec = getRecord(registry, "crew", {})[who];
  if (rec) return rec.at;
  return hasUpgrade(registry, CREW[who].upgrade) ? "party" : null;
}

export function crewSince(registry, who) {
  return getRecord(registry, "crew", {})[who]?.since ?? day(registry);
}

export function setCrewAt(registry, who, at) {
  setRecordValue(registry, "crew", who, { at, since: day(registry) });
}

export function partyHas(registry, who) {
  return crewAt(registry, who) === "party";
}

export function partySize(registry) {
  return Object.keys(CREW).filter((w) => partyHas(registry, w)).length;
}

/** Lo que se debe por tener a alguien guardado en la posada o el establo. */
export function lodgingFee(registry, who) {
  const at = crewAt(registry, who) ?? "";
  const days = Math.max(1, day(registry) - crewSince(registry, who));
  if (at.startsWith("inn:")) return days * LODGING.inn;
  if (at.startsWith("stable:")) return days * LODGING.stable;
  return 0;
}

// ---------- Refugios ----------

export function ownsRefuge(registry, id) {
  if (online.on) return canUse(id);
  return flag(registry, `refuge-${id}`);
}

export function refugeHas(registry, id, upgrade) {
  if (upgrade === "corral" && REFUGES[id]?.corral) return true;
  if (online.on) return Boolean(online.world.owners[id]?.ups?.[upgrade]);
  return flag(registry, `${id}-${upgrade}`);
}

export function stashCapacity(registry, id) {
  return STASH_CAPACITY + (refugeHas(registry, id, "shelves") ? 6 : 0);
}

/** Quién se quedó en un refugio. */
export function crewIn(registry, refugeId) {
  return Object.keys(CREW).filter((w) => crewAt(registry, w) === `refuge:${refugeId}`);
}

export function chill(registry) {
  return registry.get("chill") ?? 100;
}

export function pay(registry, amount) {
  if (gold(registry) < amount) return 0;
  registry.inc("gold", -amount);
  return amount;
}

// ---------- Tónicos ----------

export function tonics(registry) {
  return registry.get("tonics") ?? 0;
}

export function buyTonic(registry) {
  if (tonics(registry) >= TONIC.max) return { ok: false, reason: `Ya llevas ${TONIC.max} tónicos.` };
  if (gold(registry) < TONIC.cost) return { ok: false, reason: `Faltan ${TONIC.cost - gold(registry)} de oro.` };
  registry.inc("gold", -TONIC.cost);
  registry.set("tonics", tonics(registry) + 1);
  return { ok: true, reason: "Un tónico de raíz. Con el botón de tónico te lo tomas." };
}

export function drinkTonic(registry) {
  if (!tonics(registry) || hp(registry) >= maxHp(registry)) return false;
  registry.set("tonics", tonics(registry) - 1);
  heal(registry, TONIC.heal);
  return true;
}

// ---------- Alijos ----------

export function stashOf(registry, id) {
  if (online.on) return online.world.stashes[id] ?? {};
  return getRecord(registry, "stashes", {})[id] ?? {};
}

export function stashCount(registry, id) {
  const st = stashOf(registry, id);
  return GOOD_IDS.reduce((s, g) => s + (st[g] ?? 0), 0);
}

/** Pasa una piedra entre la carga y el alijo. dir = +1 guarda, −1 saca. La escarcha lleva su frío. */
export function moveStash(registry, id, good, dir) {
  if (online.on) return moveStashOnline(registry, id, good, dir);
  const st = { ...stashOf(registry, id) };
  const c = { ...cargo(registry) };
  if (dir > 0) {
    if (!(c[good] > 0) || stashCount(registry, id) >= stashCapacity(registry, id)) return false;
    if (good === "frost") st.chill = mixChill(st.frost ?? 0, st.chill ?? 100, 1, chill(registry));
    c[good] -= 1;
    st[good] = (st[good] ?? 0) + 1;
  } else {
    if (!(st[good] > 0) || !fits(registry, good)) return false;
    if (good === "frost") registry.set("chill", mixChill(c.frost ?? 0, chill(registry), 1, st.chill ?? 100));
    st[good] -= 1;
    c[good] = (c[good] ?? 0) + 1;
  }
  registry.set("cargo", c);
  registry.set("stashes", { ...getRecord(registry, "stashes", {}), [id]: st });
  return true;
}

/**
 * En línea el estante es del mundo: se mueve al instante en pantalla y el servidor confirma.
 * Si otro jugador se ganó la última piedra (o el último lugar), se deshace.
 */
function moveStashOnline(registry, id, good, dir) {
  const st = { ...stashOf(registry, id) };
  const c = { ...cargo(registry) };
  // Lo de antes de mover, para mezclar el frío bien y para deshacer si el servidor dice que no.
  const frostBefore = c.frost ?? 0;
  const chillBefore = chill(registry);
  const stashChillBefore = st.chill ?? 100;
  if (dir > 0) {
    if (!(c[good] > 0) || stashCount(registry, id) >= stashCapacity(registry, id)) return false;
    if (good === "frost") st.chill = mixChill(st.frost ?? 0, stashChillBefore, 1, chillBefore);
    c[good] -= 1;
    st[good] = (st[good] ?? 0) + 1;
  } else {
    if (!(st[good] > 0) || !fits(registry, good)) return false;
    if (good === "frost") registry.set("chill", mixChill(frostBefore, chillBefore, 1, stashChillBefore));
    st[good] -= 1;
    c[good] = (c[good] ?? 0) + 1;
  }
  registry.set("cargo", c);
  online.world.stashes = { ...online.world.stashes, [id]: st };
  request({ t: "stash", id, good, dir, chill: chillBefore }).then((r) => {
    if (!r.ok) {
      // Otro jugador se ganó la piedra (o el lugar): se deshace en la carga Y en el estante.
      const back = { ...cargo(registry) };
      back[good] = Math.max(0, (back[good] ?? 0) + (dir > 0 ? 1 : -1));
      registry.set("cargo", back);
      if (good === "frost" && dir < 0) registry.set("chill", back.frost ? chillBefore : 100);
      // Si mientras tanto llegó el estante del servidor, ese manda; si no, se revierte lo local.
      if (online.world.stashes[id] === st) {
        const now = { ...st, [good]: Math.max(0, (st[good] ?? 0) - dir) };
        if (good === "frost") now.chill = stashChillBefore;
        online.world.stashes = { ...online.world.stashes, [id]: now };
      }
      return;
    }
    // El frío real del estante lo sabe el servidor: se vuelve a mezclar con lo que había antes.
    if (good === "frost" && dir < 0) registry.set("chill", mixChill(frostBefore, chillBefore, 1, r.chill ?? stashChillBefore));
  });
  return true;
}

export function emptyStash(registry, id) {
  if (online.on) {
    const lost = stashCount(registry, id);
    send({ t: "raid", id });
    return lost;
  }
  const lost = stashCount(registry, id);
  registry.set("stashes", { ...getRecord(registry, "stashes", {}), [id]: {} });
  return lost;
}

// ---------- Vida ----------

export function hp(registry) {
  return registry.get("hp") ?? 6;
}

export function maxHp(registry) {
  return registry.get("maxHp") ?? 6;
}

export function hurt(registry, halves) {
  const next = Math.max(0, hp(registry) - halves);
  registry.set("hp", next);
  return next;
}

export function heal(registry, halves = 99) {
  registry.set("hp", Math.min(maxHp(registry), hp(registry) + halves));
}

export function addHeartContainer(registry) {
  registry.set("maxHp", maxHp(registry) + 2);
  registry.set("hp", maxHp(registry));
}

/** El vidrio rúnico es frágil: un golpe puede romper uno. Devuelve true si se rompió. */
export function maybeBreakRune(registry, roll = Math.random()) {
  if (!cargoOf(registry, "rune") || roll >= RUNE_BREAK) return false;
  setRecordValue(registry, "cargo", "rune", cargoOf(registry, "rune") - 1, cargoRecord());
  return true;
}

// ---------- Banderas del mundo (cofres, rejas) ----------

export function flag(registry, id) {
  if (online.on && isWorldFlag(id)) return Boolean(online.world.flags[id]);
  return Boolean(getRecord(registry, "flags", {})[id]);
}

export function setFlag(registry, id, value = true) {
  registry.set("flags", { ...getRecord(registry, "flags", {}), [id]: value });
}

// ---------- Tutorial de la partida nueva ----------

/**
 * Pasos del tutorial (flags.tutorial = número del paso; sin número = no hay tutorial).
 * Cada paso se cumple con la acción real; `{roll}` y `{hide}` se cambian por la tecla.
 */
export const TUTORIAL = [
  { id: "talk", text: "Habla con Brena, la comerciante" },
  { id: "buy", text: "Compra una piedra que SOBRA", alt: "Compra una piedra: la más barata" },
  { id: "north", text: "Sal por el norte hacia Valkeep" },
  { id: "route", text: "Corre con {roll} · agáchate con {hide} en el pasto alto", done: "Bien. Sigue al norte hasta Valkeep" },
  { id: "sell", text: "Vende lo que OCUPAN: así ganas fama" },
];

/** Paso actual del tutorial (0…), o -1 si no hay. */
export function tutorialStep(registry) {
  const v = getRecord(registry, "flags", {}).tutorial;
  return typeof v === "number" && v >= 0 && v < TUTORIAL.length ? v : -1;
}

/** Pasa al paso `n`; de largo del último, se termina (y no vuelve). */
export function setTutorialStep(registry, n) {
  setFlag(registry, "tutorial", n >= 0 && n < TUTORIAL.length ? n : false);
}

// ---------- Calor ----------

export function heat(registry, townId) {
  return getRecord(registry, "heat", {})[townId] ?? 0;
}

export function routeHeat(registry, fromId, toId) {
  return Math.round((heat(registry, fromId) + heat(registry, toId)) / 2);
}

export function addHeat(registry, townId, amount) {
  setRecordValue(registry, "heat", townId, Math.min(100, Math.max(0, heat(registry, townId) + amount)));
  if (online.on) send({ t: "heat", town: townId, n: amount });
}

/** Calor que importa donde está el jugador: el del pueblo, o el promedio de la ruta. */
export function localHeat(registry, def) {
  if (!def) return 0;
  if (def.kind === "town") return heat(registry, def.town);
  const [a, b] = def.between ?? [];
  return a && b ? routeHeat(registry, a, b) : 0;
}

export function heatLevel(value) {
  if (value >= 70) return 3;
  if (value >= 45) return 2;
  if (value >= 20) return 1;
  return 0;
}

// ---------- Mercado ----------

/** Precio de una piedra en un pueblo, hoy. */
export function priceOf(registry, townId, good) {
  return quote(econ(registry), townId, good, chill(registry));
}

export function canBuy(registry, townId, good) {
  const q = priceOf(registry, townId, good);
  return q.stock >= 1 && gold(registry) >= q.buy && fits(registry, good);
}

export function canSell(registry, townId, good) {
  return cargoOf(registry, good) > 0;
}

export function buy(registry, townId, good) {
  if (!canBuy(registry, townId, good)) return null;
  const st = econ(registry);
  const q = quote(st, townId, good);
  registry.inc("gold", -q.buy);
  if (good === "frost") registry.set("chill", mixChill(cargoOf(registry, "frost"), chill(registry), 1, 100));
  setRecordValue(registry, "cargo", good, cargoOf(registry, good) + 1, cargoRecord());
  takeFromMarket(st, townId, good);
  st.heat[townId] = Math.min(100, st.heat[townId] + 1);
  commit(registry, st);
  if (online.on) {
    // Si otro jugador se llevó la última al mismo tiempo, se devuelve el oro.
    request({ t: "trade", town: townId, good, side: "buy" }).then((r) => {
      if (r.ok || r.offline) return;
      registry.inc("gold", q.buy);
      setRecordValue(registry, "cargo", good, Math.max(0, cargoOf(registry, good) - 1), cargoRecord());
    });
  }
  return { good: GOODS[good], price: q.buy };
}

// ---------- Buhonero de camino ----------

/**
 * A veces, al entrar a una ruta, anda por ahí un buhonero: te compra una piedra más cara que en los
 * pueblos y te vende otra barata, pocas piezas. Una tirada por ruta y por día (si vuelves el mismo
 * día sigue ahí, con lo que le quedó).
 */
export const PEDDLER = {
  chance: 0.35,
  buyRate: [1.25, 1.45], // te paga entre 125 % y 145 % del valor (un pueblo paga 144 % como mucho)
  sellRate: [0.55, 0.7], // te vende entre 55 % y 70 % del valor
  names: ["Ruperto", "Casilda", "Anselmo", "Brígida", "Tadeo", "Remedios"],
};

/**
 * En línea: el buhonero de la ruta lo decide el servidor, igual para todos. Si el servidor no
 * contesta (recién recargaste y aún no conecta), se usa el que ya mandó en la bienvenida o el que
 * tenías guardado de hoy: no se vuelve a tirar el dado ni se da por hecho que no hay.
 */
export async function peddlerOnline(registry, routeId) {
  const r = await request({ t: "peddler", route: routeId, op: "get" });
  const today = day(registry);
  let p;
  if (r.ok) p = r.p;
  else {
    const known = [online.world.peddlers?.[routeId], registry.get("peddler")].find((x) => x && x.route === routeId && x.day === today);
    if (!known) return null;
    p = known;
  }
  registry.set("peddler", p.none ? { route: routeId, day: p.day ?? today, none: true } : p);
  return p.none ? null : p;
}

/** El buhonero de esta ruta hoy (o null). La primera vez del día se tira el dado. */
export function peddlerFor(registry, routeId, rand = Math.random) {
  const today = day(registry);
  const cur = registry.get("peddler");
  if (cur && cur.route === routeId && cur.day === today) return cur.none ? null : cur;
  if (rand() >= PEDDLER.chance) {
    registry.set("peddler", { route: routeId, day: today, none: true });
    return null;
  }
  const lerp = ([a, b]) => a + (b - a) * rand();
  const carried = GOOD_IDS.filter((g) => cargoOf(registry, g) > 0);
  // Casi siempre compra algo que llevas: así el encuentro sirve.
  const buyGood = carried.length && rand() < 0.7 ? carried[Math.floor(rand() * carried.length)] : GOOD_IDS[Math.floor(rand() * GOOD_IDS.length)];
  const sellable = GOOD_IDS.filter((g) => g !== buyGood && g !== "frost");
  const sellGood = sellable[Math.floor(rand() * sellable.length)];
  const p = {
    route: routeId,
    day: today,
    name: PEDDLER.names[Math.floor(rand() * PEDDLER.names.length)],
    buys: { good: buyGood, price: Math.round(STONE[buyGood].value * lerp(PEDDLER.buyRate)), left: 3 },
    sells: { good: sellGood, price: Math.max(1, Math.round(STONE[sellGood].value * lerp(PEDDLER.sellRate))), left: 2 + (rand() < 0.5 ? 1 : 0) },
  };
  registry.set("peddler", p);
  return p;
}

/** Venderle una piedra al buhonero. La escarcha se paga según el frío que le quede. */
export function sellToPeddler(registry) {
  const p = registry.get("peddler");
  if (!p || p.none || p.buys.left <= 0 || cargoOf(registry, p.buys.good) <= 0) return null;
  const good = p.buys.good;
  const price = good === "frost" ? Math.max(1, Math.round(p.buys.price * chill(registry) / 100)) : p.buys.price;
  registry.inc("gold", price);
  setRecordValue(registry, "cargo", good, cargoOf(registry, good) - 1, cargoRecord());
  if (good === "frost" && !cargoOf(registry, "frost")) registry.set("chill", 100);
  registry.set("peddler", { ...p, buys: { ...p.buys, left: p.buys.left - 1 } });
  if (online.on) send({ t: "peddler", route: p.route, op: "sell" });
  return { good: GOODS[good], price };
}

/** Comprarle una piedra al buhonero. */
export function buyFromPeddler(registry) {
  const p = registry.get("peddler");
  if (!p || p.none) return null;
  const { good, price, left } = p.sells;
  if (left <= 0 || gold(registry) < price || !fits(registry, good)) return null;
  registry.inc("gold", -price);
  setRecordValue(registry, "cargo", good, cargoOf(registry, good) + 1, cargoRecord());
  registry.set("peddler", { ...p, sells: { ...p.sells, left: left - 1 } });
  if (online.on) send({ t: "peddler", route: p.route, op: "buy" });
  return { good: GOODS[good], price };
}

/** Aquí la ocupan: falta, o la pagan al menos 10 % arriba de su valor. */
export function isWanted(q) {
  return q.mood === "falta" || q.sell / STONE[q.good].value >= 1.1;
}

/** Fama por vender: vender lo que un pueblo ocupa da +1, una vez por pueblo y por día. */
export const FAME_PER_SALE = 1;

export function sell(registry, townId, good) {
  if (!canSell(registry, townId, good)) return null;
  const st = econ(registry);
  const q = quote(st, townId, good, chill(registry));
  const famed = getRecord(registry, "fameSold", {});
  const fame = isWanted(q) && famed[townId] !== day(registry) ? FAME_PER_SALE : 0;
  if (fame) {
    addFame(registry, fame);
    setRecordValue(registry, "fameSold", townId, day(registry));
  }
  registry.inc("gold", q.sell);
  setRecordValue(registry, "cargo", good, cargoOf(registry, good) - 1, cargoRecord());
  if (good === "frost" && !cargoOf(registry, "frost")) registry.set("chill", 100);
  giveToMarket(st, townId, good);
  st.heat[townId] = Math.min(100, st.heat[townId] + STONE[good].sellHeat);
  commit(registry, st);
  if (online.on) send({ t: "trade", town: townId, good, side: "sell" });
  return { good: GOODS[good], price: q.sell, fame };
}

/** Lo que el jugador sabe de un mercado: los precios del día en que lo vio. */
export function recordSeen(registry, townId) {
  const st = econ(registry);
  const prices = Object.fromEntries(GOOD_IDS.map((g) => [g, quote(st, townId, g).sell]));
  setRecordValue(registry, "seen", townId, { day: st.day, prices });
}

export function seenOf(registry, townId) {
  return getRecord(registry, "seen", {})[townId] ?? null;
}

/**
 * La mejor pista para el HUD: en qué otro pueblo pagaban más por una piedra (respecto a su valor),
 * según lo último que viste allá. Sólo si pagaban bien (×1.2 o más). null si no sabes nada.
 */
export function bestLead(registry, hereTown = null) {
  let best = null;
  for (const [town, s] of Object.entries(getRecord(registry, "seen", {}))) {
    if (town === hereTown || !s?.prices) continue;
    for (const g of GOOD_IDS) {
      const rate = (s.prices[g] ?? 0) / STONE[g].value;
      if (rate >= 1.2 && (!best || rate > best.rate)) best = { town, good: g, price: s.prices[g], rate, day: s.day };
    }
  }
  return best;
}

// ---------- Días ----------

/**
 * Pasan `n` días: el mercado se mueve, el calor baja, caducan sucesos y la escarcha se derrite
 * (en la carga y en los alijos que no están en tierra fría). `cold` (0-1): qué tanto del viaje fue frío.
 * `meltCargo: false` cuando la carga ya se derritió hora por hora (el reloj que corre, ver meltHours).
 */
export function passDays(registry, n, { cold = 0, meltCargo = true } = {}) {
  const st = econ(registry);
  const ended = [];
  const started = [];
  if (!online.on) {
    for (let i = 0; i < n; i += 1) {
      ended.push(...stepDay(st));
      started.push(...rollDay(st));
    }
    commit(registry, st);
  }
  const melted = meltCargo ? meltCargoFor(registry, n, cold) : 0;
  // En línea los estantes son del mundo: el servidor derrite su escarcha.
  const stashes = online.on ? {} : { ...getRecord(registry, "stashes", {}) };
  for (const [id, s] of Object.entries(stashes)) {
    if (!s.frost || s.cold) continue;
    const next = meltAfter(s.chill ?? 100, n);
    stashes[id] = next <= 0 ? { ...s, frost: 0, chill: 100 } : { ...s, chill: next };
  }
  if (!online.on) registry.set("stashes", stashes);
  return { ended, started, melted };
}

/** La escarcha que llevas pierde el frío de `days` días (con decimales). Devuelve cuántas se hicieron agua. */
function meltCargoFor(registry, days, cold) {
  if (!cargoOf(registry, "frost")) return 0;
  const next = meltAfter(chill(registry), days, { icebox: hasUpgrade(registry, "icebox"), cold });
  if (next > 0) {
    registry.set("chill", Math.round(next * 10) / 10);
    return 0;
  }
  const melted = cargoOf(registry, "frost");
  setRecordValue(registry, "cargo", "frost", 0, cargoRecord());
  registry.set("chill", 100);
  return melted;
}

/** El reloj corrió `hours` horas: la escarcha de la carga se derrite en proporción. */
export function meltHours(registry, hours, cold = 0) {
  return meltCargoFor(registry, hours / 24, cold);
}

/**
 * Qué tan frío es un lugar para la escarcha (0-1): el refugio frío la guarda entera; la Ruta 4 y
 * Frostholm, a medias; lo demás, nada.
 */
export function coldAt(def) {
  if (!def) return 0;
  if (def.cold) return 1;
  if (def.id === "ruta4" || def.town === "frostholm") return 0.5;
  return 0;
}

// ---------- Rumores ----------

/** Días que un rumor sin suceso sigue marcado en el mapa. */
export const RUMOR_DAYS = 4;

/**
 * Un rumor de la gente. Se guardan los últimos que oíste. Si habla de un pueblo, queda marcado en el
 * mapa de la pausa con "?" hasta `until` (lo que le queda al suceso, o RUMOR_DAYS); al llegar a ese
 * pueblo se comprueba (`checked`: "true" o "false") y el falso se tacha.
 */
export function hearRumor(registry, honest) {
  const st = econ(registry);
  let r = makeRumor(st, { honest });
  if (online.on && Math.random() < 0.5) {
    const others = online.world.news.filter((n) => !n.text.startsWith(online.name));
    if (others.length) r = { text: `Dicen por ahí: ${others[Math.floor(Math.random() * Math.min(4, others.length))].text}`, true: true };
  }
  const today = day(registry);
  const left = r.event ? eventCountdown(st).find((e) => e.id === r.event)?.days : null;
  const item = { day: today, text: r.text, town: r.town ?? null, true: r.true !== false, until: today + (left ?? RUMOR_DAYS) };
  // El mismo rumor otra vez no ocupa otro lugar: se renueva.
  const old = getRecord(registry, "rumors", []).filter((x) => x.text !== r.text);
  registry.set("rumors", [item, ...old].slice(0, 8));
  return r;
}

export function rumors(registry) {
  return getRecord(registry, "rumors", []);
}

/** Rumores que siguen marcados en el mapa (de un pueblo y sin caducar), el más nuevo primero. */
export function rumorMarks(registry) {
  const today = day(registry);
  return rumors(registry).filter((r) => r.town && (r.until ?? r.day + RUMOR_DAYS) >= today);
}

/**
 * Llegas a un pueblo: los rumores de aquí se comprueban. Devuelve los que resultaron falsos (se
 * tachan en el mapa) y los verdaderos, para avisarlo.
 */
export function checkRumors(registry, townId) {
  const list = rumors(registry);
  const falses = [];
  const trues = [];
  const today = day(registry);
  const next = list.map((r) => {
    if (r.town !== townId || r.checked || (r.until ?? 0) < today) return r;
    (r.true === false ? falses : trues).push(r);
    return { ...r, checked: r.true === false ? "false" : "true" };
  });
  if (falses.length || trues.length) registry.set("rumors", next);
  return { falses, trues };
}

export function worldEvents(registry) {
  return activeEvents(econ(registry));
}

/** Sucesos activos con cuántos días les quedan y a qué pueblo le pegan. */
export function eventList(registry) {
  return eventCountdown({ mods: registry.get("mods") ?? [] });
}

// ---------- Deuda con el Gremio ----------

export function debt(registry) {
  return registry.get("debt") ?? { owed: 0, due: Infinity, missed: 0 };
}

export function debtDue(registry) {
  const d = debt(registry);
  return d.owed > 0 && day(registry) >= d.due;
}

/** La cuota que toca hoy (o lo que quede, si es menos). */
export function debtCuota(registry) {
  return Math.min(DEBT.cuota, debt(registry).owed);
}

/**
 * Abona a la deuda. Si cubre la cuota, el cobrador vuelve en `every` días y se borran las faltas.
 * Si no la cubre (pagaste lo que traías), cuenta como falta sin intereses: vuelve pronto.
 * Devuelve { paid, free, missed } (`free`: con esto quedó saldada).
 */
export function payDebt(registry, amount) {
  const d = { ...debt(registry) };
  const cuota = Math.min(DEBT.cuota, d.owed);
  const paid = Math.min(amount, d.owed, gold(registry));
  if (paid <= 0) return { paid: 0, free: false, missed: d.missed };
  registry.inc("gold", -paid);
  d.owed -= paid;
  if (d.owed <= 0) {
    d.owed = 0;
    d.missed = 0;
    d.thugs = false;
  } else if (paid >= cuota) {
    d.due = day(registry) + DEBT.every;
    d.missed = 0;
  } else {
    d.missed += 1;
    d.due = day(registry) + Math.ceil(DEBT.every / 2);
    if (d.missed >= DEBT.thugsAt) d.thugs = true;
  }
  registry.set("debt", d);
  return { paid, free: d.owed <= 0, missed: d.missed };
}

/**
 * No pagaste: la deuda crece y el cobrador vuelve pronto. 1ª falta: +interest; 2ª en adelante:
 * +10 % de lo que debes (al menos `interest`); desde la 3ª, además, matones en la siguiente ruta.
 * Devuelve la deuda nueva con `added` (lo que subió).
 */
export function missDebt(registry) {
  const d = { ...debt(registry) };
  d.missed = (d.missed ?? 0) + 1;
  const added = d.missed >= 2 ? Math.max(DEBT.interest, Math.round(d.owed * DEBT.rate)) : DEBT.interest;
  d.owed += added;
  d.due = day(registry) + Math.ceil(DEBT.every / 2);
  if (d.missed >= DEBT.thugsAt) d.thugs = true;
  registry.set("debt", d);
  return { ...d, added };
}

/** ¿Te esperan matones del Gremio en esta ruta? (se gastan al salir a su encuentro). */
export function thugsPending(registry) {
  return Boolean(debt(registry).thugs) && debt(registry).owed > 0;
}

export function clearThugs(registry) {
  registry.set("debt", { ...debt(registry), thugs: false });
}

/**
 * Los matones te tumbaron: se cobran el 30 % del oro (va a la deuda) o, sin oro, se llevan la yegua.
 * Devuelve { gold, horse } con lo que se llevaron.
 */
export function thugsCollect(registry) {
  const g = gold(registry);
  if (g > 0) {
    const take = Math.max(1, Math.ceil(g * DEBT.thugCut));
    registry.inc("gold", -take);
    const d = { ...debt(registry) };
    d.owed = Math.max(0, d.owed - take);
    registry.set("debt", d);
    return { gold: take, horse: false };
  }
  if (hasUpgrade(registry, "horse") && crewAt(registry, "horse") !== "seized") {
    setCrewAt(registry, "horse", "seized");
    return { gold: 0, horse: true };
  }
  return { gold: 0, horse: false };
}

/**
 * Lo que conviene en este pueblo hoy, para decirlo claro al llegar y en la burbuja del comerciante:
 * - `wanted`: lo que aquí pagan bien (falta), de mejor a peor.
 * - `cheap`: lo que aquí sobra y se compra barato.
 * - `yours`: lo que llevas y aquí te pagan bien.
 * - `fameToday`: si vender lo que ocupan aquí todavía da fama hoy.
 */
export function townTips(registry, townId) {
  const all = GOOD_IDS.map((g) => {
    const q = priceOf(registry, townId, g);
    return { good: g, ...q, rate: q.sell / STONE[g].value, cost: q.buy / STONE[g].value };
  });
  const wanted = all.filter(isWanted).sort((a, b) => b.rate - a.rate);
  const cheap = all.filter((q) => q.stock >= 1 && (q.mood === "sobra" || q.cost <= 0.85)).sort((a, b) => a.cost - b.cost);
  const yours = all.filter((q) => cargoOf(registry, q.good) > 0 && q.rate >= 1).sort((a, b) => b.sell - a.sell);
  const fameToday = getRecord(registry, "fameSold", {})[townId] !== day(registry);
  return { wanted, cheap, yours, fameToday };
}

// ---------- Mejoras ----------

export function purchaseUpgrade(registry, id) {
  const item = UPGRADES[id];
  if (!item) return { ok: false, reason: "Mejora desconocida." };
  if (hasUpgrade(registry, id)) return { ok: false, reason: `${item.name}: ya comprado.` };
  if (reputation(registry) < item.reputation) return { ok: false, reason: `${item.name}: requiere fama ${item.reputation}.` };
  if (gold(registry) < item.cost) return { ok: false, reason: `${item.name}: faltan ${item.cost - gold(registry)} oro.` };
  registry.inc("gold", -item.cost);
  registry.set("upgrades", { ...getRecord(registry, "upgrades", {}), [id]: true });
  // El caballo y la arquera se vienen contigo desde que los contratas.
  for (const [who, c] of Object.entries(CREW)) if (c.upgrade === id) setCrewAt(registry, who, "party");
  return { ok: true, reason: `${item.name}: tuyo.` };
}

export function loseStones(registry, amount, visibleOnly = false) {
  let remaining = Math.min(amount, visibleOnly ? visibleStones(registry) : stones(registry));
  const next = { ...cargo(registry) };
  let lost = 0;
  // Se pierden primero las más caras.
  for (const goodId of [...GOOD_IDS].reverse()) {
    if (remaining <= 0) break;
    const take = Math.min(next[goodId] ?? 0, remaining);
    next[goodId] -= take;
    remaining -= take;
    lost += take;
  }
  if (lost) registry.set("cargo", next);
  if (!next.frost) registry.set("chill", 100);
  return lost;
}

/** Revisión de la Corona: confisca lo visible que no sea ámbar; el ámbar paga impuesto. */
export function confiscateVisible(registry) {
  const hidden = hiddenCapacity(registry);
  const next = { ...cargo(registry) };
  let toTake = Math.max(0, stones(registry) - hidden);
  const taken = cargoRecord();
  // El fondo falso esconde primero las más caras.
  let shelter = hidden;
  for (const g of [...GOOD_IDS].reverse()) {
    const keep = Math.min(next[g], shelter);
    shelter -= keep;
    const visible = next[g] - keep;
    if (g === "amber" || !visible || toTake <= 0) continue;
    const take = Math.min(visible, toTake);
    next[g] -= take;
    taken[g] = take;
    toTake -= take;
  }
  registry.set("cargo", next);
  if (!next.frost) registry.set("chill", 100);
  return taken;
}

// ---------- Guardado ----------

const BASE_KEY = "stones-save-v4";
const saveKey = () => (online.on && online.name ? `${BASE_KEY}-online-${online.name}` : BASE_KEY);
const SAVED = [
  "gold", "cargo", "chill", "baseCapacity", "reputation", "trips", "currentTown", "lastRoute", "day", "market", "drift", "mods",
  "heat", "seen", "rumors", "debt", "fameSold", "peddler", "upgrades", "hp", "maxHp", "tonics",
  "stashes", "flags", "mapId", "crew", "hour", "tripStart",
];

export function saveGame(registry) {
  try {
    const data = Object.fromEntries(SAVED.map((k) => [k, registry.get(k)]));
    localStorage.setItem(saveKey(), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function hasSave() {
  try {
    return Boolean(localStorage.getItem(saveKey()));
  } catch {
    return false;
  }
}

export function loadGame(registry) {
  try {
    const data = JSON.parse(localStorage.getItem(saveKey()));
    if (!data) return false;
    // En línea el mercado y el día vienen del servidor, no del guardado (el buhonero guardado sólo
    // sirve de respaldo si el servidor tarda: ver peddlerOnline).
    if (online.on) for (const k of ["day", "market", "drift", "mods", "heat"]) delete data[k];
    const keep = online.on ? Object.fromEntries(["day", "market", "drift", "mods", "heat"].map((k) => [k, registry.get(k)])) : {};
    registry.set({ ...freshRun(), ...data, ...keep });
    return true;
  } catch {
    return false;
  }
}

export function resetRun(registry) {
  const keep = online.on ? Object.fromEntries(["day", "market", "drift", "mods", "heat"].map((k) => [k, registry.get(k)])) : {};
  registry.set({ ...freshRun(), ...keep });
}

export function ensureRun(registry) {
  if (registry.get("cargo") == null || registry.get("market") == null) resetRun(registry);
}

export { TOWN_IDS };
