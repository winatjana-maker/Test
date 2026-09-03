# Cordwood

An idle forestry-management builder for mobile. No combat, no PvP, no alliances — just a forest, a supply chain, and the satisfaction of a well-tuned mill.

This is the **playable web prototype** of the core loop described in [docs/PRD.md](docs/PRD.md): one biome (Pine Flats), a walking avatar, walk-to-collect, the timber chain, staffing, and offline production. Art is placeholder shapes — every drawing call lives in `js/render.js` so sprites can be swapped in later without touching game logic.

## Play it

It's plain HTML/JS with no build step. Serve the folder over HTTP and open it on a phone or desktop:

```bash
python3 -m http.server 8080
# then open http://localhost:8080  (or your computer's LAN IP on a phone)
```

Or push to GitHub Pages / Netlify / any static host.

### Controls

| Action | How |
|---|---|
| Walk | Drag anywhere on the map (floating joystick). WASD / arrow keys on desktop. |
| Collect | Stand on the dashed tile in front of a facility — no button. |
| Build | **Build** → pick a facility → tap a highlighted tile. |
| Inspect / upgrade / hire | Tap a facility. |
| Forest health | Tap a forest tile to see its yield. |

### How it plays

1. Build a **Woodcutter Camp** on a forest tile. It fills an on-site buffer with timber; walk in front of it to collect.
2. Chain **Sawmill → Planing Mill → Carpentry Shop** to turn timber into Trade Goods.
3. Build a **Guild Hall**, then **hire** staff for any facility — it delivers straight to storage and you never have to walk there again.
4. Over-harvested forest tiles turn brown and slow down; a **Nursery** speeds regrowth. A **Warehouse** raises the storage cap.
5. Everything keeps producing while the app is closed. Come back to a "while you were away" summary.

Progress saves to the browser automatically.

## Project layout

```
index.html        page shell
css/style.css     HUD, sheets, modals
js/config.js      ALL balancing numbers + facility/resource definitions
js/iso.js         isometric grid math
js/state.js       game state, save/load, helpers
js/sim.js         production, buffers, regrowth, offline catch-up
js/render.js      canvas rendering (placeholder art lives here)
js/input.js       floating joystick, taps, keyboard
js/ui.js          ledger, hints, build/facility sheets, modals
js/main.js        wiring + game loop
docs/PRD.md       product requirements
```

## Status

Prototype — core loop only. Not yet built: additional biomes, the sap/stone/ore branches, the tech tree, frontier plots, real art.
