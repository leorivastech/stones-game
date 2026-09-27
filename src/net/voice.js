/**
 * Voz entre jugadores (sólo en línea). Mantener T, o el botón 🎤, para hablar.
 *
 * La voz va por la misma conexión del juego (el servidor la reparte), en pedacitos de audio:
 * si el juego se conecta, la voz también llega, en cualquier red (Wi-Fi, datos, detrás del túnel).
 * Tarda unas décimas más que una llamada; para "mantén para hablar" no se nota.
 * (La primera versión iba de aparato a aparato con WebRTC y entre compu y celular no conectaba.)
 *
 * Por cercanía: en el mismo mapa se oye más fuerte mientras más cerca; si el otro anda en otro
 * lugar, se oye más bajo, como radio.
 *
 * iPhone y iPad (27-sep, Leo: "ninguno de los dos escuchaba"), lo que se cuida aquí:
 *  - El sonido sólo se despierta con un toque de verdad. En Safari, "pointerdown" con el dedo no
 *    cuenta (sólo al soltar: touchend / pointerup / click): se intenta con todos.
 *  - iOS pone el audio en "interrupted" (al abrir el micrófono, al cambiar de app): se reanuda con
 *    cualquier estado que no sea "running", no sólo "suspended".
 *  - Con el micrófono abierto, iOS baja todo lo demás (o lo manda al auricular de arriba). Por eso en
 *    celular, tableta y Safari el micrófono se suelta 1.5 s después de dejar de hablar.
 *  - El botón de silencio del iPhone apaga el audio web: se pide sesión de "reproducción"
 *    (navigator.audioSession o, en iOS viejos, un <audio> mudo en bucle).
 *  - Buffers de 16 kHz: si el navegador no los acepta, se suben a la frecuencia del aparato.
 * Y todo queda a la vista: la barra dice "toca la pantalla para oír" si llega voz y el audio está
 * dormido, y /estado del servidor muestra, por aparato, cuánto llegó, cuánto sonó y qué tan fuerte.
 */

import { online, onNet, send, sendAudio } from "./online.js";

/** Muestras por segundo de lo que viaja: voz clara y ligera (32 KB/s mientras alguien habla). */
const RATE = 16000;
/** Colchón para que no se corte si un pedacito llega tarde. */
const LEAD = 0.12;
/** Volumen general de las voces (el micrófono del otro aparato ya viene con su ganancia automática). */
const MASTER = 1.6;

const UA = typeof navigator === "undefined" ? "" : navigator.userAgent;
export const IOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && (globalThis.navigator?.maxTouchPoints ?? 0) > 1);
const ANDROID = /Android/.test(UA);
const SAFARI = /Safari/.test(UA) && !/Chrome|Chromium|CriOS|FxiOS|Edg|Android/.test(UA);
/** Soltar el micrófono al dejar de hablar (ver arriba): en celular, tableta y Safari. */
const RELEASE_MIC = IOS || ANDROID || SAFARI;
const RELEASE_MS = 1500;

export const voice = {
  talking: false,
  /** "listo" | "pidiendo" | "sin permiso" | "sin micrófono" | "ocupado" | "" (todavía no se pide) */
  mic: "",
  /** Abriendo el micrófono (en iPhone tarda unas décimas cada vez). */
  opening: false,
  /** Mi posición, la pone el mapa actual: { map, x, y } */
  me: { map: null, x: 0, y: 0 },
  /** Por quién habla: bytes que llegaron (para revisar que sí llega). */
  heard: {},
  /** Pedacitos de voz: llegaron, sonaron, se tiraron (el audio estaba dormido). */
  rx: 0,
  played: 0,
  dropped: 0,
  /** Qué tan fuerte sale la voz de los demás por la bocina ahora (0-1) y lo más fuerte desde el último reporte. */
  outLevel: 0,
  outPeak: 0,
  /** Lo más fuerte que sonó la última vez que alguien habló (se ve en /estado: casi 0 = no se oye). */
  heardPeak: null,
  /** Llega voz pero el audio de la página está dormido: hay que tocar la pantalla. */
  needTap: false,
  /** Quién habló por última vez y cuándo (para la barra). */
  lastFrom: null,
  lastAt: 0,
  /** Bytes que mandé, y el error del micrófono si hubo (para revisar desde el servidor). */
  sent: 0,
  err: null,
  /** Qué tan fuerte llega mi voz ahora (0-1) y lo más fuerte de la última vez que hablé. */
  level: 0,
  peak: 0,
  lastPeak: null,
  ios: IOS,
};

const micListeners = new Set();
/** Avisa cuando cambia el micrófono (pidiendo, listo, sin permiso…) o el sonido ("toca", "suena"). */
export function onMicChange(fn) {
  micListeners.add(fn);
}

