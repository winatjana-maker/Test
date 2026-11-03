# One-off patch: give each map its own 2D look (ground, shore, decor, trees, roofs, weather).
import pathlib
p = pathlib.Path(__file__).parent.parent / 'src/game.js'
s = p.read_text()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:80])
    s = s.replace(a, b)

# --- map table: a look key plus sea/shore/rim colours
rep("{ name: 'Homestead', price: 1, names: {}, groups: {},",
    "{ name: 'Homestead', price: 1, names: {}, groups: {}, look: 'farm', sea: '#4f8fb3', shore: '#e3d3a5', rim: '#5a4630',")
rep("{ name: 'Snowy North', price: 1.5, snow: true,",
    "{ name: 'Snowy North', price: 1.5, snow: true, look: 'snow', sea: '#3f6a86', shore: '#f4f7f9', rim: '#7d8f9b',")
rep("{ name: 'Tropical Coast', price: 2,",
    "{ name: 'Tropical Coast', price: 2, look: 'tropic', sea: '#2fb3bf', shore: '#f0dfa8', rim: '#e6cf8e',")
rep("ground: ['#8cc45a', '#7db84e', '#3f7f3a'], plaza: '#ead9a8',", "ground: ['#8cc45a', '#7db84e', '#2a9fb0'], plaza: '#ead9a8',")
rep("  const MAP = () => MAPS[prestige.map] || MAPS[0];\n",
    "  const MAP = () => MAPS[prestige.map] || MAPS[0];\n  const LOOK = () => MAP().look || 'farm';\n"
    "  // stable 0..1 noise for a grid cell, so scenery stays put as the camera moves\n"
    "  const hash = (i, j, k = 0) => { let h = (i * 374761393 + j * 668265263 + k * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };\n")

