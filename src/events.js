/** Qué sale en el camino. El picker vive en el HUD de arriba. */

import { capacity, routeHeat, stones, visibleStones } from "./state.js";

export const ROAD_EVENTS = [
  { id: "random", label: "Azar" },
  { id: "clear", label: "Quieto" },
  { id: "checkpoint", label: "Retén" },
  { id: "ambush", label: "Asalto" },
  { id: "seize", label: "Confiscan" },
];

export function roadChances(registry, route = "road", from = "ashfen", to = "valkeep") {
  const load = stones(registry);
  const visible = visibleStones(registry);
  const loadFactor = Math.min(1, visible / Math.max(1, capacity(registry)));
  const heatFactor = routeHeat(registry, from, to) / 100;
  if (route === "woods") {
    const ambush = load > 0 ? Math.min(0.68, 0.18 + loadFactor * 0.2 + heatFactor * 0.18) : 0.08;
    return { clear: 1 - ambush, checkpoint: 0, ambush, seize: 0 };
  }
  const seize = load > 0 ? Math.min(0.24, 0.02 + loadFactor * 0.05 + heatFactor * 0.14) : 0;
  const checkpoint = Math.min(0.72, 0.34 + loadFactor * 0.14 + heatFactor * 0.18);
  return { clear: Math.max(0, 1 - checkpoint - seize), checkpoint, ambush: 0, seize };
}

export function pickRoadEvent(registry, route = "road", from = "ashfen", to = "valkeep") {
  const forced = registry.get("nextEvent") || "random";
  if (forced !== "random") return forced;
  const chances = roadChances(registry, route, from, to);
  const roll = Math.random();
  if (roll < chances.seize) return "seize";
  if (roll < chances.seize + chances.checkpoint) return "checkpoint";
  if (roll < chances.seize + chances.checkpoint + chances.ambush) return "ambush";
  return "clear";
}

export function addEventPicker(scene, visible = true, y = 48) {
  if (scene.registry.get("nextEvent") == null) {
    scene.registry.set("nextEvent", "random");
  }
  const labels = [];
  ROAD_EVENTS.forEach((ev, i) => {
    const t = scene.add
      .text(14 + i * 64, y, ev.label.toUpperCase(), {
        fontFamily: "Georgia, serif",
        fontSize: "9px",
        fontStyle: "bold",
        color: "#a99b87",
        backgroundColor: "#211a14ee",
        padding: { x: 7, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(10022)
      .setVisible(visible)
      .setInteractive({ useHandCursor: true });
    t.setData("id", ev.id);
    t.on("pointerdown", () => {
      scene.registry.set("nextEvent", ev.id);
      paint();
    });
    labels.push(t);
  });

  function paint() {
    const cur = scene.registry.get("nextEvent") || "random";
    for (const t of labels) {
      const on = t.getData("id") === cur;
      t.setColor(on ? "#fff0b8" : "#a99b87");
      t.setBackgroundColor(on ? "#725125ee" : "#211a14ee");
    }
  }
  paint();
  return { refresh: paint, labels };
}