function tell(state, err = null) {
  for (const fn of micListeners) {
    try { fn(state, err); } catch (e) { console.error("[voz]", e); }
  }
}

function setMic(state, err = null) {
  voice.mic = state;
  voice.err = err;
  tell(state, err);
  report();
}

function deviceName() {
  if (IOS) return /iPad|Macintosh/.test(UA) ? "iPad" : "iPhone";
  return ANDROID ? "Android" : /Mac/.test(UA) ? "Mac" : /Windows/.test(UA) ? "Windows" : /Linux/.test(UA) ? "Linux" : "otro";
}

/** Cuenta al servidor cómo va la voz de este aparato (se ve en /estado). */
function report() {
  if (!online.connected) return;
  const os = UA.match(/OS (\d+)_(\d+)/);
  const track = cap?.stream.getAudioTracks()[0];
  send({
    t: "vstat", mic: voice.mic || "sin pedir", err: voice.err, ctx: ctx?.state ?? "sin crear", rate: ctx?.sampleRate ?? null,
    micRate: track?.getSettings?.().sampleRate ?? null, micOpen: Boolean(cap), sent: voice.sent, heard: voice.heard,
    rx: voice.rx, played: voice.played, dropped: voice.dropped, outPeak: voice.heardPeak, needTap: voice.needTap,
    session: sessionName(), device: deviceName(), ios: os ? `${os[1]}.${os[2]}` : null, lastPeak: voice.lastPeak,
    ogg: Boolean(document.createElement("audio").canPlayType?.('audio/ogg; codecs="vorbis"')),
  });
}

let ctx = null;
/** El micrófono abierto: { stream, src, node, sink } */
let cap = null;
let asking = null;
let releaseTimer = null;
let announced = false;
let primed = false;
let master = null;
let meter = null;
let meterBuf = null;
/** id → { gain, next } */
const speakers = new Map();

function audioCtx() {
  if (!ctx) {
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    voice.ctx = ctx;
    ctx.onstatechange = () => {
      if (ctx.state === "running" && voice.needTap) { voice.needTap = false; tell("suena"); }
      report();
    };
    // Todas las voces pasan por aquí: volumen general, un compresor (que no truene) y el medidor.
    master = ctx.createGain();
    master.gain.value = MASTER;
    const comp = ctx.createDynamicsCompressor?.();
    meter = ctx.createAnalyser();
    // Ventana larga (~0.3 s): el medidor ve cada sílaba aunque se lea cada 200 ms.
    meter.fftSize = 16384;
    meterBuf = new Uint8Array(meter.fftSize);
    if (comp) master.connect(comp).connect(meter);
    else master.connect(meter);
    meter.connect(ctx.destination);
  }
  if (ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});
  return ctx;
}

// ---------------------------------------------------------------------- despertar el audio (iPhone)

/** "playback": suena aunque el iPhone esté en silencio. "play-and-record": mientras el micrófono está abierto. */
function setSession(type) {
  const s = globalThis.navigator?.audioSession;
  if (!s || !IOS) return;
  try { if (s.type !== type) s.type = type; } catch { /* navegador que no deja */ }
}

let silentEl = null;
function sessionName() {
  const s = globalThis.navigator?.audioSession;
  if (s) return s.type;
  if (silentEl) return silentEl.paused ? "audio mudo (parado)" : "audio mudo";
  return "—";
}

/** Un WAV mudo de 0.5 s (8 kHz), hecho aquí: sin archivos extra. */
function silentWav() {
  const n = 4000;
  const b = new DataView(new ArrayBuffer(44 + n));
  const str = (o, s) => { for (let i = 0; i < s.length; i += 1) b.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); b.setUint32(4, 36 + n, true); str(8, "WAVE"); str(12, "fmt ");
  b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, 8000, true);
  b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true); str(36, "data"); b.setUint32(40, n, true);
  for (let i = 0; i < n; i += 1) b.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([b.buffer], { type: "audio/wav" }));
}

/**
 * En cada toque: despierta el audio si está dormido. En iPhone, además, la sesión de reproducción
 * (para que el botón de silencio no apague las voces) y el truco clásico de sonar un buffer vacío.
 */
export function resumeAudio() {
  const c = audioCtx();
  if (!c) return;
  if (!primed) {
    primed = true;
    try {
      const b = c.createBuffer(1, 1, c.sampleRate);
      const src = c.createBufferSource();
      src.buffer = b;
      src.connect(c.destination);
      src.start(0);
    } catch { /* nada */ }
  }
  if (!IOS) return;
  if (globalThis.navigator?.audioSession) { if (!cap && !asking) setSession("playback"); return; }
  if (!silentEl) {
    silentEl = document.createElement("audio");
    silentEl.src = silentWav();
    silentEl.loop = true;
    silentEl.setAttribute("playsinline", "");
    silentEl.setAttribute("x-webkit-airplay", "deny");
  }
  if (silentEl.paused) silentEl.play().catch(() => {});
}

