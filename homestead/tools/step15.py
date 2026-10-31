# One-off patch: prestige moves to new maps (Snowy North, Tropical Coast).
import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:80]); s = s.replace(a, b)

# --- maps, prestige state, theme
rep("  const incomeMul = () => [1, 1.1, 1.25, 1.5][level.hq];",
"""  // ---------- Maps (sell the business, move on) ----------
  // Each move gives a permanent income bonus. Maps share the town layout; names, prices and looks change.
  const MAPS = [
    { name: 'Homestead', price: 1, names: {}, groups: {},
      ground: ['#7fae5a', '#6f9d4c', '#4f7a36'], plaza: '#c9b48a',
      tree: { trunk: { pine: '#7a4f2c', oak: '#5e4129', redwood: '#9a4a2c' }, oak: ['#4b6e2c', '#577d33', '#52772f', '#628c3a', '#7aa64a'],
        pine: ['#2f7a3d', '#378a46', '#41994f'], redwood: ['#1f4a2c', '#255533', '#2c603a', '#336b40', '#3b7748'],
        maple: ['#c4472b', '#d65a2e', '#cf4f2c', '#e07a33', '#f0a24a'], mapleTrunk: '#6e4a32' } },
    { name: 'Snowy North', price: 1.5, snow: true,
      names: { wood: 'Spruce', oak: 'Birch', redwood: 'Giant Fir', sap: 'Birch Sap', syrup: 'Birch Syrup' },
      groups: { maple: 'Birch Sap & Syrup', reserve: 'Giant Fir Reserve', village: 'Spruce Village' },
      ground: ['#e6edf1', '#d8e2e8', '#9fb0ba'], plaza: '#c9d2d9',
      tree: { trunk: { pine: '#5e4129', oak: '#ece8df', redwood: '#6b3b2a' }, oak: ['#d9b54a', '#e3c25a', '#c9a43e', '#efd27a', '#f5e09a'],
        pine: ['#244f3c', '#2b5e45', '#316b4e'], redwood: ['#1c3f31', '#214837', '#26513d', '#2b5a43', '#316349'],
        maple: ['#e8903a', '#f0a43a', '#e08a30', '#f5c45a', '#fad87a'], mapleTrunk: '#ece8df' } },
    { name: 'Tropical Coast', price: 2,
      names: { wood: 'Bamboo', oak: 'Mahogany', redwood: 'Teak', sap: 'Coconuts', syrup: 'Coconut Oil' },
      groups: { maple: 'Coconut Grove', reserve: 'Teak Reserve', village: 'Bamboo Village' },
      ground: ['#8cc45a', '#7db84e', '#3f7f3a'], plaza: '#ead9a8',
      tree: { trunk: { pine: '#7fb04a', oak: '#7a3b28', redwood: '#8a5a32' }, oak: ['#245a2a', '#2f6b32', '#2a6330', '#3a7a3a', '#4f9142'],
        pine: ['#6aa843', '#7fb04a', '#94c45a'], redwood: ['#2d5a26', '#346430', '#3d6e2f', '#457836', '#4f823d'],
        maple: ['#3f8a33', '#4f9a3a', '#468f36', '#5aa646', '#6ab450'], mapleTrunk: '#a8834f' } },
  ];
  const prestige = { map: 0, bonus: 0, moves: 0 };
  const MAP = () => MAPS[prestige.map] || MAPS[0];
  const MOVE_MIN = 250000;
  const moveGain = () => stats.earned < MOVE_MIN ? 0 : Math.floor(Math.sqrt(stats.earned / 50000)) / 10;
  const pct = v => `+${Math.round(v * 100)}%`;
  const incomeMul = () => [1, 1.1, 1.25, 1.5][level.hq] * (1 + prestige.bonus);""")
rep("const unitPrice = kind => Math.round((PRICE[kind] + level.price + (kind === 'plank' ? [0, 4, 8][level.kiln] : 0)) * rMarket());",
    "const unitPrice = kind => Math.round((PRICE[kind] + level.price + (kind === 'plank' ? [0, 4, 8][level.kiln] : 0)) * rMarket() * MAP().price);")
rep("    { id: 'village', name: 'Pine Village', ...P(-1000, -650) },\n  ];",
    "    { id: 'village', name: 'Pine Village', ...P(-1000, -650) },\n    { id: 'move', name: 'Sell & Move', ...P(-70, 520) },\n  ];")

# --- 2D look follows the map
rep("    ctx.fillStyle = '#c9b48a';\n", "    ctx.fillStyle = MAP().plaza;\n", 2)
rep("    rect(CX - 1080, CY - 720, CX + 1160, CY + 1160, '#c9b48a');\n    for (const r of ROADS) rect(r.x0, r.y0, r.x1, r.y1, '#c9b48a');",
    "    rect(CX - 1080, CY - 720, CX + 1160, CY + 1160, MAP().plaza);\n    for (const r of ROADS) rect(r.x0, r.y0, r.x1, r.y1, MAP().plaza);")