# --- ground: farm checkerboard, snow drifts, tropical island in the sea
rep("""  function drawGround() {
    ctx.fillStyle = getVar('--edge');
    ctx.fillRect(0, 0, W, H);
    const [x0, y0] = toScreen(0, 0);
    const fw = WORLD_W, fh = WORLD_H * TILT;
    ctx.fillStyle = '#5a4630';
    roundRect(x0, y0 + 10, fw, fh, 18); ctx.fill();
    ctx.save();
    roundRect(x0, y0, fw, fh, 18); ctx.clip();
    ctx.fillStyle = getVar('--ground'); ctx.fillRect(x0, y0, fw, fh);
    ctx.fillStyle = getVar('--ground-dark');
    const th = TILE * TILT;
    const i0 = Math.max(0, Math.floor(cam.x / TILE)), i1 = Math.min(WORLD_W / TILE, Math.ceil((cam.x + W) / TILE));
    const j0 = Math.max(0, Math.floor(cam.y / th)), j1 = Math.min(WORLD_H / TILE, Math.ceil((cam.y + H) / th));
    for (let j = j0; j < j1; j++)
      for (let i = i0; i < i1; i++)
        if ((i + j) % 2 === 0) ctx.fillRect(x0 + i * TILE, y0 + j * th, TILE, th);
    ctx.restore();
  }""", """  function drawGround(time) {
    const look = LOOK();
    ctx.fillStyle = getVar('--edge');
    ctx.fillRect(0, 0, W, H);
    const [x0, y0] = toScreen(0, 0);
    const fw = WORLD_W, fh = WORLD_H * TILT;
    if (look === 'tropic') {
      // open sea all round the island, with rolling swell
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      const off = (time * 18) % 90;
      for (let y = 10 - (cam.y % 26); y < H; y += 26) for (let x = ((y * 13) % 90) - 90 + off; x < W; x += 90) ctx.fillRect(x, y, 30, 2);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      roundRect(x0 - 26, y0 - 22, fw + 52, fh + 52, 40); ctx.fill();
      ctx.fillStyle = MAP().shore;
      roundRect(x0 - 18, y0 - 14, fw + 36, fh + 36, 34); ctx.fill();
    }
    ctx.fillStyle = MAP().rim;
    roundRect(x0, y0 + 10, fw, fh, 18); ctx.fill();
    ctx.save();
    roundRect(x0, y0, fw, fh, 18); ctx.clip();
    ctx.fillStyle = getVar('--ground'); ctx.fillRect(x0, y0, fw, fh);
    const th = TILE * TILT;
    const i0 = Math.max(0, Math.floor(cam.x / TILE)), i1 = Math.min(WORLD_W / TILE, Math.ceil((cam.x + W) / TILE));
    const j0 = Math.max(0, Math.floor(cam.y / th)), j1 = Math.min(WORLD_H / TILE, Math.ceil((cam.y + H) / th));
    const blob = (x, y, rx, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * TILT, 0, 0, Math.PI * 2); ctx.fill(); };
    if (look === 'snow') {
      // soft drifts, blue hollows and a few glints instead of a checkerboard
      for (let j = j0; j < j1; j++)
        for (let i = i0; i < i1; i++) {
          const h = hash(i, j), x = x0 + (i + hash(i, j, 1)) * TILE, y = y0 + (j + hash(i, j, 2)) * th;
          if (h < 0.16) blob(x, y, 26 + 40 * hash(i, j, 3), 'rgba(255,255,255,.75)');
          else if (h < 0.27) blob(x, y, 20 + 30 * hash(i, j, 3), 'rgba(140,170,195,.18)');
          else if (h > 0.9 && Math.sin(time * 3 + h * 60) > 0.6) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 4, 2, 8); ctx.fillRect(x - 4, y - 1, 8, 2); }
        }
    } else if (look === 'tropic') {
      // mown stripes with sandy patches showing through
      ctx.fillStyle = getVar('--ground-dark');
      for (let j = j0; j < j1; j++) if (j % 2 === 0) ctx.fillRect(x0 + i0 * TILE, y0 + j * th, (i1 - i0) * TILE, th);
      for (let j = j0; j < j1; j++)
        for (let i = i0; i < i1; i++)
          if (hash(i, j) < 0.07) blob(x0 + (i + hash(i, j, 1)) * TILE, y0 + (j + hash(i, j, 2)) * th, 24 + 34 * hash(i, j, 3), 'rgba(226,206,150,.7)');
    } else {
      ctx.fillStyle = getVar('--ground-dark');
      for (let j = j0; j < j1; j++)
        for (let i = i0; i < i1; i++)
          if ((i + j) % 2 === 0) ctx.fillRect(x0 + i * TILE, y0 + j * th, TILE, th);
    }
    ctx.restore();
  }""")
rep("    drawGround();\n    drawGroundMarks(time);", "    drawGround(time);\n    drawGroundMarks(time);")

# --- plaza + roads: one shape list, edged per map (snowbanks, sandy border, dirt edge)
rep("""    ctx.fillStyle = MAP().plaza;
    groundRect(CX + 40, CY + 380, 2200, 1440, 30); ctx.fill();
    groundRect(CX - 440, CY + 1180, 1280, 400, 30); ctx.fill();
    groundRect((ANNEX.x0 + ANNEX.x1) / 2 + 40, CY + 60, ANNEX.x1 - ANNEX.x0 + 160, 840, 30); ctx.fill();
    groundRect(LEAVE_X, (CY + SPAWN_Y) / 2 + 80, 230, SPAWN_Y - CY + 160, 16); ctx.fill();
""", """    const plazas = [[CX + 40, CY + 380, 2200, 1440, 30], [CX - 440, CY + 1180, 1280, 400, 30],
      [(ANNEX.x0 + ANNEX.x1) / 2 + 40, CY + 60, ANNEX.x1 - ANNEX.x0 + 160, 840, 30], [LEAVE_X, (CY + SPAWN_Y) / 2 + 80, 230, SPAWN_Y - CY + 160, 16],
      ...ROADS.map(r => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, r.x1 - r.x0, r.y1 - r.y0, 10])];
    const edge = { farm: ['rgba(90,70,48,.3)', 6], snow: ['#ffffff', 16], tropic: ['#c9ad6e', 7] }[LOOK()];
    ctx.strokeStyle = edge[0]; ctx.lineWidth = edge[1];
    for (const r of plazas) { groundRect(...r); ctx.stroke(); }
    ctx.fillStyle = MAP().plaza;
    for (const r of plazas) { groundRect(...r); ctx.fill(); }
""")
rep("""    // roads out to the districts
    ctx.fillStyle = MAP().plaza;
    for (const r of ROADS) { groundRect((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, r.x1 - r.x0, r.y1 - r.y0, 10); ctx.fill(); }
""", "")

