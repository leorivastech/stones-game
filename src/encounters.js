/** Encuentros del camino. Retén, asalto y confiscación piden E / Q / X. Camino quieto sigue automático. */

import { addHeat, ambushProtection, gold, hasUpgrade, loseStones, pay, routeHeat, stones, TOWNS, visibleStones } from "./state.js";
import { flashNote } from "./hud.js";
import { steerWalker } from "./player.js";
import { duckTheme, restoreTheme, sfx } from "./sfx.js";

function plant(scene, key, x, y, opts = {}) {
  const img = scene.add.image(x, y, key).setOrigin(0.5, 0.88).setDepth(y + (opts.depth ?? 0));
  if (opts.flipX) img.setFlipX(true);
  if (opts.alpha != null) img.setAlpha(opts.alpha);
  if (opts.scale != null) img.setScale(opts.scale);
  return img;
}

function bob(scene, target, px, ms) {
  scene.tweens.add({
    targets: target,
    y: `-=${px}`,
    duration: ms,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut",
  });
}

function later(scene, ms, fn) {
  scene.time.delayedCall(ms, fn);
}

function at(scene) {
  return scene.eventAt ?? { x: scene.player.x, y: scene.player.y };
}

function addVeil(scene, color = 0x100804, toAlpha = 0.32) {
  const veil = scene.add.rectangle(400, 225, 820, 470, color, 1)
    .setScrollFactor(0)
    .setDepth(8200)
    .setAlpha(0);
  scene.tweens.add({ targets: veil, alpha: toAlpha, duration: 220 });
  return veil;
}

function fadeVeil(scene, veil) {
  if (veil?.active) scene.tweens.add({ targets: veil, alpha: 0, duration: 280 });
}

function note(scene, line) {
  scene.hud.refresh();
  flashNote(scene, line);
}

function freezePlayer(scene) {
  scene.busy = true;
  steerWalker(scene.player, 0, 0, 0);
}

function releasePlayer(scene) {
  restoreTheme(scene);
  scene.busy = false;
}

function fleeHome(scene, veil) {
  later(scene, 700, () => {
    restoreTheme(scene);
    if (veil?.active) veil.destroy();
    scene.turnBack();
  });
}

function letPass(scene, veil, animateLeave) {
  fadeVeil(scene, veil);
  later(scene, 360, animateLeave);
  later(scene, 950, () => {
    if (veil?.active) veil.destroy();
    releasePlayer(scene);
  });
}

function guardBribeCost(scene) {
  return 8 + Math.floor(routeHeat(scene.registry, scene.from, scene.to) / 25) * 2;
}

function seizeBribeCost(scene) {
  return 12 + Math.floor(routeHeat(scene.registry, scene.from, scene.to) / 20) * 3;
}

function ambushLoss(scene) {
  const load = stones(scene.registry);
  if (!load) return { threatened: 0, cover: 0, loss: 0 };
  const threatened = Math.max(1, Math.ceil(load / 2));
  const cover = ambushProtection(scene.registry);
  return { threatened, cover, loss: Math.max(0, threatened - cover) };
}

function banditPayCost(scene) {
  const { threatened } = ambushLoss(scene);
  return threatened ? 6 + threatened * 2 : 0;
}

function offerChoices(scene, title, options, onPick) {
  const panel = showActionPanel(scene, title, options);
  const keys = scene.input.keyboard.addKeys("E,Q,X");
  const offs = [];
  let locked = false;
  const finish = (id) => {
    if (locked) return;
    locked = true;
    offs.forEach((fn) => fn());
    panel.close();
    onPick(id);
  };
  const byKey = {};
  options.forEach((opt) => { byKey[opt.key] = opt.id; });
  ["E", "Q", "X"].forEach((name) => {
    const id = byKey[name];
    const key = keys[name];
    if (!id || !key) return;
    const fn = () => finish(id);
    key.on("down", fn);
    offs.push(() => key.off("down", fn));
  });
  panel.onPick(finish);
}

export function playRoadEvent(scene, kind) {
  freezePlayer(scene);
  duckTheme(scene);
  scene.registry.set("lastEvent", kind);
  if (kind === "checkpoint") playCheckpoint(scene);
  else if (kind === "ambush") playAmbush(scene);
  else if (kind === "seize") playSeize(scene);
  else playClear(scene);
}

