#!/usr/bin/env node
/**
 * Grabador de tomas para trailers. Abre el juego (npm run dev en la raíz), prepara cada toma y la
 * graba CUADRO POR CUADRO: detiene el reloj de Phaser y lo avanza a mano (game.step), así el video
 * sale fluido a 30 fps aunque la máquina (o el navegador sin GPU) vaya lento.
 *
 *   node capture.mjs            # todas las tomas de shots.mjs
 *   node capture.mjs pelea ruta # sólo esas
 *   node capture.mjs --stills   # sólo las imágenes fijas (logo, etc.)
 *
 * Salida: assets/clips/<id>.mp4 (escalado sin suavizar) + <id>.json (duración y eventos de sonido)
 *         assets/stills/<id>.png
 *
 * El juego debe tener el enganche de captura en src/main.js (ver SKILL.md):
 *   ?capture=1 → zoom 1, sin audio, y globalThis.__game = game
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import config from "./shots.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const args = process.argv.slice(2);
const onlyStills = args.includes("--stills");
const wanted = args.filter((a) => !a.startsWith("--"));

const FPS = config.fps ?? 30;
const [GW, GH] = config.size;                 // tamaño nativo del juego
const OUT_W = config.out?.[0] ?? 1920;
const OUT_H = config.out?.[1] ?? 1080;
const SCALER = config.pixelArt === false ? "lanczos" : "neighbor";

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), ".cache/ms-playwright");
  const dirs = existsSync(base) ? readdirSync(base).filter((d) => d.startsWith("chromium-")).sort().reverse() : [];
  for (const d of dirs) {
    const exe = join(base, d, "chrome-linux64/chrome");
    if (existsSync(exe)) return exe;
  }
  throw new Error("No encuentro Chromium. Corre: npx playwright install chromium  (o exporta CHROME=/ruta/al/chrome)");
}

/** PRNG con semilla dentro de la página: la misma toma sale igual cada vez. */
const seedScript = (seed) => `(() => {
  let a = ${seed >>> 0};
  Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();`;

function ffmpegWriter(dest) {
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-vf", `scale=${OUT_W}:${OUT_H}:flags=${SCALER}`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", dest,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((ok, fail) => ff.on("close", (code) => (code ? fail(new Error(`ffmpeg ${code}`)) : ok())));
  return { write: (buf) => new Promise((ok) => (ff.stdin.write(buf) ? ok() : ff.stdin.once("drain", ok))), end: () => { ff.stdin.end(); return done; } };
}

async function openGame(browser, shot = {}) {
  const page = await browser.newPage({ viewport: { width: GW, height: GH } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (shot.seed != null) await page.addInitScript(seedScript(shot.seed));
  await page.goto(`${config.url}${config.url.includes("?") ? "&" : "?"}capture=1`);
  await page.waitForFunction(() => globalThis.__game?.isBooted, null, { timeout: 30000 });
  if (config.ready) await config.ready(page);
  return { page, errors };
}

/** Avanza el juego un cuadro a mano. */
const step = (page, n = 1) => page.evaluate(([n, dt]) => {
  const g = globalThis.__game;
  for (let i = 0; i < n; i += 1) {
    globalThis.__captureTime = (globalThis.__captureTime ?? 0) + dt;
    g.step(globalThis.__captureTime, dt);
  }
}, [n, 1000 / FPS]);

async function recordShot(browser, shot) {
  const { page, errors } = await openGame(browser, shot);
  if (shot.setup) await shot.setup(page);
  // A partir de aquí el tiempo del juego lo manejamos nosotros.
  await page.evaluate(() => {
    const g = globalThis.__game;
    g.loop.stop();
    globalThis.__captureTime = g.loop.time || performance.now();
  });
  await step(page, shot.warmup ?? 8);

  const frames = Math.round((shot.seconds ?? 4) * FPS);
  const clipDir = join(HERE, "assets/clips");
  mkdirSync(clipDir, { recursive: true });
  const out = ffmpegWriter(join(clipDir, `${shot.id}.mp4`));
  const canvas = page.locator("canvas").first();

  // Guion de teclas por cuadro: { at: seg, down|up|tap: "KeyD", run: async (page) => … }
  const inputs = (shot.input ?? []).map((i) => ({ ...i, f: Math.round(i.at * FPS) }));
  const releases = [];
  const events = [];
  for (let f = 0; f < frames; f += 1) {
    for (const r of releases.filter((r) => r.f === f)) await page.keyboard.up(r.key);
    for (const i of inputs.filter((i) => i.f === f)) {
      if (i.down) await page.keyboard.down(i.down);
      if (i.up) await page.keyboard.up(i.up);
      if (i.tap) {
        await page.keyboard.down(i.tap);
        releases.push({ f: f + 2, key: i.tap });
      }
      if (i.run) await i.run(page);
      if (i.sfx) events.push({ t: +(f / FPS).toFixed(3), sfx: i.sfx });
    }
    // Los sonidos que dispara el propio juego en este cuadro (el juego los anota en modo captura).
    await page.evaluate(() => { globalThis.__captureSfx = []; });
    await step(page);
    const heard = await page.evaluate(() => globalThis.__captureSfx ?? []);
    for (const h of heard) events.push({ t: +(f / FPS).toFixed(3), sfx: h.name, vol: h.volume, game: true });
    await out.write(await canvas.screenshot({ type: "png" }));
  }
  await out.end();
  writeFileSync(join(clipDir, `${shot.id}.json`), JSON.stringify({ id: shot.id, fps: FPS, seconds: frames / FPS, events }, null, 1));
  if (errors.length) console.warn(`  ⚠ ${shot.id}: errores del juego →`, errors.slice(0, 3).join(" | "));
  await page.close();
  console.log(`✓ ${shot.id}  ${(frames / FPS).toFixed(1)} s`);
}

async function exportStills(browser) {
  if (!config.stills?.length) return;
  const { page } = await openGame(browser);
  const dir = join(HERE, "assets/stills");
  mkdirSync(dir, { recursive: true });
  for (const s of config.stills) {
    // Toma una textura del juego y la agranda sin suavizar.
    const data = await page.evaluate(([key, scale]) => {
      const src = globalThis.__game.textures.get(key).getSourceImage();
      const c = document.createElement("canvas");
      c.width = src.width * scale;
      c.height = src.height * scale;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL("image/png");
    }, [s.texture, s.scale ?? 4]);
    writeFileSync(join(dir, `${s.id}.png`), Buffer.from(data.split(",")[1], "base64"));
    console.log(`✓ still ${s.id}`);
  }
  await page.close();
}

const browser = await chromium.launch({
  executablePath: findChrome(),
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio"],
});
try {
  await exportStills(browser);
  if (!onlyStills) {
    for (const shot of config.shots) {
      if (wanted.length && !wanted.includes(shot.id)) continue;
      try {
        await recordShot(browser, shot);
      } catch (err) {
        console.error(`✗ ${shot.id}: ${err.message.split("\n")[0]}`);
        process.exitCode = 1;
      }
    }
  }
} finally {
  await browser.close();
}
