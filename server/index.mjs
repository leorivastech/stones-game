/**
 * Servidor del modo en línea de Stones.
 *
 *   npm run online            # compila el juego y arranca en http://127.0.0.1:5190
 *   cloudflared tunnel --url http://127.0.0.1:5190   # enlace para jugar desde otro lado
 *
 * Sirve el juego compilado (dist/) y, en /net, la conexión en vivo (WebSocket) por el mismo puerto:
 * así basta un túnel. La voz también pasa por aquí (audio en pedacitos), así llega en cualquier red. Guarda el mundo en server/data/world.json.
 *
 * Variables: PORT (5190), DAY_SECONDS (180: un día del mundo cada 3 minutos), WORLD_FILE, DIST (carpeta del juego compilado).
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
const DAY_MS = Number(process.env.DAY_SECONDS ?? 180) * 1000;
const world = new World(process.env.WORLD_FILE ?? join(HERE, "data/world.json"), { dayMs: DAY_MS });

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
      const list = [...clients.values()].filter((c) => c.name).map((c) => ({
        name: c.name, map: c.map, audioSent: c.audioBytes ?? 0, voz: c.vstat ?? null,
      }));
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ day: world.s.econ.day, players: list }, null, 1));
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

/** El primero que llega a un mapa manda a sus enemigos; si se va, pasa al siguiente. */
function pickAuthority(map) {
  if (!map) return;
  const cur = authority.get(map);
  if (cur && clients.get(cur)?.map === map) return;
  const next = [...clients.values()].find((c) => c.map === map);
  if (next) authority.set(map, next.id); else authority.delete(map);
  if (next) send(next, { t: "auth", map, yes: true });
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
    // Mismo nombre otra vez (recargó la página): se reemplaza la conexión vieja.
    const old = byName(name);
    if (old && old !== c) { leaveMap(old); old.ws.close(); clients.delete(old.id); all({ t: "leave", id: old.id }); }
    c.name = name;
    const me = world.join(name);
    send(c, { t: "welcome", id: c.id, name, start: me.start, world: world.snapshot(), players: players().filter((p) => p.id !== c.id) });
    all({ t: "join", id: c.id, name }, c);
    news(`${name} llegó al golfo.`);
  },

  map(c, m) {
    if (c.map === m.map) return;
    leaveMap(c);
    c.map = m.map;
    send(c, { t: "mapState", ...world.mapState(m.map) });
    pickAuthority(m.map);
    all({ t: "where", id: c.id, map: m.map }, c);
    if (m.town) news(`${c.name} llegó a ${m.town}.`);
  },

  pos(c, m) {
    c.pos = m;
    all({ t: "pos", id: c.id, ...m }, c);
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
    all({ t: "talk", id: c.id, on: Boolean(m.on) }, c);
  },
  vstat(c, m) {
    c.vstat = { mic: m.mic, err: m.err, ctx: m.ctx, sent: m.sent, heard: m.heard, device: m.device, nivelUltimaVez: m.lastPeak, at: new Date().toISOString() };
  },
  rtc(c, m) {
    send(clients.get(m.to), { t: "rtc", from: c.id, data: m.data });
  },
  news(c, m) {
    news(String(m.text ?? "").slice(0, 160));
  },
};

wss.on("connection", (ws) => {
  const c = { ws, id: nextId++, name: null, map: null, pos: null };
  clients.set(c.id, c);
  ws.on("message", (raw, isBinary) => {
    // Voz: pedacitos de audio del que habla; se reparten a los demás con su número adelante.
    if (isBinary) {
      if (!c.name || raw.length > 32000) return;
      c.audioBytes = (c.audioBytes ?? 0) + raw.length;
      const out = Buffer.allocUnsafe(raw.length + 2);
      out.writeUInt16BE(c.id, 0);
      raw.copy(out, 2);
      for (const o of clients.values()) if (o !== c && o.name && o.ws.readyState === 1) o.ws.send(out, { binary: true });
      return;
    }
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.t !== "hello" && !c.name) return;
    try { HANDLERS[m.t]?.(c, m); } catch (err) { console.error("error en", m.t, err); }
  });
  ws.on("close", () => {
    if (clients.get(c.id) !== c) return;
    clients.delete(c.id);
    leaveMap(c);
    if (c.name) all({ t: "leave", id: c.id, name: c.name });
  });
});

// ---------------------------------------------------------------------- reloj del mundo

setInterval(() => {
  const r = world.nextDay();
  all({ t: "day", econ: world.s.econ, dayStartedAt: world.s.dayStartedAt, started: r.started });
  for (const item of r.news) all({ t: "news", item });
}, DAY_MS);

// Guardado del mundo cada pocos segundos (sólo si cambió).
setInterval(() => world.save(), 4000);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { world.save(); process.exit(0); });

http.listen(PORT, "127.0.0.1", () => {
  console.log(`Stones en línea: http://127.0.0.1:${PORT}/?online=1  ·  un día cada ${DAY_MS / 1000} s  ·  mundo en ${world.file}`);
});
