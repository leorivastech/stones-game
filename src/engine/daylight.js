/**
 * Día y noche. Un reloj (`hour`, 0-24 en el registro, se guarda con la partida) que corre en todos
 * los mapas: 24 horas del juego en 4 minutos reales. Con él se pinta un velo de color
 * (blendMode MULTIPLY) sobre el mundo y se prenden luces (blendMode ADD) en faroles, fogatas,
 * fraguas y ventanas. Igual en WebGL que en Canvas.
 *
 * Para otros sistemas: hourOf, isNight, daylightPhase, sunAngle, sunLength, sunStrength.
 */

import Phaser from "phaser";
import { DEPTH, VIEW_W, VIEW_H } from "../config.js";
import { online, dayProgress } from "../net/online.js";

/** Segundos reales que dura un día del juego (Leo: 4 minutos). */
export const DAY_SECONDS = 240;
/** Hora al llegar a un pueblo tras un viaje y al despertar en el catre. */
export const ARRIVAL_HOUR = 8;
export const WAKE_HOUR = 7;

const wrap = (h) => ((h % 24) + 24) % 24;

/** Hora del juego (0-24, con decimales). En línea sale del día del servidor: cada día amanece a las 6. */
export function hourOf(reg) {
  if (online.on && online.dayMs) return wrap(6 + dayProgress() * 24);
  return wrap(reg.get("hour") ?? ARRIVAL_HOUR);
}

/** Pone la hora (sin efecto en línea: allá la hora es de todos). */
export function setHour(reg, h) {
  if (!online.on) reg.set("hour", wrap(h));
}

/** De 20:00 a 5:00. */
export function isNight(reg) {
  const h = hourOf(reg);
  return h >= 20 || h < 5;
}

/** 'dia' | 'atardecer' | 'noche' | 'amanecer'. */
export function daylightPhase(reg) {
  const h = hourOf(reg);
  if (h >= 20 || h < 5) return "noche";
  if (h < 7) return "amanecer";
  if (h < 17) return "dia";
  return "atardecer";
}

// Arco del sol (y de la luna de noche): sale por el este a las 6, arriba a las 12, se pone al oeste a las 18.
const arc = (reg) => wrap(hourOf(reg) - 6) % 12;

/**
 * Hacia dónde está el sol visto desde arriba, en radianes de pantalla (0 = derecha/este,
 * -π/2 = arriba/norte, π = izquierda/oeste). La sombra cae hacia sunAngle + π.
 * De noche la luna hace el mismo recorrido.
 */
export function sunAngle(reg) {
  return -arc(reg) * (Math.PI / 12);
}

/** Largo relativo de la sombra: 0.15 al mediodía, 1 al salir o ponerse el sol. */
export function sunLength(reg) {
  return 0.15 + 0.85 * (1 - Math.sin((arc(reg) / 12) * Math.PI));
}

/** Qué tan marcada va la sombra: 1 de día, ~0.35 con la luna. */
export function sunStrength(reg) {
  const h = hourOf(reg);
  const day = h >= 6 && h < 18 ? 1 : 0.35;
  // A las 6 y a las 18 el sol y la luna se relevan y la sombra cambia de lado: se apaga
  // del todo justo en ese instante para que el salto no se vea.
  const edge = (a, b) => Phaser.Math.Clamp((h - a) / (b - a), 0, 1);
  if (h >= 5.5 && h < 6) return 0.35 * (1 - edge(5.5, 6));
  if (h >= 6 && h < 6.5) return edge(6, 6.5);
  if (h >= 17.5 && h < 18) return 1 - edge(17.5, 18);
  if (h >= 18 && h < 18.5) return 0.35 * edge(18, 18.5);
  return day;
}

// ------------------------------------------------------------------ colores

// Color del velo por hora. Se multiplica sobre el mundo con alpha 1 (blanco = no cambia nada),
// así Canvas y WebGL dan lo mismo.
const SKY = [
  [0, 0x5a6aa8],
  [4, 0x5a6aa8],
  [5, 0x7a78b4],
  [6, 0xe0a0b4], // amanecer rosado
  [7, 0xffe0d8],
  [8.5, 0xffffff],
  [16, 0xffffff],
  [17.2, 0xfff0d8],
  [18.3, 0xffc088], // atardecer naranja
  [19.3, 0xc088a8],
  [20.3, 0x6a74b0],
  [21.5, 0x5a6aa8],
  [24, 0x5a6aa8],
];
// Cuevas: noche suave todo el tiempo.
const CAVE = 0x8478a8;

