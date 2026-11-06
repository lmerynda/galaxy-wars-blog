// Copies Galaxy Wars art into public/game as web-sized WebP.
// Usage: npx tsx scripts/import-game-art.ts <path to the galaxy-wars repo>
// Provenance and credits live in the game's client/Assets/Art/ATTRIBUTION.md.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const game = process.argv[2];
if (!game) throw new Error("Pass the galaxy-wars repository path.");
const art = path.join(game, "client/Assets/Art/Resources");
const out = "public/game";
const backgrounds: [string, string, number][] = [
  ["Backgrounds/Sectors/mining-field.png", "sector-mining", 1672],
  ["Backgrounds/Sectors/pve-frontier.png", "sector-frontier", 1672],
  ["Backgrounds/Sectors/pvp-redspace.png", "sector-redspace", 1672],
  ["Backgrounds/Sectors/strong-pve-storm.png", "sector-storm", 1672],
  ["Backgrounds/HangarLoadout.png", "hangar-bay", 1672],
  ["Backgrounds/carina_cosmic_cliffs.png", "carina", 3000],
];
const schematics = [
  "Dart",
  "Lancer",
  "Tempest",
  "Sentinel",
  "Bulwark",
  "Bastion",
  "Cargo",
  "Mining",
];
await mkdir(out, { recursive: true });
for (const [source, name, width] of backgrounds) {
  for (const [suffix, w] of [
    ["", width],
    ["-small", 960],
  ] as const) {
    const info = await sharp(path.join(art, source))
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(path.join(out, `${name}${suffix}.webp`));
    console.log(`${name}${suffix}.webp`, info.width, info.height, info.size);
  }
}
for (const ship of schematics) {
  const info = await sharp(path.join(art, "Hangar/Schematics", `${ship}.png`))
    .resize({ width: 520 })
    .webp({ quality: 80, alphaQuality: 80 })
    .toFile(path.join(out, `schematic-${ship.toLowerCase()}.webp`));
  console.log(`schematic-${ship.toLowerCase()}.webp`, info.size);
}