function playClear(scene) {
  const y = at(scene).y;
  const horse = plant(scene, "horse", at(scene).x - 420, y, { flipX: false, depth: 4 });
  const cart = plant(scene, "cart", at(scene).x - 490, y + 6, { depth: 3 });
  const rider = plant(scene, "npc-bandit", at(scene).x - 426, y - 18, { depth: 5, scale: 0.85 });
  bob(scene, horse, 3, 280);

  sfx(scene, "horse", { volume: 0.45 });
  sfx(scene, "cart", { volume: 0.55 });
  later(scene, 700, () => sfx(scene, "cart", { volume: 0.4 }));
  later(scene, 1500, () => sfx(scene, "cart", { volume: 0.35 }));

  scene.tweens.add({
    targets: [horse, cart, rider],
    x: "+=980",
    duration: 3200,
    ease: "Sine.InOut",
  });
  later(scene, 900, () => note(scene, "Camino quieto. Un carromato pasó de largo."));
  later(scene, 2400, () => releasePlayer(scene));
  later(scene, 3400, () => {
    horse.destroy();
    cart.destroy();
    rider.destroy();
  });
}

function playCheckpoint(scene) {
  const a = scene.goingDown ? 1 : -1;
  const cx = at(scene).x;
  const cy = at(scene).y;
  const barrier = plant(scene, "barrier", cx, cy + a * 10, { depth: 3, alpha: 0 });
  const g1 = plant(scene, "npc-guard", cx - 190, cy + a * 24, { depth: 6, alpha: 0 });
  const g2 = plant(scene, "npc-guard", cx + 190, cy + a * 24, { depth: 6, alpha: 0, flipX: true });
  const horse = plant(scene, "horse", cx + 240, cy + a * 8, { depth: 4, alpha: 0, flipX: true });
  bob(scene, horse, 3, 640);

  const veil = addVeil(scene, 0x100804, 0.32);
  scene.cameras.main.flash(180, 36, 18, 10);
  scene.cameras.main.shake(200, 0.007);

  sfx(scene, "horn", { volume: 0.42 });
  sfx(scene, "latch", { volume: 0.7 });
  later(scene, 280, () => sfx(scene, "click", { volume: 0.65 }));
  later(scene, 640, () => sfx(scene, "horse", { volume: 0.28 }));

  scene.tweens.add({
    targets: [barrier, g1, g2, horse],
    alpha: 1,
    duration: 280,
  });
  scene.tweens.add({ targets: g1, x: cx - 52, duration: 520, ease: "Cubic.easeOut" });
  scene.tweens.add({ targets: g2, x: cx + 52, duration: 520, ease: "Cubic.easeOut" });
  scene.tweens.add({ targets: horse, x: cx + 130, duration: 700, ease: "Sine.easeOut" });

  later(scene, 640, () => {
    const step = a > 0 ? "-=8" : "+=8";
    scene.tweens.add({
      targets: [g1, g2],
      y: step,
      duration: 260,
      yoyo: true,
      ease: "Sine.easeInOut",
    });
  });

  later(scene, 720, () => {
    scene.hud.setHint("E revisar  ·  Q sobornar  ·  X huir");
    offerCheckpointChoices(scene, { barrier, g1, g2, horse, veil, cx });
  });
}

function offerCheckpointChoices(scene, cast) {
  const cost = guardBribeCost(scene);
  const canBribe = gold(scene.registry) >= cost;
  const vis = visibleStones(scene.registry);
  const hidden = hasUpgrade(scene.registry, "hideout") && stones(scene.registry) > vis;
  const inspectSub = vis > 0
    ? "ven la carga"
    : hidden ? "fondo falso" : "vas vacío";
  offerChoices(scene, "¡RETÉN!", [
    { key: "E", color: "#9a5b24", title: "DEJAR REVISAR", sub: inspectSub, id: "search" },
    { key: "Q", color: "#426e4a", title: "SOBORNAR", sub: canBribe ? `−${cost} oro` : "falta oro", id: "bribe", dim: !canBribe },
    { key: "X", color: "#5a3a3a", title: "HUIR", sub: `vuelve a ${TOWNS[scene.from].name}`, id: "flee" },
  ], (action) => resolveCheckpoint(scene, action, cast, cost));
}

