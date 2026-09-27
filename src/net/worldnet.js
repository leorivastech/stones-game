/**
 * El mapa actual en el modo en línea: lo que se comparte con los otros jugadores mientras andas
 * por un pueblo, una ruta o un refugio. Se engancha a WorldScene (scene.net) sólo con ?online=1.
 *
 *  - Fantasmas: ves a los otros caminar (sin chocar). Envías tu posición 10 veces por segundo.
 *  - Enemigos: el primero que llegó al mapa los "manda": corre su IA y cuenta dónde están.
 *    Los demás ven títeres que copian eso; sus golpes se le mandan al que manda. Los enemigos
 *    persiguen al jugador más cercano, sea de este aparato o de otro.
 *    Van en la foto también los que salen de noche ("n:…"), los matones del Gremio ("t:…"), el "?"
 *    del guardia que busca, el parpadeo blanco y lo que se estiran o aplastan.
 *  - Si el que manda se va o deja de moverse, el servidor le pasa el mando a otro: sus enemigos
 *    vuelven a como empezaron y siguen desde ahí.
 *  - Piedras y monedas tiradas, arbustos y pasto cortado, cofres, rejas y refugios: iguales para todos.
 *  - Tu yegua y tu carreta se ven detrás de tu fantasma.
 *  - Tu avance se manda al servidor cada pocos segundos (ver saveGame / pushSave).
 *  - Siempre sabes dónde anda el otro (Leo, 27-sep: "siempre tienes que poder ver a la otra persona"):
 *    en el mismo mapa y fuera de la pantalla, una flecha en la orilla con su nombre y a cuántos metros;
 *    en otro mapa, una flecha hacia la salida que lleva a donde está ("Leonel2 → Ruta 1 (norte)").
 *    Al que eliges en la pausa → JUGADORES ("seguir") se le pinta dorado y va primero.
 */

import { online, onNet, send, request, playersIn, resendSave, canUse } from "./online.js";
import { voice } from "./voice.js";
import { DEPTH, TILE, VIEW_W, VIEW_H } from "../config.js";
import { textWidth } from "../art/font.js";
import { passDays, stones, coldAt, saveGame, flag } from "../state.js";
import { MAPS } from "../maps/index.js";
import { makeEnemy } from "../entities/enemies.js";
import { release } from "../engine/juice.js";

// ---------------------------------------------------------------------- por dónde se llega a otro mapa

/** mapa → [{ to, ex }] por sus salidas (pueblos ↔ rutas; los refugios salen a su ruta). */
let GRAPH = null;
function graph() {
  if (GRAPH) return GRAPH;
  GRAPH = {};
  for (const [id, def] of Object.entries(MAPS)) GRAPH[id] = (def.exits ?? []).filter((ex) => MAPS[ex.to]).map((ex) => ({ to: ex.to, ex }));
  return GRAPH;
}

/** La salida de `from` que lleva (por el camino más corto) a `to`, o null. */
export function firstExit(from, to) {
  if (from === to) return null;
  const g = graph();
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const { to: next, ex } of g[cur] ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, { cur, ex });
      queue.push(next);
    }
  }
  if (!prev.has(to)) return null;
  let step = prev.get(to);
  while (step && step.cur !== from) step = prev.get(step.cur);
  return step?.ex ?? null;
}

/** Nombre corto del lugar (los refugios son secretos: sólo "un refugio"). */
function placeOf(map) {
  const def = MAPS[map];
  if (!def) return "?";
  return def.kind === "refuge" ? "un refugio" : def.name;
}

const DIR_WORD = { up: "norte", down: "sur", left: "oeste", right: "este" };

/** Flechas en píxel (sin trazos vectoriales): hacia la derecha y en diagonal; las demás se giran. */
const ARROW_E = ["#....", "##...", "###..", "####.", "###..", "##...", "#...."];
const ARROW_SE = [".....#", "....##", "...###", "..####", ".#####", "######"];
function arrowPixels(oct) {
  const base = oct % 2 === 0 ? ARROW_E : ARROW_SE;
  const turns = oct % 2 === 0 ? oct / 2 : (oct - 1) / 2;
  let pts = [];
  base.forEach((row, y) => [...row].forEach((c, x) => { if (c === "#") pts.push([x, y]); }));
  let w = base[0].length;
  let h = base.length;
  for (let i = 0; i < turns; i += 1) {
    pts = pts.map(([x, y]) => [h - 1 - y, x]);
    [w, h] = [h, w];
  }
  return { pts, w, h };
}
const ARROWS = Array.from({ length: 8 }, (_, i) => arrowPixels(i));

const POS_MS = 100;
const SNAP_MS = 100;
/** Cada cuánto se manda el avance al servidor (sólo si cambió). */
const SAVE_MS = 8000;

