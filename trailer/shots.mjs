/**
 * Tomas del trailer de Stones (v2, mundo completo). Cada toma prepara el juego (setup) y dice qué
 * teclas se aprietan en qué segundo (input). capture.mjs las graba cuadro a cuadro.
 *
 * Teclas: WASD mover · J golpe · K rodar/correr · L agacharse · E usar · Escape pausa
 * Los sonidos que dispara el juego (golpes, flechas, pasos, gemas…) se anotan solos; `sfx` en un
 * input sólo hace falta para sonidos que el juego no hace (cuerno en una toma cortada, etc.).
 */

// ---------- ayudas propias de Stones ----------

const TOWNS = ["ashfen", "valkeep", "verdelume", "duneshade", "frostholm"];

/** Arranca la partida en un mapa con un estado razonable y espera a que el mundo esté listo. */
async function startAt(page, map, entry = "start", state = {}) {
  await page.evaluate(([map, entry, state, towns]) => {
    const g = globalThis.__game;
    localStorage.clear();
    const per = (v) => Object.fromEntries(towns.map((t) => [t, v]));
    const title = g.scene.getScene("title");
    title.registry.set({
      gold: 140, cargo: { amber: 0, rune: 0, rain: 0, sun: 0, frost: 0 }, chill: 100, baseCapacity: 4,
      reputation: 6, trips: 3, currentTown: "ashfen", lastRoute: null, day: 6, heat: per(0), mods: [],
      seen: {}, rumors: [], debt: { owed: 420, due: 99, missed: 0 }, missions: [], missionsDone: {},
      ordersDeclined: per(6), upgrades: { stashKit: false, horse: false, icebox: false, escort: false, hideout: false },
      crew: {}, hp: 6, maxHp: 6, tonics: 0, stashes: {},
      flags: { "hint-route": true, "visited-ashfen": true, "visited-valkeep": true, "visited-verdelume": true, "visited-duneshade": true, "visited-frostholm": true },
      mapId: map, ...state,
    });
    if (!g.scene.isActive("ui")) g.scene.start("ui");
    g.scene.stop("title");
    g.scene.start("world", { map, entry });
  }, [map, entry, state, TOWNS]);
  await page.waitForFunction((map) => {
    const w = globalThis.__game.scene.getScene("world");
    return w?.sys.isActive() && w.player && w.mapId === map && w.ui?.def;
  }, map, { timeout: 20000 });
  await page.waitForTimeout(700);
}

/** Mueve al jugador a una celda (x, y en cuadros de 16 px). */
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

/** Quita enemigos: se queda sólo con los que `keep` (función en la página) acepta. */
const keepEnemies = (page, keep = "() => false") => page.evaluate((src) => {
  const w = globalThis.__game.scene.getScene("world");
  // eslint-disable-next-line no-new-func
  const fn = new Function(`return (${src})`)();
  for (const e of w.enemies) if (!e.dead && !fn(e)) { e.dead = true; e.destroy(); }
  w.enemies = w.enemies.filter((e) => !e.dead);
}, keep);

/** Cámara quieta en un punto (píxeles de la esquina superior izquierda). */
const camAt = (page, x, y) => page.evaluate(([x, y]) => {
  const cam = globalThis.__game.scene.getScene("world").cameras.main;
  cam.stopFollow();
  cam.setScroll(x, y);
}, [x, y]);

/** Paneo de cámara (se agenda en el segundo 0 de la toma). */
const pan = (to, seconds, ease = "Sine.easeInOut") => ({
  at: 0,
  run: (page) => page.evaluate(([t, s, e]) => {
    const w = globalThis.__game.scene.getScene("world");
    w.tweens.add({ targets: w.cameras.main, scrollX: t[0], scrollY: t[1], duration: s * 1000, ease: e });
  }, [to, seconds, ease]),
});

/** Cambia de mapa a mitad de toma (el juego hace su fundido). */
const goTo = (map, entry) => (page) => page.evaluate(([m, e]) => globalThis.__game.scene.getScene("world").scene.restart({ map: m, entry: e }), [map, entry]);

const cargo = (c) => ({ cargo: { amber: 0, rune: 0, rain: 0, sun: 0, frost: 0, ...c } });

// ---------- tomas ----------

