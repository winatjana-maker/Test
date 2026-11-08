# Tiny Fronts (working title)

A cartoon, turn-based tactics game for phones. Short sessions, no connection needed, no purchases.
This is the first playable prototype.

## Play

Open `index.html` in a browser. No install or build step.
On a phone, host the folder on any web server and use "Add to Home Screen". After the first visit it works offline.

## What's in the prototype

- One 9×13 map ("Twin Rivers") against a computer opponent.
- 4 units: Infantry, Tank, Artillery, Helicopter. Each has its own move range, attack range and matchups.
- Terrain: plains, forest, mountains, water and roads. Each gives different cover and movement cost.
- Capture cities, factories and HQs with infantry. Each building you own pays 1,000 a turn. Spend it at factories.
- Air strike: fighting fills a meter. When it's full, you can hit a plus-shaped area. It never destroys a unit.
- Win by capturing the enemy HQ or destroying every enemy unit.
- Controls: tap a unit, tap where to go, then tap Attack, Capture or Wait. Damage is previewed before you commit.

Not built yet: story campaign, mode select, more maps, sound, real art.

## Code

| File | What it does |
| --- | --- |
| `src/game.js` | Game rules: units, damage, movement, capture, income, turns. No screen code. |
| `src/ai.js` | Computer opponent: picks the best move each step, buys units, uses air strikes. |
| `src/ui.js` | Drawing, taps, animations, menus. |
| `index.html`, `style.css` | Page layout. |
| `sw.js`, `manifest.json` | Offline support and home-screen install. |

Unit stats and the damage table are at the top of `src/game.js`. Maps are text grids in the same file.

## Tests

```
npm test
```

Runs rule tests, plus computer-vs-computer games to make sure games finish without errors.
