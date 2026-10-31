# Homestead — handoff notes

Read this first when picking the project back up.

## Where things live

- **Playable game (published):** https://claude.ai/artifact/J1PmAqgWDPj7iC8bvr1dtQ
  Republish to the same URL by passing it as `url` to the Artifact tool.
  The artifact has `db` + `user` capabilities (account save); omit `capabilities` on republish to keep them.
- **3D look test (separate page):** https://claude.ai/artifact/NWrMz17zAH9uepr6a65e9h, source `look3d/index.html` (Three.js r128 from cdnjs). The player asked for a Whiteout-style real-3D look; this is the trial before converting the game. Screen shake was removed at the player's request; building bounce and tree wobble stay.
- **Source:** `homestead/src/head.html` (title, CSS, HUD markup, Three.js tag), `homestead/src/game.js` (all game code, inside `<script>`) and `homestead/src/render3d.js` (3D view, inserted inside the game's scope before the Loop section).
- **Build:** `python3 build.py` (run inside `homestead/`). One-off patch scripts live in `homestead/tools/`. Test files go in `/home/user/Test/.test/` (gitignored).
- **Branch:** `claude/homestead-game`. Commit and push after each step.

## About the player

- Prefers concise answers with no jargon, and wants clarifying questions before big changes.
- Tests on a phone. The joystick sits bottom-left and is hidden until touched.
- Character: a Black man with a beard; keep that look.
- Likes Whiteout Survival–style ads: stacking items, auto-gather, visible logistics.
- Wants a large, interconnected business with lots of upgrades. Stone and "worlds" were dropped for now.

## 3D view (in progress, staged)

- The player chose a Whiteout-style real-3D look and a staged conversion. A **3D view / 2D view** button (bottom right) switches; the choice is remembered in localStorage. Same page, same save.
- `R3` (render3d.js) reads the same game state each frame. The 2D canvas stays on top as a clear overlay for labels, pop-up text, the guide arrow and the joystick; `toScreen` projects through the 3D camera when 3D is on, and flying items are unprojected back into 3D.
- Round 1 (done): ground/plaza/roads/sea/districts, store with shelves, upgrade tiles, zones, trees/maples (culled by distance, see-through when in front of the player), falling trees, people (player, customers, porter, tapper, villagers), bots/forklift/sapbot/vans/drone, warehouse + annex racks, pallets, conveyor, cash piles, flying items.
- Later rounds: real interiors and machines for sawmill, shack, workshop, industry, rail, harbor and village (they are simple stand-ins now), phone performance pass, then make 3D the default.

## Maps and prestige

- **Sell & Move** tile (`move` group, `P(-70, 520)`): after earning $250k on a map (`MOVE_MIN`, uses `stats.earned`), sell for a permanent income bonus (`moveGain()`: floor(sqrt(earned / 50k)) × 10%). The panel asks to confirm.
- `MAPS`: Homestead → Snowy North (1.5× prices) → Tropical Coast (2× prices); after the last map, selling restarts it with more bonus. Each map changes item names (`ITEM_NAME`), some tile names, ground/plaza colors, 2D tree palettes (snow caps), and 3D tree shapes (`snowTrees`, `tropicTrees`). `applyMapTheme()` runs on load and on move; `R3.retheme()` rebuilds 3D trees and ground.
- A move rebuilds the town from `FRESH` (a snapshot taken at startup), keeping finished Research levels, the Dispatch Office and its settings, and `prestige` {map, bonus, moves}. The bonus multiplies `incomeMul()`.
- Ideas not built yet: a third/fourth map (desert, mountain valley), map-specific buildings or mechanics, a bigger map per move.

## Game overview (current)

2.5D canvas (TILT 0.52, ZOOM 0.75), world 4200×4200. The store is at the center (CX, CY); positions use `P(dx, dy)`.

- **Resources:** pine (`wood`), oak, redwood, maple sap → syrup, planks, chairs/tables, wood chips, water, paper, pellets, charcoal.
- **Town:** store (2 lanes), restock zone, pallet yard → forklifts → warehouse + annex → conveyor to the shelves, tree yard, maple grove + sugar shack, sawmill (+ drying kiln), loading dock (truck orders), Head Office (sale multiplier), billboards, cash drone.
- **Roofed buildings (`ROOFED`):** sawmill, sugar shack, workshop, generator, paper mill, depot, HQ, station, lab, harbor office, village store.
  - Each draws three depth layers: `drawBase` (floor + back wall), the interior (`R.draw`), and `drawRoof` (front wall + roof).
  - The roof fades when the player is inside or behind (`updateRoofs`).
  - Walls are collision boxes with a door gap (`wallBoxes`).
  - Tags drawn inside an interior are deferred with `tagSink` so they render above the roof.
- **Juice:** `bounceWrap` (building bounce on upgrade), falling-tree fx (`drawFall`), dust chips, walk cycle with arms in `drawPerson`.
- **Districts (bought deeds):**
  - Redwood Reserve (north)
  - Furniture District (east): workshop + showroom with buyer cars
  - Rail Yard (south): freight trains pay 2×
  - Industrial Park (south-east): generator/power, paper mill, pump, charcoal kiln, pellet press, van depot + delivery vans
  - Harbor (north-east coast, `SEA`): cargo ships (`updateShip`) load mixed exports via `TRAIN_SRC` and pay 3×; cranes and shipping lines are upgrades
  - Pine Village (north-west): village store you walk into (`VSTORE`), villagers (`updateVillagers`), builder's yard that turns van-delivered planks + redwood into houses on 16 plots; houses pay rent and add villagers
- **Dispatch Office** (`DISPATCH`, tile `P(-600, 480)`): the player controls material flow with `dispatch` settings, which are saved.
  - Reserves: `keep(kind)`/`spare(kind)`. New logs fill the warehouse up to the reserve first; shelves, the sawmill and village vans only use what's above it. Trucks, trains and ships can use all of it.
  - Bot and truck targeting: `dispatch.bots` / `dispatch.trucks`. If none of that kind is standing, they chop the nearest tree.
  - Tree Yard mix: `dispatch.yard` sets species through `yardSpecies(i)` / `applyYardMix()`.
  - Sawmill log choice `dispatch.saw` (`sawKinds()`), plank priority `dispatch.planks` (`plankHold()` keeps planks at the sawmill for village vans/exports), oak priority `dispatch.oak` (`shelfLimit()`, `kilnHungry()`), charcoal priority `dispatch.coal` (`coalHold()`).
- **Feeders:** Log Feeder (`sawfeed`) speeds warehouse → sawmill pulls; Oak Feeder (`kilnfeed`) lets the charcoal kiln pull oak from the warehouse and holds more. Sawmill goes to Lv 8, charcoal kiln to Lv 6.
- **Syrup:** Sap Tapper (1 worker) + Sap Bots (`sapbots`, up to 4 robot tappers, hauler id `sapbot`, use the tapper's level for speed/cap); Bigger Buckets (`buckets`, +1 sap per tap); Evaporator (`evap`, extra bottles per boil via `evapBonus()`); Sugar Shack to Lv 6 with `shackCap()`/`shackOutCap()`/`syrupGap()`.
- **Research Lab** (in town, `LAB`): research upgrades take time (`research` state); effects via `rSaw`, `rEng`, `rMarket`, `rGrowth`, `rLog`, `rPower`.
- **Logistics:**
  - Vans run the `ROUTES` table (chips → generator/paper mill, oak → charcoal kiln, charcoal → shack).
  - Other flows use flying items.
  - Power gives a speed boost (`boost()`); the paper mill needs power to run at all.
- **UI:**
  - 12 group tiles (`GROUPS`). Standing on one opens a DOM panel to buy upgrades (`UPGRADES` entries carry a `group`).
  - Mini map, $/min chip, contract + milestone card (`MILESTONES`, `newContract`), toast.
  - A "+$100 test" button that must be **removed before release**.
- **Save:** `snapshot()`/`applySave()`, version `v: 10` (fields added since are optional). Stored in localStorage and in the account db at `data/users/<id>/save`.

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
   - **prestige** ("sell the business, move to a new world"): the player picked this as the NEXT step
   - second store
   - apples/cider
   - sound
