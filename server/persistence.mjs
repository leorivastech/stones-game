import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { World } from "./world.mjs";

/** Sólo el servidor conoce la llave. La tabla no tiene acceso público. */
export class SupabaseWorldStore {
  constructor({ url, key, worldId = "main", fetchImpl = fetch }) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
      throw new Error("SUPABASE_URL debe usar HTTPS.");
    }
    if (!key || !worldId) throw new Error("Falta la llave del servidor o WORLD_ID.");
    this.url = `${parsed.origin}/rest/v1/stones_worlds`;
    this.key = key;
    this.worldId = worldId;
    this.fetch = fetchImpl;
    this.revision = null;
    this.pending = null;
  }

  async request(method, query = "", body) {
    let res;
    try {
      res = await this.fetch(`${this.url}${query}`, {
        method, signal: AbortSignal.timeout(10000),
        headers: { apikey: this.key, "Content-Type": "application/json", Prefer: "return=representation" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new Error("Supabase no responde; el guardado queda pendiente.");
    }
    if (!res.ok) throw new Error(`Supabase devolvió HTTP ${res.status}; revisa la configuración del servidor.`);
    return res.json();
  }

  async load() {
    const query = new URLSearchParams({ id: `eq.${this.worldId}`, select: "data,revision", limit: "1" });
    const rows = await this.request("GET", `?${query}`);
    if (!Array.isArray(rows)) throw new Error("Respuesta de Supabase inválida.");
    const row = rows[0];
    if (row && (typeof row.revision !== "string" || !row.data || typeof row.data !== "object")) {
      throw new Error("Registro de Supabase inválido.");
    }
    this.revision = row?.revision ?? null;
    return row?.data ?? null;
  }

  async save(data) {
    // Ante una respuesta perdida se reutiliza la misma revisión: no se duplica el guardado.
    this.pending ??= { id: this.worldId, revision: randomUUID(), data, updated_at: new Date().toISOString() };
    const pending = this.pending;
    const expected = this.revision;
    const query = new URLSearchParams({ id: `eq.${this.worldId}`, revision: `eq.${expected}`, select: "revision" });
    try {
      const rows = expected === null
        ? await this.request("POST", "?select=revision", pending)
        : await this.request("PATCH", `?${query}`, {
          revision: pending.revision, data: pending.data, updated_at: pending.updated_at,
        });
      if (!Array.isArray(rows) || rows[0]?.revision !== pending.revision) throw new Error("Conflicto de guardado.");
    } catch (error) {
      // Puede haberse escrito aunque la respuesta no llegara. No adoptar una revisión ajena.
      const previous = this.revision;
      let actual;
      try { await this.load(); actual = this.revision; } finally { this.revision = previous; }
      if (actual !== pending.revision) {
        if (actual !== expected) {
          const conflict = new Error("Otro servidor cambió este mundo. Se detiene para no sobrescribir partidas.");
          conflict.code = "WORLD_CONFLICT";
          throw conflict;
        }
        throw error;
      }
    }
    this.revision = pending.revision;
    this.pending = null;
    // Si se reintentaba una foto anterior, guardar también la foto actual antes de confirmar.
    if (pending.data !== data) await this.save(data);
  }
}

export async function openWorld(file, { dayMs, env = process.env, fetchImpl }) {
  const configured = env.WORLD_STORE === "supabase" || env.SUPABASE_URL || env.SUPABASE_SECRET_KEY;
  if (!configured) return new World(file, { dayMs });
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error("Supabase requiere SUPABASE_URL y SUPABASE_SECRET_KEY; no se usará guardado temporal.");
  }
  const storage = new SupabaseWorldStore({ url: env.SUPABASE_URL, key: env.SUPABASE_SECRET_KEY, worldId: env.WORLD_ID || "main", fetchImpl });
  const persisted = await storage.load();
  if (persisted) return new World(file, { dayMs, persisted, storage });
  // Migrar el JSON existente solamente si Supabase todavía no tiene ese mundo.
  const initial = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : World.fresh(dayMs);
  const world = new World(file, { dayMs, persisted: initial, storage });
  await world.save(true);
  return world;
}
