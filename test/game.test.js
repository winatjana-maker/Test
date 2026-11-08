const test = require('node:test');
const assert = require('node:assert');
const G = require('../src/game.js');
const AI = require('../src/ai.js');

const MAP = G.MAPS[0];
const newGame = () => G.createGame(MAP);

// Small custom map for focused rule tests.
function tinyGame(rows, units, funds = [0, 0]) {
  return G.createGame({ name: 't', rows, units, funds });
}

test('map loads with income on first turn', () => {
  const s = newGame();
  assert.strictEqual(s.w, 9);
  assert.strictEqual(s.h, 13);
  for (const r of MAP.rows) assert.strictEqual(r.length, 9);
  assert.strictEqual(s.players[0].funds, 4 * G.INCOME); // 2 cities, factory, HQ
  assert.strictEqual(s.players[1].funds, 0);
});

test('hex distance and neighbors', () => {
  const s = newGame();
  assert.strictEqual(G.neighbors(s, 4, 6).length, 6);
  assert.strictEqual(G.neighbors(s, 0, 0).length, 2);
  // even row (4,6): neighbors include (3,5) and (4,5); odd row (4,5): include (4,4) and (5,4)
  assert.strictEqual(G.dist(4, 6, 3, 5), 1);
  assert.strictEqual(G.dist(4, 6, 5, 5), 2);
  assert.strictEqual(G.dist(4, 5, 5, 4), 1);
  assert.strictEqual(G.dist(0, 0, 0, 4), 4);
  assert.strictEqual(G.dist(0, 0, 3, 0), 3);
  for (const n of G.neighbors(s, 3, 7)) assert.strictEqual(G.dist(3, 7, n.x, n.y), 1);
});

test('every unit has a full damage row', () => {
  for (const a of G.UNIT_ORDER) for (const d of G.UNIT_ORDER) assert.ok(Number.isFinite(G.DAMAGE[a][d]), a + d);
});

test('jeeps fly on roads but cannot climb mountains', () => {
  const s = tinyGame(['=====m', '......'], [
    { type: 'jeep', owner: 0, x: 0, y: 0 },
    { type: 'infantry', owner: 1, x: 5, y: 1 },
  ]);
  const r = G.reachable(s, s.units[0]);
  assert.ok(r.tiles.has(G.key(s, 4, 0)));
  assert.ok(!r.tiles.has(G.key(s, 5, 0)));
});

test('flak beats helicopters, bazooka beats tanks', () => {
  assert.ok(G.DAMAGE.flak.heli > G.DAMAGE.heli.flak);
  assert.ok(G.DAMAGE.bazooka.tank > G.DAMAGE.tank.bazooka * 0.7);
  assert.ok(G.DAMAGE.jeep.infantry > G.DAMAGE.infantry.jeep);
});

test('movement respects terrain and blocks on enemies', () => {
  const s = tinyGame(['.m~..', '.....'], [
    { type: 'tank', owner: 0, x: 0, y: 0 },
    { type: 'infantry', owner: 1, x: 0, y: 1 },
    { type: 'infantry', owner: 1, x: 4, y: 1 },
  ]);
  const tank = s.units[0];
  const r = G.reachable(s, tank);
  assert.ok(!r.tiles.has(G.key(s, 1, 0)), 'tanks cannot climb mountains');
  assert.ok(!r.tiles.has(G.key(s, 2, 0)), 'tanks cannot cross water');
  assert.ok(!r.all.has(G.key(s, 0, 1)), 'enemy tile blocked');
  assert.strictEqual(r.tiles.size, 1, 'boxed in');
});

test('damage, counterattack and terrain cover', () => {
  const s = tinyGame(['..f'], [
    { type: 'tank', owner: 0, x: 0, y: 0 },
    { type: 'infantry', owner: 1, x: 2, y: 0 },
  ]);
  const tank = s.units[0];
  const inf = s.units[1];
  const pv = G.previewAttack(s, tank, 1, 0, inf);
  assert.strictEqual(pv.damage, Math.floor(75 * 0.8)); // forest = 2 stars
  const res = G.performAction(s, { unitId: tank.id, to: { x: 1, y: 0 }, type: 'attack', targetId: inf.id });
  assert.strictEqual(res.damage, 60);
  assert.strictEqual(inf.hp, 40);
  assert.strictEqual(res.counter, pv.counter);
  assert.ok(res.counter > 0);
  assert.ok(tank.done);
});

