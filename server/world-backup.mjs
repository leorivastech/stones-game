import { writeFile } from "node:fs/promises";
import { SupabaseWorldStore } from "./persistence.mjs";

const output = process.argv[2];
if (!output) throw new Error("Uso: node --env-file=.env server/world-backup.mjs /ruta/respaldo.json");
const storage = new SupabaseWorldStore({
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SECRET_KEY,
  worldId: process.env.WORLD_ID || "main",
});
const data = await storage.load();
if (!data) throw new Error("No existe ese mundo en Supabase.");
// No sobrescribir respaldos existentes; no imprime nombres ni contenido de las partidas.
await writeFile(output, JSON.stringify(data, null, 2), { flag: "wx", mode: 0o600 });
console.log("Respaldo creado.");
