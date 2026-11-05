# One-off patch: map events (market day / snowstorm / tourist boats), apple orchard + cider house, Market Hall.
import pathlib
root = pathlib.Path(__file__).parent.parent
p = root / 'src/game.js'
s = p.read_text()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)

# ---------- items, prices ----------
rep("chips: 'Wood chips', water: 'Water', paper: 'Paper', pellets: 'Pellets', charcoal: 'Charcoal' };",
    "chips: 'Wood chips', water: 'Water', paper: 'Paper', pellets: 'Pellets', charcoal: 'Charcoal', apple: 'Apples', cider: 'Cider' };")
rep("paper: 15, pellets: 8, charcoal: 7 };", "paper: 15, pellets: 8, charcoal: 7, apple: 5, cider: 22 };")

# ---------- layout: orchard district, road, cider house, market hall, cash pile ----------
rep("    harbor: { ...P(1250, -1400), r: 52 }, village: { ...P(-1180, -540), r: 46 } };",
    "    harbor: { ...P(1250, -1400), r: 52 }, village: { ...P(-1180, -540), r: 46 }, market: { ...P(1010, 450), r: 46 } };")
rep("    village: { name: 'Pine Village', x0: CX - 2080, x1: CX - 1220, y0: CY - 1500, y1: CY - 620, ground: '#9fb87a' },\n  };",
    "    village: { name: 'Pine Village', x0: CX - 2080, x1: CX - 1220, y0: CY - 1500, y1: CY - 620, ground: '#9fb87a' },\n"
    "    orchard: { name: 'Apple Orchard', x0: CX - 2080, x1: CX - 1300, y0: CY + 620, y1: CY + 1460, ground: '#a3bf72' },\n  };")
rep("    { x0: CX - 1230, x1: CX - 1070, y0: CY - 700, y1: CY - 590 },\n  ];",
    "    { x0: CX - 1230, x1: CX - 1070, y0: CY - 700, y1: CY - 590 },\n    { x0: CX - 1310, x1: CX - 1070, y0: CY + 930, y1: CY + 1050 },\n  ];")
rep("  const BILLBOARD = P(330, 700);\n", """  const BILLBOARD = P(330, 700);
  // apple orchard (south-west): trees in rows, a cider house at the bottom
  const ORCHARD = { x: CX - 1720, y: CY + 880, cols: 7, rows: 4, gap: 96 };
  const PRESS = { x: CX - 1560, front: CY + 1400, w: 230, d: 100 };
  // market hall: a second shop east of the store, with its own shoppers
  const MARKET = { x: CX + 800, front: CY + 500, w: 300, d: 90 };
  const MKT_SPAWN = P(1170, 600);
""")

# ---------- upgrades + group tiles ----------
rep("""    { id: 'kilnfeed', group: 'industry',""", """    // orchard: apples → cider; market hall: a second shop that sells them
    { id: 'orchard', group: 'orchard', name: 'Apple Orchard', hire: 'Buy the Orchard', costs: [4000, 7000, 14000, 30000], note: 'Apple trees; walk past ripe ones to pick', more: 'More trees, faster ripening' },
    { id: 'press', group: 'orchard', name: 'Cider House', hire: 'Build Cider House', costs: [3000, 8000, 20000, 50000], note: 'Presses 2 apples into 1 cider', more: 'Presses faster, holds more', needs: 'orchard' },
    { id: 'pickers', group: 'orchard', name: 'Apple Pickers', hire: 'Hire a Picker', costs: [2500, 6000, 15000], note: '+1 worker who picks ripe apples', needs: 'orchard' },
    { id: 'market', group: 'market', name: 'Market Hall', hire: 'Build Market Hall', costs: [5000, 15000, 40000], note: 'Second shop: sells cider & fresh apples', more: 'Bigger shelves, more shoppers', needs: 'orchard' },
    { id: 'clerk', group: 'market', name: 'Market Clerk', hire: 'Hire a Clerk', costs: [2500, 8000, 20000], note: 'Serves shoppers faster', needs: 'market' },
    { id: 'kilnfeed', group: 'industry',""")
rep("    { id: 'move', name: 'Sell & Move', ...P(-70, 520) },",
    "    { id: 'orchard', name: 'Apple Orchard', ...P(-1190, 990) },\n    { id: 'market', name: 'Market Hall', ...P(510, 380) },\n    { id: 'move', name: 'Sell & Move', ...P(-70, 520) },")

# ---------- per-map names ----------
rep("names: { wood: 'Spruce', oak: 'Birch', redwood: 'Giant Fir', sap: 'Birch Sap', syrup: 'Birch Syrup' },\n      groups: { maple: 'Birch Sap & Syrup', reserve: 'Giant Fir Reserve', village: 'Spruce Village' },",
    "names: { wood: 'Spruce', oak: 'Birch', redwood: 'Giant Fir', sap: 'Birch Sap', syrup: 'Birch Syrup', apple: 'Cloudberries', cider: 'Berry Jam' },\n"
    "      groups: { maple: 'Birch Sap & Syrup', reserve: 'Giant Fir Reserve', village: 'Spruce Village', orchard: 'Berry Patch' },\n"
    "      ups: { orchard: 'Berry Patch', press: 'Jam Kitchen', pickers: 'Berry Pickers' },")
rep("names: { wood: 'Bamboo', oak: 'Mahogany', redwood: 'Teak', sap: 'Coconuts', syrup: 'Coconut Oil' },\n      groups: { maple: 'Coconut Grove', reserve: 'Teak Reserve', village: 'Bamboo Village' },",
    "names: { wood: 'Bamboo', oak: 'Mahogany', redwood: 'Teak', sap: 'Coconuts', syrup: 'Coconut Oil', apple: 'Oranges', cider: 'Orange Juice' },\n"
    "      groups: { maple: 'Coconut Grove', reserve: 'Teak Reserve', village: 'Bamboo Village', orchard: 'Orange Grove' },\n"
    "      ups: { orchard: 'Orange Grove', press: 'Juice Bar', pickers: 'Orange Pickers' },")
