import Phaser from "phaser";
import { TOWNS, advanceMarket, goalLine, hasUpgrade } from "../state.js";
import { HUD_PAD, makeHud } from "../hud.js";
import { startMusic } from "../music.js";
import { addWalker, steerWalker } from "../player.js";
import { pickRoadEvent } from "../events.js";
import { playRoadEvent } from "../encounters.js";
import { addAmbientVeil, addCloudShadows, addFootDust } from "../gfx/atmosphere.js";
import {
  addRouteEdges, addRouteFrame, addRouteMotes, blendDestinationGround,
  paintRouteDetail, paintRouteGround, paintRouteRibbon, scatterField, smoothTangent,
} from "../gfx/route.js";
import { PATH_HALF, ROUTE_WORLD, clampToPath, getRoute, makeTravelPath } from "../routes.js";

const SPEED = 250;
/** La barra del HUD tapa la franja de arriba: la cámara empieza más arriba del mundo. */
const TOP_PAD = HUD_PAD;

export class RoadScene extends Phaser.Scene {
  constructor() {
    super("road");
  }

  init(data) {
    this.from = data.from ?? "ashfen";
    this.to = data.to ?? "valkeep";
    this.direction = data.direction ?? "south";
    this.spec = getRoute(this.from, this.to);
    this.biome = this.spec.biome;
    this.worldW = ROUTE_WORLD.w;
    this.worldH = ROUTE_WORLD.h;
    this.fired = false;
    this.done = false;
    this.busy = false;
    this.leftStart = false;
  }

  create() {
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

    this.travelPath = makeTravelPath(this, this.spec.points);
    this.pathPoints = this.travelPath.getSpacedPoints(80);
    this.startAt = this.pathPoints[0];
    this.endAt = this.pathPoints[this.pathPoints.length - 1];
    const mid = Math.floor(this.pathPoints.length * 0.52);
    this.eventAt = this.pathPoints[mid];
    this.eventTangent = smoothTangent(this.pathPoints, mid);
    this.goingDown = this.endAt.y >= this.startAt.y;

    // El piso del pueblo de origen entra por la cabeza y el del destino por la cola.
    const ends = { head: this.otherGround(this.from), tail: this.otherGround(this.to) };
    paintRouteGround(this, this.worldW, this.worldH, this.spec.ground, this.biome, TOP_PAD);
    blendDestinationGround(this, this.worldW, this.worldH, ends.head, this.pathPoints, this.biome, true);
    blendDestinationGround(this, this.worldW, this.worldH, ends.tail, this.pathPoints, this.biome);
    paintRouteRibbon(this, this.pathPoints, this.biome, this.spec.pave, this.worldW, this.worldH, ends);
    paintRouteDetail(this, this.pathPoints, this.biome, this.worldW, this.worldH, ends);
    addRouteEdges(this, this.pathPoints, this.biome, this.worldW, this.worldH, ends);
    scatterField(this, this.pathPoints, this.biome, this.worldW, this.worldH, 80, ends);
    addRouteFrame(this, this.worldW, this.worldH, this.biome, TOP_PAD);
    addAmbientVeil(this, this.biome, this.worldW, this.worldH);
    addCloudShadows(this, this.worldW, this.worldH, 3, 0.07);
    this.placeRouteSigns(mid);
    this.placeReturnSign();
    this.add.image(this.eventAt.x, this.eventAt.y - 8, "post").setDepth(this.eventAt.y);
    addRouteMotes(this, this.worldW, this.worldH, this.biome);

    this.player = addWalker(this, this.startAt.x, this.startAt.y);
    this.footDust = addFootDust(this, this.player);
    this.travelHorse = null;
    this.horseDust = null;
    this.horseSide = 1;
    if (hasUpgrade(this.registry, "horse")) this.addTravelHorse();

    this.hud = makeHud(this, null);
    this.hud.title.setText(`${TOWNS[this.from].name} → ${TOWNS[this.to].name}`);
    this.hud.setHint(goalLine(this.registry, null));
    this.route = "road";
    startMusic(this, "road");

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
    this.speed = SPEED + (hasUpgrade(this.registry, "horse") ? 35 : 0);

    const cam = this.cameras.main;
    cam.setBounds(0, -TOP_PAD, this.worldW, this.worldH + TOP_PAD);
    cam.setZoom(0.85);
    cam.startFollow(this.player, false, 0.1, 0.1);
    cam.setDeadzone(130, 86);
    cam.fadeIn(220);
    cam.setBackgroundColor(this.camColor());

    this.eventZone = this.add.rectangle(this.eventAt.x, this.eventAt.y, 130, 100, 0x000000, 0);
    this.physics.add.existing(this.eventZone, true);
    this.physics.add.overlap(this.player, this.eventZone, () => this.rollEvent());
  }

  camColor() {
    if (this.biome === "snow") return "#9aadb3";
    if (this.biome === "desert") return "#8a673d";
    if (this.biome === "tropical") return "#1d3a28";
    if (this.biome === "mountain") return "#3a4440";
    return "#2e3c32";
  }

  /** Piso del pueblo dado, solo si difiere del piso de la ruta. */
  otherGround(townId) {
    const other = TOWNS[townId]?.ground;
    return other && other !== this.spec.ground ? other : null;
  }

