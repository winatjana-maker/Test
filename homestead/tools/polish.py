# One-off patch: polished-cartoon pass (outlines, soft shading, textured ground, nicer people/trees/buildings).
import pathlib
p = pathlib.Path(__file__).parent.parent / 'src/game.js'
s = p.read_text()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)

# ---------- shared helpers: outline colour, colour shading, cached ground textures ----------
rep("""  function roundRect(x, y, w, h, r) {""", """  // cartoon outline and colour helpers
  const OUT = 'rgba(43,34,24,.62)';
  const outline = (w = 1.8) => { ctx.lineWidth = w; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); };
  function shade(hex, k) {   // k < 0 darkens, k > 0 lightens
    const n = parseInt(hex.slice(1), 16), t = k < 0 ? 0 : 255, a = Math.abs(k);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (t - v) * a));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  // ground textures: painted once per map into a small tile, then repeated (one fill per frame)
  const PAT = {};
  function texture(key, base, paint) {
    if (PAT[key]) return PAT[key];
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N * 2;
    const g = c.getContext('2d'); g.scale(2, 2);
    g.fillStyle = base; g.fillRect(0, 0, N, N);
    const rnd = seeded(key.length * 97 + 13);
    const wrap = f => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(dx, dy); f(); g.restore(); } };
    paint(g, rnd, wrap, N);
    return (PAT[key] = ctx.createPattern(c, 'repeat'));
  }
  function grassTex() {
    const m = MAP(), look = LOOK();
    return texture('grass-' + m.name, m.ground[0], (g, rnd, wrap, N) => {
      // soft colour patches
      for (let i = 0; i < 14; i++) {
        const x = rnd() * N, y = rnd() * N, r = 18 + rnd() * 34, c = rnd() < 0.5 ? shade(m.ground[0], -0.06) : shade(m.ground[0], 0.07);
        wrap(() => { g.fillStyle = c; g.globalAlpha = 0.6; g.beginPath(); g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; });
      }
      if (look === 'snow') {
        for (let i = 0; i < 160; i++) { const x = rnd() * N, y = rnd() * N, c = rnd() < 0.6 ? 'rgba(150,175,200,.35)' : 'rgba(255,255,255,.9)';
          wrap(() => { g.fillStyle = c; g.fillRect(x, y, 1.6, 1.2); }); }
        return;
      }
      // little grass blades in a darker and a lighter tone
      g.lineCap = 'round'; g.lineWidth = 1.3;
      for (let i = 0; i < 220; i++) {
        const x = rnd() * N, y = rnd() * N, h = 3 + rnd() * 4, lean = (rnd() - 0.5) * 3;
        const c = rnd() < 0.65 ? shade(m.ground[0], -0.16) : shade(m.ground[0], 0.16);
        wrap(() => { g.strokeStyle = c; g.beginPath(); g.moveTo(x, y); g.lineTo(x + lean, y - h); g.stroke(); });
      }
    });
  }
  function plazaTex() {
    const m = MAP(), look = LOOK();
    return texture('plaza-' + m.name, m.plaza, (g, rnd, wrap, N) => {
      for (let i = 0; i < 10; i++) {
        const x = rnd() * N, y = rnd() * N, r = 16 + rnd() * 30, c = rnd() < 0.5 ? shade(m.plaza, -0.05) : shade(m.plaza, 0.06);
        wrap(() => { g.fillStyle = c; g.globalAlpha = 0.7; g.beginPath(); g.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; });
      }
      // pebbles (sand grains and shells on the coast, packed-snow specks up north)
      const n = look === 'snow' ? 90 : 120;
      for (let i = 0; i < n; i++) {
        const x = rnd() * N, y = rnd() * N, r = 0.8 + rnd() * (look === 'snow' ? 1 : 1.8);
        const c = look === 'snow' ? (rnd() < 0.5 ? 'rgba(255,255,255,.9)' : 'rgba(120,140,160,.35)')
          : look === 'tropic' && rnd() < 0.08 ? '#f6e9e0' : rnd() < 0.6 ? shade(m.plaza, -0.22) : shade(m.plaza, 0.18);
        wrap(() => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2); g.fill(); });
      }
    });
  }
  // anchor a texture to the world so it scrolls with the ground
  function anchored(pat) { const [x0, y0] = toScreen(0, 0); pat.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, x0, y0])); return pat; }

  function roundRect(x, y, w, h, r) {""")
