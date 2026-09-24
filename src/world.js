/** Mundo, mercancías y conexiones. Sin estado mutable. */

export const GOODS = {
  amber: { id: "amber", name: "Ámbar de sello", short: "Ámbar", mark: "◆", color: "#e08a35" },
  rune: { id: "rune", name: "Vidrio rúnico", short: "Rúnico", mark: "◇", color: "#b89cff" },
  rain: { id: "rain", name: "Perla de lluvia", short: "Lluvia", mark: "●", color: "#67c8d8" },
  sun: { id: "sun", name: "Piedra solar", short: "Solar", mark: "✦", color: "#f0bc4f" },
  frost: { id: "frost", name: "Cristal de escarcha", short: "Escarcha", mark: "❄", color: "#b9e8f2" },
};

export const TOWNS = {
  ashfen: {
    id: "ashfen", name: "Ashfen", region: "TIERRAS TEMPLADAS",
    blurb: "Campos y cantera. El ámbar protege la cosecha.",
    produce: "amber",
    ground: "grass", path: "dirt", plaza: "cobble", biome: "temperate", music: "ashfen",
    houseTint: 0xfff0d2, treeTint: 0xffffff,
    exits: { north: "valkeep" }, boat: "frostholm", service: "stashKit",
  },
  valkeep: {
    id: "valkeep", name: "Valkeep", region: "FALDAS DE MONTAÑA",
    blurb: "Pueblo de piedra entre picos. Los escribas funden vidrio rúnico.",
    produce: "rune",
    ground: "highland", path: "dirt", plaza: "cobble", biome: "mountain", music: "valkeep",
    houseTint: 0xdcd5c6, treeTint: 0xa9c0a4,
    exits: { south: "ashfen", north: "verdelume" }, service: "horse",
  },
  verdelume: {
    id: "verdelume", name: "Verdelume", region: "SELVA DE LLUVIA",
    blurb: "Canales y raíces. Las perlas guardan lluvia.",
    produce: "rain",
    ground: "jungle", path: "mud", plaza: "cobble", biome: "tropical", music: "ashfen",
    houseTint: 0xe2d6a6, treeTint: 0x74ad68,
    exits: { south: "valkeep", east: "duneshade" }, service: "tonic",
  },
  duneshade: {
    id: "duneshade", name: "Duneshade", region: "MAR DE DUNAS",
    blurb: "Pozos bajo el sol. Sus hornos crean piedra solar.",
    produce: "sun",
    ground: "sand", path: "dirt", plaza: "cobble", biome: "desert", music: "road",
    houseTint: 0xe8c98a, treeTint: 0xc5a86a,
    exits: { west: "verdelume", south: "frostholm" }, service: "escort",
  },
  frostholm: {
    id: "frostholm", name: "Frostholm", region: "PASO NEVADO",
    blurb: "Graneros de hielo. La escarcha conserva alimento.",
    produce: "frost",
    ground: "snow", path: "packed", plaza: "cobble", biome: "snow", music: "valkeep",
    houseTint: 0xd9e7ee, treeTint: 0xb8cad0,
    exits: { north: "duneshade" }, boat: "ashfen", service: "ferry",
  },
};

export const TOWN_IDS = Object.keys(TOWNS);

export function connectedTowns(townId) {
  return Object.values(TOWNS[townId]?.exits ?? {}).filter(Boolean).map((id) => TOWNS[id]);
}

export function routeBiome(fromId, toId) {
  const biomes = [TOWNS[fromId]?.biome, TOWNS[toId]?.biome];
  if (biomes.includes("snow")) return "snow";
  if (biomes.includes("desert")) return "desert";
  if (biomes.includes("tropical")) return "tropical";
  if (biomes.includes("mountain")) return "mountain";
  return "temperate";
}
