# Homestead — handoff notes

Read this first when picking the project back up.

## Where things live

- **Playable game (published):** https://claude.ai/artifact/J1PmAqgWDPj7iC8bvr1dtQ
  Republish to the same URL by passing it as `url` to the Artifact tool.
  The artifact has `db` + `user` capabilities (account save); omit `capabilities` on republish to keep them.
- **Source:** `homestead/src/head.html` (title, CSS, HUD markup) and `homestead/src/game.js` (all code, inside `<script>`).
- **Build:** `cat src/head.html src/game.js > index.html` (run inside `homestead/`).
- **Branch:** `claude/homestead-game`. Commit and push after each step.

## About the player

- Prefers concise answers with no jargon, and wants clarifying questions before big changes.
- Tests on a phone. The joystick sits bottom-left and is hidden until touched.
- Character: a Black man with a beard; keep that look.
- Likes Whiteout Survival–style ads: stacking items, auto-gather, visible logistics.
- Wants a large, interconnected business with lots of upgrades. Stone and "worlds" were dropped for now.

## Game overview (current)

2.5D canvas (TILT 0.52, ZOOM 0.75), world 4200×4200. The store is at the center (CX, CY); positions use `P(dx, dy)`.

- **Resources:** pine (`wood`), oak, redwood, maple sap → syrup, planks, chairs/tables, wood chips, water, paper, pellets, charcoal.
- **Town:** store (2 lanes), restock zone, pallet yard → forklifts → warehouse + annex → conveyor to the shelves, tree yard, maple grove + sugar shack, sawmill (+ drying kiln), loading dock (truck orders), Head Office (sale multiplier), billboards, cash drone.
- **Districts (bought deeds):**
  - Redwood Reserve (north)
  - Furniture District (east): workshop + showroom with buyer cars
  - Rail Yard (south): freight trains pay 2×
  - Industrial Park (south-east): generator/power, paper mill, pump, charcoal kiln, pellet press, van depot + delivery vans
- **Logistics:**
  - Vans run the `ROUTES` table (chips → generator/paper mill, oak → charcoal kiln, charcoal → shack).
  - Other flows use flying items.
  - Power gives a speed boost (`boost()`); the paper mill needs power to run at all.
- **UI:**
  - 12 group tiles (`GROUPS`). Standing on one opens a DOM panel to buy upgrades (`UPGRADES` entries carry a `group`).
  - Mini map, $/min chip, contract + milestone card (`MILESTONES`, `newContract`), toast.
  - A "+$100 test" button that must be **removed before release**.
- **Save:** `snapshot()`/`applySave()`, version `v: 10`. Stored in localStorage and in the account db at `data/users/<id>/save`.

## How I test

Use Playwright (Chromium is preinstalled) on a copy of `index.html`. Inject a debug handle by replacing the line `  fillQueue(true);` with one that also sets `window.__g = {...}`, then:

- teleport the player
- set cash
- click `[data-buy="id"]` buttons
- read state
- take screenshots at 400×760

Never ship the debug handle.

## Open to-dos / ideas

1. Balance pass: costs vs income without the test button (pacing for a real player).
2. Phone performance check (large world, many draw calls).
3. Remove the test cash button for release.
4. More van routes (e.g. paper → warehouse/dock, planks → workshop by van instead of flying).
5. Ideas the player hasn't chosen yet:
   - prestige ("sell the business, move to a new world")
   - second store
   - apples/cider
   - sound
