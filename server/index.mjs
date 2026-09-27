/**
 * Servidor del modo en línea de Stones.
 *
 *   npm run online            # compila el juego y arranca en http://127.0.0.1:5190
 *   cloudflared tunnel --url http://127.0.0.1:5190   # enlace para jugar desde otro lado
 *
 * Sirve el juego compilado (dist/) y, en /net, la conexión en vivo (WebSocket) por el mismo puerto:
 * así basta un túnel. La voz también pasa por aquí (audio en pedacitos), así llega en cualquier red. Guarda el mundo en server/data/world.json.
 *
 * Variables: PORT (5190), DAY_SECONDS (240: un día del mundo cada 4 minutos, igual que jugando solo), WORLD_FILE, DIST (carpeta del juego compilado).
 *
 * El avance de cada jugador (oro, carga, fama, deuda, mejoras, contratos…) también se guarda aquí, por
 * nombre, dentro del mismo world.json: se sigue desde cualquier aparato.
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { World } from "./world.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const DIST = resolve(process.env.DIST ?? join(HERE, "../dist"));
const PORT = Number(process.env.PORT ?? 5190);
const DAY_MS = Number(process.env.DAY_SECONDS ?? 240) * 1000;
/** Sin respuesta en este tiempo, la conexión se da por muerta y el jugador desaparece para los demás. */
const DEAD_MS = 8000;
/** Si el que manda un mapa deja de moverse (pestaña escondida, celular bloqueado), manda otro. */
const STALE_MS = 3000;
const world = new World(process.env.WORLD_FILE ?? join(HERE, "data/world.json"), { dayMs: DAY_MS });

/**
 * Bitácora corta de lo que pasa (entra, sale, cambia de mapa, se corta): va a la consola y a /estado.
 * Así, si alguien dice "ya no nos veíamos", se ve si fue la conexión, el mapa o el juego.
 */
const events = [];
function logEvent(text) {
  const at = new Date();
  const hhmmss = at.toTimeString().slice(0, 8);
  events.unshift(`${hhmmss} ${text}`);
  events.length = Math.min(events.length, 60);
  console.log(`[${hhmmss}] ${text}`);
}

// ---------------------------------------------------------------------- archivos del juego

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".md": "text/plain; charset=utf-8",
};

const http = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    // Estado para revisar desde afuera: quién está, dónde, y cómo va su micrófono.
    if (url.pathname === "/estado") {
      const now = Date.now();
      const list = [...clients.values()].filter((c) => c.name).map((c) => ({
        name: c.name, id: c.id, map: c.map, pos: c.pos ? [c.pos.x, c.pos.y] : null,
        // Hace cuánto mandó su posición (s): mucho = pestaña escondida, celular bloqueado o juego trabado.
        posHace: c.posAt ? Math.round((now - c.posAt) / 100) / 10 : null,
        conectadoHace: Math.round((now - c.since) / 1000), habla: Boolean(c.talking),
        audioSent: c.audioBytes ?? 0, audioRecibido: c.audioOut ?? 0, voz: c.vstat ?? null,
      }));
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ day: world.s.econ.day, hour: Math.round(world.hour() * 10) / 10, players: list, mandan: Object.fromEntries(authority), eventos: events }, null, 1));
      return;
    }
    let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
    if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
    const info = await stat(file).catch(() => null);
    if (!info || info.isDirectory()) file = join(DIST, "index.html");
    const body = await readFile(file);
    const html = file.endsWith(".html");
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": html ? "no-cache" : "public, max-age=3600" });
    res.end(body);
  } catch {
    res.writeHead(404).end("No está compilado el juego: corre  npm run online");
  }
});

// ---------------------------------------------------------------------- conexión en vivo

const wss = new WebSocketServer({ server: http, path: "/net" });
/** id → { ws, id, name, map, pos } */
const clients = new Map();
/** mapa → id del jugador que "manda" a los enemigos de ese mapa */
const authority = new Map();
let nextId = 1;

const send = (c, msg) => { if (c?.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); };
const all = (msg, except) => { for (const c of clients.values()) if (c !== except) send(c, msg); };
const inMap = (map, msg, except) => { for (const c of clients.values()) if (c.map === map && c !== except) send(c, msg); };
const byName = (name) => [...clients.values()].find((c) => c.name === name);

function news(text) {
  if (!text) return;
  all({ t: "news", item: world.addNews(text) });
}

function players() {
  return [...clients.values()].filter((c) => c.name).map((c) => ({ id: c.id, name: c.name, map: c.map, pos: c.pos }));
}

/**
 * El primero que llega a un mapa manda a sus enemigos; si se va (o deja de moverse), pasa al que
 * siga ahí. Al que deja de mandar se le avisa (`yes: false`): sus enemigos vuelven a ser títeres.
 */
