import { chromium } from "/home/leo-rivas-tech/Development/stones_Game/.claude/worktrees/pixel-remake/trailer/node_modules/playwright-core/index.mjs";
import fs from "node:fs";

const OUT = "/tmp/stones-capturas";
fs.mkdirSync(OUT, { recursive: true });
const TOWNS = ["ashfen", "valkeep", "verdelume", "duneshade", "frostholm", "mossgrove"];

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto("http://127.0.0.1:5181/", { waitUntil: "load" });
await page.waitForFunction(() => globalThis.__game?.scene?.getScene("title")?.sys?.isActive(), null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/00-title.png` });

async function startAt(map, entry = "start", state = {}) {
  await page.evaluate(([map, entry, state, towns]) => {
    const g = globalThis.__game;
    localStorage.clear();
    const per = (v) => Object.fromEntries(towns.map((t) => [t, v]));
    const title = g.scene.getScene("title");
    title.registry.set({
      gold: 140, cargo: { amber: 1, rune: 0, rain: 1, sun: 0, frost: 0 }, chill: 100, baseCapacity: 4,
      reputation: 6, trips: 3, currentTown: "ashfen", lastRoute: null, day: 6, heat: per(0), mods: [],
      seen: {}, rumors: [], debt: { owed: 420, due: 99, missed: 0 }, missions: [], missionsDone: {},
      ordersDeclined: per(6), upgrades: { stashKit: false, horse: false, icebox: false, escort: false, hideout: false },
      crew: {}, hp: 6, maxHp: 6, tonics: 0, stashes: {},
      flags: { "hint-route": true, ...Object.fromEntries(towns.map((t) => [`visited-${t}`, true])) },
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
  await page.waitForTimeout(1200);
}

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

for (const t of TOWNS) {
  try { await startAt(t); await shot(`10-town-${t}`); } catch (e) { console.log("fail", t, e.message); }
}
for (const r of ["ruta1", "ruta2", "ruta3", "ruta4", "ruta5"]) {
  try { await startAt(r, "south"); await shot(`20-${r}`); } catch (e) {
    try { await startAt(r, "north"); await shot(`20-${r}`); } catch (e2) { console.log("fail", r, e2.message); }
  }
}
// refugios
const refs = await page.evaluate(() => Object.keys(globalThis.__game.scene.getScene("world").registry.get("stashes") ?? {}));
console.log("stashes", refs);
for (const m of ["refugio-r2", "refugio-r3", "refugio-r4"]) {
  try { await startAt(m); await shot(`30-${m}`); } catch (e) { /* skip */ }
}
// pause menu and market: go to ashfen and press Escape
await startAt("ashfen");
await page.keyboard.press("Escape"); await page.waitForTimeout(800); await shot("40-pause");
await page.keyboard.press("Escape"); await page.waitForTimeout(500);
// try to trigger a market: find interactable with label Comerciar/Mercado
const labels = await page.evaluate(() => globalThis.__game.scene.getScene("world").interactables.map((i) => i.label));
console.log("interactables", labels);
const opened = await page.evaluate(() => {
  const w = globalThis.__game.scene.getScene("world");
  const it = w.interactables.find((i) => /merc|comer|trat|vend|compr/i.test(i.label));
  if (it) { it.act(); return it.label; }
  return null;
});
console.log("opened", opened);
await page.waitForTimeout(1200); await shot("41-market");
await page.keyboard.press("Escape"); await page.waitForTimeout(500);
const inn = await page.evaluate(() => {
  const w = globalThis.__game.scene.getScene("world");
  const it = w.interactables.find((i) => /posad|dorm|desc/i.test(i.label));
  if (it) { it.act(); return it.label; }
  return null;
});
console.log("inn", inn);
await page.waitForTimeout(1200); await shot("42-inn");
await page.keyboard.press("Escape"); await page.waitForTimeout(500);
// mobile-ish viewport
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(800); await shot("50-phone-landscape");
await browser.close();