function resolveCheckpoint(scene, action, cast, cost) {
  if (action === "bribe" && gold(scene.registry) < cost) {
    flashNote(scene, "No te alcanza el oro para el soborno.");
    sfx(scene, "click", { volume: 0.5 });
    later(scene, 280, () => offerCheckpointChoices(scene, cast));
    return;
  }

  let line = "";
  let flee = false;
  if (action === "search") {
    const vis = visibleStones(scene.registry);
    if (!vis) {
      line = stones(scene.registry)
        ? "Revisaron. El fondo falso aguantó."
        : "Revisaron. No llevabas nada a la vista.";
      sfx(scene, "latch", { volume: 0.55 });
    } else {
      const n = loseStones(scene.registry, 1, true);
      line = n ? `Revisaron. −${n} de carga visible.` : "Revisaron. Nada.";
      sfx(scene, "sack", { volume: 0.65 });
    }
  } else if (action === "bribe") {
    pay(scene.registry, cost);
    addHeat(scene.registry, scene.from, -3);
    addHeat(scene.registry, scene.to, -3);
    line = `Soborno. −${cost} oro. Te dejaron pasar.`;
    sfx(scene, "coins", { volume: 0.65 });
  } else {
    addHeat(scene.registry, scene.from, 4);
    addHeat(scene.registry, scene.to, 2);
    line = `Huiste. Volviste a ${TOWNS[scene.from].name}.`;
    sfx(scene, "draw", { volume: 0.45 });
    flee = true;
  }

  note(scene, line);
  if (flee) {
    fadeVeil(scene, cast.veil);
    fleeHome(scene, cast.veil);
    return;
  }
  letPass(scene, cast.veil, () => {
    sfx(scene, "latch", { volume: 0.5 });
    scene.tweens.add({ targets: [cast.g1], x: cast.cx - 110, duration: 380, ease: "Cubic.easeIn" });
    scene.tweens.add({ targets: [cast.g2, cast.horse], x: cast.cx + 160, duration: 400, ease: "Cubic.easeIn" });
    scene.tweens.add({
      targets: cast.barrier,
      x: cast.cx + 130,
      alpha: 0.3,
      duration: 380,
      ease: "Cubic.easeIn",
    });
  });
}

function playAmbush(scene) {
  const cy = scene.player.y;
  const px = scene.player.x;
  const leftHorse = plant(scene, "horse-dark", px - 330, cy - 20, { depth: 4, alpha: 0 });
  const rightHorse = plant(scene, "horse-dark", px + 330, cy + 10, { depth: 4, alpha: 0, flipX: true });
  const b1 = plant(scene, "npc-bandit", px - 310, cy - 8, { depth: 6, alpha: 0 });
  const b2 = plant(scene, "npc-bandit", px + 310, cy + 16, { depth: 6, alpha: 0, flipX: true });
  const b3 = plant(scene, "npc-bandit", px - 280, cy + 40, { depth: 6, alpha: 0 });

  const veil = addVeil(scene, 0x1c0808, 0.38);
  scene.cameras.main.flash(220, 70, 18, 12);
  scene.cameras.main.shake(320, 0.01);
  sfx(scene, "draw", { volume: 0.8 });
  sfx(scene, "horse", { volume: 0.4, rate: 1.15 });
  later(scene, 180, () => sfx(scene, "knife", { volume: 0.75 }));
  later(scene, 340, () => sfx(scene, "chop", { volume: 0.8 }));

  scene.tweens.add({
    targets: [leftHorse, rightHorse, b1, b2, b3],
    alpha: 1,
    duration: 160,
  });
  scene.tweens.add({ targets: [b1], x: scene.player.x - 36, duration: 380, ease: "Back.easeOut" });
  scene.tweens.add({ targets: leftHorse, x: scene.player.x - 88, duration: 380, ease: "Back.easeOut" });
  scene.tweens.add({ targets: [b2], x: scene.player.x + 40, duration: 420, ease: "Back.easeOut" });
  scene.tweens.add({ targets: rightHorse, x: scene.player.x + 96, duration: 420, ease: "Back.easeOut" });
  scene.tweens.add({
    targets: b3,
    x: scene.player.x - 10,
    y: cy + 36,
    duration: 400,
    ease: "Cubic.easeOut",
  });

  later(scene, 520, () => {
    scene.hud.setHint("E entregar  ·  Q pagar  ·  X huir");
    offerAmbushChoices(scene, { leftHorse, rightHorse, b1, b2, b3, veil, px, cy });
  });
}

