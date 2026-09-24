/**
 * Modo en línea (lado del juego). Se prende con ?online=1 (y ?nombre=Leo). Sin eso, el juego es el
 * de un jugador y nada de este archivo hace nada.
 *
 * Aquí sólo vive la conexión y el espejo del mundo que manda el servidor (server/index.mjs):
 * mercado y reloj, banderas del mundo, dueños de refugios, estantes, arquera, buhonero, noticias
 * y quién está conectado. state.js y las escenas lo consultan; no conoce Phaser.
 */

const params = new URLSearchParams(typeof location === "undefined" ? "" : location.search);

export const online = {
  on: params.has("online"),
  connected: false,
  id: null,
  name: (params.get("nombre") ?? params.get("name") ?? "").trim().slice(0, 16) || null,
  start: null,
  /** registry de Phaser: el servidor escribe ahí el mercado y el día. */
  reg: null,
  world: { flags: {}, owners: {}, stashes: {}, hires: {}, peddlers: {}, news: [] },
  dayMs: 180000,
  dayStartedAt: Date.now(),
  /** id → { id, name, map, pos, talking } */
  players: new Map(),
  ws: null,
};

const listeners = new Map();
const pending = new Map();
let seq = 1;
let welcomed = null;

/** Escucha un tipo de mensaje del servidor. Devuelve la función para dejar de escuchar. */
export function onNet(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => listeners.get(type)?.delete(fn);
}

function emit(type, msg) {
  for (const fn of listeners.get(type) ?? []) {
    try { fn(msg); } catch (err) { console.error("[net]", type, err); }
  }
}

export function send(msg) {
  if (online.ws?.readyState === 1) online.ws.send(JSON.stringify(msg));
}

/** Pide algo al servidor y espera su respuesta ({ ok, … }). Sin conexión, responde { ok: false }. */
export function request(msg, timeout = 4000) {
  if (online.ws?.readyState !== 1) return Promise.resolve({ ok: false, offline: true });
  const req = seq++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => { pending.delete(req); resolve({ ok: false, timeout: true }); }, timeout);
    pending.set(req, (res) => { clearTimeout(timer); resolve(res); });
    send({ ...msg, req });
  });
}

/** El mercado y el día del mundo pasan al registry: el juego los lee de ahí como siempre. */
function applyEcon(econ) {
  const reg = online.reg;
  if (!reg || !econ) return;
  reg.set("day", econ.day);
  reg.set("market", econ.market);
  reg.set("drift", econ.drift);
  reg.set("mods", econ.mods);
  reg.set("heat", econ.heat);
}

const CORE = {
  welcome(m) {
    online.id = m.id;
    online.name = m.name;
    online.start = m.start;
    Object.assign(online.world, m.world);
    online.dayMs = m.world.dayMs;
    online.dayStartedAt = m.world.dayStartedAt;
    applyEcon(m.world.econ);
    online.players = new Map(m.players.map((p) => [p.id, { ...p }]));
    online.connected = true;
    welcomed?.(m);
    welcomed = null;
  },
  res(m) {
    pending.get(m.req)?.(m);
    pending.delete(m.req);
  },
  econ(m) { online.world.econ = m.econ; applyEcon(m.econ); },
  day(m) {
    online.world.econ = m.econ;
    online.dayStartedAt = m.dayStartedAt;
    applyEcon(m.econ);
  },
  flags(m) { online.world.flags = m.flags; },
  owners(m) { online.world.owners = m.owners; online.world.stashes = m.stashes; },
  stashes(m) { online.world.stashes = m.stashes; },
  hires(m) { online.world.hires = m.hires; },
  peddler(m) { online.world.peddlers = { ...online.world.peddlers, [m.p.route]: m.p }; },
  news(m) { online.world.news = [m.item, ...online.world.news].slice(0, 30); },
  join(m) { online.players.set(m.id, { id: m.id, name: m.name, map: null, pos: null }); },
  leave(m) { online.players.delete(m.id); },
  where(m) { const p = online.players.get(m.id); if (p) p.map = m.map; },
  pos(m) {
    const p = online.players.get(m.id) ?? { id: m.id, name: "?" };
    p.map = m.map;
    p.pos = m;
    online.players.set(m.id, p);
  },
  talk(m) { const p = online.players.get(m.id); if (p) p.talking = m.on; },
};

/** Se conecta y espera la bienvenida. Si se cae, reintenta solo. */
export function connect(reg) {
  online.reg = reg;
  return new Promise((resolve) => {
    welcomed = resolve;
    open();
  });
}

function open() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/net`);
  online.ws = ws;
  ws.onopen = () => send({ t: "hello", name: online.name });
  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    CORE[m.t]?.(m);
    emit(m.t, m);
  };
  ws.onclose = () => {
    const was = online.connected;
    online.connected = false;
    if (was) emit("offline", {});
    setTimeout(() => {
      open();
      // Al volver, se vuelve a avisar en qué mapa andas.
      welcomed = () => emit("reconnected", {});
    }, 2500);
  };
}

/** Qué tanto falta para el siguiente día del mundo (0-1). */
export function dayProgress() {
  return Math.min(1, (Date.now() - online.dayStartedAt) / online.dayMs);
}

/** Los que andan en un mapa (menos yo). */
export function playersIn(map) {
  return [...online.players.values()].filter((p) => p.map === map && p.id !== online.id && p.name);
}

/** Banderas que son del mundo (las mismas para todos): cofres, palancas y rejas. */
export function isWorldFlag(key) {
  return /^(chest-|gate-|lever-)/.test(key);
}

export function ownerOf(id) {
  return online.world.owners[id]?.owner ?? null;
}

export function canUse(id) {
  const o = online.world.owners[id];
  return Boolean(o && (o.owner === online.name || o.invited.includes(online.name)));
}
