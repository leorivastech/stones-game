/**
 * El mapa actual en el modo en línea: lo que se comparte con los otros jugadores mientras andas
 * por un pueblo, una ruta o un refugio. Se engancha a WorldScene (scene.net) sólo con ?online=1.
 *
 *  - Fantasmas: ves a los otros caminar (sin chocar). Envías tu posición 10 veces por segundo.
 *  - Enemigos: el primero que llegó al mapa los "manda": corre su IA y cuenta dónde están.
 *    Los demás ven títeres que copian eso; sus golpes se le mandan al que manda. Los enemigos
 *    persiguen al jugador más cercano, sea de este aparato o de otro.
 *  - Piedras y monedas tiradas, arbustos y pasto cortado, cofres, rejas y refugios: iguales para todos.
 */

import { online, onNet, send, request, playersIn } from "./online.js";
import { voice } from "./voice.js";
import { DEPTH } from "../config.js";
import { day, passDays, stones, debtDue, coldAt } from "../state.js";

const POS_MS = 100;
const SNAP_MS = 100;

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
    this.offs = [];
    const on = (t, fn) => this.offs.push(onNet(t, (m) => { if (this.scene.sys.isActive()) fn(m); }));

    on("mapState", (m) => m.map === this.map && this.applyMapState(m));
    on("auth", (m) => m.map === this.map && this.becomeAuthority());
    on("pos", (m) => this.onPos(m));
    on("where", (m) => { if (m.map !== this.map) this.dropGhost(m.id); });
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
    on("reconnected", () => { this.announce(); this.scene.ui.toast("Conexión de vuelta", "font-green"); });
    on("offline", () => this.scene.ui.toast("Sin conexión… reintentando", "font-red"));

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
  }

  // ------------------------------------------------------------------ bucle

  update(dt, busy) {
    const s = this.scene;
    // Si mando a los enemigos, siguen vivos aunque yo esté en un menú: el otro los sigue viendo.
    if (busy && this.auth) {
      for (const e of s.enemies) if (!e.dead) e.update(dt);
    }
    for (const e of s.enemies) if (e.puppet && !e.dead) this.puppetUpdate(e, dt);
    for (const g of this.ghosts.values()) this.ghostUpdate(g, dt);
    this.posTimer -= dt;
    if (this.posTimer <= 0) { this.posTimer = POS_MS; this.sendPos(busy); }
    if (this.auth) {
      this.snapTimer -= dt;
      if (this.snapTimer <= 0) { this.snapTimer = SNAP_MS; this.sendSnap(); }
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
    });
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
    const label = s.add.bitmapText(m.x, m.y - 30, "font-o", m.name ?? "?").setOrigin(0.5, 1).setDepth(DEPTH.fx);
    const g = { id: m.id, sprite, shadow, label, target: m };
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
    g.label.setPosition(Math.round(sp.x), Math.round(sp.y - 26)).setText(`${talking ? "» " : ""}${online.players.get(g.id)?.name ?? t.name ?? "?"}`);
  }

  dropGhost(id) {
    const g = this.ghosts.get(id);
    if (!g) return;
    g.sprite.destroy();
    g.shadow.destroy();
    g.label.destroy();
    this.ghosts.delete(id);
  }

  /** Los blancos posibles para los enemigos: yo y los que andan en este mapa. */
  targets() {
    const list = [this.scene.player];
    for (const g of this.ghosts.values()) list.push(g.proxy);
    return list;
  }

  // ------------------------------------------------------------------ enemigos

  becomeAuthority() {
    this.auth = true;
    for (const e of this.scene.enemies) {
      if (!e.puppet) continue;
      e.puppet = false;
      if (e.dead) continue;
      e.body?.setVelocity(0, 0);
      // Lo que traía del otro aparato (una embestida a medias, un salto) no tiene sus datos aquí:
      // cada enemigo vuelve a como empezó y sigue con su propia cabeza.
      e.setState(e.spawnState ?? "idle");
      e.knockTime = 0;
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
      list.push({
        id: e.netId, x: Math.round(sp.x), y: Math.round(sp.y), tex: sp.texture.key, fr: sp.frame.name, fl: sp.flipX ? 1 : 0,
        a: sp.alpha, v: sp.visible ? 1 : 0, st: e.state, f: e.facing, h: e.hostile ? 1 : 0, s: Math.round((e.suspicion ?? 0) * 100) / 100,
        b: e.bubble?.texture?.key ?? null, d: e.dead ? 1 : 0,
      });
    }
    if (list.length) send({ t: "esnap", map: this.map, list });
  }

  applySnap(list) {
    for (const n of list) {
      const e = this.byId(n.id);
      if (!e || !e.puppet) continue;
      e.netTarget = n;
      if (n.d && !e.dead) { e.die(); continue; }
      if (e.dead) continue;
      const sp = e.sprite;
      if (n.tex && this.scene.textures.exists(n.tex)) sp.setTexture(n.tex, n.fr);
      sp.setFlipX(Boolean(n.fl)).setAlpha(n.a ?? 1).setVisible(Boolean(n.v));
      e.state = n.st;
      e.facing = n.f ?? e.facing;
      e.hostile = Boolean(n.h);
      if (e.suspicion != null) e.suspicion = n.s ?? 0;
      const bubble = e.bubble?.texture?.key ?? null;
      if (n.b !== bubble) {
        if (n.b) e.showBubble(n.b, 0);
        else { e.bubble?.destroy(); e.bubble = null; }
      }
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
    if (!e.puppet && e.netId != null) send({ t: "edie", map: this.map, id: e.netId });
  }

  onRemoteDeath(id) {
    const e = this.byId(id);
    if (e && !e.dead) e.die();
  }

  /** Un enemigo mío le pegó al jugador de otro aparato. */
  damageRemote(t, halves, src, opts = {}) {
    const now = this.scene.time.now;
    if (now - (this.lastHit.get(t.id) ?? -9999) < 450) return;
    this.lastHit.set(t.id, now);
    const c = src.center ? src.center() : src;
    send({ t: "pdmg", to: t.id, map: this.map, dmg: halves, fx: Math.round(c.x), fy: Math.round(c.y), steal: Boolean(opts.steal) });
  }

  onRemoteDamage(m) {
    if (m.map !== this.map) return;
    this.scene.damagePlayer(m.dmg, { x: m.fx, y: m.fy }, { steal: m.steal });
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
      const e = this.byId(id);
      if (!e) continue;
      e.dead = true;
      e.destroy();
      s.enemies = s.enemies.filter((x) => x !== e);
    }
    for (const key of m.cut) s.applyCut(key, false);
    for (const p of m.pickups) this.spawnRemotePickup(p);
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

  onDay(m) {
    const s = this.scene;
    const reg = s.registry;
    // Lo personal de un día: la escarcha que llevas se derrite (menos en tierra fría; nada en la
    // cueva fría, igual que fuera de línea).
    const report = passDays(reg, 1, { cold: coldAt(s.def) });
    s.ui.toast(`Amanece: día ${day(reg)}`, "font-gold");
    if (report.melted) {
      s.noteTripMelt?.(report.melted);
      s.ui.toast(`Se te derritió la escarcha (${report.melted})`, "font-red");
    }
    s.refreshSigns();
    if (s.def.kind === "town" && !s.modal && debtDue(reg)) s.runModal(() => s.debtCollector());
  }
}
