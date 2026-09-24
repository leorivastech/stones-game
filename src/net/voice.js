/**
 * Voz entre jugadores (sólo en línea). WebRTC directo de navegador a navegador; el servidor sólo
 * pasa los mensajes para conectarse. Mantener T (o el botón 🎤) para hablar.
 *
 * Por cercanía: en el mismo mapa se oye más fuerte mientras más cerca; si el otro anda en otro
 * lugar, se oye bajito, como radio.
 *
 * El micrófono se pide la primera vez que aprietas para hablar. Sin servidor de relevo (TURN):
 * en casi todas las redes de casa funciona; con algunos datos móviles puede no conectar.
 */

import { online, onNet, send } from "./online.js";

const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
/** id → { pc, tr, audio } */
const peers = new Map();
let stream = null;
let asking = null;

export const voice = {
  talking: false,
  micError: null,
  /** Mi posición, la pone el mapa actual: { map, x, y } */
  me: { map: null, x: 0, y: 0 },
  peers,
};

function track() {
  return stream?.getAudioTracks()[0] ?? null;
}

function makePeer(id, initiator) {
  peers.get(id)?.pc.close();
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const audio = new Audio();
  audio.autoplay = true;
  audio.playsInline = true;
  const peer = { id, pc, tr: null, audio };
  if (initiator) {
    peer.tr = pc.addTransceiver("audio", { direction: "sendrecv" });
    if (track()) peer.tr.sender.replaceTrack(track());
  }
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    audio.play().catch(() => {});
  };
  pc.onicecandidate = (e) => { if (e.candidate) send({ t: "rtc", to: id, data: { ice: e.candidate } }); };
  peers.set(id, peer);
  return peer;
}

async function call(id) {
  const peer = makePeer(id, true);
  await peer.pc.setLocalDescription(await peer.pc.createOffer());
  send({ t: "rtc", to: id, data: { sdp: peer.pc.localDescription } });
}

async function onSignal(m) {
  let peer = peers.get(m.from);
  const d = m.data;
  if (d.sdp) {
    if (d.sdp.type === "offer") {
      peer = makePeer(m.from, false);
      await peer.pc.setRemoteDescription(d.sdp);
      // El que contesta usa el canal de audio que trae la oferta.
      peer.tr = peer.pc.getTransceivers()[0];
      if (peer.tr) {
        peer.tr.direction = "sendrecv";
        if (track()) await peer.tr.sender.replaceTrack(track());
      }
      await peer.pc.setLocalDescription(await peer.pc.createAnswer());
      send({ t: "rtc", to: m.from, data: { sdp: peer.pc.localDescription } });
    } else if (peer) {
      await peer.pc.setRemoteDescription(d.sdp);
    }
  } else if (d.ice && peer) {
    try { await peer.pc.addIceCandidate(d.ice); } catch { /* candidato viejo */ }
  }
}

/** Pide el micrófono (una vez). Queda apagado hasta que aprietas para hablar. */
async function ensureMic() {
  if (stream) return stream;
  if (asking) return asking;
  asking = navigator.mediaDevices?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    .then((s) => {
      stream = s;
      track().enabled = false;
      for (const p of peers.values()) p.tr?.sender.replaceTrack(track());
      return s;
    })
    .catch((err) => { voice.micError = err?.name ?? "sin micrófono"; return null; })
    .finally(() => { asking = null; });
  return asking;
}

export async function startTalking() {
  if (!online.on || voice.talking) return;
  voice.talking = true;
  const s = await ensureMic();
  if (!s || !voice.talking) { voice.talking = Boolean(s) && voice.talking; return; }
  track().enabled = true;
  send({ t: "talk", on: true });
  resumeAudio();
}

export function stopTalking() {
  if (!voice.talking) return;
  voice.talking = false;
  if (track()) track().enabled = false;
  send({ t: "talk", on: false });
}

/** El navegador no deja sonar audio hasta que tocas algo: se reintenta en cada toque. */
export function resumeAudio() {
  for (const p of peers.values()) if (p.audio.paused && p.audio.srcObject) p.audio.play().catch(() => {});
}

/** Volumen por cercanía. */
function updateVolumes() {
  for (const p of peers.values()) {
    const other = online.players.get(p.id);
    let vol = 0.35;
    if (other?.map && other.map === voice.me.map && other.pos) {
      const d = Math.hypot(other.pos.x - voice.me.x, other.pos.y - voice.me.y);
      vol = Math.max(0.25, Math.min(1, 1 - (d - 80) / 420));
    }
    p.audio.volume = vol;
  }
}

export function setupVoice() {
  if (!online.on || typeof RTCPeerConnection === "undefined") return;
  // El que llega le habla a los que ya estaban (así nunca se llaman los dos a la vez).
  onNet("welcome", (m) => { for (const p of m.players) call(p.id); });
  onNet("leave", (m) => { peers.get(m.id)?.pc.close(); peers.delete(m.id); });
  onNet("rtc", (m) => { onSignal(m).catch((err) => console.warn("[voz]", err)); });
  setInterval(updateVolumes, 200);
  for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, resumeAudio, { passive: true });
}