function lerpColor(a, b, t) {
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255;
  const br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export function skyColor(h) {
  for (let i = 1; i < SKY.length; i += 1) {
    const [h1, c1] = SKY[i];
    if (h <= h1) {
      const [h0, c0] = SKY[i - 1];
      const t = (h - h0) / (h1 - h0);
      return lerpColor(c0, c1, t * t * (3 - 2 * t));
    }
  }
  return SKY[0][1];
}

/** Qué tanto se prenden las luces (0 a mediodía, 1 de noche). */
export function lightLevel(h) {
  if (h >= 20.5 || h < 5) return 1;
  if (h >= 17.5) return (h - 17.5) / 3;
  if (h < 7.5) return 1 - (h - 5) / 2.5;
  return 0;
}

// ------------------------------------------------------------------ luces

// Qué textura del mapa da luz, dónde (en px dentro de la textura) y cómo.
const SOURCES = {
  lamp: { spots: [[5, 5]], tex: "light-warm-64", alpha: 0.85 },
  campfire: { spots: [[8, 9]], tex: "light-warm-96", alpha: 1, flicker: true },
  forge: { spots: [[16, 18]], tex: "light-warm-96", alpha: 0.9, flicker: true },
};

/** Ventanas encendidas de una casa (las anota src/art/lights.js en la meta de la textura). */
const houseWindows = (scene, key) => scene.registry.get(`meta-${key}`)?.windows ?? [];

export class Daylight {
  constructor(scene, def) {
    this.scene = scene;
    this.reg = scene.registry;
    this.cave = Boolean(def.dark);
    if (!online.on && this.reg.get("hour") == null) this.reg.set("hour", ARRIVAL_HOUR);

    // Canvas: Phaser revisa si el navegador sabe "multiply" con una prueba asíncrona que termina después
    // de armar su tabla de mezclas, y se queda con "source-over" (el velo taparía todo). Todos los
    // navegadores de hoy lo saben: se corrige la tabla.
    const r = scene.sys.renderer;
    if (r.type === Phaser.CANVAS && r.blendModes?.[Phaser.BlendModes.MULTIPLY] === "source-over") {
      r.blendModes[Phaser.BlendModes.MULTIPLY] = "multiply";
    }
    // Velo del tamaño de la cámara (con margen por si tiembla).
    this.veil = scene.add.rectangle(-16, -16, VIEW_W + 32, VIEW_H + 32, 0xffffff, 1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.fx - 1).setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.lights = [];
    for (const obj of [...scene.children.list]) {
      const key = obj.texture?.key;
      if (!key) continue;
      if (key.startsWith("house-")) {
        for (const [x, y] of houseWindows(scene, key)) this.addLight(obj, x, y, { tex: "light-warm-48", alpha: 0.55 });
      } else if (SOURCES[key]) {
        for (const [x, y] of SOURCES[key].spots) this.addLight(obj, x, y, SOURCES[key]);
      }
    }
    this.update(0);
  }

  addLight(obj, lx, ly, spec) {
    const fw = obj.frame?.width ?? obj.width;
    const x = Math.round(obj.x - obj.displayOriginX + (obj.flipX ? fw - lx : lx));
    const y = Math.round(obj.y - obj.displayOriginY + ly);
    const img = this.scene.add.image(x, y, spec.tex).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const light = { img, base: spec.alpha, flick: { v: 0 } };
    if (spec.flicker) {
      this.scene.tweens.add({
        targets: light.flick, v: { from: -0.08, to: 0.08 }, yoyo: true, repeat: -1,
        duration: Phaser.Math.Between(600, 1100), ease: "Sine.easeInOut",
      });
    }
    this.lights.push(light);
  }

  /** Corre el reloj y repinta. Llamar en cada update de la escena, también con diálogos abiertos. */
  update(delta) {
    const reg = this.reg;
    if (!online.on && delta > 0) {
      // Sin evento changedata en cada cuadro (la interfaz se repinta con cada set): se escribe directo
      // y sólo se avisa al cruzar la hora entera (el HUD cambia sol/luna).
      const before = hourOf(reg);
      const now = wrap(before + (delta / 1000) * (24 / DAY_SECONDS));
      if (Math.floor(now) !== Math.floor(before)) reg.set("hour", now);
      else reg.list.hour = now;
    }
    const h = hourOf(reg);
    // El HUD (sol / luna) sólo se repinta con cambios del registro: se le avisa al cambiar.
    const night = h >= 20 || h < 5;
    if (night !== this.night) {
      this.night = night;
      this.scene.ui?.refresh?.();
    }
    const color = this.cave ? CAVE : skyColor(h);
    this.veil.setFillStyle(color, 1).setVisible(color !== 0xffffff);
    const level = this.cave ? 0.9 : lightLevel(h);
    for (const l of this.lights) {
      const a = level > 0 ? level * (l.base + l.flick.v) : 0;
      l.img.setAlpha(Phaser.Math.Clamp(a, 0, 1)).setVisible(a > 0.01);
    }
  }
}
