# One-off patch: carry fruit by hand, fix fresh fruit never reaching the Market Hall,
# a map picker with one save per map, and a fourth map (Farm Valley) with corn, hens, a grist mill and a bakery.
import pathlib
root = pathlib.Path(__file__).parent.parent
p = root / 'src/game.js'
s = p.read_text()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:100])
    s = s.replace(a, b)

# ---------- HUD handles ----------
rep("    chipLogs: document.getElementById('chip-logs'), chipSap: document.getElementById('chip-sap'), chipCash: document.getElementById('chip-cash'),\n",
    "    chipLogs: document.getElementById('chip-logs'), chipSap: document.getElementById('chip-sap'), chipCash: document.getElementById('chip-cash'),\n"
    "    crops: document.getElementById('n-crops'), chipCrops: document.getElementById('chip-crops'),\n")

# ---------- items ----------
rep("charcoal: 'Charcoal', apple: 'Apples', cider: 'Cider' };",
    "charcoal: 'Charcoal', apple: 'Apples', cider: 'Cider',\n    corn: 'Corn', egg: 'Eggs', meal: 'Cornmeal', bread: 'Cornbread' };")
rep("charcoal: 7, apple: 5, cider: 22 };", "charcoal: 7, apple: 5, cider: 22, corn: 4, egg: 6, bread: 30 };")

# ---------- layout ----------
rep("  const MKT_SPAWN = P(1060, 1000);\n", """  const MKT_SPAWN = P(1060, 1000);
  // drop-off spots for fruit, corn and eggs you carry by hand
  const MKT_IN = { ...P(795, 545), w: 90, d: 90 };
  const PRESS_IN = { x: CX - 1560, y: CY + 1432, w: 120, d: 56 };
  // farm (Farm Valley only, south-east): corn rows, a hen yard, a grist mill and a bakery
  const CORN = { x: CX + 1820, y: CY + 1384, cols: 8, rows: 5, gap: 54, rowGap: 62 };
  const HENYARD = { x0: CX + 1590, x1: CX + 1800, y0: CY + 1590, y1: CY + 1770 };
  const COOP = { x: CX + 1650, front: CY + 1640, w: 90, d: 50 };
  const GRIST = { x: CX + 1960, front: CY + 1740, w: 170, d: 100 };
  const GRIST_IN = { x: CX + 1960, y: CY + 1774, w: 110, d: 56 };
  const BAKERY = { x: CX + 1700, front: CY + 1900, w: 220, d: 90 };
  const BAKE_IN = { x: CX + 1700, y: CY + 1932, w: 110, d: 50 };
  const HANDS_HOME = P(1900, 1880);
""")
rep("    orchard: { name: 'Apple Orchard', x0: CX - 2080, x1: CX - 1300, y0: CY + 620, y1: CY + 1460, ground: '#a3bf72' },\n  };",
    "    orchard: { name: 'Apple Orchard', x0: CX - 2080, x1: CX - 1300, y0: CY + 620, y1: CY + 1460, ground: '#a3bf72' },\n"
    "    fields: { name: 'Corn Farm', x0: CX + 1560, x1: CX + 2080, y0: CY + 1180, y1: CY + 1960, ground: '#b9a868', farm: true },\n  };")
rep("    { x0: CX - 1310, x1: CX - 1070, y0: CY + 930, y1: CY + 1050 },\n  ];",
    "    { x0: CX - 1310, x1: CX - 1070, y0: CY + 930, y1: CY + 1050 },\n    { x0: CX + 1160, x1: CX + 1600, y0: CY + 1100, y1: CY + 1190, farm: true },\n  ];")

# ---------- upgrades ----------
rep("    { id: 'clerk', group: 'market', name: 'Market Clerk', hire: 'Hire a Clerk', costs: [2500, 8000, 20000], note: 'Serves shoppers faster', needs: 'market' },\n",
    """    { id: 'clerk', group: 'market', name: 'Market Clerk', hire: 'Hire a Clerk', costs: [2500, 8000, 20000], note: 'Serves shoppers faster', needs: 'market' },
    // farm (Farm Valley only): corn and eggs, a grist mill and a bakery
    { id: 'fields', group: 'fields', name: 'Corn Farm', hire: 'Buy the Farm', costs: [3000, 6000, 12000, 25000], note: 'Corn rows; walk past ripe corn to pick it', more: 'More corn, grows faster' },
    { id: 'coop', group: 'fields', name: 'Chicken Coop', hire: 'Build Chicken Coop', costs: [2000, 5000, 12000, 30000], note: 'Hens lay eggs; walk past to collect them', more: 'More hens, lay faster', needs: 'fields' },
    { id: 'grist', group: 'fields', name: 'Grist Mill', hire: 'Build Grist Mill', costs: [3000, 8000, 20000], note: 'Grinds corn into cornmeal', more: 'Grinds faster, holds more', needs: 'fields' },
    { id: 'bakery', group: 'fields', name: 'Bakery', hire: 'Build Bakery', costs: [6000, 15000, 40000], note: 'Bakes cornmeal + an egg into cornbread', more: 'Bakes faster, holds more', needs: 'grist' },
    { id: 'hands', group: 'fields', name: 'Farm Hands', hire: 'Hire a Farm Hand', costs: [2500, 6000, 15000], note: '+1 worker who picks corn & collects eggs', needs: 'fields' },
""")
rep("    { id: 'market', name: 'Market Hall', ...P(700, 430) },\n",
    "    { id: 'market', name: 'Market Hall', ...P(700, 430) },\n    { id: 'fields', name: 'Corn Farm', farm: true, ...P(1450, 1145) },\n")

# ---------- numbers ----------
rep("  const clerkTime = () => [0.6, 0.4, 0.25, 0.15][level.clerk];\n", """  const clerkTime = () => [0.6, 0.4, 0.25, 0.15][level.clerk];
  const cornSpots = () => [0, 16, 24, 32, 40][level.fields];
  const cornTime = () => [26, 26, 21, 16, 12][level.fields];        // seconds for a stalk to ripen
  const henCount = () => [0, 4, 6, 9, 12][level.coop];
  const layTime = () => [36, 36, 28, 21, 15][level.coop];           // seconds between eggs
  const gristCap = () => [0, 30, 50, 80][level.grist];
  const gristTime = () => [2, 2, 1.4, 0.9][level.grist];
  const bakeCap = () => [0, 30, 50, 80][level.bakery];
  const bakeTime = () => [3, 3, 2, 1.3][level.bakery];
  const MEAL_CAP = 40, BREAD_CAP = 40, CORN_PER = 2, EGGS_PER = 2, BAG = 8;
  const CROPS = ['apple', 'corn', 'egg'];                           // carried by hand, never restocked at the store
""")

# ---------- state ----------
rep("  const carried = { wood: 0, oak: 0, redwood: 0, sap: 0 };", "  const carried = { wood: 0, oak: 0, redwood: 0, sap: 0, apple: 0, corn: 0, egg: 0 };")
rep("  const press = { apples: 0, out: 0, t: 0 }, mstock = { cider: 0, apple: 0 }, mpend = { press: 0, cider: 0, apple: 0 };",
    "  const press = { apples: 0, out: 0, t: 0 }, mstock = { cider: 0, apple: 0, corn: 0, egg: 0, bread: 0 };\n"
    "  const mpend = { press: 0, cider: 0, apple: 0, corn: 0, egg: 0, bread: 0, grist: 0, bmeal: 0, begg: 0 };\n"
    "  const grist = { corn: 0, meal: 0, t: 0 }, bakery = { meal: 0, eggs: 0, out: 0, t: 0 };")