# upgrade names follow the map (Cider House → Jam Kitchen …)
rep("""  function applyMapTheme() {
    const m = MAP();""", """  const BASE_UPS = Object.fromEntries(UPGRADES.map(u => [u.id, [u.name, u.hire, u.note]]));
  function applyMapTheme() {
    const m = MAP();
    for (const u of UPGRADES) {
      const [name, hire, note] = BASE_UPS[u.id], alt = (m.ups || {})[u.id];
      u.name = alt || name; u.hire = alt && hire ? hire.replace(name.replace(/^Apple /, ''), alt).replace('the Orchard', `the ${alt}`) : hire;
      u.note = note.replace(/[Aa]pples?|[Cc]ider/g, w => { const k = /^[Aa]pple/.test(w) ? 'apple' : 'cider', t = (m.names || {})[k]; if (!t) return w; return /^[a-z]/.test(w) ? t.toLowerCase() : t; });
      NAMES[u.id] = u.name;
    }""")

# ---------- numbers ----------
rep("  const reserveSpots = () =>", """  const orchardSpots = () => [0, 8, 14, 21, 28][level.orchard];
  const ripeTime = () => [30, 30, 24, 18, 13][level.orchard];         // seconds for a tree's fruit to ripen
  const pressCap = () => [0, 30, 50, 80, 120][level.press];
  const pressTime = () => [3, 3, 2, 1.3, 0.8][level.press];           // 2 apples → 1 cider
  const PRESS_OUT_CAP = 40, APPLES_PER_TREE = 3;
  const mktCap = () => [0, 30, 60, 100][level.market];
  const mktShoppers = () => [0, 4, 6, 9][level.market];
  const clerkTime = () => [0.6, 0.4, 0.25, 0.15][level.clerk];
  const reserveSpots = () =>""")

# ---------- state ----------
rep("  const pileAmt = { store: 0, dock: 0, showroom: 0, rail: 0, harbor: 0, village: 0 };",
    "  const pileAmt = { store: 0, dock: 0, showroom: 0, rail: 0, harbor: 0, village: 0, market: 0 };\n"
    "  const press = { apples: 0, out: 0, t: 0 }, mstock = { cider: 0, apple: 0 }, mpend = { press: 0, cider: 0, apple: 0 };\n"
    "  let pickers = [], shoppers = [];\n"
    "  // map events: market day (Homestead), snowstorm (Snowy North), tourist boat (Tropical Coast)\n"
    "  const event = { kind: null, t: 0, next: 120 };")

# ---------- apple trees in ensureYard ----------
rep("""                   y: GROVE.y + (row - (GROVE.rows - 1) / 2) * 80, r: 15, sap: 0.5 + (i % 3) * 0.2, size: 1, shake: 0, seed: i / 15 });
    }
  }""", """                   y: GROVE.y + (row - (GROVE.rows - 1) / 2) * 80, r: 15, sap: 0.5 + (i % 3) * 0.2, size: 1, shake: 0, seed: i / 15 });
    }
    const appleTrees = nodes.filter(n => n.type === 'apple').length;
    for (let i = appleTrees; i < orchardSpots(); i++) {
      const row = Math.floor(i / ORCHARD.cols), col = i % ORCHARD.cols;
      nodes.push({ type: 'apple', x: ORCHARD.x + (col - (ORCHARD.cols - 1) / 2) * ORCHARD.gap + (row % 2) * 24,
                   y: ORCHARD.y + (row - (ORCHARD.rows - 1) / 2) * 105, r: 16, fruit: (i % 4) / 4, size: 1, shake: 0, seed: i / 28 });
    }
  }""")

# ---------- growth, save ----------
rep("      if (node.type === 'maple' && node.sap < 1) node.sap = Math.min(1, node.sap + dt * rGrowth() / sapTime());",
    "      if (node.type === 'maple' && node.sap < 1) node.sap = Math.min(1, node.sap + dt * rGrowth() / sapTime());\n"
    "      else if (node.type === 'apple' && node.fruit < 1) node.fruit = Math.min(1, node.fruit + dt * rGrowth() / ripeTime());")
rep("      hp: nodes.map(n => n.type === 'maple' ? Math.round(n.sap * 100) / 100 : n.hp),",
    "      hp: nodes.map(n => n.type === 'maple' ? Math.round(n.sap * 100) / 100 : n.type === 'apple' ? Math.round(n.fruit * 100) / 100 : n.hp),\n"
    "      press: { apples: press.apples, out: press.out }, mstock: { ...mstock },")
rep("      d.hp.forEach((v, i) => { if (nodes[i].type === 'maple') nodes[i].sap = v; else { nodes[i].hp = v; nodes[i].grow = d.grow[i]; } });",
    "      d.hp.forEach((v, i) => { if (nodes[i].type === 'maple') nodes[i].sap = v; else if (nodes[i].type === 'apple') nodes[i].fruit = v || 0; else { nodes[i].hp = v; nodes[i].grow = d.grow[i]; } });")
rep("    merge(vstock, d.vstock); merge(builder, d.builder);",
    "    merge(vstock, d.vstock); merge(builder, d.builder);\n    merge(press, d.press); merge(mstock, d.mstock); mpend.press = mpend.cider = mpend.apple = 0; pickers = []; shoppers = [];")

# ---------- events: speed, prices, customers ----------
rep("  const speed = () => [230, 270, 315, 365, 420, 480][level.run];",
    "  const speed = () => [230, 270, 315, 365, 420, 480][level.run] * (event.kind === 'storm' ? 0.7 : 1);")