test('artillery cannot move and fire, and gets no counter', () => {
  const s = tinyGame(['.....'], [
    { type: 'artillery', owner: 0, x: 0, y: 0 },
    { type: 'tank', owner: 1, x: 3, y: 0 },
  ]);
  const art = s.units[0];
  assert.strictEqual(G.attackTargets(s, art, 1, 0).length, 0);
  assert.strictEqual(G.attackTargets(s, art, 0, 0).length, 1);
  const res = G.performAction(s, { unitId: art.id, to: { x: 0, y: 0 }, type: 'attack', targetId: s.units[1].id });
  assert.strictEqual(res.counter, 0);
});

test('capture takes turns, resets when leaving, and HQ capture wins', () => {
  const s = tinyGame(['h.k'], [
    { type: 'infantry', owner: 0, x: 1, y: 0 },
    { type: 'infantry', owner: 1, x: 0, y: 0 },
  ]);
  const me = s.units[0];
  let r = G.performAction(s, { unitId: me.id, to: { x: 2, y: 0 }, type: 'capture' });
  assert.strictEqual(r.captureLeft, 10);
  G.endTurn(s);
  G.performAction(s, { unitId: s.units[1].id, to: { x: 0, y: 0 }, type: 'wait' });
  G.endTurn(s);
  r = G.performAction(s, { unitId: me.id, to: { x: 2, y: 0 }, type: 'capture' });
  assert.ok(r.captured);
  assert.strictEqual(s.winner, 0);
  assert.strictEqual(s.winReason, 'hq');
});

test('destroying the last enemy unit wins', () => {
  const s = tinyGame(['...'], [
    { type: 'artillery', owner: 0, x: 0, y: 0 },
    { type: 'infantry', owner: 1, x: 2, y: 0 },
  ]);
  s.units[1].hp = 10;
  G.performAction(s, { unitId: s.units[0].id, type: 'attack', targetId: s.units[1].id });
  assert.strictEqual(s.winner, 0);
  assert.strictEqual(s.winReason, 'units');
});

test('building costs funds and new units wait a turn', () => {
  const s = newGame();
  const u = G.buildUnit(s, 4, 11, 'infantry');
  assert.strictEqual(s.players[0].funds, 3000);
  assert.ok(u.done);
  assert.throws(() => G.buildUnit(s, 4, 11, 'tank'), /occupied/);
  assert.throws(() => G.buildUnit(s, 4, 1, 'infantry'), /Not your factory/);
});

test('air strike needs a full meter and never kills', () => {
  const s = tinyGame(['...'], [
    { type: 'tank', owner: 0, x: 0, y: 0 },
    { type: 'infantry', owner: 1, x: 1, y: 0 },
    { type: 'infantry', owner: 1, x: 2, y: 0 },
  ]);
  assert.throws(() => G.useStrike(s, 1, 0), /not ready/);
  s.players[0].strike = G.STRIKE_MAX;
  s.units[2].hp = 15;
  const hits = G.useStrike(s, 1, 0);
  assert.strictEqual(hits.length, 2); // strike covers the hex and its neighbors
  assert.strictEqual(s.units[1].hp, 70);
  assert.strictEqual(s.units[2].hp, 10);
  assert.strictEqual(s.units[0].hp, 100, 'own units unharmed');
  assert.strictEqual(s.players[0].strike, 0);
});

test('healing on own buildings at turn start', () => {
  const s = tinyGame(['x.', 'h.', 'k.'], [
    { type: 'infantry', owner: 0, x: 0, y: 0 },
    { type: 'infantry', owner: 1, x: 1, y: 2 },
  ]);
  s.units[0].hp = 50;
  G.endTurn(s);
  G.endTurn(s);
  assert.strictEqual(s.units[0].hp, 70);
});

test('computer vs computer games finish without rule errors', () => {
  const results = [];
  for (let g = 0; g < 3; g++) {
    const s = newGame();
    // vary the start a little so games differ
    s.players[0].funds += g * 2000;
    while (s.winner === null && s.day <= 60) {
      const strike = AI.chooseStrike(s);
      if (strike) G.useStrike(s, strike.x, strike.y);
      let guard = 0;
      for (let a = AI.nextAction(s); a; a = AI.nextAction(s)) {
        G.performAction(s, a);
        assert.ok(++guard < 200, 'AI loop runaway');
      }
      if (s.winner !== null) break;
      for (const b of AI.planBuilds(s)) G.buildUnit(s, b.x, b.y, b.type);
      G.endTurn(s);
    }
    const bought = {};
    for (const u of s.units) bought[u.type] = (bought[u.type] || 0) + 1;
    results.push({ winner: s.winner, reason: s.winReason, day: s.day, alive: bought });
  }
  console.log('AI vs AI:', JSON.stringify(results));
  assert.ok(results.some((r) => r.winner !== null), 'at least one game should reach a result');
});