rep("  let pickers = [], shoppers = [];", "  let pickers = [], shoppers = [], hands = [];")

# ---------- maps ----------
rep("""        maple: ['#3f8a33', '#4f9a3a', '#468f36', '#5aa646', '#6ab450'], mapleTrunk: '#a8834f' } },
  ];""", """        maple: ['#3f8a33', '#4f9a3a', '#468f36', '#5aa646', '#6ab450'], mapleTrunk: '#a8834f' } },
    { name: 'Farm Valley', price: 1.25, look: 'farm', farmland: true, sea: '#4f8fb3', shore: '#e3d3a5', rim: '#6a5236',
      blurb: 'Golden fields: grow corn, collect eggs, grind meal and bake cornbread.',
      names: {}, groups: {}, ground: ['#a3b85c', '#93a84e', '#667a36'], plaza: '#d3bb8c',
      tree: { trunk: { pine: '#7a4f2c', oak: '#5e4129', redwood: '#9a4a2c' }, oak: ['#b8742c', '#c98436', '#c07a30', '#d99a45', '#ebb75e'],
        pine: ['#3d7a3a', '#468a43', '#52994d'], redwood: ['#7a3f24', '#874a2a', '#955532', '#a3613a', '#b06e44'],
        maple: ['#d9a03a', '#e6b243', '#dca83e', '#efc45a', '#f7d77a'], mapleTrunk: '#6e4a32' } },
  ];
  const BLURBS = ['Green woods, maple syrup and an apple orchard.', 'Snowy forest, birch syrup and berry jam. Watch for snowstorms.',
    'Sunny beaches, coconuts and orange juice. Tourist boats visit.'];
  MAPS.forEach((m, i) => { m.blurb = m.blurb || BLURBS[i]; });
  const FARMLAND = () => !!MAP().farmland;
  const groupOn = g => !g.farm || FARMLAND();
  const distOn = id => !DISTRICTS[id].farm || FARMLAND();
  const roadsNow = () => ROADS.filter(r => !r.farm || FARMLAND());""")

# needs can be a list (any one of them)
rep("  const canBuy = u => level[u.id] < u.costs.length && !(u.needs && !level[u.needs]) && !(u.research && research);",
    "  const needsMet = u => !u.needs || (Array.isArray(u.needs) ? u.needs.some(id => level[id]) : level[u.needs] > 0);\n"
    "  const needsName = u => (Array.isArray(u.needs) ? u.needs : [u.needs]).map(id => NAMES[id]).join(' or ');\n"
    "  const canBuy = u => level[u.id] < u.costs.length && needsMet(u) && !(u.research && research);")
rep("const lv = level[u.id], max = lv >= u.costs.length, blocked = u.needs && !level[u.needs];",
    "const lv = level[u.id], max = lv >= u.costs.length, blocked = !needsMet(u);")
rep("blocked ? `Needs ${NAMES[u.needs]}`", "blocked ? `Needs ${needsName(u)}`")
rep("    const here = GROUPS.find(g => inRect(g, TILE_SIZE, TILE_SIZE));", "    const here = GROUPS.find(g => groupOn(g) && inRect(g, TILE_SIZE, TILE_SIZE));")
rep("    for (const g of GROUPS) drawGroupTile(g, time);", "    for (const g of GROUPS) if (groupOn(g)) drawGroupTile(g, time);")
rep("    for (const g of GROUPS) if (UPGRADES.some(", "    for (const g of GROUPS) if (groupOn(g) && UPGRADES.some(")
rep("    for (const id in DISTRICTS) drawDistrict(id);", "    for (const id in DISTRICTS) if (distOn(id)) drawDistrict(id);")
rep("    for (const id in DISTRICTS) { const d = DISTRICTS[id]; rect(", "    for (const id in DISTRICTS) { if (!distOn(id)) continue; const d = DISTRICTS[id]; rect(")
rep("""    for (const id in DISTRICTS) {
      if (level[id]) continue;""", """    for (const id in DISTRICTS) {
      if (level[id] || !distOn(id)) continue;""")
rep("      ...ROADS.map(r => [(r.x0 + r.x1) / 2", "      ...roadsNow().map(r => [(r.x0 + r.x1) / 2")
rep("    for (const r of ROADS) rect(r.x0, r.y0, r.x1, r.y1, MAP().plaza);", "    for (const r of roadsNow()) rect(r.x0, r.y0, r.x1, r.y1, MAP().plaza);")

# theme: the Market Hall opens with the orchard, or on Farm Valley with the farm too
rep("""      NAMES[u.id] = u.name;
    }""", """      NAMES[u.id] = u.name;
    }
    UPGRADES.find(u => u.id === 'market').needs = m.farmland ? ['orchard', 'fields'] : 'orchard';
    UPGRADES.find(u => u.id === 'market').note = m.farmland ? 'Second shop: sells cider, fruit, corn, eggs & cornbread' : UPGRADES.find(u => u.id === 'market').note;""")

# ---------- yard: corn and hens ----------
rep("""                   y: ORCHARD.y + (row - (ORCHARD.rows - 1) / 2) * 105, r: 16, fruit: (i % 4) / 4, size: 1, shake: 0, seed: i / 28 });
    }
  }""", """                   y: ORCHARD.y + (row - (ORCHARD.rows - 1) / 2) * 105, r: 16, fruit: (i % 4) / 4, size: 1, shake: 0, seed: i / 28 });
    }
    const corn = nodes.filter(n => n.type === 'corn').length;
    for (let i = corn; i < cornSpots(); i++) {
      const row = Math.floor(i / CORN.cols), col = i % CORN.cols;
      nodes.push({ type: 'corn', x: CORN.x + (col - (CORN.cols - 1) / 2) * CORN.gap + (row % 2) * 10, y: CORN.y + (row - (CORN.rows - 1) / 2) * CORN.rowGap,
                   r: 10, fruit: (i % 5) / 5, size: 1, shake: 0, seed: (i * 0.618) % 1 });
    }
    const hens = nodes.filter(n => n.type === 'hen').length;
    for (let i = hens; i < henCount(); i++) {
      const hx = HENYARD.x0 + 40 + ((i * 53) % 150), hy = HENYARD.y0 + 70 + ((i * 37) % 90);
      nodes.push({ type: 'hen', x: hx, y: hy, tx: hx, ty: hy, r: 10, fruit: (i % 3) / 3, size: 1, shake: 0, seed: (i * 0.37) % 1, face: 1, walk: 0, t: i });
    }
  }""")

# corn and hens don't block you
rep("      if (n.type === 'tree' && n.hp <= 0) continue;\n      const dx = player.x - n.x",
    "      if ((n.type === 'tree' && n.hp <= 0) || n.type === 'corn' || n.type === 'hen') continue;\n      const dx = player.x - n.x")

# ---------- store restock never takes fruit, corn or eggs ----------
rep("""  function route(kind) {
    if (kind === 'sap') {""", """  function route(kind) {
    if (CROPS.includes(kind)) return null;
    if (kind === 'sap') {""")
rep("""        if (stack.slice(i + 1).includes(stack[i])) continue;   // already tried this kind""",
    """        if (CROPS.includes(stack[i]) || stack.slice(i + 1).includes(stack[i])) continue;   // already tried this kind""")
rep("""        deliver(kind, dest, backTop());
      } else fullNotice(stack[stack.length - 1]);""", """        deliver(kind, dest, backTop());
      } else { const k = [...stack].reverse().find(x => !CROPS.includes(x)); if (k) fullNotice(k); }""")