function offerAmbushChoices(scene, cast) {
  const { loss, cover } = ambushLoss(scene);
  const cost = banditPayCost(scene);
  const canPay = cost > 0 && gold(scene.registry) >= cost;
  let giveSub = "no llevas nada";
  if (loss > 0) giveSub = `−${loss} de carga`;
  else if (cover) giveSub = "caballo y escolta cubren";
  const paySub = cost <= 0 ? "nada que comprar" : canPay ? `−${cost} oro` : "falta oro";
  offerChoices(scene, "¡ASALTO!", [
    { key: "E", color: "#6a3030", title: "ENTREGAR", sub: giveSub, id: "give" },
    { key: "Q", color: "#426e4a", title: "PAGAR", sub: paySub, id: "pay", dim: !canPay },
    { key: "X", color: "#5a3a3a", title: "HUIR", sub: `vuelve a ${TOWNS[scene.from].name}`, id: "flee" },
  ], (action) => resolveAmbush(scene, action, cast, cost));
}

function resolveAmbush(scene, action, cast, cost) {
  if (action === "pay" && (cost <= 0 || gold(scene.registry) < cost)) {
    flashNote(scene, cost <= 0 ? "No llevás carga que quieran comprar." : "No te alcanza el oro.");
    sfx(scene, "click", { volume: 0.5 });
    later(scene, 280, () => offerAmbushChoices(scene, cast));
    return;
  }

  let line = "";
  let flee = false;
  let takeSack = false;
  if (action === "give") {
    const { loss, cover } = ambushLoss(scene);
    if (!stones(scene.registry)) {
      line = "Asalto. No llevabas carga.";
      sfx(scene, "draw", { volume: 0.4 });
    } else if (!loss) {
      line = "Asalto. El caballo y la escolta abrieron paso; carga intacta.";
      sfx(scene, "horse", { volume: 0.45, rate: 1.2 });
    } else {
      const n = loseStones(scene.registry, loss);
      const coverNote = cover ? ` Tus preparativos salvaron ${cover}.` : "";
      line = `Asalto. −${n} de carga.${coverNote}`;
      sfx(scene, "sack", { volume: 0.7 });
      takeSack = Boolean(n);
    }
  } else if (action === "pay") {
    pay(scene.registry, cost);
    line = `Les pagaste el paso. −${cost} oro. Carga intacta.`;
    sfx(scene, "coins", { volume: 0.65 });
  } else {
    addHeat(scene.registry, scene.from, 2);
    addHeat(scene.registry, scene.to, 1);
    line = `Huiste del asalto. Volviste a ${TOWNS[scene.from].name}.`;
    sfx(scene, "draw", { volume: 0.5 });
    flee = true;
  }

  note(scene, line);
  if (flee) {
    fadeVeil(scene, cast.veil);
    fleeHome(scene, cast.veil);
    return;
  }
  letPass(scene, cast.veil, () => scatterBandits(scene, cast, takeSack));
}

function scatterBandits(scene, cast, takeSack) {
  const { px, cy, b1, b2, b3, leftHorse, rightHorse } = cast;
  let sack = null;
  if (takeSack) {
    sack = plant(scene, "sack", scene.player.x, scene.player.y - 10, { depth: 7, scale: 0.9 });
    scene.tweens.add({
      targets: sack,
      x: px - 80,
      y: cy - 28,
      duration: 380,
      ease: "Cubic.easeOut",
    });
  }
  sfx(scene, "horse", { volume: 0.35, rate: 1.25 });
  scene.tweens.add({
    targets: [b1, leftHorse, sack].filter(Boolean),
    x: px - 520,
    duration: 700,
    ease: "Cubic.easeIn",
  });
  scene.tweens.add({
    targets: [b2, rightHorse, b3],
    x: px + 520,
    duration: 740,
    ease: "Cubic.easeIn",
  });
  later(scene, 800, () => {
    [leftHorse, rightHorse, b1, b2, b3, sack].filter(Boolean).forEach((obj) => obj.destroy());
  });
}

