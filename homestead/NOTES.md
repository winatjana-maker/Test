# Homestead — handoff notes

Read this first when picking the project back up.

## Where things live

- **Playable game (published):** https://claude.ai/artifact/2vhJNnKzrGBJ6igYbVcijo (new link since the 2D/art update; the old one, J1PmAqgWDPj7iC8bvr1dtQ, has the older 3D build)
- **Always include the game link in every reply to the player** (they asked for this).
  Republish to the same URL by passing it as `url` to the Artifact tool.
  The artifact has `db` + `user` capabilities (account save); omit `capabilities` on republish to keep them.
- **Source:** `homestead/src/head.html` (title, CSS, HUD markup) and `homestead/src/game.js` (all game code, inside `<script>`).
- **Build:** `python3 build.py` (run inside `homestead/`). One-off patch scripts live in `homestead/tools/`. Test files go in `/home/user/Test/.test/` (gitignored).
- **Branch:** `claude/homestead-game`. Commit and push after each step.

## About the player

- Prefers concise answers with no jargon, and wants clarifying questions before big changes.
- Tests on a phone. The joystick sits bottom-left and is hidden until touched.
- Character: a Black man with a beard; keep that look.
- Likes Whiteout Survival–style ads: stacking items, auto-gather, visible logistics.
- Wants a large, interconnected business with lots of upgrades. Stone and "worlds" were dropped for now.

## 3D view (removed)

- The player tried a Three.js 3D view and asked to drop it: the game is 2D only. Don't bring 3D back unless asked.

## Maps and prestige

- **Sell & Move** tile (`move` group, `P(-70, 520)`): after earning $250k on a map (`MOVE_MIN`, uses `stats.earned`), sell for a permanent income bonus (`moveGain()`: floor(sqrt(earned / 50k)) × 10%). The panel asks to confirm.
- `MAPS`: Homestead (1×) → Snowy North (1.5×) → Tropical Coast (2×) → Farm Valley (1.25×, `farmland: true`); after the last map, selling restarts it with more bonus. Indices are saved, so add new maps at the end.
- **Map picker** (`#picker`, `openPicker`, `goMap`): all maps are open. It shows on a brand-new game and from the **Maps** button (bottom right). Every map keeps its own town: the current one is the normal save, the others live in `mapSaves` (saved as `others`). The income bonus in `prestige` is shared. Switching rebuilds trees with `makeNodes()`. Same layout on every map; names and looks change. `applyMapTheme()` runs on load and on move.
- Each map has a `look` (`LOOK()`: `farm` / `snow` / `tropic`) plus `sea`, `shore`, `rim` colors. The look drives:
  - ground (`drawGround`): farm checkerboard; snow drifts, blue hollows and glints; tropic mown stripes with sand patches, and the world is an island in open sea
  - plaza/road edges (snowbanks, sandy edge, dirt edge), owned-district tint
  - sea (ice floes in the north, turquoise shallows in the tropics)
  - decor (`drawSnowDecor`: dry tufts, snowy rocks, berry bushes, snowmen; `drawTropicDecor`: ferns, hibiscus, tiki torches)
  - trees: snow mounds + birch bark marks; tropic bamboo clumps and teak (`tropicTree`), coconut palms (`drawPalm`)
  - roofs (`roofDress`): snow + icicles; straw thatch on `THATCH` buildings in the tropics; house roofs too
  - weather (`drawWeather`): falling snow; warm haze + drifting cloud shadows
- `hash(i, j, k)` gives stable noise per grid cell so scenery doesn't move with the camera.
- Sell & Move wipes the current map's town and goes to the next map (its saved town if it has one, else a fresh one from `FRESH`, a deep copy taken at startup), keeping finished Research levels, the Dispatch Office and its settings, and `prestige` {map, bonus, moves}. The bonus multiplies `incomeMul()`.
- Ideas not built yet: a third/fourth map (desert, mountain valley), map-specific buildings or mechanics, a bigger map per move.

## Cash drone and Bank Account

- Cash drone (`updateDrone`): flies to the fullest pile, scoops for at most 1.5 s (`drone.grab`), then brings it to you. Before, it could scoop forever when money landed faster than it took it.
- **Bank Account** (`bank`, Machines tile, $50,000): `payBills` adds money straight to `cash` (no pile), and anything left in piles or the drone is deposited.

