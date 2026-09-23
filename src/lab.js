/** Laboratorio de arte: todas las texturas ampliadas. Abrir /lab.html?z=4&only=cast-&bg=%23417d3b */

import { buildArt, buildLabExtras } from "./art/index.js";

const params = new URLSearchParams(location.search);
const zoom = Number(params.get("z") ?? 4);
const only = params.get("only");
const bg = params.get("bg");
const root = document.getElementById("lab");
for (const entry of [...buildLabExtras(), ...buildArt()]) {
  if (only && !only.split(",").some((q) => entry.key.includes(q))) continue;
  const src = entry.buf.toCanvas();
  const c = document.createElement("canvas");
  c.width = src.width * zoom;
  c.height = src.height * zoom;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const box = document.createElement("div");
  box.className = "item";
  box.innerHTML = `<div>${entry.key} ${src.width}×${src.height}</div>`;
  box.appendChild(c);
  root.appendChild(box);
}
document.body.dataset.ready = "1";
