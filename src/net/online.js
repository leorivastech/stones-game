/**
 * Modo en línea (lado del juego). Se elige en el título ("En línea"), que recarga la página con
 * ?online=1&nombre=Leo (el enlace con esos parámetros también sirve de atajo). Sin eso, el juego es
 * el de un jugador y nada de este archivo hace nada.
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
  dayMs: 240000,
  dayStartedAt: Date.now(),
  /** Hora del servidor menos la de este aparato (ms): el reloj del mundo es el del servidor. */
  skew: 0,
  /** El avance guardado en el servidor para este nombre (llega en la bienvenida). */
  save: null,
  savedAt: 0,
  /** Veces que se ha conectado (1 = la primera). */
  joins: 0,
  /** id → { id, name, map, pos, talking } */
  players: new Map(),
  /** A quién sigue la flecha (nombre; se elige en la pausa → JUGADORES). */
  follow: null,
  /** Cuándo se perdió la conexión y cuándo es el siguiente intento (para el aviso grande). */
  lostAt: 0,
  retryAt: 0,
  ws: null,
};

const listeners = new Map();
const pending = new Map();
let seq = 1;
let welcomed = null;
/** Reintentos seguidos sin lograr conectar (para esperar cada vez más). */
let retries = 0;
let lastMsgAt = 0;
let watchdog = null;

/** La hora del servidor (ms): así el día y la noche son iguales en todos los aparatos. */
export function worldNow() {
  return Date.now() + online.skew;
}

/** Ajusta la diferencia de relojes con la hora que mandó el servidor (se queda con la menor demora). */
function syncClock(serverNow) {
  if (!Number.isFinite(serverNow)) return;
  const skew = serverNow - Date.now();
  // El mensaje tardó en llegar: la hora real del servidor es un poco mayor. Se sube rápido y se baja lento.
  online.skew = !online.skewSet || skew > online.skew ? skew : online.skew * 0.95 + skew * 0.05;
  online.skewSet = true;
}

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

/** Manda audio tal cual (la voz). Si la conexión va atorada, se tira: mejor perder un pedacito que atrasarse. */
export function sendAudio(buf) {
  const ws = online.ws;
  if (ws?.readyState === 1 && ws.bufferedAmount < 64000) ws.send(buf);
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
  reg.set("caravans", econ.caravans ?? []);
}

const CORE = {
  welcome(m) {
    online.id = m.id;
    online.name = m.name;
    online.start = m.start;
    Object.assign(online.world, m.world);
    online.dayMs = m.world.dayMs;
    online.dayStartedAt = m.world.dayStartedAt;
    syncClock(m.world.now);
    online.save = m.save ?? null;
    online.savedAt = m.savedAt ?? 0;
    applyEcon(m.world.econ);
    online.players = new Map(m.players.map((p) => [p.id, { ...p }]));
    online.connected = true;
    online.joins += 1;
    retries = 0;
    const first = online.joins === 1;
    welcomed?.(m);
    welcomed = null;
    if (!first) emit("reconnected", m);
  },
  clock(m) {
    online.ticks = true;
    syncClock(m.now);
    online.dayMs = m.dayMs;
    online.dayStartedAt = m.dayStartedAt;
  },
  res(m) {
    pending.get(m.req)?.(m);
    pending.delete(m.req);
  },
  econ(m) { online.world.econ = m.econ; applyEcon(m.econ); },
  day(m) {
    online.world.econ = m.econ;
    online.dayStartedAt = m.dayStartedAt;
    syncClock(m.now);
    applyEcon(m.econ);
  },
  flags(m) { online.world.flags = m.flags; },
  owners(m) { online.world.owners = m.owners; online.world.stashes = m.stashes; },
  stashes(m) { online.world.stashes = m.stashes; },
  hires(m) { online.world.hires = m.hires; },
  peddler(m) { online.world.peddlers = { ...online.world.peddlers, [m.p.route]: m.p }; },
  news(m) { online.world.news = [m.item, ...online.world.news].slice(0, 30); },
  join(m) {
    // Si vuelve con otra conexión, se quita la vieja (mismo nombre).
    for (const [id, p] of online.players) if (p.name === m.name && id !== m.id) online.players.delete(id);
    online.players.set(m.id, { id: m.id, name: m.name, map: null, pos: null });
  },
  leave(m) { online.players.delete(m.id); },
  where(m) { const p = online.players.get(m.id); if (p) { p.map = m.map; p.pos = null; } },
  // Al entrar a un mapa, el servidor dice quién está ahí y dónde (aunque esté quieto o en un menú).
  here(m) {
    for (const h of m.list ?? []) {
      const p = online.players.get(h.id) ?? { id: h.id, name: h.name };
      p.map = m.map;
      if (h.pos) p.pos = { ...h.pos, map: m.map };
      online.players.set(h.id, p);
    }
  },
  pos(m) {
    const p = online.players.get(m.id) ?? { id: m.id, name: "?" };
    p.map = m.map;
    p.pos = m;
    online.players.set(m.id, p);
  },
  talk(m) { const p = online.players.get(m.id); if (p) p.talking = m.on; },
};