# ---------- orchard: replace fly-away picking with carrying ----------
a = s.index("  // where a picked apple goes: the cider house if it has room, otherwise the market's fresh-fruit crate")
b = s.index("    // the press: 2 apples → 1 cider, then cider rolls off to the market hall")
s = s[:a] + """  const gristInSpot = () => { const [x, y] = toScreen(GRIST.x - 50, GRIST.front); return [x, y - 24]; };
  const gristOutSpot = () => { const [x, y] = toScreen(GRIST.x + 50, GRIST.front); return [x, y - 24]; };
  const bakeInSpot = () => { const [x, y] = toScreen(BAKERY.x - 10, BAKERY.front); return [x, y - 30]; };
  const bakeOutSpot = () => { const [x, y] = toScreen(BAKERY.x + 70, BAKERY.front); return [x, y - 24]; };
  // what the Market Hall sells, left to right on its shelves
  const MKT_KINDS = () => FARMLAND() ? ['cider', 'apple', 'corn', 'egg', 'bread'] : ['cider', 'apple'];
  const MKT_WEIGHT = { cider: 2, apple: 1, corn: 1, egg: 1.2, bread: 2.5 };
  const mktRoom = k => mstock[k] + mpend[k] < mktCap();
  // drop-off spots: stand on one and what it takes comes off your back
  const DROPS = [
    { z: PRESS_IN, kinds: ['apple'], on: () => level.press > 0, fill: () => (press.apples + mpend.press) / pressCap(),
      take: k => k === 'apple' && press.apples + mpend.press < pressCap(), send: () => { mpend.press++; return [pressInSpot, () => { mpend.press--; press.apples++; }]; } },
    { z: MKT_IN, kinds: CROPS, on: () => level.market > 0, fill: k => (mstock[k] + mpend[k]) / mktCap(),
      take: k => CROPS.includes(k) && MKT_KINDS().includes(k) && mktRoom(k), send: k => { mpend[k]++; return [mktSpot(k), () => { mpend[k]--; mstock[k]++; }]; } },
    { z: GRIST_IN, kinds: ['corn'], on: () => level.grist > 0, fill: () => (grist.corn + mpend.grist) / gristCap(),
      take: k => k === 'corn' && grist.corn + mpend.grist < gristCap(), send: () => { mpend.grist++; return [gristInSpot, () => { mpend.grist--; grist.corn++; }]; } },
    { z: BAKE_IN, kinds: ['egg'], on: () => level.bakery > 0, fill: () => (bakery.eggs + mpend.begg) / bakeCap(),
      take: k => k === 'egg' && bakery.eggs + mpend.begg < bakeCap(), send: () => { mpend.begg++; return [bakeInSpot, () => { mpend.begg--; bakery.eggs++; }]; } },
  ];
  // where a worker takes a crop: whichever open drop-off is emptiest, so the market gets fresh fruit too
  function workerDrop(k) {
    let best = null, bf = Infinity;
    for (const D of DROPS) {
      if (!D.on() || !D.take(k)) continue;
      const f = D.fill(k);
      if (f < bf) { bf = f; best = D; }
    }
    return best;
  }
  const PICK_R = { apple: 100, corn: 70, hen: 80 };
  const cropOf = n => n.type === 'hen' ? 'egg' : n.type;
  const yieldOf = n => n.type === 'apple' ? APPLES_PER_TREE : n.type === 'corn' ? CORN_PER : EGGS_PER;
  const cropTop = n => { const [x, y] = toScreen(n.x, n.y); return [x, y - (n.type === 'apple' ? 70 : n.type === 'corn' ? 46 : 14)]; };
  function pickCrop(n, to, onEach) {
    const k = cropOf(n), amt = yieldOf(n), from = cropTop(n);
    n.fruit = 0; n.shake = 0.6;
    for (let i = 0; i < amt; i++) fly(k, from, to, 0.35 + i * 0.06, onEach ? () => onEach(k) : null);
    popText(n.x, n.y, n.type === 'apple' ? 100 : 56, `+${amt} ${ITEM_NAME[k]}`, '#ffe2b0');
  }
  // you: walk past ripe fruit, corn or a hen's nest and it goes on your back
  function updateCrops(dt) {
    timers.pick = (timers.pick || 0) - dt;
    if (timers.pick <= 0) {
      timers.pick = 0.25;
      for (const n of nodes) {
        if (!PICK_R[n.type] || n.fruit < 1 || Math.hypot(n.x - player.x, n.y - player.y) > PICK_R[n.type]) continue;
        carried[cropOf(n)] += yieldOf(n); updateHud('crops');
        pickCrop(n, backTop, k => stack.push(k));
        break;
      }
    }
    timers.cropDrop = (timers.cropDrop || 0) - dt;
    if (timers.cropDrop > 0 || !stack.length) return;
    for (const D of DROPS) {
      if (!D.on() || !inRect(D.z, D.z.w, D.z.d)) continue;
      for (let i = stack.length - 1; i >= 0; i--) {
        const k = stack[i];
        if (!CROPS.includes(k) || !D.take(k)) continue;
        timers.cropDrop = 0.07;
        stack.splice(i, 1); carried[k]--; updateHud();
        const [to, done] = D.send(k);
        fly(k, backTop(), to, 0.4, done);
        return;
      }
      if (stack.some(k => D.kinds.includes(k)) && (timers.cropFull = (timers.cropFull || 0) - 0.07) <= 0) {
        timers.cropFull = 2.5; popText(D.z.x, D.z.y, 40, 'Full!', '#ffd0c4');
      }
    }
  }
  // pickers and farm hands: fill a basket, carry it to a drop-off, unload, repeat
  function updateWorkers(list, want, types, home, dt) {
    while (list.length < want) {
      const i = list.length;
      list.push({ i, x: home.x - 60 + i * 40, y: home.y, state: 'idle', t: 0, walk: 0, face: 1, target: null, load: [], dest: null });
    }
    for (const h of list) {
      if (h.state === 'idle') {
        h.t -= dt;
        if (h.t > 0) continue;
        h.t = 0.5;
        if (h.load.length >= BAG) { h.state = 'drop'; continue; }
        let best = null, bd = Infinity;
        for (const n of nodes) {
          if (!types.includes(n.type) || n.fruit < 1 || !workerDrop(cropOf(n)) || list.some(o => o !== h && o.target === n)) continue;
          const d = Math.hypot(n.x - h.x, n.y - h.y);
          if (d < bd) { bd = d; best = n; }
        }
        if (best) { h.target = best; h.state = 'go'; }
        else if (h.load.length) h.state = 'drop';
        else h.state = 'home';
      } else if (h.state === 'home') {
        h.walk += dt * 9; h.face = home.x - 60 + h.i * 40 >= h.x ? 1 : -1;
        if (moveEntity(h, home.x - 60 + h.i * 40, home.y, 150, dt) < 3) { h.walk = 0; h.state = 'idle'; h.t = 1; }
        else if ((h.t -= dt) <= 0) { h.t = 0; h.state = 'idle'; }
      } else if (h.state === 'go') {
        const n = h.target;
        if (!n || n.fruit < 1) { h.state = 'idle'; h.target = null; continue; }
        const d = moveEntity(h, n.x + 22, n.y + 14, 170, dt);
        h.walk += dt * 9; h.face = n.x >= h.x ? 1 : -1;
        if (d < 4) { h.state = 'pick'; h.t = 0.7; }
      } else if (h.state === 'pick') {
        h.t -= dt; h.walk += dt * 14;
        if (h.t <= 0) {
          const n = h.target;
          if (n && n.fruit >= 1) {
            const k = cropOf(n), amt = yieldOf(n);
            for (let i = 0; i < amt; i++) h.load.push(k);
            pickCrop(n, () => { const [x, y] = toScreen(h.x, h.y); return [x - 15 * h.face, y - 26 - Math.min(h.load.length, 8) * 5]; }, null);
          }
          h.target = null; h.state = 'idle'; h.t = 0.3; h.walk = 0;
        }
      } else if (h.state === 'drop') {
        if (!h.load.length) { h.state = 'idle'; h.dest = null; continue; }
        if (!h.dest || !h.dest.on()) h.dest = h.load.map(workerDrop).find(Boolean) || null;
        if (!h.dest) { h.t = 1; h.state = 'wait'; continue; }
        const tx = h.dest.z.x - 30 + (h.i % 3) * 30, ty = h.dest.z.y;
        h.walk += dt * 9; h.face = tx >= h.x ? 1 : -1;
        if (moveEntity(h, tx, ty, 170, dt) < 4) { h.state = 'unload'; h.t = 0; h.walk = 0; }
      } else if (h.state === 'unload') {
        h.t -= dt;
        if (h.t > 0) continue;
        h.t = 0.12;
        const D = h.dest, i = D ? h.load.findIndex(k => D.take(k)) : -1;
        if (i < 0) { h.dest = null; h.state = h.load.length ? 'drop' : 'idle'; h.t = 0.3; continue; }
        const k = h.load.splice(i, 1)[0], [to, done] = D.send(k);
        const [x, y] = toScreen(h.x, h.y);
        fly(k, [x - 15 * h.face, y - 30], to, 0.4, done);
      } else if (h.state === 'wait') {
        // nowhere has room: wait a moment, then look again
        if ((h.t -= dt) <= 0) h.state = 'drop';
      }
    }
  }
  function updateOrchard(dt) {
    updateCrops(dt);
    if (level.orchard) updateWorkers(pickers, level.pickers, ['apple'], { x: PRESS.x - 100, y: PRESS.front + 60 }, dt);
    if (FARMLAND() && level.fields) updateWorkers(hands, level.hands, ['corn', 'hen'], HANDS_HOME, dt);
    updateFarm(dt);
    if (!level.orchard) return;
""" + s[b:]