rep("  const unitPrice = kind => Math.round((PRICE[kind] + level.price + (kind === 'plank' ? [0, 4, 8][level.kiln] : 0)) * rMarket() * MAP().price);",
    "  const unitPrice = kind => Math.round((PRICE[kind] + level.price + (kind === 'plank' ? [0, 4, 8][level.kiln] : 0)) * rMarket() * MAP().price *\n"
    "    (event.kind === 'storm' && (LOGS.includes(kind) || kind === 'plank') ? 1.5 : 1));\n"
    "  // shoppers pay extra on market day and when tourists are in town\n"
    "  const shopMul = () => event.kind === 'market' ? 1.25 : event.kind === 'tourists' ? 1.5 : 1;")
rep("          c.owed += unitPrice(c.kind);\n", "          c.owed += Math.round(unitPrice(c.kind) * shopMul());\n")
rep("    const want = Math.max(1, Math.round((lo + crnd() * (hi - lo)) * scale * adsMul()));",
    "    const want = Math.max(1, Math.round((lo + crnd() * (hi - lo)) * scale * adsMul() * (event.kind === 'market' ? 2 : 1)));\n"
    "    const tourist = event.kind === 'tourists';")
rep("      hair: HAIR[Math.floor(crnd() * HAIR.length)], walk: crnd() * 6, t: 0, happy: 0,\n    });",
    "      hair: HAIR[Math.floor(crnd() * HAIR.length)], walk: crnd() * 6, t: 0, happy: 0,\n"
    "      ...(tourist ? { hat: '#e8cf7a', shirt: TOURIST_SHIRTS[Math.floor(crnd() * TOURIST_SHIRTS.length)] } : {}),\n    });")
rep("  const HAIR = ['#16120f', '#3a2618', '#7a4a22', '#c9a15a', '#16120f'];",
    "  const HAIR = ['#16120f', '#3a2618', '#7a4a22', '#c9a15a', '#16120f'];\n  const TOURIST_SHIRTS = ['#ff7a5c', '#3ec1c9', '#f7d046', '#e85a9a', '#7ad15a'];")
rep("      walk: c.walk, face: c.state === 'leave' ? 1 : -1, shirt: c.shirt, skin: c.skin, hair: c.hair,\n      before: () => { for (let i = 0; i < Math.min(c.got, 10); i++) drawItem(c.kind, -15, -22 - i * 6.5); },",
    "      walk: c.walk, face: c.state === 'leave' ? 1 : -1, shirt: c.shirt, skin: c.skin, hair: c.hair, hat: c.hat,\n      before: () => { for (let i = 0; i < Math.min(c.got, 10); i++) drawItem(c.kind, -15, -22 - i * 6.5); },")

# ---------- update loop hooks ----------
rep("    updateVillagers(dt);\n    updateVans(dt);", "    updateVillagers(dt);\n    updateOrchard(dt);\n    updateMarket(dt);\n    updateEvent(dt);\n    updateVans(dt);")