export class NetWorld {
  constructor(scene) {
    this.scene = scene;
    this.map = scene.mapId;
    this.auth = false;
    this.ghosts = new Map();
    this.posTimer = 0;
    this.snapTimer = 0;
    this.pickSeq = 0;
    this.lastHit = new Map();
    this.saveTimer = SAVE_MS;
    this.snapTick = 0;
    this.thugSeq = 0;
    /** Enemigos que el servidor dice que ya cayeron hoy (los de la noche no vuelven a salir). */
    this.deadIds = new Set();
    /** Enemigos que tumbaste sin conexión: se avisan al volver (si no, los demás los seguirían viendo vivos). */
    this.offlineKills = new Set();
    this.offs = [];
    const on = (t, fn) => this.offs.push(onNet(t, (m) => { if (this.scene.sys.isActive()) fn(m); }));

    on("mapState", (m) => m.map === this.map && this.applyMapState(m));
    on("auth", (m) => { if (m.map === this.map) { if (m.yes === false) this.becomePuppet(); else this.becomeAuthority(); } });
    on("thugs", (m) => m.map === this.map && this.onThugs(m));
    on("thugsGone", (m) => m.map === this.map && this.onThugsGone(m.for));
    on("pos", (m) => this.onPos(m));
    on("where", (m) => { if (m.map !== this.map) this.dropGhost(m.id); });
    on("here", (m) => { if (m.map === this.map) for (const h of m.list ?? []) if (h.pos) this.onPos({ ...h.pos, id: h.id, map: m.map }); });
    on("leave", (m) => this.dropGhost(m.id));
    on("esnap", (m) => m.map === this.map && this.applySnap(m.list));
    on("ehit", (m) => m.map === this.map && this.onRemoteHit(m));
    on("eact", (m) => m.map === this.map && this.onRemoteAct(m));
    on("edie", (m) => m.map === this.map && this.onRemoteDeath(m.id));
    on("pdmg", (m) => this.onRemoteDamage(m));
    on("inspect", (m) => m.map === this.map && this.onInspect(m));
    on("cut", (m) => m.map === this.map && this.scene.applyCut(m.key, false));
    on("pickAdd", (m) => m.map === this.map && this.spawnRemotePickup(m.p));
    on("pickDel", (m) => m.map === this.map && this.removeRemotePickup(m.id));
    on("flags", () => this.scene.applyWorldFlags());
    on("owners", () => this.scene.applyWorldFlags());
    on("hires", () => this.scene.applyWorldFlags());
    on("day", (m) => this.onDay(m));
    on("news", (m) => { if (!m.item.text.startsWith(online.name)) this.scene.ui.toast(m.item.text, "font-o"); });
    on("invited", (m) => this.scene.ui.toast(m.on ? `${m.from} te invitó a su refugio` : `${m.from} te quitó la invitación`, "font-gold"));
    // Volvió la conexión: hasta que el servidor diga quién manda, los enemigos son títeres; se repite
    // en qué mapa andas (llegan de nuevo muertos, cortes y piedras) y el avance vuelve a subir.
    on("reconnected", () => {
      this.becomePuppet();
      for (const id of [...this.ghosts.keys()]) if (!online.players.has(id)) this.dropGhost(id);
      this.announce();
      for (const id of this.offlineKills) send({ t: "edie", map: this.map, id });
      this.offlineKills.clear();
      resendSave();
      saveGame(this.scene.registry);
      this.scene.ui.toast("Conexión de vuelta", "font-green");
    });
    // Sin conexión, sigues jugando: tus enemigos se mueven aquí mismo y los fantasmas se van.
    on("offline", () => {
      this.scene.ui.toast("Sin conexión… reintentando", "font-red");
      for (const id of [...this.ghosts.keys()]) this.dropGhost(id);
      if (!this.auth) this.becomeAuthority();
    });

    // Todos empiezan como títeres hasta que el servidor diga quién manda aquí.
    for (const e of scene.enemies) e.puppet = true;
    this.announce();
    for (const p of playersIn(this.map)) if (p.pos) this.onPos({ id: p.id, ...p.pos });
    scene.events.once("shutdown", () => this.destroy());
  }

  announce() {
    const def = this.scene.def;
    send({ t: "map", map: this.map, town: def.kind === "town" && this.scene.arrival ? def.name : null });
  }

  destroy() {
    for (const off of this.offs) off();
    for (const id of [...this.ghosts.keys()]) this.dropGhost(id);
    this.markGfx?.destroy();
    for (const t of this.markTexts ?? []) t.destroy();
  }

  // ------------------------------------------------------------------ bucle