# grist mill and bakery
rep("""  // market hall shoppers: walk in from the east road, line up, buy, pay, walk back out""",
    """  // grist mill: corn → cornmeal, sent on to the bakery.  bakery: cornmeal + an egg → cornbread, sent to the market
  function updateFarm(dt) {
    if (level.grist) {
      if (grist.corn > 0 && grist.meal < MEAL_CAP) {
        grist.t += dt * boost();
        if (grist.t >= gristTime()) { grist.t = 0; grist.corn--; grist.meal++; }
      }
      timers.meal = (timers.meal || 0) - dt;
      if (level.bakery && grist.meal > 0 && timers.meal <= 0 && bakery.meal + mpend.bmeal < bakeCap()) {
        timers.meal = 0.35; grist.meal--; mpend.bmeal++;
        fly('meal', gristOutSpot, bakeInSpot, 1.3, () => { mpend.bmeal--; bakery.meal++; }, 120);
      }
    }
    if (level.bakery) {
      if (bakery.meal >= 1 && bakery.eggs >= 1 && bakery.out < BREAD_CAP) {
        bakery.t += dt * boost();
        if (bakery.t >= bakeTime()) { bakery.t = 0; bakery.meal--; bakery.eggs--; bakery.out++; }
      }
      timers.bread = (timers.bread || 0) - dt;
      if (level.market && bakery.out > 0 && timers.bread <= 0 && mktRoom('bread')) {
        timers.bread = 0.35; bakery.out--; mpend.bread++;
        fly('bread', bakeOutSpot, mktSpot('bread'), 1.7, () => { mpend.bread--; mstock.bread++; }, 180);
      }
    }
  }
  // market hall shoppers: walk in from the east road, line up, buy, pay, walk back out""")
rep("""  const mktSpot = kind => () => { const [x, y] = toScreen(MARKET.x + (kind === 'cider' ? -70 : 70), MARKET.front - 30); return [x, y - 40]; };""",
    """  const mktSpot = kind => () => {
    const ks = MKT_KINDS(), i = Math.max(0, ks.indexOf(kind)), w = MARKET.w / ks.length;
    const [x, y] = toScreen(MARKET.x - MARKET.w / 2 + w * (i + 0.5), MARKET.front - 30); return [x, y - 40];
  };""")
rep("""          const opts = [['cider', 2], ['apple', 1]].filter(([k]) => mstock[k] > 0);""",
    """          const opts = MKT_KINDS().filter(k => mstock[k] > 0).map(k => [k, MKT_WEIGHT[k]]);""")

# growth: corn ripens, hens lay and wander
rep("""      else if (node.type === 'apple' && node.fruit < 1) node.fruit = Math.min(1, node.fruit + dt * rGrowth() / ripeTime());""",
    """      else if (node.type === 'apple' && node.fruit < 1) node.fruit = Math.min(1, node.fruit + dt * rGrowth() / ripeTime());
      else if (node.type === 'corn' && node.fruit < 1) node.fruit = Math.min(1, node.fruit + dt * rGrowth() / cornTime());
      else if (node.type === 'hen') {
        if (node.fruit < 1) node.fruit = Math.min(1, node.fruit + dt * rGrowth() / layTime());
        // hens peck about the yard, and sit on the nest once an egg is ready
        if (node.fruit < 1) {
          node.t -= dt;
          if (node.t <= 0) { node.t = 2 + Math.random() * 4; node.tx = HENYARD.x0 + 30 + Math.random() * (HENYARD.x1 - HENYARD.x0 - 60); node.ty = HENYARD.y0 + 65 + Math.random() * (HENYARD.y1 - HENYARD.y0 - 85); }
          const dx = node.tx - node.x, dy = node.ty - node.y, d = Math.hypot(dx, dy);
          if (d > 2) { const st = Math.min(d, 38 * dt); node.x += dx / d * st; node.y += dy / d * st; node.walk += dt * 12; if (Math.abs(dx) > 1) node.face = Math.sign(dx); }
        }
      }""")

# ---------- HUD ----------
rep("""    ui.sap.textContent = carried.sap;
""", """    ui.sap.textContent = carried.sap;
    ui.crops.textContent = carried.apple + carried.corn + carried.egg;
    ui.chipCrops.hidden = !(level.orchard || level.fields || carried.apple + carried.corn + carried.egg);
""")
rep("      const chip = { logs: ui.chipLogs, sap: ui.chipSap, cash: ui.chipCash }[bump];",
    "      const chip = { logs: ui.chipLogs, sap: ui.chipSap, cash: ui.chipCash, crops: ui.chipCrops }[bump];")