/** Llega voz y el audio no suena: se intenta sin toque (iOS a veces deja) y si no, se pide tocar. */
let wakeTimer = null;
function wake(c) {
  c.resume().catch(() => {});
  if (wakeTimer) return;
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    if (c.state !== "running" && !voice.needTap) { voice.needTap = true; tell("toca"); report(); }
  }, 700);
}

// ---------------------------------------------------------------------- micrófono

/** De la frecuencia del aparato (44.1 o 48 kHz) a 16 kHz, en enteros de 16 bits. */
function encode(input, from) {
  const ratio = from / RATE;
  const n = Math.floor(input.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i += 1) {
    const pos = i * ratio;
    const k = Math.floor(pos);
    const a = input[k] ?? 0;
    const b = input[k + 1] ?? a;
    const v = a + (b - a) * (pos - k);
    out[i] = Math.max(-1, Math.min(1, v)) * 0x7fff;
  }
  return out;
}

/** Abre el micrófono (la primera vez pide permiso) y lo conecta al grabador; sólo manda mientras hablas. */
function ensureMic() {
  if (cap) return Promise.resolve(true);
  if (asking) return asking;
  if (!navigator.mediaDevices?.getUserMedia) {
    setMic("sin micrófono", globalThis.isSecureContext === false ? "hace falta https (usa el enlace del túnel)" : "este navegador no deja usar el micrófono");
    return Promise.resolve(false);
  }
  if (voice.mic !== "listo") setMic("pidiendo");
  voice.opening = true;
  setSession("play-and-record");
  asking = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
    .then((s) => {
      const c = audioCtx();
      if (!c) { s.getTracks().forEach((t) => t.stop()); setMic("sin micrófono", "sin audio web"); return false; }
      const src = c.createMediaStreamSource(s);
      // ScriptProcessor: viejo pero funciona igual en Chrome, Safari (iPhone) y Firefox.
      const node = c.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = (e) => {
        if (!voice.talking || cap?.node !== node) return;
        const input = e.inputBuffer.getChannelData(0);
        // Nivel (para el medidor y para saber si el micrófono capta algo).
        let sum = 0;
        for (let i = 0; i < input.length; i += 1) sum += input[i] * input[i];
        voice.level = Math.min(1, Math.sqrt(sum / input.length) * 6);
        voice.peak = Math.max(voice.peak, voice.level);
        const buf = encode(input, c.sampleRate).buffer;
        voice.sent += buf.byteLength;
        sendAudio(buf);
      };
      src.connect(node);
      // Para que el navegador lo haga correr tiene que ir a la salida (sale en silencio).
      const sink = c.createGain();
      sink.gain.value = 0;
      node.connect(sink).connect(c.destination);
      cap = { stream: s, src, node, sink };
      // iOS corta el micrófono si cambias de app: se suelta y se vuelve a abrir al hablar.
      for (const t of s.getAudioTracks()) t.addEventListener("ended", () => { if (cap?.stream === s) closeMic(); });
      if (voice.mic !== "listo") setMic("listo");
      else report();
      return true;
    })
    .catch((err) => {
      setSession("playback");
      const name = err?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") setMic("sin permiso", name);
      else if (name === "NotReadableError" || name === "AbortError") setMic("ocupado", name);
      else setMic("sin micrófono", name || String(err));
      return false;
    })
    .finally(() => { asking = null; voice.opening = false; });
  return asking;
}

/** Suelta el micrófono (en iPhone, así lo demás vuelve a sonar fuerte y por la bocina). */
function closeMic() {
  clearTimeout(releaseTimer);
  releaseTimer = null;
  if (!cap) return;
  const { stream, src, node, sink } = cap;
  cap = null;
  try { src.disconnect(); node.disconnect(); sink.disconnect(); } catch { /* ya desconectado */ }
  node.onaudioprocess = null;
  for (const t of stream.getTracks()) t.stop();
  setSession("playback");
  report();
}

export async function startTalking() {
  if (!online.on || voice.talking) return;
  voice.talking = true;
  clearTimeout(releaseTimer);
  resumeAudio();
  const ok = await ensureMic();
  if (!ok) { voice.talking = false; return; }
  if (!voice.talking) return;
  resumeAudio();
  voice.peak = 0;
  voice.talkStart = performance.now();
  announced = true;
  send({ t: "talk", on: true });
}

export function stopTalking() {
  if (!voice.talking) return;
  voice.talking = false;
  voice.level = 0;
  if (announced) send({ t: "talk", on: false });
  announced = false;
  // Si hablaste más de un segundo y no se captó nada, el micrófono no está oyendo.
  if (cap && performance.now() - (voice.talkStart ?? 0) > 1000) {
    voice.lastPeak = Math.round(voice.peak * 1000) / 1000;
    tell(voice.peak < 0.02 ? "silencio" : "se oye");
    report();
  }
  if (RELEASE_MIC) {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => { if (!voice.talking) closeMic(); }, RELEASE_MS);
  }
}

