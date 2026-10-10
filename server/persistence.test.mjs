import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SupabaseWorldStore, openWorld } from "./persistence.mjs";
import { World } from "./world.mjs";

function database() {
  let row = null;
  let fail = false;
  let loseResponse = false;
  const requests = [];
  const fetchImpl = async (href, opts) => {
    requests.push({ href, opts });
    if (fail) throw new Error("offline");
    const url = new URL(href);
    if (opts.method === "GET") return Response.json(row ? [{ data: row.data, revision: row.revision }] : []);
    const body = JSON.parse(opts.body);
    if (opts.method === "POST") {
      if (row) return new Response("duplicate", { status: 409 });
      row = structuredClone(body);
    } else {
      if (url.searchParams.get("revision") !== `eq.${row?.revision}`) return Response.json([]);
      row = { ...row, ...structuredClone(body) };
    }
    if (loseResponse) { loseResponse = false; throw new Error("response lost"); }
    return Response.json([structuredClone(row)]);
  };
  return {
    fetchImpl, requests,
    get row() { return row; }, set row(value) { row = value; },
    set fail(value) { fail = value; }, set loseResponse(value) { loseResponse = value; },
  };
}
const env = { WORLD_STORE: "supabase", SUPABASE_URL: "https://stones-test.supabase.co", SUPABASE_SECRET_KEY: "test-server-only", WORLD_ID: "test" };
const file = () => join(mkdtempSync(join(tmpdir(), "stones-persistence-")), "world.json");
const store = (db) => new SupabaseWorldStore({ url: env.SUPABASE_URL, key: env.SUPABASE_SECRET_KEY, worldId: "test", fetchImpl: db.fetchImpl });

test("migrates existing JSON and recovers two players and the shared world after restart", async () => {
  const db = database();
  const path = file();
  const initial = World.fresh();
  initial.players = { Uno: { start: "ashfen", save: { gold: 400 } }, Dos: { start: "duneshade", save: { gold: 700 } } };
  initial.flags.bridge = true;
  writeFileSync(path, JSON.stringify(initial));
  const world = await openWorld(path, { dayMs: 240000, env, fetchImpl: db.fetchImpl });
  world.savePlayer("Uno", { gold: 456 }, Date.now());
  await world.save();
  // Un archivo local viejo no puede reemplazar el guardado remoto.
  writeFileSync(path, JSON.stringify(World.fresh()));
  const recovered = await openWorld(path, { dayMs: 240000, env, fetchImpl: db.fetchImpl });
  assert.equal(recovered.s.players.Uno.save.gold, 456);
  assert.equal(recovered.s.players.Dos.save.gold, 700);
  assert.equal(recovered.s.flags.bridge, true);
  assert.ok(db.requests.every(({opts}) => opts.headers.apikey === "test-server-only"));
});

test("startup stops on unavailable or invalid remote storage without creating an empty world", async () => {
  const db = database(); db.fail = true;
  await assert.rejects(openWorld(file(), { dayMs: 240000, env, fetchImpl: db.fetchImpl }), /no responde/);
  assert.equal(db.requests.filter(({opts}) => opts.method !== "GET").length, 0);
  db.fail = false; db.row = { revision: "abc", data: { players: {} } };
  await assert.rejects(openWorld(file(), { dayMs: 240000, env, fetchImpl: db.fetchImpl }), /inválido/);
  assert.equal(db.requests.filter(({opts}) => opts.method !== "GET").length, 0);
});

test("incomplete configuration and corrupt migration files fail closed", async () => {
  await assert.rejects(openWorld(file(), { dayMs: 240000, env: { WORLD_STORE: "supabase" } }), /requiere/);
  const db = database(); const path = file(); writeFileSync(path, "corrupt");
  await assert.rejects(openWorld(path, { dayMs: 240000, env, fetchImpl: db.fetchImpl }));
  assert.equal(db.row, null);
});

test("a lost response is reconciled without overwriting a different revision", async () => {
  const db = database(); const storage = store(db);
  db.loseResponse = true;
  await storage.save({ version: 1, gold: 1 });
  const revision = db.row.revision;
  assert.equal(storage.revision, revision);
  assert.equal(storage.pending, null);
  db.row = { ...db.row, revision: "other-server", data: { gold: 999 } };
  await assert.rejects(storage.save({ gold: 2 }), { code: "WORLD_CONFLICT" });
  assert.equal(db.row.data.gold, 999);
  assert.equal(storage.revision, revision);
});

test("failure remains dirty and retry saves the newest state", async () => {
  const db = database(); const world = await openWorld(file(), { dayMs: 240000, env, fetchImpl: db.fetchImpl });
  world.join("Uno"); db.fail = true;
  await assert.rejects(world.save());
  assert.equal(world.dirty, true);
  world.savePlayer("Uno", { gold: 99 }, 1);
  db.fail = false; await world.save();
  assert.equal(db.row.data.players.Uno.save.gold, 99);
  assert.equal(world.dirty, false);
});

test("mutation during a slow save is retained; concurrent saves are serialized", async () => {
  let release; const written = [];
  const storage = { save: async (data) => {
    written.push(data);
    if (written.length === 1) await new Promise((resolve) => { release = resolve; });
  } };
  const world = new World(file(), { dayMs: 240000, storage });
  world.join("Uno"); const first = world.save();
  world.savePlayer("Uno", { gold: 22 }, 1); const second = world.save();
  release(); await Promise.all([first, second]);
  assert.equal(written.length, 2);
  assert.equal(written[1].players.Uno.save.gold, 22);
  assert.equal(world.dirty, false);
});

test("local mode still recovers its existing file", async () => {
  const path = file(); const world = await openWorld(path, { dayMs: 240000, env: {} });
  world.join("Local"); world.savePlayer("Local", { gold: 42 }, 1); await world.save();
  assert.equal(JSON.parse(readFileSync(path, "utf8")).players.Local.save.gold, 42);
  const recovered = await openWorld(path, { dayMs: 240000, env: {} });
  assert.equal(recovered.s.players.Local.save.gold, 42);
});