# ---------- guide arrow ----------
rep("""    const onZone = inRect(DROP, DROP.w, DROP.d) || inRect(SAW_IN, SAW_IN.w, SAW_IN.d) || inRect(SHACK_IN, SHACK_IN.w, SHACK_IN.d);
    if (stack.includes('sap') && level.shack && !onZone) target = [SHACK_IN.x, SHACK_IN.y, 30];
    else if (stack.some(k => k !== 'sap') && !onZone) target = [DROP.x, DROP.y, 30];""",
    """    const onZone = inRect(DROP, DROP.w, DROP.d) || inRect(SAW_IN, SAW_IN.w, SAW_IN.d) || inRect(SHACK_IN, SHACK_IN.w, SHACK_IN.d) ||
      DROPS.some(D => D.on() && inRect(D.z, D.z.w, D.z.d));
    const crop = [...stack].reverse().find(k => CROPS.includes(k)), cropTo = crop && workerDrop(crop);
    if (stack.includes('sap') && level.shack && !onZone) target = [SHACK_IN.x, SHACK_IN.y, 30];
    else if (stack.some(k => k !== 'sap' && !CROPS.includes(k)) && !onZone) target = [DROP.x, DROP.y, 30];
    else if (cropTo && !onZone) target = [cropTo.z.x, cropTo.z.y, 30];""")

# ---------- zones ----------
rep("""    zone(DROP, 'RESTOCK', inRect(DROP, DROP.w, DROP.d) && stack.length);""",
    """    zone(DROP, 'RESTOCK', inRect(DROP, DROP.w, DROP.d) && stack.some(k => !CROPS.includes(k)));
    const zLabel = { [PRESS_IN.y]: NAMES.press.toUpperCase(), [MKT_IN.y]: 'MARKET', [GRIST_IN.y]: 'GRIST MILL', [BAKE_IN.y]: 'BAKERY' };
    for (const D of DROPS) if (D.on()) zone(D.z, zLabel[D.z.y], inRect(D.z, D.z.w, D.z.d) && stack.some(k => D.kinds.includes(k)));""")

# ---------- districts ----------
rep("""        if (!level.press) dashedPlot(PRESS.x, PRESS.front - PRESS.d / 2, PRESS.w, PRESS.d, `${NAMES.press} plot`);
      }""", """        if (!level.press) dashedPlot(PRESS.x, PRESS.front - PRESS.d / 2, PRESS.w, PRESS.d, `${NAMES.press} plot`);
      }
      if (id === 'fields') {
        ctx.fillStyle = 'rgba(110,70,30,.3)';
        for (let r = 0; r < CORN.rows; r++) { groundRect(CORN.x + 5, CORN.y + (r - (CORN.rows - 1) / 2) * CORN.rowGap + 2, CORN.cols * CORN.gap + 30, 26, 10); ctx.fill(); }
        // hen yard: straw on the ground and a low fence
        const hx = (HENYARD.x0 + HENYARD.x1) / 2, hy = (HENYARD.y0 + HENYARD.y1) / 2, hw = HENYARD.x1 - HENYARD.x0, hd = HENYARD.y1 - HENYARD.y0;
        ctx.fillStyle = 'rgba(226,196,120,.6)'; groundRect(hx, hy, hw, hd, 16); ctx.fill();
        ctx.strokeStyle = '#8a6a43'; ctx.lineWidth = 2.5; groundRect(hx, hy, hw, hd, 6); ctx.stroke();
        ctx.fillStyle = '#6b4c2e';
        for (let x = HENYARD.x0; x <= HENYARD.x1; x += 35) for (const y of [HENYARD.y0, HENYARD.y1]) { const [px, py] = toScreen(x, y); ctx.fillRect(px - 2, py - 12, 4, 12); }
        for (let y = HENYARD.y0; y <= HENYARD.y1; y += 35) for (const x of [HENYARD.x0, HENYARD.x1]) { const [px, py] = toScreen(x, y); ctx.fillRect(px - 2, py - 12, 4, 12); }
        if (!level.coop) dashedPlot(COOP.x, COOP.front - COOP.d / 2, COOP.w + 30, COOP.d + 20, 'Coop plot');
        if (!level.grist) dashedPlot(GRIST.x, GRIST.front - GRIST.d / 2, GRIST.w, GRIST.d, 'Grist Mill plot');
        if (!level.bakery) dashedPlot(BAKERY.x, BAKERY.front - BAKERY.d / 2, BAKERY.w, BAKERY.d, 'Bakery plot');
      }""")

# ---------- buildings ----------
rep("""    { key: 'press', B: PRESS, ids: ['press'],""",
    """    { key: 'grist', B: GRIST, ids: ['grist'], wall: '#d9c9a5', roof: '#7a5a3a', floor: '#a98a62', H: 70, door: 70, draw: () => drawGristMill(), top: gristSails },
    { key: 'bakery', B: BAKERY, ids: ['bakery'], wall: '#e9d8b4', roof: '#a5483a', floor: '#c9b48a', H: 66, door: 70, draw: () => drawBakeryIn(), top: bakeChimney },
    { key: 'press', B: PRESS, ids: ['press'],""")

# ---------- render list ----------
rep("""add(n.y, () => n.type === 'maple' ? drawMaple(n) : n.type === 'apple' ? drawAppleTree(n) : drawTree(n));""",
    """add(n.y, () => n.type === 'maple' ? drawMaple(n) : n.type === 'apple' ? drawAppleTree(n) : n.type === 'corn' ? drawCorn(n) : n.type === 'hen' ? drawHen(n) : drawTree(n));""")
rep("""    for (const h of pickers) if (onScreen(h.x, h.y, 60)) add(h.y, () => drawPicker(h));""",
    """    for (const h of pickers) if (onScreen(h.x, h.y, 60)) add(h.y, () => drawPicker(h));
    for (const h of hands) if (onScreen(h.x, h.y, 60)) add(h.y, () => drawPicker(h, true));
    if (level.coop && FARMLAND() && onScreen(COOP.x, COOP.front, 120)) add(COOP.front, drawCoop);""")

# ---------- drawing ----------
rep("""  const ITEM_DRAW = { apple: drawAppleItem, cider: drawCiderItem,""",
    """  const ITEM_DRAW = { apple: drawAppleItem, cider: drawCiderItem, corn: drawCornItem, egg: drawEggItem, meal: drawMealItem, bread: drawBreadItem,""")
rep("""  function drawPicker(h) {
    const [sx, sy] = toScreen(h.x, h.y);
    drawPerson(sx, sy, { walk: h.walk, face: h.face, shirt: '#5a9642', skin: ['#8d5a3b', '#c68e62', '#6b4127'][h.i % 3], hair: '#16120f', hat: '#c9a35a', pants: '#3d5a8a',
      arms: h.state === 'pick' ? 'work' : true, before: () => { ctx.fillStyle = '#a0703f'; roundRect(-16, -26, 10, 9, 2); ctx.fill(); } });
  }""", """  function drawPicker(h, farmHand) {
    const [sx, sy] = toScreen(h.x, h.y);
    drawPerson(sx, sy, { walk: h.walk, face: h.face, shirt: farmHand ? '#c9a35a' : '#5a9642', skin: ['#8d5a3b', '#c68e62', '#6b4127'][h.i % 3], hair: '#16120f',
      hat: farmHand ? '#e8cf7a' : '#c9a35a', pants: farmHand ? '#5a4630' : '#3d5a8a',
      arms: h.state === 'pick' ? 'work' : true, before: () => {
        ctx.fillStyle = '#a0703f'; roundRect(-20, -26, 12, 9, 2); ctx.fill();
        for (let i = 0; i < Math.min(h.load.length, 8); i++) drawItem(h.load[i], -14, -26 - i * 5);
      } });
  }""")
