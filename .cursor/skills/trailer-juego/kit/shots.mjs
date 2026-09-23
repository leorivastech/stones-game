/**
 * Tomas del trailer. Cada toma prepara el juego (setup) y dice qué teclas se aprietan en qué
 * segundo (input). capture.mjs las graba cuadro a cuadro. Ejemplo completo: stones_Game/trailer/shots.mjs
 *
 * input: { at: seg, down: "KeyD" } | { at, up: "KeyD" } | { at, tap: "KeyJ" } | { at, run: async (page) => … }
 *        + sfx: "nombre" (archivo de audio.sfxDir en guion.json) para que suene en ese cuadro.
 * Nombres de teclas de Playwright: KeyA…KeyZ, ArrowUp, Space, Shift, Enter, Escape, Digit1…
 */

// ---------- ayudas propias de ESTE juego (ajustar a sus escenas) ----------

/** Arranca una escena del juego y espera a que esté lista. */
async function startScene(page, key, data = {}) {
  await page.evaluate(([key, data]) => {
    const g = globalThis.__game;
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key);
    g.scene.start(key, data);
  }, [key, data]);
  await page.waitForFunction((key) => globalThis.__game.scene.getScene(key)?.sys.isActive(), key, { timeout: 20000 });
  await page.waitForTimeout(500);
}

/** Coloca al jugador (ajustar: dónde guarda tu escena al jugador). */
const place = (page, scene, x, y) => page.evaluate(([scene, x, y]) => {
  const s = globalThis.__game.scene.getScene(scene);
  s.player.body ? s.player.body.reset(x, y) : s.player.setPosition(x, y);
}, [scene, x, y]);

// ---------- tomas ----------

export default {
  url: "http://127.0.0.1:5183/",   // el puerto del juego (package.json de la raíz)
  size: [800, 450],                 // tamaño nativo del juego (width/height de la config de Phaser)
  out: [1920, 1080],
  fps: 30,
  pixelArt: true,                   // false si el juego no es pixel art

  // Texturas del juego exportadas como PNG (logo para el cierre, etc.)
  stills: [],                       // p. ej. [{ id: "logo", texture: "logo", scale: 6 }]

  shots: [
    {
      id: "portada",
      seconds: 6,
      seed: 1,
      setup: async (page) => {
        await page.waitForTimeout(800);
      },
    },
    {
      id: "juego",
      seconds: 5,
      seed: 2,
      setup: async (page) => {
        await startScene(page, "play");
        await place(page, "play", 120, 225);
      },
      input: [{ at: 0.2, down: "KeyD" }, { at: 3.5, up: "KeyD" }],
    },
  ],
};
