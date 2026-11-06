# UI concepts (November 2026)

Exploration for the game-like redesign. Four directions run side by side in the real app with real entries. Pick one; the others get deleted. Each takes a different part of the game as its source: a place in space, the cockpit interface, the hangar, the title screen.

Subject: the development log of Galaxy Wars, a space combat game with sectors, human and alien fleets, a hangar and a flight HUD. Readers are players and followers. The page's job is to show what changed each day, mostly through screenshots.

Game art used (all project-owned or credited; see the game's `client/Assets/Art/ATTRIBUTION.md`): four sector nebulas, the hangar loadout bay, the NASA/ESA/CSA/STScI Carina "Cosmic Cliffs" image, and the pale-blue hangar ship schematics.

## Sector: every day is a sector

- **Idea:** each day is assigned one of the game's four sectors from its date. The page sits inside that sector: the nebula fills the viewport and the accent colour comes from it.
- **Color:** space `#05070B`, text `#E9EEF5`, dim `#93A0B4`. Accent per sector: mining field amber `#F0B04A`, frontier ice `#5FD4FF`, redspace rose `#FF4F9A`, storm ember `#FF7B3A`.
- **Type:** Saira, semi-expanded, for headings and dates; IBM Plex Sans for reading.
- **Layout:** the home page is a jump route. A thin route line runs down the left with one waypoint per day: date, sector and the day's screenshot strip. Reading column is left-aligned, 68ch.

```
| o  Sep 26  · Redspace   [img][img][img]
| |  Smaller packets, more breathing room
| o  Sep 22  · Frontier   [img][img]
```

- **The bold thing:** the colour of the whole page shifts by day. Everything else stays quiet.

## HUD: the blog as the flight interface

- **Idea:** borrow the game's own HUD language. It uses chamfered glass panels with a 1 px cyan edge over a blue nebula, plain sans readouts, and target-lock brackets.
- **Color:** glass `rgba(6, 24, 32, 0.78)`, edge `#2FB6CF`, glow `#5FE3F5`, text `#DDEFF4`, dim `#86A9B3`, ready green `#57E39B` (counts and status only).
- **Type:** Barlow, with Barlow Semi Condensed for readouts and numbers (tabular).
- **Layout:** fixed frontier nebula. The header is two HUD panels: pilot (brand) on the left, missions (comments) on the right. Days are mission panels in a two-column grid. Screenshots get corner lock brackets.
- **The bold thing:** the chamfered panel shape, used for every container.

## Hangar: each day is a bay

- **Idea:** a dark industrial hangar. Each day is a bay with its number painted on the floor in stencil, and a ship schematic is assigned to it like a craft on the pad.
- **Color:** gunmetal `#171B1F`, steel `#2A3138`, concrete `#D9DCDF`, dim `#8E979F`, sodium lamp `#F5A524`, bay light `#63E2EA` (sparingly), schematic `#A9C8E8`.
- **Type:** Saira Stencil One for bay numbers only; Archivo (narrow for labels, normal for reading).
- **Layout:** the hero is the loadout bay photo, letterboxed. Days are bays in a grid. Each has a large stencil day number, the month, entry titles, and a schematic ghosted behind it.
- **The bold thing:** giant stencil numerals.

## Title screen: the blog as the game's main menu

- **Idea:** the home page is a title screen. The Carina panorama pans slowly (the one ambient motion; off for reduced motion). There's a large logotype and a vertical menu: Continue (the latest day), All days, Comments. Days below are save slots.
- **Color:** deep dust `#0F0B09`, starlight text `#F3E9DC`, dust `#C9A27A`, star blue `#9CC3FF` (selection marker and focus).
- **Type:** Unbounded for the logotype and headings; Manrope for reading.
- **Layout:** the hero is full viewport, with the menu left-aligned in the lower third. Save slots are wide rows: thumbnail, date, update count and the first title. A selection marker follows hover and focus, as in a game menu.
- **The bold thing:** the menu.

## Review against generic defaults

- The current site is the "near-black with acid-green accent" default. No concept keeps acid green.
- Sector risked being generic "glass cards over a nebula". It now hinges on the date-driven sector and the route instead.
- Hangar avoids hazard stripes, the obvious move; the stencil numerals carry the place instead.
- All-caps text appears only where the game itself uses it: HUD panel titles and stencil bay marks.

## Shared

- The same markup is used for posts, comments and polls. Concepts differ in CSS, plus their own home hero and day header.
- Switch locally with `/concept/<sector|hud|hangar|title>`. The switch is a temporary scaffold and is removed with the losing concepts.
- The admin studio gets the winning concept's tokens and its own pass after the pick.
