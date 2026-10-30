# Builds index.html: head.html + game.js, with the 3D renderer placed inside the game's scope.
import pathlib
root = pathlib.Path(__file__).parent
head = (root / 'src/head.html').read_text()
game = (root / 'src/game.js').read_text()
r3 = (root / 'src/render3d.js').read_text()
marker = '  // ---------- Loop ----------'
assert game.count(marker) == 1
(root / 'index.html').write_text(head + game.replace(marker, r3 + marker))
print('built index.html')