# ---------- logic ----------
rep("  // ---------- Delivery vans ----------", r"""  // ---------- Orchard, cider house and market hall ----------
  const pressInSpot = () => { const [x, y] = toScreen(PRESS.x - 60, PRESS.front); return [x, y - 24]; };
  const pressOutSpot = () => { const [x, y] = toScreen(PRESS.x + 60, PRESS.front); return [x, y - 24]; };
  const mktSpot = kind => () => { const [x, y] = toScreen(MARKET.x + (kind === 'cider' ? -70 : 70), MARKET.front - 30); return [x, y - 40]; };
  // where a picked apple goes: the cider house if it has room, otherwise the market's fresh-fruit crate
  function appleDest() {
    if (level.press && press.apples + mpend.press < pressCap()) return 'press';
    if (level.market && mstock.apple + mpend.apple < mktCap()) return 'apple';
    return null;
  }
  function pickTree(n, from) {
    let sent = 0;
    for (let k = 0; k < APPLES_PER_TREE; k++) {
      const dest = appleDest();
      if (!dest) break;
      sent++;
      if (dest === 'press') { mpend.press++; fly('apple', from, pressInSpot, 0.7 + k * 0.08, () => { mpend.press--; press.apples++; }); }
      else { mpend.apple++; fly('apple', from, mktSpot('apple'), 1.1 + k * 0.08, () => { mpend.apple--; mstock.apple++; }); }
    }
    if (sent) { n.fruit = 0; n.shake = 0.6; }
    return sent;
  }
  function updateOrchard(dt) {
    if (!level.orchard) return;
    // walk past a ripe tree and its fruit flies off to be pressed
    timers.pick = (timers.pick || 0) - dt;
    if (timers.pick <= 0) {
      timers.pick = 0.25;
      for (const n of nodes) {
        if (n.type !== 'apple' || n.fruit < 1 || Math.hypot(n.x - player.x, n.y - player.y) > 80) continue;
        if (pickTree(n, () => { const [x, y] = toScreen(n.x, n.y); return [x, y - 70]; })) break;
        timers.full = (timers.full || 0) - 0.25;
        if (timers.full <= 0) { timers.full = 3; popText(n.x, n.y, 110, level.press ? `${NAMES.press} is full!` : `Build the ${NAMES.press}`, '#ffd0c4'); }
        break;
      }
    }
    // pickers
    while (pickers.length < level.pickers) {
      const i = pickers.length;
      pickers.push({ i, x: PRESS.x - 160 + i * 40, y: PRESS.front + 50, state: 'idle', t: 0, walk: 0, face: 1, target: null });
    }
    for (const h of pickers) {
      if (h.state === 'idle') {
        h.t -= dt;
        if (h.t > 0) continue;
        h.t = 0.5;
        if (!appleDest()) continue;
        let best = null, bd = Infinity;
        for (const n of nodes) {
          if (n.type !== 'apple' || n.fruit < 1 || pickers.some(o => o !== h && o.target === n)) continue;
          const d = Math.hypot(n.x - h.x, n.y - h.y);
          if (d < bd) { bd = d; best = n; }
        }
        if (best) { h.target = best; h.state = 'go'; }
      } else if (h.state === 'go') {
        const n = h.target;
        if (!n || n.fruit < 1) { h.state = 'idle'; h.target = null; continue; }
        const d = moveEntity(h, n.x + 22, n.y + 14, 170, dt);
        h.walk += dt * 9; h.face = n.x >= h.x ? 1 : -1;
        if (d < 4) { h.state = 'pick'; h.t = 0.8; }
      } else if (h.state === 'pick') {
        h.t -= dt; h.walk += dt * 14;
        if (h.t <= 0) {
          const n = h.target;
          if (n && n.fruit >= 1) pickTree(n, () => { const [x, y] = toScreen(n.x, n.y); return [x, y - 70]; });
          h.target = null; h.state = 'idle'; h.t = 0.3; h.walk = 0;
        }
      }
    }
    // the press: 2 apples → 1 cider, then cider rolls off to the market hall
    if (level.press) {
      if (press.apples >= 2 && press.out < PRESS_OUT_CAP) {
        press.t += dt * boost();
        if (press.t >= pressTime()) { press.t = 0; press.apples -= 2; press.out++; }
      }
      timers.cider = (timers.cider || 0) - dt;
      if (level.market && press.out > 0 && timers.cider <= 0 && mstock.cider + mpend.cider < mktCap()) {
        timers.cider = 0.35; press.out--; mpend.cider++;
        fly('cider', pressOutSpot, mktSpot('cider'), 1.2, () => { mpend.cider--; mstock.cider++; }, 120);
      }
    }
  }
  // market hall shoppers: walk in from the east road, line up, buy, pay, walk back out
  const MKT_SLOTS = [-90, 0, 90];
  const mktSlot = s => ({ x: MARKET.x + MKT_SLOTS[s], y: MARKET.front + 34 });
  function updateMarket(dt) {
    if (!level.market) return;
    while (shoppers.length < mktShoppers()) {
      const i = shoppers.length;
      shoppers.push({ i, x: MKT_SPAWN.x, y: MKT_SPAWN.y + (i % 3) * 16, state: 'away', t: 1 + i * 2.5, walk: 0, face: -1, slot: -1,
        skin: SKINS[i % SKINS.length], shirt: SHIRTS[(i * 3 + 1) % SHIRTS.length], hair: HAIR[(i * 2) % HAIR.length], got: 0, want: 0, owed: 0, kind: null });
    }
    const slots = 1 + Math.min(2, level.market);
    for (const v of shoppers) {
      v.t -= dt;
      if (v.state === 'away') {
        if (v.t <= 0) { v.state = 'come'; v.x = MKT_SPAWN.x; v.y = MKT_SPAWN.y + (v.i % 3) * 16; v.hat = event.kind === 'tourists' ? '#e8cf7a' : null; }
      } else if (v.state === 'come') {
        const wx = MARKET.x + 210 + (v.i % 4) * 26, wy = MARKET.front + 70 + Math.floor(v.i / 4) * 18;
        const d = moveEntity(v, wx, wy, 120, dt); v.walk += dt * 7; v.face = -1;
        if (d < 4) {
          const used = shoppers.filter(o => o.slot >= 0).map(o => o.slot);
          const free = [0, 1, 2].slice(0, slots).find(k => !used.includes(k));
          if (free !== undefined) { v.slot = free; v.state = 'toSlot'; }
        }
      } else if (v.state === 'toSlot') {
        const c = mktSlot(v.slot);
        v.walk += dt * 7;
        if (moveEntity(v, c.x, c.y, 120, dt) < 3) {
          const opts = [['cider', 2], ['apple', 1]].filter(([k]) => mstock[k] > 0);
          if (opts.length) { let r = Math.random() * opts.reduce((a, o) => a + o[1], 0); v.kind = opts.find(o => (r -= o[1]) < 0)[0]; }
          else v.kind = null;
          v.want = 1 + Math.floor(Math.random() * (2 + level.market * 2)) * (event.kind === 'market' ? 2 : 1);
          v.got = 0; v.owed = 0; v.state = 'buy'; v.t = 0; v.wait = 0; v.walk = 0;
        }
      } else if (v.state === 'buy') {
        v.face = 1;
        if (v.kind && v.got < v.want && mstock[v.kind] > 0) {
          if (v.t <= 0) {
            v.t = clerkTime(); mstock[v.kind]--; v.got++; v.owed += Math.round(unitPrice(v.kind) * shopMul()); noteSale(v.kind);
            fly(v.kind, mktSpot(v.kind), () => { const [x, y] = toScreen(v.x, v.y); return [x, y - 40]; }, 0.35, null, 30);
          }
        } else v.wait += dt;
        if ((v.kind && v.got >= v.want) || v.wait > 4 || !v.kind) {
          if (v.owed) {
            popText(v.x, v.y, 70, `+$${v.owed}`, '#c9f2c9');
            payBills(() => { const [x, y] = toScreen(v.x, v.y); return [x, y - 40]; }, 'market', v.owed);
          } else popText(v.x, v.y, 70, 'Nothing to buy…', '#ffd0c4');
          v.slot = -1; v.state = 'leave';
        }
      } else if (v.state === 'leave') {
        v.walk += dt * 7; v.face = 1;
        if (moveEntity(v, MKT_SPAWN.x + 40, MKT_SPAWN.y + (v.i % 3) * 16, 120, dt) < 4) { v.state = 'away'; v.t = 3 + Math.random() * 6; v.got = 0; }
      }
    }
  }
  // ---------- Map events ----------
  const EVENTS = {
    farm: { kind: 'market', name: 'Market Day', dur: 45, msg: 'Market Day! Shoppers buy double and pay +25%' },
    snow: { kind: 'storm', name: 'Snowstorm', dur: 40, msg: 'Snowstorm! You walk slower, but logs & planks sell for +50%' },
    tropic: { kind: 'tourists', name: 'Tourist Boat', dur: 45, msg: 'A tourist boat docked! Tourists pay +50%' },
  };
  function updateEvent(dt) {
    if (event.kind) {
      event.t -= dt;
      if (event.t <= 0) { event.kind = null; event.next = 150 + Math.random() * 90; }
    } else if (stats.earned >= 300) {
      event.next -= dt;
      if (event.next <= 0) {
        const e = EVENTS[LOOK()];
        event.kind = e.kind; event.t = e.dur; event.dur = e.dur;
        toast(e.msg);
      }
    }
    timers.evHud = (timers.evHud || 0) - dt;
    if (timers.evHud <= 0) {
      timers.evHud = 0.5;
      const e = event.kind && EVENTS[LOOK()];
      ui.event.hidden = !e;
      if (e) ui.eventText.textContent = `${e.name} · ${Math.ceil(event.t)}s`;
    }
  }

  // ---------- Delivery vans ----------""")

