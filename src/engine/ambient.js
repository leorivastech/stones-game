/**
 * Ambiente del mapa: partículas por bioma (nieve, ráfagas de arena, hojas y pétalos, polen,
 * luciérnagas de noche, motas en cuevas, chispas de fogata), sombras de nube que se deslizan
 * sobre el suelo y el polvo que levantan los pies al correr.
 *
 * Los emisores viven en coordenadas del mundo (x = y = 0) y su zona de emisión se mueve con la
 * cámara, así lo que ya cayó se queda en su lugar mientras caminas. En mapas que cruzan de un
 * bioma a otro, manda el bioma que hay en el centro de la cámara.
 *
 * Se apaga con `AMBIENT.enabled = false` (src/config.js).
 */

import Phaser from "phaser";
import { AMBIENT, DEPTH, PLAYER, TILE, VIEW_W, VIEW_H } from "../config.js";
import { biomeOf } from "./mapbuild.js";
import * as daylight from "./daylight.js";

const MARGIN = 24;
// Clima entre personajes y velo de la noche (la noche lo oscurece); lo que brilla, por encima.
const WEATHER_DEPTH = DEPTH.fx - 2;
const GLOW_DEPTH = DEPTH.fx + 1;
const CLOUD_DEPTH = DEPTH.decal + 2;

// Qué suelo pisa el jugador → cuadro del polvo que levanta (null = nada: pasto, agua, madera).
const KICK = { dirt: 0, sand: 1, stone: 2, snow: 3 };
const KICK_BY_CELL = { ":": "dirt", X: "dirt", r: "dirt", c: "dirt", F: "dirt", "=": "stone", g: "stone", _: "sand", s: "snow", i: "snow", I: "snow" };
const DEFAULT_CELLS = new Set([".", ",", "x", "t", "o", "O", "b", "f", "|", "h", "^", "k", "y", "e", "d", "p"]);

// Mapas de bosque aunque su bioma sea templado.
const FOREST_MAPS = new Set(["mossgrove"]);
/** Donde salen luciérnagas de noche: selva, bosque y la pradera templada (Ruta 1, Ashfen, Ruta 4). */
const GLOW_BIOMES = new Set(["tropical", "forest", "temperate"]);

const rand = (a, b) => a + Math.random() * (b - a);
/** Aparece y se desvanece en los extremos de la vida (t 0→1). */
const fade = (peak, edge = 0.15) => (p, k, t) => peak * Math.min(1, t / edge, (1 - t) / edge);

/** Vaivén horizontal: cada partícula lleva su fase y amplitud (px/s). */
class Sway extends Phaser.GameObjects.Particles.ParticleProcessor {
  constructor(freq) {
    super(0, 0, true);
    this.freq = freq;
  }

  update(p, delta, step) {
    p.swayT = (p.swayT ?? 0) + delta;
    p.x += Math.sin(p.swayPh + p.swayT * this.freq) * p.swayAmp * step;
  }
}
const seedSway = (amp) => (p) => {
  p.swayPh = Math.random() * Math.PI * 2;
  p.swayAmp = rand(amp * 0.5, amp);
  p.swayT = 0;
};

export class Ambient {
  constructor(scene) {
    this.scene = scene;
    this.def = scene.def;
    this.enabled = AMBIENT.enabled;
    if (!this.enabled) return;
    this.cam = scene.cameras.main;
    this.indoor = Boolean(this.def.dark);
    this.forest = FOREST_MAPS.has(this.def.id ?? scene.mapId);
    this.sets = {};
    this.active = null;
    this.checkIn = 0;
    this.frames = 0;
    this.night = false;
    this.forceNight = null; // pruebas: true / false fuerza la noche
    this.kickIn = 0;
    this.wind = Math.random() < 0.5 ? 1 : -1;
    this.makeAnims();
    this.makeEmitters();
    this.makeSparks();
    this.makeKick();
    this.capParticles();
    this.clouds = AMBIENT.clouds && !this.indoor ? this.makeClouds() : [];
  }

  makeAnims() {
    const a = this.scene.anims;
    const leaf = (key, f0, f1) => a.exists(key) || a.create({ key, frames: [{ key: "amb-leaf", frame: f0 }, { key: "amb-leaf", frame: f1 }], frameRate: 3, repeat: -1 });
    leaf("amb-leaf-green", 0, 1);
    leaf("amb-leaf-amber", 2, 3);
  }