rep("    for (const k in varCache) delete varCache[k];\n", "    for (const k in varCache) delete varCache[k];\n    for (const k in PAT) delete PAT[k];\n")

# ---------- ground: textured grass; farm drops the hard checkerboard ----------
rep("""    ctx.fillStyle = getVar('--ground'); ctx.fillRect(x0, y0, fw, fh);
    const th = TILE * TILT;""", """    ctx.fillStyle = anchored(grassTex()); ctx.fillRect(Math.max(x0, -10), Math.max(y0, -10), Math.min(fw, W + 20), Math.min(fh, H + 20));
    const th = TILE * TILT;""")
rep("""      ctx.fillStyle = getVar('--ground-dark');
      for (let j = j0; j < j1; j++) if (j % 2 === 0) ctx.fillRect(x0 + i0 * TILE, y0 + j * th, (i1 - i0) * TILE, th);""",
"""      ctx.fillStyle = 'rgba(30,80,20,.07)';
      for (let j = j0; j < j1; j++) if (j % 2 === 0) ctx.fillRect(x0 + i0 * TILE, y0 + j * th, (i1 - i0) * TILE, th);""")
rep("""    } else {
      ctx.fillStyle = getVar('--ground-dark');
      for (let j = j0; j < j1; j++)
        for (let i = i0; i < i1; i++)
          if ((i + j) % 2 === 0) ctx.fillRect(x0 + i * TILE, y0 + j * th, TILE, th);
    }""", """    } else {
      // meadow: a faint field grid plus darker and lighter clumps
      ctx.fillStyle = 'rgba(40,70,20,.05)';
      for (let j = j0; j < j1; j++)
        for (let i = i0; i < i1; i++)
          if ((i + j) % 2 === 0) ctx.fillRect(x0 + i * TILE, y0 + j * th, TILE, th);
      for (let j = j0; j < j1; j++)
        for (let i = i0; i < i1; i++) {
          const h = hash(i, j);
          if (h < 0.1) blob(x0 + (i + hash(i, j, 1)) * TILE, y0 + (j + hash(i, j, 2)) * th, 22 + 30 * hash(i, j, 3), 'rgba(60,100,30,.12)');
          else if (h > 0.93) blob(x0 + (i + hash(i, j, 1)) * TILE, y0 + (j + hash(i, j, 2)) * th, 16 + 22 * hash(i, j, 3), 'rgba(255,255,200,.1)');
        }
    }""")
rep("""    ctx.fillStyle = MAP().plaza;
    for (const r of plazas) { groundRect(...r); ctx.fill(); }""", """    ctx.fillStyle = anchored(plazaTex());
    for (const r of plazas) { groundRect(...r); ctx.fill(); }""")

# ---------- people: outlines, shoes, shirt shading, smile ----------
rep("""  function drawPerson(sx, sy, o) {
    ctx.fillStyle = 'rgba(30,40,20,.28)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 16, 16 * TILT, 0, 0, Math.PI * 2); ctx.fill();""", """  function drawPerson(sx, sy, o) {
    ctx.fillStyle = 'rgba(30,40,20,.14)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 18, 18 * TILT, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(30,40,20,.2)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 12, 12 * TILT, 0, 0, Math.PI * 2); ctx.fill();""")