rep("""      for (let i = 0; i < Math.min(mstock.cider, 24); i++) drawCiderItem(sx - hw + 22 + (i % 12) * 10, sy - back - 42 + Math.floor(i / 12) * 26);
      for (let i = 0; i < Math.min(mstock.apple, 24); i++) drawAppleItem(sx + 22 + (i % 12) * 10, sy - back - 42 + Math.floor(i / 12) * 26);""",
    """      const ks = MKT_KINDS(), secW = B.w / ks.length, per = Math.max(3, Math.floor((secW - 14) / 10));
      ks.forEach((k, j) => {
        const x0 = sx - hw + j * secW + 12;
        for (let i = 0; i < Math.min(mstock[k], per * 2); i++) drawItem(k, x0 + (i % per) * 10, sy - back - 42 + Math.floor(i / per) * 26);
      });""")
rep("""      tag(`${mstock.cider}/${mktCap()} ${ITEM_NAME.cider.toLowerCase()} · ${mstock.apple}/${mktCap()} ${ITEM_NAME.apple.toLowerCase()}`, sx, top - 50, 13, '#fffaf0');""",
    """      tag(ks.map(k => `${mstock[k]} ${ITEM_NAME[k].toLowerCase()}`).join(' · ') + ` · max ${mktCap()} each`, sx, top - 50, 13, '#fffaf0');""")