# --- sea: per-map water, ice floes in the north, shallows in the tropics
rep("""        ctx.fillStyle = '#4f8fb3'; ctx.fillRect(sx0, sy0 - 400, W - sx0 + 40, sy1 - sy0 + 400);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        const off = (time * 30) % 60;
        for (let y = sy1 - 10; y > sy0 - 400; y -= 22) for (let x = sx0 + ((y * 7) % 60) - off; x < W; x += 60) ctx.fillRect(x, y, 22, 2);
        ctx.fillStyle = '#e3d3a5'; ctx.fillRect(sx0, sy1 - 6, W - sx0 + 40, 14);""",
"""        const look = LOOK();
        ctx.fillStyle = MAP().sea; ctx.fillRect(sx0, sy0 - 400, W - sx0 + 40, sy1 - sy0 + 400);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        const off = (time * (look === 'snow' ? 12 : 30)) % 60;
        for (let y = sy1 - 10; y > sy0 - 400; y -= 22) for (let x = sx0 + ((y * 7) % 60) - off; x < W; x += 60) ctx.fillRect(x, y, 22, 2);
        if (look === 'snow') {
          // ice floes drifting slowly along the coast
          for (let k = 0; k < 14; k++) {
            const fx = SEA.x0 + ((hash(k, 7) * (WORLD_W - SEA.x0) + time * (6 + 6 * hash(k, 8))) % (WORLD_W - SEA.x0)), fy = SEA.y1 * (0.1 + 0.8 * hash(k, 9));
            const [ix, iy] = toScreen(fx, fy), r = 18 + 26 * hash(k, 10);
            ctx.fillStyle = 'rgba(40,70,90,.35)'; ctx.beginPath(); ctx.ellipse(ix + 3, iy + 4, r, r * TILT, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#eef4f7'; ctx.beginPath(); ctx.ellipse(ix, iy, r, r * TILT, 0, 0, Math.PI * 2); ctx.fill();
          }
        } else if (look === 'tropic') {
          ctx.fillStyle = 'rgba(190,245,235,.45)'; ctx.fillRect(sx0, sy1 - 46, W - sx0 + 40, 42);
        }
        ctx.fillStyle = MAP().shore; ctx.fillRect(sx0, sy1 - (look === 'tropic' ? 16 : 6), W - sx0 + 40, look === 'tropic' ? 24 : 14);""")

# --- owned districts take on the map's ground
rep("""      ctx.fillStyle = d.ground;
      groundRect(cx, cy, w, dd, 24); ctx.fill();
""", """      ctx.fillStyle = d.ground;
      groundRect(cx, cy, w, dd, 24); ctx.fill();
      const tint = { snow: 'rgba(240,246,250,.55)', tropic: 'rgba(234,217,168,.35)' }[LOOK()];
      if (tint) { ctx.fillStyle = tint; groundRect(cx, cy, w, dd, 24); ctx.fill(); }
""")

# --- decor: grass and flowers / snowy tufts, rocks, snowmen / ferns and hibiscus
rep("""  function drawDecor(d) {
    const [sx, sy] = toScreen(d.x, d.y);
    if (d.kind === 'tuft') {""", """  function drawDecor(d) {
    const [sx, sy] = toScreen(d.x, d.y), look = LOOK();
    if (look === 'snow') return drawSnowDecor(d, sx, sy);
    if (look === 'tropic') return drawTropicDecor(d, sx, sy);
    if (d.kind === 'tuft') {""")
