/**
 * Lo del modo en línea que va encima del juego, en HTML (acentos, emoji y el teclado del celular):
 *  - arriba a la izquierda (debajo de los corazones, lejos del cartel del tutorial y del de lugar):
 *    en línea / sin conexión, el día del mundo con su barrita, quién está y quién habla;
 *  - abajo a la izquierda: el chat (Enter para escribir, Esc para cerrar);
 *  - hablar: botón 🎤 (mantener) o la tecla T; escribir: botón 💬 o Enter. En celular, botones redondos.
 *  - el nombre, si el enlace no lo trae.
 */

import { online, onNet, send, dayProgress } from "./online.js";
import { startTalking, stopTalking, voice, onMicChange, resumeAudio } from "./voice.js";
import { touch } from "../engine/touch.js";
import { P } from "../art/palette.js";
import { MAPS } from "../maps/index.js";

const CSS = `
@font-face { font-family: "Pixel"; src: url("/assets/fonts/pixelify-sans.woff2") format("woff2"); font-weight: 400 700; }
#net { position: fixed; inset: 0; pointer-events: none; z-index: 20; font-family: "Pixel", system-ui, sans-serif; color: ${P.c4}; }
#net .bar { position: absolute; top: 6px; left: 6px; display: flex; gap: 8px; align-items: center;
  background: ${P.ink}cc; border: 2px solid ${P.y1}; padding: 2px 8px 3px; border-radius: 6px; font-size: 13px; white-space: nowrap; }
#net .bar.hide, #net .row.hide { display: none; }
#net .dot { width: 9px; height: 9px; border-radius: 50%; background: ${P.g5}; display: inline-block; }
#net .dot.off { background: ${P.e3}; }
#net .day { display: inline-flex; align-items: center; gap: 5px; }
#net .day i { display: inline-block; width: 40px; height: 5px; background: ${P.ink2}; position: relative; }
#net .day i b { position: absolute; left: 0; top: 0; bottom: 0; background: ${P.y3}; }
#net .who span { margin-left: 6px; }
#net .who .talk { color: ${P.y4}; }
#net .log { position: absolute; left: 10px; bottom: 48px; max-width: min(46vw, 460px); display: flex; flex-direction: column; gap: 3px; }
#net .msg { background: ${P.ink}c8; padding: 2px 8px 3px; border-radius: 4px; font-size: 14px; transition: opacity 0.6s; }
#net .msg b { color: ${P.y4}; font-weight: 700; }
#net .msg.me b { color: ${P.b5}; }
#net .msg.gone { opacity: 0; }
#net form { position: absolute; left: 10px; bottom: 10px; display: none; pointer-events: auto; }
#net form.open { display: flex; gap: 6px; }
#net input { font: inherit; font-size: 16px; width: min(60vw, 420px); padding: 5px 8px; border: 2px solid ${P.y3}; background: ${P.ink}; color: ${P.c4}; border-radius: 4px; }
#net button { font: inherit; }
#net .row { position: absolute; left: 10px; bottom: 10px; display: flex; gap: 6px; pointer-events: auto; }
#net .pbtn { font-size: 14px; padding: 5px 10px 6px; border-radius: 6px; border: 2px solid ${P.y1}; background: ${P.ink}dd; color: ${P.c4}; cursor: pointer; user-select: none; -webkit-user-select: none; }
#net .pbtn.down { background: ${P.y1}; border-color: ${P.y4}; }
#net .warn { color: ${P.e4}; }
#net .tbtn { position: absolute; pointer-events: auto; width: 46px; height: 46px; border-radius: 50%; border: 3px solid ${P.c4}66; background: ${P.ink}aa;
  font-size: 20px; display: flex; align-items: center; justify-content: center; left: 27px; }
#net .tbtn.down { background: ${P.y1}dd; border-color: ${P.y4}; }
#net .name { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: ${P.ink}ee; pointer-events: auto; }
#net .name form { position: static; display: flex; flex-direction: column; gap: 10px; align-items: center; }
#net .name h2 { margin: 0; color: ${P.y3}; font-size: 22px; }
#net .name button { padding: 6px 18px; border: 2px solid ${P.y3}; background: ${P.y1}; color: ${P.c4}; border-radius: 4px; font-size: 16px; }
#net .offline { position: absolute; left: 50%; top: 12%; transform: translateX(-50%); max-width: 92vw; text-align: center;
  background: ${P.ink}ee; border: 2px solid ${P.e3}; color: ${P.c4}; padding: 6px 14px 7px; border-radius: 6px; font-size: 15px; }
#net .offline b { color: ${P.e4}; }
#net .offline small { display: block; opacity: 0.8; font-size: 12px; margin-top: 2px; }
#net .offline.hide, #net .tap.hide { display: none; }
#net .tap { position: absolute; left: 50%; top: 26%; transform: translateX(-50%); pointer-events: auto; cursor: pointer; text-align: center;
  background: ${P.y1}ee; border: 2px solid ${P.y4}; color: ${P.c4}; padding: 8px 16px 9px; border-radius: 8px; font-size: 16px; animation: netpulse 1s ease-in-out infinite alternate; }
@keyframes netpulse { from { transform: translateX(-50%) scale(1); } to { transform: translateX(-50%) scale(1.05); } }
#net .who .far { opacity: 0.75; font-size: 0.9em; }
#net .name p { margin: 0; color: ${P.c4}; font-size: 13px; opacity: 0.8; }
#net .name .cancel { background: transparent; border-color: ${P.c4}66; font-size: 13px; padding: 3px 12px; }
`;

