import { TOWNS, capacity, cargoSummary, gold, hasUpgrade, heat, heatLabel, reputation, routeHeat, stones } from "./state.js";
import { addEventPicker } from "./events.js";

const TOP = 4;
const CHIP_H = 36;

/** Hasta dónde bajan los chips. El picker de prueba va debajo. */
export const HUD_H = TOP + CHIP_H + 4;
/** Aire de cámara: el HUD flota arriba, sin franja opaca. */
export const HUD_PAD = 72;

const FONT = "Georgia, serif";
const INK = {
  fontFamily: FONT,
  stroke: "#14100c",
  strokeThickness: 4,
  shadow: { offsetX: 0, offsetY: 1, color: "#000000aa", blur: 3, fill: true },
};

function alertStars(value) {
  if (value <= 0) return 0;
  return Math.min(5, Math.ceil(value / 20));
}

function alertCaption(value) {
  if (value <= 0) return "tranquilo";
  const label = heatLabel(value).toLowerCase();
  if (label === "medio") return "ojo";
  return label;
}

function plate(g, x, y, w, h) {
  g.fillStyle(0x050402, 0.28);
  g.fillRoundedRect(x + 1, y + 3, w, h, 11);
  g.fillStyle(0x1a140f, 0.48);
  g.fillRoundedRect(x, y, w, h, 11);
  g.lineStyle(1.25, 0xe0c27a, 0.7);
  g.strokeRoundedRect(x, y, w, h, 11);
  g.lineStyle(1, 0xfff6d6, 0.2);
  g.beginPath();
  g.moveTo(x + 12, y + 2);
  g.lineTo(x + w - 12, y + 2);
  g.strokePath();
}

function bump(scene, target) {
  scene.tweens.killTweensOf(target);
  target.setScale(1);
  scene.tweens.add({
    targets: target,
    scaleX: 1.12,
    scaleY: 1.12,
    duration: 110,
    yoyo: true,
    ease: "Sine.easeOut",
  });
}

function bindHudCamera(scene, root) {
  const main = scene.cameras.main;
  main.ignore(root);

  let ui = scene.cameras.getCamera("hud");
  if (!ui) {
    ui = scene.cameras.add(0, 0, 800, 450, false, "hud");
    ui.setZoom(1);
    ui.setScroll(0, 0);
  }

  const pin = () => {
    root.cameraFilter = main.id;
    const list = scene.children.list;
    for (let i = 0; i < list.length; i += 1) {
      const obj = list[i];
      if (obj !== root) obj.cameraFilter |= ui.id;
    }
  };
  pin();
  if (!scene._hudCamSync) {
    scene._hudCamSync = true;
    let last = 0;
    scene.events.on("postupdate", () => {
      const n = scene.children.length;
      if (n === last) return;
      last = n;
      pin();
    });
  }
}