rep("""  // ---------- Draw: store ----------""", """  function drawSnowDecor(d, sx, sy) {
    const mound = (r) => { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.45, 0, Math.PI, 0); ctx.fill(); };
    if (d.kind === 'tuft') {
      ctx.strokeStyle = '#a88f62'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx - 3, sy - 2); ctx.lineTo(sx - 6, sy - 10); ctx.moveTo(sx, sy - 2); ctx.lineTo(sx + 1, sy - 12); ctx.moveTo(sx + 3, sy - 2); ctx.lineTo(sx + 6, sy - 9); ctx.stroke();
      mound(8);
    } else if (d.hue > 0.93) {
      // a little snowman
      ctx.fillStyle = 'rgba(80,110,130,.25)'; ctx.beginPath(); ctx.ellipse(sx + 3, sy + 1, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fbfdfe';
      ctx.beginPath(); ctx.arc(sx, sy - 9, 10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx, sy - 24, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b2a22'; ctx.fillRect(sx - 3, sy - 27, 2, 2); ctx.fillRect(sx + 2, sy - 27, 2, 2);
      ctx.fillStyle = '#e07a33'; ctx.beginPath(); ctx.moveTo(sx, sy - 24); ctx.lineTo(sx + 7, sy - 23); ctx.lineTo(sx, sy - 22); ctx.fill();
      ctx.fillStyle = '#c4472b'; ctx.fillRect(sx - 7, sy - 18, 14, 3);
    } else if (d.hue < 0.5) {
      // rock with a snow cap
      ctx.fillStyle = '#7d8790'; ctx.beginPath(); ctx.ellipse(sx, sy - 4, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fbfdfe'; ctx.beginPath(); ctx.ellipse(sx - 1, sy - 8, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // frosty berry bush
      ctx.fillStyle = '#5f7a74'; ctx.beginPath(); ctx.arc(sx - 4, sy - 6, 6, 0, Math.PI * 2); ctx.arc(sx + 4, sy - 7, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fbfdfe'; ctx.beginPath(); ctx.ellipse(sx, sy - 12, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c4472b'; ctx.fillRect(sx - 5, sy - 6, 2.5, 2.5); ctx.fillRect(sx + 3, sy - 4, 2.5, 2.5);
    }
  }
  function drawTropicDecor(d, sx, sy) {
    if (d.kind === 'tuft') {
      // fern: a fan of arched fronds
      ctx.strokeStyle = d.hue < 0.5 ? '#2f7a33' : '#3f8f3a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const a of [-1, -0.45, 0, 0.45, 1]) { ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + a * 6, sy - 14, sx + a * 13, sy - 8 + Math.abs(a) * 4); }
      ctx.stroke();
    } else if (d.hue > 0.9) {
      // tiki torch with a flicker
      ctx.fillStyle = '#7a4f2c'; ctx.fillRect(sx - 2, sy - 26, 4, 26);
      ctx.fillStyle = '#5a3a1e'; ctx.fillRect(sx - 4, sy - 30, 8, 6);
      const f = 1 + Math.sin(performance.now() / 90 + d.x) * 0.15;
      ctx.fillStyle = '#f0a24a'; ctx.beginPath(); ctx.ellipse(sx, sy - 35, 4 * f, 7 * f, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.ellipse(sx, sy - 33, 2, 4, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // hibiscus bush
      ctx.fillStyle = '#2f6b32'; ctx.beginPath(); ctx.arc(sx - 4, sy - 5, 6, 0, Math.PI * 2); ctx.arc(sx + 4, sy - 6, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = d.hue < 0.45 ? '#e8413c' : d.hue < 0.7 ? '#f08a3a' : '#e85a9a';
      ctx.beginPath(); ctx.arc(sx - 3, sy - 9, 3.4, 0, Math.PI * 2); ctx.arc(sx + 5, sy - 7, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe08a'; ctx.fillRect(sx - 4, sy - 10, 2, 2);
    }
  }

  // ---------- Draw: store ----------""")

