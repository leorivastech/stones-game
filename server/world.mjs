/**
 * El mundo compartido del modo en línea. Todo lo que es "del mundo" vive aquí y no en el navegador:
 * mercado y reloj, calor de la Corona, cofres/rejas/palancas, dueños de refugios y alijos (con sus
 * invitados, mejoras y estante), la arquera, el buhonero de cada ruta, enemigos muertos del día,
 * arbustos cortados y piedras tiradas.
 *
 * Lo personal (oro, carga, vida, deuda, fama, yegua) se queda en el aparato de cada jugador.
 * La lógica del mercado es la misma del juego (src/economy.js, src/director.js).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { freshEconomy, stepDay, quote, takeFromMarket, giveToMarket, meltAfter, mixChill, STONE, GOOD_IDS } from "../src/economy.js";
import { rollDay, caravanNews } from "../src/director.js";
import { GOODS, TOWNS } from "../src/world.js";
import { PEDDLER, REFUGES, STASH_CAPACITY } from "../src/state.js";

/** Dónde empieza cada jugador nuevo, por turnos: lejos uno del otro. */
export const STARTS = ["ashfen", "duneshade"];

const plural = (n, g) => `${n} ${GOODS[g].short.toLowerCase()}`;

export class World {
  constructor(file, { dayMs }) {
    this.file = file;
    this.dayMs = dayMs;
    this.s = this.load() ?? World.fresh();
    this.dirty = false;
  }

  static fresh() {
    return {
      version: 1,
      econ: freshEconomy(),
      dayStartedAt: Date.now(),
      flags: {},
      owners: {},
      stashes: {},
      hires: {},
      peddlers: {},
      dead: {},
      cut: {},
      pickups: {},
      players: {},
      news: [],
    };
  }

  load() {
    try {
      if (!existsSync(this.file)) return null;
      const s = JSON.parse(readFileSync(this.file, "utf8"));
      // Pueblos agregados después de guardar el mundo.
      const fresh = freshEconomy();
      s.econ.market = { ...fresh.market, ...s.econ.market };
      s.econ.drift = { ...fresh.drift, ...s.econ.drift };
      s.econ.heat = { ...fresh.heat, ...s.econ.heat };
      s.econ.caravans ??= [];
      return { ...World.fresh(), ...s, dayStartedAt: Date.now() };
    } catch {
      return null;
    }
  }