# ---------- HUD chip ----------
rep("    chipLogs: document.getElementById('chip-logs'),",
    "    event: document.getElementById('chip-event'), eventText: document.getElementById('n-event'),\n    chipLogs: document.getElementById('chip-logs'),")

# ---------- collisions ----------
rep("    if (level.showroom) boxes.push(SHOWROOM);", "    if (level.showroom) boxes.push(SHOWROOM);\n    if (level.market) boxes.push(MARKET);")

# ---------- roofed cider house ----------
rep("    { key: 'rail', B: STATION,", "    { key: 'press', B: PRESS, ids: ['press'], wall: '#b5763c', roof: '#7a3428', floor: '#a98a62', H: 70, door: 70, draw: () => drawPress(), top: pressChimney },\n    { key: 'rail', B: STATION,")
rep("const THATCH = new Set(['shack', 'workshop', 'vstore', 'sawmill', 'rail', 'dispatch', 'harbor']);",
    "const THATCH = new Set(['shack', 'workshop', 'vstore', 'sawmill', 'rail', 'dispatch', 'harbor', 'press']);")

# ---------- district label follows the map's group name; orchard plot hints ----------
rep("    tag(d.name, lx, ly - 14, 26, '#fffaf0', 'rgba(43,42,34,.82)');",
    "    tag((GROUPS.find(g => g.id === id) || d).name, lx, ly - 14, 26, '#fffaf0', 'rgba(43,42,34,.82)');")
rep("      if (id === 'east') {", """      if (id === 'orchard') {
        ctx.fillStyle = 'rgba(110,80,40,.18)';
        for (let r = 0; r < ORCHARD.rows; r++) { groundRect(ORCHARD.x + 12, ORCHARD.y + (r - (ORCHARD.rows - 1) / 2) * 105 + 8, ORCHARD.cols * ORCHARD.gap + 40, 34, 14); ctx.fill(); }
        if (!level.press) dashedPlot(PRESS.x, PRESS.front - PRESS.d / 2, PRESS.w, PRESS.d, `${NAMES.press} plot`);
      }
      if (id === 'east') {""")

# ---------- drawing: render list ----------
rep("    for (const n of nodes) if (onScreen(n.x, n.y, 100 * n.size)) add(n.y, () => n.type === 'maple' ? drawMaple(n) : drawTree(n));",
    "    for (const n of nodes) if (onScreen(n.x, n.y, 100 * n.size)) add(n.y, () => n.type === 'maple' ? drawMaple(n) : n.type === 'apple' ? drawAppleTree(n) : drawTree(n));\n"
    "    for (const h of pickers) if (onScreen(h.x, h.y, 60)) add(h.y, () => drawPicker(h));\n"
    "    for (const v of shoppers) if (v.state !== 'away' && onScreen(v.x, v.y, 60)) add(v.y, () => drawShopper(v));\n"
    "    if (onScreen(MARKET.x, MARKET.front, 300)) add(MARKET.front - 1, drawMarket);\n"
    "    if (event.kind === 'market') for (const by of [CY + 250, CY + 620]) add(by, () => drawBunting(by));")

