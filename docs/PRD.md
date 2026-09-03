# Cordwood — Product Requirements Document

**Platform:** Mobile (iOS / Android)
**Genre:** Idle resource & facility builder
**Monetization:** None — free, personal project
**Art direction:** 2.5D isometric, illustrated/painterly — like Whiteout Survival
**Stack:** Unity (2D isometric) for the full game; plain HTML/JS for the current playable prototype
**Status:** Draft v0.4

An idle forestry-management builder. No combat, no PvP, no alliances — just a forest, a supply chain, and the satisfaction of a well-tuned mill.

---

## Ring 01 — Vision & Pillars

Cordwood takes the part of Whiteout Survival that actually works — building up a base, chaining resource production, and watching a plan compound over time — and drops everything built around conflict. There is no rival to raid, no alliance to appease, no shield timer to manage. The tension comes from the forest itself: cut too fast and yields collapse; plan the rotation well and the whole operation compounds.

- **Pillar 01 — No combat, ever.** No PvP, no raiding, no alliance wars, no defensible base. Nothing in the design should require another player to lose for you to win.
- **Pillar 02 — Optimization is the whole game.** The core skill is routing resources through branching production chains efficiently — the same pleasure as a factory builder, expressed through a sawmill instead of a conveyor belt.
- **Pillar 03 — Idle-first, not idle-only.** Facilities keep producing while the app is closed. Sessions are for planning, staffing, and reacting — not for babysitting a timer.
- **Pillar 04 — The forest is the antagonist.** Tiles deplete when over-harvested and need time (or replanting) to recover. Sustainability replaces PvP as the game's source of pressure.

## Ring 02 — Core Loop

A short active session to re-route production and clear storage, followed by a long idle stretch where the plan plays itself out.

1. **Harvest** — Walk your avatar to a facility's tile to collect what's piled up — or hire staff and skip the trip entirely.
2. **Process** — Route raw resources through mills, kilns, and workshops into refined goods.
3. **Upgrade** — Spend refined goods to level facilities, raising throughput and unlocking recipes.
4. **Expand** — Claim and replant depleted land, or unlock the next biome with new resources.
5. **Return** — Come back after idle production, clear full storage, and re-route the chain.

**Movement:** The avatar is under direct control — drag or a virtual joystick, moving in real time across the base, not tap-to-path. Standing on the collection tile in front of a facility is what triggers the pickup; there's no separate collect button.

## Ring 03 — World & Setting

The player manages a forest holding that grows outward from a single valley, rendered as a 2.5D isometric world with illustrated, painterly sprite art and a fixed camera angle — the same look and feel as Whiteout Survival's base, just without anything to defend. A visible avatar walks the grid under the player's direct control. Each **biome** is a distinct stretch of land with its own tree species, terrain resources, and unlock requirements — a hand-built sequence of roughly six to eight biomes, followed by procedurally-generated **frontier plots** beyond that for players who want growth with no ceiling. Every biome is a tile grid: forest, stone, and ore tiles sit where the terrain puts them, and facilities are placed by hand onto open tiles or directly onto a matching resource tile — layout is a real spatial decision, not just a numeric one.

| Biome | Introduces | Unlock gate |
|---|---|---|
| Pine Flats (start) | Pine timber, sap | — |
| Hardwood Ridge | Oak & birch timber, stone | Sawmill Lv.5 |
| Stonefell Quarry | Cut stone, iron ore | Quarry Works built |
| River Delta | Hydro power, reed pulp | Bricks ×200 |
| Cedar Highlands | Cedar timber, resin (high yield) | Blacksmith Lv.5 |
| Rainforest Basin | Rare hardwoods, dyes | Sawyer's Guild Tier 2 |
| Alpine Treeline | Slow-growth timber, rare ore | Research node: Cold Forestry |
| Frontier Plots (endless) | Procedural land, scaling yields & costs | All hand-built biomes claimed |

**Sustainability mechanic:** A harvested tile's yield drops each pass and needs downtime (or an active replant action at the Nursery) to recover. Clear-cutting a whole biome fast is possible, but it stalls that biome's output for a long stretch afterward — the game's only real "punishment," and it's self-inflicted, not PvP.

