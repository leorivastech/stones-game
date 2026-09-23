import Phaser from "phaser";
import {
  TOWNS, UPGRADES, arrivalLine, buy, canBuy, canSell, capacity, goalLine,
  gold, hasUpgrade, marketQuote, purchaseUpgrade, reputation, sell, stones,
} from "../state.js";
import { HUD_PAD, flashNote, makeHud } from "../hud.js";
import { startMusic } from "../music.js";
import { addWalker, steerWalker } from "../player.js";
import { sfx } from "../sfx.js";
import {
  addAmbientVeil, addChimneySmoke, addCloudShadows, addFootDust, addTownAtmosphere, addVignette,
  addWarmGlow, addWellShimmer,
} from "../gfx/atmosphere.js";
import { PLAZA, paintTownGround, shoreEdgeAt } from "../gfx/townground.js";

const WORLD_W = 1000;
const WORLD_H = 700;
/** La barra del HUD tapa la franja de arriba: la cámara empieza más arriba del mundo. */
const TOP_PAD = HUD_PAD;
const CX = 500;
const CY = 350;
const SPEED = 220;
const HOUSES = ["house-a", "house-b", "house-c"];

export class TownScene extends Phaser.Scene {
  constructor() {
    super("town");
  }

  init(data) {
    this.town = TOWNS[data.id] ?? TOWNS.ashfen;
    this.spawnAt = data.spawn ?? "plaza";
    this.leaving = false;
    this.atStall = false;
    this.atService = false;
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.gulf = Boolean(this.town.blocked?.south?.includes("GOLFO"));
    this.drawGround();
    addTownAtmosphere(this, this.town.id, WORLD_W, WORLD_H);
    this.walls = this.physics.add.staticGroup();
    if (this.gulf) this.blockWater();
    this.placeLandmarks();
    this.placeHouses();
    this.placePlaza();
    this.placeTrees();
    this.placeFolk();
    addAmbientVeil(this, this.town.biome, WORLD_W, WORLD_H);
    addCloudShadows(this, WORLD_W, WORLD_H, 3, this.town.biome === "tropical" ? 0.1 : 0.07);
    addVignette(this, WORLD_W, WORLD_H, this.vignetteColor(), 110, 0.36, TOP_PAD);

    const start = this.spawnPoint();
    this.player = addWalker(this, start.x, start.y);
    this.footDust = addFootDust(this, this.player);
    this.physics.add.collider(this.player, this.walls);

    this.hud = makeHud(this, this.town.id);
    this.hud.setHint(goalLine(this.registry, this.town.id));
    this.createMarketPrompts();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D,E,Q");

    const cam = this.cameras.main;
    cam.setBounds(0, -TOP_PAD, WORLD_W, WORLD_H + TOP_PAD);
    cam.setZoom(0.85);
    cam.startFollow(this.player, false, 0.09, 0.09);
    cam.setDeadzone(140, 90);
    cam.fadeIn(240);
    cam.setBackgroundColor(this.town.biome === "snow" ? "#9aadb3" : this.town.biome === "desert" ? "#8a673d" : this.town.biome === "tropical" ? "#1d3a28" : this.town.biome === "mountain" ? "#3a4440" : "#2e3c32");
    startMusic(this, this.town.music);
    if (this.spawnAt === "plaza") {
      flashNote(this, arrivalLine(this.registry, this.town.id));
    } else {
      flashNote(this, arrivalLine(this.registry, this.town.id));
    }

    this.physics.add.overlap(this.player, this.stallZone, () => {
      this.atStall = true;
    });
    if (this.serviceZone) {
      this.physics.add.overlap(this.player, this.serviceZone, () => {
        this.atService = true;
      });
    }
    for (const exit of this.exitZones) {
      this.physics.add.overlap(this.player, exit.zone, () => this.leave(exit.direction));
    }
  }