# ---------- drawing functions ----------
rep("  // ---------- Draw: people and machines ----------", r"""  // ---------- Draw: orchard, cider house, market hall, events ----------
  function drawAppleItem(x, y) {
    const look = LOOK();
    ctx.fillStyle = look === 'snow' ? '#f0a43a' : look === 'tropic' ? '#f28c28' : '#d93b30';
    ctx.beginPath(); ctx.arc(x, y - 3, 4.2, 0, Math.PI * 2); ctx.fill(); outline(1.1);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x - 2.4, y - 5.5, 1.6, 1.6);
    ctx.fillStyle = '#4f8a33'; ctx.beginPath(); ctx.ellipse(x + 2, y - 7.5, 2.4, 1.2, -0.5, 0, Math.PI * 2); ctx.fill();
  }
  function drawCiderItem(x, y) {
    const look = LOOK();
    if (look === 'snow') {   // jam jar
      ctx.fillStyle = '#c4472b'; roundRect(x - 4.5, y - 8, 9, 10, 2.5); ctx.fill(); outline(1.1);
      ctx.fillStyle = '#f4ede0'; ctx.fillRect(x - 5, y - 10, 10, 3);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x - 3, y - 6, 1.6, 6);
      return;
    }
    ctx.fillStyle = look === 'tropic' ? '#f7a12a' : '#d9a03a';
    roundRect(x - 4, y - 9, 8, 12, 2.5); ctx.fill(); outline(1.1);
    ctx.fillStyle = look === 'tropic' ? '#f7a12a' : '#c98a2a'; ctx.fillRect(x - 1.8, y - 13, 3.6, 4.5);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(x - 4, y - 5, 8, 4);
    ctx.fillStyle = look === 'tropic' ? '#3f8a33' : '#c4472b'; ctx.beginPath(); ctx.arc(x, y - 3, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  function drawAppleTree(n) {
    const [sx, sy] = toScreen(n.x, n.y), look = LOOK();
    const wob = Math.sin(n.shake * 30) * n.shake * 3;
    ctx.fillStyle = 'rgba(30,40,20,.13)';
    ctx.beginPath(); ctx.ellipse(sx + 6, sy + 2, 30, 30 * TILT, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx + 4, sy + 1, 20, 20 * TILT, 0, 0, Math.PI * 2); ctx.fill();
    const fruitCol = look === 'snow' ? '#f0a43a' : look === 'tropic' ? '#f28c28' : '#d93b30';
    let spots;
    ctx.save(); ctx.translate(sx + wob, sy);
    if (look === 'snow') {
      // low cloudberry bush with a snow cap
      crown(1, ['#3f6b4a', '#4a7a52', '#46744e', '#56875a', '#68986a'], [[0, -16, 22], [-16, -12, 14], [16, -12, 15], [0, -28, 14], [-6, -32, 7]]);
      ctx.fillStyle = '#f6f9fb'; ctx.beginPath(); ctx.ellipse(-2, -36, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
      spots = [[-12, -14], [10, -18], [0, -8], [-4, -24], [14, -8], [6, -28]];
    } else {
      ctx.fillStyle = look === 'tropic' ? '#7a5a3a' : '#6e4a32';
      roundRect(-5, -32, 10, 34, 4); ctx.fill(); outline(1.6);
      const c = look === 'tropic' ? ['#2f6b32', '#3a7a3a', '#357336', '#468a42', '#5a9e50'] : ['#4f8a3a', '#5a9642', '#55903e', '#66a34c', '#7db85a'];
      crown(1, c, [[0, -48, 28], [-17, -54, 19], [17, -52, 20], [0, -70, 21], [-6, -76, 10]]);
      spots = [[-14, -50], [12, -58], [2, -40], [-6, -66], [18, -44], [8, -74], [-20, -60]];
    }
    // fruit appears as it ripens; ripe trees bob a little
    const shown = Math.floor(n.fruit * spots.length * 0.999) + (n.fruit >= 1 ? 1 : 0);
    const bob = n.fruit >= 1 ? Math.sin(performance.now() / 260 + n.seed * 20) * 1.2 : 0;
    for (let i = 0; i < Math.min(shown, spots.length); i++) {
      const [fx, fy] = spots[i], ripe = n.fruit >= 1;
      ctx.fillStyle = ripe ? fruitCol : shade(fruitCol === '#d93b30' ? '#8fbf4a' : '#c9d36a', -0.05);
      ctx.beginPath(); ctx.arc(fx, fy + bob, look === 'snow' ? 3.2 : 4.4, 0, Math.PI * 2); ctx.fill(); outline(1);
      if (ripe) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(fx - 1.8, fy - 2 + bob, 1.4, 1.4); }
    }
    ctx.restore();
    if (n.fruit < 1) {
      ctx.strokeStyle = 'rgba(255,250,240,.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy - (look === 'snow' ? 56 : 104), 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * n.fruit); ctx.stroke();
    }
  }
  function pressChimney(sx, sy, back, H) {
    ctx.fillStyle = '#7a4a32'; ctx.fillRect(sx + 60, sy - back - H - 34, 16, 30);
    if (press.apples >= 2) smoke(sx + 68, sy - back - H - 38, 'rgba(255,255,255,', 2);
  }
  function drawPress() {
    const [sx, sy] = toScreen(PRESS.x, PRESS.front), back = PRESS.d * TILT;
    const busy = press.apples >= 2 && press.out < PRESS_OUT_CAP;
    // apple bin on the left
    ctx.fillStyle = '#8a5a2e'; roundRect(sx - 100, sy - back * 0.55 - 6, 50, 24, 4); ctx.fill(); outline(1.4);
    for (let i = 0; i < Math.min(press.apples, 14); i++) drawAppleItem(sx - 92 + (i % 5) * 9, sy - back * 0.55 - 6 - Math.floor(i / 5) * 6);
    // the screw press
    const turn = busy ? performance.now() / 300 : 0;
    ctx.fillStyle = '#6e4526'; ctx.fillRect(sx - 30, sy - back * 0.5 - 54, 6, 54); ctx.fillRect(sx + 24, sy - back * 0.5 - 54, 6, 54);
    ctx.fillRect(sx - 32, sy - back * 0.5 - 58, 64, 8);
    ctx.fillStyle = '#9aa3ad'; ctx.fillRect(sx - 3, sy - back * 0.5 - 50, 6, 26 + Math.sin(turn) * 4);
    ctx.fillStyle = '#b5824a'; roundRect(sx - 22, sy - back * 0.5 - 22, 44, 22, 5); ctx.fill(); outline(1.4);
    ctx.strokeStyle = '#5f646c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx - 16 * Math.cos(turn), sy - back * 0.5 - 50); ctx.lineTo(sx + 16 * Math.cos(turn), sy - back * 0.5 - 50); ctx.stroke();
    worker(sx + 40, sy - back * 0.5, '#c4472b', busy, '#8d5a3b');
    // barrels and bottles on the right
    for (let b = 0; b < 2; b++) { ctx.fillStyle = '#8a5a2e'; roundRect(sx + 66 + b * 22, sy - back * 0.6 - 26, 20, 28, 6); ctx.fill(); outline(1.3); ctx.fillStyle = '#5f646c'; ctx.fillRect(sx + 66 + b * 22, sy - back * 0.6 - 18, 20, 2); ctx.fillRect(sx + 66 + b * 22, sy - back * 0.6 - 6, 20, 2); }
    for (let i = 0; i < Math.min(press.out, 12); i++) drawCiderItem(sx + 70 + (i % 6) * 8, sy - 8 - Math.floor(i / 6) * 13);
    tag(`${press.apples} ${ITEM_NAME.apple.toLowerCase()} → ${press.out} ${ITEM_NAME.cider.toLowerCase()}`, sx, sy - back - 86, 13, '#fffaf0');
  }
  function drawPicker(h) {
    const [sx, sy] = toScreen(h.x, h.y);
    drawPerson(sx, sy, { walk: h.walk, face: h.face, shirt: '#5a9642', skin: ['#8d5a3b', '#c68e62', '#6b4127'][h.i % 3], hair: '#16120f', hat: '#c9a35a', pants: '#3d5a8a',
      arms: h.state === 'pick' ? 'work' : true, before: () => { ctx.fillStyle = '#a0703f'; roundRect(-16, -26, 10, 9, 2); ctx.fill(); } });
  }
  function drawShopper(v) {
    const [sx, sy] = toScreen(v.x, v.y);
    drawPerson(sx, sy, { walk: v.walk, face: v.face, shirt: v.shirt, skin: v.skin, hair: v.hair, hat: v.hat || undefined,
      before: () => { for (let i = 0; i < Math.min(v.got, 8); i++) drawItem(v.kind, -15, -22 - i * 7); } });
  }
  function drawMarket() {
    const B = MARKET;
    if (!level.market) { dashedPlot(B.x, B.front - B.d / 2, B.w, B.d, 'Market Hall plot'); return; }
    bounceWrap('market', B, () => {
      const [sx, sy] = toScreen(B.x, B.front), hw = B.w / 2, back = B.d * TILT;
      ctx.fillStyle = 'rgba(30,40,20,.12)'; roundRect(sx - hw - 8, sy - back + 2, B.w + 28, back + 16, 14); ctx.fill();
      ctx.fillStyle = '#b5824a'; ctx.fillRect(sx - hw, sy - back, B.w, back);
      // back wall with shelves of stock
      ctx.fillStyle = '#efe2c4'; ctx.fillRect(sx - hw, sy - back - 70, B.w, 70);
      ctx.beginPath(); ctx.rect(sx - hw, sy - back - 70, B.w, 70); outline(2);
      ctx.fillStyle = '#8a6a43'; ctx.fillRect(sx - hw + 10, sy - back - 40, B.w - 20, 4); ctx.fillRect(sx - hw + 10, sy - back - 14, B.w - 20, 4);
      for (let i = 0; i < Math.min(mstock.cider, 24); i++) drawCiderItem(sx - hw + 22 + (i % 12) * 10, sy - back - 42 + Math.floor(i / 12) * 26);
      for (let i = 0; i < Math.min(mstock.apple, 24); i++) drawAppleItem(sx + 22 + (i % 12) * 10, sy - back - 42 + Math.floor(i / 12) * 26);
      // clerk
      worker(sx + 0, sy - 22, '#2f9d8f', shoppers.some(v => v.state === 'buy'), '#c68e62');
      // counter with crates
      ctx.fillStyle = '#8a5a2e'; ctx.fillRect(sx - hw, sy - 28, B.w, 28); ctx.beginPath(); ctx.rect(sx - hw, sy - 28, B.w, 28); outline(2);
      ctx.fillStyle = '#6e4522'; for (let x = sx - hw + 30; x < sx + hw; x += 30) ctx.fillRect(x, sy - 28, 2, 28);
      ctx.fillStyle = '#c49565'; ctx.fillRect(sx - hw - 4, sy - 34, B.w + 8, 7); ctx.beginPath(); ctx.rect(sx - hw - 4, sy - 34, B.w + 8, 7); outline(1.6);
      // posts and a green-and-cream awning
      ctx.fillStyle = '#7a4f2c'; ctx.fillRect(sx - hw, sy - back - 92, 8, back + 92); ctx.fillRect(sx + hw - 8, sy - back - 92, 8, back + 92);
      const top = sy - back - 104, seg = (B.w + 20) / 10;
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i % 2 ? '#fffaf0' : '#4f9a4a';
        const x = sx - hw - 10 + i * seg;
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + seg, top); ctx.lineTo(x + seg, top + 24); ctx.arc(x + seg / 2, top + 24, seg / 2, 0, Math.PI); ctx.closePath(); ctx.fill(); outline(1.5);
      }
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(sx - hw - 10, top + 13, B.w + 20, 11);
      ctx.font = `600 16px ${FONT}`;
      const name = 'MARKET HALL', sw = ctx.measureText(name).width + 30;
      ctx.fillStyle = '#2f5a2c'; roundRect(sx - sw / 2, top - 34, sw, 30, 8); ctx.fill(); outline(2);
      flatLabel(name, sx, top - 19, 16, '#ffe2b0');
      tag(`${mstock.cider}/${mktCap()} ${ITEM_NAME.cider.toLowerCase()} · ${mstock.apple}/${mktCap()} ${ITEM_NAME.apple.toLowerCase()}`, sx, top - 50, 13, '#fffaf0');
    });
  }
  function drawBunting(by) {
    const cols = ['#d9644a', '#e8b83a', '#3d7cc9', '#4f9a4a', '#c94f7c'];
    const [x0, y0] = toScreen(CX - 260, by), [x1] = toScreen(CX + 460, by), h = 120;
    ctx.fillStyle = '#7a4f2c'; ctx.fillRect(x0 - 3, y0 - h, 6, h); ctx.fillRect(x1 - 3, y0 - h, 6, h);
    ctx.strokeStyle = 'rgba(60,40,20,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0 - h); ctx.quadraticCurveTo((x0 + x1) / 2, y0 - h + 34, x1, y0 - h); ctx.stroke();
    const n = Math.floor((x1 - x0) / 26), sway = Math.sin(performance.now() / 400) * 1.5;
    for (let i = 1; i < n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 - h + 2 * t * (1 - t) * 34;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.lineTo(x + sway, y + 16); ctx.closePath(); ctx.fill();
    }
  }
  // tourist cruise boat sailing into the north-east sea while tourists are in town
  function drawTouristBoat() {
    if (event.kind !== 'tourists') return;
    const el = event.dur - event.t, inT = Math.min(1, el / 6), outT = Math.min(1, event.t / 6);
    const k = Math.min(inT, outT), e = k * (2 - k);
    const wx = WORLD_W + 300 - e * 900, wy = SEA.y1 - 240;
    const [bx, by] = toScreen(wx, wy);
    if (bx < -260 || bx > W + 260 || by < -120 || by > H + 60) return;
    ctx.fillStyle = 'rgba(20,60,80,.25)'; ctx.beginPath(); ctx.ellipse(bx, by + 6, 130, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fbfdfe';
    ctx.beginPath(); ctx.moveTo(bx - 120, by - 30); ctx.lineTo(bx + 130, by - 30); ctx.lineTo(bx + 105, by + 4); ctx.lineTo(bx - 110, by + 4); ctx.closePath(); ctx.fill(); outline(2);
    ctx.fillStyle = '#2f6fb3'; ctx.fillRect(bx - 114, by - 12, 236, 6);
    ctx.fillStyle = '#fbfdfe'; roundRect(bx - 80, by - 58, 150, 30, 6); ctx.fill(); outline(1.6);
    roundRect(bx - 50, by - 80, 90, 24, 6); ctx.fill(); outline(1.6);
    ctx.fillStyle = '#7fb4cf'; for (let x = bx - 72; x < bx + 60; x += 16) ctx.fillRect(x, by - 50, 10, 8);
    for (let x = bx - 42; x < bx + 32; x += 16) ctx.fillRect(x, by - 74, 10, 7);
    ctx.fillStyle = '#d9644a'; ctx.fillRect(bx + 44, by - 104, 18, 28); ctx.fillStyle = '#2b2a22'; ctx.fillRect(bx + 44, by - 104, 18, 6);
  }

  // ---------- Draw: people and machines ----------""")