rep("    const trunk = { pine: '#7a4f2c', oak: '#5e4129', redwood: '#9a4a2c' }[n.species];",
    "    const pal = MAP().tree, trunk = pal.trunk[n.species];")
rep("      blob(0, -50, 32, '#4b6e2c'); blob(-18, -58, 22, '#577d33'); blob(18, -56, 23, '#52772f');\n      blob(0, -74, 24, '#628c3a'); blob(-8, -80, 11, '#7aa64a');",
    "      const c = pal.oak;\n      blob(0, -50, 32, c[0]); blob(-18, -58, 22, c[1]); blob(18, -56, 23, c[2]);\n      blob(0, -74, 24, c[3]); blob(-8, -80, 11, c[4]);")
rep("      const cols = n.species === 'redwood' ? ['#1f4a2c', '#255533', '#2c603a', '#336b40', '#3b7748'] : ['#2f7a3d', '#378a46', '#41994f'];",
    "      const cols = n.species === 'redwood' ? pal.redwood : pal.pine;")
rep("""        ctx.moveTo(-half * s, y * s); ctx.lineTo(half * s, y * s); ctx.lineTo(0, (y - 34) * s);
        ctx.closePath(); ctx.fill();""",
"""        ctx.moveTo(-half * s, y * s); ctx.lineTo(half * s, y * s); ctx.lineTo(0, (y - 34) * s);
        ctx.closePath(); ctx.fill();
        if (MAP().snow) {   // snow caps
          ctx.fillStyle = '#f4f7f9';
          ctx.beginPath(); ctx.moveTo(-half * 0.4 * s, (y - 20) * s); ctx.lineTo(half * 0.4 * s, (y - 20) * s); ctx.lineTo(0, (y - 34) * s); ctx.closePath(); ctx.fill();
        }""")
rep("""    ctx.fillStyle = '#6e4a32';
    roundRect(sx - 6, sy - 36, 12, 38, 4); ctx.fill();""", """    const mp = MAP().tree;
    ctx.fillStyle = mp.mapleTrunk;
    roundRect(sx - 6, sy - 36, 12, 38, 4); ctx.fill();""")
rep("""    blob(0, -54, 28, '#c4472b'); blob(-16, -62, 19, '#d65a2e'); blob(16, -60, 20, '#cf4f2c');
    blob(0, -78, 21, '#e07a33'); blob(-6, -84, 10, '#f0a24a');""",
"""    const c = mp.maple;
    blob(0, -54, 28, c[0]); blob(-16, -62, 19, c[1]); blob(16, -60, 20, c[2]);
    blob(0, -78, 21, c[3]); blob(-6, -84, 10, c[4]);""")
rep("    const name = { wood: 'Pine', oak: 'Oak', redwood: 'Redwood' };\n    const rows = LOGS.map(k => {",
    "    const name = ITEM_NAME;\n    const rows = LOGS.map(k => {")

# --- the Sell & Move tile and panel
rep("""    const note = !open.length ? (items.every(u => level[u.id] >= u.costs.length) ? 'All upgraded' : 'Nothing to buy yet')
      : `${open.length} upgrade${open.length > 1 ? 's' : ''} · from $${cheapest.toLocaleString()}`;
    flatLabel(note, sx, sy - 40 + bob, 15, afford ? '#1f5a2a' : '#2b2a22', 600);""",
"""    const note = g.id === 'move' ? moveNote() : !open.length ? (items.every(u => level[u.id] >= u.costs.length) ? 'All upgraded' : 'Nothing to buy yet')
      : `${open.length} upgrade${open.length > 1 ? 's' : ''} · from $${cheapest.toLocaleString()}`;
    flatLabel(note, sx, sy - 40 + bob, 15, afford || (g.id === 'move' && moveGain()) ? '#1f5a2a' : '#2b2a22', 600);""")
rep("""      (research ? research.id + Math.ceil(research.total - research.t) : '');
    if (key === panelKey) return;
    panelKey = key;
    const controls = panelGroup.id === 'dispatch' && level.dispatch ? dispatchControls() : '';""",
"""      (research ? research.id + Math.ceil(research.total - research.t) : '') +
      (panelGroup.id === 'move' ? moveAsk + Math.floor(stats.earned / 1000) + ':' + prestige.map : '');
    if (key === panelKey) return;
    panelKey = key;
    const controls = panelGroup.id === 'dispatch' && level.dispatch ? dispatchControls() : panelGroup.id === 'move' ? moveControls() : '';""")