export default {
  url: "http://127.0.0.1:5181/",
  size: [480, 270],
  out: [1920, 1080],
  fps: 30,
  pixelArt: true,

  stills: [
    { id: "logo", texture: "logo", scale: 6 },
    ...["amber", "rune", "rain", "sun", "frost"].map((g) => ({ id: `gem-${g}`, texture: `gem-${g}`, scale: 8 })),
  ],

  shots: [
    // ---------- Apertura: el golfo y los cinco pueblos ----------
    {
      id: "golfo",
      seconds: 8,
      seed: 1,
      // Del mar al muelle de Ashfen y a la plaza; el caminante sube por el muelle.
      setup: async (page) => {
        await startAt(page, "ashfen", "dock", { flags: { "met-ferry": true, "hint-route": true } });
        await hud(page, false);
        await place(page, 19.5, 26.4, "up");
        await camAt(page, 80, 210);
      },
      input: [pan([80, 30], 7.6), { at: 0.6, down: "KeyW" }, { at: 7.8, up: "KeyW" }],
    },
    {
      id: "valkeep",
      seconds: 5,
      seed: 2,
      setup: async (page) => {
        await startAt(page, "valkeep", "start", { upgrades: { horse: true }, currentTown: "valkeep" });
        await hud(page, false);
        await place(page, 12, 17.6, "right");
        await camAt(page, 0, 120);
      },
      input: [pan([160, 90], 4.8), { at: 0.2, down: "KeyD" }, { at: 4.9, up: "KeyD" }],
    },
    {
      id: "verdelume",
      seconds: 5,
      seed: 3,
      setup: async (page) => {
        await startAt(page, "verdelume", "start", { currentTown: "verdelume" });
        await hud(page, false);
        await place(page, 26, 22.4, "left");
        await camAt(page, 160, 170);
      },
      input: [pan([0, 150], 4.8), { at: 0.2, down: "KeyA" }, { at: 4.9, up: "KeyA" }],
    },
    {
      id: "duneshade",
      seconds: 5,
      seed: 4,
      setup: async (page) => {
        await startAt(page, "duneshade", "start", { currentTown: "duneshade", upgrades: { escort: true } });
        await hud(page, false);
        await place(page, 27, 20, "left");
        await camAt(page, 160, 200);
      },
      input: [pan([50, 40], 4.8), { at: 0.2, down: "KeyW" }, { at: 0.25, down: "KeyA" }, { at: 4.9, up: "KeyW" }, { at: 4.9, up: "KeyA" }],
    },
    {
      id: "frostholm",
      seconds: 5,
      seed: 5,
      setup: async (page) => {
        await startAt(page, "frostholm", "start", { currentTown: "frostholm", flags: { "met-ferry": true, "hint-route": true } });
        await hud(page, false);
        await place(page, 19.5, 17.6, "down");
        await camAt(page, 80, 30);
      },
      input: [pan([80, 210], 4.8), { at: 0.3, down: "KeyS" }, { at: 4.9, up: "KeyS" }],
    },

    // ---------- La Corona ----------
    {
      id: "reten",
      seconds: 7,
      seed: 6,
      setup: async (page) => {
        await startAt(page, "ruta1", "south", cargo({ sun: 3 }));
        await keepEnemies(page, "(e) => e.spec.post");
        await place(page, 25.5, 64.5, "up");
      },
      input: [
        { at: 0.2, down: "KeyW" },
        { at: 1.4, up: "KeyW" },
        { at: 3.2, tap: "KeyE" },
        { at: 5.0, tap: "KeyE" },
      ],
    },

    // ---------- Premisa: la deuda y el mercado ----------
    {
      id: "cobrador",
      seconds: 8,
      seed: 7,
      setup: async (page) => {
        await startAt(page, "valkeep", "south", { lastRoute: "ruta1", day: 10, currentTown: "ashfen", debt: { owed: 500, due: 11, missed: 0 }, gold: 60 });
        await hud(page, true);
      },
      input: [
        { at: 0.3, down: "KeyW" },
        { at: 0.6, up: "KeyW" },
        { at: 3.2, tap: "KeyE" },
        { at: 3.7, tap: "KeyE" },
        { at: 5.6, tap: "KeyE" },
      ],
    },
    {
      id: "mercado",
      seconds: 6,
      seed: 8,
      setup: async (page) => {
        await startAt(page, "duneshade", "start", { currentTown: "duneshade", gold: 180, ...cargo({ rain: 2 }) });
        await hud(page, true);
        await place(page, 21.3, 11.6, "up");
      },
      input: [
        { at: 0.3, tap: "KeyE" },
        { at: 1.4, tap: "KeyE" },
        { at: 2.0, tap: "KeyE" },
        { at: 2.6, tap: "ArrowLeft" },
        { at: 3.0, tap: "ArrowDown" },
        { at: 3.6, tap: "KeyE" },
        { at: 4.2, tap: "KeyE" },
      ],
    },

    // ---------- Verbos ----------
    {
      id: "pasto",
      seconds: 5,
      seed: 9,
      setup: async (page) => {
        await startAt(page, "ruta1", "south", cargo({ sun: 3 }));
        await keepEnemies(page);
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
      seed: 10,
      setup: async (page) => {
        await startAt(page, "ruta1", "south", cargo({ sun: 3 }));
        await keepEnemies(page, "(e) => e.spec.kind === 'guard' && !e.spec.post && Math.hypot(e.x - 22 * 16, e.y - 68 * 16) < 5 * 16");
        await page.evaluate(() => {
          const w = globalThis.__game.scene.getScene("world");
          for (const e of w.enemies) {
            e.body.reset(22 * 16, 64.5 * 16);
            e.patrolIndex = 0;
            e.patrolStep = 1;
            e.setState("patrol");
          }
        });
        await hud(page, false);
        await place(page, 19.6, 70.6, "up");
      },
      // El guardia baja por la calzada, te ve con carga (?, !) y corres.
      input: [
        { at: 1.25, down: "KeyA" },
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
      seed: 11,
      setup: async (page) => {
        await startAt(page, "ruta1", "south", cargo({ amber: 3 }));
        await keepEnemies(page, "(e) => e.spec.kind === 'bandit'");
        await hud(page, false);
        await place(page, 12.2, 63.6, "up");
      },
      input: [
        { at: 0.2, down: "KeyW" },
        { at: 0.25, down: "KeyA" },
        { at: 1.4, up: "KeyW" },
        { at: 1.6, up: "KeyA" },
        ...[1.8, 2.3, 2.8, 3.3, 3.8, 4.3].map((at) => ({ at, tap: "KeyJ" })),
      ],
    },
    {
      id: "jabali",
      seconds: 5,
      seed: 12,
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
        await place(page, 17.4, 91.9, "right");
      },
      input: [
        { at: 0.75, down: "KeyW" },
        { at: 1.0, up: "KeyW" },
        { at: 1.35, down: "KeyS" },
        { at: 1.4, up: "KeyS" },
        { at: 1.5, tap: "KeyJ" },
        { at: 1.9, tap: "KeyJ" },
        { at: 2.4, tap: "KeyJ" },
      ],
    },
    {
      id: "lobo",
      seconds: 5,
      seed: 13,
      setup: async (page) => {
        await startAt(page, "ruta4", "south");
        await keepEnemies(page, "(e) => e.spec.kind === 'wolf' && e.spec.x === 26");
        await hud(page, false);
        await place(page, 21.5, 72.4, "right");
      },
      input: [
        { at: 1.1, down: "KeyW" },
        { at: 1.12, tap: "KeyK" },
        { at: 1.4, up: "KeyW" },
        ...[2.0, 2.4, 2.8, 3.3, 3.8].map((at) => ({ at, tap: "KeyJ" })),
      ],
    },
    {
      id: "escorpion",
      seconds: 5,
      seed: 14,
      setup: async (page) => {
        await startAt(page, "ruta3", "east");
        await keepEnemies(page, "(e) => e.spec.kind === 'scorpion' && e.spec.x === 62");
        // El escorpión, enterrado en la calzada del desierto (sin cactus de por medio).
        await page.evaluate(() => {
          const w = globalThis.__game.scene.getScene("world");
          const e = w.enemies[0];
          e.home = { x: 64 * 16, y: 17.6 * 16 };
          e.body.reset(e.home.x, e.home.y);
        });
        await hud(page, false);
        await place(page, 59.5, 17.6, "right");
      },
      input: [
        { at: 0.3, down: "KeyD" },
        { at: 0.9, up: "KeyD" },
        ...[1.6, 2.0, 2.4, 2.9, 3.4].map((at) => ({ at, tap: "KeyJ" })),
      ],
    },
    {
      id: "arquera",
      seconds: 6,
      seed: 15,
      // Entrando a la selva con Sahra: un bandido sale del pasto y ella dispara.
      setup: async (page) => {
        await startAt(page, "ruta3", "west", { upgrades: { escort: true }, ...cargo({ rain: 1 }) });
        await keepEnemies(page, "(e) => e.spec.kind === 'bandit' && e.spec.x === 9");
        await hud(page, false);
        await place(page, 3, 17.6, "right");
      },
      input: [
        { at: 0.2, down: "KeyD" },
        { at: 1.8, up: "KeyD" },
        ...[2.6, 3.1, 3.6].map((at) => ({ at, tap: "KeyJ" })),
      ],
    },
    {
      id: "hielo",
      seconds: 8,
      seed: 16,
      setup: async (page) => {
        await startAt(page, "ruta4", "north");
        await keepEnemies(page);
        await hud(page, false);
        await place(page, 8.5, 44.7, "down");
      },
      // Solución del lago: ↓ → ↓ ← ↓ → ↓
      input: ["KeyS", "KeyD", "KeyS", "KeyA", "KeyS", "KeyD", "KeyS"].flatMap((k, i) => [
        { at: 0.3 + i * 1.0, down: k },
        { at: 0.45 + i * 1.0, up: k },
      ]),
    },
    {
      id: "caravana",
      seconds: 6,
      seed: 17,
      setup: async (page) => {
        await startAt(page, "ruta3", "west", { upgrades: { escort: true, horse: true } });
        await keepEnemies(page);
        await hud(page, false);
        await place(page, 47, 17.2, "right");
        // Que la yegua y Sahra arranquen detrás, no encima del jugador.
        await page.evaluate(() => {
          const w = globalThis.__game.scene.getScene("world");
          w.horse?.setPosition(w.player.x - 30, w.player.y);
          w.escort?.sprite.setPosition(w.player.x - 52, w.player.y);
        });
      },
      input: [{ at: 0.2, down: "KeyD" }, { at: 5.9, up: "KeyD" }],
    },
    {
      id: "refugio",
      seconds: 8,
      seed: 18,
      setup: async (page) => {
        await startAt(page, "ruta2", "south", {
          upgrades: { stashKit: true }, flags: { "refuge-refugio-r2": true, "hint-route": true }, ...cargo({ sun: 2, amber: 1 }),
        });
        await keepEnemies(page);
        await hud(page, true);
        await place(page, 11, 48.8, "up");
      },
      input: [
        { at: 0.4, tap: "KeyE" },
        { at: 1.6, down: "KeyW" },
        { at: 2.5, up: "KeyW" },
        { at: 2.5, down: "KeyA" },
        { at: 3.1, up: "KeyA" },
        { at: 3.2, down: "KeyW" },
        { at: 3.35, up: "KeyW" },
        { at: 3.6, tap: "KeyE" },
        { at: 4.6, tap: "ArrowDown" },
        { at: 4.9, tap: "ArrowDown" },
        { at: 5.2, tap: "ArrowDown" },
        { at: 5.6, tap: "ArrowRight" },
        { at: 6.0, tap: "ArrowRight" },
      ],
    },

    // ---------- Mundo vivo ----------
    {
      id: "rumor",
      seconds: 6,
      seed: 19,
      setup: async (page) => {
        await startAt(page, "duneshade", "start", {
          currentTown: "duneshade",
          mods: [{ town: "frostholm", good: "sun", field: "cons", mult: 2.2, event: "helada-frostholm", days: 6 }],
        });
        await hud(page, true);
        await place(page, 25.2, 13.4, "up");
        // Que el posadero cuente la helada (dice la verdad y elige el suceso activo).
        await page.evaluate(() => { Math.random = () => 0.1; });
      },
      input: [{ at: 0.3, tap: "KeyE" }, { at: 1.6, tap: "KeyE" }, { at: 2.0, tap: "KeyE" }],
    },
    {
      id: "barca",
      seconds: 8,
      seed: 20,
      setup: async (page) => {
        await startAt(page, "frostholm", "start", { currentTown: "frostholm", gold: 60, flags: { "met-ferry": true, "hint-route": true } });
        await hud(page, true);
        // Sin HUD (el diálogo sí se ve): en el cruce la pantalla queda en negro.
        await page.evaluate(() => globalThis.__game.scene.getScene("ui").hud.setVisible(false));
        await place(page, 20.5, 22.4, "right");
      },
      input: [{ at: 0.3, tap: "KeyE" }, { at: 1.3, tap: "KeyE" }, { at: 3.6, tap: "KeyE" }, { at: 5.2, tap: "KeyE" }],
    },

    // ---------- Cierre ----------
    {
      id: "titulo",
      seconds: 9,
      seed: 21,
      // Ashfen de fondo con la cámara paseando, sin el menú (el logo lo pone el trailer).
      setup: async (page) => {
        await page.waitForTimeout(800);
        await page.evaluate(() => globalThis.__game.scene.getScene("title").cameras.cameras[1].setVisible(false));
      },
    },
  ],
};
