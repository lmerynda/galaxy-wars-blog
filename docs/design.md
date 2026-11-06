# Design

The blog wears the game's own flight HUD, so readers see the same interface they would see in Galaxy Wars.

## System

- **Panels:** cut corners (`--cut`, 14 px; 8 px on buttons and small links), a 1 px cyan edge (`--edge` `#2FB6CF`) and dark teal glass. Every container uses the same shape: header brand, comment counter, buttons, the home hero, day missions, entries, discussions, admin panels. The edge is the `::before` layer, the glass the `::after` layer, both cut by one `clip-path`.
- **Color:** space `#03080C`, text `#DDEFF4`, dim `#8FB0B9`, accent `#5FE3F5` for hover, focus and primary actions, ready green `#57E39B` for counts and status only, danger `#FF8A80`.
- **Type:** Barlow for reading; Barlow Semi Condensed for panel titles, readouts and buttons. Panel titles are uppercase with 0.06em tracking, as in the game's HUD. Nothing else is uppercase.
- **Backdrop:** the game's frontier sector nebula (`public/game/sector-frontier.webp`), fixed behind every page. Phones load the 960 px version.
- **Target lock:** screenshots carry corner brackets that close in on hover or focus. This is the only motion besides hover colour, and it is off with reduced motion.
- **Vote bars:** poll results use the HUD's hull and energy bar style.

## Game art

`scripts/import-game-art.ts <galaxy-wars repo>` regenerates the WebP files in `public/game` from the game's `client/Assets/Art/Resources`. Provenance is recorded in the game's `client/Assets/Art/ATTRIBUTION.md`. The sector backgrounds and loadout bay are project-owned and approved for the blog.

## Explored and rejected (November 2026)

Four directions were built in the app with real entries before HUD was chosen:

- **Sector:** each day took one of the four sector nebulas, picked from its date, plus its accent colour, with a "jump route" home page.
- **Hangar:** days as hangar bays with large stencil day numbers and ghosted ship schematics.
- **Title screen:** the home page as a main menu over a panning Carina nebula, with days as save slots.

HUD won because it comes straight from the game's interface rather than a space theme, and it handles long entries best. The other three were deleted; the commit "Explore four game-like UI concepts with game art" holds them.
