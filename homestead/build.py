# Builds index.html: head.html + game.js, with the 3D renderer placed inside the game's scope.
import pathlib
root = pathlib.Path(__file__).parent
head = (root / 'src/head.html').read_text()
game = (root / 'src/game.js').read_text()
r3 = (root / 'src/render3d.js').read_text()
marker = '  // ---------- Loop ----------'
assert game.count(marker) == 1
# full document: charset, phone viewport and the small reset the game relies on ([hidden] must win over class display rules)
top = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       '<style>body { margin: 0; } [hidden] { display: none !important; }</style>\n')
(root / 'index.html').write_text(top + head + game.replace(marker, r3 + marker) + '\n</html>\n')
print('built index.html')