export function makeHud(scene, townId) {
  const town = TOWNS[townId];
  const plates = scene.add.graphics().setScrollFactor(0).setDepth(10020);
  const mid = TOP + CHIP_H / 2;

  const title = scene.add.text(16, mid, town ? town.name : "Camino", {
    ...INK,
    fontSize: "15px",
    fontStyle: "bold",
    color: "#f7e4b0",
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10022);

  const hint = scene.add.text(792, mid, "", {
    ...INK,
    fontSize: "12px",
    fontStyle: "bold",
    color: "#f0e4cc",
    align: "right",
    wordWrap: { width: 260 },
  }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(10022);

  const goldIcon = scene.add.circle(0, mid, 8, 0xd4a24a)
    .setStrokeStyle(2, 0xf8e3a8)
    .setScrollFactor(0)
    .setDepth(10023);
  const goldNum = scene.add.text(0, mid, "0", {
    ...INK, fontSize: "17px", fontStyle: "bold", color: "#f8e7b0",
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10023);
  const goldLab = scene.add.text(0, mid, "oro", {
    ...INK, fontSize: "12px", color: "#e8d5a4",
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10023);

  const stoneIcon = scene.add.star(0, mid, 4, 4, 8, 0x8fd4de)
    .setStrokeStyle(1, 0xe7fbff)
    .setScrollFactor(0)
    .setDepth(10023);
  const stoneNum = scene.add.text(0, mid - 7, "0 de 4 piedras", {
    ...INK, fontSize: "14px", fontStyle: "bold", color: "#eef8fa",
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10023);
  const stoneLab = scene.add.text(0, mid + 8, "vacío", {
    ...INK, fontSize: "11px", color: "#c5dce0",
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10023);

  const stars = [];
  for (let i = 0; i < 5; i += 1) {
    stars.push(
      scene.add.star(0, mid - 6, 5, 3.2, 7, 0x1a1410)
        .setStrokeStyle(1, 0x7a6848)
        .setScrollFactor(0)
        .setDepth(10023),
    );
  }
  const alertLab = scene.add.text(0, mid + 9, "alerta", {
    ...INK, fontSize: "11px", color: "#e6d3a6",
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10023);

  const fameNum = scene.add.text(0, mid - 7, "0", {
    ...INK, fontSize: "15px", fontStyle: "bold", color: "#f4ead8",
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10023);
  const fameLab = scene.add.text(0, mid + 8, "fama", {
    ...INK, fontSize: "11px", color: "#e6d3a6",
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10023);

  const gear = scene.add.text(0, mid, "", {
    ...INK, fontSize: "12px", color: "#ead9ae",
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10023);

  const picker = addEventPicker(scene, !town, HUD_H + 4);

  const root = scene.add.container(0, 0).setDepth(10020).setScrollFactor(0);
  root.add([
    plates, title, hint, goldIcon, goldNum, goldLab,
    stoneIcon, stoneNum, stoneLab, ...stars, alertLab,
    fameNum, fameLab, gear, ...picker.labels,
  ]);
  bindHudCamera(scene, root);

  const hud = {
    root, plates, title, hint, picker,
    lastGold: null,
    lastStones: null,
    refresh() {
      const g = gold(scene.registry);
      const load = stones(scene.registry);
      const cap = capacity(scene.registry);
      const heatValue = town
        ? heat(scene.registry, town.id)
        : (scene.from && scene.to ? routeHeat(scene.registry, scene.from, scene.to) : 0);
      const filled = alertStars(heatValue);
      const what = cargoSummary(scene.registry);
      const kit = [
        hasUpgrade(scene.registry, "horse") ? "caballo" : "",
        hasUpgrade(scene.registry, "escort") ? "escolta" : "",
        hasUpgrade(scene.registry, "hideout") ? "fondo falso" : "",
      ].filter(Boolean).join(" · ");

      goldNum.setText(String(g));
      stoneNum.setText(`${load} de ${cap} piedras`);
      stoneLab.setText(what === "vacía" ? "vacío" : what);
      fameNum.setText(String(reputation(scene.registry)));
      alertLab.setText(`alerta ${alertCaption(heatValue)}`);
      gear.setText(kit).setVisible(Boolean(kit));
      stars.forEach((star, i) => {
        const on = i < filled;
        star.setFillStyle(on ? 0xe8c14a : 0x16110d, on ? 1 : 0.55);
        star.setStrokeStyle(1, on ? 0xffe7a0 : 0x8a7350, on ? 1 : 0.7);
      });

      plates.clear();
      let x = 6;

      const titleW = Math.max(88, title.width + 24);
      plate(plates, x, TOP, titleW, CHIP_H);
      title.setPosition(x + 12, mid);
      x += titleW + 6;

      plate(plates, x, TOP, 118, CHIP_H);
      goldIcon.setPosition(x + 16, mid);
      goldNum.setPosition(x + 28, mid);
      goldLab.setPosition(goldNum.x + goldNum.width + 5, mid);
      x += 124;

      plate(plates, x, TOP, 186, CHIP_H);
      stoneIcon.setPosition(x + 16, mid);
      stoneNum.setPosition(x + 30, mid - 7);
      stoneLab.setPosition(x + 30, mid + 8);
      x += 192;

      plate(plates, x, TOP, 150, CHIP_H);
      stars.forEach((star, i) => star.setPosition(x + 16 + i * 17, mid - 6));
      alertLab.setPosition(x + 12, mid + 9);
      x += 156;

      plate(plates, x, TOP, 76, CHIP_H);
      fameNum.setPosition(x + 14, mid - 7);
      fameLab.setPosition(x + 14, mid + 8);
      x += 82;

      if (kit) {
        const gw = Math.max(84, gear.width + 24);
        plate(plates, x, TOP, gw, CHIP_H);
        gear.setPosition(x + 12, mid);
        x += gw + 6;
      }

      if (hint.text) {
        const hw = Math.min(250, hint.width + 20);
        const hx = 800 - 6 - hw;
        if (hx > x) {
          plate(plates, hx, TOP, hw, CHIP_H);
          hint.setPosition(hx + hw - 10, mid).setOrigin(1, 0.5);
        } else {
          hint.setPosition(794, TOP + CHIP_H + 6).setOrigin(1, 0);
        }
      }

      if (hud.lastGold != null && hud.lastGold !== g) bump(scene, goldNum);
      if (hud.lastStones != null && hud.lastStones !== load) bump(scene, stoneNum);
      hud.lastGold = g;
      hud.lastStones = load;
      picker.refresh();
    },
    setHint(text) {
      if (hint.text === (text ?? "")) return;
      hint.setText(text ?? "");
      hud.refresh();
    },
    setMode() {},
  };
  hud.refresh();
  return hud;
}

export function flashNote(scene, text) {
  const plateGfx = scene.add.graphics().setScrollFactor(0).setDepth(10029);
  plateGfx.fillStyle(0x110e0b, 0.72);
  plateGfx.fillRoundedRect(190, 392, 420, 40, 10);
  plateGfx.lineStyle(1, 0xc29445, 0.55);
  plateGfx.strokeRoundedRect(190, 392, 420, 40, 10);
  const note = scene.add
    .text(400, 402, text, {
      ...INK,
      fontSize: "14px",
      color: "#f0e6d4",
      align: "center",
      wordWrap: { width: 396 },
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setDepth(10030);
  if (scene.hud?.root) {
    scene.hud.root.add([plateGfx, note]);
  }
  scene.tweens.add({
    targets: [note, plateGfx],
    alpha: 0,
    delay: 2200,
    duration: 500,
    onComplete: () => {
      note.destroy();
      plateGfx.destroy();
    },
  });
}