  update(dt, busy) {
    const s = this.scene;
    // El avance sube al servidor cada tanto (sólo si cambió algo: pushSave compara).
    this.saveTimer -= dt;
    if (this.saveTimer <= 0 && !s.leaving) { this.saveTimer = SAVE_MS; saveGame(s.registry); }
    // Si mando a los enemigos, siguen vivos aunque yo esté en un menú: el otro los sigue viendo.
    if (busy && this.auth) {
      for (const e of s.enemies) if (!e.dead) e.update(dt);
    }
    for (const e of s.enemies) if (e.puppet && !e.dead) this.puppetUpdate(e, dt);
    for (const g of this.ghosts.values()) this.ghostUpdate(g, dt);
    this.updateMarks();
    this.posTimer -= dt;
    if (this.posTimer <= 0) { this.posTimer = POS_MS; this.sendPos(busy); }
    if (this.auth) {
      this.snapTimer -= dt;
      if (this.snapTimer <= 0) { this.snapTimer = SNAP_MS; this.sendSnap(); }
      this.dropLostThugs();
    }
  }

  sendPos(busy) {
    const s = this.scene;
    const p = s.player;
    if (!p?.sprite?.active) return;
    const sp = p.sprite;
    voice.me = { map: this.map, x: sp.x, y: sp.y };
    send({
      t: "pos", map: this.map, name: online.name,
      x: Math.round(sp.x), y: Math.round(sp.y), tex: sp.texture.key, fr: sp.frame.name, fl: sp.flipX ? 1 : 0, a: sp.alpha,
      st: p.state, hid: p.hidden ? 1 : 0, cr: p.crouching ? 1 : 0, busy: busy || s.modal ? 1 : 0,
      cargo: stones(s.registry), vis: s.visibleCargo(),
      hz: this.horseInfo(),
    });
  }

  /** La yegua (o la carreta) que te sigue, para que los demás la vean detrás de ti. */
  horseInfo() {
    const h = this.scene.horse;
    if (!h?.active || !h.visible) return 0;
    return { x: Math.round(h.x), y: Math.round(h.y), tex: h.texture.key, fr: h.frame.name, fl: h.flipX ? 1 : 0, ox: Math.round(h.originX * 100) / 100, oy: Math.round(h.originY * 100) / 100 };
  }

  // ------------------------------------------------------------------ fantasmas

  onPos(m) {
    if (m.id === online.id) return;
    if (m.map !== this.map) { this.dropGhost(m.id); return; }
    let g = this.ghosts.get(m.id);
    if (!g) g = this.makeGhost(m);
    g.target = m;
  }

