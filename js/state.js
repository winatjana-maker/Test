// Game state: creation, persistence, and small query helpers.
window.CW = window.CW || {};

CW.State = (function () {
  const C = CW.CONFIG;
  const SAVE_KEY = 'cordwood-save-v1';

  // Small deterministic PRNG so a new game always gets the same map.
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateTiles(seed) {
    const r = rng(seed);
    const G = C.GRID, c = (G - 1) / 2;
    const tiles = [];
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const d = Math.max(Math.abs(i - c), Math.abs(j - c));
        const v = r();
        let type = 'grass';
        if (d >= 6) type = v < 0.85 ? 'forest' : 'grass';
        else if (d >= 4) type = v < 0.5 ? 'forest' : 'grass';
        else if (d >= 3) type = v < 0.2 ? 'forest' : 'grass';
        tiles.push({ type, yield: 1 });
      }
    }
    return tiles;
  }

  function newGame() {
    const G = C.GRID;
    return {
      version: 1,
      createdAt: Date.now(),
      savedAt: Date.now(),
      storage: Object.assign({}, C.START_STORAGE),
      tiles: generateTiles(1337),
      facilities: [],
      nextId: 1,
      avatar: { x: G / 2, y: G / 2 },
      stats: { collected: 0, produced: {} },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.version !== 1) return null;
      return s;
    } catch (e) { return null; }
  }

  function save(state) {
    state.savedAt = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  function inGrid(i, j) { return i >= 0 && j >= 0 && i < C.GRID && j < C.GRID; }
  function tileAt(state, i, j) { return inGrid(i, j) ? state.tiles[j * C.GRID + i] : null; }
  function facilityAt(state, i, j) {
    for (const f of state.facilities) if (f.x === i && f.y === j) return f;
    return null;
  }
  function isBlocked(state, i, j) { return !inGrid(i, j) || !!facilityAt(state, i, j); }
  function collectionTile(f) { return { x: f.x, y: f.y + 1 }; }

  function storageCap(state) {
    let cap = C.BASE_STORAGE;
    for (const f of state.facilities) if (f.type === 'warehouse') cap += C.WAREHOUSE_STORAGE * f.level;
    return cap;
  }
  function canAfford(state, cost) {
    for (const k in cost) if ((state.storage[k] || 0) < cost[k]) return false;
    return true;
  }
  function pay(state, cost) { for (const k in cost) state.storage[k] = (state.storage[k] || 0) - cost[k]; }
  // Adds up to n of a resource, respecting the cap. Returns how much was actually added.
  function addResource(state, res, n) {
    const cap = storageCap(state);
    const cur = state.storage[res] || 0;
    const add = Math.max(0, Math.min(n, cap - cur));
    state.storage[res] = cur + add;
    return add;
  }
  function hasFacility(state, type) { return state.facilities.some(f => f.type === type); }
  function countStaffed(state) { return state.facilities.filter(f => f.staffed).length; }

  return {
    newGame, load, save, reset,
    inGrid, tileAt, facilityAt, isBlocked, collectionTile,
    storageCap, canAfford, pay, addResource, hasFacility, countStaffed,
  };
})();
