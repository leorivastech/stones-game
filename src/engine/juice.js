/**
 * Jugo del combate: congelado al pegar (hitstop), sacudida por evento, aplastar/estirar y vibración.
 *
 * El congelado es propio de cada cosa (jugador y enemigo golpeado), no del reloj de la escena:
 * los timers de la interfaz, la red y los demás enemigos siguen corriendo. En línea es solo visual.
 */

import { SHAKE, SHAKE_SCALE } from "../config.js";
import { touch } from "./touch.js";

/**
 * ¿Está congelado? Pausa (una vez) el cuerpo y la animación mientras dure, y los suelta al terminar.
 * El cuerpo conserva su velocidad: el empujón sale justo cuando se descongela.
 */
export function frozen(obj, until, now) {
  const s = obj.sprite;
  if (!s?.active) return false;
  if (until > now) {
    if (!obj._stopped) {
      obj._stopped = true;
      if (s.body) s.body.moves = false;
      s.anims?.pause();
    }
    return true;
  }
  if (obj._stopped) release(obj);
  return false;
}

/** Suelta un congelado a medias (al morir, al cambiar de estado a la fuerza). */
export function release(obj) {
  obj._stopped = false;
  const s = obj.sprite;
  if (!s?.active) return;
  if (s.body) s.body.moves = true;
  s.anims?.resume();
}

/** Congela `ms` al jugador (vía la escena) y a los enemigos que se pasen; los títeres de red no. */
export function hitstop(scene, ms, ...enemies) {
  const now = scene.time.now;
  const until = now + ms;
  scene.hitstopUntil = Math.max(scene.hitstopUntil ?? 0, until);
  if (scene.player) frozen(scene.player, scene.hitstopUntil, now);
  for (const e of enemies) {
    if (!e || e.puppet || e.dead || !e.sprite?.active) continue;
    e.hitstopUntil = Math.max(e.hitstopUntil ?? 0, until);
    frozen(e, e.hitstopUntil, now);
  }
}

/** Sacudida de cámara según lo que pasó ("hit", "kill", "hurt", "charge", "bump"). */
export function shake(scene, kind) {
  const [ms, amount] = SHAKE[kind] ?? SHAKE.hit;
  if (SHAKE_SCALE <= 0) return;
  // Lo fuerte pisa a lo leve; lo leve no corta una sacudida fuerte en curso.
  scene.cameras.main.shake(ms, amount * SHAKE_SCALE, kind !== "hit");
}

/** Aplasta o estira un sprite y lo regresa a su tamaño. Con origen en los pies no se hunde. */
export function squash(scene, sprite, sx, sy, ms = 110) {
  if (!sprite?.active) return;
  sprite._squashTween?.stop();
  sprite.setScale(sx, sy);
  sprite._squashTween = scene.tweens.add({
    targets: sprite,
    scaleX: 1,
    scaleY: 1,
    duration: ms,
    ease: "Quad.Out",
    onStop: () => sprite.active && sprite.setScale(1),
  });
}

/** Vibra el celular (solo con controles táctiles). */
export function buzz(ms) {
  if (!touch.on) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Algunos navegadores lo bloquean sin gesto del usuario: no pasa nada.
  }
}
