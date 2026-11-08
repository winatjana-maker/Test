/*
 * Tiny Fronts — screen, input and animation.
 */
(function () {
  'use strict';
  const G = window.Game;
  const AI = window.AI;
  const HUMAN = 0;

  const $ = (id) => document.getElementById(id);
  const canvas = $('board');
  const ctx = canvas.getContext('2d');

  let state = null;
  let ui = null;
  let tile = 40;
  let dpr = 1;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (x, y) => G.key(state, x, y);
  const fmt = (n) => n.toLocaleString('en-US');

  // ---------- game flow ----------
  function newGame() {
    state = G.createGame(G.MAPS[0]);
    ui = {
      mode: 'idle', sel: null, inspect: null, targets: null, strikeAt: null,
      display: {}, popups: [], flashes: [], busy: false, cursor: null,
    };
    hideOverlay();
    resize();
    showIdle();
    updateHud();
    toast('Day 1 · Your move');
  }

  function clearSelection() {
    if (ui.sel) delete ui.display[ui.sel.unitId];
    ui.mode = 'idle';
    ui.sel = null;
    ui.inspect = null;
    ui.targets = null;
    ui.strikeAt = null;
    ui.cursor = null;
  }

  function handleTap(x, y) {
    if (ui.busy || state.winner !== null || state.current !== HUMAN) return;
    const u = G.unitAt(state, x, y);

    switch (ui.mode) {
      case 'selected':
        if (ui.sel.reach.tiles.has(key(x, y))) return moveSelected(x, y);
        clearSelection();
        break;
      case 'moved':
        return cancelMove();
      case 'targeting': {
        const t = ui.targets.find((o) => o.target.x === x && o.target.y === y);
        if (t) return commit('attack', t.target.id);
        ui.mode = 'moved';
        ui.targets = null;
        return showActionMenu();
      }
      case 'strike':
        return aimStrike(x, y);
      default:
        clearSelection();
    }

    if (u && u.owner === HUMAN && !u.done) return selectUnit(u);
    if (u) return inspectUnit(u);
    const b = G.buildingAt(state, x, y);
    if (b && b.type === 'factory' && b.owner === HUMAN) return openBuild(b);
    ui.cursor = { x, y };
    showTileInfo(x, y);
  }

  function selectUnit(u) {
    const reach = G.reachable(state, u);
    ui.mode = 'selected';
    ui.sel = { unitId: u.id, reach, danger: dangerTiles(u, reach), dest: null };
    ui.cursor = { x: u.x, y: u.y };
    setPanel(unitInfo(u) + '<div class="muted">Tap a blue hex to move, or tap the unit again to stay.</div>', [
      { label: 'Cancel', onClick: () => { clearSelection(); showIdle(); } },
    ]);
  }

  function inspectUnit(u) {
    const reach = G.reachable(state, u);
    ui.mode = 'inspect';
    ui.inspect = { reach, danger: dangerTiles(u, reach), owner: u.owner };
    ui.cursor = { x: u.x, y: u.y };
    const note = u.owner === HUMAN ? 'Already moved this turn.' : 'Red shows where it can attack next turn.';
    setPanel(unitInfo(u) + `<div class="muted">${note}</div>`, []);
  }

  // Tiles a unit could hit next turn (from anywhere it can move).
  function dangerTiles(u, reach) {
    const def = G.UNITS[u.type];
    const out = new Set();
    const spots = def.indirect ? [{ x: u.x, y: u.y }] : [...reach.tiles.values()];
    for (const s of spots) {
      for (let dy = -def.maxRange; dy <= def.maxRange; dy++) {
        for (let dx = -def.maxRange - 1; dx <= def.maxRange + 1; dx++) {
          const x = s.x + dx;
          const y = s.y + dy;
          if (!G.inBounds(state, x, y)) continue;
          const d = G.dist(s.x, s.y, x, y);
          if (d >= def.minRange && d <= def.maxRange) out.add(key(x, y));
        }
      }
    }
    return out;
  }

  async function moveSelected(x, y) {
    const unit = G.getUnit(state, ui.sel.unitId);
    const path = G.pathTo(state, ui.sel.reach, x, y);
    ui.busy = true;
    await animatePath(unit.id, path);
    ui.busy = false;
    ui.sel.dest = { x, y };
    ui.cursor = { x, y };
    ui.mode = 'moved';
    showActionMenu();
  }

  function cancelMove() {
    const unit = G.getUnit(state, ui.sel.unitId);
    delete ui.display[unit.id];
    ui.sel.dest = null;
    selectUnit(unit);
  }

  function showActionMenu() {
    const unit = G.getUnit(state, ui.sel.unitId);
    const { x, y } = ui.sel.dest;
    const targets = G.attackTargets(state, unit, x, y);
    const buttons = [];
    if (targets.length) {
      buttons.push({ label: 'Attack', cls: 'danger', onClick: () => startTargeting(targets) });
    }
    if (G.canCapture(state, unit, x, y)) {
      const b = G.buildingAt(state, x, y);
      const left = Math.max(0, b.capture - G.displayHp(unit.hp));
      buttons.push({ label: left === 0 ? 'Capture!' : `Capture (${b.capture}→${left})`, cls: 'gold', onClick: () => commit('capture') });
    }
    buttons.push({ label: 'Wait', cls: 'primary', onClick: () => commit('wait') });
    buttons.push({ label: 'Back', onClick: cancelMove });
    let hint = 'Choose an action.';
    if (G.UNITS[unit.type].indirect && (x !== unit.x || y !== unit.y)) hint = 'Artillery can’t fire after moving.';
    setPanel(unitInfo(unit) + `<div class="muted">${hint}</div>`, buttons);
  }

  function startTargeting(targets) {
    const unit = G.getUnit(state, ui.sel.unitId);
    const { x, y } = ui.sel.dest;
    ui.mode = 'targeting';
    ui.targets = targets.map((t) => ({ target: t, preview: G.previewAttack(state, unit, x, y, t) }));
    const lines = ui.targets.map((o) => {
      const n = G.UNITS[o.target.type].name;
      const back = o.preview.counter ? `, takes ${o.preview.counter}% back` : ', no counter';
      return `${n}: deal ${Math.min(o.preview.damage, o.target.hp)}%${o.preview.damage >= o.target.hp ? ' (destroys it)' : back}`;
    });
    setPanel(`<div class="title">Pick a target</div><div class="muted">${lines.join('<br>')}</div>`, [
      { label: 'Back', onClick: () => { ui.mode = 'moved'; ui.targets = null; showActionMenu(); } },
    ]);
  }

  function commit(type, targetId) {
    const unitId = ui.sel.unitId;
    const to = ui.sel.dest;
    const res = G.performAction(state, { unitId, to, type, targetId });
    delete ui.display[unitId];
    clearSelection();
    showResult(res);
    showIdle();
    afterChange();
  }

  function showResult(res) {
    if (res.type === 'attack') {
      popup(res.target.x, res.target.y, `-${res.damage}%`, '#fecaca');
      flash(res.target.x, res.target.y, '#fff');
      if (res.counter) {
        setTimeout(() => {
          popup(res.to.x, res.to.y, `-${res.counter}%`, '#fecaca');
          flash(res.to.x, res.to.y, '#fff');
        }, 300);
      }
      for (const d of res.destroyed) setTimeout(() => boom(d.x, d.y), 250);
    } else if (res.type === 'capture') {
      if (res.captured) popup(res.to.x, res.to.y, res.building === 'hq' ? 'HQ taken!' : 'Captured!', '#fde047');
      else popup(res.to.x, res.to.y, `${res.captureLeft} left`, '#fde047');
    }
  }

  // ---------- building ----------
  function openBuild(b) {
    ui.mode = 'build';
    ui.cursor = { x: b.x, y: b.y };
    const funds = state.players[HUMAN].funds;
    const close = () => { hideOverlay(); clearSelection(); showIdle(); };
    showOverlay(`<h1>Build</h1><p>Funds <b>${fmt(funds)}</b>. New units can act next turn.</p>`, [
      { label: 'Close', onClick: close },
    ]);
    const list = document.createElement('div');
    list.className = 'build-list';
    for (const type of G.UNIT_ORDER) {
      const def = G.UNITS[type];
      const btn = document.createElement('button');
      btn.disabled = funds < def.cost;
      btn.innerHTML = `<span class="name">${def.name}<span class="cost">${fmt(def.cost)}</span></span><span class="blurb">${def.blurb}</span>`;
      btn.onclick = () => {
        G.buildUnit(state, b.x, b.y, type);
        popup(b.x, b.y, 'New!', '#bbf7d0');
        close();
        updateHud();
      };
      list.appendChild(btn);
    }
    const card = $('overlayCard');
    card.insertBefore(list, card.querySelector('.buttons'));
  }

  // ---------- air strike ----------
  function startStrike() {
    if (ui.busy || state.current !== HUMAN || state.players[HUMAN].strike < G.STRIKE_MAX) return;
    clearSelection();
    ui.mode = 'strike';
    setPanel(
      `<div class="title">Air strike</div><div class="muted">Hits a hex and the 6 around it for ${G.STRIKE_DAMAGE}% damage. Never destroys a unit. Tap a hex to aim, tap again to fire.</div>`,
      [{ label: 'Cancel', onClick: () => { clearSelection(); showIdle(); } }]
    );
  }

  function aimStrike(x, y) {
    if (ui.strikeAt && ui.strikeAt.x === x && ui.strikeAt.y === y) {
      const hits = G.useStrike(state, x, y);
      clearSelection();
      showStrike({ x, y }, hits);
      showIdle();
      updateHud();
      return;
    }
    ui.strikeAt = { x, y };
  }

  function showStrike(at, hits) {
    for (const t of G.strikeTiles(state, at.x, at.y)) flash(t.x, t.y, '#fde047', 700);
    for (const h of hits) popup(h.x, h.y, `-${h.damage}%`, '#fde047');
    if (!hits.length) popup(at.x, at.y, 'Miss', '#fde047');
  }

  // ---------- computer turn ----------
  async function endTurn() {
    if (ui.busy || state.current !== HUMAN || state.winner !== null) return;
    clearSelection();
    G.endTurn(state);
    ui.busy = true;
    showIdle();
    updateHud();
    toast('Orange’s turn');
    await sleep(500);

    const strike = AI.chooseStrike(state);
    if (strike) {
      ui.strikeAt = strike;
      await sleep(500);
      const hits = G.useStrike(state, strike.x, strike.y);
      ui.strikeAt = null;
      showStrike(strike, hits);
      updateHud();
      await sleep(700);
    }

    for (let guard = 0; guard < 200 && state.winner === null; guard++) {
      const act = AI.nextAction(state);
      if (!act) break;
      const unit = G.getUnit(state, act.unitId);
      ui.cursor = { x: unit.x, y: unit.y };
      await sleep(80);
      const path = G.pathTo(state, G.reachable(state, unit), act.to.x, act.to.y);
      await animatePath(unit.id, path);
      if (act.type === 'attack') {
        const t = G.getUnit(state, act.targetId);
        ui.cursor = { x: t.x, y: t.y };
        await sleep(220);
      }
      const res = G.performAction(state, act);
      delete ui.display[unit.id];
      ui.cursor = null;
      showResult(res);
      updateHud();
      await sleep(act.type === 'wait' ? 40 : 380);
    }

    if (state.winner === null) {
      for (const b of AI.planBuilds(state)) {
        G.buildUnit(state, b.x, b.y, b.type);
        popup(b.x, b.y, 'New!', '#fed7aa');
      }
      await sleep(400);
    }

    ui.busy = false;
    ui.cursor = null;
    if (state.winner !== null) return afterChange();
    const start = G.endTurn(state);
    updateHud();
    showIdle();
    toast(`Day ${state.day} · +${fmt(start.income)} funds`);
  }

  function afterChange() {
    updateHud();
    if (state.winner === null) return;
    const won = state.winner === HUMAN;
    const why = state.winReason === 'hq'
      ? (won ? 'You captured the enemy HQ.' : 'Orange captured your HQ.')
      : (won ? 'You destroyed every enemy unit.' : 'All your units were destroyed.');
    setTimeout(() => {
      showOverlay(`<h1>${won ? 'Victory!' : 'Defeat'}</h1><p>${why} It took ${state.day} day${state.day > 1 ? 's' : ''}.</p>`, [
        { label: 'Play again', cls: 'primary', onClick: newGame },
      ]);
    }, 900);
  }

  // ---------- panel & HUD ----------
  function setPanel(html, buttons) {
    $('info').innerHTML = html;
    const box = $('actions');
    box.innerHTML = '';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.textContent = b.label;
      if (b.cls) el.className = b.cls;
      el.onclick = b.onClick;
      box.appendChild(el);
    }
  }

  function showIdle() {
    if (state.current !== HUMAN) {
      setPanel('<div class="title">Orange is moving…</div><div class="muted">Watch what they do.</div>', []);
      return;
    }
    const ready = state.units.filter((u) => u.owner === HUMAN && !u.done).length;
    setPanel(
      `<div class="title">Your turn</div><div class="muted">${ready ? `${ready} unit${ready > 1 ? 's' : ''} ready. Tap one to move it.` : 'All units have moved.'} Tap your factory to build.</div>`,
      []
    );
  }

  const stars = (n) => '★'.repeat(n) + '☆'.repeat(4 - n);

  function unitInfo(u) {
    const def = G.UNITS[u.type];
    const who = u.owner === HUMAN ? 'Your' : 'Enemy';
    const range = def.minRange === def.maxRange ? def.maxRange : `${def.minRange}–${def.maxRange}`;
    return `<div class="title">${who} ${def.name} · HP ${G.displayHp(u.hp)}/10</div>` +
      `<div>Move ${def.move} · Range ${range} · ${def.blurb}</div>`;
  }

  function showTileInfo(x, y) {
    const t = G.terrainAt(state, x, y);
    const b = G.buildingAt(state, x, y);
    let extra = '';
    if (b) {
      const owner = b.owner === null ? 'Neutral' : b.owner === HUMAN ? 'Yours' : 'Enemy';
      extra = ` · ${owner}. Pays ${fmt(G.INCOME)} a turn and heals units.`;
      if (b.capture < G.CAPTURE_POINTS) extra += ` Capture: ${b.capture}/${G.CAPTURE_POINTS} left.`;
    }
    setPanel(`<div class="title">${t.name} <span class="stars">${stars(t.def)}</span></div><div class="muted">Cover ${t.def}${extra}</div>`, []);
  }

  function updateHud() {
    const mine = state.current === HUMAN;
    $('turnLabel').textContent = `Day ${state.day} · ${mine ? 'Your turn' : 'Orange’s turn'}`;
    $('funds').textContent = `Funds ${fmt(state.players[HUMAN].funds)}`;
    const pct = (state.players[HUMAN].strike / G.STRIKE_MAX) * 100;
    $('strikeFill').style.width = `${pct}%`;
    $('strikeFill').classList.toggle('full', pct >= 100);
    $('strikeBtn').disabled = !(mine && !ui.busy && pct >= 100 && state.winner === null);
    $('endBtn').disabled = !(mine && !ui.busy && state.winner === null);
  }

  let toastTimer = null;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
  }

  function showOverlay(html, buttons) {
    const card = $('overlayCard');
    card.innerHTML = html;
    const row = document.createElement('div');
    row.className = 'buttons';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.textContent = b.label;
      if (b.cls) el.className = b.cls;
      el.onclick = b.onClick;
      row.appendChild(el);
    }
    card.appendChild(row);
    $('overlay').classList.remove('hidden');
  }
  function hideOverlay() { $('overlay').classList.add('hidden'); }

  function showHelp() {
    const rows = G.UNIT_ORDER.map((t) => {
      const d = G.UNITS[t];
      const range = d.minRange === d.maxRange ? d.maxRange : `${d.minRange}–${d.maxRange}`;
      return `<tr><td>${d.name}</td><td>${fmt(d.cost)}</td><td>${d.move}</td><td>${range}</td></tr>`;
    }).join('');
    showOverlay(
      `<h1>Tiny Fronts</h1>
      <h2>How to play</h2>
      <ul>
        <li>Tap a unit, then a blue hex to move. Then pick <b>Attack</b>, <b>Capture</b> or <b>Wait</b>.</li>
        <li>Infantry capture cities, factories and HQs. Each building you own pays ${fmt(G.INCOME)} a turn.</li>
        <li>Tap your factory to build new units.</li>
        <li>Damaged units hit softer. Forests, cities and mountains give cover (stars).</li>
        <li>Fighting fills your air strike meter.</li>
        <li><b>Win</b> by capturing the enemy HQ or destroying every enemy unit.</li>
      </ul>
      <h2>Units</h2>
      <table><tr><th>Unit</th><th>Cost</th><th>Move</th><th>Range</th></tr>${rows}</table>`,
      [
        { label: 'New game', onClick: newGame },
        { label: 'Close', cls: 'primary', onClick: hideOverlay },
      ]
    );
  }

  // ---------- effects ----------
  function popup(x, y, text, color) { ui.popups.push({ x, y, text, color, t0: performance.now() }); }
  function flash(x, y, color, dur = 350) { ui.flashes.push({ x, y, color, dur, t0: performance.now() }); }
  function boom(x, y) {
    flash(x, y, '#fb923c', 600);
    popup(x, y, 'Boom!', '#fdba74');
  }

  function animatePath(id, path) {
    return new Promise((resolve) => {
      const pts = path.map((p) => center(p.x, p.y));
      const last = pts[pts.length - 1];
      if (pts.length <= 1) {
        ui.display[id] = last;
        return resolve();
      }
      const per = 70;
      const total = per * (path.length - 1);
      const t0 = performance.now();
      const step = (now) => {
        // rAF timestamps can be slightly earlier than t0, so clamp to 0.
        const t = Math.max(0, Math.min(1, (now - t0) / total));
        const f = t * (path.length - 1);
        const i = Math.min(path.length - 2, Math.floor(f));
        const r = f - i;
        const a = pts[i];
        const b = pts[i + 1];
        ui.display[id] = { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
        if (t < 1) requestAnimationFrame(step);
        else {
          ui.display[id] = last;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  // ---------- drawing ----------
  const COLORS = {
    plain: '#a3e070', plain2: '#9ad866', forest: '#86cf5a', tree: '#3f9a3a', treeDark: '#2f7a2c',
    mountain: '#b6a88f', mountainDark: '#8c7f68', snow: '#f8fafc', water: '#5ec4f2', wave: '#bae6fd',
    road: '#ead9a8', roadEdge: '#d6c18a', neutral: '#cbd5e1', neutralDark: '#64748b',
  };

  // ---------- hex geometry ----------
  // Pointy-top hexes, odd rows shifted right. `tile` is a hex's width; `hexR` its corner radius.
  const SQRT3 = Math.sqrt(3);
  let hexR = tile / SQRT3;
  const boardW = () => tile * (state.w + 0.5);
  const boardH = () => hexR * (1.5 * (state.h - 1) + 2);

  function center(x, y) {
    return { x: tile * (x + 0.5 + (y & 1) * 0.5), y: hexR + y * 1.5 * hexR };
  }

  function hexPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 90);
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function pixelToHex(px, py) {
    const x = px - tile / 2;
    const y = py - hexR;
    const fq = ((SQRT3 / 3) * x - y / 3) / hexR;
    const fr = ((2 / 3) * y) / hexR;
    const fs = -fq - fr;
    let q = Math.round(fq);
    let r = Math.round(fr);
    const s = Math.round(fs);
    const dq = Math.abs(q - fq);
    const dr = Math.abs(r - fr);
    const ds = Math.abs(s - fs);
    if (dq > dr && dq > ds) q = -r - s;
    else if (dr > ds) r = -q - s;
    return { x: q + (r - (r & 1)) / 2, y: r };
  }

  function resize() {
    const wrap = $('boardWrap');
    const availW = wrap.clientWidth - 4;
    const availH = wrap.clientHeight - 12;
    const hFactor = (1.5 * (state.h - 1) + 2) / SQRT3; // board height per unit of hex width
    tile = Math.max(22, Math.floor(Math.min(availW / (state.w + 0.5), availH / hFactor)));
    hexR = tile / SQRT3;
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${boardW()}px`;
    canvas.style.height = `${boardH()}px`;
    canvas.width = Math.round(boardW() * dpr);
    canvas.height = Math.round(boardH() * dpr);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const roadLike = (x, y) => state.terrain[y][x] === 'road' || !!G.buildingAt(state, x, y);

  function drawTile(x, y, now) {
    const t = state.terrain[y][x];
    const s = tile;
    const c = center(x, y);
    const px = c.x - s / 2;
    const py = c.y - s / 2;

    ctx.save();
    hexPath(c.x, c.y, hexR + 0.5);
    ctx.clip();
    const fill = { forest: COLORS.forest, water: COLORS.water }[t] || ((x + y) % 2 ? COLORS.plain : COLORS.plain2);
    ctx.fillStyle = fill;
    ctx.fillRect(px - 2, c.y - hexR - 2, s + 4, hexR * 2 + 4);

    if (t === 'forest') {
      for (const [ox, oy, r] of [[0.3, 0.4, 0.2], [0.7, 0.35, 0.18], [0.5, 0.7, 0.22]]) {
        ctx.fillStyle = COLORS.treeDark;
        ctx.beginPath();
        ctx.arc(px + ox * s, py + oy * s + s * 0.04, r * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.tree;
        ctx.beginPath();
        ctx.arc(px + ox * s, py + oy * s, r * s, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (t === 'mountain') {
      ctx.fillStyle = COLORS.mountainDark;
      ctx.beginPath();
      ctx.moveTo(px + s * 0.08, py + s * 0.88);
      ctx.lineTo(px + s * 0.5, py + s * 0.12);
      ctx.lineTo(px + s * 0.92, py + s * 0.88);
      ctx.fill();
      ctx.fillStyle = COLORS.mountain;
      ctx.beginPath();
      ctx.moveTo(px + s * 0.08, py + s * 0.88);
      ctx.lineTo(px + s * 0.5, py + s * 0.12);
      ctx.lineTo(px + s * 0.6, py + s * 0.88);
      ctx.fill();
      ctx.fillStyle = COLORS.snow;
      ctx.beginPath();
      ctx.moveTo(px + s * 0.37, py + s * 0.35);
      ctx.lineTo(px + s * 0.5, py + s * 0.12);
      ctx.lineTo(px + s * 0.63, py + s * 0.35);
      ctx.lineTo(px + s * 0.5, py + s * 0.3);
      ctx.fill();
    } else if (t === 'water') {
      ctx.strokeStyle = COLORS.wave;
      ctx.lineWidth = Math.max(1.5, s * 0.05);
      ctx.lineCap = 'round';
      const shift = Math.sin(now / 700 + x + y) * s * 0.05;
      for (const oy of [0.35, 0.7]) {
        ctx.beginPath();
        ctx.moveTo(px + s * 0.2 + shift, py + oy * s);
        ctx.quadraticCurveTo(px + s * 0.35 + shift, py + (oy - 0.08) * s, px + s * 0.5 + shift, py + oy * s);
        ctx.quadraticCurveTo(px + s * 0.65 + shift, py + (oy + 0.08) * s, px + s * 0.8 + shift, py + oy * s);
        ctx.stroke();
      }
    } else if (t === 'road') {
      // Draw a road arm toward every neighboring road or building.
      const arms = G.neighbors(state, x, y).filter((n) => roadLike(n.x, n.y)).map((n) => center(n.x, n.y));
      ctx.lineCap = 'round';
      for (const [color, width] of [[COLORS.roadEdge, 0.42], [COLORS.road, 0.32]]) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = s * width;
        ctx.beginPath();
        ctx.arc(c.x, c.y, (s * width) / 2, 0, Math.PI * 2);
        ctx.fill();
        for (const n of arms) {
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo((c.x + n.x) / 2, (c.y + n.y) / 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    const b = G.buildingAt(state, x, y);
    if (b) drawBuilding(b, px, py, s);

    hexPath(c.x, c.y, hexR - 0.5);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawBuilding(b, px, py, s) {
    const pl = b.owner === null ? null : G.PLAYERS[b.owner];
    const col = pl ? pl.color : COLORS.neutral;
    const dark = pl ? pl.dark : COLORS.neutralDark;
    ctx.lineWidth = Math.max(1.5, s * 0.04);
    ctx.strokeStyle = dark;
    if (b.type === 'city') {
      ctx.fillStyle = col;
      roundRect(px + s * 0.22, py + s * 0.42, s * 0.56, s * 0.44, s * 0.05);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(px + s * 0.15, py + s * 0.45);
      ctx.lineTo(px + s * 0.5, py + s * 0.14);
      ctx.lineTo(px + s * 0.85, py + s * 0.45);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s * 0.43, py + s * 0.6, s * 0.14, s * 0.26);
    } else if (b.type === 'factory') {
      ctx.fillStyle = dark;
      ctx.fillRect(px + s * 0.66, py + s * 0.14, s * 0.12, s * 0.3);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(px + s * 0.14, py + s * 0.86);
      ctx.lineTo(px + s * 0.14, py + s * 0.42);
      ctx.lineTo(px + s * 0.32, py + s * 0.3);
      ctx.lineTo(px + s * 0.32, py + s * 0.42);
      ctx.lineTo(px + s * 0.5, py + s * 0.3);
      ctx.lineTo(px + s * 0.5, py + s * 0.42);
      ctx.lineTo(px + s * 0.86, py + s * 0.42);
      ctx.lineTo(px + s * 0.86, py + s * 0.86);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s * 0.4, py + s * 0.6, s * 0.2, s * 0.26);
    } else {
      // HQ: tower with flag
      ctx.fillStyle = col;
      roundRect(px + s * 0.28, py + s * 0.36, s * 0.44, s * 0.52, s * 0.05);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dark;
      for (let i = 0; i < 3; i++) ctx.fillRect(px + s * (0.28 + i * 0.17), py + s * 0.3, s * 0.1, s * 0.08);
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(px + s * 0.5, py + s * 0.3);
      ctx.lineTo(px + s * 0.5, py + s * 0.06);
      ctx.stroke();
      ctx.fillStyle = pl ? col : '#fff';
      ctx.beginPath();
      ctx.moveTo(px + s * 0.5, py + s * 0.06);
      ctx.lineTo(px + s * 0.76, py + s * 0.13);
      ctx.lineTo(px + s * 0.5, py + s * 0.2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.font = `900 ${Math.round(s * 0.26)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', px + s * 0.5, py + s * 0.63);
    }
    if (b.capture < G.CAPTURE_POINTS) {
      const w = s * 0.7;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px + s * 0.15, py + s * 0.9, w, s * 0.07);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(px + s * 0.15, py + s * 0.9, w * (1 - b.capture / G.CAPTURE_POINTS), s * 0.07);
    }
  }

  function drawUnit(u, now) {
    const pos = ui.display[u.id] || center(u.x, u.y);
    const s = tile;
    const pl = G.PLAYERS[u.owner];
    const def = G.UNITS[u.type];
    const cx = pos.x;
    let cy = pos.y;
    const r = s * 0.3;
    if (def.air) cy -= s * 0.08 + Math.sin(now / 250 + u.id) * s * 0.03;

    ctx.save();
    if (u.done && u.owner === state.current) ctx.globalAlpha = 0.55;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y + s * 0.36, s * 0.3, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // token
    ctx.fillStyle = pl.dark;
    roundRect(cx - s * 0.38, cy - s * 0.34, s * 0.76, s * 0.72, s * 0.18);
    ctx.fill();
    ctx.fillStyle = u.done && u.owner === state.current ? '#94a3b8' : pl.color;
    roundRect(cx - s * 0.38, cy - s * 0.38, s * 0.76, s * 0.7, s * 0.18);
    ctx.fill();

    // glyph (Orange faces left)
    ctx.translate(cx, cy - s * 0.03);
    if (u.owner === 1) ctx.scale(-1, 1);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawGlyph(u.type, r, now, u.id);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // HP badge
    const hp = G.displayHp(u.hp);
    if (hp < 10) {
      const bx = cx + s * 0.28;
      const by = cy + s * 0.24;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(bx, by, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${Math.round(s * 0.22)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(hp), bx, by + 1);
    }
    // capturing flag
    const b = G.buildingAt(state, u.x, u.y);
    if (b && b.owner !== u.owner && b.capture < G.CAPTURE_POINTS && !ui.display[u.id]) {
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.36, cy - s * 0.42);
      ctx.lineTo(cx - s * 0.36, cy - s * 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.36, cy - s * 0.42);
      ctx.lineTo(cx - s * 0.16, cy - s * 0.34);
      ctx.lineTo(cx - s * 0.36, cy - s * 0.26);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGlyph(type, r, now, id) {
    if (type === 'infantry') {
      ctx.beginPath();
      ctx.arc(0, -r * 0.42, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, r * 0.62);
      ctx.quadraticCurveTo(0, -r * 0.35, r * 0.5, r * 0.62);
      ctx.fill();
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.moveTo(r * 0.2, r * 0.05);
      ctx.lineTo(r * 0.75, -r * 0.3);
      ctx.stroke();
    } else if (type === 'tank') {
      roundRect(-r * 0.8, -r * 0.02, r * 1.6, r * 0.62, r * 0.3);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 0.1, -r * 0.1, r * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = r * 0.2;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.15);
      ctx.lineTo(r * 0.85, -r * 0.35);
      ctx.stroke();
    } else if (type === 'artillery') {
      ctx.lineWidth = r * 0.26;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, r * 0.2);
      ctx.lineTo(r * 0.7, -r * 0.65);
      ctx.stroke();
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, r * 0.6);
      ctx.lineTo(r * 0.5, r * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-r * 0.25, r * 0.35, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'bazooka') {
      ctx.beginPath();
      ctx.arc(-r * 0.15, -r * 0.42, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.65, r * 0.62);
      ctx.quadraticCurveTo(-r * 0.15, -r * 0.35, r * 0.35, r * 0.62);
      ctx.fill();
      // rocket tube over the shoulder
      ctx.lineWidth = r * 0.26;
      ctx.beginPath();
      ctx.moveTo(-r * 0.75, r * 0.1);
      ctx.lineTo(r * 0.85, -r * 0.3);
      ctx.stroke();
    } else if (type === 'jeep') {
      roundRect(-r * 0.85, -r * 0.1, r * 1.7, r * 0.5, r * 0.15);
      ctx.fill();
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.1);
      ctx.lineTo(r * 0.1, -r * 0.5);
      ctx.moveTo(-r * 0.4, -r * 0.3);
      ctx.lineTo(r * 0.5, -r * 0.3);
      ctx.stroke();
      for (const wx of [-0.5, 0.5]) {
        ctx.beginPath();
        ctx.arc(wx * r, r * 0.5, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'flak') {
      roundRect(-r * 0.8, r * 0.1, r * 1.6, r * 0.5, r * 0.25);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 0.1, r * 0.05, r * 0.3, Math.PI, 0);
      ctx.fill();
      // twin barrels pointing up
      ctx.lineWidth = r * 0.13;
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, 0);
      ctx.lineTo(r * 0.35, -r * 0.75);
      ctx.moveTo(r * 0.05, r * 0.05);
      ctx.lineTo(r * 0.6, -r * 0.6);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(-r * 0.1, r * 0.15, r * 0.52, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, r * 0.15);
      ctx.lineTo(-r * 0.9, -r * 0.05);
      ctx.moveTo(-r * 0.1, -r * 0.2);
      ctx.lineTo(-r * 0.1, -r * 0.45);
      ctx.stroke();
      const spin = Math.abs(Math.cos(now / 60 + id)) * 0.9 + 0.1;
      ctx.lineWidth = r * 0.13;
      ctx.beginPath();
      ctx.moveTo(-r * 0.1 - r * spin, -r * 0.48);
      ctx.lineTo(-r * 0.1 + r * spin, -r * 0.48);
      ctx.stroke();
    }
  }

  function fillTiles(keys, color) {
    ctx.fillStyle = color;
    for (const k of keys) {
      const x = k % state.w;
      const y = Math.floor(k / state.w);
      const c = center(x, y);
      hexPath(c.x, c.y, hexR * 0.94);
      ctx.fill();
    }
  }

  function drawOverlays(now) {
    const pulse = 0.5 + Math.sin(now / 250) * 0.15;
    if (ui.mode === 'selected' && ui.sel) {
      const reachKeys = [...ui.sel.reach.tiles.keys()];
      const reachSet = new Set(reachKeys);
      fillTiles([...ui.sel.danger].filter((k) => !reachSet.has(k)), 'rgba(239,68,68,0.22)');
      fillTiles(reachKeys, `rgba(59,130,246,${pulse * 0.8})`);
    } else if (ui.mode === 'inspect' && ui.inspect) {
      const reachSet = new Set(ui.inspect.reach.tiles.keys());
      fillTiles([...ui.inspect.danger].filter((k) => !reachSet.has(k)), 'rgba(239,68,68,0.3)');
      fillTiles([...reachSet], ui.inspect.owner === HUMAN ? 'rgba(59,130,246,0.3)' : 'rgba(249,115,22,0.35)');
    } else if (ui.mode === 'targeting' && ui.targets) {
      fillTiles(ui.targets.map((o) => key(o.target.x, o.target.y)), `rgba(239,68,68,${pulse + 0.1})`);
    }
    if (ui.strikeAt) {
      fillTiles(G.strikeTiles(state, ui.strikeAt.x, ui.strikeAt.y).map((p) => key(p.x, p.y)), `rgba(250,204,21,${pulse + 0.1})`);
    }
    if (ui.cursor) {
      const p = ui.cursor;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(2, tile * 0.07);
      const c = center(p.x, p.y);
      hexPath(c.x, c.y, hexR * 0.9);
      ctx.stroke();
    }
  }

  function drawTargetLabels() {
    if (ui.mode !== 'targeting' || !ui.targets) return;
    ctx.font = `900 ${Math.round(tile * 0.26)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const o of ui.targets) {
      const c = center(o.target.x, o.target.y);
      const x = c.x;
      const y = c.y - tile * 0.4;
      const txt = `${Math.min(o.preview.damage, o.target.hp)}%`;
      ctx.fillStyle = '#7f1d1d';
      roundRect(x - tile * 0.34, y - tile * 0.14, tile * 0.68, tile * 0.28, tile * 0.1);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, x, y + 1);
    }
  }

  function drawEffects(now) {
    ui.flashes = ui.flashes.filter((f) => now - f.t0 < f.dur);
    for (const f of ui.flashes) {
      const t = (now - f.t0) / f.dur;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      const c = center(f.x, f.y);
      ctx.arc(c.x, c.y, tile * (0.3 + t * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ui.popups = ui.popups.filter((p) => now - p.t0 < 1100);
    ctx.font = `900 ${Math.round(tile * 0.34)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of ui.popups) {
      const t = (now - p.t0) / 1100;
      const c = center(p.x, p.y);
      const x = c.x;
      const y = c.y - tile * 0.2 - t * tile * 0.6;
      ctx.globalAlpha = Math.min(1, 2 - t * 2);
      ctx.lineWidth = tile * 0.1;
      ctx.strokeStyle = '#0f172a';
      ctx.strokeText(p.text, x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, boardW(), boardH());
    for (let y = 0; y < state.h; y++) for (let x = 0; x < state.w; x++) drawTile(x, y, now);
    drawOverlays(now);
    const yOf = (u) => (ui.display[u.id] || center(u.x, u.y)).y;
    const units = [...state.units].sort((a, b) => yOf(a) - yOf(b));
    for (const u of units) drawUnit(u, now);
    drawTargetLabels();
    drawEffects(now);
  }

  function frame(now) {
    if (state) draw(now);
    requestAnimationFrame(frame);
  }

  // ---------- wiring ----------
  canvas.addEventListener('pointerup', (e) => {
    const r = canvas.getBoundingClientRect();
    const { x, y } = pixelToHex(e.clientX - r.left, e.clientY - r.top);
    if (G.inBounds(state, x, y)) handleTap(x, y);
  });
  $('endBtn').addEventListener('click', endTurn);
  $('strikeBtn').addEventListener('click', startStrike);
  $('menuBtn').addEventListener('click', () => { if (!ui.busy) showHelp(); });
  window.addEventListener('resize', () => state && resize());
  if (window.ResizeObserver) new ResizeObserver(() => state && resize()).observe($('boardWrap'));

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  newGame();
  requestAnimationFrame(frame);
  showHelp();

  // For automated checks.
  window.__tinyFronts = { get state() { return state; }, get ui() { return ui; }, tap: handleTap, endTurn };
})();