rep("""    const limb = (x, y, a, w, h, c) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = c; roundRect(-w / 2, 0, w, h, w / 2); ctx.fill(); ctx.restore(); };
    const armSwing = o.arms === 'work' ? Math.sin(o.walk * 1.6) * 0.9 - 0.6 : swing;
    if (o.arms !== false) limb(-6, -31, armSwing, 5, 15, o.skin);                 // back arm
    limb(-4.5, -13, swing, 5.5, 12, o.pants || '#3d3a4f');                         // legs
    limb(4.5, -13, -swing, 5.5, 12, o.pants || '#3d3a4f');
    ctx.fillStyle = o.shirt;
    roundRect(-11, -34, 22, 24, 8); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    ctx.fillRect(-11, -16, 22, 3);
    if (o.pack) { ctx.fillStyle = '#8a6a43'; roundRect(-15, -32, 7, 16, 3); ctx.fill(); }
    ctx.fillStyle = o.skin;
    ctx.beginPath(); ctx.arc(1, -44, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-6, -43, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = o.hair;
    ctx.beginPath(); ctx.arc(1, -45, 11.6, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.fillRect(-10.5, -47, 7, 4);
    if (o.beard) { ctx.beginPath(); ctx.arc(2, -42, 10, Math.PI * 0.05, Math.PI * 0.6); ctx.lineTo(4, -40); ctx.closePath(); ctx.fill(); }
    if (o.hat) { ctx.fillStyle = o.hat; ctx.beginPath(); ctx.arc(1, -47, 12, Math.PI, 0); ctx.fill(); ctx.fillRect(-11, -48, 26, 3); }
    ctx.fillStyle = '#f5ece0';
    ctx.beginPath(); ctx.arc(6.5, -45, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16120f';
    ctx.beginPath(); ctx.arc(7.2, -45, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(4.5, -49, 5, 1.4);
    if (o.arms !== false) {                                                       // front arm, in a sleeve
      ctx.save(); ctx.translate(5, -31); ctx.rotate(o.arms === 'work' ? -armSwing : -swing);
      ctx.fillStyle = o.shirt; roundRect(-3, 0, 6, 8, 3); ctx.fill();
      ctx.fillStyle = o.skin; roundRect(-2.5, 6, 5, 9, 2.5); ctx.fill();
      ctx.restore();
    }""", """    const pants = o.pants || '#3d3a4f';
    const limb = (x, y, a, w, h, c, shoe) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = c; roundRect(-w / 2, 0, w, h, w / 2); ctx.fill(); outline(1.4);
      if (shoe) { ctx.fillStyle = '#2b2520'; roundRect(-w / 2 - 0.5, h - 3.5, w + 3, 4.5, 2); ctx.fill(); }
      ctx.restore();
    };
    const armSwing = o.arms === 'work' ? Math.sin(o.walk * 1.6) * 0.9 - 0.6 : swing;
    if (o.arms !== false) limb(-6, -31, armSwing, 5, 15, shade(o.skin, -0.12));   // back arm, in shade
    limb(-4.5, -13, swing, 5.5, 12, shade(pants, -0.1), true);                    // legs
    limb(4.5, -13, -swing, 5.5, 12, pants, true);
    if (o.pack) { ctx.fillStyle = '#8a6a43'; roundRect(-15.5, -32, 8, 17, 3); ctx.fill(); outline(1.4); ctx.fillStyle = '#6e5030'; ctx.fillRect(-15.5, -27, 8, 2); }
    // shirt: rounded body, lit from the upper left
    ctx.fillStyle = o.shirt;
    roundRect(-11, -34, 22, 24, 8); ctx.fill();
    ctx.save(); roundRect(-11, -34, 22, 24, 8); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-11, -34, 8, 24);
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(4, -34, 8, 24); ctx.fillRect(-11, -16, 22, 3);
    ctx.restore();
    roundRect(-11, -34, 22, 24, 8); outline();
    // head
    ctx.fillStyle = o.skin;
    ctx.beginPath(); ctx.ellipse(-6, -43, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill(); outline(1.3);
    ctx.beginPath(); ctx.arc(1, -44, 11, 0, Math.PI * 2); ctx.fill(); outline();
    ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.beginPath(); ctx.arc(1, -44, 11, Math.PI * 0.15, Math.PI * 0.85); ctx.arc(1, -47, 10, Math.PI * 0.85, Math.PI * 0.15, true); ctx.fill();
    ctx.fillStyle = o.hair;
    ctx.beginPath(); ctx.arc(1, -45, 11.6, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); outline(1.4);
    ctx.fillRect(-10.5, -47, 7, 4);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.ellipse(-2, -53, 5, 2, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = o.hair;
    if (o.beard) { ctx.beginPath(); ctx.arc(2, -42, 10, Math.PI * 0.05, Math.PI * 0.6); ctx.lineTo(4, -40); ctx.closePath(); ctx.fill(); }
    if (o.hat) { ctx.fillStyle = o.hat; ctx.beginPath(); ctx.arc(1, -47, 12, Math.PI, 0); ctx.closePath(); ctx.fill(); outline(1.4); roundRect(-11, -49, 26, 3.5, 1.5); ctx.fill(); outline(1.2); }
    // face: eye with a glint, brow, cheek and a small smile
    ctx.fillStyle = '#f5ece0';
    ctx.beginPath(); ctx.arc(6.5, -45, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16120f';
    ctx.beginPath(); ctx.arc(7.3, -45, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(7.4, -46.4, 0.9, 0.9);
    ctx.fillStyle = '#16120f'; ctx.fillRect(4.5, -49.2, 5, 1.4);
    ctx.fillStyle = 'rgba(230,110,90,.28)'; ctx.beginPath(); ctx.arc(5, -40.5, 2.4, 0, Math.PI * 2); ctx.fill();
    if (!o.beard) { ctx.strokeStyle = 'rgba(40,20,10,.7)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(8, -40.5, 2.2, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke(); }
    if (o.arms !== false) {                                                       // front arm, in a sleeve
      ctx.save(); ctx.translate(5, -31); ctx.rotate(o.arms === 'work' ? -armSwing : -swing);
      ctx.fillStyle = o.skin; roundRect(-2.5, 6, 5, 9, 2.5); ctx.fill(); outline(1.3);
      ctx.fillStyle = o.shirt; roundRect(-3, 0, 6, 8, 3); ctx.fill(); outline(1.3);
      ctx.restore();
    }""")

