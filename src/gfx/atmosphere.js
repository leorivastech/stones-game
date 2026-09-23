/** Capas de ambiente y props. Todo sigue siendo proto generado en código. */

import { TOWNS } from "../world.js";

function prop(scene, key, x, y, scale = 1, alpha = 1) {
  return scene.add.image(x, y, key)
    .setOrigin(0.5, 0.88)
    .setScale(scale)
    .setAlpha(alpha)
    .setDepth(y);
}

/**
 * Props sueltos del pueblo (mundo 1000×700, plaza en 500,350) y partículas.
 * Cada bioma tiene su basura bonita: fardos en el campo, mena en la montaña,
 * ánforas y huesos en el desierto, leña y barriles en la nieve.
 */
export function addTownAtmosphere(scene, townId, worldW = 1000, worldH = 700) {
  const biome = TOWNS[townId]?.biome ?? "temperate";
  const propsByBiome = {
    temperate: [
      ["hay", 250, 262, 1], ["hay", 292, 252, 0.8], ["barrel", 412, 264, 0.9],
      ["crate", 590, 270, 0.9], ["crate", 612, 262, 0.75], ["ore-pile", 748, 486, 0.8],
      ["fence", 190, 236, 1], ["fence", 260, 236, 1], ["rock", 806, 420, 0.8],
    ],
    mountain: [
      ["ore-pile", 258, 262, 0.95], ["ore-pile", 730, 472, 0.8], ["crate", 412, 264, 0.85],
      ["barrel", 590, 268, 0.82], ["boulder", 216, 470, 1], ["rock", 800, 264, 0.9],
    ],
    tropical: [
      ["crate", 412, 266, 0.8], ["barrel", 590, 268, 0.82], ["hay", 262, 470, 0.8],
      ["bigleaf", 236, 258, 1], ["reed", 760, 480, 1], ["reed", 786, 490, 0.85],
    ],
    desert: [
      ["crate", 412, 266, 0.9], ["barrel", 590, 268, 0.9], ["hay", 250, 470, 1.05],
      ["bones", 812, 478, 1], ["cactus", 236, 258, 1], ["cactus", 782, 258, 0.8],
    ],
    snow: [
      ["crate", 412, 266, 0.9], ["barrel", 590, 268, 0.9], ["hay", 258, 470, 0.85],
      ["ore-pile", 748, 486, 0.62], ["fence", 190, 236, 1], ["fence", 760, 236, 1],
    ],
  };
  const props = propsByBiome[biome] ?? propsByBiome.temperate;
  props.forEach(([key, x, y, scale]) => prop(scene, key, x, y, scale));

  const particle = biome === "snow" ? "snowflake" : biome === "tropical" ? "leaf" : "dust";
  const motes = scene.add.particles(0, 0, particle, {
    x: { min: 40, max: worldW - 40 },
    y: { min: 60, max: worldH - 60 },
    speedX: { min: 5, max: 15 },
    speedY: biome === "snow" ? { min: 10, max: 24 } : { min: -5, max: 8 },
    lifespan: { min: 4500, max: 7600 },
    scale: { start: biome === "temperate" || biome === "desert" ? 0.35 : 0.42, end: 0.08 },
    alpha: { start: 0.26, end: 0 },
    rotate: { min: 0, max: 180 },
    frequency: 560,
    maxAliveParticles: 16,
    quantity: 1,
  });
  motes.setDepth(880);
}

/**
 * Velo de luz por bioma: un tinte muy suave sobre todo el mundo (frío en la
 * nieve, ámbar en el desierto, verde húmedo en la selva). Va debajo del HUD.
 */
export function addAmbientVeil(scene, biome, worldW, worldH) {
  const veil = {
    snow: [0x9fc4d8, 0.1],
    desert: [0xffb860, 0.08],
    tropical: [0x5fb070, 0.07],
    mountain: [0x9fb0c0, 0.06],
    temperate: [0xffe9b0, 0.04],
  }[biome] ?? [0xffffff, 0];
  if (!veil[1]) return null;
  return scene.add.rectangle(worldW / 2, worldH / 2, worldW + 600, worldH + 600, veil[0], veil[1]).setDepth(9500);
}