function playSeize(scene) {
  const a = scene.goingDown ? 1 : -1;
  const cx = at(scene).x;
  const cy = at(scene).y;
  const startY = cy + a * 220;
  const stopY = cy + a * 36;
  const horse = plant(scene, "horse", cx - 32, startY, { depth: 4, alpha: 0, flipX: !scene.goingDown });
  const cart = plant(scene, "cart", cx + 12, startY + a * 28, { depth: 3, alpha: 0 });
  const cap = plant(scene, "npc-guard", cx - 28, startY - 20, { depth: 5, alpha: 0, scale: 0.88 });
  const g1 = plant(scene, "npc-guard", cx - 100, startY + a * 8, { depth: 6, alpha: 0 });
  const g2 = plant(scene, "npc-guard", cx + 100, startY + a * 8, { depth: 6, alpha: 0, flipX: true });

  const veil = addVeil(scene, 0x101418, 0.36);
  scene.cameras.main.flash(200, 24, 28, 40);
  scene.cameras.main.shake(180, 0.006);

  scene.tweens.add({
    targets: [cart, horse, cap, g1, g2],
    alpha: 1,
    duration: 200,
  });
  sfx(scene, "horn", { volume: 0.5 });
  sfx(scene, "horse", { volume: 0.38 });
  later(scene, 400, () => sfx(scene, "cart", { volume: 0.5 }));
  later(scene, 900, () => sfx(scene, "click", { volume: 0.6 }));
  scene.tweens.add({ targets: horse, y: stopY, duration: 900, ease: "Sine.easeOut" });
  scene.tweens.add({ targets: cap, y: stopY - 20, duration: 900, ease: "Sine.easeOut" });
  scene.tweens.add({ targets: cart, y: stopY + a * 28, duration: 900, ease: "Sine.easeOut" });
  scene.tweens.add({ targets: g1, x: cx - 62, y: stopY + 10, duration: 900, ease: "Sine.easeOut" });
  scene.tweens.add({ targets: g2, x: cx + 62, y: stopY + 10, duration: 900, ease: "Sine.easeOut" });

  later(scene, 920, () => bob(scene, horse, 3, 300));
  later(scene, 1000, () => {
    scene.tweens.add({
      targets: [g1, g2],
      y: scene.player.y + 6,
      duration: 280,
      yoyo: true,
      ease: "Sine.easeInOut",
    });
  });
  later(scene, 1080, () => {
    scene.hud.setHint("E entregar  ·  Q sobornar  ·  X huir");
    offerSeizeChoices(scene, { horse, cart, cap, g1, g2, veil, cx, cy, a, stopY });
  });
}

function offerSeizeChoices(scene, cast) {
  const vis = visibleStones(scene.registry);
  const hidden = hasUpgrade(scene.registry, "hideout") && stones(scene.registry) > vis;
  const cost = seizeBribeCost(scene);
  const canBribe = gold(scene.registry) >= cost;
  const giveSub = vis > 0
    ? `−${vis} visible`
    : hidden ? "fondo falso" : "vas vacío";
  offerChoices(scene, "¡CONFISCAN!", [
    { key: "E", color: "#3a4a62", title: "ENTREGAR", sub: giveSub, id: "give" },
    { key: "Q", color: "#426e4a", title: "SOBORNAR", sub: canBribe ? `−${cost} oro` : "falta oro", id: "bribe", dim: !canBribe },
    { key: "X", color: "#5a3a3a", title: "HUIR", sub: `vuelve a ${TOWNS[scene.from].name}`, id: "flee" },
  ], (action) => resolveSeize(scene, action, cast, cost));
}

function resolveSeize(scene, action, cast, cost) {
  if (action === "bribe" && gold(scene.registry) < cost) {
    flashNote(scene, "No te alcanza el oro para el soborno.");
    sfx(scene, "click", { volume: 0.5 });
    later(scene, 280, () => offerSeizeChoices(scene, cast));
    return;
  }

  let line = "";
  let flee = false;
  let takeSack = false;
  if (action === "give") {
    const vis = visibleStones(scene.registry);
    const load = stones(scene.registry);
    if (!load) {
      line = "Confiscan. No había carga.";
      sfx(scene, "latch", { volume: 0.5 });
    } else if (!vis) {
      line = "Revisaron el carro. El fondo falso salvó la carga.";
      sfx(scene, "latch", { volume: 0.6 });
    } else {
      const n = loseStones(scene.registry, vis, true);
      const saved = load - n;
      line = saved > 0
        ? `Confiscaron ${n}; el fondo falso salvó ${saved}.`
        : `Confiscaron la carga visible. −${n}.`;
      sfx(scene, "sack", { volume: 0.75 });
      takeSack = Boolean(n);
    }
  } else if (action === "bribe") {
    pay(scene.registry, cost);
    addHeat(scene.registry, scene.from, -4);
    addHeat(scene.registry, scene.to, -4);
    line = `Soborno fuerte. −${cost} oro. El carro siguió de largo.`;
    sfx(scene, "coins", { volume: 0.7 });
  } else {
    addHeat(scene.registry, scene.from, 6);
    addHeat(scene.registry, scene.to, 3);
    line = `Huiste de la requisa. Volviste a ${TOWNS[scene.from].name}.`;
    sfx(scene, "draw", { volume: 0.5 });
    flee = true;
  }

  note(scene, line);
  if (flee) {
    fadeVeil(scene, cast.veil);
    fleeHome(scene, cast.veil);
    return;
  }
  letPass(scene, cast.veil, () => seizeDepart(scene, cast, takeSack));
}