  update() {
    this.movePlayer();
    const moving = this.player.body.velocity.lengthSq() > 1;
    this.footDust.emitting = moving;
    this.footDust.setDepth(this.player.depth - 1);
    this.steerFolk();
    if (this.atService) {
      this.setMarketPromptsVisible(false);
      this.hud.setHint(this.serviceHint());
      if (Phaser.Input.Keyboard.JustDown(this.wasd.E)) this.tryService();
    } else if (this.atStall) {
      const quote = marketQuote(this.registry, this.town.id);
      const buyAvailable = canBuy(this.registry, this.town.id);
      const sellAvailable = canSell(this.registry, this.town.id);
      const buyLine = buyAvailable
        ? `E compra ${quote.produce.short} ${quote.buyPrice}`
        : stones(this.registry) >= capacity(this.registry) ? "carga llena" : quote.stock <= 0 ? "sin stock" : "falta oro";
      const sellLine = sellAvailable
        ? `Q vende ${quote.need.short} ${quote.sellPrice}`
        : quote.demand <= 0 ? "pedido agotado" : `pide ${quote.need.short}`;
      this.hud.setHint(`${buyLine}  ·  ${sellLine}`);
      this.updateMarketPrompts(quote, buyAvailable, sellAvailable);
      this.setMarketPromptsVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.wasd.E)) this.tryBuy();
      if (Phaser.Input.Keyboard.JustDown(this.wasd.Q)) this.trySell();
    } else {
      this.setMarketPromptsVisible(false);
      this.hud.setHint(goalLine(this.registry, this.town.id));
    }
    this.atStall = false;
    this.atService = false;
  }

  movePlayer() {
    let x = 0;
    let y = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) y += 1;
    steerWalker(this.player, x, y, SPEED);
  }

  createMarketPrompts() {
    this.marketPromptsVisible = false;
    this.marketPrompts = {
      buy: this.createMarketPrompt(245, "E", "#9a5b24"),
      sell: this.createMarketPrompt(555, "Q", "#426e4a"),
    };
  }

  createMarketPrompt(x, key, activeColor) {
    const y = 390;
    const keyText = this.add.text(x - 88, y, key, {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#fff4d0",
      backgroundColor: activeColor,
      padding: { x: 13, y: 7 },
      shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 3, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10041).setVisible(false);
    const label = this.add.text(x - 55, y, "", {
      fontFamily: "Georgia, serif",
      fontSize: "14px",
      fontStyle: "bold",
      color: "#f0e6d4",
      backgroundColor: "#17110eee",
      padding: { x: 12, y: 6 },
      lineSpacing: 2,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10040).setVisible(false);

    this.tweens.add({
      targets: keyText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    return {
      keyText,
      label,
      objects: [keyText, label],
      activeColor,
      content: "",
      available: null,
      baseY: y,
    };
  }

  updateMarketPrompts(quote, buyAvailable, sellAvailable) {
    const buyReason = stones(this.registry) >= capacity(this.registry)
      ? "CARGA LLENA"
      : quote.stock <= 0 ? "SIN STOCK" : "FALTA ORO";
    const sellReason = quote.demand <= 0 ? "PEDIDO AGOTADO" : `PIDE ${quote.need.short}`;
    this.updateMarketPrompt(
      this.marketPrompts.buy,
      buyAvailable ? `COMPRAR ${quote.produce.short}\n−${quote.buyPrice} ORO` : `COMPRAR\n${buyReason}`,
      buyAvailable,
    );
    this.updateMarketPrompt(
      this.marketPrompts.sell,
      sellAvailable ? `VENDER ${quote.need.short}\n+${quote.sellPrice} ORO` : `VENDER\n${sellReason}`,
      sellAvailable,
    );
  }

  updateMarketPrompt(prompt, content, available) {
    if (prompt.content === content && prompt.available === available) return;
    prompt.content = content;
    prompt.available = available;
    prompt.label.setText(content).setColor(available ? "#f0e6d4" : "#8f887e");
    prompt.keyText
      .setColor(available ? "#fff4d0" : "#aaa39a")
      .setBackgroundColor(available ? prompt.activeColor : "#3a3530");
  }

  setMarketPromptsVisible(visible) {
    if (this.marketPromptsVisible === visible) return;
    this.marketPromptsVisible = visible;
    const objects = Object.values(this.marketPrompts).flatMap((prompt) => prompt.objects);
    if (visible) {
      objects.forEach((object) => object.setVisible(true).setAlpha(0).setY(408));
      this.tweens.add({
        targets: objects,
        alpha: 1,
        y: 390,
        duration: 220,
        ease: "Back.easeOut",
      });
      return;
    }
    this.tweens.add({
      targets: objects,
      alpha: 0,
      y: 400,
      duration: 130,
      ease: "Sine.easeIn",
      onComplete: () => objects.forEach((object) => object.setVisible(false).setY(390)),
    });
  }

  playTradeAnimation(kind, result) {
    const buying = kind === "buy";
    const prompt = buying ? this.marketPrompts.buy : this.marketPrompts.sell;
    const tint = parseInt(result.good.color.slice(1), 16);
    const token = this.add.image(
      buying ? CX : this.player.x,
      buying ? CY - 10 : this.player.y - 12,
      "ember",
    ).setTint(tint).setScale(0.55).setDepth(10010);
    this.tweens.add({
      targets: token,
      x: buying ? this.player.x : CX,
      y: buying ? this.player.y - 12 : CY - 10,
      scaleX: 1.1,
      scaleY: 1.1,
      angle: buying ? 240 : -240,
      duration: 430,
      ease: "Cubic.easeOut",
      onComplete: () => token.destroy(),
    });

    this.tweens.add({
      targets: prompt.label,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 110,
      yoyo: true,
      ease: "Back.easeOut",
    });

    const message = buying
      ? `+1 ${result.good.short}   −${result.price} ORO`
      : `VENDIDO ${result.good.short}   +${result.price} ORO`;
    const feedback = this.add.text(400, 326, message, {
      fontFamily: "Georgia, serif",
      fontSize: "22px",
      fontStyle: "bold",
      color: buying ? "#ffd28a" : "#b9e3b5",
      stroke: "#17110e",
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: "#000000", blur: 4, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10050).setAlpha(0).setScale(0.65);
    this.tweens.chain({
      targets: feedback,
      tweens: [
        { alpha: 1, y: 300, scaleX: 1.08, scaleY: 1.08, duration: 220, ease: "Back.easeOut" },
        { alpha: 0, y: 270, delay: 480, duration: 320, ease: "Cubic.easeIn" },
      ],
      onComplete: () => feedback.destroy(),
    });
  }

  playDeniedAnimation(prompt) {
    this.tweens.add({
      targets: prompt.objects,
      angle: 2.5,
      duration: 55,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
      onComplete: () => prompt.objects.forEach((object) => object.setAngle(0)),
    });
  }

  tryBuy() {
    const result = buy(this.registry, this.town.id);
    if (result) {
      this.hud.refresh();
      sfx(this, "sack", { volume: 0.3 });
      this.playTradeAnimation("buy", result);
      flashNote(this, `${result.good.short} +1  (−${result.price} oro). ${goalLine(this.registry, this.town.id)}`);
    } else if (!canBuy(this.registry, this.town.id)) {
      this.playDeniedAnimation(this.marketPrompts.buy);
      flashNote(this, "No hay espacio, stock o dinero suficiente.");
    }
  }

  trySell() {
    const result = sell(this.registry, this.town.id);
    if (result) {
      this.hud.refresh();
      sfx(this, "coins", { volume: 0.45 });
      this.playTradeAnimation("sell", result);
      flashNote(this, `Vendiste ${result.good.short} +${result.price}. ${goalLine(this.registry, this.town.id)}`);
    } else if (!canSell(this.registry, this.town.id)) {
      this.playDeniedAnimation(this.marketPrompts.sell);
      flashNote(this, `No tenés lo que piden o el pedido ya se agotó.`);
    }
  }

  tryService() {
    if (!this.town.service) return;
    const result = purchaseUpgrade(this.registry, this.town.service);
    this.hud.refresh();
    flashNote(this, result.reason);
    if (result.ok) this.time.delayedCall(900, () => this.scene.restart({ id: this.town.id, spawn: "plaza" }));
  }

  serviceHint() {
    const item = UPGRADES[this.town.service];
    if (!item) return "";
    if (hasUpgrade(this.registry, item.id)) return `${item.name} · equipado · ${item.effect}`;
    if (reputation(this.registry) < item.reputation) {
      return item.id === "hideout"
        ? `Herrero · no trabaja con desconocidos · reputación ${reputation(this.registry)}/${item.reputation}`
        : `${item.name} · requiere reputación ${item.reputation}`;
    }
    return `E contrata ${item.name} · ${item.cost} oro · tenés ${gold(this.registry)}`;
  }

  leave(direction) {
    if (this.leaving) return;
    const to = this.town.exits[direction];
    if (!to) return;
    this.leaving = true;
    this.cameras.main.fadeOut(220);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("road", { from: this.town.id, to, direction });
    });
  }

  spawnPoint() {
    if (this.spawnAt === "south") return { x: CX, y: WORLD_H - 95 };
    if (this.spawnAt === "north") return { x: CX, y: 110 };
    if (this.spawnAt === "west") return { x: 120, y: CY };
    if (this.spawnAt === "east") return { x: WORLD_W - 120, y: CY };
    return { x: CX, y: CY + 80 };
  }

  drawGround() {
    paintTownGround(this, this.town, WORLD_W, WORLD_H, CX, CY, TOP_PAD);
  }

  /** El agua no se pisa: muro invisible que sigue la orilla, tramo a tramo. */
  blockWater() {
    const step = 40;
    for (let x = 0; x < WORLD_W; x += step) {
      const top = Math.min(shoreEdgeAt(WORLD_H, x), shoreEdgeAt(WORLD_H, x + step)) - 6;
      const block = this.add.rectangle(x + step / 2, (top + WORLD_H) / 2, step, WORLD_H - top, 0x000000, 0);
      this.physics.add.existing(block, true);
      this.walls.add(block);
    }
  }

  placePlaza() {
    const quote = marketQuote(this.registry, this.town.id);
    const goodsTint = parseInt(quote.produce.color.slice(1), 16);
    addWarmGlow(this, CX, CY - 8, 72);
    const stall = this.add.image(CX, CY - 30, "stall").setDepth(CY - 30);
    this.tweens.add({
      targets: stall,
      y: CY - 34,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.add.image(CX - 28, CY, "ember").setDepth(CY + 1).setScale(0.9).setTint(goodsTint);
    this.add.image(CX + 30, CY - 2, "ember").setDepth(CY + 1).setScale(0.75).setTint(goodsTint);

    // Puestos laterales y faroles: la plaza es un mercado, no un disco vacío.
    this.add.image(CX - 118, CY - 34, "stall-side").setOrigin(0.5, 0.9).setDepth(CY - 34).setScale(0.92);
    this.add.image(CX + 108, CY - 46, "stall-side").setOrigin(0.5, 0.9).setDepth(CY - 46).setScale(0.86).setFlipX(true);
    this.add.image(CX - 150, CY + 4, "barrel").setOrigin(0.5, 0.88).setDepth(CY + 4).setScale(0.85);
    this.add.image(CX + 132, CY - 12, "crate").setOrigin(0.5, 0.88).setDepth(CY - 12).setScale(0.8);
    [[CX - 126, CY - 90], [CX + 126, CY - 90], [CX - 140, CY + 72], [CX + 138, CY + 72]].forEach(([x, y]) => {
      this.add.image(x, y, "lantern").setOrigin(0.5, 0.94).setDepth(y);
      addWarmGlow(this, x + 5, y - 32, 30);
    });
    this.add.image(CX - 60, CY - 104, "banner").setOrigin(0.5, 0.9).setDepth(CY - 104).setScale(1.2);
    this.add.image(CX + 62, CY - 104, "banner").setOrigin(0.5, 0.9).setDepth(CY - 104).setScale(1.2).setFlipX(true);
    this.add
      .text(CX, CY - 92, `MERCADO  ·  ${quote.produce.short}`, {
        fontFamily: "Georgia, serif",
        fontSize: "18px",
        color: "#f0e6d4",
        backgroundColor: "#1a1410cc",
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(9000);
    this.add.image(CX - 82, CY + 40, "well").setDepth(CY + 40);
    addWellShimmer(this, CX - 82, CY + 40);

    this.placeService();

    this.stallZone = this.add.rectangle(CX, CY + 20, 150, 100, 0x000000, 0);
    this.physics.add.existing(this.stallZone, true);

    this.exitZones = [];
    const dirLabel = { north: "NORTE", south: "SUR", west: "OESTE", east: "ESTE" };
    const layout = {
      north: { x: CX, y: 48, labelX: CX, labelY: 94, zoneX: CX, zoneY: 22, zoneW: 190, zoneH: 44, angle: 0 },
      south: this.gulf
        ? { x: CX, y: WORLD_H - 196, labelX: CX, labelY: WORLD_H - 140, zoneX: CX, zoneY: WORLD_H - 170, zoneW: 190, zoneH: 44, angle: 0 }
        : { x: CX, y: WORLD_H - 48, labelX: CX, labelY: WORLD_H - 100, zoneX: CX, zoneY: WORLD_H - 22, zoneW: 190, zoneH: 44, angle: 0 },
      west: { x: 50, y: CY, labelX: 114, labelY: CY - 54, zoneX: 22, zoneY: CY, zoneW: 44, zoneH: 190, angle: 90 },
      east: { x: WORLD_W - 50, y: CY, labelX: WORLD_W - 114, labelY: CY - 54, zoneX: WORLD_W - 22, zoneY: CY, zoneW: 44, zoneH: 190, angle: 90 },
    };
    for (const direction of ["north", "south", "west", "east"]) {
      const destinationId = this.town.exits[direction];
      const blocked = this.town.blocked?.[direction];
      if (!destinationId && !blocked) continue;
      const spot = layout[direction];
      const destination = destinationId ? TOWNS[destinationId] : null;
      const gate = this.add.image(spot.x, spot.y, "gate").setDepth(spot.y).setAngle(spot.angle);
      if (!destination) gate.setTint(0x6c6a66);
      const routeText = destination
        ? `${dirLabel[direction]} · ${destination.name.toUpperCase()}`
        : blocked;
      this.add.text(spot.labelX, spot.labelY, routeText, {
        fontFamily: "Georgia, serif", fontSize: "13px", color: destination ? "#ead8b7" : "#9c9690",
        backgroundColor: "#17110dcc", padding: { x: 8, y: 3 },
      }).setOrigin(0.5).setDepth(9000);
      if (!destination) continue;
      const zone = this.add.rectangle(spot.zoneX, spot.zoneY, spot.zoneW, spot.zoneH, 0x000000, 0);
      this.physics.add.existing(zone, true);
      this.exitZones.push({ direction, zone });
    }
  }

  placeService() {
    this.serviceZone = null;
    const id = this.town.service;
    if (!id) return;
    const item = UPGRADES[id];
    const x = CX + 180;
    const y = CY + 32;
    addWarmGlow(this, x, y, 64);
    if (id === "hideout") {
      this.add.image(x, y + 6, "forge").setDepth(y + 6);
      this.add.image(x - 38, y - 4, "npc-smith").setDepth(y);
    } else if (id === "horse") {
      this.add.image(x + 18, y + 10, "horse").setDepth(y + 12).setScale(0.9);
      this.add.image(x - 38, y - 4, "npc-guard").setDepth(y).setTint(0x9c7652);
    } else {
      this.add.image(x + 26, y + 6, "banner").setDepth(y + 8).setScale(1.35);
      this.add.image(x - 24, y - 2, "npc-bandit").setDepth(y + 2).setTint(0xa98b68);
    }
    const owned = hasUpgrade(this.registry, id);
    const unlocked = reputation(this.registry) >= item.reputation;
    const status = owned ? "equipado" : unlocked ? `${item.cost} oro` : id === "hideout" ? "sin encargos" : `rep. ${item.reputation}`;
    const serviceName = id === "hideout" && !unlocked && !owned ? "HERRERO" : item.name.toUpperCase();
    this.add.text(x, CY - 26, `${serviceName} · ${status}`, {
      fontFamily: "Georgia, serif", fontSize: "14px", color: owned ? "#b9e3b5" : "#f0e6d4",
      backgroundColor: "#1a1410cc", padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setDepth(9000);
    this.serviceZone = this.add.rectangle(x, y + 13, 175, 100, 0x000000, 0);
    this.physics.add.existing(this.serviceZone, true);
  }

  placeFolk() {
    this.folk = [];
    const spots = [
      [CX - 120, CY + 140, 0xb08a68],
      [CX + 140, CY + 140, 0x6a7a8a],
      [CX - 130, CY - 10, 0x8a6a58],
    ];
    spots.forEach((spot, i) => {
      const w = addWalker(this, spot[0], spot[1]);
      w.setTint(spot[2]);
      w.body.setImmovable(true);
      this.physics.add.collider(w, this.walls);
      w.setData("dir", i % 2 === 0 ? 1 : -1);
      this.folk.push(w);
    });
    this.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => {
        this.folk.forEach((w) => {
          const turn = Math.random();
          if (turn > 0.66) w.setData("dir", 1);
          else if (turn > 0.33) w.setData("dir", -1);
          else w.setData("dir", 0);
          w.setData("vert", Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0);
        });
      },
    });
  }

  steerFolk() {
    if (!this.folk) return;
    this.folk.forEach((w) => {
      const dx = w.getData("dir") || 0;
      const dy = w.getData("vert") || 0;
      steerWalker(w, dx, dy, 58);
      w.x = Phaser.Math.Clamp(w.x, CX - PLAZA.rx - 10, CX + PLAZA.rx + 10);
      w.y = Phaser.Math.Clamp(w.y, CY - 40, CY + PLAZA.ry + 30);
    });
  }

  placeHouses() {
    // Con golfo, la fila del sur sube: la costa se come los últimos 150 px.
    const southRow = this.gulf ? [[150, 455], [330, 478], [672, 478], [856, 455]] : [[150, 566], [330, 602], [672, 602], [856, 566]];
    const spots = [
      [150, 130],
      [330, 96],
      [672, 96],
      [856, 130],
      ...southRow,
    ];
    spots.forEach((spot, i) => {
      const house = this.walls.create(spot[0], spot[1], HOUSES[i % HOUSES.length]);
      const scale = 0.8 + (i % 3) * 0.05;
      house.setDepth(spot[1]);
      house.setScale(scale);
      house.setTint(this.town.houseTint);
      house.refreshBody();
      // Choque = muro y puerta, no el tejado ni la sombra. Así se pasa detrás y se toca el frente.
      const dw = house.displayWidth;
      const dh = house.displayHeight;
      house.body.setSize(dw * 0.64, dh * 0.24, false);
      house.body.setOffset(dw * 0.18, dh * 0.64);
      const overlay = { snow: "roof-snow", tropical: "roof-vines" }[this.town.biome];
      if (overlay && (overlay !== "roof-vines" || i % 2 === 0)) {
        this.add.image(spot[0], spot[1], overlay).setScale(scale).setDepth(spot[1] + 0.5).setFlipX(i % 3 === 1);
      }
      if (i % 3 === 0) addChimneySmoke(this, spot[0] + 42 * scale, spot[1] - 62 * scale);
    });
  }

  vignetteColor() {
    return {
      snow: 0x5e7a82, desert: 0x5f3d22, tropical: 0x0d2a1c, mountain: 0x232a26,
    }[this.town.biome] ?? 0x14211a;
  }

  /** Lo que hace único a cada pueblo: riscos en Valkeep, palmeras en Duneshade… */
  placeLandmarks() {
    const biome = this.town.biome;
    const put = (key, x, y, scale = 1, flip = false, tint = null) => {
      const img = this.add.image(x, y, key).setOrigin(0.5, 0.88).setDepth(y).setScale(scale).setFlipX(flip);
      if (tint) img.setTint(tint);
      return img;
    };
    if (biome === "mountain") {
      // Cordón de riscos detrás de la fila norte, y peñas por los costados.
      for (let x = 70, k = 0; x < WORLD_W; x += 125, k += 1) {
        if (Math.abs(x - CX) < 130) continue;
        put("cliff", x, 44 + (k % 2) * 6, 0.9 + (k % 3) * 0.08, k % 2 === 1);
      }
      [[34, 210, 0.8], [WORLD_W - 34, 226, 0.85], [30, 560, 0.75], [WORLD_W - 30, 540, 0.8]].forEach(([x, y, s], k) => {
        put("cliff", x, y, s, k % 2 === 0);
      });
      [[240, 480, 1], [780, 250, 0.9], [240, 240, 0.8], [760, 500, 1.05]].forEach(([x, y, s]) => put("boulder", x, y, s));
    } else if (biome === "desert") {
      [[236, 592, 1.05, false], [276, 606, 0.85, true], [770, 176, 1, false], [732, 190, 0.8, true]].forEach(([x, y, s, f]) => {
        put("tree-palm", x, y, s, f, this.town.treeTint);
      });
      [[212, 612, 1], [300, 618, 0.8], [792, 200, 0.9]].forEach(([x, y, s]) => put("reed", x, y, s, false, 0xd0c080));
      [[560, 600, 1], [140, 250, 0.85], [860, 470, 0.9]].forEach(([x, y, s]) => put("cactus", x, y, s));
    } else if (biome === "tropical") {
      [[236, 240, 1], [772, 480, 0.9], [230, 500, 0.85], [780, 244, 1.05]].forEach(([x, y, s], k) => put("tree-palm", x, y, s, k % 2 === 1, this.town.treeTint));
      [[300, 250, 1], [700, 470, 0.9], [740, 230, 0.8]].forEach(([x, y, s]) => put("bigleaf", x, y, s));
    } else if (biome === "snow") {
      [[236, 254, 1], [770, 250, 0.9], [240, 470, 0.9]].forEach(([x, y, s]) => put("tree-bare", x, y, s));
      [[790, 476, 0.9], [560, 610, 0.85]].forEach(([x, y, s]) => put("boulder", x, y, s, false, 0xd0dde0));
    } else {
      put("fence", 720, 236, 1);
      put("fence", 790, 236, 1);
      put("hay", 758, 226, 0.7);
      put("tree", 250, 480, 1.1, false, this.town.treeTint);
    }
  }

  placeTrees() {
    const southLimit = this.gulf ? WORLD_H - 190 : WORLD_H;
    const dense = this.town.biome === "tropical";
    const step = dense ? 70 : 96;
    for (let x = 40; x < WORLD_W; x += step) {
      if (Math.abs(x - CX) < 110) continue;
      this.placeEdgeProp(x, 32, x);
      if (dense) this.placeEdgeProp(x + 34, 74, x + 3);
      if (!this.gulf) this.placeEdgeProp(x + 14, WORLD_H - 26, x + 5);
      if (!this.gulf && dense) this.placeEdgeProp(x + 48, WORLD_H - 62, x + 9);
    }
    for (let y = 84; y < southLimit - 30; y += dense ? 76 : 100) {
      if (Math.abs(y - CY) < 110) continue;
      this.placeEdgeProp(40, y, y);
      this.placeEdgeProp(WORLD_W - 40, y + 26, y + 7);
      if (dense) {
        this.placeEdgeProp(84, y + 36, y + 11);
        this.placeEdgeProp(WORLD_W - 86, y - 10, y + 13);
      }
    }
  }

  placeEdgeProp(x, y, seed) {
    const biome = this.town.biome;
    const pick = {
      desert: ["cactus", "rock", "cactus", "hay", "tree-palm", "rock", "bones"],
      mountain: ["tree-pine", "boulder", "tree-pine", "rock", "tree-pine", "ore-pile", "boulder"],
      snow: ["tree-pine-snow", "tree-pine-snow", "tree-bare", "rock", "tree-pine-snow", "tree-bare", "boulder"],
      tropical: ["tree-palm", "tree", "tree", "tree-palm", "bigleaf", "tree", "fern"],
      temperate: ["tree", "tree", "tree-pine", "tree", "bush", "tree", "flowers"],
    }[biome] ?? ["tree"];
    const key = pick[seed % pick.length];
    const leafy = ["tree", "tree-pine", "tree-palm", "bush"].includes(key);
    const prop = this.add.image(x, y, key)
      .setOrigin(0.5, 0.88)
      .setDepth(y)
      .setScale(0.86 + (seed % 5) * 0.06)
      .setFlipX(seed % 2 === 1);
    if (leafy) prop.setTint(this.town.treeTint);
    if (biome === "snow" && key === "boulder") prop.setTint(0xd0dde0);
    if (seed % 3 !== 0) return;
    const under = {
      desert: "rock", mountain: "rock", tropical: "fern", snow: "rock", temperate: "bush",
    }[biome] ?? "bush";
    const uy = y + 18;
    const small = this.add.image(x + 22, uy, under).setOrigin(0.5, 0.88).setDepth(uy).setScale(0.68);
    if (under === "fern") small.setTint(0x9ad080);
    else if (under === "bush") small.setTint(this.town.treeTint);
    else if (biome === "snow") small.setTint(0xd0dde0);
  }

}
