/** Estado económico de la corrida. Vive en this.registry. */

import { GOODS, TOWNS, TOWN_IDS } from "./world.js";

export { GOODS, TOWNS } from "./world.js";

export const MAX_STOCK = 8;
export const MAX_DEMAND = 6;

export const UPGRADES = {
  stashKit: { id: "stashKit", name: "Herrajes de alijo", cost: 40, reputation: 3, effect: "abre los alijos de los caminos" },
  horse: { id: "horse", name: "Caballo de carga", cost: 90, reputation: 4, effect: "+2 carga · más rápido · salva piedras" },
  escort: { id: "escort", name: "Arquera escolta", cost: 150, reputation: 8, effect: "dispara a bandidos y bestias" },
  hideout: { id: "hideout", name: "Fondo falso", cost: 240, reputation: 14, effect: "oculta 2 piedras ante guardias" },
};

export const STASH_CAPACITY = 6;
export const STASH_RAID_HEAT = 60;
export const TONIC = { cost: 12, max: 3, heal: 4 };
export const BOAT_FARE = 15;

function townRecord(value) {
  return Object.fromEntries(TOWN_IDS.map((id) => [id, value]));
}

function cargoRecord() {
  return Object.fromEntries(Object.keys(GOODS).map((id) => [id, 0]));
}

export function freshRun() {
  return {
    gold: 40,
    cargo: cargoRecord(),
    baseCapacity: 4,
    reputation: 0,
    trips: 0,
    currentTown: "ashfen",
    heat: townRecord(0),
    stock: townRecord(MAX_STOCK),
    demand: townRecord(MAX_DEMAND),
    upgrades: { stashKit: false, horse: false, escort: false, hideout: false },
    // Vida en medios corazones.
    hp: 6,
    maxHp: 6,
    tonics: 0,
    // Alijos de los caminos: { id: { amber: 2, … } }
    stashes: {},
    flags: {},
    mapId: "ashfen",
  };
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
  return { ok: true, reason: "Un tónico de raíz. Con Q te lo tomas." };
}

export function drinkTonic(registry) {
  if (!tonics(registry) || hp(registry) >= maxHp(registry)) return false;
  registry.set("tonics", tonics(registry) - 1);
  heal(registry, TONIC.heal);
  return true;
}

// ---------- Alijos ----------

export function stashOf(registry, id) {
  return getRecord(registry, "stashes", {})[id] ?? {};
}

export function stashCount(registry, id) {
  return Object.values(stashOf(registry, id)).reduce((s, n) => s + n, 0);
}

/** Pasa una piedra entre la carga y el alijo. dir = +1 guarda, −1 saca. */
export function moveStash(registry, id, good, dir) {
  const st = { ...stashOf(registry, id) };
  const c = { ...cargo(registry) };
  if (dir > 0) {
    if (!(c[good] > 0) || stashCount(registry, id) >= STASH_CAPACITY) return false;
    c[good] -= 1;
    st[good] = (st[good] ?? 0) + 1;
  } else {
    if (!(st[good] > 0) || stones(registry) >= capacity(registry)) return false;
    st[good] -= 1;
    c[good] = (c[good] ?? 0) + 1;
  }
  registry.set("cargo", c);
  registry.set("stashes", { ...getRecord(registry, "stashes", {}), [id]: st });
  return true;
}

