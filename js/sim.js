// Production simulation: facilities, buffers, forest regrowth, offline catch-up.
window.CW = window.CW || {};

CW.Sim = (function () {
  const C = CW.CONFIG, F = CW.FACILITIES, S = CW.State;

  function scaleCost(cost, growth, exp) {
    const out = {};
    for (const k in cost) out[k] = Math.ceil(cost[k] * Math.pow(growth, exp));
    return out;
  }
  function levelCost(f) { return scaleCost(F[f.type].cost, C.LEVEL_COST_GROWTH, f.level); }
  function hireCost(state) { return { goods: C.HIRE_COST_BASE + C.HIRE_COST_STEP * S.countStaffed(state) }; }
  function trainCost(f) { return { goods: Math.ceil(C.TRAIN_COST_BASE * Math.pow(C.TRAIN_COST_GROWTH, f.staffLevel - 1)) }; }
  function bufferCap(f) { return F[f.type].buffer * f.level; }
  function outputRes(f) { return Object.keys(F[f.type].output)[0]; }

  function rateMult(state, f) {
    let m = 1 + C.LEVEL_RATE_BONUS * (f.level - 1);
    if (f.staffed) m *= 1 + C.STAFF_RATE_BONUS * (f.staffLevel - 1);
    if (f.type === 'woodcutter') {
      const t = S.tileAt(state, f.x, f.y);
      m *= t ? t.yield : 0;
    }
    return m;
  }
  // Cycles per minute.
  function rate(state, f) {
    const d = F[f.type];
    return d.rate ? d.rate * rateMult(state, f) : 0;
  }

  function nurseryMult(state, i, j) {
    for (const f of state.facilities) {
      if (f.type === 'nursery' && Math.max(Math.abs(f.x - i), Math.abs(f.y - j)) <= C.NURSERY_RADIUS) return C.NURSERY_MULT;
    }
    return 1;
  }

  function tick(state, dt, log) {
    const G = C.GRID;
    // Forest regrowth
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const t = state.tiles[j * G + i];
        if (t.type === 'forest' && t.yield < 1) {
          t.yield = Math.min(1, t.yield + C.REGROW_PER_SEC * dt * nurseryMult(state, i, j));
        }
      }
    }
    // Facilities
    for (const f of state.facilities) {
      const d = F[f.type];
      if (!d.rate) continue;

      // Staffed facilities push any leftover buffer into storage.
      if (f.staffed && f.buffer > 0) {
        f.buffer -= S.addResource(state, outputRes(f), f.buffer);
      }

      const r = rate(state, f) / 60; // per second
      if (r <= 0) { f.stall = f.type === 'woodcutter' ? 'depleted' : null; continue; }

      f.progress = (f.progress || 0) + r * dt;
      f.stall = null;
      let guard = 0;
      while (f.progress >= 1 && guard++ < 100000) {
        if (d.input && !S.canAfford(state, d.input)) { f.stall = 'no input'; f.progress = 1; break; }
        const res = outputRes(f), qty = d.output[res];
        if (f.staffed) {
          if ((state.storage[res] || 0) + qty > S.storageCap(state)) { f.stall = 'storage full'; f.progress = 1; break; }
          if (d.input) S.pay(state, d.input);
          state.storage[res] = (state.storage[res] || 0) + qty;
        } else {
          if (f.buffer + qty > bufferCap(f)) { f.stall = 'buffer full'; f.progress = 1; break; }
          if (d.input) S.pay(state, d.input);
          f.buffer += qty;
        }
        if (f.type === 'woodcutter') {
          const t = S.tileAt(state, f.x, f.y);
          if (t) t.yield = Math.max(0, t.yield - C.YIELD_PER_UNIT * qty);
        }
        if (log) log.produced[res] = (log.produced[res] || 0) + qty;
        state.stats.produced[res] = (state.stats.produced[res] || 0) + qty;
        f.progress -= 1;
      }
    }
  }

  // Move a facility's buffer into central storage. Returns {res, amount, leftover}.
  function collect(state, f) {
    if (f.buffer <= 0) return null;
    const res = outputRes(f);
    const amt = Math.floor(f.buffer);
    const added = S.addResource(state, res, amt);
    f.buffer -= added;
    if (added > 0) state.stats.collected += added;
    return { res, amount: added, leftover: f.buffer > 0 };
  }

  function simulateOffline(state, elapsedSec) {
    const cap = C.OFFLINE_CAP_HOURS * 3600;
    const total = Math.min(elapsedSec, cap);
    const log = { produced: {}, seconds: total, capped: elapsedSec > cap, fullBuffers: 0 };
    let t = 0;
    while (t < total) {
      const dt = Math.min(C.OFFLINE_STEP, total - t);
      tick(state, dt, log);
      t += dt;
    }
    log.fullBuffers = state.facilities.filter(f => F[f.type].rate && !f.staffed && f.buffer >= bufferCap(f)).length;
    return log;
  }

  return { tick, collect, simulateOffline, levelCost, hireCost, trainCost, bufferCap, rate, outputRes };
})();
