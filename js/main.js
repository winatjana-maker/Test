// Entry point: wires state, sim, input, render and UI together and runs the loop.
(function () {
  const C = CW.CONFIG, S = CW.State, Sim = CW.Sim, F = CW.FACILITIES;

  // ---------- load / offline catch-up ----------
  let state = S.load();
  let awayLog = null;
  if (!state) {
    state = S.newGame();
  } else {
    const elapsed = (Date.now() - state.savedAt) / 1000;
    if (elapsed > C.OFFLINE_MIN_SEC && state.facilities.length) awayLog = Sim.simulateOffline(state, elapsed);
  }

  const canvas = document.getElementById('game');
  const input = new CW.Input(canvas, { onTap });
  const renderer = new CW.Render.Renderer(canvas, state, input);
  renderer.canPlace = canPlace;
  window.addEventListener('resize', () => renderer.resize());

  const actions = {
    isPlacing: () => !!renderer.placement,
    startPlacement(type) {
      renderer.placement = type;
      ui.hide();
      ui.toast(`Placing ${F[type].name} — tap a highlighted tile`);
    },
    cancelPlacement() {
      renderer.placement = null;
      ui.hide();
    },
    upgrade(f) {
      const cost = Sim.levelCost(f);
      if (!S.canAfford(state, cost)) { ui.toast(`Need ${ui.fmtCost(cost)}`); return; }
      S.pay(state, cost);
      f.level += 1;
      ui.toast(`${F[f.type].name} → Level ${f.level}`);
      S.save(state);
    },
    hire(f) {
      if (!S.hasFacility(state, 'guildhall')) { ui.toast('Build a Guild Hall first'); return; }
      const cost = Sim.hireCost(state);
      if (!S.canAfford(state, cost)) { ui.toast(`Need ${ui.fmtCost(cost)}`); return; }
      S.pay(state, cost);
      f.staffed = true;
      f.staffLevel = 1;
      ui.toast(`${F[f.type].name} staffed — no more walking to it`);
      S.save(state);
    },
    train(f) {
      const cost = Sim.trainCost(f);
      if (!S.canAfford(state, cost)) { ui.toast(`Need ${ui.fmtCost(cost)}`); return; }
      S.pay(state, cost);
      f.staffLevel += 1;
      ui.toast(`Staff trained to Level ${f.staffLevel}`);
      S.save(state);
    },
    resetGame() {
      S.reset();
      location.reload();
    },
  };
  const ui = new CW.UI(state, actions);

  // ---------- placement ----------
  function canPlace(type, i, j) {
    const d = F[type];
    const t = S.tileAt(state, i, j);
    if (!t) return false;
    if (S.facilityAt(state, i, j)) return false;
    if (d.placeOn !== t.type) return false;
    if (d.unique && S.hasFacility(state, type)) return false;
    if (d.rate && S.isBlocked(state, i, j + 1)) return false;        // needs a free collection tile
    if (Math.floor(state.avatar.x) === i && Math.floor(state.avatar.y) === j) return false;
    // don't build on top of another facility's collection tile
    for (const f of state.facilities) if (F[f.type].rate && f.x === i && f.y + 1 === j) return false;
    return true;
  }
  function tryPlace(type, i, j) {
    const d = F[type];
    if (!canPlace(type, i, j)) { ui.toast(d.placeOn === 'forest' ? 'Needs a free forest tile' : 'Needs a free grass tile with space in front'); return; }
    if (!S.canAfford(state, d.cost)) { ui.toast(`Need ${ui.fmtCost(d.cost)}`); renderer.placement = null; ui.syncBuildButton(); return; }
    S.pay(state, d.cost);
    state.facilities.push({ id: state.nextId++, type, x: i, y: j, level: 1, staffed: false, staffLevel: 0, progress: 0, buffer: 0, stall: null });
    renderer.placement = null;
    ui.syncBuildButton();
    ui.toast(`${d.name} built`);
    S.save(state);
  }

  // ---------- taps ----------
  function onTap(sx, sy) {
    const w = renderer.screenToWorld(sx, sy);
    const i = Math.floor(w.x), j = Math.floor(w.y);
    if (renderer.placement) { tryPlace(renderer.placement, i, j); return; }
    const f = S.facilityAt(state, i, j);
    if (f) { renderer.selected = f; ui.showFacility(f); return; }
    renderer.selected = null;
    const t = S.tileAt(state, i, j);
    if (t && t.type === 'forest') ui.toast(`Pine stand — ${Math.round(t.yield * 100)}% yield`);
    ui.hide();
  }

  // ---------- movement & collection ----------
  function collides(x, y, r) {
    const pts = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]];
    for (const [px, py] of pts) if (S.isBlocked(state, Math.floor(px), Math.floor(py))) return true;
    return false;
  }
  function moveAvatar(dt) {
    const v = input.getWorldVector();
    if (!v.x && !v.y) return;
    const a = state.avatar, r = C.AVATAR_RADIUS, sp = C.AVATAR_SPEED * dt;
    const nx = a.x + v.x * sp;
    if (!collides(nx, a.y, r)) a.x = nx;
    const ny = a.y + v.y * sp;
    if (!collides(a.x, ny, r)) a.y = ny;
  }

  const recentFloat = {}; // facility id -> { fl, amount, t }
  function checkCollect() {
    const i = Math.floor(state.avatar.x), j = Math.floor(state.avatar.y);
    for (const f of state.facilities) {
      if (!F[f.type].rate || f.staffed) continue;
      if (f.x !== i || f.y + 1 !== j || f.buffer < 1) continue;
      const r = Sim.collect(state, f);
      if (!r) continue;
      if (r.amount > 0) {
        const name = CW.RESOURCES[r.res].name, color = CW.RESOURCES[r.res].color;
        const rec = recentFloat[f.id];
        if (rec && renderer.time - rec.t < 0.8 && renderer.floaters.includes(rec.fl)) {
          rec.amount += r.amount;
          rec.fl.text = `+${rec.amount} ${name}`;
          rec.fl.t = Math.min(rec.fl.t, 0.3);
        } else {
          recentFloat[f.id] = { fl: renderer.addFloater(f.x + 0.5, f.y + 1, `+${r.amount} ${name}`, color), amount: r.amount, t: renderer.time };
        }
      }
      if (r.leftover) ui.toast('Storage full — build or upgrade a Warehouse');
    }
  }

  // ---------- loop ----------
  let last = performance.now(), saveT = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    Sim.tick(state, dt);
    moveAvatar(dt);
    checkCollect();
    renderer.render(dt);
    ui.update(dt);
    saveT += dt;
    if (saveT > C.AUTOSAVE_SEC) { saveT = 0; S.save(state); }
    requestAnimationFrame(frame);
  }

  const persist = () => S.save(state);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
  window.addEventListener('pagehide', persist);
  window.addEventListener('beforeunload', persist);

  if (awayLog) ui.showAway(awayLog);
  ui.syncBuildButton();
  requestAnimationFrame(frame);

  // Exposed for debugging / tests.
  window.CW.game = { state, renderer, input, ui, actions, canPlace, tryPlace };
})();