function pickAuthority(map, { skip = null } = {}) {
  if (!map) return;
  const cur = authority.get(map);
  if (cur && cur !== skip && clients.get(cur)?.map === map) return;
  const here = [...clients.values()].filter((c) => c.map === map && c.name && c.id !== skip);
  // Mejor uno que se esté moviendo (que mande posiciones) que uno con la pestaña escondida.
  const now = Date.now();
  const next = here.find((c) => now - (c.posAt ?? 0) < STALE_MS) ?? (skip ? null : here[0]);
  if (!next) { if (!skip) authority.delete(map); return; }
  if (cur && cur !== next.id) send(clients.get(cur), { t: "auth", map, yes: false });
  authority.set(map, next.id);
  send(next, { t: "auth", map, yes: true });
  if (process.env.STONES_TEST) console.log(`[mando] ${map}: ${next.name} (${next.id})${cur ? ` en lugar de ${cur}` : ""}`);
}

function leaveMap(c) {
  const old = c.map;
  c.map = null;
  if (old && authority.get(old) === c.id) { authority.delete(old); pickAuthority(old); }
}

const econMsg = () => ({ t: "econ", econ: world.s.econ });

const HANDLERS = {
  hello(c, m) {
    const name = String(m.name ?? "").trim().slice(0, 16) || `Viajero${c.id}`;
    // Mismo nombre otra vez (recargó la página o volvió la conexión): se reemplaza la conexión vieja.
    const old = byName(name);
    const back = Boolean(old && old !== c) || Boolean(m.again);
    if (old && old !== c) { old.replaced = true; leaveMap(old); old.ws.terminate(); clients.delete(old.id); all({ t: "leave", id: old.id }); }
    c.name = name;
    logEvent(`${name} ${back ? "volvió" : "entró"} (id ${c.id}${old && old !== c ? `, reemplaza a ${old.id}` : ""})`);
    const me = world.join(name);
    send(c, {
      t: "welcome", id: c.id, name, start: me.start, world: world.snapshot(), players: players().filter((p) => p.id !== c.id),
      save: me.save ?? null, savedAt: me.savedAt ?? 0,
    });
    all({ t: "join", id: c.id, name, back }, c);
    if (!back) news(`${name} llegó al golfo.`);
  },

  map(c, m) {
    if (c.map === m.map) {
      // Volvió a avisar (reconexión): se le repite lo del mapa y quién manda.
      send(c, { t: "mapState", ...world.mapState(m.map) });
      send(c, { t: "auth", map: m.map, yes: authority.get(m.map) === c.id });
      return;
    }
    const from = c.map;
    leaveMap(c);
    c.map = m.map;
    c.posAt = Date.now();
    logEvent(`${c.name}: ${from ?? "—"} → ${m.map}`);
    send(c, { t: "mapState", ...world.mapState(m.map) });
    // Quién está ya en este mapa y dónde: se ven de inmediato aunque el otro esté quieto o en un menú.
    const here = [...clients.values()].filter((o) => o !== c && o.name && o.map === m.map)
      .map((o) => ({ id: o.id, name: o.name, pos: o.pos ?? null }));
    if (here.length) send(c, { t: "here", map: m.map, list: here });
    pickAuthority(m.map);
    if (authority.get(m.map) !== c.id) send(c, { t: "auth", map: m.map, yes: false });
    all({ t: "where", id: c.id, map: m.map }, c);
    if (m.town) news(`${c.name} llegó a ${m.town}.`);
  },

  pos(c, m) {
    c.pos = m;
    c.posAt = Date.now();
    all({ t: "pos", id: c.id, ...m }, c);
  },

  // --- Avance del jugador: se guarda por nombre; al entrar vuelve en la bienvenida.
  save(c, m) {
    const ok = world.savePlayer(c.name, m.data, m.at);
    if (m.req) send(c, { t: "res", req: m.req, ok });
  },
  resetSave(c, m) {
    world.resetPlayer(c.name);
    send(c, { t: "res", req: m.req, ok: true });
  },

  trade(c, m) {
    const r = world.trade(c.name, m);
    send(c, { t: "res", req: m.req, ...r });
    if (r.ok) all(econMsg());
  },

  sold(c, m) {
    news(World.saleNews(c.name, m.town, m.sold ?? {}));
  },

  heat(c, m) {
    world.heat(m.town, Number(m.n) || 0);
    all(econMsg());
  },

  claim(c, m) {
    const ok = world.claim(m.key);
    send(c, { t: "res", req: m.req, ok });
    if (ok) {
      all({ t: "flags", flags: world.s.flags });
      if (m.news) news(`${c.name} ${m.news}`);
    }
  },

  own(c, m) {
    const ok = world.own(c.name, m.id);
    send(c, { t: "res", req: m.req, ok, owner: world.s.owners[m.id]?.owner });
    if (ok) { all({ t: "owners", owners: world.s.owners, stashes: world.s.stashes }); if (m.news) news(`${c.name} ${m.news}`); }
  },

  invite(c, m) {
    const ok = world.invite(c.name, m.id, m.who, m.on);
    send(c, { t: "res", req: m.req, ok });
    if (ok) {
      all({ t: "owners", owners: world.s.owners, stashes: world.s.stashes });
      send(byName(m.who), { t: "invited", id: m.id, from: c.name, on: m.on });
    }
  },

  upgrade(c, m) {
    const ok = world.upgrade(c.name, m.id, m.up);
    send(c, { t: "res", req: m.req, ok });
    if (ok) all({ t: "owners", owners: world.s.owners, stashes: world.s.stashes });
  },

  stash(c, m) {
    const r = world.stash(c.name, m);
    send(c, { t: "res", req: m.req, ...r });
    if (r.ok) all({ t: "stashes", stashes: world.s.stashes });
  },

  raid(c, m) {
    const lost = world.raid(m.id);
    if (lost) {
      all({ t: "stashes", stashes: world.s.stashes });
      news(`La Corona hizo una redada en un refugio del camino (${lost} piedras).`);
    }
  },

  hire(c, m) {
    const ok = world.hire(c.name, m.who);
    send(c, { t: "res", req: m.req, ok, by: world.s.hires[m.who] });
    if (ok) { all({ t: "hires", hires: world.s.hires }); news(`${c.name} contrató a Sahra, la arquera.`); }
  },

  peddler(c, m) {
    const r = m.op === "get" ? { ok: true, p: world.peddler(m.route) } : world.peddlerOp(m.route, m.op, m.spot);
    send(c, { t: "res", req: m.req, ...r });
    if (r.ok && m.op !== "get") all({ t: "peddler", p: world.s.peddlers[m.route] }, c);
  },

  // --- Enemigos: el que manda cuenta dónde están; los golpes de los demás le llegan a él.
  esnap(c, m) {
    if (authority.get(m.map) !== c.id) return;
    inMap(m.map, { t: "esnap", map: m.map, list: m.list }, c);
  },
  ehit(c, m) {
    send(clients.get(authority.get(m.map)), { ...m, t: "ehit", from: c.id });
  },
  eact(c, m) {
    send(clients.get(authority.get(m.map)), { ...m, t: "eact", from: c.id });
  },
  edie(c, m) {
    world.enemyDead(m.map, m.id);
    inMap(m.map, { t: "edie", map: m.map, id: m.id }, c);
  },
  // Matones del Gremio: los pide el deudor; los crea y los mueve el que manda el mapa (todos los ven).
  thugs(c, m) {
    send(clients.get(authority.get(m.map)), { ...m, t: "thugs", for: c.id, name: c.name });
  },
  thugsGone(c, m) {
    send(clients.get(authority.get(m.map)), { t: "thugsGone", map: m.map, for: c.id });
  },
  pdmg(c, m) {
    send(clients.get(m.to), { ...m, t: "pdmg", from: c.id });
  },
  inspect(c, m) {
    send(clients.get(m.to), { ...m, t: "inspect", from: c.id });
  },

  // --- Arbustos y piedras tiradas: iguales para todos.
  cut(c, m) {
    world.cut(m.map, m.key);
    inMap(m.map, { t: "cut", map: m.map, key: m.key }, c);
  },
  pickAdd(c, m) {
    world.addPickup(m.map, m.p);
    inMap(m.map, { t: "pickAdd", map: m.map, p: m.p }, c);
  },
  pickTake(c, m) {
    const ok = world.takePickup(m.map, m.id);
    send(c, { t: "res", req: m.req, ok });
    if (ok) inMap(m.map, { t: "pickDel", map: m.map, id: m.id }, c);
  },

  // --- Voz, chat y avisos.
  chat(c, m) {
    const text = String(m.text ?? "").slice(0, 140);
    if (text) all({ t: "chat", id: c.id, name: c.name, text });
  },
  talk(c, m) {
    c.talking = Boolean(m.on);
    all({ t: "talk", id: c.id, on: Boolean(m.on) }, c);
  },
  // Cómo va la voz de ese aparato (ver src/net/voice.js report()): se ve tal cual en /estado.
  vstat(c, m) {
    const pick = {};
    for (const k of ["mic", "err", "ctx", "rate", "micRate", "micOpen", "sent", "heard", "rx", "played", "dropped", "outPeak", "needTap", "session", "device", "ios", "ogg"]) {
      const v = m[k];
      if (v == null || typeof v === "number" || typeof v === "boolean") pick[k] = v;
      else if (typeof v === "string") pick[k] = v.slice(0, 80);
      else if (k === "heard" && typeof v === "object") pick[k] = Object.fromEntries(Object.entries(v).slice(0, 16).map(([a, b]) => [String(a).slice(0, 6), Number(b) || 0]));
    }
    // Nombres claros para leer /estado: lo que llegó, lo que sonó y lo que se tiró por audio dormido.
    // outPeak: qué tan fuerte sonó aquí la última voz que llegó (casi 0 = llega pero no se oye).
    const { outPeak, ...rest } = pick;
    c.vstat = { ...rest, nivelOidoUltimaVez: outPeak ?? null, nivelUltimaVez: m.lastPeak ?? null, at: new Date().toISOString() };
  },
  rtc(c, m) {
    send(clients.get(m.to), { t: "rtc", from: c.id, data: m.data });
  },
  news(c, m) {
    news(String(m.text ?? "").slice(0, 160));
  },
  // Sólo para pruebas (STONES_TEST=1): poner la hora del mundo.
  testHour(c, m) {
    if (!process.env.STONES_TEST || !Number.isFinite(m.h)) return;
    world.s.dayStartedAt = Date.now() - (Math.min(23.99, Math.max(0, m.h)) / 24) * DAY_MS;
    lastHour = world.hour();
    all(clockMsg());
  },
};

