/**
 * Tomas del trailer de Stones. Cada toma prepara el juego (setup) y dice qué teclas se aprietan
 * en qué segundo (input). capture.mjs las graba cuadro a cuadro.
 *
 * Teclas de Stones: WASD mover · J golpe · K rodar/correr · L agacharse · E usar · Escape pausa
 */

// ---------- ayudas propias de Stones (lo único que cambia de juego a juego) ----------

/** Arranca la partida en un mapa y espera a que el mundo esté listo. */
async function startAt(page, map, entry = "start", state = {}) {
  await page.evaluate(([map, entry, state]) => {
    const g = globalThis.__game;
    localStorage.clear();
    const title = g.scene.getScene("title");
    title.registry.set({
      gold: 40, cargo: { amber: 0, rune: 0, rain: 0, sun: 0, frost: 0 }, baseCapacity: 4, reputation: 0, trips: 0,
      currentTown: "ashfen", heat: { ashfen: 0, valkeep: 0, verdelume: 0, duneshade: 0, frostholm: 0 },
      stock: { ashfen: 5, valkeep: 5, verdelume: 5, duneshade: 5, frostholm: 5 },
      demand: { ashfen: 4, valkeep: 4, verdelume: 4, duneshade: 4, frostholm: 4 },
      upgrades: { horse: false, escort: false, hideout: false }, hp: 6, maxHp: 6,
      flags: { "hint-route": true, "visited-ashfen": true }, mapId: map, ...state,
    });
    if (!g.scene.isActive("ui")) g.scene.start("ui");
    g.scene.stop("title");
    g.scene.start("world", { map, entry });
  }, [map, entry, state]);
  await page.waitForFunction(() => {
    const w = globalThis.__game.scene.getScene("world");
    return w?.sys.isActive() && w.player && w.ui?.def;
  }, null, { timeout: 20000 });
  await page.waitForTimeout(600);
}

/** Mueve al jugador a una celda (x, y en cuadros de 16 px) y centra la cámara. */
const place = (page, x, y, facing = "down") => page.evaluate(([x, y, facing]) => {
  const w = globalThis.__game.scene.getScene("world");
  w.player.body.reset(x * 16, y * 16);
  w.player.facing = facing;
  w.player.faceIdle();
  w.cameras.main.centerOn(x * 16, y * 16 - 8);
}, [x, y, facing]);

/** Esconde el HUD (tomas limpias) o lo deja. */
const hud = (page, visible) => page.evaluate((v) => {
  globalThis.__game.scene.getScene("ui").cameras.main.setVisible(v);
}, visible);

/** Quita enemigos lejanos para que la toma no se ensucie. */
const onlyEnemiesNear = (page, x, y, r) => page.evaluate(([x, y, r]) => {
  const w = globalThis.__game.scene.getScene("world");
  for (const e of w.enemies) {
    if (Math.hypot(e.x - x * 16, e.y - y * 16) > r * 16) { e.dead = true; e.destroy(); }
  }
}, [x, y, r]);

const setCargo = (page, amber) => page.evaluate((a) => {
  globalThis.__game.scene.getScene("world").registry.set("cargo", { amber: a, rune: 0, rain: 0, sun: 0, frost: 0 });
}, amber);

// ---------- tomas ----------