# ---------- trees: one outline around each crown, shading and a highlight ----------
rep("""    ctx.fillStyle = trunk;
    const th = n.species === 'redwood' ? 60 : 34;
    roundRect(sx - 6 * s, sy - th * s, 12 * s, (th + 2) * s, 4); ctx.fill();""", """    ctx.fillStyle = trunk;
    const th = n.species === 'redwood' ? 60 : 34;
    roundRect(sx - 6 * s, sy - th * s, 12 * s, (th + 2) * s, 4); ctx.fill(); outline(1.6);""")
rep("""      const blob = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2); ctx.fill(); };
      const c = pal.oak;
      blob(0, -50, 32, c[0]); blob(-18, -58, 22, c[1]); blob(18, -56, 23, c[2]);
      blob(0, -74, 24, c[3]); blob(-8, -80, 11, c[4]);""", """      crown(s, pal.oak, [[0, -50, 32], [-18, -58, 22], [18, -56, 23], [0, -74, 24], [-8, -80, 11]]);""")
rep("""      for (let i = 0; i < layers; i++) {
        const y = base - i * step, half = (26 - i * (n.species === 'redwood' ? 3.5 : 5)) * 1.0;
        ctx.fillStyle = cols[i];
        ctx.beginPath();
        ctx.moveTo(-half * s, y * s); ctx.lineTo(half * s, y * s); ctx.lineTo(0, (y - 34) * s);
        ctx.closePath(); ctx.fill();""", """      const tri = i => {
        const y = base - i * step, half = (26 - i * (n.species === 'redwood' ? 3.5 : 5));
        ctx.beginPath(); ctx.moveTo(-half * s, y * s); ctx.quadraticCurveTo(0, (y + 5) * s, half * s, y * s); ctx.lineTo(0, (y - 34) * s); ctx.closePath();
        return [y, half];
      };
      ctx.strokeStyle = OUT; ctx.lineWidth = 3.4; ctx.lineJoin = 'round';
      for (let i = 0; i < layers; i++) { tri(i); ctx.stroke(); }
      for (let i = 0; i < layers; i++) {
        const [y, half] = tri(i);
        ctx.fillStyle = cols[i]; ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.13)';      // shaded right side
        ctx.beginPath(); ctx.moveTo(0, (y - 34) * s); ctx.lineTo(half * s, y * s); ctx.quadraticCurveTo(half * 0.5 * s, (y + 3.5) * s, 0, (y + 2.5) * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.12)';  // lit left edge
        ctx.beginPath(); ctx.moveTo(0, (y - 34) * s); ctx.lineTo(-half * 0.55 * s, (y - 12) * s); ctx.lineTo(-half * 0.2 * s, (y - 12) * s); ctx.closePath(); ctx.fill();""")