wss.on("connection", (ws) => {
  const c = { ws, id: nextId++, name: null, map: null, pos: null, seen: Date.now(), since: Date.now() };
  clients.set(c.id, c);
  ws.on("pong", () => { c.seen = Date.now(); });
  ws.on("message", (raw, isBinary) => {
    c.seen = Date.now();
    // Voz: pedacitos de audio del que habla; se reparten a los demás con su número adelante.
    if (isBinary) {
      if (!c.name || raw.length > 32000) return;
      c.audioBytes = (c.audioBytes ?? 0) + raw.length;
      const out = Buffer.allocUnsafe(raw.length + 2);
      out.writeUInt16BE(c.id, 0);
      raw.copy(out, 2);
      for (const o of clients.values()) {
        if (o === c || !o.name || o.ws.readyState !== 1) continue;
        o.audioOut = (o.audioOut ?? 0) + raw.length;
        o.ws.send(out, { binary: true });
      }
      return;
    }
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.t !== "hello" && !c.name) return;
    try { HANDLERS[m.t]?.(c, m); } catch (err) { console.error("error en", m.t, err); }
  });
  ws.on("close", (code) => {
    if (clients.get(c.id) !== c) return;
    clients.delete(c.id);
    if (c.name) logEvent(`${c.name} se fue (${c.dead ? "sin respuesta 8 s" : `cerró, código ${code}`}) en ${c.map ?? "—"}`);
    leaveMap(c);
    if (c.name) all({ t: "leave", id: c.id, name: c.name });
  });
});