rep("  const ITEM_DRAW = { wood: drawLog,", "  const ITEM_DRAW = { apple: drawAppleItem, cider: drawCiderItem, wood: drawLog,")

# tourist boat after the sea, storm weather
rep("""        ctx.fillStyle = MAP().shore; ctx.fillRect(sx0, sy1 - (look === 'tropic' ? 16 : 6), W - sx0 + 40, look === 'tropic' ? 24 : 14);""",
    """        ctx.fillStyle = MAP().shore; ctx.fillRect(sx0, sy1 - (look === 'tropic' ? 16 : 6), W - sx0 + 40, look === 'tropic' ? 24 : 14);
        drawTouristBoat();""")
rep("""    if (look === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let k = 0; k < 90; k++) {
        const sp = 30 + 40 * hash(k, 1), r = 1.2 + 2 * hash(k, 2);""", """    if (look === 'snow') {
      const storm = event.kind === 'storm';
      if (storm) { ctx.fillStyle = 'rgba(232,240,246,.32)'; ctx.fillRect(0, 0, W, H); }
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let k = 0; k < (storm ? 240 : 90); k++) {
        const sp = (30 + 40 * hash(k, 1)) * (storm ? 3 : 1), r = 1.2 + 2 * hash(k, 2);""")
rep("""        const x = wrap(hash(k, 4) * (W + 40) + Math.sin(time * 0.8 + k) * 14 - cam.x * 0.3, W + 40) - 20;""",
    """        const x = wrap(hash(k, 4) * (W + 40) + Math.sin(time * 0.8 + k) * 14 - cam.x * 0.3 - (storm ? time * 260 : 0), W + 40) - 20;""")