export default {
  url: "http://127.0.0.1:5181/",
  size: [480, 270],
  out: [1920, 1080],
  fps: 30,
  pixelArt: true,

  stills: [{ id: "logo", texture: "logo", scale: 6 }],

  shots: [
    {
      id: "titulo",
      seconds: 8,
      seed: 1,
      // Ashfen de fondo con la cámara paseando, sin el menú (el logo lo pone el trailer).
      setup: async (page) => {
        await page.waitForTimeout(800);
        await page.evaluate(() => globalThis.__game.scene.getScene("title").cameras.cameras[1].setVisible(false));
      },
    },
    {
      id: "pueblo",
      seconds: 6,
      seed: 2,
      setup: async (page) => {
        await startAt(page, "ashfen");
        await hud(page, false);
        await place(page, 8.5, 17.4, "right");
      },
      input: [{ at: 0.2, down: "KeyD" }, { at: 5.8, up: "KeyD" }],
    },
    {
      id: "mercado",
      seconds: 5,
      seed: 3,
      setup: async (page) => {
        await startAt(page, "ashfen");
        await place(page, 20.1, 13.5, "right");
      },
      input: [
        { at: 0.4, tap: "KeyE" },
        { at: 1.4, tap: "KeyE", sfx: "sack" },
        { at: 2.2, tap: "KeyE", sfx: "sack" },
        { at: 3.0, tap: "KeyE", sfx: "sack" },
      ],
    },
    {
      id: "reten",
      seconds: 6.5,
      seed: 4,
      setup: async (page) => {
        await startAt(page, "ruta1", "south");
        await setCargo(page, 3);
        await onlyEnemiesNear(page, 25.5, 61, 6);
        await page.evaluate(() => {
          const w = globalThis.__game.scene.getScene("world");
          for (const e of w.enemies) if (!e.dead && !e.spec.post) { e.dead = true; e.destroy(); }
        });
        await place(page, 25.5, 64.5, "up");
      },
      input: [
        { at: 0.2, down: "KeyW" },
        { at: 1.4, up: "KeyW" },
        { at: 2.6, tap: "KeyE" },
        { at: 4.6, tap: "KeyE" },
      ],
    },
    {
      id: "pasto",
      seconds: 5,
      seed: 5,
      setup: async (page) => {
        await startAt(page, "ruta1", "south");
        await setCargo(page, 3);
        await onlyEnemiesNear(page, 0, 0, 0);
        await hud(page, false);
        await place(page, 22.2, 84.6, "right");
      },
      input: [
        { at: 0.2, down: "KeyD" },
        { at: 1.1, up: "KeyD" },
        { at: 1.5, down: "KeyL" },
        { at: 2.0, down: "KeyD" },
        { at: 2.9, up: "KeyD" },
      ],
    },
    {
      id: "guardia",
      seconds: 6,
      seed: 6,
      setup: async (page) => {
        await startAt(page, "ruta1", "south");
        await setCargo(page, 3);
        await onlyEnemiesNear(page, 22, 68, 5);
        await page.evaluate(() => {
          const w = globalThis.__game.scene.getScene("world");
          for (const e of w.enemies) {
            if (e.dead) continue;
            if (e.spec.post) { e.dead = true; e.destroy(); continue; }
            e.body.reset(22 * 16, 64.5 * 16);
            e.patrolIndex = 0;
            e.patrolStep = 1;
            e.setState("patrol");
          }
        });
        await hud(page, false);
        await place(page, 19.6, 70.6, "up");
      },
      // El guardia baja por la calzada, te ve con carga (?, !) y corres por el pasto.
      input: [
        { at: 1.25, down: "KeyA", sfx: "horn" },
        { at: 1.3, down: "KeyK" },
        { at: 2.6, down: "KeyW" },
        { at: 5.9, up: "KeyA" },
        { at: 5.9, up: "KeyW" },
        { at: 5.9, up: "KeyK" },
      ],
    },
    {
      id: "bandido",
      seconds: 6,
      seed: 7,
      setup: async (page) => {
        await startAt(page, "ruta1", "south");
        await setCargo(page, 3);
        await page.evaluate(() => {
          const w = globalThis.__game.scene.getScene("world");
          for (const e of w.enemies) if (!e.dead && e.spec.kind !== "bandit") { e.dead = true; e.destroy(); }
        });
        await hud(page, false);
        // En el sendero del bosque, llegando al campamento.
        await place(page, 12.2, 63.6, "up");
      },
      input: [
        { at: 0.2, down: "KeyW" },
        { at: 0.25, down: "KeyA" },
        { at: 1.4, up: "KeyW" },
        { at: 1.6, up: "KeyA" },
        { at: 1.8, tap: "KeyJ", sfx: "knife" },
        { at: 2.3, tap: "KeyJ", sfx: "knife" },
        { at: 2.8, tap: "KeyJ", sfx: "knife" },
        { at: 3.3, tap: "KeyJ", sfx: "knife" },
        { at: 3.8, tap: "KeyJ", sfx: "knife" },
        { at: 4.3, tap: "KeyJ", sfx: "knife" },
      ],
    },
    {
      id: "jabali",
      seconds: 5,
      seed: 8,
      setup: async (page) => {
        await startAt(page, "ruta1", "south");
        await page.evaluate(() => {
          const w = globalThis.__game.scene.getScene("world");
          for (const e of w.enemies) {
            if (e.dead) continue;
            if (e.spec.kind === "boar" && e.spec.y === 92) e.body.reset(22 * 16, 91.8 * 16);
            else { e.dead = true; e.destroy(); }
          }
        });
        await hud(page, false);
        // Con el árbol de (16, 91) a la espalda: el jabalí embiste, te apartas y se estrella.
        await place(page, 17.4, 91.9, "right");
      },
      input: [
        { at: 0.75, down: "KeyW" },
        { at: 1.0, up: "KeyW" },
        { at: 1.35, down: "KeyS" },
        { at: 1.4, up: "KeyS" },
        { at: 1.5, tap: "KeyJ", sfx: "knife" },
        { at: 1.9, tap: "KeyJ", sfx: "knife" },
        { at: 2.4, tap: "KeyJ", sfx: "knife" },
      ],
    },
    {
      id: "palanca",
      seconds: 5,
      seed: 9,
      setup: async (page) => {
        await startAt(page, "ruta1", "south");
        await onlyEnemiesNear(page, 0, 0, 0);
        await hud(page, false);
        await place(page, 20.5, 34.4, "down");
      },
      input: [{ at: 0.5, tap: "KeyE", sfx: "latch" }],
    },
    {
      id: "valkeep",
      seconds: 5,
      seed: 10,
      setup: async (page) => {
        await startAt(page, "ruta1", "north");
        await setCargo(page, 3);
      },
      input: [
        { at: 0, run: (page) => page.evaluate(() => globalThis.__game.scene.getScene("world").scene.restart({ map: "valkeep", entry: "south" })) },
        { at: 0.6, down: "KeyW" },
        { at: 4.9, up: "KeyW" },
      ],
    },
    {
      id: "mapa",
      seconds: 3.5,
      seed: 11,
      setup: async (page) => {
        await startAt(page, "valkeep", "start", { flags: { "visited-ashfen": true, "visited-valkeep": true, "hint-route": true } });
      },
      input: [{ at: 0.3, tap: "Escape" }],
    },
  ],
};