  placeRouteSigns(mid) {
    const onPath = this.pathPoints[Math.max(6, mid - 12)];
    const tan = smoothTangent(this.pathPoints, Math.max(6, mid - 12));
    const post = { x: onPath.x + tan.nx * (PATH_HALF + 26), y: onPath.y + tan.ny * (PATH_HALF + 26) };
    this.add.image(post.x, post.y, "post").setOrigin(0.5, 0.92).setDepth(post.y);
    this.add.text(post.x, post.y - 52, "CALZADA · guardias", {
      fontFamily: "Georgia, serif", fontSize: "13px", color: "#ead5aa",
      backgroundColor: "#17110dcc", padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setDepth(9000);
  }

  placeReturnSign() {
    let idx = 10;
    while (idx < 22 && this.pathPoints[idx].y < 150) idx += 1;
    const onPath = this.pathPoints[idx];
    const tan = smoothTangent(this.pathPoints, idx);
    const post = { x: onPath.x - tan.nx * (PATH_HALF + 22), y: onPath.y - tan.ny * (PATH_HALF + 22) };
    this.add.image(post.x, post.y, "post").setOrigin(0.5, 0.92).setDepth(post.y);
    this.add.text(post.x, post.y - 52, `← ${TOWNS[this.from].name.toUpperCase()}`, {
      fontFamily: "Georgia, serif", fontSize: "13px", color: "#ead5aa",
      backgroundColor: "#17110dcc", padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setDepth(9000);
  }

  addTravelHorse() {
    this.horseSide = 1;
    this.travelHorse = this.add.image(this.player.x + 58, this.player.y + 15, "horse")
      .setOrigin(0.5, 0.88)
      .setScale(0.72)
      .setDepth(this.player.y + 1);
    this.horseDust = addFootDust(this, this.travelHorse);
  }

  updateTravelHorse(moving) {
    if (!this.travelHorse) return;
    const nearLeft = this.player.x < 90;
    const nearRight = this.player.x > this.worldW - 90;
    if (nearLeft) this.horseSide = 1;
    if (nearRight) this.horseSide = -1;
    const targetX = Phaser.Math.Clamp(this.player.x + this.horseSide * 58, 38, this.worldW - 38);
    const targetY = this.player.y + 15;
    this.travelHorse.x = Phaser.Math.Linear(this.travelHorse.x, targetX, 0.14);
    this.travelHorse.y = Phaser.Math.Linear(this.travelHorse.y, targetY, 0.14);
    const horizontalSpeed = this.player.body.velocity.x;
    if (Math.abs(horizontalSpeed) > 8) this.travelHorse.setFlipX(horizontalSpeed < 0);
    const step = moving ? Math.sin(this.time.now * 0.022) : 0;
    this.travelHorse.setScale(0.72, 0.72 + step * 0.012);
    this.travelHorse.setRotation(moving ? step * 0.012 : 0);
    this.travelHorse.setDepth(Math.round(this.travelHorse.y) + 1);
    this.horseDust.emitting = moving;
    this.horseDust.setDepth(this.travelHorse.depth - 1);
  }

  update() {
    if (this.done || this.busy) {
      this.player.body.setVelocity(0, 0);
      this.footDust.emitting = false;
      this.updateTravelHorse(false);
      return;
    }
    let x = 0;
    let y = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) y += 1;
    steerWalker(this.player, x, y, this.speed);
    // Solo se camina por el sendero: si se sale, lo regresamos a la orilla.
    const held = clampToPath(this.player.x, this.player.y, this.pathPoints, PATH_HALF - 6);
    if (held.x !== this.player.x || held.y !== this.player.y) this.player.setPosition(held.x, held.y);
    const moving = x !== 0 || y !== 0;
    this.footDust.emitting = moving;
    this.footDust.setDepth(this.player.depth - 1);
    this.updateTravelHorse(moving);
    const distStart = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.startAt.x, this.startAt.y);
    const distEnd = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.endAt.x, this.endAt.y);
    if (!this.leftStart && distStart > 80) this.leftStart = true;
    if (this.leftStart && distStart < 90) {
      this.hud.setHint(`atrás vuelve a ${TOWNS[this.from].name}`);
    } else {
      this.hud.setHint(goalLine(this.registry, null));
    }
    if (this.leftStart && distStart < 44) this.turnBack();
    if (distEnd < 48) this.arrive();
  }

  rollEvent() {
    if (this.fired || this.busy) return;
    this.fired = true;
    const kind = pickRoadEvent(this.registry, this.route, this.from, this.to);
    playRoadEvent(this, kind);
  }

  turnBack() {
    if (this.done) return;
    this.done = true;
    this.busy = false;
    this.cameras.main.fadeOut(220);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("town", { id: this.from, spawn: this.direction });
    });
  }

  arrive() {
    if (this.done || this.busy) return;
    this.done = true;
    const spawn = Object.entries(TOWNS[this.to].exits).find(([, id]) => id === this.from)?.[0]
      ?? (this.goingDown ? "north" : "south");
    advanceMarket(this.registry, this.from, this.to);
    this.cameras.main.fadeOut(220);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("town", { id: this.to, spawn });
    });
  }
}
