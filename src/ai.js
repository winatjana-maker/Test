/*
 * Tiny Fronts — computer opponent.
 * Greedy: each step it scores every move/action for every ready unit and plays the best one.
 */
(function (root) {
  'use strict';
  const G = typeof module !== 'undefined' && module.exports ? require('./game.js') : root.Game;

  // Travel cost from every tile to the nearest goal, using terrain costs for a move type.
  function distanceField(state, moveType, goals) {
    const n = state.w * state.h;
    const d = new Array(n).fill(Infinity);
    const queue = [];
    for (const g of goals) {
      d[G.key(state, g.x, g.y)] = 0;
      queue.push(g);
    }
    while (queue.length) {
      queue.sort((a, b) => d[G.key(state, a.x, a.y)] - d[G.key(state, b.x, b.y)]);
      const cur = queue.shift();
      const ck = G.key(state, cur.x, cur.y);
      let step = G.moveCost(state, moveType, cur.x, cur.y);
      if (!Number.isFinite(step)) {
        if (d[ck] !== 0) continue;
        step = 1; // goal on terrain we can't enter (e.g. a helicopter over water): get next to it
      }
      for (const { x: nx, y: ny } of G.neighbors(state, cur.x, cur.y)) {
        if (!Number.isFinite(G.moveCost(state, moveType, nx, ny))) continue;
        const nk = G.key(state, nx, ny);
        const nd = d[ck] + step;
        if (nd < d[nk]) {
          d[nk] = nd;
          queue.push({ x: nx, y: ny });
        }
      }
    }
    return d;
  }

  function makeContext(state) {
    const p = state.current;
    const enemies = state.units.filter((u) => u.owner !== p);
    const captureGoals = state.buildings.filter((b) => b.owner !== p);
    const cache = {};
    return {
      p,
      enemies,
      field(moveType, kind) {
        const id = moveType + kind;
        if (!cache[id]) cache[id] = distanceField(state, moveType, kind === 'enemy' ? enemies : captureGoals);
        return cache[id];
      },
    };
  }

  function scoreOption(state, ctx, unit, t, opt) {
    const def = G.UNITS[unit.type];
    const k = G.key(state, t.x, t.y);
    let s = 0;

    if (!def.air) s += G.defenseAt(state, t.x, t.y) * 20;

    // Positioning: head toward enemies (infantry also toward buildings to capture).
    let pos;
    if (def.indirect) {
      let nearest = Infinity;
      for (const e of ctx.enemies) nearest = Math.min(nearest, G.dist(t.x, t.y, e.x, e.y));
      pos = Math.abs(nearest - def.maxRange);
      if (nearest <= 1) s -= 400; // keep artillery out of melee
    } else if (def.canCapture) {
      pos = Math.min(ctx.field(def.moveType, 'capture')[k], ctx.field(def.moveType, 'enemy')[k] * 1.5 + 2);
    } else {
      pos = ctx.field(def.moveType, 'enemy')[k];
    }
    s -= Number.isFinite(pos) ? pos * 40 : 2000;

    const b = G.buildingAt(state, t.x, t.y);
    if (b && b.type === 'factory' && b.owner === ctx.p) s -= 150; // keep factories free for new units

    if (opt.type === 'attack') {
      const pv = G.previewAttack(state, unit, t.x, t.y, opt.target);
      const tCost = G.UNITS[opt.target.type].cost;
      s += (Math.min(pv.damage, opt.target.hp) / 100) * tCost + 100;
      if (pv.damage >= opt.target.hp) s += tCost * 0.4 + 300;
      s -= (pv.counter / 100) * def.cost * 0.9;
    } else if (opt.type === 'capture') {
      s += b.type === 'hq' ? 20000 : b.type === 'factory' ? 4000 : 2500;
      if (b.capture - G.displayHp(unit.hp) <= 0) s += 1500;
    }
    return s;
  }

  // Best single unit action for the current player, or null when every unit has acted.
  function nextAction(state) {
    if (state.winner !== null) return null;
    const ctx = makeContext(state);
    const ready = state.units.filter((u) => u.owner === ctx.p && !u.done);
    let best = null;
    for (const unit of ready) {
      const reach = G.reachable(state, unit);
      for (const t of reach.tiles.values()) {
        const opts = [{ type: 'wait' }];
        if (G.canCapture(state, unit, t.x, t.y)) opts.push({ type: 'capture' });
        for (const target of G.attackTargets(state, unit, t.x, t.y)) opts.push({ type: 'attack', target });
        for (const opt of opts) {
          const score = scoreOption(state, ctx, unit, t, opt);
          if (!best || score > best.score) {
            best = {
              score,
              action: {
                unitId: unit.id,
                to: { x: t.x, y: t.y },
                type: opt.type,
                targetId: opt.target ? opt.target.id : undefined,
              },
            };
          }
        }
      }
    }
    return best ? best.action : null;
  }

  // Value of buying `type` against the enemy's current army: damage it deals minus damage it takes,
  // weighted by what the enemy units cost. Pricier units score higher so the AI saves for them.
  function buildScore(state, p, type, counts) {
    const enemies = state.units.filter((u) => u.owner !== p);
    let offense = 0;
    let defense = 0;
    let total = 0;
    for (const e of enemies) {
      const w = G.UNITS[e.type].cost;
      offense += G.DAMAGE[type][e.type] * w;
      defense += G.DAMAGE[e.type][type] * w;
      total += w;
    }
    if (!total) return 0;
    const net = offense / total - 0.5 * (defense / total);
    return net * Math.sqrt(G.UNITS[type].cost / 1000) - 12 * (counts[type] || 0);
  }

  function chooseBuild(state, p, funds, counts) {
    const footSoldiers = (counts.infantry || 0) + (counts.bazooka || 0);
    if (footSoldiers < 3 && funds >= G.UNITS.infantry.cost) return 'infantry';
    let pick = null;
    let best = -Infinity;
    for (const t of G.UNIT_ORDER) {
      if (funds < G.UNITS[t].cost) continue;
      const sc = buildScore(state, p, t, counts);
      if (sc > best) {
        best = sc;
        pick = t;
      }
    }
    if (pick && best > 0) return pick;
    if (footSoldiers < 5 && funds >= G.UNITS.infantry.cost) return 'infantry';
    return null; // save up
  }

  // Units to buy this turn: [{x, y, type}]. Does not change state.
  function planBuilds(state) {
    const p = state.current;
    let funds = state.players[p].funds;
    const counts = {};
    for (const u of state.units) if (u.owner === p) counts[u.type] = (counts[u.type] || 0) + 1;
    const out = [];
    for (const b of state.buildings) {
      if (b.type !== 'factory' || b.owner !== p || G.unitAt(state, b.x, b.y)) continue;
      const type = chooseBuild(state, p, funds, counts);
      if (!type) break;
      funds -= G.UNITS[type].cost;
      counts[type] = (counts[type] || 0) + 1;
      out.push({ x: b.x, y: b.y, type });
    }
    return out;
  }

  // Where to drop the air strike, or null to hold it.
  function chooseStrike(state) {
    const p = state.current;
    if (state.players[p].strike < G.STRIKE_MAX) return null;
    let best = null;
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        let value = 0;
        for (const t of G.strikeTiles(state, x, y)) {
          const u = G.unitAt(state, t.x, t.y);
          if (u && u.owner !== p) value += (G.strikeDamage(u) / 100) * G.UNITS[u.type].cost;
        }
        if (!best || value > best.value) best = { x, y, value };
      }
    }
    return best && best.value >= 1500 ? { x: best.x, y: best.y } : null;
  }

  const api = { nextAction, planBuilds, chooseStrike };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AI = api;
})(typeof self !== 'undefined' ? self : this);