rep("""  ui.panelList.addEventListener('click', e => {
    const b = e.target.closest('[data-buy]');
    if (b) buy(b.dataset.buy);""",
"""  ui.panelList.addEventListener('click', e => {
    const b = e.target.closest('[data-buy]');
    if (b) buy(b.dataset.buy);
    const mv = e.target.closest('[data-move]');
    if (mv) {
      if (mv.dataset.move === 'go') moveMap();
      moveAsk = mv.dataset.move === 'ask';
      panelKey = ''; renderPanel();
    }""")
rep("""  const seg = (set, options, current) =>""",
"""  let moveAsk = false, FRESH = null;
  function moveNote() {
    const g = moveGain();
    return g ? `Sell for ${pct(g)} income forever` : `Earn $${MOVE_MIN.toLocaleString()} to sell · $${Math.floor(stats.earned).toLocaleString()} so far`;
  }
  function moveControls() {
    const m = MAP(), next = MAPS[Math.min(MAPS.length - 1, prestige.map + 1)], g = moveGain();
    const where = next === m ? `start ${m.name} again` : `move to ${next.name}`;
    const intro = `<div class="ctl-sec"><h3>${m.name}</h3><p>Income bonus now: ${pct(prestige.bonus)}. Earned on this map: $${Math.floor(stats.earned).toLocaleString()}.</p>` +
      `<p>Selling resets your town, upgrades and cash. You keep the income bonus, finished Research and the Dispatch Office with its settings.` +
      `${next !== m ? ` ${next.name} pays ${next.price}× for everything.` : ''}</p></div>`;
    if (moveAsk && g) return intro + `<div class="up"><div class="up-text"><div class="up-name">Sell everything and ${where}?</div><div class="up-note">Bonus becomes ${pct(prestige.bonus + g)}</div></div>` +
      `<button type="button" data-move="go">Yes, sell</button></div><div class="up"><div class="up-text"><div class="up-note">Changed your mind?</div></div><button type="button" data-move="no">Cancel</button></div>`;
    return intro + `<div class="up"><div class="up-text"><div class="up-name">Sell & ${where}</div><div class="up-note">${g ? `${pct(g)} income forever` : `Earn $${MOVE_MIN.toLocaleString()} on this map first`}</div></div>` +
      `<button type="button" data-move="ask" ${g ? '' : 'disabled'}>Sell</button></div>`;
  }
  function moveMap() {
    const g = moveGain();
    if (!g || !FRESH) return;
    const d = JSON.parse(JSON.stringify(FRESH));
    for (const u of UPGRADES) if (u.research) d.level[u.id] = level[u.id];
    d.level.dispatch = level.dispatch;
    d.dispatch = JSON.parse(JSON.stringify(dispatch));
    d.prestige = { map: Math.min(MAPS.length - 1, prestige.map + 1), bonus: Math.round((prestige.bonus + g) * 100) / 100, moves: prestige.moves + 1 };
    d.savedAt = Date.now();
    fx.length = 0; belt = []; research = null; gather.node = null; moveAsk = false;
    const zero = o => { for (const k in o) { if (typeof o[k] === 'number') o[k] = 0; else if (o[k] && typeof o[k] === 'object') zero(o[k]); } };
    zero(pending); zero(pendingV); kilnPend = 0;
    applySave(d);
    toast(`Welcome to ${MAP().name}! Income bonus ${pct(prestige.bonus)}`);
    save(true);
  }
  const BASE_NAMES = { ...ITEM_NAME }, BASE_GROUPS = Object.fromEntries(GROUPS.map(g => [g.id, g.name]));
  function applyMapTheme() {
    const m = MAP();
    Object.assign(ITEM_NAME, BASE_NAMES, m.names);
    for (const g of GROUPS) g.name = m.groups[g.id] || BASE_GROUPS[g.id];
    const root = document.documentElement.style;
    root.setProperty('--ground', m.ground[0]); root.setProperty('--ground-dark', m.ground[1]); root.setProperty('--edge', m.ground[2]);
    for (const k in varCache) delete varCache[k];
    if (R3) R3.retheme();
  }

  const seg = (set, options, current) =>""")

# --- save / load
rep("      stats, contract, research, dispatch, vstock:", "      stats, contract, research, dispatch, prestige: { ...prestige }, vstock:")
rep("    if (d.dispatch) { Object.assign(dispatch, d.dispatch);",
    "    Object.assign(prestige, { map: 0, bonus: 0, moves: 0 }, d.prestige || {});\n    applyMapTheme();\n    if (d.dispatch) { Object.assign(dispatch, d.dispatch);")
rep("  function start(saved) {\n    resize();", "  function start(saved) {\n    resize();\n    FRESH = snapshot();")
open(p, 'w').write(s); print('ok')
