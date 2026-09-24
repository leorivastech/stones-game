/**
 * Lo del modo en línea que va encima del juego, en HTML (acentos, emoji y el teclado del celular):
 *  - arriba: en línea / sin conexión, el día del mundo con su barrita, quién está y quién habla;
 *  - abajo a la izquierda: el chat (Enter para escribir, Esc para cerrar);
 *  - T mantenido: hablar por micrófono. En celular, botones 🎤 (mantener) y 💬.
 *  - el nombre, si el enlace no lo trae.
 */

import { online, onNet, send, dayProgress } from "./online.js";
import { startTalking, stopTalking, voice } from "./voice.js";
import { touch } from "../engine/touch.js";
import { P } from "../art/palette.js";

const CSS = `
@font-face { font-family: "Pixel"; src: url("/assets/fonts/pixelify-sans.woff2") format("woff2"); font-weight: 400 700; }
#net { position: fixed; inset: 0; pointer-events: none; z-index: 20; font-family: "Pixel", system-ui, sans-serif; color: ${P.c4}; }
#net .bar { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center;
  background: ${P.ink}cc; border: 2px solid ${P.y1}; padding: 3px 10px 4px; border-radius: 6px; font-size: 13px; white-space: nowrap; }
#net .dot { width: 9px; height: 9px; border-radius: 50%; background: ${P.g5}; display: inline-block; }
#net .dot.off { background: ${P.e3}; }
#net .day { display: inline-flex; align-items: center; gap: 5px; }
#net .day i { display: inline-block; width: 40px; height: 5px; background: ${P.ink2}; position: relative; }
#net .day i b { position: absolute; left: 0; top: 0; bottom: 0; background: ${P.y3}; }
#net .who span { margin-left: 6px; }
#net .who .talk { color: ${P.y4}; }
#net .log { position: absolute; left: 10px; bottom: 44px; max-width: min(46vw, 460px); display: flex; flex-direction: column; gap: 3px; }
#net .msg { background: ${P.ink}c8; padding: 2px 8px 3px; border-radius: 4px; font-size: 14px; transition: opacity 0.6s; }
#net .msg b { color: ${P.y4}; font-weight: 700; }
#net .msg.me b { color: ${P.b5}; }
#net .msg.gone { opacity: 0; }
#net form { position: absolute; left: 10px; bottom: 10px; display: none; pointer-events: auto; }
#net form.open { display: flex; gap: 6px; }
#net input { font: inherit; font-size: 15px; width: min(60vw, 420px); padding: 5px 8px; border: 2px solid ${P.y3}; background: ${P.ink}; color: ${P.c4}; border-radius: 4px; }
#net button { font: inherit; }
#net .hint { position: absolute; left: 10px; bottom: 10px; font-size: 12px; opacity: 0.75; background: ${P.ink}aa; padding: 2px 6px; border-radius: 4px; }
#net .tbtn { position: absolute; pointer-events: auto; width: 46px; height: 46px; border-radius: 50%; border: 3px solid ${P.c4}66; background: ${P.ink}aa;
  font-size: 20px; display: flex; align-items: center; justify-content: center; left: 27px; }
#net .tbtn.down { background: ${P.y1}dd; border-color: ${P.y4}; }
#net .name { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: ${P.ink}ee; pointer-events: auto; }
#net .name form { position: static; display: flex; flex-direction: column; gap: 10px; align-items: center; }
#net .name h2 { margin: 0; color: ${P.y3}; font-size: 22px; }
#net .name button { padding: 6px 18px; border: 2px solid ${P.y3}; background: ${P.y1}; color: ${P.c4}; border-radius: 4px; font-size: 16px; }
`;

let root;
let log;
let form;
let input;
let bar;
let hint;

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  parent?.append(e);
  return e;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Pide el nombre si el enlace no lo trae. */
export function askName() {
  return new Promise((resolve) => {
    if (online.name) { resolve(online.name); return; }
    const box = el("div", "name", root);
    const f = el("form", null, box);
    el("h2", null, f, "Stones · en línea");
    const i = el("input", null, f);
    i.placeholder = "Tu nombre";
    i.maxLength = 16;
    try { i.value = localStorage.getItem("stones-online-name") ?? ""; } catch { /* sin almacenamiento */ }
    el("button", null, f, "Entrar");
    f.onsubmit = (e) => {
      e.preventDefault();
      const name = i.value.trim().slice(0, 16);
      if (!name) return;
      try { localStorage.setItem("stones-online-name", name); } catch { /* sin almacenamiento */ }
      online.name = name;
      box.remove();
      resolve(name);
    };
    setTimeout(() => i.focus(), 50);
  });
}