## Ring 04 — Resource Economy

Six raw resources feed six branching processing paths. Two paths loop back into harvesting itself — better tools raise timber yield, which is the game's core positive-feedback loop.

```
Pine/Oak/Birch Timber → Sawmill → Lumber → Planing Mill → Planks → Carpentry Shop → Trade Goods
Pine Timber → Woodshed → Firewood → Charcoal Kiln → Charcoal
Sap → Resin Tapper → Resin ─┐
Planks ───────────────────────→ Workshop → Varnish & Glue
Iron Ore + Charcoal → Smelter → Metal Ingots → Blacksmith → Tools (boosts Timber yield), Fittings
Stone → Quarry Works → Cut Stone → Brick Kiln → Bricks
Planks → Paper Mill → Paper → Sawyer's Guild → Research Points
```

TOOLS feeding back into TIMBER is the loop: better tools → faster harvest → more of everything downstream.

## Ring 05 — Facilities

Each facility takes an input, produces an output, and levels independently with its own cost curve. Fifteen-plus facility types cover the full chain at launch, placed by hand onto the biome grid.

| Facility | Input | Output | Notes |
|---|---|---|---|
| Woodcutter Camp | Forest tile | Raw timber | Depletes the tile with use |
| Resin Tapper | Living tree | Sap | Does not deplete the tile |
| Quarry Works | Stone tile | Cut stone | Unlocks Stonefell Quarry |
| Mine | Ore tile | Iron ore | Unlocked in later biomes |
| Sawmill | Raw timber | Lumber | First processing tier |
| Planing Mill | Lumber | Planks | Feeds three later chains |
| Woodshed | Timber offcuts | Firewood | Byproduct of Sawmill output |
| Charcoal Kiln | Firewood | Charcoal | Smelter fuel |
| Brick Kiln | Cut stone | Bricks | Structural upgrade material |
| Carpentry Shop | Planks | Trade goods | Endless-progression currency |
| Workshop | Resin + Planks | Varnish & glue | Facility efficiency upgrades |
| Smelter | Ore + Charcoal | Metal ingots | — |
| Blacksmith | Metal ingots | Tools, fittings | Tools boost harvest yield |
| Paper Mill | Planks | Paper | Feeds the tech tree |
| Sawyer's Guild | Paper | Research points | Spends into the tech tree |
| Nursery | Sap | Replanted tiles | Reverses harvest depletion |
| Warehouse | Bricks | +Storage cap | Caps offline production |
| Guild Hall | Trade goods | Hiring unlock | Not a producer — unlocks staffing per role |

## Ring 06 — Progression & Endless Growth

No prestige reset, no final boss. Three progression tracks run in parallel, each on its own scaling curve, so there's always a next thing worth optimizing for.

| Track | Mechanic | Ceiling |
|---|---|---|
| Facility levels | Each facility type levels independently; cost scales geometrically, output scales sub-linearly | None — soft diminishing returns |
| Biome expansion | Six to eight hand-built biomes, then procedural frontier plots | None — frontier plots are infinite |
| Tech tree | Research Points unlock recipe upgrades, yield multipliers, and new facility tiers via the Sawyer's Guild | Open-ended, gated by frontier-plot resources late-game |

**Balancing risk:** Endless growth only stays interesting if new biomes and tech nodes keep changing *how* you optimize, not just raising numbers. Each hand-built biome should introduce one new mechanical wrinkle rather than a reskinned copy of the previous chain.

## Ring 07 — Staffing & Automation

No general labor pool, and no worker personalities to manage — just a role slot per facility that's either unstaffed or staffed. Every facility starts under the player's own feet and graduates to automatic once it's staffed.

- **Unstaffed** — The facility still produces continuously, day or night, into a small on-site buffer. The player must walk the avatar onto the tile in front of it to sweep that buffer into storage — no tap, the collection triggers on arrival.
- **Hire** — Once the Guild Hall is built, any facility can be staffed for a Trade Goods cost. This fills a generic role slot (Sawyer, Tapper, Smith…) — a stat upgrade with a label, not a character with a name or dialogue.
- **Staffed** — The facility's buffer auto-flushes straight into central storage on its own — no travel needed, ever, for that facility.
- **Upgrade** — Each staffed role levels independently — Trade Goods and, later, Research Points raise its output rate and buffer size.