rep("""  function tropicTree(sx, sy, s, species, wob, pal) {""", """  // a leafy crown from overlapping circles: shared outline, then fills, shade on the lower right, highlight top left
  function crown(s, cols, blobs) {
    ctx.fillStyle = OUT;
    for (const [x, y, r] of blobs) { ctx.beginPath(); ctx.arc(x * s, y * s, (r + 1.8) * s, 0, Math.PI * 2); ctx.fill(); }
    blobs.forEach(([x, y, r], i) => { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2); ctx.fill(); });
    const [bx, by, br] = blobs[0];
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.beginPath(); ctx.arc(bx * s, by * s, br * s, -0.2, Math.PI * 0.9); ctx.arc((bx - 6) * s, (by - 9) * s, br * 0.9 * s, Math.PI * 0.9, -0.2, true); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    const [hx, hy, hr] = blobs[3];
    ctx.beginPath(); ctx.ellipse((hx - hr * 0.35) * s, (hy - hr * 0.35) * s, hr * 0.45 * s, hr * 0.3 * s, -0.5, 0, Math.PI * 2); ctx.fill();
  }

  function tropicTree(sx, sy, s, species, wob, pal) {""")
rep("""      ctx.fillStyle = mp.mapleTrunk;
      roundRect(sx - 6, sy - 36, 12, 38, 4); ctx.fill();
      ctx.save();
      ctx.translate(sx + wob, sy);
      const blob = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
      const c = mp.maple;
      blob(0, -54, 28, c[0]); blob(-16, -62, 19, c[1]); blob(16, -60, 20, c[2]);
      blob(0, -78, 21, c[3]); blob(-6, -84, 10, c[4]);
      ctx.restore();""", """      ctx.fillStyle = mp.mapleTrunk;
      roundRect(sx - 6, sy - 36, 12, 38, 4); ctx.fill(); outline(1.6);
      ctx.save();
      ctx.translate(sx + wob, sy);
      crown(1, mp.maple, [[0, -54, 28], [-16, -62, 19], [16, -60, 20], [0, -78, 21], [-6, -84, 10]]);
      ctx.restore();""")
# teak canopies and palm trunk get an outline too
rep("""        ctx.fillStyle = c[i + 1]; ctx.beginPath(); ctx.ellipse(0, y * s, r * s, r * 0.36 * s, 0, 0, Math.PI * 2); ctx.fill();""",
    """        ctx.fillStyle = c[i + 1]; ctx.beginPath(); ctx.ellipse(0, y * s, r * s, r * 0.36 * s, 0, 0, Math.PI * 2); ctx.fill(); outline(1.6);""")
rep("""    ctx.strokeStyle = mp.mapleTrunk; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - 4, sy - 50, sx + 10 + wob, sy - 88); ctx.stroke();""",
"""    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = 12.5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - 4, sy - 50, sx + 10 + wob, sy - 88); ctx.stroke();
    ctx.strokeStyle = mp.mapleTrunk; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - 4, sy - 50, sx + 10 + wob, sy - 88); ctx.stroke();""")
