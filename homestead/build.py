# Builds index.html: head.html + game.js.
import pathlib
root = pathlib.Path(__file__).parent
head = (root / 'src/head.html').read_text()
game = (root / 'src/game.js').read_text()
# full document: charset, phone viewport and the small reset the game relies on ([hidden] must win over class display rules)
top = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       '<style>body { margin: 0; } [hidden] { display: none !important; }</style>\n')
(root / 'index.html').write_text(top + head + game + '\n</html>\n')
print('built index.html')