export function emptyStash(registry, id) {
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

// ---------- Banderas del mundo (cofres, rejas) ----------

export function flag(registry, id) {
  return Boolean(getRecord(registry, "flags", {})[id]);
}

export function setFlag(registry, id, value = true) {
  registry.set("flags", { ...getRecord(registry, "flags", {}), [id]: value });
}

// ---------- Guardado ----------

const SAVE_KEY = "stones-save-v3";
const SAVED = ["gold", "cargo", "baseCapacity", "reputation", "trips", "currentTown", "heat", "stock", "demand", "upgrades", "hp", "maxHp", "tonics", "stashes", "flags", "mapId"];

export function saveGame(registry) {
  try {
    const data = Object.fromEntries(SAVED.map((k) => [k, registry.get(k)]));
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function hasSave() {
  try {
    return Boolean(localStorage.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}

export function loadGame(registry) {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data) return false;
    registry.set({ ...freshRun(), ...data });
    return true;
  } catch {
    return false;
  }
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

export function resetRun(registry) {
  registry.set(freshRun());
}

export function ensureRun(registry) {
  if (registry.get("cargo") == null) resetRun(registry);
}

function getRecord(registry, key, fallback) {
  return registry.get(key) ?? fallback;
}

function setRecordValue(registry, key, id, value, fallback = {}) {
  registry.set(key, { ...getRecord(registry, key, fallback), [id]: value });
}

export function gold(registry) {
  return registry.get("gold") ?? 0;
}

export function reputation(registry) {
  return registry.get("reputation") ?? 0;
}

export function cargo(registry) {
  return getRecord(registry, "cargo", cargoRecord());
}

export function cargoOf(registry, goodId) {
  return cargo(registry)[goodId] ?? 0;
}

export function stones(registry) {
  return Object.values(cargo(registry)).reduce((sum, amount) => sum + amount, 0);
}

export function hasUpgrade(registry, id) {
  return Boolean(getRecord(registry, "upgrades", {})[id]);
}

export function capacity(registry) {
  return (registry.get("baseCapacity") ?? 4) + (hasUpgrade(registry, "horse") ? 2 : 0);
}

export function hiddenCapacity(registry) {
  return hasUpgrade(registry, "hideout") ? 2 : 0;
}

export function visibleStones(registry) {
  return Math.max(0, stones(registry) - hiddenCapacity(registry));
}

export function ambushProtection(registry) {
  return (hasUpgrade(registry, "horse") ? 1 : 0) + (hasUpgrade(registry, "escort") ? 1 : 0);
}

export function heat(registry, townId) {
  return getRecord(registry, "heat", townRecord(0))[townId] ?? 0;
}

export function routeHeat(registry, fromId, toId) {
  return Math.round((heat(registry, fromId) + heat(registry, toId)) / 2);
}

export function addHeat(registry, townId, amount) {
  setRecordValue(registry, "heat", townId, Math.min(100, Math.max(0, heat(registry, townId) + amount)));
}

export function stock(registry, townId) {
  return getRecord(registry, "stock", townRecord(MAX_STOCK))[townId] ?? MAX_STOCK;
}

export function demand(registry, townId) {
  return getRecord(registry, "demand", townRecord(MAX_DEMAND))[townId] ?? MAX_DEMAND;
}

export function marketQuote(registry, townId) {
  const town = TOWNS[townId];
  const localStock = stock(registry, townId);
  const localDemand = demand(registry, townId);
  const localHeat = heat(registry, townId);
  const buyPrice = town.buyBase + (MAX_STOCK - localStock) * 1 + Math.floor(localHeat / 30);
  const sellPrice = Math.max(
    Math.ceil(town.sellBase * 0.55),
    town.sellBase - (MAX_DEMAND - localDemand) * 2 - Math.floor(localHeat / 25),
  );
  return { town, produce: GOODS[town.produce], need: GOODS[town.need], stock: localStock, demand: localDemand, heat: localHeat, buyPrice, sellPrice };
}

export function canBuy(registry, townId) {
  const quote = marketQuote(registry, townId);
  return quote.stock > 0 && gold(registry) >= quote.buyPrice && stones(registry) < capacity(registry);
}

export function canSell(registry, townId) {
  const quote = marketQuote(registry, townId);
  return quote.demand > 0 && cargoOf(registry, quote.town.need) > 0;
}

export function buy(registry, townId) {
  if (!canBuy(registry, townId)) return null;
  const quote = marketQuote(registry, townId);
  registry.inc("gold", -quote.buyPrice);
  setRecordValue(registry, "cargo", quote.town.produce, cargoOf(registry, quote.town.produce) + 1, cargoRecord());
  setRecordValue(registry, "stock", townId, quote.stock - 1, townRecord(MAX_STOCK));
  addHeat(registry, townId, 1);
  return { good: quote.produce, price: quote.buyPrice };
}

export function sell(registry, townId) {
  if (!canSell(registry, townId)) return null;
  const quote = marketQuote(registry, townId);
  registry.inc("gold", quote.sellPrice);
  registry.inc("reputation", 1);
  setRecordValue(registry, "cargo", quote.town.need, cargoOf(registry, quote.town.need) - 1, cargoRecord());
  setRecordValue(registry, "demand", townId, quote.demand - 1, townRecord(MAX_DEMAND));
  addHeat(registry, townId, 5);
  return { good: quote.need, price: quote.sellPrice };
}

export function loseStones(registry, amount, visibleOnly = false) {
  let remaining = Math.min(amount, visibleOnly ? visibleStones(registry) : stones(registry));
  const next = { ...cargo(registry) };
  let lost = 0;
  for (const goodId of Object.keys(GOODS).reverse()) {
    if (remaining <= 0) break;
    const take = Math.min(next[goodId] ?? 0, remaining);
    next[goodId] -= take;
    remaining -= take;
    lost += take;
  }
  if (lost) registry.set("cargo", next);
  return lost;
}

export function pay(registry, amount) {
  if (gold(registry) < amount) return 0;
  registry.inc("gold", -amount);
  return amount;
}

export function purchaseUpgrade(registry, id) {
  const item = UPGRADES[id];
  if (!item) return { ok: false, reason: "Mejora desconocida." };
  if (hasUpgrade(registry, id)) return { ok: false, reason: `${item.name}: ya comprado.` };
  if (reputation(registry) < item.reputation) return { ok: false, reason: `${item.name}: requiere reputación ${item.reputation}.` };
  if (gold(registry) < item.cost) return { ok: false, reason: `${item.name}: faltan ${item.cost - gold(registry)} oro.` };
  registry.inc("gold", -item.cost);
  registry.set("upgrades", { ...getRecord(registry, "upgrades", {}), [id]: true });
  return { ok: true, reason: `${item.name} incorporado a la caravana.` };
}

export function advanceMarket(registry, fromId, toId) {
  registry.inc("trips", 1);
  registry.set("currentTown", toId);
  const nextStock = { ...getRecord(registry, "stock", townRecord(MAX_STOCK)) };
  const nextDemand = { ...getRecord(registry, "demand", townRecord(MAX_DEMAND)) };
  const nextHeat = { ...getRecord(registry, "heat", townRecord(0)) };
  for (const id of TOWN_IDS) {
    if (id !== fromId) nextStock[id] = Math.min(MAX_STOCK, (nextStock[id] ?? MAX_STOCK) + 2);
    if (id !== toId) nextDemand[id] = Math.min(MAX_DEMAND, (nextDemand[id] ?? MAX_DEMAND) + 2);
    const cooling = id === fromId || id === toId ? 1 : 8;
    nextHeat[id] = Math.max(0, (nextHeat[id] ?? 0) - cooling);
  }
  registry.set("stock", nextStock);
  registry.set("demand", nextDemand);
  registry.set("heat", nextHeat);
}

export function cargoSummary(registry) {
  const parts = Object.entries(cargo(registry))
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => `${GOODS[id].short} ${amount}`);
  return parts.length ? parts.join(" · ") : "vacía";
}

export function heatLabel(value) {
  if (value >= 70) return "CRÍTICO";
  if (value >= 45) return "ALTO";
  if (value >= 20) return "MEDIO";
  return "BAJO";
}

export function goalLine(registry, townId) {
  if (!townId) return stones(registry) ? "Piedras en el camino · el poste puede cortar" : "Vas sin piedras";
  const quote = marketQuote(registry, townId);
  if (canSell(registry, townId)) return `Q vende ${quote.need.short} por ${quote.sellPrice} · pedido ${quote.demand}/${MAX_DEMAND}`;
  if (stones(registry) >= capacity(registry)) return "Carga llena · salí por el arco y elegí destino";
  if (canBuy(registry, townId)) return `E compra ${quote.produce.short} por ${quote.buyPrice} · stock ${quote.stock}/${MAX_STOCK}`;
  if (cargoOf(registry, quote.town.need) && quote.demand <= 0) return "Pedido agotado · buscá otra ciudad";
  return "Revisá el mapa: esta ciudad no necesita tu carga";
}

export function arrivalLine(registry, townId) {
  const quote = marketQuote(registry, townId);
  const last = registry.get("lastEvent");
  const eventText = last === "seize"
    ? " La autoridad te cortó el paso."
    : last === "ambush"
      ? " El monte dejó marcas."
      : last === "checkpoint"
        ? " Un retén en el camino."
        : "";
  return `${quote.town.name}: produce ${quote.produce.short} y pide ${quote.need.short}.${eventText}`;
}