function seizeDepart(scene, cast, takeSack) {
  const { cx, cy, a, stopY, horse, cart, cap, g1, g2 } = cast;
  let sack = null;
  if (takeSack) {
    sack = plant(scene, "sack", scene.player.x, scene.player.y - 8, { depth: 7 });
    scene.tweens.add({
      targets: sack,
      x: cx + 12,
      y: stopY + a * 20,
      duration: 360,
      ease: "Cubic.easeIn",
    });
    sfx(scene, "coins", { volume: 0.45 });
  }
  later(scene, takeSack ? 380 : 40, () => {
    sfx(scene, "horse", { volume: 0.32, rate: 1.1 });
    sfx(scene, "cart", { volume: 0.4 });
    scene.tweens.add({
      targets: [cart, horse, cap, g1, g2, sack].filter(Boolean),
      y: cy + a * 420,
      duration: 900,
      ease: "Cubic.easeIn",
    });
  });
  later(scene, takeSack ? 1400 : 1000, () => {
    [cart, horse, cap, g1, g2, sack].filter(Boolean).forEach((obj) => obj.destroy());
  });
}

function showActionPanel(scene, titleText, options) {
  const y = 378;
  const title = scene.add.text(400, 210, titleText, {
    fontFamily: "Georgia, serif",
    fontSize: "28px",
    fontStyle: "bold",
    color: "#fff0b8",
    stroke: "#17110e",
    strokeThickness: 6,
  }).setOrigin(0.5).setScrollFactor(0).setDepth(10042).setAlpha(0);

  const objects = [title];
  const picks = [];
  scene.tweens.add({ targets: title, alpha: 1, y: 198, duration: 180, ease: "Back.easeOut" });

  options.forEach((opt, i) => {
    const x = 168 + i * 232;
    const keyText = scene.add.text(x, y, opt.key, {
      fontFamily: "Georgia, serif",
      fontSize: "22px",
      fontStyle: "bold",
      color: opt.dim ? "#aaa39a" : "#fff4d0",
      backgroundColor: opt.dim ? "#3a3530" : opt.color,
      padding: { x: 12, y: 6 },
      shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 3, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10041).setAlpha(0);
    const label = scene.add.text(x + 28, y, `${opt.title}\n${opt.sub}`, {
      fontFamily: "Georgia, serif",
      fontSize: "13px",
      fontStyle: "bold",
      color: opt.dim ? "#8f887e" : "#f0e6d4",
      backgroundColor: "#17110eee",
      padding: { x: 10, y: 6 },
      lineSpacing: 2,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10040).setAlpha(0);
    scene.tweens.add({
      targets: [keyText, label],
      alpha: 1,
      y: y - 8,
      delay: 40 + i * 50,
      duration: 180,
      ease: "Back.easeOut",
    });
    scene.tweens.add({
      targets: keyText,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    objects.push(keyText, label);
    picks.push({ id: opt.id, keyText, label });
  });

  let handler = null;
  picks.forEach((item) => {
    item.label.setInteractive({ useHandCursor: true });
    item.keyText.setInteractive({ useHandCursor: true });
    const tap = () => handler?.(item.id);
    item.label.on("pointerdown", tap);
    item.keyText.on("pointerdown", tap);
  });

  return {
    onPick(fn) { handler = fn; },
    close() {
      handler = null;
      scene.tweens.killTweensOf(objects);
      objects.forEach((obj) => obj.destroy());
    },
  };
}