**Why this matters:** Hiring has an obvious, physical payoff — it removes a stop on the walking route you'd otherwise run every session. Early game is a lot of walking the base collecting buffers; late game is mostly idle because most of the route has been staffed away.

## Ring 08 — Idle & Offline Systems

Idle production is the point, not a convenience feature — the active session exists to set up a good idle stretch.

| System | Behavior |
|---|---|
| Offline production | Every facility, staffed or not, keeps producing at full rate while the app is closed. No offline-earnings penalty or time cap. |
| On-site buffer | Unstaffed facilities hold their output in a small buffer at the tile itself; once full, production pauses until the avatar visits and clears it. Buffer size scales with facility level. |
| Staffed = no buffer cap | Staffed facilities skip the buffer and route straight into central storage, limited only by the Warehouse. |
| Storage as the real cap | Central storage stops filling when the Warehouse caps out — not after N hours away. |
| Return summary | On open, highlight which tiles have full buffers waiting on the map, plus overall storage state. |

## Ring 09 — Explicitly Out of Scope

- Any PvP: no attacking, raiding, spying, or scoreboards ranked against other players
- Alliances, guilds, or any system that pressures social coordination
- Combat of any kind — no monsters, no defensible base, no troops
- Monetization, IAP, ads, or battle passes — this is a free personal project
- Timers designed to create urgency or anxiety rather than reflect real production time
- Named or personality-driven staff — roles are stat upgrades, not characters with dialogue or individual management
- Button-based collection — resources come in by walking the avatar to the tile, never a tap-to-collect UI

## Ring 10 — UX Notes

The **map view** — the isometric world itself — is the main screen: it's where the avatar walks, where facilities get placed, and where buffers get collected just by standing in front of them. A **ledger view** lists every resource with current stock, storage cap, and net rate for planning at a glance, and a **facility detail panel** handles placement, leveling, and hiring. Full-color illustrated 2.5D throughout, painterly in the same register as Whiteout Survival's own art. Notifications are opt-in and limited to "storage full" and "buffer full" — nothing that nags for a return visit.

## Ring 11 — Asset Sourcing Plan

Ready-made 2D isometric sprite packs, not commissioned or AI-generated art — the fastest path for a solo build, and this exact genre (isometric base-builders) is one of the best-served niches in the asset market.

| Source | What it's for | Notes |
|---|---|---|
| CraftPix.net | Specializes in exactly this — isometric building sets, resource nodes, tile terrain, characters | Best single starting point for this genre specifically |
| Unity Asset Store | Broader 2D isometric packs and tilemap tools | Search "isometric," "2.5D village," "isometric tileset" |
| itch.io asset marketplace | Cheaper indie-made isometric packs, good for icons/UI/VFX | Quality varies more — preview closely |
| Kenney.nl | Free, simple isometric packs | Deliberately plain; treat as placeholder, not final art |

**Practical tip:** Pick one publisher's ecosystem — CraftPix's isometric line is the standard answer for this genre — and buy everything from it before shopping elsewhere. Style consistency across terrain tiles, buildings, and the avatar matters more than any single asset's quality.

## Ring 12 — Open Questions

- Does grid adjacency give bonuses (e.g. a Sawmill next to a Woodcutter Camp runs faster), or is placement purely spatial with no adjacency math?
- Camera behavior — fully fixed isometric angle, or a small amount of player rotate/zoom while keeping the diorama feel?
- At larger biome sizes, does avatar walking speed become tedious? May need a speed upgrade or a "run" mode as a later unlock.
- Which specific CraftPix (or similar) isometric pack(s) to license first, and whether a common re-color pass is needed for a cohesive look.
- Exact numeric balancing (yield rates, buffer sizes, cost curves, depletion/regrowth timers, hiring costs) — deferred to a separate balancing pass once systems are prototyped.

---

*Cordwood — Draft v0.4 — 2026-09-03*