  makeGhost(m) {
    const s = this.scene;
    const sprite = s.add.sprite(m.x, m.y, m.tex || "cast-player", m.fr ?? 0).setOrigin(0.5, 1);
    // Un poco transparente y con un tinte para que se note que es otra persona.
    sprite.setTint(0xcfe0ff);
    const shadow = s.add.image(m.x, m.y, "shadow").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1);
    // Origen a la izquierda y x entera (centrado a mano): con origen 0.5 las letras quedan en medio
    // píxel y se les come una columna ("Ana" se veía "Fra").
    const label = s.add.bitmapText(m.x, m.y - 30, "font-o", m.name ?? "?").setOrigin(0, 1).setDepth(DEPTH.fx);
    const g = { id: m.id, sprite, shadow, label, target: m, horse: null };
    // Para los enemigos, el fantasma es un blanco más.
    g.proxy = {
      id: m.id,
      remote: true,
      get x() { return sprite.x; },
      get y() { return sprite.y; },
      get body() { return { x: sprite.x - 5, y: sprite.y - 7, width: 10, height: 6 }; },
      center() { return { x: sprite.x, y: sprite.y - 9 }; },
      get state() { return g.target.st ?? "move"; },
      get hidden() { return Boolean(g.target.hid); },
      get crouching() { return Boolean(g.target.cr); },
      get busy() { return Boolean(g.target.busy); },
      get cargo() { return g.target.cargo ?? 0; },
      get vis() { return g.target.vis ?? 0; },
    };
    this.ghosts.set(m.id, g);
    return g;
  }

  ghostUpdate(g, dt) {
    const t = g.target;
    const k = Math.min(1, dt / 90);
    const sp = g.sprite;
    // Si brincó lejos (cambio de mapa, reaparición), se pone ahí de una vez.
    if (Math.hypot(t.x - sp.x, t.y - sp.y) > 80) sp.setPosition(t.x, t.y);
    else sp.setPosition(sp.x + (t.x - sp.x) * k, sp.y + (t.y - sp.y) * k);
    if (t.tex && this.scene.textures.exists(t.tex)) sp.setTexture(t.tex, t.fr);
    sp.setFlipX(Boolean(t.fl)).setAlpha(Math.min(t.a ?? 1, 0.92)).setDepth(sp.y);
    g.shadow.setPosition(sp.x, sp.y).setVisible(!t.hid);
    const talking = online.players.get(g.id)?.talking;
    const name = `${talking ? "» " : ""}${online.players.get(g.id)?.name ?? t.name ?? "?"}`;
    if (g.label.text !== name) g.label.setText(name);
    g.label.setPosition(Math.round(sp.x - textWidth(name) / 2), Math.round(sp.y - 26));
    this.ghostHorse(g, t.hz, k);
  }

  /** La yegua o la carreta del otro jugador (con su textura, su vista y su origen). */
  ghostHorse(g, hz, k) {
    if (!hz) {
      if (g.horse) { g.horse.destroy(); g.horseShadow.destroy(); g.horse = null; }
      return;
    }
    const s = this.scene;
    if (!hz.tex || !s.textures.exists(hz.tex)) return;
    if (!g.horse) {
      g.horse = s.add.sprite(hz.x, hz.y, hz.tex, hz.fr).setTint(0xcfe0ff);
      g.horseShadow = s.add.image(hz.x, hz.y, "shadow-big").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1);
    }
    const h = g.horse;
    if (Math.hypot(hz.x - h.x, hz.y - h.y) > 80) h.setPosition(hz.x, hz.y);
    else h.setPosition(h.x + (hz.x - h.x) * k, h.y + (hz.y - h.y) * k);
    if (h.texture.key !== hz.tex || h.frame.name !== hz.fr) h.setTexture(hz.tex, hz.fr);
    h.setOrigin(hz.ox ?? 0.5, hz.oy ?? 1).setFlipX(Boolean(hz.fl)).setDepth(h.y - 1);
    g.horseShadow.setPosition(h.x, h.y);
  }

  dropGhost(id) {
    const g = this.ghosts.get(id);
    if (!g) return;
    g.sprite.destroy();
    g.shadow.destroy();
    g.label.destroy();
    g.horse?.destroy();
    g.horseShadow?.destroy();
    this.ghosts.delete(id);
  }

  // ------------------------------------------------------------------ dónde anda cada quien (flechas)

  /**
   * Una flecha por jugador que no se ve en la pantalla: en el mismo mapa apunta a él (con metros);
   * en otro mapa apunta a la salida que lleva hacia allá. Pegadas a la orilla, con su nombre.
   */
  updateMarks() {
    const s = this.scene;
    const cam = s.cameras.main;
    if (!this.markGfx) {
      this.markGfx = s.add.graphics().setScrollFactor(0).setDepth(DEPTH.fx + 200);
      this.markTexts = [];
    }
    const gfx = this.markGfx;
    gfx.clear();
    const marks = [];
    const view = cam.worldView;
    const me = s.player?.sprite;
    if (!me?.active || !view.width) { for (const t of this.markTexts) t.setVisible(false); return; }
    for (const p of online.players.values()) {
      if (!p.name || p.id === online.id || !p.map) continue;
      const followed = online.follow === p.name;
      const stale = !online.connected;
      if (p.map === this.map) {
        const g = this.ghosts.get(p.id);
        const x = g ? g.sprite.x : p.pos?.x;
        const y = g ? g.sprite.y - 12 : (p.pos?.y ?? 0) - 12;
        if (x == null) continue;
        const sx = x - view.x;
        const sy = y - view.y;
        // A la vista (con su nombre encima): no hace falta flecha.
        if (g && sx > 4 && sx < VIEW_W - 4 && sy > 4 && sy < VIEW_H - 4) continue;
        const m = Math.round(Math.hypot(x - me.x, y - me.y + 12) / TILE);
        marks.push({ sx, sy, text: `${p.name} · ${m} m${stale ? " ?" : ""}`, followed, stale });
        continue;
      }
      // En otro mapa: hacia la salida que lleva allá. Un refugio cuenta como su ruta.
      const def = MAPS[p.map];
      if (!def) continue;
      const target = def.kind === "refuge" ? def.exits?.[0]?.to : p.map;
      let pt = null;
      let dirWord = "";
      if (target === this.map) {
        // Está en un refugio de esta ruta: se señala la puerta sólo si ya la conoces.
        const door = s.def.entries?.[def.exits?.[0]?.entry];
        if (door && (canUse(def.refuge) || flag(s.registry, `found-${def.refuge}`))) pt = { x: door.x * TILE, y: door.y * TILE };
      } else {
        const ex = firstExit(this.map, target);
        if (ex) {
          pt = { x: (ex.x + ex.w / 2) * TILE, y: (ex.y + ex.h / 2) * TILE };
          dirWord = DIR_WORD[s.exitDir?.(ex)] ?? "";
        }
      }
      const text = `${p.name} → ${placeOf(p.map)}${dirWord ? ` (${dirWord})` : ""}${stale ? " ?" : ""}`;
      if (!pt) { marks.push({ sx: null, sy: null, text, followed, stale }); continue; }
      marks.push({ sx: pt.x - view.x, sy: pt.y - view.y, text, followed, stale });
    }
    // El que sigues va primero; se muestran hasta 4.
    marks.sort((a, b) => Number(b.followed) - Number(a.followed));
    const shown = marks.slice(0, 4);
    const used = [];
    shown.forEach((mk, i) => {
      let t = this.markTexts[i];
      if (!t) { t = s.add.bitmapText(0, 0, "font-o", "").setScrollFactor(0).setDepth(DEPTH.fx + 201); this.markTexts[i] = t; }
      if (t.text !== mk.text) t.setText(mk.text);
      t.setFont(mk.followed ? "font-gold" : "font-o").setVisible(true).setAlpha(mk.stale ? 0.55 : 1);
      const w = textWidth(mk.text);
      const L = 12;
      const R = VIEW_W - 12;
      const T = 50;
      const B = VIEW_H - 18;
      let ax;
      let ay;
      let oct = null;
      if (mk.sx == null) {
        // Sin dirección (refugio que no conoces, o sin camino): sólo el nombre arriba al centro.
        ax = Math.round(VIEW_W / 2);
        ay = T;
      } else {
        const cx = VIEW_W / 2;
        const cy = (T + B) / 2;
        const dx = mk.sx - cx;
        const dy = mk.sy - cy;
        const inside = mk.sx > L && mk.sx < R && mk.sy > T && mk.sy < B;
        if (inside) {
          // La salida está a la vista: la flecha junto a ella, apuntándole.
          const d = Math.hypot(dx, dy) || 1;
          ax = mk.sx - (dx / d) * 12;
          ay = mk.sy - (dy / d) * 12;
        } else {
          const k = Math.min(dx ? (dx > 0 ? R - cx : L - cx) / dx : Infinity, dy ? (dy > 0 ? B - cy : T - cy) / dy : Infinity);
          ax = cx + dx * k;
          ay = cy + dy * k;
        }
        oct = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
      }
      // Que no se encimen: la siguiente baja un renglón.
      let ly = Math.round(ay - 4);
      while (used.some((u) => Math.abs(u - ly) < 11)) ly += 11;
      used.push(ly);
      ay += ly - Math.round(ay - 4);
      ax = Math.round(ax);
      ay = Math.round(ay);
      if (oct != null) {
        const a = ARROWS[oct];
        const color = mk.followed ? 0xe6b736 : 0x7891da;
        // Al doble (cada punto, 2×2 píxeles): se ve bien en el celular.
        const ox = ax - a.w;
        const oy = ay - a.h;
        gfx.fillStyle(0x1b1422, mk.stale ? 0.5 : 1);
        for (const [x, y] of a.pts) gfx.fillRect(ox + x * 2 - 1, oy + y * 2 - 1, 4, 4);
        gfx.fillStyle(color, mk.stale ? 0.5 : 1);
        for (const [x, y] of a.pts) gfx.fillRect(ox + x * 2, oy + y * 2, 2, 2);
      }
      // El nombre, hacia adentro de la pantalla.
      let lx;
      if (oct == null) lx = ax - Math.round(w / 2);
      else if (ax >= R - 2) lx = ax - 12 - w;
      else if (ax <= L + 2) lx = ax + 12;
      else lx = ax - Math.round(w / 2);
      const ty = oct == null ? ly : ay >= B - 2 ? ay - 19 : ay <= T + 2 ? ay + 10 : ly;
      t.setPosition(Math.round(Math.max(4, Math.min(VIEW_W - 4 - w, lx))), Math.round(ty));
    });
    for (let i = shown.length; i < this.markTexts.length; i += 1) this.markTexts[i].setVisible(false);
  }

  /** El blanco (para los enemigos) del jugador `id` si anda en este mapa. */
  ghostProxy(id) {
    return this.ghosts.get(id)?.proxy ?? null;
  }

  /** Los blancos posibles para los enemigos: yo y los que andan en este mapa. */
  targets() {
    const list = [this.scene.player];
    for (const g of this.ghosts.values()) list.push(g.proxy);
    return list;
  }

  // ------------------------------------------------------------------ enemigos

  becomeAuthority() {
    if (this.auth) return;
    this.auth = true;
    for (const e of this.scene.enemies) {
      if (!e.puppet) continue;
      e.puppet = false;
      if (e.dead || !e.sprite?.active) continue;
      // Lo que traía del otro aparato (una embestida a medias, un salto, apuntar un cuchillo) no tiene
      // sus datos aquí: cada enemigo vuelve a como empezó y sigue con su propia cabeza.
      release(e);
      e.hitstopUntil = 0;
      e.knockTime = 0;
      e.aimMs = null;
      e.windupMs = null;
      e.restMs = null;
      e.lostTime = 0;
      e.body?.setVelocity(0, 0);
      e.sprite.setScale(1);
      if (e.state === "hidden" && e.hide) e.hide();
      else {
        if (e.body) e.body.enable = true;
        if (e.spawnState === "hidden") {
          // Ya había salido de su escondite: se queda afuera.
          e.sprite.setVisible(true);
          e.shadow.setVisible(true);
          e.setState("idle");
        } else e.setState(e.spawnState ?? "idle");
      }
    }
  }

  /** Otro aparato manda ahora aquí (o volvió la conexión): mis enemigos pasan a copiar sus fotos. */
  becomePuppet() {
    this.auth = false;
    for (const e of this.scene.enemies) {
      if (e.dead) continue;
      e.puppet = true;
      e.netState = e.state;
      release(e);
      e.hitstopUntil = 0;
      e.body?.setVelocity(0, 0);
    }
  }

  byId(id) {
    return this.scene.enemies.find((e) => e.netId === id);
  }

  sendSnap() {
    const list = [];
    for (const e of this.scene.enemies) {
      if (e.netId == null || !e.sprite?.active) continue;
      const sp = e.sprite;
      const n = {
        id: e.netId, x: Math.round(sp.x), y: Math.round(sp.y), tex: sp.texture.key, fr: sp.frame.name, fl: sp.flipX ? 1 : 0,
        a: Math.round(sp.alpha * 100) / 100, v: sp.visible ? 1 : 0, st: e.state, f: e.facing, h: e.hostile ? 1 : 0, s: Math.round((e.suspicion ?? 0) * 100) / 100,
        b: e.bubble?.texture?.key ?? null, d: e.dead ? 1 : 0,
      };
      // Golpe: blanco y estirado/aplastado. Guardia buscando: su "?". De noche o matón: con qué armarlo.
      if (e.flashed) n.w = 1;
      if (sp.scaleX !== 1 || sp.scaleY !== 1) { n.sx = Math.round(sp.scaleX * 100) / 100; n.sy = Math.round(sp.scaleY * 100) / 100; }
      if (e.mark?.active) n.mk = [e.markAt?.x ?? Math.round(e.mark.x), e.markAt?.y ?? Math.round(e.mark.y)];
      if (e.dynSpec) n.sp = e.dynSpec;
      list.push(n);
    }
    // Sin enemigos igual se avisa de vez en cuando (así los demás quitan a los de la noche que se fueron).
    this.snapTick += 1;
    if (list.length || this.snapTick % 10 === 0) send({ t: "esnap", map: this.map, list });
  }

  applySnap(list) {
    const s = this.scene;
    const seen = new Set();
    for (const n of list) {
      seen.add(n.id);
      let e = this.byId(n.id);
      if (!e && n.sp && !n.d && !this.deadIds.has(n.id)) e = this.makeDynamic(n);
      if (!e || !e.puppet) continue;
      e.netTarget = n;
      if (n.d && !e.dead) { this.puppetDied(e); continue; }
      if (e.dead) continue;
      const sp = e.sprite;
      if (n.tex && s.textures.exists(n.tex) && (sp.texture.key !== n.tex || sp.frame.name !== n.fr)) sp.setTexture(n.tex, n.fr);
      sp.setFlipX(Boolean(n.fl)).setAlpha(n.a ?? 1).setVisible(Boolean(n.v));
      sp.setScale(n.sx ?? 1, n.sy ?? 1);
      if (n.w) e.flash = Math.max(e.flash ?? 0, 120);
      e.state = n.st;
      e.facing = n.f ?? e.facing;
      e.hostile = Boolean(n.h);
      if (e.suspicion != null) e.suspicion = n.s ?? 0;
      const bubble = e.bubble?.texture?.key ?? null;
      if (n.b !== bubble) {
        if (n.b) e.showBubble(n.b, 0);
        else { e.bubble?.destroy(); e.bubble = null; }
      }
      if (e.placeMark) {
        if (n.mk && (!e.mark || Math.abs(e.markAt.x - n.mk[0]) > 3 || Math.abs(e.markAt.y - n.mk[1]) > 3)) e.placeMark(n.mk[0], n.mk[1]);
        else if (!n.mk && e.mark) e.clearMark();
      }
    }
    // Los de la noche que ya no vienen en la foto se fueron (amaneció) o el matón se retiró.
    for (const e of [...s.enemies]) {
      if (!e.puppet || !e.dynSpec || e.dead || seen.has(e.netId)) continue;
      this.vanish(e);
    }
  }

  /** Un enemigo que no está en el mapa (de noche o matón) llega en la foto: se arma igual aquí. */
  makeDynamic(n) {
    const s = this.scene;
    const d = n.sp;
    let e;
    if (d.th) {
      e = s.makeThug({ x: d.x, y: d.y }, 0, { forId: d.fo, netId: n.id, quiet: true });
      if (d.fo === online.id) s.thugs = [...(s.thugs ?? []).filter((t) => !t.dead), e];
    } else {
      const idx = String(n.id).startsWith("n:") ? Number(String(n.id).slice(2)) : -1;
      const planned = s.nightPlan?.[idx];
      const spec = planned && planned.kind === d.k ? planned : { type: "enemy", kind: d.k, x: d.x, y: d.y, ambush: Boolean(d.am), minCargo: d.mc || undefined, night: true, lastNight: -1 };
      e = makeEnemy(s, spec);
      if (!e) return null;
      e.netId = n.id;
      e.spawnState = e.state;
      s.enemies.push(e);
      s.enemyGroup.add(e.sprite);
    }
    e.dynSpec = d;
    e.puppet = true;
    e.netState = n.st;
    e.body.reset(n.x, n.y);
    return e;
  }

  /** Se va sin morir (sin monedas ni ruido): se desvanece. */
  vanish(e) {
    e.dead = true;
    e.body.enable = false;
    e.bubble?.destroy();
    e.clearMark?.();
    e.cone?.clear?.();
    this.scene.tweens.add({ targets: [e.sprite, e.shadow], alpha: 0, duration: 300, onComplete: () => e.destroy() });
  }

  /** Un títere murió (lo dijo el que manda). Si era un matón que venía por mí, cuenta para mí. */
  puppetDied(e) {
    e.die();
    this.deadIds.add(e.netId);
    if (e.thug && e.thugFor === online.id) this.scene.onThugDown(e);
  }

  // ------------------------------------------------------------------ matones del Gremio

  /** Mi deuda llamó a los matones: los saca el que manda este mapa (puedo ser yo). */
  requestThugs(x, y) {
    this.thugSeq += 1;
    send({ t: "thugs", map: this.map, x: Math.round(x), y: Math.round(y), n: this.thugSeq });
  }

  /** (El que manda) Salen los matones de un deudor, cerca de donde está. */
  onThugs(m) {
    const s = this.scene;
    if (!this.auth) return;
    const spots = s.makeThugs(m.x, m.y);
    const mine = m.for === online.id;
    const made = spots.map((p, i) => {
      const e = s.makeThug(p, i, { forId: mine ? online.id : m.for, netId: `t:${m.name}:${m.n}:${i}` });
      e.dynSpec = { k: "bandit", th: 1, fo: m.for, x: p.x, y: p.y };
      return e;
    });
    if (mine) s.thugs = [...(s.thugs ?? []).filter((t) => !t.dead), ...made];
  }

  /** El deudor ya pagó a golpes (o se fue): sus matones se retiran. */
  thugsGone() {
    send({ t: "thugsGone", map: this.map });
  }

  onThugsGone(forId) {
    if (!this.auth) return;
    for (const e of this.scene.enemies) if (e.thug && e.thugFor === forId && !e.dead) this.vanish(e);
  }

  /** (El que manda) Matones cuyo deudor ya no anda en el mapa: se van. */
  dropLostThugs() {
    for (const e of this.scene.enemies) {
      if (!e.thug || e.dead || e.thugFor == null || e.thugFor === online.id) continue;
      if (!this.ghosts.has(e.thugFor) && this.scene.time.now - (e.bornAt ?? 0) > 3000) this.vanish(e);
    }
  }

  puppetUpdate(e, dt) {
    e.preUpdate(dt);
    const n = e.netTarget;
    if (!n) return;
    const k = Math.min(1, dt / 90);
    const x = Math.abs(n.x - e.x) > 60 ? n.x : e.x + (n.x - e.x) * k;
    const y = Math.abs(n.y - e.y) > 60 ? n.y : e.y + (n.y - e.y) * k;
    e.body.reset(x, y);
    // reset() deja el cuerpo en la esquina del sprite (sin su offset): se acomoda para que los golpes
    // del bastón le lleguen donde se ve (antes, de frente/abajo casi no se le podía pegar a un títere).
    const b = e.body;
    b.updateFromGameObject();
    b.prev.copy(b.position);
    b.prevFrame.copy(b.position);
    b.autoFrame.copy(b.position);
    e.shadow.setVisible(e.sprite.visible);
    if (e.cone && e.drawCone) e.drawCone();
  }

  hitPuppet(e, damage, fx, fy) {
    send({ t: "ehit", map: this.map, id: e.netId, dmg: damage, fx: Math.round(fx), fy: Math.round(fy) });
  }

  onRemoteHit(m) {
    const e = this.byId(m.id);
    if (!e || e.puppet || e.dead) return;
    // `remote`: si acaba de recibir otro golpe (de otro jugador), éste no cuenta (no hay daño doble).
    e.hit(m.dmg, m.fx, m.fy, { remote: true });
  }

  enemyAct(e, act) {
    send({ t: "eact", map: this.map, id: e.netId, act });
  }

  onRemoteAct(m) {
    const e = this.byId(m.id);
    if (!e || e.puppet || e.dead) return;
    if (m.act === "shove") e.shove?.();
    if (m.act === "clear") {
      e.suspicion = 0;
      e.bubble?.destroy();
      e.bubble = null;
      e.setState("return");
    }
  }

  enemyDied(e) {
    if (e.netId == null) return;
    this.deadIds.add(e.netId);
    if (e.puppet) return;
    if (online.connected) send({ t: "edie", map: this.map, id: e.netId });
    else this.offlineKills.add(e.netId);
  }

  onRemoteDeath(id) {
    this.deadIds.add(id);
    const e = this.byId(id);
    if (e && !e.dead) this.puppetDied(e);
  }

  /** Un enemigo mío le pegó al jugador de otro aparato. */
  damageRemote(t, halves, src, opts = {}) {
    const now = this.scene.time.now;
    if (now - (this.lastHit.get(t.id) ?? -9999) < 450) return;
    this.lastHit.set(t.id, now);
    const c = src.center ? src.center() : src;
    send({
      t: "pdmg", to: t.id, map: this.map, dmg: halves, fx: Math.round(c.x), fy: Math.round(c.y), steal: Boolean(opts.steal),
      thug: src.thug ? 1 : 0, kind: src.kind ?? src.spec?.kind ?? null,
    });
  }

  onRemoteDamage(m) {
    if (m.map !== this.map) return;
    // `thug`: si te tumban los matones, cobran ellos (no se pierden piedras).
    this.scene.damagePlayer(m.dmg, { x: m.fx, y: m.fy, thug: Boolean(m.thug), kind: m.kind ?? undefined }, { steal: m.steal });
  }

  /** Un guardia mío alcanzó al jugador de otro aparato: la revisión le toca a él. */
  inspectRemote(guard, t) {
    send({ t: "inspect", to: t.id, map: this.map, id: guard.netId });
    guard.suspicion = 0;
    guard.setState("return");
  }

  onInspect(m) {
    const guard = this.byId(m.id);
    const s = this.scene;
    if (!guard || guard.dead || s.modal) return;
    s.runModal(() => s.inspection(guard, "patrol"));
  }

  // ------------------------------------------------------------------ piedras tiradas y arbustos

  applyMapState(m) {
    const s = this.scene;
    for (const id of m.dead) {
      this.deadIds.add(id);
      const e = this.byId(id);
      if (!e || e.dead) continue;
      e.dead = true;
      e.destroy();
      s.enemies = s.enemies.filter((x) => x !== e);
    }
    for (const key of m.cut) s.applyCut(key, false);
    for (const p of m.pickups) this.spawnRemotePickup(p);
    // Lo que otro levantó mientras no había conexión ya no está (lo recién tirado se respeta).
    const live = new Set(m.pickups.map((p) => p.id));
    for (const p of [...s.pickups]) if (p.netId && !p.taken && !live.has(p.netId) && p.age > 3000) s.removePickup(p);
  }

  newPickupId() {
    this.pickSeq += 1;
    return `${online.id}-${Date.now().toString(36)}-${this.pickSeq}`;
  }

  sharePickup(p) {
    send({ t: "pickAdd", map: this.map, p: { id: p.netId, kind: p.kind, good: p.good, value: p.value, x: Math.round(p.x), y: Math.round(p.y) } });
  }

  spawnRemotePickup(p) {
    const s = this.scene;
    if (s.pickups.some((x) => x.netId === p.id)) return;
    s.spawnPickup(p.kind, p.x, p.y, { good: p.good, value: p.value, dx: 0, dy: 0, netId: p.id });
  }

  removeRemotePickup(id) {
    const p = this.scene.pickups.find((x) => x.netId === id && !x.taken);
    if (p) this.scene.removePickup(p);
  }

  /** Levantar algo del suelo: el servidor dice si llegaste primero. */
  async claimPickup(p) {
    const r = await request({ t: "pickTake", map: this.map, id: p.netId });
    return r.ok;
  }

  cut(key) {
    send({ t: "cut", map: this.map, key });
  }

  // ------------------------------------------------------------------ reloj

  /**
   * Medianoche del servidor: pasa un día para todos. Lo tuyo (contratos, deuda, cobrador) usa ese
   * día; la escarcha que llevas ya se derritió hora por hora (onClockHour), igual que jugando solo.
   */
  onDay() {
    const s = this.scene;
    const report = passDays(s.registry, 1, { cold: coldAt(s.def), meltCargo: false });
    s.afterNewDay?.({ ...report, started: [] });
  }
}