# ---------- minimap: market hall ----------
rep("    houses.forEach((h, i) => { if (h.state === 'done') rect(",
    "    if (level.market) rect(MARKET.x - MARKET.w / 2, MARKET.front - MARKET.d, MARKET.x + MARKET.w / 2, MARKET.front, '#4f9a4a');\n"
    "    houses.forEach((h, i) => { if (h.state === 'done') rect(")

p.write_text(s)

# ---------- HUD chip markup ----------
h = root / 'src/head.html'
t = h.read_text()
a = '<button class="test-cash"'
assert t.count(a) == 1
chip = ('  <div class="chip event" id="chip-event" title="Event on this map" hidden>\n'
        '    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2 L12.4 7.2 L18 7.8 L13.8 11.6 L15 17 L10 14.2 L5 17 L6.2 11.6 L2 7.8 L7.6 7.2 Z" fill="#e8b83a" stroke="#a57a1c" stroke-width="1"/></svg>\n'
        '    <span id="n-event"></span>\n  </div>\n</div>\n')
# put the chip as the last chip inside the HUD
idx = t.index('</div>\n' + a)
t = t[:idx] + chip + t[idx + len('</div>\n'):]
t = t.replace("  .chip.cash { color: var(--cash); }", "  .chip.cash { color: var(--cash); }\n  .chip.event { color: #8a5a10; }")
h.write_text(t)
print('patched')