  /** Un emisor pegado a la cámara (zona = vista + margen). `sf` > 1: primer plano con parallax. */
  emitter(tex, cfg, { sf = 1, depth = WEATHER_DEPTH, max = 20, sway = 0 } = {}) {
    const zone = new Phaser.Geom.Rectangle(0, 0, VIEW_W + MARGIN * 2, VIEW_H + MARGIN * 2);
    const e = this.scene.add.particles(0, 0, tex, {
      emitting: false,
      ...cfg,
      emitZone: { type: "random", source: zone },
    });
    e.setDepth(depth).setScrollFactor(sf);
    e.maxAliveParticles = max;
    e.zoneRect = zone;
    e.sf = sf;
    if (sway) e.addParticleProcessor(new Sway(sway));
    return e;
  }

  makeEmitters() {
    const W = this.wind;
    const S = this.sets;
    if (this.indoor) {
      // Cuevas: motas de polvo casi quietas, muy tenues.
      S.cave = [this.emitter("amb-mote", {
        frequency: 1000, lifespan: { min: 6000, max: 8000 }, speedX: { min: -3, max: 3 }, speedY: { min: -4, max: 1 },
        alpha: { onEmit: () => 0, onUpdate: fade(0.45, 0.3) }, emitCallback: seedSway(3),
      }, { max: 8, sway: 0.0012 })];
      return;
    }
    // Nieve: copos lentos que se mecen; unos pocos grandes y rápidos delante (parallax barato).
    S.snow = [
      this.emitter("amb-snow", {
        frame: [0, 1, 1], frequency: 110, lifespan: { min: 5000, max: 7000 },
        speedY: { min: 9, max: 17 }, speedX: { min: 2 * W, max: 6 * W },
        alpha: { onEmit: () => 0, onUpdate: fade(0.95) }, emitCallback: seedSway(10),
      }, { max: 52, sway: 0.0016 }),
      this.emitter("amb-snow", {
        frame: 2, frequency: 420, lifespan: { min: 2600, max: 3400 },
        speedY: { min: 34, max: 46 }, speedX: { min: 6 * W, max: 12 * W },
        alpha: { onEmit: () => 0, onUpdate: fade(0.85) }, emitCallback: seedSway(14),
      }, { sf: 1.35, max: 8, sway: 0.0022 }),
    ];
    // Desierto: la arena sólo vuela en ráfagas (ver gusts()).
    S.desert = [this.emitter("amb-sand", {
      frame: [0, 1, 1, 2, 3], frequency: 20, quantity: 3, lifespan: { min: 800, max: 1400 },
      speedX: { min: 110 * W, max: 170 * W }, speedY: { min: -6, max: 12 }, scaleX: W, // estela hacia atrás del viento
      alpha: { onEmit: () => 0, onUpdate: fade(1, 0.2) },
    }, { max: 64 })];
    this.sandGust = S.desert[0];
    // Hojas que caen "girando" (dos cuadros: de cara y de canto).
    const leaves = (anim, max, freq) => this.emitter("amb-leaf", {
      anim, frequency: freq, lifespan: { min: 5500, max: 7500 },
      speedY: { min: 8, max: 14 }, speedX: { min: 3 * W, max: 9 * W },
      alpha: { onEmit: () => 0, onUpdate: fade(0.95, 0.1) }, emitCallback: seedSway(16),
    }, { max, sway: 0.0019 });
    // Polen y pétalos: casi flotan.
    const pollen = (max, freq, frame = [0, 0, 1, 2]) => this.emitter("amb-pollen", {
      frame, frequency: freq, lifespan: { min: 4500, max: 6500 },
      speedY: { min: -3, max: 4 }, speedX: { min: 2 * W, max: 7 * W },
      alpha: { onEmit: () => 0, onUpdate: fade(0.7, 0.25) }, emitCallback: seedSway(6),
    }, { max, sway: 0.0012 });
    S.tropical = [leaves(["amb-leaf-green"], 11, 560), pollen(4, 1400, [1, 2])];
    S.forest = [leaves(["amb-leaf-green", "amb-leaf-green", "amb-leaf-amber"], 13, 500)];
    S.temperate = [pollen(7, 780)];
    S.mountain = [pollen(5, 1100), leaves(["amb-leaf-amber", "amb-leaf-green"], 3, 2200)];
    // Luciérnagas de noche (selva, bosque y pradera): prenden y apagan despacio, por encima del velo.
    this.fireflies = this.emitter("amb-firefly", {
      frequency: 170, lifespan: { min: 2800, max: 4400 },
      speedX: { min: -6, max: 6 }, speedY: { min: -6, max: 4 },
      alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.min(1, Math.sin(t * Math.PI) * 1.8) * (0.6 + 0.4 * Math.sin(t * 19 + p.swayPh)) },
      emitCallback: seedSway(8), blendMode: Phaser.BlendModes.ADD,
    }, { depth: GLOW_DEPTH, max: 22, sway: 0.003 });
    this.nextGust = rand(1500, 3000);
  }

  /** Chispas que suben de fogatas y fraguas del mapa. */
  makeSparks() {
    this.sparks = [];
    const SRC = { campfire: [8, 5], forge: [16, 14] };
    for (const o of this.def.objects ?? []) {
      const at = o.type === "prop" && SRC[o.art];
      if (!at) continue;
      const x = o.x * TILE + at[0];
      const y = o.y * TILE + at[1];
      const e = this.scene.add.particles(x, y, "amb-ember", {
        frame: [0, 0, 1, 2], frequency: 170, lifespan: { min: 600, max: 1100 },
        x: { min: -3, max: 3 }, speedY: { min: -30, max: -18 }, speedX: { min: -5, max: 5 },
        accelerationX: { min: -12, max: 12 }, alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(GLOW_DEPTH);
      e.maxAliveParticles = 6;
      this.sparks.push(e);
    }
  }

  makeKick() {
    this.kick = this.scene.add.particles(0, 0, "amb-kick", {
      emitting: false, lifespan: 300, speedY: { min: -14, max: -10 }, speedX: { min: -4, max: 4 },
      alpha: { start: 0.9, end: 0 },
    });
    this.kick.maxAliveParticles = 6;
  }

  /** Tope global (AMBIENT.maxParticles): si un bioma + luciérnagas + chispas + polvo se pasa, recorta en proporción. */
  capParticles() {
    const fixed = this.sparks.reduce((n, e) => n + e.maxAliveParticles, 0) + this.kick.maxAliveParticles;
    for (const [k, list] of Object.entries(this.sets)) {
      const glow = GLOW_BIOMES.has(k) && this.fireflies ? [this.fireflies] : [];
      const scaled = [...list, ...glow];
      const total = scaled.reduce((n, e) => n + e.maxAliveParticles, 0);
      const room = AMBIENT.maxParticles - fixed;
      if (total <= room) continue;
      const f = Math.max(0, room) / total;
      for (const e of scaled) e.maxAliveParticles = Math.max(1, Math.floor(e.maxAliveParticles * f));
    }
  }

  makeClouds() {
    const [a0, a1] = AMBIENT.cloudAlpha;
    const speed = rand(...AMBIENT.cloudSpeed);
    const ang = rand(0.25, 0.6); // diagonal, con el viento
    this.cloudV = { x: Math.cos(ang) * speed * this.wind, y: Math.sin(ang) * speed };
    const view = this.cam.worldView;
    const out = [];
    for (let i = 0; i < 3; i += 1) {
      const s = this.scene.add.image(0, 0, `amb-cloud-${i % 2}`).setDepth(CLOUD_DEPTH).setFlipX(i === 1);
      s.baseAlpha = rand(a0, a1);
      s.setAlpha(s.baseAlpha);
      s.fx = view.x + rand(-100, VIEW_W + 100);
      s.fy = view.y + rand(-80, VIEW_H + 80);
      out.push(s);
    }
    return out;
  }

  /** Bioma que manda ahora (el del centro de la cámara). */
  biomeHere() {
    if (this.indoor) return "cave";
    const v = this.cam.worldView;
    const cx = Math.floor((v.x + v.width / 2) / TILE);
    const cy = Math.floor((v.y + v.height / 2) / TILE);
    const b = biomeOf(this.def, cx, cy) ?? "temperate";
    if (this.forest && b === "temperate") return "forest";
    return this.sets[b] ? b : "temperate";
  }

  isNight() {
    if (this.forceNight != null) return this.forceNight;
    try {
      if (typeof daylight.isNight === "function") return Boolean(daylight.isNight(this.scene.registry));
    } catch { /* sin reloj todavía */ }
    return false;
  }

  /**
   * Mueve las zonas de emisión con la cámara. En mapas más chicos que la pantalla (refugios) la zona
   * se recorta al mapa, para que no caigan hojas ni motas sobre el fondo liso de alrededor.
   */
  follow() {
    const { scrollX, scrollY } = this.cam;
    const { W, H } = this.scene.world;
    const all = [...Object.values(this.sets).flat(), this.fireflies].filter(Boolean);
    for (const e of all) {
      const r = e.zoneRect;
      const x0 = scrollX * e.sf - MARGIN;
      const y0 = scrollY * e.sf - MARGIN;
      if (e.sf !== 1) {
        r.x = x0;
        r.y = y0;
        continue;
      }
      r.x = Math.max(x0, 0);
      r.y = Math.max(y0, 0);
      r.width = Math.max(1, Math.min(x0 + VIEW_W + MARGIN * 2, W) - r.x);
      r.height = Math.max(1, Math.min(y0 + VIEW_H + MARGIN * 2, H) - r.y);
    }
  }

  /** Enciende el juego de emisores del bioma y deja que el resto se apague solo. */
  select(biome) {
    if (biome === this.active) return;
    for (const [k, list] of Object.entries(this.sets)) {
      for (const e of list) {
        if (k === biome && e !== this.sandGust) e.start();
        else e.stop();
      }
    }
    this.active = biome;
    this.nextGust = Math.min(this.nextGust, rand(1500, 3000));
  }

  update(dt) {
    if (!this.enabled) return;
    this.follow();
    this.checkIn -= dt;
    if (this.checkIn <= 0) {
      this.checkIn = 500;
      this.select(this.biomeHere());
      const night = this.isNight();
      const glow = night && GLOW_BIOMES.has(this.active);
      if (glow !== this.glowOn) {
        this.glowOn = glow;
        if (glow) {
          this.fireflies?.start();
          if (this.frames < 10) this.fireflies?.fastForward(3000, 50); // al entrar ya están ahí
        } else this.fireflies?.stop();
      }
      this.night = night;
    }
    this.frames += 1;
    if (this.frames === 3) {
      // Al entrar el cielo ya tiene lo suyo (la cámara ya llegó al jugador): adelanta unos segundos.
      for (const list of Object.values(this.sets)) for (const e of list) if (e.emitting) e.fastForward(4000, 50);
      for (const e of this.sparks) e.fastForward(1000, 50);
    }
    this.gusts(dt);
    this.moveClouds(dt);
  }

  /** Arena: se enciende 1-2 s cada 6-12 s. */
  gusts(dt) {
    if (this.active !== "desert" || !this.sandGust) return;
    this.nextGust -= dt;
    if (this.nextGust > 0) return;
    this.nextGust = rand(6000, 12000);
    this.sandGust.start(0, rand(1000, 2000));
  }

  /** Nubes: derivan en diagonal y, al salir de la vista (con margen), vuelven por el otro lado. */
  moveClouds(dt) {
    if (!this.clouds.length) return;
    const v = this.cam.worldView;
    const M = 120;
    const rw = VIEW_W + M * 2;
    const rh = VIEW_H + M * 2;
    const x0 = v.x - M;
    const y0 = v.y - M;
    const k = dt / 1000;
    const nightMul = this.night ? 0.35 : 1;
    for (const s of this.clouds) {
      s.fx += this.cloudV.x * k;
      s.fy += this.cloudV.y * k;
      s.fx = x0 + ((((s.fx - x0) % rw) + rw) % rw);
      s.fy = y0 + ((((s.fy - y0) % rh) + rh) % rh);
      s.setPosition(Math.round(s.fx), Math.round(s.fy));
      s.setAlpha(s.baseAlpha * nightMul);
    }
  }

  /**
   * Pies del jugador: al correr o rodar sobre tierra, arena, adoquín o nieve suelta una mota
   * cada 90-120 ms detrás de los talones. En el pasto no: ahí ya saltan trocitos.
   */
  feet(player, dt) {
    if (!this.enabled) return;
    const s = player.sprite;
    const b = player.body;
    const fast = player.state === "roll" || (player.state === "move" && player.running && !player.crouching);
    if (!fast || player.inGrass || !b || Math.hypot(b.velocity.x, b.velocity.y) < PLAYER.walk + 8) {
      this.kickIn = Math.min(this.kickIn, 40);
      return;
    }
    this.kickIn -= dt;
    if (this.kickIn > 0) return;
    this.kickIn = rand(90, 120);
    const world = this.scene.world;
    const ch = world.cellAt(s.x, s.y - 2);
    let ground = KICK_BY_CELL[ch];
    if (!ground && DEFAULT_CELLS.has(ch)) {
      const biome = biomeOf(this.def, Math.floor(s.x / TILE), Math.floor((s.y - 2) / TILE));
      ground = biome === "desert" ? "sand" : biome === "snow" ? "snow" : null;
    }
    if (this.indoor && !ground) ground = "stone";
    if (!ground) return;
    const v = b.velocity;
    const len = Math.hypot(v.x, v.y) || 1;
    this.kick.setEmitterFrame(KICK[ground]);
    this.kick.setDepth(s.y - 1);
    this.kick.emitParticleAt(s.x - (v.x / len) * 4 + rand(-1.5, 1.5), s.y - 1 - (v.y / len) * 2, 1);
  }
}