# softer two-step tree shadow
rep("""    ctx.fillStyle = 'rgba(30,40,20,.26)';
    ctx.beginPath(); ctx.ellipse(sx + 6, sy + 2, 28 * s, 28 * s * TILT, 0, 0, Math.PI * 2); ctx.fill();
    treeBody(sx, sy, s, n.species, wob);""", """    ctx.fillStyle = 'rgba(30,40,20,.13)';
    ctx.beginPath(); ctx.ellipse(sx + 8, sy + 2, 33 * s, 33 * s * TILT, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx + 5, sy + 1, 22 * s, 22 * s * TILT, 0, 0, Math.PI * 2); ctx.fill();
    treeBody(sx, sy, s, n.species, wob);""")

# ---------- roofed buildings: outlines, wall shading, window frames, a stone base ----------
rep("""    // inside of the back wall, a little darker than the outside
    ctx.fillStyle = R.wall;
    ctx.fillRect(sx - hw, sy - back - H, B.w, H);""", """    // inside of the back wall, a little darker than the outside
    ctx.fillStyle = R.wall;
    ctx.fillRect(sx - hw, sy - back - H, B.w, H);
    ctx.beginPath(); ctx.rect(sx - hw, sy - back - H, B.w, H); outline(2);""")
rep("""    // front wall with siding
    ctx.fillStyle = R.wall;
    ctx.fillRect(sx - hw, sy - H, B.w, H);
    ctx.fillStyle = 'rgba(0,0,0,.07)';
    for (let y = sy - H + 7; y < sy; y += 8) ctx.fillRect(sx - hw, y, B.w, 1);""", """    ctx.beginPath(); ctx.rect(sx - hw, sy - back - H, 7, back + H); ctx.rect(sx + hw - 7, sy - back - H, 7, back + H); outline(1.6);
    // front wall with siding, darker towards the ground, on a stone base
    ctx.fillStyle = R.wall;
    ctx.fillRect(sx - hw, sy - H, B.w, H);
    ctx.fillStyle = 'rgba(0,0,0,.07)';
    for (let y = sy - H + 7; y < sy; y += 8) ctx.fillRect(sx - hw, y, B.w, 1);
    const wg = ctx.createLinearGradient(0, sy - H, 0, sy);
    wg.addColorStop(0, 'rgba(255,255,255,.08)'); wg.addColorStop(0.6, 'rgba(0,0,0,0)'); wg.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = wg; ctx.fillRect(sx - hw, sy - H, B.w, H);
    ctx.fillStyle = '#8f877a'; ctx.fillRect(sx - hw, sy - 7, B.w, 7);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let x = sx - hw + 10; x < sx + hw; x += 18) ctx.fillRect(x, sy - 7, 1.5, 7);
    ctx.beginPath(); ctx.rect(sx - hw, sy - H, B.w, H); outline(2);""")
rep("""        ctx.fillStyle = '#fffaf0'; roundRect(x - 2, sy - H + 14, 30, 26, R.arched ? 12 : 3); ctx.fill();
        ctx.fillStyle = '#9ec9de'; roundRect(x + 1, sy - H + 17, 24, 20, R.arched ? 10 : 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x + 4, sy - H + 19, 5, 16);""", """        ctx.fillStyle = '#fffaf0'; roundRect(x - 2, sy - H + 14, 30, 26, R.arched ? 12 : 3); ctx.fill(); outline(1.4);
        const gl = ctx.createLinearGradient(0, sy - H + 17, 0, sy - H + 37);
        gl.addColorStop(0, '#bfe0ee'); gl.addColorStop(1, '#7fb0c8');
        ctx.fillStyle = gl; roundRect(x + 1, sy - H + 17, 24, 20, R.arched ? 10 : 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.moveTo(x + 4, sy - H + 35); ctx.lineTo(x + 12, sy - H + 18); ctx.lineTo(x + 16, sy - H + 18); ctx.lineTo(x + 8, sy - H + 35); ctx.fill();
        ctx.fillStyle = '#fffaf0'; ctx.fillRect(x + 12, sy - H + 17, 2, 20);
        ctx.fillStyle = shade(R.wall, -0.3); ctx.fillRect(x - 4, sy - H + 40, 34, 3);""")
