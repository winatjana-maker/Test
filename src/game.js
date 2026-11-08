/*
 * Tiny Fronts — game rules.
 * Pure logic with no DOM access, so it runs in the browser and in Node tests.
 */
(function (root) {
  'use strict';

  const CAPTURE_POINTS = 20; // a building flips when this reaches 0
  const INCOME = 1000; // funds per owned building per turn
  const HEAL = 20; // HP (out of 100) restored on your own buildings each turn
  const STRIKE_MAX = 100; // air strike meter size
  const STRIKE_DAMAGE = 30; // HP removed by an air strike (never lethal)
  const STRIKE_GAIN = 0.4; // meter gained per HP dealt or taken

  const PLAYERS = [
    { name: 'Blue', color: '#3b82f6', dark: '#1d4ed8' },
    { name: 'Orange', color: '#f97316', dark: '#c2410c' },
  ];

  const INF = Infinity;
  const EASY = { foot: 1, tread: 1, wheel: 1, air: 1 };
  const TERRAIN = {
    plain: { name: 'Plain', def: 1, cost: { foot: 1, tread: 1, wheel: 2, air: 1 } },
    forest: { name: 'Forest', def: 2, cost: { foot: 1, tread: 2, wheel: 3, air: 1 } },
    mountain: { name: 'Mountain', def: 4, cost: { foot: 2, tread: INF, wheel: INF, air: 1 } },
    water: { name: 'Water', def: 0, cost: { foot: INF, tread: INF, wheel: INF, air: 1 } },
    road: { name: 'Road', def: 0, cost: EASY },
    city: { name: 'City', def: 3, cost: EASY, building: true },
    factory: { name: 'Factory', def: 3, cost: EASY, building: true },
    hq: { name: 'HQ', def: 4, cost: EASY, building: true },
  };

  const UNITS = {
    infantry: {
      name: 'Infantry', cost: 1000, move: 3, moveType: 'foot', minRange: 1, maxRange: 1,
      canCapture: true, air: false, indirect: false,
      blurb: 'Cheap. The only unit that can capture buildings.',
    },
    bazooka: {
      name: 'Bazooka', cost: 3000, move: 2, moveType: 'foot', minRange: 1, maxRange: 1,
      canCapture: true, air: false, indirect: false,
      blurb: 'Slow foot soldier with a rocket. Beats tanks. Can capture.',
    },
    jeep: {
      name: 'Jeep', cost: 4000, move: 8, moveType: 'wheel', minRange: 1, maxRange: 1,
      canCapture: false, air: false, indirect: false,
      blurb: 'Very fast on roads. Good against infantry, weak against armor.',
    },
    tank: {
      name: 'Tank', cost: 7000, move: 6, moveType: 'tread', minRange: 1, maxRange: 1,
      canCapture: false, air: false, indirect: false,
      blurb: 'Fast and tough. Weak against helicopters.',
    },
    artillery: {
      name: 'Artillery', cost: 6000, move: 5, moveType: 'tread', minRange: 2, maxRange: 3,
      canCapture: false, air: false, indirect: true,
      blurb: 'Fires 2–3 hexes away. Can’t move and fire in one turn. Can’t hit air.',
    },
    flak: {
      name: 'Flak', cost: 8000, move: 6, moveType: 'tread', minRange: 1, maxRange: 1,
      canCapture: false, air: false, indirect: false,
      blurb: 'Anti-air truck. Shreds helicopters and infantry. Weak against tanks.',
    },
    heli: {
      name: 'Helicopter', cost: 9000, move: 6, moveType: 'air', minRange: 1, maxRange: 1,
      canCapture: false, air: true, indirect: false,
      blurb: 'Flies over anything. Strong against tanks. Ignores terrain cover.',
    },
  };
  const UNIT_ORDER = ['infantry', 'bazooka', 'jeep', 'tank', 'artillery', 'flak', 'heli'];

  // Base damage (% of a full-health target) by attacker → defender.
  const DAMAGE_TABLE = {
    //          inf  baz  jeep tank  art flak heli
    infantry: [55, 45, 12, 5, 15, 5, 7],
    bazooka: [65, 55, 85, 55, 70, 65, 9],
    jeep: [70, 65, 35, 6, 45, 10, 12],
    tank: [75, 70, 85, 55, 70, 75, 10],
    artillery: [90, 85, 80, 70, 75, 75, 0],
    flak: [90, 80, 50, 20, 50, 45, 110],
    heli: [75, 75, 75, 65, 65, 25, 55],
  };
  const DAMAGE = {};
  for (const atk of UNIT_ORDER) {
    DAMAGE[atk] = {};
    UNIT_ORDER.forEach((d, i) => { DAMAGE[atk][d] = DAMAGE_TABLE[atk][i]; });
  }

  // Map legend. Owner: 0 = Blue (player), 1 = Orange (computer), null = neutral.
  const LEGEND = {
    '.': ['plain'], f: ['forest'], m: ['mountain'], '~': ['water'], '=': ['road'],
    c: ['city', null], x: ['city', 0], y: ['city', 1],
    n: ['factory', null], p: ['factory', 0], q: ['factory', 1],
    h: ['hq', 0], k: ['hq', 1],
  };

  const MAPS = [
    {
      name: 'Twin Rivers',
      rows: [
        'm.y.k.y.m',
        'f...q...f',
        '..c.=.c..',
        '.f..=..f.',
        '~~.f=f.~~',
        'c..m=m..c',
        'fn..=..nf',
        'c..m=m..c',
        '~~.f=f.~~',
        '.f..=..f.',
        '..c.=.c..',
        'f...p...f',
        'm.x.h.x.m',
      ],
      funds: [0, 0],
      units: [
        { type: 'infantry', owner: 0, x: 3, y: 11 },
        { type: 'infantry', owner: 0, x: 5, y: 11 },
        { type: 'tank', owner: 0, x: 4, y: 10 },
        { type: 'infantry', owner: 1, x: 3, y: 1 },
        { type: 'infantry', owner: 1, x: 5, y: 1 },
        { type: 'tank', owner: 1, x: 4, y: 2 },
      ],
    },
  ];

  // ---------- hex grid ----------
  // Pointy-top hexes in "odd-r" layout: odd rows are shifted half a hex to the right.
  const NEIGHBORS_EVEN = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
  const NEIGHBORS_ODD = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];

  function neighbors(state, x, y) {
    const dirs = y & 1 ? NEIGHBORS_ODD : NEIGHBORS_EVEN;
    const out = [];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(state, nx, ny)) out.push({ x: nx, y: ny });
    }
    return out;
  }

  function toCube(x, y) {
    const q = x - (y - (y & 1)) / 2;
    return { q, r: y, s: -q - y };
  }

  function dist(ax, ay, bx, by) {
    const a = toCube(ax, ay);
    const b = toCube(bx, by);
    return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
  }

  // ---------- helpers ----------
  const key = (state, x, y) => y * state.w + x;
  const displayHp = (hp) => Math.ceil(hp / 10);
  const inBounds = (state, x, y) => x >= 0 && y >= 0 && x < state.w && y < state.h;
  const terrainAt = (state, x, y) => TERRAIN[state.terrain[y][x]];
  const unitAt = (state, x, y) => state.units.find((u) => u.x === x && u.y === y) || null;
  const getUnit = (state, id) => state.units.find((u) => u.id === id) || null;
  const buildingAt = (state, x, y) => state.buildings.find((b) => b.x === x && b.y === y) || null;
  const moveCost = (state, moveType, x, y) => terrainAt(state, x, y).cost[moveType];
  const defenseAt = (state, x, y) => terrainAt(state, x, y).def;

  function addUnit(state, type, owner, x, y) {
    const u = { id: state.nextId++, type, owner, x, y, hp: 100, done: false };
    state.units.push(u);
    return u;
  }

  // ---------- setup ----------
  function createGame(map) {
    const terrain = [];
    const buildings = [];
    map.rows.forEach((row, y) => {
      terrain.push([]);
      [...row].forEach((ch, x) => {
        const entry = LEGEND[ch];
        if (!entry) throw new Error(`Unknown map tile "${ch}" at ${x},${y}`);
        const [t, owner] = entry;
        terrain[y].push(t);
        if (TERRAIN[t].building) {
          buildings.push({ x, y, type: t, owner: owner === undefined ? null : owner, capture: CAPTURE_POINTS });
        }
      });
    });
    const state = {
      mapName: map.name,
      w: map.rows[0].length,
      h: map.rows.length,
      terrain,
      buildings,
      units: [],
      players: [0, 1].map((p) => ({ funds: (map.funds && map.funds[p]) || 0, strike: 0 })),
      current: 0,
      day: 1,
      winner: null,
      winReason: null,
      nextId: 1,
    };
    for (const u of map.units) addUnit(state, u.type, u.owner, u.x, u.y);
    startTurn(state);
    return state;
  }

  // ---------- movement ----------
  function reachable(state, unit) {
    const def = UNITS[unit.type];
    const all = new Map();
    all.set(key(state, unit.x, unit.y), { x: unit.x, y: unit.y, cost: 0, prev: null });
    const frontier = [{ x: unit.x, y: unit.y, cost: 0 }];
    while (frontier.length) {
      frontier.sort((a, b) => a.cost - b.cost);
      const cur = frontier.shift();
      const ck = key(state, cur.x, cur.y);
      if (all.get(ck).cost < cur.cost) continue;
      for (const { x: nx, y: ny } of neighbors(state, cur.x, cur.y)) {
        const c = moveCost(state, def.moveType, nx, ny);
        if (!Number.isFinite(c)) continue;
        const occ = unitAt(state, nx, ny);
        if (occ && occ.owner !== unit.owner) continue; // enemies block
        const nc = cur.cost + c;
        if (nc > def.move) continue;
        const nk = key(state, nx, ny);
        const seen = all.get(nk);
        if (seen && seen.cost <= nc) continue;
        all.set(nk, { x: nx, y: ny, cost: nc, prev: ck });
        frontier.push({ x: nx, y: ny, cost: nc });
      }
    }
    // Units can pass through friends but can only stop on empty tiles (or stay put).
    const tiles = new Map();
    for (const [k, v] of all) {
      const occ = unitAt(state, v.x, v.y);
      if (!occ || occ.id === unit.id) tiles.set(k, v);
    }
    return { tiles, all };
  }

  function pathTo(state, reach, x, y) {
    const pts = [];
    let e = reach.all.get(key(state, x, y));
    while (e) {
      pts.unshift({ x: e.x, y: e.y });
      e = e.prev === null ? null : reach.all.get(e.prev);
    }
    return pts;
  }

  // ---------- combat ----------
  function inRange(def, d) {
    return d >= def.minRange && d <= def.maxRange;
  }

  // Enemies `unit` could attack if it stood at (fx, fy). Call before moving the unit.
  function attackTargets(state, unit, fx, fy) {
    const def = UNITS[unit.type];
    if (def.indirect && (fx !== unit.x || fy !== unit.y)) return [];
    return state.units.filter(
      (t) => t.owner !== unit.owner && inRange(def, dist(fx, fy, t.x, t.y)) && DAMAGE[unit.type][t.type] > 0
    );
  }

  function calcDamage(state, atkType, atkHp, defender) {
    const base = DAMAGE[atkType][defender.type];
    if (!base) return 0;
    const stars = UNITS[defender.type].air ? 0 : defenseAt(state, defender.x, defender.y);
    return Math.max(1, Math.floor(base * (displayHp(atkHp) / 10) * (1 - stars / 10)));
  }

  function canCounter(defender, attacker) {
    const d = UNITS[defender.type];
    if (d.indirect) return false;
    return inRange(d, dist(defender.x, defender.y, attacker.x, attacker.y)) && DAMAGE[defender.type][attacker.type] > 0;
  }

  // Expected result of `unit` attacking `target` from (fx, fy). Does not change state.
  function previewAttack(state, unit, fx, fy, target) {
    const a = Object.assign({}, unit, { x: fx, y: fy });
    const damage = calcDamage(state, a.type, a.hp, target);
    const left = target.hp - damage;
    const counter = left > 0 && canCounter(target, a) ? calcDamage(state, target.type, left, a) : 0;
    return { damage, counter };
  }

  function addStrike(state, owner, amount) {
    const p = state.players[owner];
    p.strike = Math.min(STRIKE_MAX, p.strike + amount * STRIKE_GAIN);
  }

  function resetCapture(state, x, y) {
    const b = buildingAt(state, x, y);
    if (b) b.capture = CAPTURE_POINTS;
  }

  function applyDamage(state, attacker, target, dmg, destroyed) {
    target.hp -= dmg;
    addStrike(state, attacker.owner, dmg);
    addStrike(state, target.owner, dmg);
    if (target.hp <= 0) {
      state.units = state.units.filter((u) => u !== target);
      resetCapture(state, target.x, target.y);
      destroyed.push({ id: target.id, x: target.x, y: target.y, owner: target.owner });
    }
  }

  function checkUnitsWipe(state, destroyed) {
    for (const d of destroyed) {
      if (state.winner !== null) return;
      if (!state.units.some((u) => u.owner === d.owner)) {
        state.winner = 1 - d.owner;
        state.winReason = 'units';
      }
    }
  }

  function canCapture(state, unit, x, y) {
    const b = buildingAt(state, x, y);
    return !!(UNITS[unit.type].canCapture && b && b.owner !== unit.owner);
  }

  /**
   * One unit's full turn: move (optional) then act.
   * action = { unitId, to: {x, y}, type: 'wait' | 'attack' | 'capture', targetId? }
   */
  function performAction(state, action) {
    if (state.winner !== null) throw new Error('Game is over');
    const unit = getUnit(state, action.unitId);
    if (!unit || unit.owner !== state.current || unit.done) throw new Error('That unit cannot act');
    const to = action.to || { x: unit.x, y: unit.y };
    const reach = reachable(state, unit);
    if (!reach.tiles.has(key(state, to.x, to.y))) throw new Error('Cannot move there');

    const result = {
      type: action.type,
      unitId: unit.id,
      owner: unit.owner,
      from: { x: unit.x, y: unit.y },
      to: { x: to.x, y: to.y },
      path: pathTo(state, reach, to.x, to.y),
      destroyed: [],
    };

    let target = null;
    if (action.type === 'attack') {
      target = attackTargets(state, unit, to.x, to.y).find((t) => t.id === action.targetId);
      if (!target) throw new Error('Target not in range');
    } else if (action.type === 'capture') {
      if (!canCapture(state, unit, to.x, to.y)) throw new Error('Nothing to capture here');
    } else if (action.type !== 'wait') {
      throw new Error(`Unknown action ${action.type}`);
    }

    if (to.x !== unit.x || to.y !== unit.y) {
      resetCapture(state, unit.x, unit.y); // leaving a building cancels its capture
      unit.x = to.x;
      unit.y = to.y;
    }
    unit.done = true;

    if (target) {
      const dmg = calcDamage(state, unit.type, unit.hp, target);
      result.targetId = target.id;
      result.target = { x: target.x, y: target.y };
      result.damage = dmg;
      applyDamage(state, unit, target, dmg, result.destroyed);
      result.counter = 0;
      if (target.hp > 0 && canCounter(target, unit)) {
        const cdmg = calcDamage(state, target.type, target.hp, unit);
        result.counter = cdmg;
        applyDamage(state, target, unit, cdmg, result.destroyed);
      }
      checkUnitsWipe(state, result.destroyed);
    }

    if (action.type === 'capture') {
      const b = buildingAt(state, to.x, to.y);
      b.capture -= displayHp(unit.hp);
      if (b.capture <= 0) {
        b.owner = unit.owner;
        b.capture = CAPTURE_POINTS;
        result.captured = true;
        if (b.type === 'hq') {
          state.winner = unit.owner;
          state.winReason = 'hq';
        }
      }
      result.captureLeft = b.capture;
      result.building = b.type;
    }
    return result;
  }

  // ---------- economy ----------
  function buildUnit(state, x, y, type) {
    if (state.winner !== null) throw new Error('Game is over');
    const b = buildingAt(state, x, y);
    const def = UNITS[type];
    if (!def) throw new Error(`Unknown unit ${type}`);
    if (!b || b.type !== 'factory' || b.owner !== state.current) throw new Error('Not your factory');
    if (unitAt(state, x, y)) throw new Error('Factory is occupied');
    const pl = state.players[state.current];
    if (pl.funds < def.cost) throw new Error('Not enough funds');
    pl.funds -= def.cost;
    const u = addUnit(state, type, state.current, x, y);
    u.done = true; // new units act next turn
    return u;
  }

  // ---------- air strike ----------
  // The target hex plus its 6 neighbors.
  function strikeTiles(state, x, y) {
    return inBounds(state, x, y) ? [{ x, y }, ...neighbors(state, x, y)] : [];
  }

  function strikeDamage(unit) {
    return unit.hp > 10 ? Math.min(STRIKE_DAMAGE, unit.hp - 10) : 0;
  }

  function useStrike(state, x, y) {
    if (state.winner !== null) throw new Error('Game is over');
    const pl = state.players[state.current];
    if (pl.strike < STRIKE_MAX) throw new Error('Air strike not ready');
    if (!inBounds(state, x, y)) throw new Error('Off the map');
    const hits = [];
    for (const t of strikeTiles(state, x, y)) {
      const u = unitAt(state, t.x, t.y);
      if (u && u.owner !== state.current) {
        const dmg = strikeDamage(u);
        u.hp -= dmg;
        hits.push({ id: u.id, x: u.x, y: u.y, damage: dmg });
      }
    }
    pl.strike = 0;
    return hits;
  }

  // ---------- turns ----------
  function startTurn(state) {
    const p = state.current;
    const owned = state.buildings.filter((b) => b.owner === p);
    const income = owned.length * INCOME;
    state.players[p].funds += income;
    let healed = 0;
    for (const u of state.units) {
      if (u.owner !== p) continue;
      u.done = false;
      const b = buildingAt(state, u.x, u.y);
      if (b && b.owner === p && u.hp < 100) {
        u.hp = Math.min(100, u.hp + HEAL);
        healed++;
      }
    }
    return { player: p, income, healed };
  }

  function endTurn(state) {
    if (state.winner !== null) return null;
    for (const u of state.units) if (u.owner === state.current) u.done = false;
    state.current = 1 - state.current;
    if (state.current === 0) state.day++;
    return startTurn(state);
  }

  const api = {
    CAPTURE_POINTS, INCOME, HEAL, STRIKE_MAX, STRIKE_DAMAGE,
    PLAYERS, TERRAIN, UNITS, UNIT_ORDER, DAMAGE, MAPS,
    key, dist, neighbors, displayHp, inBounds, terrainAt, unitAt, getUnit, buildingAt, moveCost, defenseAt,
    createGame, reachable, pathTo, attackTargets, previewAttack, canCapture,
    performAction, buildUnit, strikeTiles, strikeDamage, useStrike, endTurn,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Game = api;
})(typeof self !== 'undefined' ? self : this);