# --- trees: bamboo, teak and palms in the tropics; birch bark and snowy roots up north
rep("""  function treeBody(sx, sy, s, species, wob) {
    const n = { species };
    const pal = MAP().tree, trunk = pal.trunk[n.species];""", """  function treeBody(sx, sy, s, species, wob) {
    const n = { species };
    const pal = MAP().tree, trunk = pal.trunk[n.species];
    if (LOOK() === 'tropic' && species !== 'oak') return tropicTree(sx, sy, s, species, wob, pal);
    if (LOOK() === 'snow') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(sx, sy, 15 * s, 6 * s, 0, Math.PI, 0); ctx.fill(); }""")
rep("""    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fillRect(sx + 1 * s, sy - th * s, 5 * s, th * s);
    ctx.save();
    ctx.translate(sx + wob, sy);
    if (n.species === 'oak') {""", """    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fillRect(sx + 1 * s, sy - th * s, 5 * s, th * s);
    if (LOOK() === 'snow' && species === 'oak') {   // birch bark marks
      ctx.fillStyle = '#2b2a22';
      for (let k = 0; k < 4; k++) ctx.fillRect(sx - 6 * s + (k % 2) * 5 * s, sy - (8 + k * 7) * s, 5 * s, 1.6 * s);
    }
    ctx.save();
    ctx.translate(sx + wob, sy);
    if (n.species === 'oak') {""")
rep("""  // a chopped tree swinging down around its base, then fading out""", """  function tropicTree(sx, sy, s, species, wob, pal) {
    ctx.save();
    ctx.translate(sx, sy);
    if (species === 'pine') {
      // bamboo clump: segmented stalks with leaf sprays
      const stalks = [[-9, 92], [-2, 108], [6, 84], [12, 98]];
      for (const [dx, h] of stalks) {
        const tx = (dx + wob * h / 100) * s;
        ctx.strokeStyle = pal.pine[1]; ctx.lineWidth = 4.5 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(dx * s, 0); ctx.lineTo(tx, -h * s); ctx.stroke();
        ctx.fillStyle = '#4f7f2f';
        for (let y = 16; y < h; y += 16) ctx.fillRect(dx * s + (tx - dx * s) * y / h - 2.6 * s, -y * s, 5.2 * s, 1.6 * s);
        ctx.strokeStyle = pal.pine[2]; ctx.lineWidth = 2.6 * s;
        ctx.beginPath();
        for (const a of [-1, 1]) { ctx.moveTo(tx, -h * s); ctx.quadraticCurveTo(tx + a * 8 * s, -(h + 6) * s, tx + a * 15 * s, -(h - 6) * s); ctx.moveTo(tx, -(h - 22) * s); ctx.lineTo(tx + a * 11 * s, -(h - 30) * s); }
        ctx.stroke();
      }
    } else {
      // teak: tall bare trunk under layered flat canopies
      ctx.fillStyle = pal.trunk.redwood;
      roundRect(-6 * s, -120 * s, 12 * s, 122 * s, 4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(1 * s, -120 * s, 5 * s, 120 * s);
      ctx.translate(wob, 0);
      const c = pal.redwood;
      [[-112, 46], [-136, 40], [-158, 30], [-174, 18]].forEach(([y, r], i) => {
        ctx.fillStyle = c[i + 1]; ctx.beginPath(); ctx.ellipse(0, y * s, r * s, r * 0.36 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c[i]; ctx.beginPath(); ctx.ellipse(0, (y + 5) * s, r * 0.9 * s, r * 0.22 * s, 0, 0, Math.PI); ctx.fill();
      });
    }
    ctx.restore();
  }
  function drawPalm(sx, sy, wob, mp) {
    // curved trunk, a crown of fronds and a cluster of coconuts
    ctx.strokeStyle = mp.mapleTrunk; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - 4, sy - 50, sx + 10 + wob, sy - 88); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 9; ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - 4, sy - 50, sx + 10 + wob, sy - 88); ctx.stroke(); ctx.setLineDash([]);
    const tx = sx + 10 + wob, ty = sy - 90, c = mp.maple;
    ctx.lineWidth = 6;
    [[-38, 4], [-28, -14], [-8, -24], [16, -22], [34, -10], [40, 8], [-20, 14], [22, 16]].forEach(([dx, dy], i) => {
      ctx.strokeStyle = c[i % c.length];
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + dx * 0.5, ty + dy - 14, tx + dx, ty + dy); ctx.stroke();
    });
    ctx.fillStyle = '#6b4a2c';
    for (const [dx, dy] of [[-4, 4], [4, 5], [0, 9]]) { ctx.beginPath(); ctx.arc(tx + dx, ty + dy, 4.5, 0, Math.PI * 2); ctx.fill(); }
  }

  // a chopped tree swinging down around its base, then fading out""")
