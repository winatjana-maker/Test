// DOM overlay: resource ledger, hint, build sheet, facility sheet, modals, toasts.
window.CW = window.CW || {};

CW.UI = function (state, actions) {
  this.state = state;
  this.actions = actions;
  this.el = {
    ledger: document.getElementById('ledger'),
    hint: document.getElementById('hint'),
    toast: document.getElementById('toast'),
    panel: document.getElementById('panel'),
    modal: document.getElementById('modal'),
    btnBuild: document.getElementById('btn-build'),
    btnMenu: document.getElementById('btn-menu'),
  };
  this.current = null;       // { type: 'build' } | { type: 'facility', f }
  this.lastLedger = '';
  this.lastHint = '';
  this.toastUntil = 0;
  this.toastText = '';
  this.panelTimer = 0;
  this.desktop = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  this.el.btnBuild.addEventListener('click', () => {
    if (this.actions.isPlacing()) { this.actions.cancelPlacement(); return; }
    if (this.current && this.current.type === 'build') this.hide(); else this.showBuild();
  });
  this.el.btnMenu.addEventListener('click', () => this.showMenu());
};

CW.UI.prototype.fmtCost = function (cost) {
  const parts = [];
  for (const k in cost) parts.push(`${cost[k]} ${CW.RESOURCES[k].name}`);
  return parts.join(' + ');
};
CW.UI.prototype.costHtml = function (cost) {
  const ok = CW.State.canAfford(this.state, cost);
  return `<span class="cost ${ok ? '' : 'no'}">${this.fmtCost(cost)}</span>`;
};

// ---------- per-frame ----------
CW.UI.prototype.update = function (dt) {
  const st = this.state;
  const cap = CW.State.storageCap(st);
  let html = '';
  for (const k of CW.RESOURCE_ORDER) {
    const v = Math.floor(st.storage[k] || 0);
    html += `<span class="chip ${v >= cap ? 'full' : ''}"><i class="dot" style="background:${CW.RESOURCES[k].color}"></i>${CW.RESOURCES[k].name} <b>${v}</b><span class="cap">/${cap}</span></span>`;
  }
  if (html !== this.lastLedger) { this.el.ledger.innerHTML = html; this.lastLedger = html; }

  const hint = this.computeHint();
  if (hint !== this.lastHint) { this.el.hint.textContent = hint; this.lastHint = hint; }

  if (this.toastText && performance.now() > this.toastUntil) {
    this.toastText = '';
    this.el.toast.classList.add('hidden');
  }

  if (this.current && this.current.type === 'facility') {
    this.panelTimer += dt;
    if (this.panelTimer > 0.5) { this.panelTimer = 0; this.renderFacility(this.current.f); }
  }
};

CW.UI.prototype.computeHint = function () {
  const st = this.state, S = CW.State;
  if (this.actions.isPlacing()) return 'Tap a highlighted tile to place it. Tap Cancel to stop.';
  const walk = this.desktop ? 'Drag on the map or use WASD to walk.' : 'Drag anywhere on the map to walk.';
  if (!S.hasFacility(st, 'woodcutter')) return 'Tap Build → Woodcutter Camp, then tap a forest tile (the ones with trees).';
  if (st.stats.collected === 0) return `${walk} Stand on the dashed tile in front of your camp to collect.`;
  if (!S.hasFacility(st, 'sawmill')) return 'Build a Sawmill on open grass to turn timber into lumber.';
  if (!S.hasFacility(st, 'planing')) return 'Collect lumber from the Sawmill, then build a Planing Mill.';
  if (!S.hasFacility(st, 'carpentry')) return 'Build a Carpentry Shop — Trade Goods are what you hire with.';
  if (!S.hasFacility(st, 'guildhall')) return 'Build a Guild Hall with Trade Goods to unlock hiring.';
  if (S.countStaffed(st) === 0) return 'Tap a facility → Hire. Staffed facilities deliver to storage by themselves.';
  return '';
};

CW.UI.prototype.toast = function (text, ms) {
  if (this.toastText === text && performance.now() < this.toastUntil) return;
  this.toastText = text;
  this.el.toast.textContent = text;
  this.el.toast.classList.remove('hidden');
  this.toastUntil = performance.now() + (ms || 2200);
};

// ---------- sheets ----------
CW.UI.prototype.hide = function () {
  this.current = null;
  this.el.panel.classList.add('hidden');
  this.el.panel.innerHTML = '';
  this.syncBuildButton();
};
CW.UI.prototype.syncBuildButton = function () {
  const placing = this.actions.isPlacing();
  this.el.btnBuild.textContent = placing ? 'Cancel' : 'Build';
  this.el.btnBuild.classList.toggle('cancel', placing);
  this.el.btnBuild.classList.toggle('primary', !placing);
};