/**
 * Sombras de nubes: manchas suaves que cruzan el mundo muy despacio.
 * Van por encima de todo lo del suelo y debajo del HUD.
 */
export function addCloudShadows(scene, worldW, worldH, count = 3, alpha = 0.07) {
  for (let i = 0; i < count; i += 1) {
    const cloud = scene.add.graphics().setDepth(9480).setAlpha(alpha);
    cloud.fillStyle(0x0a1410, 1);
    const w = 260 + i * 70;
    const h = 120 + i * 30;
    cloud.fillEllipse(0, 0, w, h);
    cloud.fillEllipse(w * 0.3, -h * 0.25, w * 0.6, h * 0.7);
    cloud.fillEllipse(-w * 0.3, h * 0.2, w * 0.55, h * 0.6);
    cloud.fillEllipse(w * 0.15, h * 0.3, w * 0.5, h * 0.5);
    const y = 80 + (i / Math.max(1, count - 1)) * (worldH - 160);
    const duration = 42000 + i * 9000;
    cloud.setPosition(-w + (i * 0.37 * (worldW + w * 2)) % (worldW + w * 2), y);
    scene.tweens.add({
      targets: cloud,
      x: worldW + w,
      duration: duration * (1 - (cloud.x + w) / (worldW + w * 2)),
      ease: "Linear",
      onComplete: () => {
        cloud.x = -w;
        scene.tweens.add({ targets: cloud, x: worldW + w, duration, ease: "Linear", repeat: -1, onRepeat: () => { cloud.x = -w; } });
      },
    });
  }
}

/** Brillo de agua en el pozo: una lentejuela clara que respira. */
export function addWellShimmer(scene, x, y) {
  const glint = scene.add.ellipse(x, y - 11, 14, 5, 0xbfe6ea, 0.55).setDepth(y + 0.5);
  scene.tweens.add({
    targets: glint,
    scaleX: 1.35,
    alpha: 0.2,
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut",
  });
  return glint;
}

/** Viñeta: bordes del mundo un poco más oscuros, el centro respira. */
export function addVignette(scene, worldW, worldH, color, band = 120, strength = 0.42, topPad = 0) {
  const top = -topPad;
  const tall = worldH + topPad;
  const frame = scene.add.graphics().setDepth(9490);
  frame.fillGradientStyle(color, color, color, color, strength, strength, 0, 0);
  frame.fillRect(0, top, worldW, band);
  frame.fillGradientStyle(color, color, color, color, 0, 0, strength, strength);
  frame.fillRect(0, worldH - band, worldW, band);
  frame.fillGradientStyle(color, color, color, color, strength, 0, strength, 0);
  frame.fillRect(0, top, band, tall);
  frame.fillGradientStyle(color, color, color, color, 0, strength, 0, strength);
  frame.fillRect(worldW - band, top, band, tall);
  return frame;
}

export function addWarmGlow(scene, x, y, radius = 58) {
  const glow = scene.add.circle(x, y, radius, 0xf28b2f, 0.085)
    .setBlendMode("ADD")
    .setDepth(y - 8);
  scene.tweens.add({
    targets: glow,
    scale: 1.12,
    alpha: 0.13,
    duration: 1100,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut",
  });
  return glow;
}

export function addChimneySmoke(scene, x, y) {
  return scene.add.particles(x, y, "smoke", {
    speedX: { min: -5, max: 7 },
    speedY: { min: -18, max: -10 },
    lifespan: { min: 1700, max: 2800 },
    scale: { start: 0.45, end: 1.15 },
    alpha: { start: 0.2, end: 0 },
    frequency: 680,
    maxAliveParticles: 5,
  }).setDepth(y + 2);
}

export function addFootDust(scene, walker) {
  const dust = scene.add.particles(0, 0, "dust", {
    follow: walker,
    followOffset: { x: 0, y: 19 },
    speedX: { min: -16, max: 16 },
    speedY: { min: 2, max: 10 },
    lifespan: 420,
    scale: { start: 0.34, end: 0.05 },
    alpha: { start: 0.26, end: 0 },
    frequency: 120,
    maxAliveParticles: 6,
  });
  dust.setDepth(walker.depth - 1);
  dust.stop();
  return dust;
}
