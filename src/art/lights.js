/**
 * Luces para la noche: manchas radiales pixeladas que se suman (blendMode ADD) sobre el velo del
 * día (src/engine/daylight.js). Anillos cuantizados con trama Bayer entre uno y otro: nada de
 * degradado suave. Más el iconito de sol / luna del HUD.
 */

import { Buf, bayer, sprite } from "./pixel.js";
import { rgba } from "./palette.js";

// Anillos de afuera hacia adentro. Colores oscuros a propósito: al sumarse, un color claro lava todo.
const RAMPS = {
  // Rampa de paja hacia el oro: amarillo cálido sin tirar a rosa sobre el azul de la noche.
  warm: ["o0", "t0", "t1", "y1", "y2"],
  cool: ["w0", "b1", "w1", "w2", "w3"],
};

/** Mancha de luz de `size`×`size`: 5 anillos con trama entre ellos. */
export function lightBlob(size, tone = "warm") {
  const ramp = RAMPS[tone];
  const b = new Buf(size, size);
  const c = (size - 1) / 2;
  const n = ramp.length;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - c, y - c) / (size / 2);
      if (d >= 1) continue;
      // Caída más rápida afuera: el centro se ve lleno y la orilla se deshace en trama.
      const v = (1 - d) ** 1.3 * n;
      let level = Math.floor(v);
      if (bayer(x, y) < v - level) level += 1;
      if (level > 0) b.set(x, y, ramp[Math.min(n, level) - 1]);
    }
  }
  return b;
}

/** Sol y luna de 7×7 para el HUD: cuadro 0 = sol, 1 = luna. */
export function skyIcon() {
  const sun = sprite([
    "...c...",
    ".c...c.",
    "..bbb..",
    "c.bab.c",
    "..bbb..",
    ".c...c.",
    "...c...",
  ], { a: "y5", b: "y3", c: "y2" });
  const moon = sprite([
    "..aaa..",
    ".aab...",
    "aab....",
    "aab....",
    "aab....",
    ".aab...",
    "..aaa..",
  ], { a: "n4", b: "n2" });
  const both = new Buf(14, 7);
  both.blit(sun, 0, 0);
  both.blit(moon, 7, 0);
  return { buf: both, frameWidth: 7, frameHeight: 7, frames: 2 };
}

/** Ventanas encendidas de una casa: cada una empieza con un cuadrito y5 arriba a la izquierda. */
export function litWindows(buf) {
  const lit = rgba("y5");
  const on = (x, y) => buf.get(x, y) === lit;
  const spots = [];
  for (let y = 0; y < buf.h; y += 1) {
    for (let x = 0; x < buf.w; x += 1) if (on(x, y) && !on(x - 1, y) && !on(x, y - 1)) spots.push([x + 4, y + 4]);
  }
  return spots;
}

/**
 * Texturas de luz para el catálogo (index.js). De paso anota en la meta de cada casa dónde están
 * sus ventanas encendidas (daylight.js pone ahí las luces).
 */
export function lightArt(catalog = []) {
  for (const entry of catalog) {
    if (entry.key.startsWith("house-") && entry.buf) entry.meta = { ...entry.meta, windows: litWindows(entry.buf) };
  }
  const out = [];
  for (const size of [48, 64, 96]) {
    out.push({ key: `light-warm-${size}`, buf: lightBlob(size, "warm") });
    out.push({ key: `light-cool-${size}`, buf: lightBlob(size, "cool") });
  }
  out.push({ key: "ui-sky", ...skyIcon() });
  return out;
}
