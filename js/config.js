// Cordwood — balancing & content definitions.
// Everything tunable lives here. Numbers are prototype placeholders.
window.CW = window.CW || {};

CW.CONFIG = {
  TILE_W: 64,
  TILE_H: 32,
  GRID: 14,                 // biome is GRID x GRID tiles
  AVATAR_SPEED: 2.6,        // tiles per second
  AVATAR_RADIUS: 0.22,      // collision radius in tiles

  BASE_STORAGE: 150,        // central storage cap per resource, before warehouses
  WAREHOUSE_STORAGE: 150,   // added per warehouse level
  START_STORAGE: { timber: 30, lumber: 0, planks: 0, goods: 0 },

  // Forest tiles
  YIELD_PER_UNIT: 0.02,     // yield lost per unit of timber harvested
  REGROW_PER_SEC: 0.0015,   // natural regrowth (~11 min from bare to full)
  NURSERY_RADIUS: 2,        // Chebyshev radius of nursery effect
  NURSERY_MULT: 5,          // regrowth multiplier inside that radius

  // Leveling
  LEVEL_COST_GROWTH: 1.6,   // cost multiplier per level
  LEVEL_RATE_BONUS: 0.35,   // +35% output per level
  // Staffing
  HIRE_COST_BASE: 5,        // trade goods for the first hire
  HIRE_COST_STEP: 2,        // +goods per staffed facility already hired
  TRAIN_COST_BASE: 4,
  TRAIN_COST_GROWTH: 1.5,
  STAFF_RATE_BONUS: 0.25,   // +25% output per staff level beyond 1

  // Offline
  OFFLINE_CAP_HOURS: 72,
  OFFLINE_STEP: 2,          // seconds per simulation step when catching up
  OFFLINE_MIN_SEC: 30,      // ignore shorter absences

  AUTOSAVE_SEC: 5,
};

CW.RESOURCES = {
  timber: { name: 'Timber',      color: '#b5652e' },
  lumber: { name: 'Lumber',      color: '#c9924a' },
  planks: { name: 'Planks',      color: '#e3c27f' },
  goods:  { name: 'Trade Goods', color: '#5a9a4e' },
};
CW.RESOURCE_ORDER = ['timber', 'lumber', 'planks', 'goods'];

// rate = production cycles per minute at level 1, unstaffed, full yield.
// buffer = on-site buffer capacity at level 1 (scales with level).
CW.FACILITIES = {
  woodcutter: {
    name: 'Woodcutter Camp', code: 'WC', placeOn: 'forest',
    cost: { timber: 15 }, input: null, output: { timber: 1 },
    rate: 12, buffer: 24,
    color: '#8b5a2b',
    desc: 'Harvests raw timber. Slowly depletes the forest tile it sits on.',
  },
  sawmill: {
    name: 'Sawmill', code: 'SM', placeOn: 'grass',
    cost: { timber: 40 }, input: { timber: 2 }, output: { lumber: 1 },
    rate: 6, buffer: 18,
    color: '#a88f5a',
    desc: 'Turns 2 timber into 1 lumber.',
  },
  planing: {
    name: 'Planing Mill', code: 'PM', placeOn: 'grass',
    cost: { lumber: 30 }, input: { lumber: 1 }, output: { planks: 1 },
    rate: 5, buffer: 15,
    color: '#c9b37a',
    desc: 'Planes lumber into planks.',
  },
  carpentry: {
    name: 'Carpentry Shop', code: 'CS', placeOn: 'grass',
    cost: { planks: 30 }, input: { planks: 3 }, output: { goods: 1 },
    rate: 2, buffer: 8,
    color: '#7a5c3a',
    desc: 'Crafts 3 planks into 1 trade good — the currency for hiring.',
  },
  warehouse: {
    name: 'Warehouse', code: 'WH', placeOn: 'grass',
    cost: { planks: 20 }, passive: 'storage',
    color: '#6b6b7a',
    desc: 'Raises central storage cap for every resource.',
  },
  guildhall: {
    name: 'Guild Hall', code: 'GH', placeOn: 'grass',
    cost: { goods: 8 }, passive: 'hiring', unique: true,
    color: '#8b3f3f',
    desc: 'Unlocks hiring. Staffed facilities deliver to storage on their own.',
  },
  nursery: {
    name: 'Nursery', code: 'NU', placeOn: 'grass',
    cost: { planks: 15 }, passive: 'replant',
    color: '#4f8a4a',
    desc: 'Forest tiles within 2 squares regrow 5× faster.',
  },
};
CW.FACILITY_ORDER = ['woodcutter', 'sawmill', 'planing', 'carpentry', 'warehouse', 'nursery', 'guildhall'];