rep("""    const mp = MAP().tree;
    ctx.fillStyle = mp.mapleTrunk;
    roundRect(sx - 6, sy - 36, 12, 38, 4); ctx.fill();
    ctx.save();
    ctx.translate(sx + wob, sy);
    const blob = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    const c = mp.maple;
    blob(0, -54, 28, c[0]); blob(-16, -62, 19, c[1]); blob(16, -60, 20, c[2]);
    blob(0, -78, 21, c[3]); blob(-6, -84, 10, c[4]);
    ctx.restore();""", """    const mp = MAP().tree;
    if (LOOK() === 'tropic') drawPalm(sx, sy, wob, mp);
    else {
      if (LOOK() === 'snow') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(sx, sy, 15, 6, 0, Math.PI, 0); ctx.fill(); }
      ctx.fillStyle = mp.mapleTrunk;
      roundRect(sx - 6, sy - 36, 12, 38, 4); ctx.fill();
      ctx.save();
      ctx.translate(sx + wob, sy);
      const blob = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
      const c = mp.maple;
      blob(0, -54, 28, c[0]); blob(-16, -62, 19, c[1]); blob(16, -60, 20, c[2]);
      blob(0, -78, 21, c[3]); blob(-6, -84, 10, c[4]);
      ctx.restore();
    }""")

# --- roofs: snow blankets with icicles up north, thatch in the tropics
rep("""    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(sx - hw - 10, sy - H - 2, B.w + 20, 5);
    if (R.top) R.top(sx, sy, back, H);""", """    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(sx - hw - 10, sy - H - 2, B.w + 20, 5);
    roofDress(sx - hw - 8, sy - H - back - 8, B.w + 16, back + 10, THATCH.has(R.key));
    if (R.top) R.top(sx, sy, back, H);""")
rep("""  function dispatchMast(sx, sy, back, H) {""", """  // map dressing for a roof face (x, y, w, h): snow + icicles, or straw thatch with a fringe
  const THATCH = new Set(['shack', 'workshop', 'vstore', 'sawmill', 'rail', 'dispatch', 'harbor']);
  function roofDress(x, y, w, h, thatch) {
    const look = LOOK();
    if (look === 'snow') {
      ctx.fillStyle = '#f6f9fb';
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.7);
      for (let k = 1; k <= 8; k++) { const px = x + w - (w * k) / 8; ctx.quadraticCurveTo(px + w / 16, y + h * (k % 2 ? 0.95 : 0.6), px, y + h * 0.72); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#dbe9f1';
      for (let px = x + 8; px < x + w - 4; px += 13) { const l = 5 + ((px * 7) % 9); ctx.beginPath(); ctx.moveTo(px - 2.5, y + h); ctx.lineTo(px + 2.5, y + h); ctx.lineTo(px, y + h + l); ctx.fill(); }
    } else if (look === 'tropic' && thatch) {
      ctx.fillStyle = '#c9a35a'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(120,85,35,.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let py = y + 6; py < y + h; py += 7) for (let px = x + ((py * 5) % 9); px < x + w; px += 9) { ctx.moveTo(px, py); ctx.lineTo(px + 3, py + 5); }
      ctx.stroke();
      ctx.fillStyle = '#b38b45';
      ctx.beginPath(); ctx.moveTo(x, y + h);
      for (let px = x; px <= x + w; px += 8) { ctx.lineTo(px + 4, y + h + 7); ctx.lineTo(px + 8, y + h); }
      ctx.closePath(); ctx.fill();
    }
  }

  function dispatchMast(sx, sy, back, H) {""")