/** Se conecta y espera la bienvenida. Si se cae, reintenta solo (cada vez espera más, hasta 8 s). */
export function connect(reg) {
  online.reg = reg;
  return new Promise((resolve) => {
    welcomed = resolve;
    open();
  });
}

const netUrl = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/net`;

function open() {
  const ws = new WebSocket(netUrl());
  ws.binaryType = "arraybuffer";
  online.ws = ws;
  lastMsgAt = Date.now();
  ws.onopen = () => send({ t: "hello", name: online.name, again: online.joins > 0 });
  ws.onmessage = (e) => {
    if (online.ws !== ws) return;
    lastMsgAt = Date.now();
    // Voz: llega como audio (número de quien habla + muestras).
    if (e.data instanceof ArrayBuffer) { emit("audio", e.data); return; }
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    CORE[m.t]?.(m);
    emit(m.t, m);
  };
  ws.onclose = () => lost(ws);
  ws.onerror = () => {};
  // El servidor manda la hora cada 2 s: si pasan 7 s sin nada, la conexión está muerta aunque el
  // navegador no se haya dado cuenta (celular que cambió de red, wifi caído): se cierra y se reintenta.
  clearInterval(watchdog);
  watchdog = setInterval(() => {
    if (online.ws !== ws) { clearInterval(watchdog); return; }
    // (Sólo con un servidor que manda la hora: uno viejo no la manda y no hay que cortarlo.)
    if (online.ticks && Date.now() - lastMsgAt > 7000) { try { ws.close(); } catch { /* ya cerrada */ } lost(ws); }
  }, 1000);
}

/** Se perdió la conexión `ws` (una sola vez por conexión): aviso y reintento con espera creciente. */
function lost(ws) {
  if (online.ws !== ws) return;
  online.ws = null;
  ws.onmessage = null;
  ws.onclose = null;
  clearInterval(watchdog);
  const was = online.connected;
  online.connected = false;
  if (was) online.lostAt = Date.now();
  for (const fn of pending.values()) fn({ ok: false, offline: true });
  pending.clear();
  if (was) emit("offline", {});
  retries += 1;
  const wait = Math.min(8000, 500 * 2 ** Math.min(retries, 4));
  online.retryAt = Date.now() + wait;
  setTimeout(open, wait);
}

/**
 * ¿Contesta el servidor del modo en línea? Abre una conexión de prueba y la cierra. Para el título,
 * antes de recargar la página en modo en línea.
 */
export function probeServer(timeout = 4000) {
  return new Promise((resolve) => {
    let ws;
    let done = false;
    const end = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws?.close(); } catch { /* nada */ }
      resolve(ok);
    };
    const timer = setTimeout(() => end(false), timeout);
    try {
      ws = new WebSocket(netUrl());
      ws.onopen = () => end(true);
      ws.onerror = () => end(false);
      ws.onclose = () => end(false);
    } catch {
      end(false);
    }
  });
}

/** Adónde lleva la página en un modo u otro (se quedan los demás parámetros, como ?touch=1). */
export function modeUrl(on, name) {
  const p = new URLSearchParams(location.search);
  p.delete("online");
  p.delete("nombre");
  p.delete("name");
  if (on) {
    p.set("online", "1");
    if (name) p.set("nombre", name);
  }
  const q = p.toString();
  return `${location.pathname}${q ? `?${q}` : ""}${location.hash}`;
}

// ---------------------------------------------------------------------- avance en el servidor

let saveTimer = null;
let saveData = null;
let lastSent = "";

/**
 * Manda el avance del jugador al servidor (con una espera corta: muchos guardados seguidos salen en
 * uno). `now`: sin esperar (al cerrar la página, al volver la conexión).
 */
export function pushSave(data, { now = false } = {}) {
  if (!online.on) return;
  saveData = data;
  clearTimeout(saveTimer);
  const go = () => {
    saveTimer = null;
    if (!saveData || !online.connected) return;
    const body = JSON.stringify({ ...saveData, savedAt: 0 });
    if (body === lastSent) return;
    lastSent = body;
    const at = saveData.savedAt ?? Date.now();
    online.save = saveData;
    online.savedAt = at;
    send({ t: "save", data: saveData, at });
  };
  if (now) go(); else saveTimer = setTimeout(go, 1200);
}

/** Manda ya lo que esté esperando (al cerrar o esconder la página). */
export function flushSave() {
  if (saveTimer) pushSave(saveData, { now: true });
}

/** Si la conexión volvió, el último avance se manda otra vez (el servidor pudo no recibirlo). */
export function resendSave() {
  lastSent = "";
  if (saveData) pushSave(saveData, { now: true });
}

/** Qué tanto va del día del mundo (0-1). El día empieza a medianoche. */
export function dayProgress() {
  return Math.min(0.9999, Math.max(0, (worldNow() - online.dayStartedAt) / online.dayMs));
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