rep("""  function pressChimney(sx, sy, back, H) {""", r"""  function drawCornItem(x, y) {
    ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.ellipse(x, y - 5, 3.4, 6.4, 0.35, 0, Math.PI * 2); ctx.fill(); outline(1.1);
    ctx.fillStyle = 'rgba(170,120,30,.45)'; ctx.fillRect(x - 0.6, y - 10, 1.2, 9);
    ctx.fillStyle = '#6aa843'; ctx.beginPath(); ctx.moveTo(x - 1, y + 2); ctx.quadraticCurveTo(x + 7, y - 1, x + 6, y - 10); ctx.quadraticCurveTo(x + 3, y - 3, x - 3, y); ctx.closePath(); ctx.fill();
  }
  function drawEggItem(x, y) {
    ctx.fillStyle = '#f7efe0'; ctx.beginPath(); ctx.ellipse(x, y - 4, 3.6, 4.7, 0, 0, Math.PI * 2); ctx.fill(); outline(1);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(x - 2, y - 7, 1.4, 1.6);
  }
  function drawMealItem(x, y) {
    ctx.fillStyle = '#eadbb2'; roundRect(x - 5, y - 10, 10, 12, 3); ctx.fill(); outline(1.1);
    ctx.fillStyle = '#c9a35a'; ctx.fillRect(x - 5, y - 10, 10, 2.5);
    ctx.fillStyle = '#e8b83a'; ctx.beginPath(); ctx.arc(x, y - 3.5, 1.9, 0, Math.PI * 2); ctx.fill();
  }
  function drawBreadItem(x, y) {
    ctx.fillStyle = '#e0a23a'; roundRect(x - 6, y - 8, 12, 9, 3.5); ctx.fill(); outline(1.1);
    ctx.fillStyle = '#f2c46a'; ctx.fillRect(x - 4.5, y - 7, 9, 2);
    ctx.strokeStyle = 'rgba(120,70,20,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); for (const dx of [-2.5, 0.5, 3.5]) { ctx.moveTo(x + dx, y - 6.5); ctx.lineTo(x + dx - 1.5, y - 1.5); } ctx.stroke();
  }
  function drawCorn(n) {
    const [sx, sy] = toScreen(n.x, n.y), ripe = n.fruit >= 1, h = 16 + Math.min(1, n.fruit) * 36;
    const wob = Math.sin(n.shake * 30) * n.shake * 3 + Math.sin(performance.now() / 900 + n.seed * 9) * 1.2;
    ctx.fillStyle = 'rgba(30,40,20,.14)'; ctx.beginPath(); ctx.ellipse(sx + 3, sy + 1, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = ripe ? '#8f9a3a' : '#4f8f36'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + wob * 0.5, sy - h * 0.5, sx + wob, sy - h); ctx.stroke();
    ctx.fillStyle = ripe ? '#a3b04a' : '#62ad48';
    for (const [t, dir] of [[0.28, -1], [0.48, 1], [0.68, -1], [0.85, 1]]) {
      if (t * h < 9) continue;
      const lx = sx + wob * t, ly = sy - h * t;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.quadraticCurveTo(lx + dir * 12, ly - 9, lx + dir * 17, ly + 1); ctx.quadraticCurveTo(lx + dir * 8, ly - 2, lx, ly + 3); ctx.closePath(); ctx.fill();
    }
    if (ripe) {   // a fat cob and a golden tassel
      ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.ellipse(sx + wob * 0.6 + 5, sy - h * 0.58, 3.8, 8.5, 0.35, 0, Math.PI * 2); ctx.fill(); outline(1);
      ctx.fillStyle = '#7fb04a'; ctx.beginPath(); ctx.moveTo(sx + wob * 0.6 + 1, sy - h * 0.46); ctx.quadraticCurveTo(sx + wob * 0.6 + 10, sy - h * 0.5, sx + wob * 0.6 + 9, sy - h * 0.72); ctx.quadraticCurveTo(sx + wob * 0.6 + 4, sy - h * 0.55, sx + wob * 0.6 + 1, sy - h * 0.46); ctx.fill();
      ctx.strokeStyle = '#e8c65a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); for (const a of [-0.6, 0, 0.6]) { ctx.moveTo(sx + wob, sy - h); ctx.lineTo(sx + wob + Math.sin(a) * 7, sy - h - 8); } ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  function drawHen(n) {
    const [sx, sy] = toScreen(n.x, n.y), sit = n.fruit >= 1, f = n.face || 1, bob = sit ? 0 : Math.abs(Math.sin(n.walk || 0)) * 2;
    ctx.fillStyle = 'rgba(30,40,20,.16)'; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (sit) {   // straw nest with eggs peeking out
      ctx.fillStyle = '#d9b45a'; ctx.beginPath(); ctx.ellipse(sx, sy - 2, 15, 6, 0, 0, Math.PI * 2); ctx.fill(); outline(1.2);
      drawEggItem(sx - 9, sy + 1); drawEggItem(sx + 10, sy + 1);
    } else {
      ctx.strokeStyle = '#d98a2a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(sx - 2, sy - 7); ctx.lineTo(sx - 3, sy); ctx.moveTo(sx + 2, sy - 7); ctx.lineTo(sx + 3, sy); ctx.stroke();
    }
    const body = n.seed < 0.5 ? '#fbf6ec' : '#b5652e';
    ctx.save(); ctx.translate(sx, sy - (sit ? 9 : 13) - bob); ctx.scale(f, 1);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-14, -10); ctx.lineTo(-5, -6); ctx.closePath(); ctx.fill(); outline(1.1);
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2); ctx.fill(); outline(1.3);
    ctx.beginPath(); ctx.arc(8, -7, 4.6, 0, Math.PI * 2); ctx.fill(); outline(1.2);
    ctx.fillStyle = shade(body, -0.12); ctx.beginPath(); ctx.ellipse(-1, 0, 5, 3.5, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9382b'; ctx.beginPath(); ctx.arc(7.5, -12, 2.2, 0, Math.PI * 2); ctx.arc(10, -11.2, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8a23a'; ctx.beginPath(); ctx.moveTo(12, -8); ctx.lineTo(16, -6.5); ctx.lineTo(12, -5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b2a22'; ctx.fillRect(9, -8.6, 1.6, 1.6);
    ctx.restore();
  }
  function drawCoop() {
    const B = COOP, [sx, sy] = toScreen(B.x, B.front), hw = B.w / 2, H = 46, base = sy - 14;
    ctx.fillStyle = 'rgba(30,40,20,.14)'; roundRect(sx - hw - 6, sy - 10, B.w + 18, 16, 8); ctx.fill();
    ctx.fillStyle = '#6e4a32'; ctx.fillRect(sx - hw + 6, base, 6, 14); ctx.fillRect(sx + hw - 12, base, 6, 14);
    ctx.fillStyle = '#c4472b'; ctx.fillRect(sx - hw, base - H, B.w, H);
    ctx.fillStyle = 'rgba(0,0,0,.09)'; for (let x = sx - hw + 9; x < sx + hw; x += 10) ctx.fillRect(x, base - H, 1.5, H);
    ctx.beginPath(); ctx.rect(sx - hw, base - H, B.w, H); outline(2);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(sx - hw, base - 4, B.w, 4);
    ctx.fillStyle = '#5f646c'; ctx.beginPath(); ctx.moveTo(sx - hw - 8, base - H + 2); ctx.lineTo(sx, base - H - 30); ctx.lineTo(sx + hw + 8, base - H + 2); ctx.closePath(); ctx.fill(); outline(2);
    if (LOOK() === 'snow') { ctx.fillStyle = '#f6f9fb'; ctx.beginPath(); ctx.moveTo(sx - hw - 4, base - H - 2); ctx.lineTo(sx, base - H - 30); ctx.lineTo(sx + hw + 4, base - H - 2); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#3a2618'; roundRect(sx - 9, base - 26, 18, 26, 8); ctx.fill();
    ctx.fillStyle = '#fff3a6'; ctx.fillRect(sx + 16, base - H + 10, 13, 11); ctx.beginPath(); ctx.rect(sx + 16, base - H + 10, 13, 11); outline(1.4);
    ctx.strokeStyle = '#a0703f'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sx, base); ctx.lineTo(sx + 16, sy + 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,40,20,.5)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 1; k < 4; k++) { ctx.moveTo(sx + k * 4 - 3, base + k * 5.5 - 2); ctx.lineTo(sx + k * 4 + 3, base + k * 5.5 - 4); } ctx.stroke();
  }
  function drawGristMill() {
    const [sx, sy] = toScreen(GRIST.x, GRIST.front), back = GRIST.d * TILT, busy = grist.corn > 0 && grist.meal < MEAL_CAP;
    ctx.fillStyle = '#8a5a2e'; roundRect(sx - 76, sy - back * 0.55 - 6, 44, 24, 4); ctx.fill(); outline(1.4);
    for (let i = 0; i < Math.min(grist.corn, 12); i++) drawCornItem(sx - 69 + (i % 4) * 9, sy - back * 0.55 - 2 - Math.floor(i / 4) * 6);
    const turn = busy ? performance.now() / 400 : 0, my = sy - back * 0.5;
    ctx.fillStyle = '#8f8b80'; ctx.beginPath(); ctx.ellipse(sx - 4, my - 6, 26, 11, 0, 0, Math.PI * 2); ctx.fill(); outline(1.6);
    ctx.fillStyle = '#b9b4a8'; ctx.beginPath(); ctx.ellipse(sx - 4, my - 15, 24, 10, 0, 0, Math.PI * 2); ctx.fill(); outline(1.6);
    ctx.strokeStyle = 'rgba(60,60,60,.45)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let k = 0; k < 4; k++) { const a = turn + k * Math.PI / 2; ctx.moveTo(sx - 4, my - 15); ctx.lineTo(sx - 4 + Math.cos(a) * 21, my - 15 + Math.sin(a) * 8.5); }
    ctx.stroke();
    worker(sx + 30, my, '#3d7cc9', busy, '#6b4127');
    for (let i = 0; i < Math.min(grist.meal, 8); i++) drawMealItem(sx + 46 + (i % 4) * 10, sy - 8 - Math.floor(i / 4) * 13);
    tag(`${grist.corn} ${ITEM_NAME.corn.toLowerCase()} → ${grist.meal} ${ITEM_NAME.meal.toLowerCase()}`, sx, sy - back - 132, 13, '#fffaf0');
  }
  function gristSails(sx, sy, back, H) {
    const a = grist.corn > 0 && grist.meal < MEAL_CAP ? performance.now() / 700 : 0.4, cy = sy - back - H - 22;
    ctx.fillStyle = '#7a4f2c'; ctx.fillRect(sx - 5, cy, 10, 22);
    for (let k = 0; k < 4; k++) {
      ctx.save(); ctx.translate(sx, cy); ctx.rotate(a + k * Math.PI / 2);
      ctx.fillStyle = '#6e4a32'; ctx.fillRect(-2, -62, 4, 62);
      ctx.fillStyle = '#efe2c4'; ctx.beginPath(); ctx.rect(2, -60, 14, 44); ctx.fill(); outline(1.3);
      ctx.strokeStyle = 'rgba(110,80,40,.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); for (let y = -52; y < -16; y += 9) { ctx.moveTo(2, y); ctx.lineTo(16, y); } ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#5f646c'; ctx.beginPath(); ctx.arc(sx, cy, 6, 0, Math.PI * 2); ctx.fill(); outline(1.4);
  }
  function drawBakeryIn() {
    const [sx, sy] = toScreen(BAKERY.x, BAKERY.front), back = BAKERY.d * TILT, oy = sy - back * 0.5;
    const busy = bakery.meal >= 1 && bakery.eggs >= 1 && bakery.out < BREAD_CAP;
    // brick oven with a fire when it's baking
    ctx.fillStyle = '#b5583a';
    ctx.beginPath(); ctx.moveTo(sx - 92, oy); ctx.lineTo(sx - 92, oy - 26); ctx.arc(sx - 64, oy - 26, 28, Math.PI, 0); ctx.lineTo(sx - 36, oy); ctx.closePath(); ctx.fill(); outline(1.8);
    ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1; ctx.beginPath(); for (let y = oy - 8; y > oy - 44; y -= 9) { ctx.moveTo(sx - 90, y); ctx.lineTo(sx - 38, y); } ctx.stroke();
    ctx.fillStyle = busy ? `rgb(255,${150 + Math.round(Math.sin(performance.now() / 120) * 40)},60)` : '#3a2618';
    ctx.beginPath(); ctx.moveTo(sx - 76, oy - 2); ctx.lineTo(sx - 76, oy - 12); ctx.arc(sx - 64, oy - 12, 12, Math.PI, 0); ctx.lineTo(sx - 52, oy - 2); ctx.closePath(); ctx.fill();
    // eggs and cornmeal waiting
    ctx.fillStyle = '#a0703f'; roundRect(sx - 26, oy - 8, 34, 14, 5); ctx.fill(); outline(1.3);
    for (let i = 0; i < Math.min(bakery.eggs, 8); i++) drawEggItem(sx - 21 + (i % 4) * 8, oy - 4 - Math.floor(i / 4) * 5);
    for (let i = 0; i < Math.min(bakery.meal, 6); i++) drawMealItem(sx + 16 + (i % 3) * 10, oy - Math.floor(i / 3) * 12);
    worker(sx - 2, oy + 10, '#fffaf0', busy, '#8d5a3b');
    // cooling rack of cornbread
    ctx.fillStyle = '#8a5a2e'; ctx.fillRect(sx + 52, sy - 30, 52, 4); ctx.fillRect(sx + 52, sy - 14, 52, 4);
    ctx.fillRect(sx + 52, sy - 34, 3, 30); ctx.fillRect(sx + 101, sy - 34, 3, 30);
    for (let i = 0; i < Math.min(bakery.out, 8); i++) drawBreadItem(sx + 60 + (i % 4) * 12, sy - 31 + Math.floor(i / 4) * 16);
    tag(`${bakery.meal} ${ITEM_NAME.meal.toLowerCase()} + ${bakery.eggs} ${ITEM_NAME.egg.toLowerCase()} → ${bakery.out} ${ITEM_NAME.bread.toLowerCase()}`, sx, sy - back - 86, 13, '#fffaf0');
  }
  function bakeChimney(sx, sy, back, H) {
    ctx.fillStyle = '#9a4a32'; ctx.fillRect(sx - 72, sy - back - H - 34, 16, 30);
    if (bakery.meal >= 1 && bakery.eggs >= 1) smoke(sx - 64, sy - back - H - 38, 'rgba(255,255,255,', 2);
  }
  function pressChimney(sx, sy, back, H) {""")

