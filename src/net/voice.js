/**
 * Voz entre jugadores (sólo en línea). Mantener T, o el botón 🎤, para hablar.
 *
 * La voz va por la misma conexión del juego (el servidor la reparte), en pedacitos de audio:
 * si el juego se conecta, la voz también llega, en cualquier red (Wi-Fi, datos, detrás del túnel).
 * Tarda unas décimas más que una llamada; para "mantén para hablar" no se nota.
 * (La primera versión iba de aparato a aparato con WebRTC y entre compu y celular no conectaba.)
 *
 * Por cercanía: en el mismo mapa se oye más fuerte mientras más cerca; si el otro anda en otro
 * lugar, se oye bajito, como radio.
 */

import { online, onNet, send, sendAudio } from "./online.js";

/** Muestras por segundo de lo que viaja: voz clara y ligera (32 KB/s mientras alguien habla). */
const RATE = 16000;
/** Colchón para que no se corte si un pedacito llega tarde. */
const LEAD = 0.12;

export const voice = {
  talking: false,
  /** "listo" | "pidiendo" | "sin permiso" | "sin micrófono" | "" (todavía no se pide) */
  mic: "",
  /** Mi posición, la pone el mapa actual: { map, x, y } */
  me: { map: null, x: 0, y: 0 },
  /** Por quién habla: bytes que llegaron (para revisar que sí llega). */
  heard: {},
  /** Bytes que mandé, y el error del micrófono si hubo (para revisar desde el servidor). */
  sent: 0,
  err: null,
  /** Qué tan fuerte llega mi voz ahora (0-1) y lo más fuerte de la última vez que hablé. */
  level: 0,
  peak: 0,
  lastPeak: null,
};

const micListeners = new Set();
/** Avisa cuando cambia el micrófono (pidiendo, listo, sin permiso…). */
export function onMicChange(fn) {
  micListeners.add(fn);
}

function setMic(state, err = null) {
  voice.mic = state;
  voice.err = err;
  for (const fn of micListeners) fn(state, err);
  report();
}

/** Cuenta al servidor cómo va la voz de este aparato (se ve en /estado). */
function report() {
  if (!online.connected) return;
  const ua = navigator.userAgent;
  const device = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "otro";
  send({ t: "vstat", mic: voice.mic || "sin pedir", err: voice.err, ctx: ctx?.state ?? "sin crear", sent: voice.sent, heard: voice.heard, device, lastPeak: voice.lastPeak });
}

let ctx = null;
let stream = null;
let asking = null;
/** id → { gain, next } */
const speakers = new Map();

function audioCtx() {
  if (!ctx) {
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

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

/** Pide el micrófono (una vez) y deja listo el grabador; sólo manda mientras hablas. */
async function ensureMic() {
  if (stream) return stream;
  if (asking) return asking;
  if (!navigator.mediaDevices?.getUserMedia) {
    setMic("sin micrófono", "este navegador no deja usar el micrófono");
    return null;
  }
  setMic("pidiendo");
  asking = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
    .then((s) => {
      const c = audioCtx();
      stream = s;
      const src = c.createMediaStreamSource(s);
      // ScriptProcessor: viejo pero funciona igual en Chrome, Safari (iPhone) y Firefox.
      const node = c.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = (e) => {
        if (!voice.talking) return;
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
      const mute = c.createGain();
      mute.gain.value = 0;
      node.connect(mute).connect(c.destination);
      setMic("listo");
      return s;
    })
    .catch((err) => {
      const name = err?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") setMic("sin permiso", name);
      else if (name === "NotReadableError" || name === "AbortError") setMic("ocupado", name);
      else setMic("sin micrófono", name || String(err));
      return null;
    })
    .finally(() => { asking = null; });
  return asking;
}

export async function startTalking() {
  if (!online.on || voice.talking) return;
  voice.talking = true;
  audioCtx();
  const s = await ensureMic();
  if (!s) { voice.talking = false; return; }
  if (!voice.talking) return;
  voice.peak = 0;
  voice.talkStart = performance.now();
  send({ t: "talk", on: true });
}

export function stopTalking() {
  if (!voice.talking) return;
  voice.talking = false;
  voice.level = 0;
  send({ t: "talk", on: false });
  // Si hablaste más de un segundo y no se captó nada, el micrófono no está oyendo.
  if (stream && performance.now() - (voice.talkStart ?? 0) > 1000) {
    voice.lastPeak = Math.round(voice.peak * 1000) / 1000;
    for (const fn of micListeners) fn(voice.peak < 0.02 ? "silencio" : "se oye", null);
    report();
  }
}

/** El navegador no deja sonar nada hasta que tocas algo: en cada toque se despierta el audio. */
export function resumeAudio() {
  audioCtx();
}

/** Llega un pedacito de voz de alguien: se forma en su fila y suena en cuanto toca. */
function play(buf) {
  const c = audioCtx();
  if (!c || buf.byteLength < 4) return;
  const id = new DataView(buf).getUint16(0);
  const pcm = new Int16Array(buf.slice(2));
  voice.heard[id] = (voice.heard[id] ?? 0) + pcm.byteLength;
  let sp = speakers.get(id);
  if (!sp) {
    const gain = c.createGain();
    gain.connect(c.destination);
    sp = { gain, next: 0 };
    speakers.set(id, sp);
  }
  const audio = c.createBuffer(1, pcm.length, RATE);
  const ch = audio.getChannelData(0);
  for (let i = 0; i < pcm.length; i += 1) ch[i] = pcm[i] / 0x7fff;
  const src = c.createBufferSource();
  src.buffer = audio;
  src.connect(sp.gain);
  const now = c.currentTime;
  // Si se quedó muy atrás (o es el primer pedacito), se empieza de nuevo con el colchón.
  if (sp.next < now || sp.next > now + 1) sp.next = now + LEAD;
  src.start(sp.next);
  sp.next += audio.duration;
}

/** Volumen por cercanía. */
function updateVolumes() {
  for (const [id, sp] of speakers) {
    const other = online.players.get(id);
    let vol = 0.35;
    if (other?.map && other.map === voice.me.map && other.pos) {
      const d = Math.hypot(other.pos.x - voice.me.x, other.pos.y - voice.me.y);
      vol = Math.max(0.3, Math.min(1, 1 - (d - 80) / 420));
    }
    sp.gain.gain.value = vol;
  }
}

export function setupVoice() {
  if (!online.on) return;
  onNet("audio", play);
  onNet("leave", (m) => { speakers.get(m.id)?.gain.disconnect(); speakers.delete(m.id); });
  setInterval(updateVolumes, 200);
  setInterval(report, 5000);
  onNet("welcome", () => setTimeout(report, 500));
  for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, resumeAudio, { passive: true });
}