rep("""      ctx.fillStyle = '#fffaf0'; ctx.fillRect(sx - 20, sy - dh - 3, 40, dh + 3);
      ctx.fillStyle = '#5a3a28'; ctx.fillRect(sx - 17, sy - dh, 34, dh);""", """      ctx.fillStyle = '#fffaf0'; ctx.fillRect(sx - 20, sy - dh - 3, 40, dh + 3);
      ctx.beginPath(); ctx.rect(sx - 20, sy - dh - 3, 40, dh + 3); outline(1.4);
      ctx.fillStyle = '#5a3a28'; ctx.fillRect(sx - 17, sy - dh, 34, dh);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(sx - 14, sy - dh + 4, 12, dh * 0.4); ctx.fillRect(sx + 2, sy - dh + 4, 12, dh * 0.4);""")
rep("""        ctx.fillStyle = '#5f6b7a'; ctx.fillRect(sx + dx - 28, sy - 48, 56, 48);""",
    """        ctx.fillStyle = '#5f6b7a'; ctx.fillRect(sx + dx - 28, sy - 48, 56, 48); ctx.beginPath(); ctx.rect(sx + dx - 28, sy - 48, 56, 48); outline(1.4);""")
rep("""    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(sx - hw - 8, sy - H - back - 8, B.w + 16, 3);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(sx - hw - 10, sy - H - 2, B.w + 20, 5);""", """    const rg = ctx.createLinearGradient(0, sy - H - back - 8, 0, sy - H + 2);
    rg.addColorStop(0, 'rgba(255,255,255,.16)'); rg.addColorStop(1, 'rgba(0,0,0,.12)');
    ctx.fillStyle = rg; ctx.fillRect(sx - hw - 8, sy - H - back - 8, B.w + 16, back + 10);
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.fillRect(sx - hw - 8, sy - H - back - 8, B.w + 16, 3);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(sx - hw - 10, sy - H - 2, B.w + 20, 5);
    ctx.beginPath(); ctx.rect(sx - hw - 8, sy - H - back - 8, B.w + 16, back + 10); outline(2.2);""")
# softer building ground shadow
rep("""    ctx.fillStyle = 'rgba(30,40,20,.22)';
    roundRect(sx - hw - 4, sy - back + 4, B.w + 16, back + 10, 8); ctx.fill();""", """    ctx.fillStyle = 'rgba(30,40,20,.12)';
    roundRect(sx - hw - 8, sy - back + 2, B.w + 28, back + 16, 14); ctx.fill();
    roundRect(sx - hw - 3, sy - back + 4, B.w + 14, back + 9, 8); ctx.fill();""")

# ---------- store: outlines on walls, counter and awning; shaded back wall ----------
rep("""    ctx.fillStyle = '#e9d8b4';
    ctx.fillRect(sx - hw, sy - back - 74, STORE.w, 74);
    ctx.fillStyle = '#d8c39a';
    for (let x = sx - hw + 20; x < sx + hw; x += 20) ctx.fillRect(x, sy - back - 74, 2, 74);""", """    ctx.fillStyle = '#e9d8b4';
    ctx.fillRect(sx - hw, sy - back - 74, STORE.w, 74);
    ctx.fillStyle = '#d8c39a';
    for (let x = sx - hw + 20; x < sx + hw; x += 20) ctx.fillRect(x, sy - back - 74, 2, 74);
    { const g = ctx.createLinearGradient(0, sy - back - 74, 0, sy - back);
      g.addColorStop(0, 'rgba(0,0,0,.12)'); g.addColorStop(0.4, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.1)');
      ctx.fillStyle = g; ctx.fillRect(sx - hw, sy - back - 74, STORE.w, 74); }
    ctx.beginPath(); ctx.rect(sx - hw, sy - back - 74, STORE.w, 74); outline(2);""")