# ---------- saving: one town per map ----------
rep("""      press: { apples: press.apples, out: press.out }, mstock: { ...mstock },""",
    """      press: { apples: press.apples, out: press.out }, mstock: { ...mstock },
      grist: { corn: grist.corn, meal: grist.meal }, bakery: { meal: bakery.meal, eggs: bakery.eggs, out: bakery.out }, others: mapSaves,""")
rep("""      hp: nodes.map(n => n.type === 'maple' ? Math.round(n.sap * 100) / 100 : n.type === 'apple' ? Math.round(n.fruit * 100) / 100 : n.hp),""",
    """      hp: nodes.map(n => n.type === 'maple' ? Math.round(n.sap * 100) / 100 : n.fruit !== undefined ? Math.round(n.fruit * 100) / 100 : n.hp),""")
rep("""    merge(press, d.press); merge(mstock, d.mstock); mpend.press = mpend.cider = mpend.apple = 0; pickers = []; shoppers = [];""",
    """    for (const k in mstock) mstock[k] = 0;
    for (const o of [press, grist, bakery]) for (const k in o) o[k] = 0;
    merge(press, d.press); merge(mstock, d.mstock); merge(grist, d.grist); merge(bakery, d.bakery);
    for (const k in mpend) mpend[k] = 0;
    pickers = []; shoppers = []; hands = [];
    if (d.others) mapSaves = d.others;""")
rep("""    for (const k of ['wood', 'oak', 'redwood', 'sap']) for (let i = 0; i < carried[k]; i++) stack.push(k);
    ensureYard();""", """    for (const k of ['wood', 'oak', 'redwood', 'sap', ...CROPS]) for (let i = 0; i < carried[k]; i++) stack.push(k);
    makeNodes(); ensureYard();   // rebuild trees from scratch: the last map may have had more yard, orchard or farm""")
rep("""      d.hp.forEach((v, i) => { if (nodes[i].type === 'maple') nodes[i].sap = v; else if (nodes[i].type === 'apple') nodes[i].fruit = v || 0; else""",
    """      d.hp.forEach((v, i) => { if (nodes[i].type === 'maple') nodes[i].sap = v; else if (nodes[i].fruit !== undefined) nodes[i].fruit = v || 0; else""")
# carried keys that a save doesn't have start at zero
rep("""    merge(carried, d.carried); merge(stock, d.stock);""", """    for (const k in carried) carried[k] = 0;
    merge(carried, d.carried); merge(stock, d.stock);""")

# moving and switching maps
a = s.index("  function moveMap() {")
b = s.index("  const BASE_NAMES = { ...ITEM_NAME }")
s = s[:a] + """  // every map keeps its own town; the one you're on lives in the normal save, the rest in mapSaves
  let mapSaves = {};
  function resetTransient() {
    fx.length = 0; belt = []; research = null; gather.node = null; moveAsk = false;
    const zero = o => { for (const k in o) { if (typeof o[k] === 'number') o[k] = 0; else if (o[k] && typeof o[k] === 'object') zero(o[k]); } };
    zero(pending); zero(pendingV); kilnPend = 0;
    event.kind = null; event.next = 120;
  }
  const playedHere = () => stats.earned > 0 || UPGRADES.some(u => level[u.id] > 0);
  function goMap(i, keepCur = true) {
    if (!FRESH || i === prestige.map) return;
    if (keepCur && playedHere()) { const cur = snapshot(); delete cur.others; mapSaves[prestige.map] = cur; }
    const d = JSON.parse(JSON.stringify(mapSaves[i] || { ...FRESH, savedAt: Date.now() }));
    delete mapSaves[i];
    d.prestige = { ...prestige, map: i };
    resetTransient();
    applySave(d);
    toast(`Welcome to ${MAP().name}!`);
    save(true);
  }
  function moveMap() {
    const g = moveGain();
    if (!g || !FRESH) return;
    const d = JSON.parse(JSON.stringify(FRESH));
    for (const u of UPGRADES) if (u.research) d.level[u.id] = level[u.id];
    d.level.dispatch = level.dispatch;
    d.dispatch = JSON.parse(JSON.stringify(dispatch));
    const cur = prestige.map, next = Math.min(MAPS.length - 1, cur + 1);
    prestige.bonus = Math.round((prestige.bonus + g) * 100) / 100; prestige.moves++;
    delete mapSaves[cur];                   // this town is sold: it starts over if you come back
    if (next !== cur && mapSaves[next]) goMap(next, false);
    else {
      d.prestige = { ...prestige, map: next }; d.savedAt = Date.now();
      resetTransient();
      applySave(d);
      save(true);
    }
    toast(`Welcome to ${MAP().name}! Income bonus ${pct(prestige.bonus)}`);
  }
  // the map picker: shown on a brand-new game, and any time from the Maps button
  const picker = document.getElementById('picker'), pickerList = document.getElementById('picker-list'), pickerClose = document.getElementById('picker-close');
  function openPicker(first) {
    pickerList.innerHTML = MAPS.map((m, i) => {
      const here = i === prestige.map, sv = mapSaves[i];
      const status = here ? (first ? 'Selected' : 'You are here') : sv ? `Your town · $${Math.floor((sv.stats && sv.stats.earned) || 0).toLocaleString()} earned` : 'New town';
      return `<button type="button" class="map-opt${here ? ' here' : ''}" data-map="${i}">` +
        `<i class="sw" style="background:linear-gradient(135deg, ${m.ground[0]} 0 50%, ${m.tree.oak[3]} 50% 72%, ${m.sea} 72%)"></i>` +
        `<span class="mo"><b>${m.name}</b><span>${m.blurb}</span><span><em>${status}</em> · prices ×${m.price}</span></span></button>`;
    }).join('');
    pickerClose.textContent = first ? `Start on ${MAP().name}` : 'Close';
    picker.hidden = false;
  }
  pickerList.addEventListener('click', e => {
    const b = e.target.closest('[data-map]');
    if (!b) return;
    picker.hidden = true;
    goMap(Number(b.dataset.map));
  });
  pickerClose.addEventListener('click', () => { picker.hidden = true; });
  document.getElementById('maps-btn').addEventListener('click', () => openPicker(false));
""" + s[b:]

rep("""    FRESH = snapshot();
    if (!applySave(saved)) applySave(loadLocal());""", """    FRESH = snapshot(); delete FRESH.others;
    const had = applySave(saved) || applySave(loadLocal());
    if (!had) openPicker(true);""")
rep("""      if (d && d.savedAt > loadedAt) applySave(JSON.parse(d.state));""",
    """      if (d && d.savedAt > loadedAt) { applySave(JSON.parse(d.state)); picker.hidden = true; }""")

p.write_text(s)
print('ok', len(s))
