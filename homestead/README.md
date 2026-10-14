# Homestead

A 2.5D lumber-business game in a single HTML page (canvas, no libraries).

- `index.html` — the playable game. Open it in a browser.
- `src/head.html` — page title, styles and HUD markup.
- `src/game.js` — all game code, wrapped in a `<script>` tag.

Build `index.html` from the sources:

```sh
cat src/head.html src/game.js > index.html
```

Controls: touch the bottom-left of the screen and drag to move, or use WASD / arrow keys.