CW.UI.prototype.showBuild = function () {
  this.current = { type: 'build' };
  const st = this.state, S = CW.State;
  let items = '';
  for (const type of CW.FACILITY_ORDER) {
    const d = CW.FACILITIES[type];
    const ok = S.canAfford(st, d.cost);
    const locked = d.unique && S.hasFacility(st, type);
    items += `<div class="build-item ${ok && !locked ? '' : 'disabled'}" data-type="${type}">
      <div class="swatch" style="background:${d.color}"></div>
      <div><div class="name">${d.name}</div><div class="desc">${d.desc}${d.placeOn === 'forest' ? ' Place on a forest tile.' : ''}</div></div>
      <div class="cost ${ok ? '' : 'no'}">${locked ? 'Built' : this.fmtCost(d.cost)}</div>
    </div>`;
  }
  this.el.panel.innerHTML = `<button class="close" aria-label="Close">×</button><h2>Build</h2><div class="sub">Facilities produce into an on-site buffer until you hire staff for them.</div><div class="build-list">${items}</div>`;
  this.el.panel.classList.remove('hidden');
  this.el.panel.querySelector('.close').addEventListener('click', () => this.hide());
  this.el.panel.querySelectorAll('.build-item').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.type, d = CW.FACILITIES[type];
      if (d.unique && S.hasFacility(st, type)) { this.toast('Already built'); return; }
      if (!S.canAfford(st, d.cost)) { this.toast(`Need ${this.fmtCost(d.cost)}`); return; }
      this.actions.startPlacement(type);
    });
  });
};

CW.UI.prototype.showFacility = function (f) {
  this.current = { type: 'facility', f };
  this.panelTimer = 0;
  this.renderFacility(f);
  this.el.panel.classList.remove('hidden');
};

CW.UI.prototype.renderFacility = function (f) {
  const st = this.state, S = CW.State, Sim = CW.Sim, d = CW.FACILITIES[f.type];
  if (!st.facilities.includes(f)) { this.hide(); return; }
  let rows = `<div class="k">Level</div><div class="v">${f.level}</div>`;
  let meters = '';
  if (d.rate) {
    const res = Sim.outputRes(f);
    const r = Sim.rate(st, f);
    rows += `<div class="k">Output</div><div class="v">${r.toFixed(1)} ${CW.RESOURCES[res].name} / min</div>`;
    if (d.input) rows += `<div class="k">Uses</div><div class="v">${this.fmtCost(d.input)} per cycle</div>`;
    if (f.staffed) {
      rows += `<div class="k">Staff</div><div class="v good">Level ${f.staffLevel} — delivers to storage</div>`;
    } else {
      const cap = Sim.bufferCap(f);
      rows += `<div class="k">Buffer</div><div class="v ${f.buffer >= cap ? 'warn' : ''}">${Math.floor(f.buffer)} / ${cap}</div>`;
      meters += `<div class="meter buffer"><i style="width:${Math.min(100, f.buffer / cap * 100)}%"></i></div>`;
    }
    if (f.stall) {
      const label = { 'no input': 'Waiting for input', 'buffer full': 'Buffer full — walk to the dashed tile', 'storage full': 'Storage full — build a Warehouse', 'depleted': 'Forest depleted — let it regrow' }[f.stall];
      rows += `<div class="k">Status</div><div class="v warn">${label}</div>`;
    } else {
      rows += `<div class="k">Status</div><div class="v good">Running</div>`;
    }
    if (f.type === 'woodcutter') {
      const t = S.tileAt(st, f.x, f.y);
      rows += `<div class="k">Forest yield</div><div class="v ${t.yield < 0.3 ? 'warn' : ''}">${Math.round(t.yield * 100)}%</div>`;
      meters += `<div class="meter"><i style="width:${t.yield * 100}%"></i></div>`;
    }
  } else if (d.passive === 'storage') {
    rows += `<div class="k">Adds storage</div><div class="v">+${CW.CONFIG.WAREHOUSE_STORAGE * f.level} per resource</div>`;
  } else if (d.passive === 'replant') {
    rows += `<div class="k">Effect</div><div class="v">Forests within ${CW.CONFIG.NURSERY_RADIUS} tiles regrow ${CW.CONFIG.NURSERY_MULT}× faster</div>`;
  } else if (d.passive === 'hiring') {
    rows += `<div class="k">Effect</div><div class="v">Hiring unlocked. Next hire: ${this.fmtCost(Sim.hireCost(st))}</div>`;
  }

  let buttons = '';
  if (f.type !== 'guildhall') {
    const lc = Sim.levelCost(f);
    buttons += `<button class="btn light" data-act="upgrade" ${S.canAfford(st, lc) ? '' : 'disabled'}>Upgrade to Lv ${f.level + 1}<br>${this.costHtml(lc)}</button>`;
  }
  if (d.rate) {
    if (!f.staffed) {
      const has = S.hasFacility(st, 'guildhall');
      const hc = Sim.hireCost(st);
      buttons += `<button class="btn primary" data-act="hire" ${has && S.canAfford(st, hc) ? '' : 'disabled'}>Hire staff<br>${has ? this.costHtml(hc) : '<span class="cost">Needs Guild Hall</span>'}</button>`;
    } else {
      const tc = Sim.trainCost(f);
      buttons += `<button class="btn primary" data-act="train" ${S.canAfford(st, tc) ? '' : 'disabled'}>Train staff to Lv ${f.staffLevel + 1}<br>${this.costHtml(tc)}</button>`;
    }
  }

  this.el.panel.innerHTML = `<button class="close" aria-label="Close">×</button>
    <h2>${d.name}</h2><div class="sub">${d.desc}</div>
    <div class="kv">${rows}</div>${meters}
    <div class="actions">${buttons}</div>`;
  this.el.panel.querySelector('.close').addEventListener('click', () => this.hide());
  this.el.panel.querySelectorAll('[data-act]').forEach(b => {
    b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'upgrade') this.actions.upgrade(f);
      else if (act === 'hire') this.actions.hire(f);
      else if (act === 'train') this.actions.train(f);
      this.renderFacility(f);
    });
  });
};