function addLine(html, cls = "") {
  const m = el("div", `msg ${cls}`, log, html);
  while (log.children.length > 6) log.firstChild.remove();
  setTimeout(() => m.classList.add("gone"), 12000);
  setTimeout(() => m.remove(), 12700);
}

/** Mientras escribes, el juego no oye el teclado (si no, "j" te haría golpear). */
function setGameKeys(on) {
  const kb = globalThis.__stonesGame?.input?.keyboard;
  if (kb) kb.enabled = on;
}

export function openChat() {
  if (form.classList.contains("open")) return;
  form.classList.add("open");
  hint.style.display = "none";
  setGameKeys(false);
  input.value = "";
  setTimeout(() => input.focus(), 0);
}

function closeChat() {
  form.classList.remove("open");
  hint.style.display = touch.on ? "none" : "";
  input.blur();
  setGameKeys(true);
}

function renderBar() {
  const players = [...online.players.values()].filter((p) => p.name && p.id !== online.id);
  const who = players.map((p) => `<span class="${p.talking ? "talk" : ""}">${esc(p.name)}${p.talking ? " 🎤" : ""}</span>`).join("");
  const day = online.reg?.get("day") ?? online.world.econ?.day ?? 1;
  bar.innerHTML = `<span><i class="dot ${online.connected ? "" : "off"}"></i> ${online.connected ? esc(online.name ?? "") : "sin conexión"}</span>`
    + `<span class="day">Día ${day} <i><b style="width:${Math.round(dayProgress() * 100)}%"></b></i></span>`
    + `<span class="who">${players.length ? `con:${who}` : "solo"}</span>`
    + (voice.talking ? `<span class="talk">🎤 hablando</span>` : "")
    + (voice.micError ? `<span>🎤 sin permiso</span>` : "");
}

function touchButtons() {
  const mic = el("div", "tbtn", root, "🎤");
  mic.style.top = "64px";
  const chat = el("div", "tbtn", root, "💬");
  chat.style.top = "118px";
  mic.addEventListener("pointerdown", (e) => { e.preventDefault(); mic.classList.add("down"); startTalking(); });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) mic.addEventListener(ev, () => { mic.classList.remove("down"); stopTalking(); });
  chat.addEventListener("pointerdown", (e) => { e.preventDefault(); openChat(); });
}

export function setupHud() {
  if (!online.on) return;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);
  root = el("div", null, document.body);
  root.id = "net";
  bar = el("div", "bar", root);
  log = el("div", "log", root);
  hint = el("div", "hint", root, "Enter: chat · T mantenido: hablar");
  form = el("form", null, root);
  input = el("input", null, form);
  input.maxLength = 140;
  input.placeholder = "Escribe y Enter (Esc cierra)";
  form.onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) send({ t: "chat", text });
    closeChat();
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); closeChat(); } e.stopPropagation(); });

  // Enter abre el chat y T (mantenida) es para hablar. Se atrapan antes que el juego.
  window.addEventListener("keydown", (e) => {
    if (document.activeElement === input || root.querySelector(".name")) return;
    if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); openChat(); }
    else if (e.code === "KeyT") { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) startTalking(); }
  }, true);
  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyT") { e.stopImmediatePropagation(); stopTalking(); }
  }, true);

  onNet("chat", (m) => addLine(`<b>${esc(m.name)}:</b> ${esc(m.text)}`, m.id === online.id ? "me" : ""));
  onNet("join", (m) => addLine(`<b>${esc(m.name)}</b> entró al golfo.`));
  onNet("leave", (m) => { if (m.name) addLine(`<b>${esc(m.name)}</b> se fue.`); });
  onNet("talk", (m) => {
    const p = online.players.get(m.id);
    if (m.on && p && p.map !== voice.me.map) addLine(`📻 <b>${esc(p.name)}</b> habla desde lejos.`);
  });
  if (touch.on) { touchButtons(); hint.style.display = "none"; }
  window.addEventListener("touchcontrols", () => { if (!root.querySelector(".tbtn")) touchButtons(); hint.style.display = "none"; });
  setInterval(renderBar, 250);
  renderBar();
}