let root;
let log;
let form;
let input;
let bar;
let hint;
let micBtn;
let offline;
let tapBox;
let tbtns = [];
/** Hay una ventana grande (pausa, mercado…): el aviso de conexión no se le encima (la pausa ya lo dice). */
let fullUi = false;

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  parent?.append(e);
  return e;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** La capa de HTML del modo en línea (también se usa en el título para pedir el nombre). */
function ensureRoot() {
  if (root) return root;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);
  root = el("div", null, document.body);
  root.id = "net";
  return root;
}

/** El último nombre con el que se entró en línea en este aparato. */
export function lastName() {
  try { return localStorage.getItem("stones-online-name") ?? ""; } catch { return ""; }
}

/**
 * Pide el nombre (recuerda el último). Sin `force`, si el enlace ya lo trae, no pregunta.
 * Devuelve el nombre, o null si se canceló (sólo con `cancel`).
 */
export function askName({ force = false, cancel = false } = {}) {
  return new Promise((resolve) => {
    if (online.name && !force) { resolve(online.name); return; }
    ensureRoot();
    const box = el("div", "name", root);
    const f = el("form", null, box);
    el("h2", null, f, "Stones · en línea");
    el("p", null, f, "¿Cómo te llamas? Así te ven los demás y así se guarda tu avance.");
    const i = el("input", null, f);
    i.placeholder = "Tu nombre";
    i.maxLength = 16;
    i.value = online.name ?? lastName();
    el("button", null, f, "Entrar");
    // Mientras escribes, el juego no oye el teclado (si no, la "w" o la "a" no se escriben).
    setGameKeys(false);
    const done = (name) => {
      setGameKeys(true);
      box.remove();
      resolve(name);
    };
    if (cancel) {
      const c = el("button", "cancel", f, "Volver");
      c.type = "button";
      c.onclick = () => done(null);
    }
    i.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape" && cancel) { e.preventDefault(); done(null); }
    });
    f.onsubmit = (e) => {
      e.preventDefault();
      const name = i.value.trim().slice(0, 16);
      if (!name) return;
      try { localStorage.setItem("stones-online-name", name); } catch { /* sin almacenamiento */ }
      online.name = name;
      done(name);
    };
    // En iPhone el teclado sólo sale si el enfoque viene de un toque: si no sale, se toca la caja
    // (con letra de 16 px Safari ya no acerca la página).
    i.focus();
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

/**
 * Abre la caja del chat. Se enfoca ahí mismo (no después): en iPhone el teclado sólo sale si el
 * enfoque pasa dentro del manejador del toque (por eso el botón 💬 abre al soltar, no al apoyar).
 */
export function openChat() {
  if (form.classList.contains("open")) { input.focus(); return; }
  form.classList.add("open");
  hint.classList.add("hide");
  setGameKeys(false);
  input.value = "";
  input.focus();
}

function closeChat() {
  form.classList.remove("open");
  layout();
  input.blur();
  setGameKeys(true);
}

/**
 * Dónde va cada cosa según lo que muestra el juego: la barra debajo de los corazones (se esconde con
 * la pausa, el mercado y los tableros, que tapan la pantalla); con un diálogo abajo, los botones se
 * esconden y el chat sube junto a la barra para no tapar el texto.
 */
function layout() {
  const game = globalThis.__stonesGame;
  const canvas = game?.canvas;
  const r = canvas?.getBoundingClientRect();
  if (!r?.width) return;
  const z = r.width / 480;
  const mode = game.scene.isActive("ui") ? game.scene.getScene("ui").mode : null;
  const inGame = game.scene.isActive("world");
  const full = ["pause", "shop", "board", "stash", "report", "boat", "leaving"].includes(mode);
  const talk = mode === "dialog" || mode === "choice";
  bar.classList.toggle("hide", full || !inGame);
  fullUi = full;
  bar.style.left = `${Math.round(r.left + 4 * z)}px`;
  // Debajo de los corazones y el oro; si hay tónicos, debajo de su renglón (si no, los tapa).
  const ui = game.scene.getScene("ui");
  const barTop = ui?.tonicIcon?.visible ? 40 : 29;
  bar.style.top = `${Math.round(r.top + barTop * z)}px`;
  bar.style.fontSize = `${Math.max(10, Math.min(15, Math.round(6.5 * z)))}px`;
  hint.classList.toggle("hide", touch.on || talk || full || form.classList.contains("open"));
  placeTouchButtons(r, z);
  // Avisos grandes: debajo del renglón de flechas de arriba (no las tapan) y arriba del jugador.
  offline.style.top = `${Math.round(r.top + 76 * z)}px`;
  offline.style.left = tapBox.style.left = `${Math.round(r.left + r.width / 2)}px`;
  tapBox.style.top = `${Math.round(r.top + 76 * z + (offline.classList.contains("hide") ? 0 : offline.offsetHeight + 8))}px`;
  // Todo pegado al juego (no a la ventana): en celular, a los lados van la palanca y los botones.
  const left = `${Math.round(Math.max(6, r.left + 4 * z))}px`;
  const floor = Math.max(6, Math.round(window.innerHeight - r.bottom + 4 * z));
  for (const e of [hint, form]) { e.style.left = left; e.style.bottom = `${floor}px`; }
  log.style.left = left;
  if (talk) {
    log.style.bottom = "auto";
    log.style.top = `${Math.round(r.top + barTop * z + bar.offsetHeight + 4)}px`;
  } else {
    log.style.top = "";
    log.style.bottom = `${floor + (hint.classList.contains("hide") ? 0 : hint.offsetHeight + 6)}px`;
  }
}

/**
 * Los botones redondos del celular (🎤 y 💬): en la franja de la izquierda si hay (centrados en ella,
 * arriba, lejos de la palanca); si no, dentro del juego, debajo de la barra. En tableta, index.html
 * los baja a la franja de abajo con `html.touch-bottom` (esa regla manda: aquí sólo se pone top/left).
 */
function placeTouchButtons(r, z) {
  if (!tbtns.length) return;
  const strip = r.left >= 60;
  const x = strip ? Math.round(r.left / 2 - 26) : Math.round(r.left + 4 * z);
  let y = strip ? Math.max(8, Math.round(r.top + 8)) : Math.round(r.top + 29 * z + (bar.offsetHeight || 20) + 8);
  for (const b of tbtns) {
    b.style.left = `${Math.max(4, x)}px`;
    b.style.top = `${y}px`;
    y += 56;
  }
}

/** Dónde anda alguien, dicho corto (para la barra): "Ruta 1", "Ashfen"… */
function placeName(map) {
  const def = MAPS[map];
  if (!def) return "";
  // Los refugios son secretos: se dice en qué camino, no cuál.
  if (def.kind === "refuge") return `refugio · ${MAPS[def.exits?.[0]?.to]?.name ?? "camino"}`;
  return def.name;
}

function renderBar() {
  layout();
  const players = [...online.players.values()].filter((p) => p.name && p.id !== online.id);
  const who = players.map((p) => {
    const far = p.map && p.map !== voice.me.map ? ` <span class="far">(${esc(placeName(p.map))})</span>` : "";
    return `<span class="${p.talking ? "talk" : ""}">${esc(p.name)}${p.talking ? " 🎤" : ""}${far}</span>`;
  }).join("");
  renderOffline();
  tapBox.classList.toggle("hide", !voice.needTap);
  const day = online.reg?.get("day") ?? online.world.econ?.day ?? 1;
  bar.innerHTML = `<span><i class="dot ${online.connected ? "" : "off"}"></i> ${online.connected ? esc(online.name ?? "") : "sin conexión"}</span>`
    + `<span class="day">Día ${day} <i><b style="width:${Math.round(dayProgress() * 100)}%"></b></i></span>`
    + `<span class="who">${players.length ? `con:${who}` : "solo"}</span>`
    + micState();
}

/**
 * Sin conexión, en grande y en medio: si no, parece que el otro desapareció o que la voz no sirve
 * (27-sep: se cayó el túnel 1.5 min justo al salir al campo y "ya no nos veíamos").
 */
function renderOffline() {
  const game = globalThis.__stonesGame;
  const show = online.on && online.joins > 0 && !online.connected && game?.scene?.isActive("world") && !fullUi;
  offline.classList.toggle("hide", !show);
  if (!show) return;
  const secs = Math.max(0, Math.ceil(((online.retryAt ?? 0) - Date.now()) / 1000));
  const since = Math.round((Date.now() - (online.lostAt ?? Date.now())) / 1000);
  offline.innerHTML = `<b>Sin conexión con el servidor</b> · ${secs ? `reintento en ${secs} s` : "reintentando…"}`
    + `<small>Sigues jugando; los demás y la voz vuelven solos al reconectar (${since} s sin señal). Si no vuelve: el internet de la compu o el enlace del túnel.</small>`;
}

/** Cómo va el micrófono, dicho claro. */
function micState() {
  if (voice.mic === "pidiendo") return `<span class="talk">🎤 acepta el permiso del micrófono</span>`;
  if (voice.mic === "sin permiso") return `<span class="warn">🎤 sin permiso: dale permiso en el candado junto a la dirección</span>`;
  if (voice.mic === "sin micrófono") return `<span class="warn">🎤 este aparato no tiene micrófono</span>`;
  if (voice.mic === "ocupado") return `<span class="warn">🎤 el micrófono lo está usando otra app</span>`;
  if (voice.talking && voice.opening) return `<span class="talk">🎤 abriendo micrófono…</span>`;
  if (voice.talking) {
    const bars = Math.round(voice.level * 5);
    return `<span class="talk">🎤 hablando ${"▮".repeat(bars)}${"▯".repeat(5 - bars)}</span>`;
  }
  if (voice.needTap) return `<span class="warn">🔇 toca la pantalla para oír</span>`;
  // Alguien habla y aquí suena (las barritas son lo que sale por la bocina).
  const from = voice.lastFrom != null && performance.now() - voice.lastAt < 400 ? online.players.get(voice.lastFrom) : null;
  if (from) {
    const bars = Math.round(Math.min(1, voice.outLevel * 2) * 5);
    return `<span class="talk">🔊 ${esc(from.name)} ${"▮".repeat(bars)}${"▯".repeat(5 - bars)}</span>`;
  }
  return "";
}

function holdToTalk(btn) {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    // Que el dedo que salga del botón no lo suelte (iPhone manda "pointerleave" al menor movimiento).
    try { btn.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    btn.classList.add("down");
    startTalking();
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) btn.addEventListener(ev, () => { btn.classList.remove("down"); stopTalking(); });
  btn.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { btn.classList.remove("down"); stopTalking(); } });
}