// ---------- modals ----------
CW.UI.prototype.showModal = function (html, buttons) {
  const m = this.el.modal;
  let btns = '';
  buttons.forEach((b, i) => { btns += `<button class="btn ${b.cls || 'light'}" data-i="${i}">${b.label}</button>`; });
  m.innerHTML = `<div class="card">${html}<div class="actions">${btns}</div></div>`;
  m.classList.remove('hidden');
  m.querySelectorAll('[data-i]').forEach(b => {
    b.addEventListener('click', () => {
      const cb = buttons[+b.dataset.i].onClick;
      m.classList.add('hidden');
      m.innerHTML = '';
      if (cb) cb();
    });
  });
};

CW.UI.prototype.showAway = function (log) {
  const fmt = s => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  };
  let list = '';
  for (const k of CW.RESOURCE_ORDER) if (log.produced[k]) list += `<li>${log.produced[k]} ${CW.RESOURCES[k].name}</li>`;
  if (!list) list = '<li>Nothing produced — build something first.</li>';
  const buf = log.fullBuffers ? `<p><b>${log.fullBuffers}</b> ${log.fullBuffers === 1 ? 'facility has a full buffer' : 'facilities have full buffers'} waiting for you on the map.</p>` : '';
  const capped = log.capped ? `<p class="muted">Production is simulated for up to ${CW.CONFIG.OFFLINE_CAP_HOURS} hours away.</p>` : '';
  this.showModal(`<h2>While you were away</h2><p class="muted">${fmt(log.seconds)}</p><p>Your facilities produced:</p><ul>${list}</ul>${buf}${capped}`,
    [{ label: 'Back to the forest', cls: 'primary' }]);
};

CW.UI.prototype.showMenu = function () {
  const st = this.state;
  const prod = CW.RESOURCE_ORDER.map(k => `${st.stats.produced[k] || 0} ${CW.RESOURCES[k].name}`).join(', ');
  this.showModal(`<h2>Cordwood</h2><p class="muted">Prototype — Pine Flats</p>
    <p><b>Walk:</b> drag anywhere on the map${this.desktop ? ' (or WASD)' : ''}.<br>
    <b>Collect:</b> stand on the dashed tile in front of a facility.<br>
    <b>Inspect:</b> tap a facility or forest tile.</p>
    <p class="muted">Produced so far: ${prod}. Collected by hand: ${st.stats.collected}.</p>`,
    [
      { label: 'Close', cls: 'primary' },
      { label: 'Reset game', cls: 'danger', onClick: () => {
        this.showModal('<h2>Reset everything?</h2><p>This deletes your forest and starts over.</p>',
          [{ label: 'Keep playing', cls: 'primary' }, { label: 'Reset', cls: 'danger', onClick: () => this.actions.resetGame() }]);
      } },
    ]);
};
