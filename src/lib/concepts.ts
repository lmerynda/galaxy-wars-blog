// Temporary: UI concept exploration. Removed once a concept is chosen.
export const concepts = [
  "current",
  "sector",
  "hud",
  "hangar",
  "title",
] as const;
export type Concept = (typeof concepts)[number];
export const isConcept = (value: unknown): value is Concept =>
  concepts.includes(value as Concept);

export const sectors = [
  { id: "mining", name: "Mining field" },
  { id: "frontier", name: "Frontier" },
  { id: "redspace", name: "Redspace" },
  { id: "storm", name: "Storm" },
] as const;
export type Sector = (typeof sectors)[number];
// Stable per date. A hash, because any linear rule repeats every four days.
export function sectorFor(day: string): Sector {
  const days = Math.round(Date.parse(`${day}T00:00:00Z`) / 86400000);
  let h = Math.imul(days, 0x9e3779b1) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return sectors[h % sectors.length];
}

const ships = [
  "dart",
  "lancer",
  "tempest",
  "sentinel",
  "bulwark",
  "bastion",
  "cargo",
  "mining",
] as const;
export const schematicFor = (day: string) =>
  `/game/schematic-${ships[Number(day.slice(8, 10)) % ships.length]}.webp`;