  save() {
    if (!this.dirty) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.s));
    this.dirty = false;
  }

  touch() {
    this.dirty = true;
  }

  // ------------------------------------------------------------------ jugadores

  /** Un jugador entra: si es nuevo, le toca el siguiente pueblo de arranque. */
  join(name) {
    if (!this.s.players[name]) {
      const n = Object.keys(this.s.players).length;
      this.s.players[name] = { start: STARTS[n % STARTS.length], joined: Date.now() };
      this.touch();
    }
    return this.s.players[name];
  }

  snapshot() {
    const { econ, flags, owners, stashes, hires, peddlers, news } = this.s;
    return { econ, flags, owners, stashes, hires, peddlers, news: news.slice(0, 12), dayMs: this.dayMs, dayStartedAt: this.s.dayStartedAt };
  }

  mapState(map) {
    return { map, dead: this.s.dead[map] ?? [], cut: this.s.cut[map] ?? [], pickups: Object.values(this.s.pickups[map] ?? {}) };
  }

  addNews(text) {
    const item = { day: this.s.econ.day, text, at: Date.now() };
    this.s.news = [item, ...this.s.news].slice(0, 30);
    this.touch();
    return item;
  }

  // ------------------------------------------------------------------ reloj

  /**
   * Un día del mundo: el mercado se mueve (con los mercaderes de a pie: stepDay los hace andar), los
   * sucesos tiran dados, reaparece lo del camino.
   */
  nextDay() {
    const e = this.s.econ;
    const ended = stepDay(e);
    const caravans = (e.caravans ?? []).filter((c) => c.day === e.day);
    const started = rollDay(e);
    this.s.dayStartedAt = Date.now();
    // Enemigos, arbustos, monedas y corazones sueltos vuelven con el día. Las piedras tiradas se quedan.
    this.s.dead = {};
    this.s.cut = {};
    for (const [map, list] of Object.entries(this.s.pickups)) {
      for (const [id, p] of Object.entries(list)) if (p.kind !== "stone") delete list[id];
      if (!Object.keys(list).length) delete this.s.pickups[map];
    }
    // La escarcha guardada fuera del frío se derrite.
    for (const st of Object.values(this.s.stashes)) {
      if (!st.frost || st.cold) continue;
      const next = meltAfter(st.chill ?? 100, 1);
      if (next <= 0) { st.frost = 0; st.chill = 100; } else st.chill = next;
    }
    const news = [...started.map((ev) => this.addNews(ev.news)), ...caravans.map((c) => this.addNews(caravanNews(c)))];
    this.touch();
    return { ended, started: started.map((ev) => ev.id), news };
  }

  // ------------------------------------------------------------------ mercado

  trade(name, { town, good, side }) {
    const e = this.s.econ;
    if (!TOWNS[town] || !STONE[good]) return { ok: false };
    const q = quote(e, town, good);
    if (side === "buy") {
      if (q.stock < 1) return { ok: false, why: "Ya no hay" };
      takeFromMarket(e, town, good);
      e.heat[town] = Math.min(100, (e.heat[town] ?? 0) + 1);
    } else {
      giveToMarket(e, town, good);
      e.heat[town] = Math.min(100, (e.heat[town] ?? 0) + STONE[good].sellHeat);
    }
    this.touch();
    return { ok: true, price: side === "buy" ? q.buy : q.sell };
  }

  heat(town, n) {
    const e = this.s.econ;
    if (!TOWNS[town]) return;
    e.heat[town] = Math.max(0, Math.min(100, (e.heat[town] ?? 0) + n));
    this.touch();
  }

  // ------------------------------------------------------------------ cosas del mundo

  /** Cofres, palancas y rejas: el primero se lo lleva. */
  claim(key) {
    if (this.s.flags[key]) return false;
    this.s.flags[key] = true;
    this.touch();
    return true;
  }

  canUse(name, id) {
    const o = this.s.owners[id];
    return Boolean(o && (o.owner === name || o.invited.includes(name)));
  }

  /** Refugio o alijo: "ya lo agarré yo". */
  own(name, id) {
    if (this.s.owners[id]) return false;
    this.s.owners[id] = { owner: name, invited: [], ups: {} };
    if (REFUGES[id]?.cold) this.s.stashes[id] = { ...(this.s.stashes[id] ?? {}), cold: true };
    this.touch();
    return true;
  }

  invite(name, id, who, on) {
    const o = this.s.owners[id];
    if (!o || o.owner !== name || who === name) return false;
    o.invited = on ? [...new Set([...o.invited, who])] : o.invited.filter((n) => n !== who);
    this.touch();
    return true;
  }

  upgrade(name, id, up) {
    if (!this.canUse(name, id)) return false;
    this.s.owners[id].ups[up] = true;
    this.touch();
    return true;
  }

  capacity(id) {
    return STASH_CAPACITY + (this.s.owners[id]?.ups?.shelves ? 6 : 0);
  }

  /** Guardar (dir 1) o sacar (dir -1) una piedra del estante. La escarcha lleva su frío. */
  stash(name, { id, good, dir, chill }) {
    if (!this.canUse(name, id) || !STONE[good]) return { ok: false };
    const st = (this.s.stashes[id] ??= {});
    const count = GOOD_IDS.reduce((s, g) => s + (st[g] ?? 0), 0);
    if (dir > 0) {
      if (count >= this.capacity(id)) return { ok: false, why: "Ya no cabe" };
      if (good === "frost") st.chill = mixChill(st.frost ?? 0, st.chill ?? 100, 1, chill ?? 100);
      st[good] = (st[good] ?? 0) + 1;
    } else {
      if (!(st[good] > 0)) return { ok: false, why: "Ya no hay" };
      st[good] -= 1;
    }
    this.touch();
    return { ok: true, chill: st.chill ?? 100 };
  }

  /** Redada: la Corona se lleva lo guardado (si no hay cerrojo). */
  raid(id) {
    const o = this.s.owners[id];
    if (!o || o.ups.lock) return 0;
    const st = this.s.stashes[id] ?? {};
    const lost = GOOD_IDS.reduce((s, g) => s + (st[g] ?? 0), 0);
    this.s.stashes[id] = st.cold ? { cold: true } : {};
    this.touch();
    return lost;
  }

  hire(name, who) {
    if (this.s.hires[who]) return false;
    this.s.hires[who] = name;
    this.touch();
    return true;
  }

  // ------------------------------------------------------------------ buhonero

  /** El buhonero de una ruta hoy: una tirada por ruta y por día, igual para todos. */
  peddler(route) {
    const day = this.s.econ.day;
    const cur = this.s.peddlers[route];
    if (cur && cur.day === day) return cur;
    const rand = Math.random;
    let p;
    if (rand() >= PEDDLER.chance) p = { route, day, none: true };
    else {
      const lerp = ([a, b]) => a + (b - a) * rand();
      const buyGood = GOOD_IDS[Math.floor(rand() * GOOD_IDS.length)];
      const sellable = GOOD_IDS.filter((g) => g !== buyGood && g !== "frost");
      const sellGood = sellable[Math.floor(rand() * sellable.length)];
      p = {
        route, day,
        name: PEDDLER.names[Math.floor(rand() * PEDDLER.names.length)],
        buys: { good: buyGood, price: Math.round(STONE[buyGood].value * lerp(PEDDLER.buyRate)), left: 3 },
        sells: { good: sellGood, price: Math.max(1, Math.round(STONE[sellGood].value * lerp(PEDDLER.sellRate))), left: 2 + (rand() < 0.5 ? 1 : 0) },
      };
    }
    this.s.peddlers[route] = p;
    this.touch();
    return p;
  }

  peddlerOp(route, op, spot) {
    const p = this.peddler(route);
    if (p.none) return { ok: false };
    if (op === "spot") {
      // El lugar lo propone el primer cliente que lo ve y se guarda: los demás reciben este mismo
      // en la respuesta (antes cada quien lo ponía donde quería y ganaba el primero en silencio).
      if (!p.spot && spot && Number.isFinite(spot.x) && Number.isFinite(spot.y)) p.spot = { x: spot.x, y: spot.y };
    } else if (op === "sell") {
      if (p.buys.left <= 0) return { ok: false };
      p.buys.left -= 1;
    } else if (op === "buy") {
      if (p.sells.left <= 0) return { ok: false };
      p.sells.left -= 1;
    }
    this.touch();
    return { ok: true, p };
  }

  // ------------------------------------------------------------------ enemigos, arbustos, piedras tiradas

  enemyDead(map, id) {
    const list = (this.s.dead[map] ??= []);
    if (!list.includes(id)) list.push(id);
    this.touch();
  }

  cut(map, key) {
    const list = (this.s.cut[map] ??= []);
    if (!list.includes(key)) list.push(key);
    this.touch();
  }

  addPickup(map, p) {
    (this.s.pickups[map] ??= {})[p.id] = p;
    this.touch();
  }

  takePickup(map, id) {
    const list = this.s.pickups[map];
    if (!list?.[id]) return false;
    delete list[id];
    this.touch();
    return true;
  }

  /** Noticia de una venta grande, dicha como la cuenta la gente. */
  static saleNews(name, town, sold) {
    const parts = Object.entries(sold).filter(([, n]) => n > 0).map(([g, n]) => plural(n, g));
    return parts.length ? `${name} vendió ${parts.join(" y ")} en ${TOWNS[town].name}.` : null;
  }
}