## Map events, orchard and Market Hall

- **Events** (`EVENTS`, `event`, `updateEvent`): one per map, every ~2.5–4 min once $300 is earned, ~45 s long, banner `#chip-event` at the bottom.
  - Homestead: Market Day: store and market shoppers buy double and pay +25% (`shopMul()`); bunting over the plaza (`drawBunting`).
  - Snowy North: Snowstorm: player speed ×0.7, logs & planks sell +50% (in `unitPrice`), heavy sideways snow.
  - Tropical Coast: Tourist Boat: tourists (straw hats) pay +50%; a cruise ship in the NE sea (`drawTouristBoat`).
- **Apple Orchard** district (south-west, `DISTRICTS.orchard`, tile `P(-1190, 990)`): `apple` nodes (`n.fruit` 0..1) from `ensureYard`. Walk within 100 of a ripe tree and 3 apples go on your back (like logs). Carry them to a drop-off: the Cider House (`PRESS_IN`) or the Market (`MKT_IN`, west of the hall). Pickers (`pickers`) fill a basket of 8 and carry it to whichever drop-off is emptiest (`workerDrop`), so the market gets fresh fruit too. The store's Restock zone never takes crops (`CROPS`). Press: 2 apples → 1 cider; cider flies to the Market Hall.
- **Market Hall** (`MARKET`, east edge of town, tile `P(700, 430)`, pile `market`): second shop selling cider + fresh apples (`mstock`), shoppers (`shoppers`, `updateMarket`) come from the south, line up at 1–3 slots and pay. Upgrades: `market`, `clerk`.
- **Farm Valley only** (`FARMLAND()`; `DISTRICTS.fields`, group tile `P(1450, 1145)`, road with `farm: true`): Corn Farm (`fields`, `corn` nodes), Chicken Coop (`coop`, `hen` nodes that wander `HENYARD` and sit on a nest when an egg is ready), Grist Mill (`grist`, roofed, windmill sails: corn → cornmeal), Bakery (`bakery`, roofed: cornmeal + egg → cornbread, sent to the market), Farm Hands (`hands`). Carry corn to the mill (`GRIST_IN`) or market, eggs to the bakery (`BAKE_IN`) or market. On this map the Market sells cider, apples, corn, eggs and cornbread (`MKT_KINDS`) and opens with the orchard or the farm. On other maps the farm area is an empty clearing.
- Per map: apples/cider are Cloudberries/Berry Jam (Jam Kitchen) up north and Oranges/Orange Juice (Juice Bar) on the coast (`names`, `ups`, `notes` in `MAPS`; `applyMapTheme` renames upgrades).

## Art style (polished cartoon)

- The player chose a polished-cartoon look and smooth play on phones over extra effects.
- `OUT` + `outline()` draw the dark-brown outline; `shade(hex, k)` darkens/lightens (memoized).
- Ground: `grassTex()`/`plazaTex()` are small painted textures per map. Grass, clumps, plaza and roads are painted once into cached screen tiles (`groundTile`, `paintGround`, `paintPlazas`, GT = 512) and copied each frame. Animated bits (sea, snow glints, waves) stay live. `clearGroundCache()` runs on resize and map change.
- People: `personBody` draws the body; `personSprite` caches it per look + pose (rounded to 0.2) so crowds are cheap. Items carried (`before`) and tools (`after`) are still drawn live.
- Trees: `crown()` gives leafy crowns one shared outline, shade and a highlight; conifers are outlined with a shaded right side.
- Buildings: outlined walls/roofs, wall gradient, stone base, framed glass windows, roof gradient; store awning and counter outlined.
- Perf check: CPU throttled 4× in Playwright at 400×760, DPR 2 — about 40 ms/frame, close to before the art pass.

## Game overview (current)

2.5D canvas (TILT 0.52, ZOOM 0.75; `ctx` is `let` because cached tiles/sprites swap it briefly), world 4200×4200. The store is at the center (CX, CY); positions use `P(dx, dy)`.

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
2. Phone performance check (large world, many draw calls; snow and cloud overlays add a little).
3. Remove the test cash button for release.
4. More van routes (e.g. paper → warehouse/dock, planks → workshop by van instead of flying).
5. Ideas the player hasn't chosen yet:
   - **prestige** ("sell the business, move to a new world"): the player picked this as the NEXT step
   - second store
   - apples/cider
   - sound