// ---------------------------------------------------------------------- lo que llega

let rate16 = true;
/** Buffer del pedacito: a 16 kHz si el navegador lo acepta; si no, subido a la frecuencia del aparato. */
function makeBuffer(c, pcm) {
  if (rate16) {
    try {
      const audio = c.createBuffer(1, pcm.length, RATE);
      const ch = audio.getChannelData(0);
      for (let i = 0; i < pcm.length; i += 1) ch[i] = pcm[i] / 0x7fff;
      return audio;
    } catch {
      rate16 = false;
    }
  }
  const ratio = c.sampleRate / RATE;
  const n = Math.floor(pcm.length * ratio);
  const audio = c.createBuffer(1, n, c.sampleRate);
  const ch = audio.getChannelData(0);
  for (let i = 0; i < n; i += 1) {
    const pos = i / ratio;
    const k = Math.floor(pos);
    const a = pcm[k] ?? 0;
    const b = pcm[k + 1] ?? a;
    ch[i] = (a + (b - a) * (pos - k)) / 0x7fff;
  }
  return audio;
}

/** Llega un pedacito de voz de alguien: se forma en su fila y suena en cuanto toca. */
function play(buf) {
  if (buf.byteLength < 4) return;
  const id = new DataView(buf).getUint16(0);
  const pcm = new Int16Array(buf.slice(2, 2 + (Math.floor((buf.byteLength - 2) / 2) * 2)));
  voice.rx += 1;
  // Empieza a hablar alguien (más de 1 s sin voz): se mide de nuevo qué tan fuerte suena.
  if (performance.now() - voice.lastAt > 1000) voice.outPeak = 0;
  voice.heard[id] = (voice.heard[id] ?? 0) + pcm.byteLength;
  voice.lastFrom = id;
  voice.lastAt = performance.now();
  const c = audioCtx();
  if (!c) { voice.dropped += 1; return; }
  if (c.state !== "running") { voice.dropped += 1; wake(c); return; }
  let sp = speakers.get(id);
  if (!sp) {
    const gain = c.createGain();
    gain.connect(master);
    sp = { gain, next: 0 };
    speakers.set(id, sp);
    updateVolumes();
  }
  const audio = makeBuffer(c, pcm);
  const src = c.createBufferSource();
  src.buffer = audio;
  src.connect(sp.gain);
  const now = c.currentTime;
  // Si se quedó muy atrás (o es el primer pedacito), se empieza de nuevo con el colchón.
  if (sp.next < now || sp.next > now + 1) sp.next = now + LEAD;
  src.start(sp.next);
  sp.next += audio.duration;
  voice.played += 1;
}

/** Volumen por cercanía, y el medidor de lo que sale por la bocina. */
function updateVolumes() {
  for (const [id, sp] of speakers) {
    const other = online.players.get(id);
    let vol = 0.6;
    if (other?.map && other.map === voice.me.map && other.pos) {
      const d = Math.hypot(other.pos.x - voice.me.x, other.pos.y - voice.me.y);
      vol = Math.max(0.5, Math.min(1, 1 - (d - 80) / 420));
    }
    sp.gain.gain.value = vol;
  }
  if (meter && ctx?.state === "running") {
    meter.getByteTimeDomainData(meterBuf);
    let top = 0;
    for (let i = 0; i < meterBuf.length; i += 1) top = Math.max(top, Math.abs(meterBuf[i] - 128));
    voice.outLevel = Math.min(1, top / 128);
    if (performance.now() - voice.lastAt < 800) {
      voice.outPeak = Math.max(voice.outPeak, voice.outLevel);
      voice.heardPeak = Math.round(voice.outPeak * 1000) / 1000;
    }
  } else voice.outLevel = 0;
}

export function setupVoice() {
  if (!online.on) return;
  onNet("audio", play);
  onNet("leave", (m) => { speakers.get(m.id)?.gain.disconnect(); speakers.delete(m.id); });
  setInterval(updateVolumes, 200);
  setInterval(report, 5000);
  onNet("welcome", () => setTimeout(report, 500));
  // Cualquier toque o tecla despierta el audio (en iPhone sólo cuentan los de "soltar": se escuchan todos).
  for (const ev of ["touchstart", "touchend", "pointerdown", "pointerup", "mousedown", "click", "keydown"]) {
    window.addEventListener(ev, resumeAudio, { passive: true, capture: true });
  }
  // Al esconder la página (bloquear el celular, cambiar de app) se suelta el micrófono.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (voice.talking) stopTalking(); closeMic(); }
    else if (ctx) ctx.resume().catch(() => {});
  });
}