rep("""    ctx.fillRect(sx - hw, sy - back - 86, 8, back + 86);
    ctx.fillRect(sx + hw - 8, sy - back - 86, 8, back + 86);
    if (level.cashier) {""", """    ctx.fillRect(sx - hw, sy - back - 86, 8, back + 86);
    ctx.fillRect(sx + hw - 8, sy - back - 86, 8, back + 86);
    ctx.beginPath(); ctx.rect(sx - hw, sy - back - 86, 8, back + 86); ctx.rect(sx + hw - 8, sy - back - 86, 8, back + 86); outline(1.6);
    if (level.cashier) {""")
rep("""    ctx.fillStyle = '#c49565';
    ctx.fillRect(sx - hw - 4, sy - 36, STORE.w + 8, 8);""", """    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(sx - hw, sy - 12, STORE.w, 12);
    ctx.beginPath(); ctx.rect(sx - hw, sy - 30, STORE.w, 30); outline(2);
    ctx.fillStyle = '#c49565';
    ctx.fillRect(sx - hw - 4, sy - 36, STORE.w + 8, 8);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(sx - hw - 4, sy - 36, STORE.w + 8, 2);
    ctx.beginPath(); ctx.rect(sx - hw - 4, sy - 36, STORE.w + 8, 8); outline(1.6);""")
rep("""      ctx.moveTo(x, top); ctx.lineTo(x + seg, top); ctx.lineTo(x + seg, top + h);
      ctx.arc(x + seg / 2, top + h, seg / 2, 0, Math.PI);
      ctx.closePath(); ctx.fill();
    }""", """      ctx.moveTo(x, top); ctx.lineTo(x + seg, top); ctx.lineTo(x + seg, top + h);
      ctx.arc(x + seg / 2, top + h, seg / 2, 0, Math.PI);
      ctx.closePath(); ctx.fill(); outline(1.5);
    }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(sx - hw - 10, top + h * 0.55, STORE.w + 20, h * 0.45);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(sx - hw - 10, top, STORE.w + 20, 3);""")
rep("""    roundRect(sx - sw / 2, signY - 2, sw, 30, 8); ctx.fill();""", """    roundRect(sx - sw / 2, signY - 2, sw, 30, 8); ctx.fill(); outline(2);""")

# ---------- village houses: outlined walls and roofs ----------
rep("""      ctx.fillStyle = h.wall; ctx.fillRect(sx - hw, sy - H, B.w, H);
      ctx.fillStyle = 'rgba(0,0,0,.06)'; for (let y = sy - H + 6; y < sy; y += 7) ctx.fillRect(sx - hw, y, B.w, 1);""",
"""      ctx.fillStyle = h.wall; ctx.fillRect(sx - hw, sy - H, B.w, H);
      ctx.fillStyle = 'rgba(0,0,0,.06)'; for (let y = sy - H + 6; y < sy; y += 7) ctx.fillRect(sx - hw, y, B.w, 1);
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(sx - hw, sy - 10, B.w, 10);
      ctx.beginPath(); ctx.rect(sx - hw, sy - H, B.w, H); outline(1.8);""")
rep("""      ctx.beginPath(); ctx.moveTo(sx - hw - 8, sy - H); ctx.lineTo(sx, sy - H - 36); ctx.lineTo(sx + hw + 8, sy - H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)';""", """      ctx.beginPath(); ctx.moveTo(sx - hw - 8, sy - H); ctx.lineTo(sx, sy - H - 36); ctx.lineTo(sx + hw + 8, sy - H); ctx.closePath(); ctx.fill(); outline(1.8);
      ctx.fillStyle = 'rgba(0,0,0,.18)';""")

p.write_text(s)
print('patched')