function touchButtons() {
  const mic = el("div", "tbtn", root, "🎤");
  const chat = el("div", "tbtn", root, "💬");
  tbtns = [mic, chat];
  holdToTalk(mic);
  // El chat abre al soltar: en iPhone el teclado sólo sale si el enfoque viene de ese toque.
  chat.addEventListener("pointerdown", (e) => e.preventDefault());
  chat.addEventListener("pointerup", () => openChat());
  layout();
}

export function setupHud() {
  if (!online.on) return;
  ensureRoot();
  bar = el("div", "bar", root);
  log = el("div", "log", root);
  offline = el("div", "offline hide", root);
  // Llega voz y el sonido de la página está dormido (iPhone): un toque aquí (o en cualquier lado) lo despierta.
  tapBox = el("div", "tap hide", root, "🔇 Te están hablando: <b>toca aquí</b> para oír");
  tapBox.addEventListener("click", () => resumeAudio());
  tapBox.addEventListener("touchend", () => resumeAudio());
  // En la compu: botones a la vista (también se puede con T y Enter).
  hint = el("div", "row", root);
  micBtn = el("div", "pbtn", hint, "🎤 Mantén para hablar · T");
  holdToTalk(micBtn);
  const chatBtn = el("div", "pbtn", hint, "💬 Escribir · Enter");
  chatBtn.addEventListener("pointerdown", (e) => e.preventDefault());
  chatBtn.addEventListener("pointerup", () => openChat());
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
    else if (e.code === "KeyT") { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) { micBtn?.classList.add("down"); startTalking(); } }
  }, true);
  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyT") { e.stopImmediatePropagation(); micBtn?.classList.remove("down"); stopTalking(); }
  }, true);

  // Si el micrófono no se puede usar, se dice claro (una vez por cada problema).
  const told = new Set();
  onMicChange((state) => {
    if (told.has(state)) return;
    const say = {
      "sin micrófono": "🎤 <b>Este aparato no tiene micrófono</b> (o el navegador no lo encuentra). Conecta uno, o habla desde el celular.",
      "sin permiso": "🎤 <b>El navegador no dio permiso al micrófono.</b> Toca el candado junto a la dirección → Micrófono → Permitir, y recarga.",
      ocupado: "🎤 <b>El micrófono lo está usando otra app</b> (llamada, grabadora). Ciérrala y vuelve a intentar.",
      listo: "🎤 Micrófono listo. Mantén apretado para hablar: las barritas ▮▮▮ se mueven si te oye.",
      silencio: "🎤 <b>No se oyó nada.</b> El navegador está usando una entrada que no capta sonido (o el micrófono está silenciado). Revisa el micrófono en la configuración del sistema o del navegador.",
      toca: "🔇 <b>Llega voz pero el sonido está dormido.</b> Toca la pantalla una vez para oír (el iPhone lo pide).",
      suena: "🔊 Sonido activado: ya se oye la voz.",
    }[state];
    if (!say) return;
    // El aviso de silencio y el de tocar se repiten si vuelve a pasar; los demás, una vez.
    if (state !== "silencio" && state !== "toca" && state !== "suena") told.add(state);
    addLine(say);
  });
  onNet("chat", (m) => addLine(`<b>${esc(m.name)}:</b> ${esc(m.text)}`, m.id === online.id ? "me" : ""));
  onNet("join", (m) => addLine(`<b>${esc(m.name)}</b> ${m.back ? "volvió." : "entró al golfo."}`));
  onNet("leave", (m) => { if (m.name) addLine(`<b>${esc(m.name)}</b> se fue.`); });
  onNet("talk", (m) => {
    const p = online.players.get(m.id);
    if (m.on && p && p.map !== voice.me.map) addLine(`📻 <b>${esc(p.name)}</b> habla desde lejos.`);
  });
  if (touch.on) touchButtons();
  window.addEventListener("touchcontrols", () => { if (!root.querySelector(".tbtn")) touchButtons(); layout(); });
  setInterval(renderBar, 250);
  renderBar();
}