// ---------------------------------------------------------------------- reloj del mundo

const clockMsg = () => ({ t: "clock", now: Date.now(), dayStartedAt: world.s.dayStartedAt, dayMs: DAY_MS, day: world.s.econ.day });
let lastHour = world.hour();

// Cada segundo: medianoche (día nuevo), mediodía (vuelven los de la noche), conexiones muertas y
// quién manda cada mapa. Cada 2 s, la hora del servidor a todos (sirve también de "sigo aquí").
let tick = 0;
setInterval(() => {
  tick += 1;
  if (Date.now() - world.s.dayStartedAt >= DAY_MS) {
    const r = world.nextDay();
    all({ t: "day", econ: world.s.econ, dayStartedAt: world.s.dayStartedAt, started: r.started, now: Date.now() });
    for (const item of r.news) all({ t: "news", item });
    lastHour = 0;
  }
  const h = world.hour();
  if (lastHour < 12 && h >= 12) world.clearNightDead();
  lastHour = h;
  const now = Date.now();
  for (const c of clients.values()) {
    // Sin respuesta (ni mensajes ni pong) en 8 s: se cierra y los demás dejan de verlo.
    if (now - c.seen > DEAD_MS) { c.dead = true; c.ws.terminate(); continue; }
    if (c.ws.readyState === 1) c.ws.ping();
  }
  for (const [map, id] of authority) {
    const c = clients.get(id);
    if (c && now - (c.posAt ?? 0) > STALE_MS) pickAuthority(map, { skip: id });
  }
  if (tick % 2 === 0) all(clockMsg());
}, 1000);

// Guardado del mundo cada pocos segundos (sólo si cambió).
setInterval(() => world.save(), 4000);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { world.save(); process.exit(0); });

http.listen(PORT, "127.0.0.1", () => {
  console.log(`Stones en línea: http://127.0.0.1:${PORT}/ (en el título: "En línea")  ·  un día cada ${DAY_MS / 1000} s  ·  mundo en ${world.file}`);
});