rep("""      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.moveTo(sx, sy - H - 36); ctx.lineTo(sx + hw + 8, sy - H); ctx.lineTo(sx + hw + 8, sy - H - back); ctx.lineTo(sx, sy - H - 36 - back); ctx.closePath(); ctx.fill();""",
"""      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.moveTo(sx, sy - H - 36); ctx.lineTo(sx + hw + 8, sy - H); ctx.lineTo(sx + hw + 8, sy - H - back); ctx.lineTo(sx, sy - H - 36 - back); ctx.closePath(); ctx.fill();
      if (LOOK() === 'snow') {
        ctx.fillStyle = '#f6f9fb';
        ctx.beginPath(); ctx.moveTo(sx - hw * 0.55, sy - H - 16); ctx.lineTo(sx, sy - H - 38); ctx.lineTo(sx + hw * 0.55, sy - H - 16); ctx.quadraticCurveTo(sx, sy - H - 26, sx - hw * 0.55, sy - H - 16); ctx.fill();
      } else if (LOOK() === 'tropic') {
        ctx.fillStyle = 'rgba(201,163,90,.85)';
        ctx.beginPath(); ctx.moveTo(sx - hw - 8, sy - H); ctx.lineTo(sx, sy - H - 36); ctx.lineTo(sx + hw + 8, sy - H); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(120,85,35,.45)'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let k = -3; k <= 3; k++) { ctx.moveTo(sx, sy - H - 36); ctx.lineTo(sx + k * (hw + 8) / 3, sy - H); }
        ctx.stroke();
      }""")

# --- weather over the whole view
rep("""    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(225,240,255,.16)'); g.addColorStop(0.45, 'rgba(225,240,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();""", """    drawWeather(time);
    ctx.restore();""")
rep("""  function roundRect(x, y, w, h, r) {""", """  // light and weather: soft sky, falling snow up north, warm haze and cloud shadows in the tropics
  function drawWeather(time) {
    const look = LOOK();
    const sky = { farm: '225,240,255', snow: '200,220,240', tropic: '255,225,160' }[look];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(${sky},${look === 'farm' ? 0.16 : 0.24})`); g.addColorStop(0.45, `rgba(${sky},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (look === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let k = 0; k < 90; k++) {
        const sp = 30 + 40 * hash(k, 1), r = 1.2 + 2 * hash(k, 2);
        const y = (hash(k, 3) * (H + 20) + time * sp - cam.y * 0.3) % (H + 20) - 10;
        const x = ((hash(k, 4) * (W + 40) + Math.sin(time * 0.8 + k) * 14 - cam.x * 0.3) % (W + 40) + W + 40) % (W + 40) - 20;
        ctx.beginPath(); ctx.arc(x, (y + H + 20) % (H + 20) - 10, r, 0, Math.PI * 2); ctx.fill();
      }
    } else if (look === 'tropic') {
      ctx.fillStyle = 'rgba(20,50,40,.08)';
      for (let k = 0; k < 4; k++) {
        const wx = (hash(k, 5) * WORLD_W + time * 22) % (WORLD_W + 800) - 400, wy = hash(k, 6) * WORLD_H;
        const [cx, cy] = toScreen(wx, wy);
        if (cx < -400 || cx > W + 400 || cy < -300 || cy > H + 300) continue;
        ctx.beginPath(); ctx.ellipse(cx, cy, 260, 120, 0, 0, Math.PI * 2); ctx.ellipse(cx + 140, cy - 40, 160, 90, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function roundRect(x, y, w, h, r) {""")

# --- mini map sea
rep("rect(SEA.x0, 0, WORLD_W, SEA.y1, '#4f8fb3');", "rect(SEA.x0, 0, WORLD_W, SEA.y1, MAP().sea);")

p.write_text(s)
print('patched')
