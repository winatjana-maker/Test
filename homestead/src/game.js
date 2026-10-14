<script>
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint');
  const ui = {
    rate: document.getElementById('n-rate'),
    logs: document.getElementById('n-logs'), sap: document.getElementById('n-sap'), cash: document.getElementById('n-cash'),
    chipLogs: document.getElementById('chip-logs'), chipSap: document.getElementById('chip-sap'), chipCash: document.getElementById('chip-cash'),
  };
  const FONT = 'Fredoka, "Trebuchet MS", sans-serif';
  // Testing aid: remove before release.
  document.getElementById('test-cash').addEventListener('click', () => { cash += 100; updateHud('cash'); });

  // 2.5D: the ground is squashed vertically (TILT) so the camera looks down at an angle.
  // Game logic lives in "world" units; drawing applies the tilt, camera offset and zoom.
  const TILT = 0.52;
  const ZOOM = 0.75;          // zoomed out so more of the business fits on screen
  const TILE = 64;
  const WORLD_W = 4200, WORLD_H = 4200;
  const CX = WORLD_W / 2, CY = WORLD_H / 2;
  const ACCEL = 14;
  const CAM_EASE = 6;
  const REACH = 26;           // extra gap between player and node that still counts as "near"

  // ---------- Things that grow, and what they give ----------
  // wood = pine logs. Redwood isn't sold at the counter: it goes to the sawmill or onto delivery trucks.
  const SPECIES = {
    pine: { item: 'wood', hp: 4, r: 14, mult: 1 },
    oak: { item: 'oak', hp: 6, r: 16, mult: 1 },
    redwood: { item: 'redwood', hp: 12, r: 28, mult: 2 },
  };
  const LOGS = ['wood', 'oak', 'redwood'];
  const ITEM_NAME = { wood: 'Pine', oak: 'Oak', redwood: 'Redwood', plank: 'Planks', syrup: 'Syrup', sap: 'Sap', chair: 'Chairs', table: 'Tables' };
  const PLANKS_PER = { wood: 1, oak: 2, redwood: 4 };            // sawmill yield per log
  const PRICE = { wood: 2, oak: 4, plank: 6, syrup: 12, redwood: 10, chair: 45, table: 90 };
  const SHOP = ['wood', 'oak', 'plank', 'syrup'];                 // what the counter sells, left to right

  // ---------- Layout (world units, relative to the store) ----------
  const P = (dx, dy) => ({ x: CX + dx, y: CY + dy });
  const STORE = { x: CX, front: CY - 40, w: 320, d: 100 };
  const DROP = { ...P(-100, 40), w: 110, d: 70 };
  const PALLET = P(-250, 40);
  const LANES = [CX + 60, CX + 150];
  const LEAVE_X = CX + 105;
  const QUEUE = { y: CY + 18, gap: 80, size: 5 };
  const SPAWN_Y = CY + 820;
  const PILES = { store: { ...P(310, -20), r: 46 }, dock: { ...P(-840, 610), r: 46 },
    showroom: { ...P(1700, 320), r: 46 }, rail: { ...P(-420, 1780), r: 52 } };
  const YARD = { ...P(-100, -470), cols: 15, rows: 4, gap: 72 };   // tree yard north of the store
  const GROVE = { ...P(760, -470), cols: 5, rows: 5, gap: 82 };    // maple grove north-east
  const WH = { x0: CX - 1000, x1: CX - 620, y0: CY - 320, y1: CY + 40 };
  const WH_IN = P(-680, -60);
  const ANNEX = { x0: CX - 1440, x1: CX - 1080, y0: CY - 320, y1: CY + 40 };   // second warehouse, west of the first
  const PALLETS = [P(-250, 40), P(-320, 40), P(-390, 40), P(-250, -25), P(-320, -25), P(-390, -25)];  // the pallet yard
  const HQ = { x: CX + 700, front: CY + 760, w: 260, d: 120 };
  const RACKS = [CY - 252, CY - 182, CY - 112];
  const RACK = { x: CX - 810, w: 270, d: 22 };
  const BELT = { x0: CX - 670, x1: CX - 162, y: CY - 128 };
  const SAW = { x: CX + 560, front: CY - 40, w: 170, d: 100 };
  const SAW_IN = { ...P(540, 34), w: 110, d: 62 };
  const SHACK = { x: CX + 900, front: CY - 60, w: 150, d: 90 };
  const SHACK_IN = { ...P(900, 14), w: 110, d: 62 };
  const DOCK = P(-840, 490);

  // Land you can buy beyond the forest. Each district is fenced off until you own its deed.
  const DISTRICTS = {
    reserve: { name: 'Redwood Reserve', x0: CX - 520, x1: CX + 520, y0: CY - 2070, y1: CY - 1600, ground: '#6e8f4a' },
    east: { name: 'Furniture District', x0: CX + 1600, x1: CX + 2080, y0: CY - 430, y1: CY + 430, ground: '#cdb98f' },
    rail: { name: 'Rail Yard', x0: CX - 1450, x1: CX - 150, y0: CY + 1600, y1: CY + 2080, ground: '#b3a892' },
  };
  // dirt roads through the forest to each district (trees never grow on them)
  const ROADS = [
    { x0: CX - 70, x1: CX + 70, y0: CY - 1600, y1: CY - 640 },
    { x0: CX + 1100, x1: CX + 1600, y0: CY - 60, y1: CY + 60 },
    { x0: CX - 870, x1: CX - 730, y0: CY + 1160, y1: CY + 1600 },
    { x0: CX + 1990, x1: CX + 2090, y0: CY + 430, y1: CY + 1100 },
  ];
  const RESERVE = { x: CX, y: CY - 1835, cols: 8, gap: 115 };
  const WORKSHOP = { x: CX + 1740, front: CY - 80, w: 220, d: 110 };
  const SHOWROOM = { x: CX + 1880, front: CY + 170, w: 190, d: 110 };
  const CAR = { x: CX + 2040, park: CY + 120, start: CY + 1150 };
  const STATION = { x: CX - 800, front: CY + 1870, w: 260, d: 100 };
  const TRACK_Y = CY + 1990;
  const BILLBOARD = P(330, 700);

  // ---------- Upgrades (pay by standing on the tile) ----------
  const UPGRADES = [
    // you
    { id: 'run', name: 'Run Speed', ...P(-520, 210), costs: [15, 45, 100, 500, 1200], note: 'Move faster' },
    { id: 'swing', name: 'Faster Swing', ...P(-370, 210), costs: [10, 35, 90, 400], note: 'Gather faster' },
    { id: 'tools', name: 'Better Tools', ...P(-220, 210), costs: [25, 70, 160, 600, 1500], note: '+1 per hit' },
    { id: 'price', name: 'Better Prices', ...P(-70, 210), costs: [40, 110, 250, 800, 2000], note: '+$1 per item' },
    // staff and machines
    { id: 'cashier', name: 'Cashier', hire: 'Hire Cashier', ...P(-520, 480), costs: [30, 80, 180, 600], note: 'Serve customers faster' },
    { id: 'lumber', name: 'Lumber Bot', hire: 'Buy Lumber Bot', ...P(-370, 480), costs: [150, 220, 400, 1200],
      note: 'Chops & restocks logs', more: 'Faster, carries more' },
    { id: 'tapper', name: 'Sap Tapper', hire: 'Hire Sap Tapper', ...P(-220, 480), costs: [200, 350, 600, 1500],
      note: 'Collects sap for you', more: 'Faster, carries more', needs: 'shack' },
    { id: 'lane2', name: 'Lane 2', hire: 'Open Lane 2', ...P(-70, 480), costs: [350], note: 'Serve two lines at once' },
    { id: 'truck', name: 'Logging Truck', hire: 'Buy Logging Truck', ...P(-500, 20), costs: [600, 900, 1500, 4000],
      note: 'Hauls 40+ logs, loves redwood', more: 'Faster, hauls more' },
    // facilities: the tile sits by the facility
    { id: 'store', name: 'Store', hire: 'Expand Store', ...P(320, 170), costs: [120, 350, 800, 2500, 6000], note: 'Bigger orders, more shelf space' },
    { id: 'farm', name: 'Tree Yard', hire: 'Build Tree Yard', ...P(560, -470), costs: [60, 200, 450, 1500],
      note: 'Pine & oak that grow back', more: 'More rows, faster growth' },
    { id: 'grove', name: 'Maple Grove', hire: 'Plant Maple Grove', ...P(1080, -470), costs: [150, 300, 600, 1500, 3000],
      note: 'Maples drip sap', more: 'More maples, faster sap' },
    { id: 'shack', name: 'Sugar Shack', hire: 'Build Sugar Shack', ...P(1080, 80), costs: [200, 400, 800, 2000],
      note: 'Boils sap into syrup', more: 'Boils faster', needs: 'grove' },
    { id: 'sawmill', name: 'Sawmill', hire: 'Build Sawmill', ...P(720, 150), costs: [250, 500, 900, 2500, 6000],
      note: 'Logs into planks', more: 'Cuts faster' },
    { id: 'warehouse', name: 'Warehouse', hire: 'Build Warehouse', ...P(-960, 170), costs: [100, 250, 600, 2000, 5000],
      note: 'Stores extra logs', more: 'Holds more' },
    { id: 'forklift', name: 'Forklift', hire: 'Buy Forklift', ...P(-815, 170), costs: [200, 450, 800, 2000, 4000],
      note: 'Moves pallets inside', more: 'Faster, carries more', needs: 'warehouse' },
    { id: 'conveyor', name: 'Conveyor', hire: 'Build Conveyor', ...P(-670, 170), costs: [180, 360, 700, 2000, 5000],
      note: 'Belt to the shelves', more: 'Faster belt', needs: 'warehouse' },
    { id: 'dock', name: 'Loading Dock', hire: 'Build Loading Dock', ...P(-680, 640), costs: [250, 500, 1500],
      note: 'Trucks place big orders', more: 'Bigger orders, more often', needs: 'warehouse' },
    // big business
    { id: 'fleet', name: 'Bot Fleet', hire: 'Add Lumber Bot', ...P(-520, 770), costs: [1500, 3000, 6000],
      note: '+1 Lumber Bot', more: '+1 more Lumber Bot', needs: 'lumber' },
    { id: 'drone', name: 'Cash Drone', hire: 'Buy Cash Drone', ...P(-370, 770), costs: [2500, 5000],
      note: 'Collects cash for you', more: 'Faster drone' },
    { id: 'ads', name: 'Billboards', hire: 'Put Up Billboards', ...P(-220, 770), costs: [1200, 3000, 7000],
      note: 'Customers buy more', more: 'Even bigger orders' },
    // land deeds, and what you build on them
    { id: 'reserve', name: 'Redwood Reserve', hire: 'Buy Redwood Reserve', ...P(0, -1490), costs: [3000, 4000, 8000, 16000],
      note: 'Redwoods that grow back', more: 'More redwoods, faster growth' },
    { id: 'east', name: 'Furniture District', hire: 'Buy Furniture District', ...P(1490, 0), costs: [5000],
      note: 'Land for furniture making' },
    { id: 'workshop', name: 'Workshop', hire: 'Build Workshop', ...P(1700, 90), costs: [2000, 4000, 8000, 16000],
      note: 'Planks into chairs & tables', more: 'Builds faster', needs: 'east' },
    { id: 'showroom', name: 'Showroom', hire: 'Build Showroom', ...P(1880, 330), costs: [3000, 6000, 12000],
      note: 'Rich buyers drive in', more: 'More buyers, bigger buys', needs: 'workshop' },
    { id: 'rail', name: 'Rail Yard', hire: 'Buy Rail Yard', ...P(-800, 1490), costs: [10000, 15000, 30000, 60000],
      note: 'Freight trains, huge orders', more: 'More trains, bigger orders' },
    // logistics: unclog the warehouse
    { id: 'forkfleet', name: 'Forklift Fleet', hire: 'Add a Forklift', ...P(-520, 1030), costs: [800, 1600, 3200, 6400],
      note: '+1 forklift working the pallets', more: '+1 more forklift', needs: 'forklift' },
    { id: 'palletyard', name: 'Pallet Yard', hire: 'Expand Pallet Yard', ...P(-370, 1030), costs: [500, 1500, 4000],
      note: 'More pallets for overflow', more: 'Even more pallets', needs: 'warehouse' },
    { id: 'trucks', name: 'Truck Fleet', hire: 'Add Logging Truck', ...P(-220, 1030), costs: [5000, 10000],
      note: '+1 logging truck', more: '+1 more truck', needs: 'truck' },
    { id: 'annex', name: 'Warehouse Annex', hire: 'Build Annex', ...P(-1260, 170), costs: [3000, 6000, 12000],
      note: '+1,500 storage', more: '+more storage', needs: 'warehouse' },
    { id: 'kiln', name: 'Drying Kiln', hire: 'Build Drying Kiln', ...P(560, 150), costs: [1500, 4000],
      note: 'Kiln-dried planks sell for +$4', more: 'Planks sell for +$8', needs: 'sawmill' },
    { id: 'hq', name: 'Head Office', hire: 'Build Head Office', ...P(700, 960), costs: [20000, 50000, 100000],
      note: '+10% on every sale', more: 'Bigger bonus on every sale' },
  ];
  const TILE_SIZE = 88;
  const level = {}, paid = {};
  for (const u of UPGRADES) { level[u.id] = 0; paid[u.id] = 0; }
  const NAMES = Object.fromEntries(UPGRADES.map(u => [u.id, u.name]));

  const gatherTime = () => [1.0, 0.75, 0.55, 0.4, 0.3][level.swing];
  const perHit = () => 1 + level.tools;
  const speed = () => [230, 270, 315, 365, 420, 480][level.run];
  const serveTime = () => [0.6, 0.35, 0.22, 0.12, 0.07][level.cashier];
  const checkoutTime = () => [1.2, 0.6, 0.3, 0.1, 0.05][level.cashier];
  const shelfCap = () => [20, 40, 70, 120, 200, 300][level.store];
  const whCap = () => [0, 200, 500, 1200, 3000, 5000][level.warehouse] + [0, 1500, 3000, 6000][level.annex];
  const mainCap = () => [0, 200, 500, 1200, 3000, 5000][level.warehouse];
  const palletCap = () => [40, 120, 300, 600][level.palletyard];
  const incomeMul = () => [1, 1.1, 1.25, 1.5][level.hq];
  const yardSpots = () => [0, 12, 24, 48, 60][level.farm];
  const growTime = () => [25, 25, 18, 12, 8][level.farm];
  const groveSpots = () => [0, 6, 10, 15, 20, 25][level.grove];
  const sapTime = () => [20, 20, 14, 9, 7, 5][level.grove];            // seconds for a maple's bucket to fill
  const sawTime = () => [2, 2, 1.2, 0.6, 0.35, 0.2][level.sawmill];
  const sawCap = () => [20, 20, 30, 40, 60, 80][level.sawmill];
  const boilTime = () => [3, 3, 1.8, 1, 0.5][level.shack];            // two sap → one bottle
  const reserveSpots = () => [0, 8, 16, 24, 32][level.reserve];
  const reserveGrow = () => [60, 60, 45, 30, 20][level.reserve];
  const workshopTime = () => [3, 3, 2, 1.2, 0.6][level.workshop];
  const buyerEvery = () => [12, 12, 6, 3][level.showroom];
  const trainEvery = () => [60, 60, 40, 25, 15][level.rail];
  const adsMul = () => [1, 1.25, 1.5, 2][level.ads];
  const BELT_SPEED = [0, 140, 200, 280, 380, 500], BELT_GAP = [0, 0.45, 0.25, 0.12, 0.07, 0.04];
  const WS_CAP = 30, WS_OUT_CAP = 20, SHOW_CAP = 24;
  const PALLET_CAP = 40, SAW_CAP = 20, SAW_OUT_CAP = 60, SHACK_CAP = 30, SHACK_OUT_CAP = 30;
  const ORDER = [[1, 4], [2, 6], [4, 10], [6, 15], [8, 20], [10, 28]];
  const STORE_LOOK = [
    { name: 'GENERAL STORE', awning: '#d9644a' }, { name: 'MARKET', awning: '#3d7cc9' },
    { name: 'BIG MARKET', awning: '#2f9d8f' }, { name: 'SUPERSTORE', awning: '#c9a227' },
    { name: 'MEGASTORE', awning: '#8a5bc4' }, { name: 'FLAGSHIP STORE', awning: '#2b2a22' },
  ];
  const unitPrice = kind => PRICE[kind] + level.price + (kind === 'plank' ? [0, 4, 8][level.kiln] : 0);
  const upgradeTitle = (u, lv) => lv >= u.costs.length ? u.name
    : lv === 0 && u.hire ? u.hire : `${u.name} · Lv ${lv + (u.hire ? 1 : 2)}`;
  const upgradeNote = (u, lv) => lv > 0 && u.more ? u.more : u.note;

  const BOT_HOME = { lumber: P(-300, -210), truck: P(-430, -215) };
  const BOT_STATS = {
    lumber: { speed: [130, 165, 200, 240], hit: [1.3, 0.9, 0.6, 0.45], cap: [6, 10, 14, 20] },
    truck: { speed: [150, 180, 220, 260], hit: [0.5, 0.38, 0.28, 0.2], cap: [40, 60, 90, 120], big: true },
  };
  const HAULER_STATS = {
    porter: { cap: [4], speed: [105], step: 0.12 },
    forklift: { cap: [15, 25, 40, 60, 80], speed: [160, 190, 230, 260, 300], step: 0.03 },
    tapper: { cap: [6, 10, 16, 24], speed: [110, 140, 175, 210], step: 0.15 },
  };

  let W = 0, H = 0, Wc = 0, Hc = 0, DPR = 1;   // W/H: view size in world-zoomed px; Wc/Hc: real CSS px
  const cam = { x: 0, y: 0 };

  const player = { x: CX - 100, y: CY + 110, vx: 0, vy: 0, r: 16, face: 1, walk: 0, swing: 0 };
  const carried = { wood: 0, oak: 0, redwood: 0, sap: 0 };
  const stock = { wood: 0, oak: 0, plank: 0, syrup: 0 };   // store shelves
  const wh = { wood: 0, oak: 0, redwood: 0 };              // warehouse racks
  const pallet = { wood: 0, oak: 0, redwood: 0 };
  const saw = { q: { wood: 0, oak: 0, redwood: 0 }, out: 0, t: 0 };
  const shack = { sap: 0, out: 0, t: 0 };
  const pileAmt = { store: 0, dock: 0, showroom: 0, rail: 0 };
  const workshop = { planks: 0, chair: 0, table: 0, t: 0 };   // planks in, finished pieces waiting
  const showroom = { chair: 0, table: 0 };
  const car = { state: 'away', t: 6, y: 0, want: 0, got: 0, owed: 0, color: '#3d7cc9' };
  const train = { state: 'away', t: 10, x: 0, order: null, got: null, idle: 0 };
  const drone = { x: 0, y: 0, state: 'idle', target: null, load: 0, face: 1, bounce: 0, walk: 0, t: 0 };
  const income = [];                                          // [time, amount] for the $/min chip
  const pending = { shelf: { wood: 0, oak: 0, plank: 0, syrup: 0 }, pallet: { wood: 0, oak: 0, redwood: 0 }, saw: 0, shack: 0, ws: 0, show: { chair: 0, table: 0 } };
  let cash = 0;
  let stack = [];
  let decor = [];
  let nodes = [];
  let customers = [];
  let served = 0;
  let bots = [];
  let haulers = [];
  let belt = [];
  const truck = { state: 'away', t: 6, x: 0, face: 1, order: null, got: null };
  const fx = [];
  const gather = { node: null, t: 0 };
  const timers = { drop: 0, sawDrop: 0, shackDrop: 0, collect: 0, pay: 0, refill: 0, full: 0, saw: 0, sawPull: 0, syrup: 0, ws: 0, rate: 0 };
  const tileState = { id: null, wait: 0, lock: null };

  const palletCount = () => [1, 2, 4, 6][level.palletyard];
  const sawIn = () => saw.q.wood + saw.q.oak + saw.q.redwood;
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

  function seeded(seed) {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  const inTown = (x, y) => (x > CX - 1080 && x < CX + 1160 && y > CY - 720 && y < CY + 1160) ||
    (x > CX - 1520 && x <= CX - 1080 && y > CY - 420 && y < CY + 520);
  const inRectXY = (r, x, y, m = 0) => x > r.x0 - m && x < r.x1 + m && y > r.y0 - m && y < r.y1 + m;
  const offLimits = (x, y) => inTown(x, y) || Object.values(DISTRICTS).some(d => inRectXY(d, x, y, 70)) ||
    ROADS.some(r => inRectXY(r, x, y, 40));

  function makeDecor() {
    const rnd = seeded(7);
    decor = [];
    const n = Math.round(WORLD_W * WORLD_H / 9000);
    for (let i = 0; i < n; i++) {
      const x = rnd() * WORLD_W, y = rnd() * WORLD_H, kind = rnd() < 0.8 ? 'tuft' : 'flower', hue = rnd();
      if (x > WH.x0 - 10 && x < WH.x1 + 10 && y > WH.y0 && y < WH.y1 + 10) continue;
      if (Math.abs(x - LEAVE_X) < 120 && y > CY) continue;
      decor.push({ x, y, kind, hue });
    }
  }

  // Wild forest in rings around town: pine close in, more oak further out, giant redwoods at the edge.
  // Wild trees don't grow back; the tree yard does.
  function makeNodes() {
    const rnd = seeded(42);
    nodes = [];
    const fits = (x, y, r) =>
      x > 70 && y > 70 && x < WORLD_W - 70 && y < WORLD_H - 70 && !offLimits(x, y) &&
      !(Math.abs(x - LEAVE_X) < 140 && y > CY) &&
      !(x < CX - 1000 && Math.abs(y - DOCK.y) < 100) &&
      nodes.every(n => Math.hypot(n.x - x, n.y - y) > n.r + r + 34);
    const add = (species, x, y) => {
      const sp = SPECIES[species];
      if (!fits(x, y, sp.r)) return false;
      nodes.push({ type: 'tree', species, x, y, r: sp.r, hp: sp.hp, max: sp.hp, shake: 0,
                   size: species === 'redwood' ? 1.8 : 0.85 + rnd() * 0.3, seed: rnd() });
      return true;
    };
    const cluster = (pick, ang, dist, count, spread) => {
      const cx = CX + Math.cos(ang) * dist, cy = CY + Math.sin(ang) * dist;
      for (let tries = count * 4; tries > 0 && count > 0; tries--) {
        const a = rnd() * Math.PI * 2, d = rnd() * spread;
        if (add(pick(), cx + Math.cos(a) * d, cy + Math.sin(a) * d)) count--;
      }
    };
    for (let ring = 0; ring <= 8; ring++) {
      const dist = 1050 + ring * 120;
      const per = 6 + ring * 2;
      const oakShare = Math.min(0.7, 0.2 + ring * 0.08);
      for (let k = 0; k < per; k++) {
        const ang = (k / per) * Math.PI * 2 + rnd() * 0.5 + ring * 0.7;
        cluster(() => rnd() < oakShare ? 'oak' : 'pine', ang, dist + (rnd() - 0.5) * 100, 5 + ring, 90 + ring * 12);
      }
    }
    // a starter stand of wild pine just east of the store, so there's something to chop on day one
    for (const dx of [260, 330, 400, 470]) for (const dy of [-300, -225]) {
      nodes.push({ type: 'tree', species: 'pine', x: CX + dx + (dy % 2) * 10, y: CY + dy, r: 14, hp: 4, max: 4, shake: 0,
                   size: 0.85 + rnd() * 0.3, seed: rnd() });
    }
    for (let i = 0, placed = 0; i < 600 && placed < 30; i++) {
      const a = rnd() * Math.PI * 2, d = 1300 + rnd() * 700;
      if (add('redwood', CX + Math.cos(a) * d, CY + Math.sin(a) * d)) placed++;
    }
  }

  // Tree yard: rows of pine and oak that grow back. Maple grove: maples that fill sap buckets.
  function ensureYard() {
    const have = nodes.filter(n => n.farm && !n.reserve).length;
    for (let i = have; i < yardSpots(); i++) {
      const row = Math.floor(i / YARD.cols), col = i % YARD.cols;
      const species = row % 2 ? 'oak' : 'pine', sp = SPECIES[species];
      nodes.push({ type: 'tree', species, farm: true, x: YARD.x + (col - (YARD.cols - 1) / 2) * YARD.gap + (row % 2) * 18,
                   y: YARD.y + (row - (YARD.rows - 1) / 2) * 72, r: sp.r, hp: sp.hp, max: sp.hp, shake: 0, size: 0.95, seed: i / 48, grow: 1 });
    }
    const reds = nodes.filter(n => n.reserve).length;
    for (let i = reds; i < reserveSpots(); i++) {
      const row = Math.floor(i / RESERVE.cols), col = i % RESERVE.cols;
      nodes.push({ type: 'tree', species: 'redwood', farm: true, reserve: true,
                   x: RESERVE.x + (col - (RESERVE.cols - 1) / 2) * RESERVE.gap + (row % 2) * 30, y: RESERVE.y + (row - 1.5) * 105,
                   r: 28, hp: 12, max: 12, shake: 0, size: 1.8, seed: i / 24, grow: 1 });
    }
    const maples = nodes.filter(n => n.type === 'maple').length;
    for (let i = maples; i < groveSpots(); i++) {
      const row = Math.floor(i / GROVE.cols), col = i % GROVE.cols;
      nodes.push({ type: 'maple', x: GROVE.x + (col - (GROVE.cols - 1) / 2) * GROVE.gap + (row % 2) * 20,
                   y: GROVE.y + (row - (GROVE.rows - 1) / 2) * 80, r: 15, sap: 0.5 + (i % 3) * 0.2, size: 1, shake: 0, seed: i / 15 });
    }
  }

  // ---------- Customers ----------
  const SKINS = ['#6b4127', '#8d5a3b', '#c68e62', '#f0c7a0', '#4a2c1a', '#a8714a'];
  const SHIRTS = ['#3d7cc9', '#e0a63a', '#8a5bc4', '#2f9d8f', '#d9644a', '#5f6b7a', '#c94f7c'];
  const HAIR = ['#16120f', '#3a2618', '#7a4a22', '#c9a15a', '#16120f'];
  const crnd = seeded(99);
  function pickKind() {
    if (served + customers.length < 3) return 'wood';
    const opts = [['wood', 4], ['oak', 2.5]];
    if (level.sawmill) opts.push(['plank', 2.5]);
    if (level.shack) opts.push(['syrup', 2]);
    let r = crnd() * opts.reduce((a, o) => a + o[1], 0);
    for (const [k, w] of opts) { if ((r -= w) < 0) return k; }
    return 'wood';
  }
  function newCustomer(lane, slot, atSlot) {
    const kind = pickKind();
    const [lo, hi] = ORDER[level.store];
    const scale = { wood: 1, oak: 0.8, plank: 0.8, syrup: 0.5 }[kind];
    const want = Math.max(1, Math.round((lo + crnd() * (hi - lo)) * scale * adsMul()));
    customers.push({
      kind, want, got: 0, taken: 0, owed: 0, state: 'walk', lane, slot,
      x: LANES[lane] + (crnd() - 0.5) * 6, y: atSlot ? QUEUE.y + slot * QUEUE.gap : SPAWN_Y + slot * 30,
      skin: SKINS[Math.floor(crnd() * SKINS.length)], shirt: SHIRTS[Math.floor(crnd() * SHIRTS.length)],
      hair: HAIR[Math.floor(crnd() * HAIR.length)], walk: crnd() * 6, t: 0, happy: 0,
    });
  }
  function fillQueue(atSlot) {
    for (let lane = 0; lane < 1 + level.lane2; lane++) {
      const waiting = customers.filter(c => c.lane === lane && c.state !== 'leave').length;
      for (let s = waiting; s < QUEUE.size; s++) newCustomer(lane, s, atSlot);
    }
  }

  makeDecor();
  makeNodes();
  fillQueue(true);

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    Wc = window.innerWidth; Hc = window.innerHeight;
    W = Wc / ZOOM; H = Hc / ZOOM;
    canvas.width = Wc * DPR; canvas.height = Hc * DPR;
    ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, 0, 0);
    placeStick();
    snapCamera();
  }

  const toScreen = (x, y) => [x - cam.x, y * TILT - cam.y];

  function camTarget() {
    const pad = 40;
    const fw = WORLD_W, fh = WORLD_H * TILT;
    const tx = player.x - W / 2, ty = player.y * TILT - H * 0.55;
    const cx = fw + pad * 2 <= W ? (fw - W) / 2 : Math.max(-pad, Math.min(fw - W + pad, tx));
    const cy = fh + pad * 2 <= H ? (fh - H) / 2 : Math.max(-pad - 60, Math.min(fh - H + pad, ty));
    return [cx, cy];
  }
  function snapCamera() { [cam.x, cam.y] = camTarget(); }

  function clampPlayer() {
    const r = player.r;
    player.x = Math.max(r, Math.min(WORLD_W - r, player.x));
    player.y = Math.max(r, Math.min(WORLD_H - r, player.y));
  }

  // Solid boxes, each { x (center), front (south edge), w, d }.
  function solidBoxes() {
    const boxes = [STORE];
    if (level.sawmill) boxes.push(SAW);
    if (level.shack) boxes.push(SHACK);
    if (level.workshop) boxes.push(WORKSHOP);
    if (level.showroom) boxes.push(SHOWROOM);
    if (level.rail) boxes.push(STATION);
    if (level.annex) {
      const cxa = (ANNEX.x0 + ANNEX.x1) / 2, wa = ANNEX.x1 - ANNEX.x0;
      boxes.push({ x: cxa, front: ANNEX.y0 + 14, w: wa, d: 14 });
      boxes.push({ x: ANNEX.x0 + 7, front: ANNEX.y1, w: 14, d: ANNEX.y1 - ANNEX.y0 });
      boxes.push({ x: ANNEX.x1 - 7, front: ANNEX.y1, w: 14, d: ANNEX.y1 - ANNEX.y0 });
      for (const ry of RACKS) boxes.push({ x: RACK.x + ANNEX_DX, front: ry, w: RACK.w, d: RACK.d });
    }
    if (level.hq) boxes.push(HQ);
    // land you don't own yet is fenced off
    for (const id in DISTRICTS) {
      if (level[id]) continue;
      const d = DISTRICTS[id];
      boxes.push({ x: (d.x0 + d.x1) / 2, front: d.y1, w: d.x1 - d.x0, d: d.y1 - d.y0 });
    }
    if (level.warehouse) {
      const cxw = (WH.x0 + WH.x1) / 2, ww = WH.x1 - WH.x0;
      boxes.push({ x: cxw, front: WH.y0 + 14, w: ww, d: 14 });
      boxes.push({ x: WH.x0 + 7, front: WH.y1, w: 14, d: WH.y1 - WH.y0 });
      boxes.push({ x: WH.x1 - 7, front: CY - 150, w: 14, d: CY - 150 - WH.y0 });
      boxes.push({ x: WH.x1 - 7, front: WH.y1, w: 14, d: WH.y1 - (CY - 10) });
      for (const ry of RACKS) boxes.push({ x: RACK.x, front: ry, w: RACK.w, d: RACK.d });
    }
    return boxes;
  }

  function collide() {
    for (const n of nodes) {
      if (n.type === 'tree' && n.hp <= 0) continue;
      const dx = player.x - n.x, dy = player.y - n.y;
      const d = Math.hypot(dx, dy), min = n.r + player.r - 4;
      if (d < min && d > 0.001) {
        player.x = n.x + dx / d * min;
        player.y = n.y + dy / d * min;
      }
    }
    for (const box of solidBoxes()) {
      const l = box.x - box.w / 2 - player.r, r = box.x + box.w / 2 + player.r;
      const t = box.front - box.d - player.r * 0.5, b = box.front + player.r * 0.6;
      if (player.x > l && player.x < r && player.y > t && player.y < b) {
        const push = [[player.x - l, -1, 0], [r - player.x, 1, 0], [player.y - t, 0, -1], [b - player.y, 0, 1]]
          .sort((a, c) => a[0] - c[0])[0];
        player.x += push[1] * push[0]; player.y += push[2] * push[0];
      }
    }
  }

  // ---------- Input: keyboard ----------
  const keys = new Set();
  const KEYMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  addEventListener('keydown', e => { if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); dismissHint(); } });
  addEventListener('keyup', e => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
  addEventListener('blur', () => keys.clear());

  // ---------- Input: joystick ----------
  // Lives at the bottom left (real screen px) and shows only while in use.
  const stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, R: 56 };
  function placeStick() { stick.ox = 16 + stick.R + 20; stick.oy = Hc - 110; }
  function aimStick(e) {
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > stick.R) { dx = dx / d * stick.R; dy = dy / d * stick.R; }
    stick.dx = dx; stick.dy = dy;
  }
  canvas.addEventListener('pointerdown', e => {
    if (stick.id !== null) return;
    if (e.clientX > Wc / 2 || e.clientY < Hc * 0.45) return;
    stick.id = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    aimStick(e);
    dismissHint();
  });
  canvas.addEventListener('pointermove', e => { if (e.pointerId === stick.id) aimStick(e); });
  const endStick = e => { if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; } };
  canvas.addEventListener('pointerup', endStick);
  canvas.addEventListener('pointercancel', endStick);

  let hintGone = false;
  function dismissHint() { if (!hintGone) { hintGone = true; setTimeout(() => hint.style.opacity = 0, 4000); } }

  function readInput() {
    let ix = 0, iy = 0;
    if (keys.has('l')) ix -= 1; if (keys.has('r')) ix += 1;
    if (keys.has('u')) iy -= 1; if (keys.has('d')) iy += 1;
    if (ix || iy) { const m = Math.hypot(ix, iy); return [ix / m, iy / m]; }
    if (stick.id !== null) {
      const m = Math.hypot(stick.dx, stick.dy);
      const dead = 8;
      if (m > dead) {
        const t = Math.min(1, (m - dead) / (stick.R - dead));
        return [stick.dx / m * t, stick.dy / m * t];
      }
    }
    return [0, 0];
  }

  // ---------- Screen anchors used by flying items ----------
  const STACK_SHOW = 18;
  const SHELF_SHOW = 25;
  const backTop = () => {
    const [px, py] = toScreen(player.x, player.y);
    return [px - 15 * player.face, py - 22 - Math.min(stack.length, STACK_SHOW) * 6.5];
  };
  const shelfSpot = kind => {
    const [sx, sy] = toScreen(STORE.x, STORE.front);
    const [ox, oy] = shelfOffset(kind, Math.min(stock[kind], SHELF_SHOW - 1));
    return [sx + ox, sy + oy];
  };
  const custSpot = c => { const [x, y] = toScreen(c.x, c.y); return [x, y - 40]; };
  const pileTop = key => {
    const p = PILES[key], [x, y] = toScreen(p.x, p.y);
    return [x, y - 8 - Math.min(Math.ceil(pileAmt[key] / 5), 72) / 6 * 2.4];
  };
  const playerChest = () => { const [x, y] = toScreen(player.x, player.y); return [x, y - 30]; };
  const palletSpot = () => { const s = PALLETS[Math.floor(Math.random() * palletCount())], [x, y] = toScreen(s.x, s.y); return [x, y - 14]; };
  const whSpot = () => { const [x, y] = toScreen(WH_IN.x, WH_IN.y); return [x, y - 20]; };
  const sawInSpot = () => { const [x, y] = toScreen(SAW.x - 62, SAW.front); return [x, y - 20]; };
  const sawOutSpot = () => { const [x, y] = toScreen(SAW.x + 64, SAW.front); return [x, y - 20]; };
  const shackInSpot = () => { const [x, y] = toScreen(SHACK.x - 50, SHACK.front); return [x, y - 20]; };
  const shackOutSpot = () => { const [x, y] = toScreen(SHACK.x + 52, SHACK.front); return [x, y - 20]; };
  const wsInSpot = () => { const [x, y] = toScreen(WORKSHOP.x - 80, WORKSHOP.front); return [x, y - 20]; };
  const wsOutSpot = () => { const [x, y] = toScreen(WORKSHOP.x + 80, WORKSHOP.front); return [x, y - 20]; };
  const showSpot = k => () => { const [x, y] = toScreen(SHOWROOM.x + (k === 'chair' ? -40 : 40), SHOWROOM.front); return [x, y - 36]; };
  const carSpot = () => { const [x, y] = toScreen(CAR.x, car.y); return [x, y - 40]; };
  const trainSpot = () => { const [x, y] = toScreen(train.x - 220, TRACK_Y); return [x, y - 50]; };
  const truckSpot = () => { const [x, y] = toScreen(truck.x, DOCK.y); return [x - 20 * truck.face, y - 50]; };

  function fly(kind, from, to, life, done, lift = 50) {
    const [x0, y0] = typeof from === 'function' ? from() : from;
    fx.push({ type: 'fly', kind, x0, y0, to, t: 0, life, done, lift });
  }
  function popText(x, y, h, text, color) {
    fx.push({ type: 'text', x, y, h, t: 0, life: 1.0, text, color });
  }
  function payBills(from, key, total) {
    total = Math.round(total * incomeMul());
    if (total <= 0) return;
    income.push([performance.now(), total]);
    const n = Math.min(total, 30), base = Math.floor(total / n), rem = total - base * n;
    for (let k = 0; k < n; k++) {
      const amt = base + (k < rem ? 1 : 0);
      setTimeout(() => fly('cash', from, () => pileTop(key), 0.4, () => { pileAmt[key] += amt; }, 40), k * 40);
    }
  }

  // ---------- Gathering ----------
  // trees you can chop, and maples with a full bucket
  const ready = n => n.type === 'maple' ? n.sap >= 1 : n.hp > 0;
  function nearestNode() {
    let best = null, bd = Infinity;
    for (const n of nodes) {
      if (!ready(n)) continue;
      const d = Math.hypot(player.x - n.x, player.y - n.y) - n.r - player.r;
      if (d < REACH && d < bd) { bd = d; best = n; }
    }
    return best;
  }
  const nodeTime = n => n.type === 'maple' ? 0.4 : gatherTime();

  function hitNode(n, amt, to, arrive) {
    const kind = SPECIES[n.species].item;
    n.hp--; n.shake = 1;
    if (n.hp <= 0 && n.farm) n.grow = 0;
    popText(n.x, n.y, 92 * n.size, `+${amt} ${ITEM_NAME[kind]}`, { wood: '#ffe2b0', oak: '#f0c89a', redwood: '#ffb9a0' }[kind]);
    const [nx, ny] = toScreen(n.x, n.y);
    for (let i = 0; i < Math.min(amt, 12); i++) fly(kind, [nx, ny - 30], to, 0.35 + i * 0.05, null);
    if (arrive) setTimeout(arrive, 350);
    for (let i = 0; i < 6; i++) {
      fx.push({ type: 'chip', kind: 'wood', x: n.x, y: n.y, h: 26,
                vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 80, vh: 90 + Math.random() * 90, t: 0, life: 0.7 });
    }
    if (n.hp <= 0) {
      for (let i = 0; i < (n.species === 'redwood' ? 24 : 10); i++) {
        fx.push({ type: 'chip', kind: 'leaf', x: n.x, y: n.y, h: 60 * n.size,
                  vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 120, vh: 60 + Math.random() * 120, t: 0, life: 0.9 });
      }
    }
  }

  function tapMaple(n, amt, to, arrive) {
    n.sap = 0; n.shake = 0.5;
    popText(n.x, n.y, 80, `+${amt} Sap`, '#ffd27a');
    const [nx, ny] = toScreen(n.x, n.y);
    for (let i = 0; i < Math.min(amt, 6); i++) fly('sap', [nx + 8, ny - 30], to, 0.35 + i * 0.05, null);
    if (arrive) setTimeout(arrive, 350);
  }

  function harvest(n) {
    const amt = perHit() * (n.type === 'maple' ? 1 : SPECIES[n.species].mult);
    const kind = n.type === 'maple' ? 'sap' : SPECIES[n.species].item;
    carried[kind] += amt;
    updateHud(kind === 'sap' ? 'sap' : 'logs');
    const arrive = () => { for (let i = 0; i < amt; i++) stack.push(kind); };
    if (n.type === 'maple') tapMaple(n, amt, backTop, arrive);
    else hitNode(n, amt, backTop, arrive);
  }

  // ---------- Machines and crew ----------
  function ensureBots() {
    const want = { lumber: level.lumber ? 1 + level.fleet : 0, truck: level.truck ? 1 + level.trucks : 0 };
    for (const id in want) {
      for (let i = bots.filter(b => b.id === id).length; i < want[id]; i++) {
        const h = BOT_HOME[id];
        bots.push({ id, idx: i, x: h.x - i * (id === 'truck' ? 70 : 36), y: h.y, state: 'seek', target: null, load: [], t: 0, face: 1, bounce: 0 });
      }
    }
  }
  function ensureHaulers() {
    const add = (id, x, y) => { if (!haulers.some(h => h.id === id)) haulers.push({ id, x, y, state: 'idle', load: [], t: 0, face: 1, walk: 0, bounce: 0, target: null }); };
    if (level.warehouse) add('porter', WH_IN.x, WH_IN.y + 40);
    const forks = level.forklift ? 1 + level.forkfleet : 0;
    for (let i = haulers.filter(h => h.id === 'forklift').length; i < forks; i++) {
      haulers.push({ id: 'forklift', idx: i, x: WH_IN.x - 60 - i * 50, y: WH_IN.y + 30, state: 'idle', load: [], t: 0, face: 1, walk: 0, bounce: 0, target: null });
    }
    if (level.tapper) add('tapper', SHACK_IN.x, SHACK_IN.y + 40);
  }
  const bedOf = e => {
    const [x, y] = toScreen(e.x, e.y);
    if (e.id === 'porter' || e.id === 'tapper') return [x + 12 * e.face, y - 30 - Math.min(e.load.length, 6) * 5];
    if (e.id === 'forklift') return [x + 26 * e.face, y - 14 - Math.min(e.load.length, 12) * 3];
    const big = BOT_STATS[e.id].big;
    return [x - (big ? 24 : 10) * e.face, y - (big ? 34 : 26) - Math.min(e.load.length, 10) * 3];
  };

  function moveEntity(e, tx, ty, spd, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d < 1) return 0;
    const step = Math.min(d, spd * dt);
    e.x += dx / d * step; e.y += dy / d * step;
    if (Math.abs(dx) > 2) e.face = Math.sign(dx);
    e.bounce += dt * 18; e.walk += dt * 9;
    return d - step;
  }

  function updateBots(dt) {
    for (const b of bots) {
      const st = BOT_STATS[b.id], lv = level[b.id] - 1;
      const spd = st.speed[lv], cap = st.cap[lv];
      b.t += dt;
      if (b.state === 'seek') {
        if (b.load.length >= cap) { b.state = 'return'; continue; }
        if (!b.target || b.target.hp <= 0) {
          // nearest standing tree no other machine is on; the truck heads for redwoods first
          let best = null, bd = Infinity;
          for (const n of nodes) {
            if (n.type !== 'tree' || n.hp <= 0 || bots.some(o => o !== b && o.target === n)) continue;
            if (!st.big && n.species === 'redwood') continue;
            const d = Math.hypot(n.x - b.x, n.y - b.y) - (st.big && n.species === 'redwood' ? 700 : 0);
            if (d < bd) { bd = d; best = n; }
          }
          b.target = best;
        }
        if (!b.target) {
          if (b.load.length) b.state = 'return';
          else moveEntity(b, BOT_HOME[b.id].x - b.idx * (b.id === 'truck' ? 70 : 36), BOT_HOME[b.id].y, spd, dt);
          continue;
        }
        const n = b.target, gap = n.r + (st.big ? 40 : 26);
        const ang = Math.atan2(b.y - n.y, b.x - n.x);
        if (moveEntity(b, n.x + Math.cos(ang) * gap, n.y + Math.sin(ang) * gap, spd, dt) < 2) {
          b.state = 'work'; b.t = 0; b.face = n.x >= b.x ? 1 : -1;
        }
      } else if (b.state === 'work') {
        const n = b.target;
        if (!n || n.hp <= 0) { b.state = 'seek'; continue; }
        if (b.t >= st.hit[lv]) {
          b.t = 0;
          const amt = SPECIES[n.species].mult * (st.big ? 2 : 1), kind = SPECIES[n.species].item;
          for (let i = 0; i < amt; i++) b.load.push(kind);
          hitNode(n, amt, () => bedOf(b), null);
          if (b.load.length >= cap) b.state = 'return';
          else if (n.hp <= 0) b.state = 'seek';
        }
      } else if (b.state === 'return') {
        if (moveEntity(b, DROP.x + (st.big ? 0 : -24 + b.idx * 16), DROP.y + (st.big ? 24 : b.idx * 8), spd, dt) < 2) { b.state = 'unload'; b.t = 0; }
      } else if (b.state === 'unload') {
        if (b.t >= (st.big ? 0.035 : 0.08)) {
          b.t = 0;
          if (!b.load.length) { b.state = 'seek'; continue; }
          const kind = b.load[b.load.length - 1];
          const dest = route(kind);
          if (!dest) continue;
          b.load.pop();
          deliver(kind, dest, bedOf(b));
        }
      }
    }
  }

  function updateHaulers(dt) {
    for (const h of haulers) {
      const st = HAULER_STATS[h.id], lv = h.id === 'porter' ? 0 : level[h.id] - 1;
      const spd = st.speed[lv], cap = st.cap[lv];
      h.t += dt;
      if (h.id === 'tapper') { updateTapper(h, st, spd, cap, dt); continue; }
      const onPallet = sum(pallet);
      if (h.state === 'idle') {
        if (onPallet > 0) h.state = 'toPallet';
        else moveEntity(h, WH_IN.x - (h.id === 'forklift' ? 70 + (h.idx || 0) * 50 : 0), WH_IN.y + 40, spd, dt);
      } else if (h.state === 'toPallet') {
        const pspot = PALLETS[(h.idx || 0) % palletCount()];
        if (moveEntity(h, pspot.x - (h.id === 'forklift' ? 40 : 0), pspot.y + 30, spd, dt) < 2) { h.state = 'load'; h.t = 0; }
      } else if (h.state === 'load') {
        if (h.t >= st.step) {
          h.t = 0;
          const kind = LOGS.reduce((a, k) => pallet[k] > pallet[a] ? k : a, 'wood');
          if (pallet[kind] > 0 && h.load.length < cap) {
            pallet[kind]--; h.load.push(kind);
            fly(kind, palletSpot, () => bedOf(h), 0.25, null, 20);
          } else h.state = h.load.length ? 'toWh' : 'idle';
        }
      } else if (h.state === 'toWh') {
        if (moveEntity(h, WH_IN.x, WH_IN.y, spd, dt) < 2) { h.state = 'unload'; h.t = 0; }
      } else if (h.state === 'unload') {
        if (h.t >= st.step) {
          h.t = 0;
          if (!h.load.length) { h.state = 'idle'; continue; }
          if (sum(wh) >= whCap()) continue;
          const kind = h.load.pop();
          wh[kind]++;
          fly(kind, () => bedOf(h), rackSpot(kind), 0.3, null, 30);
        }
      }
    }
  }

  // tapper: walk to full maples, collect sap, carry it to the sugar shack
  function updateTapper(h, st, spd, cap, dt) {
    if (h.state === 'idle') {
      if (h.load.length >= cap) { h.state = 'toShack'; return; }
      const target = nodes.filter(n => n.type === 'maple' && n.sap >= 1)
        .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if (target) { h.target = target; h.state = 'toMaple'; }
      else if (h.load.length) h.state = 'toShack';
      else moveEntity(h, SHACK_IN.x - 60, SHACK_IN.y + 40, spd, dt);
    } else if (h.state === 'toMaple') {
      const n = h.target;
      if (!n || n.sap < 1) { h.state = 'idle'; return; }
      if (moveEntity(h, n.x - 26, n.y + 10, spd, dt) < 2) {
        const amt = Math.min(cap - h.load.length, 1 + level.tools);
        tapMaple(n, amt, () => bedOf(h), null);
        for (let i = 0; i < amt; i++) h.load.push('sap');
        h.state = 'idle';
      }
    } else if (h.state === 'toShack') {
      if (moveEntity(h, SHACK_IN.x, SHACK_IN.y, spd, dt) < 2) { h.state = 'unload'; h.t = 0; }
    } else if (h.state === 'unload') {
      if (h.t >= st.step) {
        h.t = 0;
        if (!h.load.length) { h.state = 'idle'; return; }
        if (shack.sap + pending.shack >= SHACK_CAP) return;
        h.load.pop(); pending.shack++;
        fly('sap', () => bedOf(h), shackInSpot, 0.3, () => { pending.shack--; shack.sap++; });
      }
    }
  }

  function updateTruck(dt) {
    if (!level.dock) return;
    const park = DOCK.x, out = -160;
    if (truck.state === 'away') {
      truck.t -= dt;
      if (truck.t <= 0) {
        const big = level.store + level.dock;
        truck.order = { wood: 15 + big * 10, oak: 6 + big * 5, redwood: level.truck ? 2 + big * 3 : 0 };
        truck.got = { wood: 0, oak: 0, redwood: 0 };
        truck.state = 'arrive'; truck.x = out; truck.face = 1;
      }
    } else if (truck.state === 'arrive') {
      truck.x = Math.min(park, truck.x + 260 * dt);
      if (truck.x >= park) { truck.state = 'load'; truck.t = 0; }
    } else if (truck.state === 'load') {
      truck.t += dt;
      if (truck.t >= 0.1) {
        truck.t = 0;
        for (const kind of LOGS) {
          if (truck.got[kind] >= truck.order[kind]) continue;
          const src = wh[kind] > 0 ? wh : pallet[kind] > 0 ? pallet : null;
          if (!src) continue;
          src[kind]--; truck.got[kind]++;
          fly(kind, src === wh ? whSpot : palletSpot, truckSpot, 0.6, null, 70);
          break;
        }
        if (LOGS.every(k => truck.got[k] >= truck.order[k])) {
          const total = Math.round(LOGS.reduce((a, k) => a + truck.order[k] * unitPrice(k), 0) * 1.5);
          popText(DOCK.x, DOCK.y, 90, `Order paid $${total}`, '#c9f2c9');
          payBills(truckSpot, 'dock', total);
          truck.state = 'leave'; truck.face = -1;
        }
      }
    } else if (truck.state === 'leave') {
      truck.x -= 260 * dt;
      if (truck.x <= out) { truck.state = 'away'; truck.t = [0, 25, 15, 8][level.dock]; }
    }
  }

  // ---------- Store logistics ----------
  // Where a delivered piece goes:
  //   pine/oak → store shelf, then sawmill, then pallet.  redwood → sawmill, then pallet.  sap → sugar shack.
  function route(kind) {
    if (kind === 'sap') {
      if (level.shack && shack.sap + pending.shack < SHACK_CAP) { pending.shack++; return 'shack'; }
      return null;
    }
    if (kind !== 'redwood' && stock[kind] + pending.shelf[kind] < shelfCap()) { pending.shelf[kind]++; return 'shelf'; }
    if (level.sawmill && sawIn() + pending.saw < sawCap()) { pending.saw++; return 'saw'; }
    if (level.warehouse && sum(pallet) + sum(pending.pallet) < palletCap()) { pending.pallet[kind]++; return 'pallet'; }
    return null;
  }
  function deliver(kind, dest, from) {
    const to = { shelf: () => shelfSpot(kind), saw: sawInSpot, pallet: palletSpot, shack: shackInSpot }[dest];
    fly(kind, from, to, dest === 'shelf' ? 0.3 : dest === 'shack' ? 0.8 : 0.45, () => {
      if (dest === 'saw') { pending.saw--; saw.q[kind]++; }
      else if (dest === 'shack') { pending.shack--; shack.sap++; }
      else { pending[dest][kind]--; (dest === 'shelf' ? stock : pallet)[kind]++; }
    }, dest === 'shack' ? 140 : 50);
  }
  function fullNotice(kind) {
    if (timers.full > 0) return;
    timers.full = 2;
    const msg = kind === 'sap' ? (level.shack ? 'Sugar shack is full!' : 'Build a Sugar Shack for sap')
      : kind === 'redwood' && !level.sawmill && !level.warehouse ? 'Redwood needs a sawmill or warehouse'
      : level.warehouse ? 'Storage full!' : 'Shelf full! Build a warehouse';
    popText(DROP.x, DROP.y, 40, msg, '#ffd0c4');
  }
  function pickRefill() {
    let best = null, bf = Infinity;
    for (const kind of ['wood', 'oak']) {
      if (wh[kind] <= 0 || stock[kind] + pending.shelf[kind] >= shelfCap()) continue;
      const f = stock[kind] + pending.shelf[kind];
      if (f < bf) { bf = f; best = kind; }
    }
    return best;
  }

  const inRect = (z, w, d) => Math.abs(player.x - z.x) < w / 2 && Math.abs(player.y - z.y) < d / 2;

  function updateStore(dt) {
    // restock: pieces leave your back one by one; anything that has nowhere to go stays on your back
    timers.drop -= dt;
    if (inRect(DROP, DROP.w, DROP.d) && stack.length && timers.drop <= 0) {
      timers.drop = 0.07;
      let i = stack.length - 1, dest = null;
      for (; i >= 0; i--) {
        if (stack.slice(i + 1).includes(stack[i])) continue;   // already tried this kind
        dest = route(stack[i]);
        if (dest) break;
      }
      if (dest) {
        const kind = stack[i];
        stack.splice(i, 1); carried[kind]--; updateHud();
        deliver(kind, dest, backTop());
      } else fullNotice(stack[stack.length - 1]);
    }
    timers.full -= dt;

    // warehouse → shelves: staff carry slowly; the conveyor is much faster
    timers.refill -= dt;
    if (level.warehouse && timers.refill <= 0) {
      const kind = pickRefill();
      if (kind) {
        wh[kind]--; pending.shelf[kind]++;
        if (level.conveyor) {
          belt.push({ kind, d: 0 });
          timers.refill = BELT_GAP[level.conveyor];
        } else {
          fly(kind, whSpot, () => shelfSpot(kind), 0.9, () => { pending.shelf[kind]--; stock[kind]++; }, 100);
          timers.refill = 0.9;
        }
      }
    }
    const beltSpeed = BELT_SPEED[level.conveyor], beltLen = BELT.x1 - BELT.x0;
    for (let i = belt.length - 1; i >= 0; i--) {
      const it = belt[i];
      it.d += beltSpeed * dt;
      if (it.d >= beltLen) { belt.splice(i, 1); pending.shelf[it.kind]--; stock[it.kind]++; }
    }

    // customers: the front of each line buys, pays at the register, and leaves
    const slots = [0, 0];
    for (const c of customers) if (c.state !== 'leave') c.slot = slots[c.lane]++;
    for (let i = customers.length - 1; i >= 0; i--) {
      const c = customers[i];
      c.t += dt;
      let tx, ty, spd = 120;
      if (c.state === 'leave') { tx = LEAVE_X; ty = SPAWN_Y + 80; spd = 150; }
      else { tx = LANES[c.lane]; ty = QUEUE.y + c.slot * QUEUE.gap; }
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
      if (d > 2) {
        const step = Math.min(d, spd * dt);
        c.x += dx / d * step; c.y += dy / d * step; c.walk += dt * 7;
      } else if (c.state === 'walk') c.state = 'wait';
      c.happy = Math.max(0, c.happy - dt);

      if (c.state === 'wait' && c.slot === 0) { c.state = 'buy'; c.t = 0; }
      if (c.state === 'buy') {
        if (c.taken < c.want && c.t > serveTime() && stock[c.kind] > 0) {
          c.t = 0; c.taken++;
          stock[c.kind]--;
          fly(c.kind, shelfSpot(c.kind), () => custSpot(c), 0.3, () => { c.got++; });
          c.owed += unitPrice(c.kind);
        }
        // out of stock for a while: take what they have, or walk out
        c.waitOut = stock[c.kind] === 0 && c.taken < c.want ? (c.waitOut || 0) + dt : 0;
        if (c.waitOut > 6 && c.taken === c.got) {
          if (c.got > 0) c.want = c.got;
          else {
            popText(c.x, c.y, 70, `Out of ${ITEM_NAME[c.kind].toLowerCase()}!`, '#ffd0c4');
            c.state = 'leave'; fillQueue(false);
            continue;
          }
        }
        if (c.got >= c.want) { c.state = 'checkout'; c.t = 0; }
      }
      if (c.state === 'checkout' && c.t >= checkoutTime()) {
        popText(c.x, c.y, 70, `+$${c.owed}`, '#c9f2c9');
        payBills(() => custSpot(c), 'store', c.owed);
        c.state = 'leave'; c.happy = 1.2; served++;
        fillQueue(false);
      }
      if (c.state === 'leave' && c.y > SPAWN_Y) customers.splice(i, 1);
    }

    // collect: walk onto a cash pile
    timers.collect -= dt;
    for (const key in PILES) {
      const p = PILES[key];
      if (pileAmt[key] > 0 && Math.hypot(player.x - p.x, player.y - p.y) < p.r + 10 && timers.collect <= 0) {
        timers.collect = 0.03;
        const take = Math.max(1, Math.ceil(pileAmt[key] / 40));
        pileAmt[key] -= take;
        fly('cash', () => pileTop(key), playerChest, 0.25, () => { cash += take; updateHud('cash'); }, 30);
      }
    }

    // upgrade tiles: stand on one and your cash pays into it
    timers.pay -= dt;
    const here = UPGRADES.find(u => inRect(u, TILE_SIZE, TILE_SIZE));
    if ((here ? here.id : null) !== tileState.id) {
      tileState.id = here ? here.id : null;
      tileState.wait = 0.5;
      tileState.lock = null;
    }
    tileState.wait -= dt;
    if (here && level[here.id] < here.costs.length && !(here.needs && !level[here.needs]) &&
        cash > 0 && timers.pay <= 0 && tileState.wait <= 0 && tileState.lock !== here.id) {
      const u = here, lv = level[u.id];
      timers.pay = 0.05;
      const cost = u.costs[lv];
      const chunk = Math.min(cash, cost - paid[u.id], Math.max(1, Math.ceil(cost / 25)));
      cash -= chunk; paid[u.id] += chunk;
      updateHud();
      fly('cash', playerChest, toScreen(u.x, u.y), 0.25, null, 30);
      if (paid[u.id] >= cost) {
        level[u.id]++; paid[u.id] = 0;
        tileState.lock = u.id;
        popText(u.x, u.y, 40, u.hire && level[u.id] === 1 ? `${u.name} ready!` : `${u.name} Lv ${level[u.id] + (u.hire ? 0 : 1)}!`, '#fff3a6');
        for (let i = 0; i < 16; i++) {
          fx.push({ type: 'chip', kind: 'spark', x: u.x, y: u.y, h: 4, vx: (Math.random() - 0.5) * 260,
                    vy: (Math.random() - 0.5) * 160, vh: 120 + Math.random() * 140, t: 0, life: 0.9 });
        }
        afterUpgrade();
        save(true);
      }
    }
  }

  function afterUpgrade() {
    ensureBots(); ensureYard(); ensureHaulers();
    if (level.drone && !drone.x) { drone.x = player.x - 50; drone.y = player.y - 20; }
    fillQueue(false);
    if (level.dock && truck.state === 'away') truck.t = Math.min(truck.t, 4);
  }

  function updateSaw(dt) {
    if (!level.sawmill) return;
    // feed it yourself: stand at the intake and your logs go in
    timers.sawDrop -= dt;
    if (inRect(SAW_IN, SAW_IN.w, SAW_IN.d) && timers.sawDrop <= 0 && sawIn() + pending.saw < sawCap()) {
      let i = -1;
      for (const k of ['redwood', 'oak', 'wood']) { i = stack.lastIndexOf(k); if (i >= 0) break; }
      if (i >= 0) {
        timers.sawDrop = 0.07;
        const kind = stack[i], from = backTop();
        stack.splice(i, 1); carried[kind]--; updateHud();
        pending.saw++;
        fly(kind, from, sawInSpot, 0.35, () => { pending.saw--; saw.q[kind]++; });
      }
    }
    // it pulls logs from the warehouse when it runs low, best wood first
    timers.sawPull -= dt;
    if (level.warehouse && sawIn() + pending.saw < 8 && timers.sawPull <= 0) {
      const kind = ['redwood', 'oak', 'wood'].find(k => wh[k] > 0);
      if (kind) {
        timers.sawPull = 0.3;
        wh[kind]--; pending.saw++;
        fly(kind, whSpot, sawInSpot, 1.2, () => { pending.saw--; saw.q[kind]++; }, 160);
      }
    }
    // cutting: redwood first (4 planks), then oak (2), then pine (1)
    const next = ['redwood', 'oak', 'wood'].find(k => saw.q[k] > 0);
    if (next && saw.out < SAW_OUT_CAP) {
      saw.t += dt;
      if (saw.t >= sawTime()) { saw.t = 0; saw.q[next]--; saw.out += PLANKS_PER[next]; }
    } else saw.t = 0;
    timers.saw -= dt;
    if (saw.out > 0 && timers.saw <= 0) {
      const wsRoom = level.workshop ? WS_CAP - workshop.planks - pending.ws : 0;
      const shelfRoom = stock.plank + pending.shelf.plank < shelfCap();
      // the workshop gets first pick while it's low; otherwise the shelf, then the workshop
      if (wsRoom > 0 && (workshop.planks + pending.ws < 12 || !shelfRoom)) {
        timers.saw = 0.2;
        saw.out--; pending.ws++;
        fly('plank', sawOutSpot, wsInSpot, 1.4, () => { pending.ws--; workshop.planks++; }, 240);
      } else if (shelfRoom) {
        timers.saw = 0.2;
        saw.out--; pending.shelf.plank++;
        fly('plank', sawOutSpot, () => shelfSpot('plank'), 0.7, () => { pending.shelf.plank--; stock.plank++; }, 80);
      }
    }
  }

  function updateShack(dt) {
    if (!level.shack) return;
    timers.shackDrop -= dt;
    if (inRect(SHACK_IN, SHACK_IN.w, SHACK_IN.d) && timers.shackDrop <= 0 && shack.sap + pending.shack < SHACK_CAP) {
      const i = stack.lastIndexOf('sap');
      if (i >= 0) {
        timers.shackDrop = 0.07;
        const from = backTop();
        stack.splice(i, 1); carried.sap--; updateHud();
        pending.shack++;
        fly('sap', from, shackInSpot, 0.35, () => { pending.shack--; shack.sap++; });
      }
    }
    if (shack.sap >= 2 && shack.out < SHACK_OUT_CAP) {
      shack.t += dt;
      if (shack.t >= boilTime()) { shack.t = 0; shack.sap -= 2; shack.out++; }
    } else shack.t = 0;
    timers.syrup -= dt;
    if (shack.out > 0 && timers.syrup <= 0 && stock.syrup + pending.shelf.syrup < shelfCap()) {
      timers.syrup = 0.25;
      shack.out--; pending.shelf.syrup++;
      fly('syrup', shackOutSpot, () => shelfSpot('syrup'), 0.9, () => { pending.shelf.syrup--; stock.syrup++; }, 120);
    }
  }

  // Workshop: planks → chairs (3) and tables (5); finished pieces go to the showroom.
  function updateWorkshop(dt) {
    if (!level.workshop) return;
    const need = { chair: 3, table: 5 };
    const kind = showroom.chair + workshop.chair <= (showroom.table + workshop.table) * 2 ? 'chair' : 'table';
    if (workshop.planks >= need[kind] && workshop.chair + workshop.table < WS_OUT_CAP) {
      workshop.t += dt;
      if (workshop.t >= workshopTime()) {
        workshop.t = 0; workshop.planks -= need[kind]; workshop[kind]++;
        popText(WORKSHOP.x, WORKSHOP.front, 120, `+1 ${kind === 'chair' ? 'Chair' : 'Table'}`, '#ffe2b0');
      }
    } else workshop.t = 0;
    timers.ws -= dt;
    if (level.showroom && timers.ws <= 0) {
      for (const k of ['chair', 'table']) {
        if (workshop[k] > 0 && showroom[k] + pending.show[k] < SHOW_CAP) {
          workshop[k]--; pending.show[k]++; timers.ws = 0.3;
          fly(k, wsOutSpot, showSpot(k), 0.9, () => { pending.show[k]--; showroom[k]++; }, 90);
          break;
        }
      }
    }
  }

  // Showroom buyers drive up, buy a few pieces, pay into the showroom's cash pile.
  const CAR_COLORS = ['#2b2a22', '#c9a227', '#8a1f2b', '#f2ece0', '#3d7cc9'];
  function updateBuyer(dt) {
    if (!level.showroom) return;
    if (car.state === 'away') {
      car.t -= dt;
      if (car.t <= 0 && showroom.chair + showroom.table > 0) {
        const lo = [1, 1, 2, 3][level.showroom], hi = [3, 3, 5, 8][level.showroom];
        car.want = lo + Math.floor(Math.random() * (hi - lo + 1));
        car.got = 0; car.owed = 0; car.y = CAR.start; car.state = 'arrive';
        car.color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
      }
    } else if (car.state === 'arrive') {
      car.y = Math.max(CAR.park, car.y - 320 * dt);
      if (car.y <= CAR.park) { car.state = 'buy'; car.t = 0; }
    } else if (car.state === 'buy') {
      car.t += dt;
      if (car.t >= 0.5) {
        car.t = 0;
        const k = car.got % 2 && showroom.table > 0 ? 'table' : showroom.chair > 0 ? 'chair' : showroom.table > 0 ? 'table' : null;
        if (k && car.got < car.want) {
          showroom[k]--; car.got++; car.owed += unitPrice(k);
          fly(k, showSpot(k), carSpot, 0.6, null, 60);
        } else {
          if (car.owed) {
            popText(CAR.x, car.y, 80, `+$${car.owed}`, '#c9f2c9');
            payBills(carSpot, 'showroom', car.owed);
          }
          car.state = 'leave';
        }
      }
    } else if (car.state === 'leave') {
      car.y += 320 * dt;
      if (car.y >= CAR.start) { car.state = 'away'; car.t = buyerEvery(); }
    }
  }

  // Freight trains: pull in, load a big mixed order from wherever it's stored, pay double.
  const TRAIN_SRC = {
    wood: [[() => wh, 'wood', whSpot], [() => pallet, 'wood', palletSpot]],
    redwood: [[() => wh, 'redwood', whSpot], [() => pallet, 'redwood', palletSpot]],
    plank: [[() => saw, 'out', sawOutSpot], [() => stock, 'plank', () => shelfSpot('plank')]],
    syrup: [[() => shack, 'out', shackOutSpot], [() => stock, 'syrup', () => shelfSpot('syrup')]],
    chair: [[() => workshop, 'chair', wsOutSpot], [() => showroom, 'chair', showSpot('chair')]],
    table: [[() => workshop, 'table', wsOutSpot], [() => showroom, 'table', showSpot('table')]],
  };
  function updateTrain(dt) {
    if (!level.rail) return;
    const park = STATION.x + 260;
    if (train.state === 'away') {
      train.t -= dt;
      if (train.t <= 0) {
        const size = 1 + (level.rail - 1) * 0.6 + level.store * 0.15;
        const want = [];
        if (level.truck || level.reserve) want.push(['redwood', 10]);
        if (level.sawmill) want.push(['plank', 24]);
        if (level.shack) want.push(['syrup', 10]);
        if (level.workshop) want.push(['chair', 5], ['table', 3]);
        if (!want.length) want.push(['wood', 40]);
        train.order = {}; train.got = {};
        for (const [k, n] of want) { train.order[k] = Math.max(1, Math.round(n * size * (0.7 + Math.random() * 0.6))); train.got[k] = 0; }
        train.state = 'arrive'; train.x = -900; train.idle = 0;
      }
    } else if (train.state === 'arrive') {
      train.x = Math.min(park, train.x + 420 * dt);
      if (train.x >= park) { train.state = 'load'; train.t = 0; }
    } else if (train.state === 'load') {
      train.t += dt; train.idle += dt;
      if (train.t >= 0.08) {
        train.t = 0;
        for (const k in train.order) {
          if (train.got[k] >= train.order[k]) continue;
          const src = TRAIN_SRC[k].find(([o, f]) => o()[f] > 0);
          if (!src) continue;
          src[0]()[src[1]]--; train.got[k]++; train.idle = 0;
          fly(k, src[2], trainSpot, 0.9, null, 140);
          break;
        }
        const done = Object.keys(train.order).every(k => train.got[k] >= train.order[k]);
        // a train won't wait forever: after 40s with nothing to load it leaves with what it has
        if (done || train.idle > 40) {
          const total = Math.round(Object.keys(train.got).reduce((a, k) => a + train.got[k] * unitPrice(k), 0) * 2);
          if (total) {
            popText(STATION.x, STATION.front, 150, done ? `Freight paid $${total}` : `Partial load $${total}`, '#c9f2c9');
            payBills(trainSpot, 'rail', total);
          }
          train.state = 'leave';
        }
      }
    } else if (train.state === 'leave') {
      train.x += 420 * dt;
      if (train.x > WORLD_W + 900) { train.state = 'away'; train.t = trainEvery(); }
    }
  }

  // Cash drone: flies to the fullest cash pile you're not standing at and brings the money to you.
  function updateDrone(dt) {
    if (!level.drone) return;
    const spd = [0, 520, 900][level.drone];
    if (drone.state === 'idle') {
      moveEntity(drone, player.x - 50, player.y - 20, spd, dt);
      const key = Object.keys(PILES)
        .filter(k => pileAmt[k] > 0 && Math.hypot(PILES[k].x - player.x, PILES[k].y - player.y) > 150)
        .sort((a, b) => pileAmt[b] - pileAmt[a])[0];
      if (key) { drone.target = key; drone.state = 'go'; }
    } else if (drone.state === 'go') {
      const p = PILES[drone.target];
      if (moveEntity(drone, p.x, p.y, spd, dt) < 4) { drone.state = 'grab'; drone.t = 0; }
    } else if (drone.state === 'grab') {
      drone.t += dt;
      if (drone.t >= 0.03) {
        drone.t = 0;
        const k = drone.target;
        if (pileAmt[k] <= 0) { drone.state = 'back'; return; }
        const take = Math.max(1, Math.ceil(pileAmt[k] / 30));
        pileAmt[k] -= take; drone.load += take;
        fly('cash', () => pileTop(k), droneSpot, 0.2, null, 10);
      }
    } else if (drone.state === 'back') {
      if (moveEntity(drone, player.x - 30, player.y - 10, spd, dt) < 30) {
        if (drone.load) {
          const amt = drone.load;
          popText(player.x, player.y, 70, `+$${amt}`, '#c9f2c9');
          for (let i = 0; i < Math.min(12, amt); i++) fly('cash', droneSpot, playerChest, 0.3 + i * 0.03, null, 20);
          setTimeout(() => { cash += amt; updateHud('cash'); }, 300);
        }
        drone.load = 0; drone.state = 'idle';
      }
    }
  }
  const DRONE_H = 110;
  const droneSpot = () => { const [x, y] = toScreen(drone.x, drone.y); return [x, y - DRONE_H]; };

  function updateRate(dt) {
    timers.rate -= dt;
    if (timers.rate > 0) return;
    timers.rate = 1;
    const now = performance.now();
    while (income.length && now - income[0][0] > 60000) income.shift();
    ui.rate.textContent = '$' + income.reduce((a, e) => a + e[1], 0) + '/min';
  }

  function updateHud(bump) {
    ui.logs.textContent = carried.wood + carried.oak + carried.redwood;
    ui.sap.textContent = carried.sap;
    ui.cash.textContent = '$' + cash;
    if (bump) {
      const chip = { logs: ui.chipLogs, sap: ui.chipSap, cash: ui.chipCash }[bump];
      chip.classList.add('pop');
      setTimeout(() => chip.classList.remove('pop'), 120);
    }
  }

  // ---------- Update ----------
  function update(dt) {
    const [ix, iy] = readInput();
    const k = 1 - Math.exp(-ACCEL * dt);
    player.vx += (ix * speed() - player.vx) * k;
    player.vy += (iy * speed() - player.vy) * k;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    collide();
    const bx = player.x, by = player.y;
    clampPlayer();
    if (bx !== player.x) player.vx = 0;
    if (by !== player.y) player.vy = 0;
    const sp = Math.hypot(player.vx, player.vy);
    if (Math.abs(player.vx) > 8) player.face = Math.sign(player.vx);
    player.walk = sp > 10 ? player.walk + dt * sp * 0.055 : player.walk * 0.85;

    const n = nearestNode();
    if (n !== gather.node) { gather.node = n; gather.t = 0; }
    if (n) {
      gather.t += dt;
      player.swing += dt;
      if (sp < 40) player.face = n.x >= player.x ? 1 : -1;
      if (gather.t >= nodeTime(n)) { gather.t = 0; harvest(n); if (!ready(n)) gather.node = null; }
    } else player.swing = 0;

    for (const node of nodes) {
      node.shake = Math.max(0, node.shake - dt * 4);
      if (node.farm && node.hp <= 0) {
        node.grow = Math.min(1, (node.grow || 0) + dt / (node.reserve ? reserveGrow() : growTime()));
        if (node.grow >= 1) node.hp = node.max;
      }
      if (node.type === 'maple' && node.sap < 1) node.sap = Math.min(1, node.sap + dt / sapTime());
    }
    updateStore(dt);
    updateSaw(dt);
    updateShack(dt);
    updateBots(dt);
    updateHaulers(dt);
    updateTruck(dt);
    updateWorkshop(dt);
    updateBuyer(dt);
    updateTrain(dt);
    updateDrone(dt);
    updateRate(dt);

    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt;
      if (f.type === 'chip') {
        f.x += f.vx * dt; f.y += f.vy * dt;
        f.vh -= 420 * dt; f.h = Math.max(0, f.h + f.vh * dt);
      }
      if (f.t >= f.life) {
        if (f.done) f.done();
        fx.splice(i, 1);
      }
    }

    const [tx, ty] = camTarget();
    const c = 1 - Math.exp(-CAM_EASE * dt);
    cam.x += (tx - cam.x) * c; cam.y += (ty - cam.y) * c;
  }

  // ---------- Draw: ground ----------
  function drawGround() {
    ctx.fillStyle = getVar('--edge');
    ctx.fillRect(0, 0, W, H);
    const [x0, y0] = toScreen(0, 0);
    const fw = WORLD_W, fh = WORLD_H * TILT;
    ctx.fillStyle = '#5a4630';
    roundRect(x0, y0 + 10, fw, fh, 18); ctx.fill();
    ctx.save();
    roundRect(x0, y0, fw, fh, 18); ctx.clip();
    ctx.fillStyle = getVar('--ground'); ctx.fillRect(x0, y0, fw, fh);
    ctx.fillStyle = getVar('--ground-dark');
    const th = TILE * TILT;
    const i0 = Math.max(0, Math.floor(cam.x / TILE)), i1 = Math.min(WORLD_W / TILE, Math.ceil((cam.x + W) / TILE));
    const j0 = Math.max(0, Math.floor(cam.y / th)), j1 = Math.min(WORLD_H / TILE, Math.ceil((cam.y + H) / th));
    for (let j = j0; j < j1; j++)
      for (let i = i0; i < i1; i++)
        if ((i + j) % 2 === 0) ctx.fillRect(x0 + i * TILE, y0 + j * th, TILE, th);
    ctx.restore();
  }

  function groundRect(x, y, w, d, r) {
    const [sx, sy] = toScreen(x - w / 2, y - d / 2);
    roundRect(sx, sy, w, d * TILT, r);
  }
  function dashedPlot(x, y, w, d, label) {
    ctx.setLineDash([10, 8]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,250,240,.75)';
    groundRect(x, y, w, d, 14); ctx.stroke(); ctx.setLineDash([]);
    const [lx, ly] = toScreen(x, y);
    flatLabel(label, lx, ly, 17, 'rgba(90,70,48,.85)');
  }
  function zone(z, label, active) {
    ctx.fillStyle = active ? 'rgba(255,250,240,.55)' : 'rgba(255,250,240,.3)';
    groundRect(z.x, z.y, z.w, z.d, 10); ctx.fill();
    ctx.setLineDash([8, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fffaf0';
    groundRect(z.x, z.y, z.w, z.d, 10); ctx.stroke(); ctx.setLineDash([]);
    const [zx, zy] = toScreen(z.x, z.y);
    flatLabel(label, zx, zy + 2, 15, '#5a4630');
  }

  function drawGroundMarks(time) {
    // dirt plaza for the town, and the customer road
    ctx.fillStyle = '#c9b48a';
    groundRect(CX + 40, CY + 380, 2200, 1440, 30); ctx.fill();
    groundRect((ANNEX.x0 + ANNEX.x1) / 2 + 40, CY + 60, ANNEX.x1 - ANNEX.x0 + 160, 840, 30); ctx.fill();
    groundRect(LEAVE_X, (CY + SPAWN_Y) / 2 + 80, 230, SPAWN_Y - CY + 160, 16); ctx.fill();
    ctx.fillStyle = '#bba57a';
    for (const lx of LANES) { groundRect(lx, (CY + SPAWN_Y) / 2 + 80, 26, SPAWN_Y - CY + 160, 8); ctx.fill(); }

    // roads out to the districts
    ctx.fillStyle = '#c9b48a';
    for (const r of ROADS) { groundRect((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, r.x1 - r.x0, r.y1 - r.y0, 10); ctx.fill(); }
    drawTracks();
    for (const id in DISTRICTS) drawDistrict(id);

    // tree yard and maple grove: tilled soil once built, a dashed plot before
    const yw = YARD.cols * YARD.gap + 60, yd = YARD.rows * 72 + 50;
    if (level.farm) {
      ctx.fillStyle = '#8c6a46';
      groundRect(YARD.x, YARD.y, yw, yd, 18); ctx.fill();
      ctx.fillStyle = '#7a5b3b';
      for (let r = 0; r < YARD.rows; r++) { groundRect(YARD.x, YARD.y + (r - (YARD.rows - 1) / 2) * 72, yw - 40, 30, 12); ctx.fill(); }
    } else dashedPlot(YARD.x, YARD.y, yw, yd, 'Tree Yard plot');
    const gw = GROVE.cols * GROVE.gap + 70, gd = GROVE.rows * 80 + 50;
    if (level.grove) {
      ctx.fillStyle = '#9a7a4e';
      groundRect(GROVE.x, GROVE.y, gw, gd, 18); ctx.fill();
    } else dashedPlot(GROVE.x, GROVE.y, gw, gd, 'Maple Grove plot');

    // warehouse floor
    const wcx = (WH.x0 + WH.x1) / 2, wcy = (WH.y0 + WH.y1) / 2, ww = WH.x1 - WH.x0, wd = WH.y1 - WH.y0;
    if (level.warehouse) {
      ctx.fillStyle = '#bdb7a8';
      groundRect(wcx, wcy, ww, wd, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(90,80,60,.18)'; ctx.lineWidth = 1;
      for (let gx = WH.x0 + 60; gx < WH.x1; gx += 60) {
        const [a, b] = toScreen(gx, WH.y0), [, c] = toScreen(gx, WH.y1);
        ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a, c); ctx.stroke();
      }
      ctx.fillStyle = '#e8c54a';
      groundRect(wcx, CY - 30, ww - 40, 6, 3); ctx.fill();
    } else dashedPlot(wcx, wcy, ww, wd, 'Warehouse plot');
    const acx = (ANNEX.x0 + ANNEX.x1) / 2, acy = (ANNEX.y0 + ANNEX.y1) / 2;
    if (level.annex) { ctx.fillStyle = '#c3c6c4'; groundRect(acx, acy, ANNEX.x1 - ANNEX.x0, ANNEX.y1 - ANNEX.y0, 4); ctx.fill(); }
    else if (level.warehouse) dashedPlot(acx, acy, ANNEX.x1 - ANNEX.x0, ANNEX.y1 - ANNEX.y0, 'Annex plot');

    // loading dock and the truck road to the west edge
    if (level.dock) {
      ctx.fillStyle = '#9e927a';
      groundRect(DOCK.x / 2, DOCK.y, DOCK.x + 140, 90, 10); ctx.fill();
      ctx.fillStyle = '#fffaf0';
      for (let x = 40; x < DOCK.x; x += 60) { groundRect(x, DOCK.y, 28, 4, 2); ctx.fill(); }
    } else dashedPlot(DOCK.x, DOCK.y, 220, 90, 'Loading dock');

    if (level.sawmill) zone(SAW_IN, 'SAWMILL', inRect(SAW_IN, SAW_IN.w, SAW_IN.d) && stack.some(k => k !== 'sap'));
    else dashedPlot(SAW.x, SAW.front - SAW.d / 2, SAW.w, SAW.d, 'Sawmill plot');
    if (level.shack) zone(SHACK_IN, 'SUGAR SHACK', inRect(SHACK_IN, SHACK_IN.w, SHACK_IN.d) && stack.includes('sap'));
    else dashedPlot(SHACK.x, SHACK.front - SHACK.d / 2, SHACK.w, SHACK.d, 'Sugar Shack plot');

    zone(DROP, 'RESTOCK', inRect(DROP, DROP.w, DROP.d) && stack.length);

    if (level.conveyor) {
      const [bx0, by] = toScreen(BELT.x0, BELT.y), [bx1] = toScreen(BELT.x1, BELT.y);
      ctx.fillStyle = '#4a4a46';
      ctx.fillRect(bx0, by - 9, bx1 - bx0, 14);
      ctx.fillStyle = '#6a6a64';
      const off = (time * BELT_SPEED[level.conveyor]) % 24;
      for (let x = bx0 + off; x < bx1; x += 24) ctx.fillRect(x, by - 9, 3, 14);
      ctx.fillStyle = '#2e2e2b';
      ctx.fillRect(bx0, by + 5, bx1 - bx0, 4);
      for (const it of belt) drawItem(it.kind, bx0 + it.d, by - 6);
    }

    for (const key of ['store', 'dock']) {
      if (key === 'dock' && !level.dock) continue;
      const p = PILES[key], [px, py] = toScreen(p.x, p.y);
      ctx.fillStyle = 'rgba(63,157,79,.28)';
      ctx.beginPath(); ctx.ellipse(px, py, p.r, p.r * TILT, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (const id of ['lumber', 'truck']) {
      if (!level[id]) continue;
      ctx.fillStyle = 'rgba(232,184,58,.35)';
      groundRect(BOT_HOME[id].x, BOT_HOME[id].y, id === 'truck' ? 90 : 56, 56, 8); ctx.fill();
    }

    for (const u of UPGRADES) drawUpgradeTile(u, time);
  }

  function drawDistrict(id) {
    const d = DISTRICTS[id], cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2, w = d.x1 - d.x0, dd = d.y1 - d.y0;
    const [lx, ly] = toScreen(cx, cy), [ax, ay] = toScreen(d.x0, d.y0), [bx, by] = toScreen(d.x1, d.y1);
    if (bx < -50 || ax > W + 50 || by < -50 || ay > H + 50) return;
    if (level[id]) {
      ctx.fillStyle = d.ground;
      groundRect(cx, cy, w, dd, 24); ctx.fill();
      if (id === 'east') {
        if (!level.workshop) dashedPlot(WORKSHOP.x, WORKSHOP.front - WORKSHOP.d / 2, WORKSHOP.w, WORKSHOP.d, 'Workshop plot');
        if (!level.showroom) dashedPlot(SHOWROOM.x, SHOWROOM.front - SHOWROOM.d / 2, SHOWROOM.w, SHOWROOM.d, 'Showroom plot');
      }
      return;
    }
    // not yours yet: shaded, fenced, with the price at the gate
    ctx.fillStyle = 'rgba(36,48,28,.42)';
    groundRect(cx, cy, w, dd, 24); ctx.fill();
    ctx.strokeStyle = '#8a6a43'; ctx.lineWidth = 3;
    ctx.strokeRect(ax, ay - 10, bx - ax, by - ay);
    ctx.fillStyle = '#6b4c2e';
    for (let x = d.x0; x <= d.x1; x += 60) {
      for (const y of [d.y0, d.y1]) { const [px, py] = toScreen(x, y); ctx.fillRect(px - 2, py - 16, 5, 16); }
    }
    for (let y = d.y0; y <= d.y1; y += 60) {
      for (const x of [d.x0, d.x1]) { const [px, py] = toScreen(x, y); ctx.fillRect(px - 2, py - 16, 5, 16); }
    }
    tag(d.name, lx, ly - 14, 26, '#fffaf0', 'rgba(43,42,34,.82)');
    flatLabel('For sale · buy the deed at the gate', lx, ly + 24, 17, '#fffaf0');
  }

  function drawTracks() {
    const [, ty] = toScreen(0, TRACK_Y);
    if (ty < -40 || ty > H + 40) return;
    ctx.fillStyle = '#8a7a64';
    ctx.fillRect(0, ty - 12, W, 24);
    ctx.fillStyle = '#6b4c2e';
    const off = ((-cam.x % 34) + 34) % 34;
    for (let x = off - 34; x < W; x += 34) ctx.fillRect(x, ty - 11, 10, 22);
    ctx.fillStyle = '#c4c9d1';
    ctx.fillRect(0, ty - 8, W, 3); ctx.fillRect(0, ty + 5, W, 3);
  }

  function flatLabel(text, x, y, size, color, weight = 600) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(text, x, y);
    ctx.textBaseline = 'alphabetic';
  }
  function tag(text, x, y, size, color, bg = 'rgba(43,42,34,.78)') {
    ctx.font = `600 ${size}px ${FONT}`;
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = bg;
    roundRect(x - w / 2, y - size / 2 - 4, w, size + 8, (size + 8) / 2); ctx.fill();
    flatLabel(text, x, y, size, color);
  }

  function drawUpgradeTile(u, time) {
    const [sx, sy] = toScreen(u.x, u.y);
    if (sx < -140 || sx > W + 140 || sy < -110 || sy > H + 80) return;
    const lv = level[u.id], max = lv >= u.costs.length, blocked = u.needs && !level[u.needs];
    const on = inRect(u, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = max ? '#6f8d5a' : '#5d5d55';
    groundRect(u.x, u.y + 6, TILE_SIZE, TILE_SIZE, 12); ctx.fill();
    ctx.fillStyle = max ? '#9cc27f' : blocked ? '#6c6c64' : on ? '#8f8f84' : '#7c7c72';
    groundRect(u.x, u.y, TILE_SIZE, TILE_SIZE, 12); ctx.fill();
    if (!max && !blocked) {
      const p = paid[u.id] / u.costs[lv];
      if (p > 0) {
        ctx.save();
        groundRect(u.x, u.y, TILE_SIZE, TILE_SIZE, 12); ctx.clip();
        ctx.fillStyle = '#5fbf6c';
        const top = sy + TILE_SIZE * TILT / 2 - TILE_SIZE * TILT * p;
        ctx.fillRect(sx - TILE_SIZE / 2, top, TILE_SIZE, TILE_SIZE * TILT * p);
        ctx.restore();
      }
      ctx.lineWidth = 2; ctx.strokeStyle = on ? '#fff3a6' : 'rgba(255,250,240,.6)';
      groundRect(u.x, u.y, TILE_SIZE, TILE_SIZE, 12); ctx.stroke();
    }
    flatLabel(max ? 'MAX' : blocked ? 'Locked' : `$${u.costs[lv] - paid[u.id]}`, sx, sy + 1, blocked ? 17 : 20, '#fffaf0');
    const bob = Math.sin(time * 2 + u.x) * 2;
    tag(upgradeTitle(u, lv), sx, sy - 64 + bob, 16, '#fffaf0');
    const note = max ? 'Fully upgraded'
      : blocked ? `Needs ${NAMES[u.needs]}`
      : on && tileState.lock === u.id ? 'Step off, then back on to buy' : upgradeNote(u, lv);
    flatLabel(note, sx, sy - 38 + bob, 15, '#2b2a22', 600);
  }

  function drawDecor(d) {
    const [sx, sy] = toScreen(d.x, d.y);
    if (d.kind === 'tuft') {
      ctx.strokeStyle = '#5e8f3e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - 4, sy); ctx.lineTo(sx - 6, sy - 7);
      ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 9);
      ctx.moveTo(sx + 4, sy); ctx.lineTo(sx + 6, sy - 7);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#5e8f3e'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 8); ctx.stroke();
      ctx.fillStyle = d.hue < 0.5 ? '#fff4c7' : '#f4a3b5';
      ctx.beginPath(); ctx.arc(sx, sy - 9, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- Draw: store ----------
  // the counter is split four ways: pine, oak, planks, syrup
  const SHELF_BASE = { wood: -152, oak: -76, plank: 0, syrup: 76 };
  function shelfOffset(kind, i) {
    const row = Math.floor(i / 5), col = i % 5;
    return [SHELF_BASE[kind] + 12 + col * 12 + (row % 2) * 4, -40 - row * 6.5];
  }

  function drawStore() {
    const [sx, sy] = toScreen(STORE.x, STORE.front);
    const hw = STORE.w / 2, back = STORE.d * TILT;
    ctx.fillStyle = 'rgba(30,40,20,.22)';
    roundRect(sx - hw - 6, sy - back + 4, STORE.w + 22, back + 10, 10); ctx.fill();
    ctx.fillStyle = '#a77b4f';
    ctx.fillRect(sx - hw, sy - back, STORE.w, back);
    ctx.fillStyle = '#e9d8b4';
    ctx.fillRect(sx - hw, sy - back - 74, STORE.w, 74);
    ctx.fillStyle = '#d8c39a';
    for (let x = sx - hw + 20; x < sx + hw; x += 20) ctx.fillRect(x, sy - back - 74, 2, 74);
    ctx.fillStyle = '#8a6a43';
    ctx.fillRect(sx - hw + 12, sy - back - 40, STORE.w - 24, 5);
    ctx.fillRect(sx - hw + 12, sy - back - 16, STORE.w - 24, 5);
    ctx.fillStyle = '#7a4f2c';
    ctx.fillRect(sx - hw, sy - back - 86, 8, back + 86);
    ctx.fillRect(sx + hw - 8, sy - back - 86, 8, back + 86);
    if (level.cashier) {
      const busy = lane => customers.some(c => c.lane === lane && (c.state === 'buy' || c.state === 'checkout'));
      const spots = level.lane2 ? [60, 130] : [90];
      spots.forEach((ox, lane) => drawPerson(sx + ox, sy - 14, {
        walk: busy(lane) ? performance.now() / 90 : 0, face: 1, shirt: '#2f9d8f', skin: lane ? '#c68e62' : '#8d5a3b',
        hair: '#16120f', pants: '#2f9d8f' }));
    }
    ctx.fillStyle = '#8a5a2e';
    ctx.fillRect(sx - hw, sy - 30, STORE.w, 30);
    ctx.fillStyle = '#6e4522';
    for (let x = sx - hw + 30; x < sx + hw; x += 30) ctx.fillRect(x, sy - 30, 2, 30);
    ctx.fillStyle = '#c49565';
    ctx.fillRect(sx - hw - 4, sy - 36, STORE.w + 8, 8);
    const groups = SHOP.filter(k => k === 'wood' || k === 'oak' || (k === 'plank' && level.sawmill) || (k === 'syrup' && level.shack));
    const center = kind => sx + SHELF_BASE[kind] + 38;
    for (const kind of groups) {
      flatLabel(`${ITEM_NAME[kind]} $${unitPrice(kind)}`, center(kind), sy - 15, 13, '#fffaf0');
      for (let i = 0; i < Math.min(stock[kind], SHELF_SHOW); i++) { const [ox, oy] = shelfOffset(kind, i); drawItem(kind, sx + ox, sy + oy); }
    }
    const look = STORE_LOOK[level.store];
    const top = sy - back - 104, h = 26, aw = STORE.w + 20, seg = aw / 12;
    for (let f = 0; f < Math.min(level.store, 3); f++) {
      const y0 = top - 4 - (f + 1) * 46;
      ctx.fillStyle = f ? '#d8c39a' : '#e9d8b4';
      ctx.fillRect(sx - hw + 6, y0, STORE.w - 12, 50);
      ctx.fillStyle = '#9ec9de';
      for (let wx = sx - hw + 26; wx < sx + hw - 30; wx += 48) { roundRect(wx, y0 + 12, 26, 22, 3); ctx.fill(); }
    }
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#fffaf0' : look.awning;
      const x = sx - hw - 10 + i * seg;
      ctx.beginPath();
      ctx.moveTo(x, top); ctx.lineTo(x + seg, top); ctx.lineTo(x + seg, top + h);
      ctx.arc(x + seg / 2, top + h, seg / 2, 0, Math.PI);
      ctx.closePath(); ctx.fill();
    }
    const signY = top - 30 - Math.min(level.store, 3) * 46;
    ctx.font = `600 16px ${FONT}`;
    const sw = ctx.measureText(look.name).width + 30;
    ctx.fillStyle = level.store >= 3 ? '#2b2a22' : '#5a4630';
    roundRect(sx - sw / 2, signY - 2, sw, 30, 8); ctx.fill();
    flatLabel(look.name, sx, signY + 13, 16, level.store >= 3 ? '#ffd75a' : '#ffe2b0');
    for (const kind of groups) {
      const full = stock[kind] >= shelfCap();
      tag(`${stock[kind]}/${shelfCap()}`, center(kind), sy - 102, 13, '#fffaf0', full ? 'rgba(217,100,74,.9)' : 'rgba(43,42,34,.7)');
    }
  }

  // ---------- Draw: warehouse (cutaway: low side walls, no roof) ----------
  function drawWhBack(B = WH) {
    if (B === ANNEX) return drawAnnexBack();
    const [sx0, sy0] = toScreen(WH.x0, WH.y0);
    const ww = WH.x1 - WH.x0, wallH = 84 + Math.min(level.warehouse, 4) * 8;
    ctx.fillStyle = '#d9d2c2';
    ctx.fillRect(sx0, sy0 - wallH, ww, wallH);
    ctx.fillStyle = '#c9c1ae';
    for (let x = sx0 + 24; x < sx0 + ww; x += 24) ctx.fillRect(x, sy0 - wallH, 2, wallH);
    ctx.fillStyle = '#8a3b2e';
    ctx.fillRect(sx0 - 6, sy0 - wallH - 10, ww + 12, 12);
    const mid = sx0 + ww / 2;
    ctx.fillStyle = '#5a4630';
    roundRect(mid - 90, sy0 - wallH + 8, 180, 28, 8); ctx.fill();
    flatLabel(`WAREHOUSE  ${sum(wh)}/${whCap()}`, mid, sy0 - wallH + 22, 15, '#ffe2b0');
    LOGS.forEach((k, i) => {
      const x = mid - 80 + i * 66;
      drawItem(k, x, sy0 - wallH + 54);
      flatLabel(`${wh[k]}`, x + 26, sy0 - wallH + 54, 15, '#5a4630');
    });
  }
  function drawAnnexBack() {
    const [sx0, sy0] = toScreen(ANNEX.x0, ANNEX.y0);
    const ww = ANNEX.x1 - ANNEX.x0, wallH = 92 + level.annex * 8;
    ctx.fillStyle = '#cfd6dc';
    ctx.fillRect(sx0, sy0 - wallH, ww, wallH);
    ctx.fillStyle = '#bcc4cb';
    for (let x = sx0 + 24; x < sx0 + ww; x += 24) ctx.fillRect(x, sy0 - wallH, 2, wallH);
    ctx.fillStyle = '#3d6fa8';
    ctx.fillRect(sx0 - 6, sy0 - wallH - 10, ww + 12, 12);
    const mid = sx0 + ww / 2;
    ctx.fillStyle = '#2b3a4a';
    roundRect(mid - 70, sy0 - wallH + 8, 140, 28, 8); ctx.fill();
    flatLabel('ANNEX', mid, sy0 - wallH + 22, 15, '#cfe6ff');
    flatLabel(`Total storage ${sum(wh)}/${whCap()}`, mid, sy0 - wallH + 52, 14, '#2b3a4a');
  }
  function drawWhSide(x, yBack, yFront) {
    const [sx, sb] = toScreen(x, yBack), [, sf] = toScreen(x, yFront);
    const hgt = 34;
    ctx.fillStyle = '#c4bba6';
    ctx.fillRect(sx - 7, sb - hgt, 14, sf - sb + hgt);
    ctx.fillStyle = '#e0d9c8';
    ctx.fillRect(sx - 7, sb - hgt, 14, sf - sb);
    ctx.fillStyle = '#8a3b2e';
    ctx.fillRect(sx - 8, sf - hgt - 2, 16, hgt + 2);
  }
  // front rack: pine; middle: oak; back: redwood
  const RACK_KIND = ['redwood', 'oak', 'wood'];
  const ANNEX_DX = ANNEX.x0 - WH.x0;
  function drawRack(i, annex) {
    const [sx, sy] = toScreen(RACK.x - RACK.w / 2 + (annex ? ANNEX_DX : 0), RACKS[i]);
    const w = RACK.w, hgt = 58, per = 20;
    ctx.fillStyle = 'rgba(30,40,20,.18)';
    ctx.fillRect(sx, sy - 4, w, 8);
    ctx.fillStyle = annex ? '#5f6b7a' : '#3d6fa8';
    for (const x of [0, w / 2, w]) ctx.fillRect(sx + x - 3, sy - hgt, 6, hgt);
    // the annex racks show what doesn't fit on the main racks
    const kind = RACK_KIND[i], n = annex ? Math.min(Math.max(0, wh[kind] - per * 3), per * 3) : Math.min(wh[kind], per * 3);
    for (let s = 0; s < 3; s++) {
      const shelfY = sy - 6 - s * 19;
      ctx.fillStyle = '#e8873a';
      ctx.fillRect(sx, shelfY, w, 4);
      for (let k = 0; k < per && s * per + k < n; k++) drawItem(kind, sx + 12 + k * 12.5, shelfY - 4);
    }
  }
  const rackSpot = kind => () => {
    const [sx, sy] = toScreen(RACK.x, RACKS[RACK_KIND.indexOf(kind)]);
    return [sx, sy - 30];
  };

  function drawPallet(pi) {
    const spot = PALLETS[pi], [px, py] = toScreen(spot.x, spot.y);
    const count = palletCount(), each = palletCap() / count;
    ctx.fillStyle = 'rgba(30,40,20,.2)';
    ctx.fillRect(px - 30, py - 6, 64, 12);
    ctx.fillStyle = '#b38a55';
    ctx.fillRect(px - 30, py - 8, 60, 8);
    ctx.fillStyle = '#8a6a43';
    for (const x of [-28, -3, 22]) ctx.fillRect(px + x, py - 8, 6, 8);
    // stock is shared out across the pallets in order; each draws up to 40 pieces
    const items = [];
    for (const kind of LOGS) for (let i = 0; i < pallet[kind]; i++) items.push(kind);
    const mine = items.slice(pi * each, (pi + 1) * each);
    for (let n = 0; n < Math.min(mine.length, 40); n++) {
      const row = Math.floor(n / 4), col = n % 4;
      drawItem(mine[n], px - 19 + col * 13 + (row % 2) * 3, py - 12 - row * 5.5);
    }
    if (pi === 0 && items.length) tag(`${items.length}/${palletCap()}`, px, py - 30 - Math.min(Math.ceil(mine.length / 4), 10) * 5.5, 13, '#fffaf0');
  }

  // ---------- Draw: sawmill and sugar shack ----------
  function shed(x, front, w, d, wallColor, roofColor) {
    const [sx, sy] = toScreen(x, front);
    const hw = w / 2, back = d * TILT;
    ctx.fillStyle = 'rgba(30,40,20,.22)';
    roundRect(sx - hw - 4, sy - back + 4, w + 16, back + 8, 8); ctx.fill();
    ctx.fillStyle = '#9b7a52';
    ctx.fillRect(sx - hw, sy - back, w, back);
    ctx.fillStyle = wallColor;
    ctx.fillRect(sx - hw, sy - back - 60, w, 60);
    ctx.fillStyle = '#5e3b20';
    ctx.fillRect(sx - hw, sy - back - 70, 7, back + 70);
    ctx.fillRect(sx + hw - 7, sy - back - 70, 7, back + 70);
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(sx - hw - 12, sy - back - 64); ctx.lineTo(sx, sy - back - 100); ctx.lineTo(sx + hw + 12, sy - back - 64);
    ctx.closePath(); ctx.fill();
    return [sx, sy, back];
  }

  function drawSawmill() {
    const [sx, sy, back] = shed(SAW.x, SAW.front, SAW.w, SAW.d, '#7a5a36', '#6b6f78');
    ctx.fillStyle = '#b5935f';
    ctx.fillRect(sx - 50, sy - 26, 100, 10);
    ctx.fillStyle = '#8a6a43';
    ctx.fillRect(sx - 46, sy - 16, 8, 16); ctx.fillRect(sx + 38, sy - 16, 8, 16);
    const spin = sawIn() > 0 ? performance.now() / 30 : 0;
    ctx.save(); ctx.translate(sx, sy - 34); ctx.rotate(spin);
    ctx.fillStyle = '#d4d8de';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); ctx.lineTo(Math.cos(a + 0.26) * 11, Math.sin(a + 0.26) * 11); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5f646c'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    let n = 0;
    for (const k of LOGS) for (let i = 0; i < saw.q[k] && n < 15; i++, n++) drawItem(k, sx - 62 + (n % 3) * 4, sy - 6 - Math.floor(n / 3) * 6);
    for (let i = 0; i < Math.min(saw.out, 20); i++) drawPlank(sx + 66, sy - 6 - i * 4);
    if (level.kiln) {
      // brick kiln chimney with heat shimmer
      ctx.fillStyle = '#9b4434';
      ctx.fillRect(sx + 40, sy - back - 120, 26, 60);
      ctx.fillStyle = '#7a3428';
      ctx.fillRect(sx + 36, sy - back - 126, 34, 8);
      const t = performance.now() / 700;
      for (let i = 0; i < 2; i++) {
        const p = (t + i / 2) % 1;
        ctx.fillStyle = `rgba(120,110,100,${0.4 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(sx + 53 + Math.sin(p * 5) * 5, sy - back - 132 - p * 40, 7 + p * 8, 0, Math.PI * 2); ctx.fill();
      }
    }
    tag(level.kiln ? 'SAWMILL + KILN' : 'SAWMILL', sx, sy - back - 114, 15, '#ffe2b0', '#5a4630');
    tag(`${sawIn()} logs → ${saw.out} planks`, sx, sy - back - 86, 13, '#fffaf0');
  }

  function drawShack() {
    const [sx, sy, back] = shed(SHACK.x, SHACK.front, SHACK.w, SHACK.d, '#8a4a32', '#4f6b3a');
    // copper boiler with steam while it works
    ctx.fillStyle = '#b87333';
    roundRect(sx - 26, sy - 44, 52, 34, 8); ctx.fill();
    ctx.fillStyle = '#d99a5b';
    ctx.fillRect(sx - 26, sy - 40, 52, 5);
    ctx.fillStyle = '#5a3a28';
    ctx.fillRect(sx - 30, sy - 10, 60, 10);
    ctx.fillStyle = '#e8873a';
    ctx.fillRect(sx - 18, sy - 8, 36, 5);
    if (shack.sap >= 2) {
      const t = performance.now() / 600;
      for (let i = 0; i < 3; i++) {
        const p = (t + i / 3) % 1;
        ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(sx - 8 + i * 8 + Math.sin(p * 6 + i) * 4, sy - 50 - p * 50, 6 + p * 8, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (let i = 0; i < Math.min(shack.sap, 12); i++) drawSap(sx - 54 + (i % 3) * 9, sy - 6 - Math.floor(i / 3) * 9);
    for (let i = 0; i < Math.min(shack.out, 12); i++) drawSyrup(sx + 48 + (i % 3) * 8, sy - 6 - Math.floor(i / 3) * 12);
    tag('SUGAR SHACK', sx, sy - back - 114, 15, '#ffe2b0', '#5a4630');
    tag(`${shack.sap} sap → ${shack.out} syrup`, sx, sy - back - 86, 13, '#fffaf0');
  }

  function drawWorkshop() {
    const [sx, sy, back] = shed(WORKSHOP.x, WORKSHOP.front, WORKSHOP.w, WORKSHOP.d, '#6b4f3a', '#a5483a');
    // workbench with a hammer that taps while building
    ctx.fillStyle = '#b5935f';
    ctx.fillRect(sx - 44, sy - 26, 88, 10);
    ctx.fillStyle = '#8a6a43';
    ctx.fillRect(sx - 40, sy - 16, 7, 16); ctx.fillRect(sx + 33, sy - 16, 7, 16);
    const tap = workshop.t > 0 ? Math.abs(Math.sin(performance.now() / 90)) * 10 : 0;
    ctx.save(); ctx.translate(sx + 6, sy - 30 - tap); ctx.rotate(-0.4);
    ctx.fillStyle = '#8a5a2e'; ctx.fillRect(-2, -14, 4, 16);
    ctx.fillStyle = '#5f646c'; ctx.fillRect(-7, -18, 14, 6);
    ctx.restore();
    for (let i = 0; i < Math.min(workshop.planks, 20); i++) drawPlank(sx - 82, sy - 6 - i * 4);
    let n = 0;
    for (const k of ['chair', 'table']) for (let i = 0; i < workshop[k] && n < 12; i++, n++) drawItem(k, sx + 70 + (n % 2) * 18, sy - 8 - Math.floor(n / 2) * 12);
    tag('WORKSHOP', sx, sy - back - 114, 15, '#ffe2b0', '#5a4630');
    tag(`${workshop.planks} planks → ${workshop.chair} chairs · ${workshop.table} tables`, sx, sy - back - 86, 13, '#fffaf0');
  }

  function drawShowroom() {
    const [sx, sy] = toScreen(SHOWROOM.x, SHOWROOM.front);
    const hw = SHOWROOM.w / 2, back = SHOWROOM.d * TILT, wallH = 96;
    ctx.fillStyle = 'rgba(30,40,20,.22)';
    roundRect(sx - hw - 4, sy - back + 4, SHOWROOM.w + 16, back + 8, 8); ctx.fill();
    // roof seen from above, cream walls, big glass front
    ctx.fillStyle = '#3c3a4a';
    ctx.fillRect(sx - hw - 6, sy - wallH - back, SHOWROOM.w + 12, back + 4);
    ctx.fillStyle = '#f2ece0';
    ctx.fillRect(sx - hw, sy - wallH, SHOWROOM.w, wallH);
    ctx.fillStyle = 'rgba(160,205,225,.8)';
    ctx.fillRect(sx - hw + 10, sy - wallH + 26, SHOWROOM.w - 20, wallH - 30);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(sx - hw, sy - wallH, SHOWROOM.w, 18);
    flatLabel('SHOWROOM', sx, sy - wallH + 9, 14, '#2b2a22');
    // furniture on display behind the glass
    let n = 0;
    for (const k of ['chair', 'table']) for (let i = 0; i < showroom[k] && n < 14; i++, n++) drawItem(k, sx - hw + 26 + (n % 7) * 22, sy - 22 - Math.floor(n / 7) * 22);
    ctx.fillStyle = '#d9d2c2';
    ctx.fillRect(sx - hw, sy - 6, SHOWROOM.w, 6);
    tag(`${showroom.chair} chairs · ${showroom.table} tables`, sx, sy - wallH - back - 22, 13, '#fffaf0');
  }

  function drawBuyerCar() {
    if (!level.showroom || car.state === 'away') return;
    const [sx, sy] = toScreen(CAR.x, car.y);
    ctx.fillStyle = 'rgba(30,40,20,.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 34, 16, 0, 0, Math.PI * 2); ctx.fill();
    // seen from the side but driving north/south, so a short, tall car
    ctx.fillStyle = '#2b2a22';
    ctx.beginPath(); ctx.arc(sx - 18, sy - 6, 7, 0, Math.PI * 2); ctx.arc(sx + 18, sy - 6, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = car.color;
    roundRect(sx - 30, sy - 26, 60, 20, 6); ctx.fill();
    roundRect(sx - 18, sy - 40, 36, 16, 6); ctx.fill();
    ctx.fillStyle = '#bfe3f0';
    roundRect(sx - 14, sy - 37, 28, 10, 3); ctx.fill();
    if (car.state === 'buy') {
      ctx.fillStyle = '#fffaf0';
      roundRect(sx - 34, sy - 82, 68, 28, 10); ctx.fill();
      drawChair(sx - 14, sy - 66);
      flatLabel(`${car.got}/${car.want}`, sx + 12, sy - 68, 15, '#2b2a22');
    }
  }

  function drawStation() {
    const [sx, sy] = toScreen(STATION.x, STATION.front);
    const hw = STATION.w / 2, back = STATION.d * TILT, wallH = 80;
    ctx.fillStyle = 'rgba(30,40,20,.22)';
    roundRect(sx - hw - 4, sy - back + 4, STATION.w + 16, back + 8, 8); ctx.fill();
    ctx.fillStyle = '#7a3428';
    ctx.fillRect(sx - hw - 8, sy - wallH - back, STATION.w + 16, back + 6);
    ctx.fillStyle = '#c4703f';
    ctx.fillRect(sx - hw, sy - wallH, STATION.w, wallH);
    ctx.fillStyle = '#9ec9de';
    for (let x = sx - hw + 20; x < sx + hw - 30; x += 46) { roundRect(x, sy - wallH + 22, 26, 34, 4); ctx.fill(); }
    // clock
    ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(sx, sy - wallH - back - 10, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2b2a22'; ctx.lineWidth = 2;
    const a = performance.now() / 4000;
    ctx.beginPath(); ctx.moveTo(sx, sy - wallH - back - 10); ctx.lineTo(sx + Math.cos(a) * 9, sy - wallH - back - 10 + Math.sin(a) * 9); ctx.stroke();
    tag('RAIL YARD', sx, sy - wallH - back - 40, 15, '#ffe2b0', '#5a4630');
    const next = train.state === 'away' ? `Next train in ${Math.ceil(train.t)}s` : train.state === 'load' ? 'Loading freight' : 'Train arriving';
    tag(next, sx, sy - 12, 13, '#fffaf0');
  }

  function drawTrain() {
    if (!level.rail || train.state === 'away') return;
    const [sx, sy] = toScreen(train.x, TRACK_Y);
    if (sx < -900 || sx > W + 200) return;
    // locomotive in front (to the right), then four freight cars
    ctx.fillStyle = 'rgba(30,40,20,.25)';
    ctx.fillRect(sx - 700, sy - 4, 760, 10);
    const cars = 4, carW = 130;
    const total = train.order ? Object.values(train.order).reduce((a, b) => a + b, 0) : 1;
    const got = train.got ? Object.values(train.got).reduce((a, b) => a + b, 0) : 0;
    for (let i = 0; i < cars; i++) {
      const x = sx - 150 - (i + 1) * (carW + 8);
      ctx.fillStyle = '#2b2a22';
      for (const wx of [x + 20, x + carW - 20]) { ctx.beginPath(); ctx.arc(wx, sy - 4, 8, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = ['#7a3428', '#3d6fa8', '#4f7a36', '#8a6a43'][i];
      ctx.fillRect(x, sy - 46, carW, 40);
      // cargo heaped on top as the order fills
      const fill = Math.max(0, Math.min(1, got / total * cars - (cars - 1 - i)));
      ctx.fillStyle = '#c99b5f';
      if (fill > 0) ctx.fillRect(x + 6, sy - 46 - 14 * fill, carW - 12, 14 * fill);
    }
    ctx.fillStyle = '#2b2a22';
    for (const wx of [sx - 120, sx - 80, sx - 30]) { ctx.beginPath(); ctx.arc(wx, sy - 4, 10, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#d9644a';
    roundRect(sx - 150, sy - 60, 150, 54, 6); ctx.fill();
    ctx.fillStyle = '#2b2a22';
    ctx.fillRect(sx - 150, sy - 86, 50, 30);
    ctx.fillStyle = '#bfe3f0';
    ctx.fillRect(sx - 142, sy - 80, 34, 16);
    ctx.fillStyle = '#3c3c38';
    ctx.fillRect(sx - 40, sy - 84, 16, 26);
    if (train.state === 'load') {
      const keys = Object.keys(train.order);
      const h = 26 + keys.length * 22;
      const cx = sx - 75, cy = sy - 100 - h;
      ctx.fillStyle = '#fffaf0';
      roundRect(cx - 90, cy, 180, h, 12); ctx.fill();
      flatLabel('FREIGHT ORDER · pays 2×', cx, cy + 14, 13, '#5a4630');
      keys.forEach((k, i) => {
        drawItem(k, cx - 50, cy + 36 + i * 22);
        flatLabel(`${train.got[k]}/${train.order[k]}`, cx + 20, cy + 36 + i * 22, 15, train.got[k] >= train.order[k] ? '#3f9d4f' : '#2b2a22');
      });
    }
  }

  function drawHQ() {
    const [sx, sy] = toScreen(HQ.x, HQ.front);
    const hw = HQ.w / 2, back = HQ.d * TILT, floors = 2 + level.hq, fh = 34, wallH = floors * fh;
    ctx.fillStyle = 'rgba(30,40,20,.25)';
    roundRect(sx - hw - 4, sy - back + 4, HQ.w + 16, back + 8, 8); ctx.fill();
    ctx.fillStyle = '#3c4654';
    ctx.fillRect(sx - hw - 4, sy - wallH - back, HQ.w + 8, back + 4);
    ctx.fillStyle = '#e9e4da';
    ctx.fillRect(sx - hw, sy - wallH, HQ.w, wallH);
    ctx.fillStyle = '#7fb4cf';
    for (let f = 0; f < floors; f++) {
      for (let x = sx - hw + 14; x < sx + hw - 20; x += 30) ctx.fillRect(x, sy - wallH + f * fh + 8, 20, fh - 14);
    }
    ctx.fillStyle = '#2b2a22';
    ctx.fillRect(sx - 16, sy - 30, 32, 30);
    // flag on the roof
    ctx.fillStyle = '#5f646c'; ctx.fillRect(sx + hw - 30, sy - wallH - back - 50, 3, 50);
    ctx.fillStyle = '#d9644a';
    const wave = Math.sin(performance.now() / 300) * 3;
    ctx.beginPath(); ctx.moveTo(sx + hw - 27, sy - wallH - back - 50); ctx.lineTo(sx + hw + 3, sy - wallH - back - 44 + wave); ctx.lineTo(sx + hw - 27, sy - wallH - back - 36); ctx.fill();
    tag(`HOMESTEAD HQ · +${Math.round((incomeMul() - 1) * 100)}% on all sales`, sx, sy - wallH - back - 20, 16, '#ffd75a', '#2b2a22');
  }

  function drawBillboard() {
    const [sx, sy] = toScreen(BILLBOARD.x, BILLBOARD.y);
    ctx.fillStyle = '#5e3b20';
    ctx.fillRect(sx - 60, sy - 70, 8, 70); ctx.fillRect(sx + 52, sy - 70, 8, 70);
    ctx.fillStyle = '#fffaf0';
    roundRect(sx - 90, sy - 140, 180, 76, 8); ctx.fill();
    ctx.fillStyle = STORE_LOOK[level.store].awning;
    ctx.fillRect(sx - 90, sy - 140, 180, 16);
    flatLabel('HOMESTEAD', sx, sy - 106, 22, '#2b2a22');
    flatLabel(['', 'Fresh lumber!', 'Syrup & planks!', 'Everything wood!'][level.ads], sx, sy - 80, 14, '#5a4630');
  }

  function drawDrone() {
    if (!level.drone) return;
    const [sx, sy0] = toScreen(drone.x, drone.y);
    const sy = sy0 - DRONE_H + Math.sin(performance.now() / 250) * 4;
    ctx.fillStyle = 'rgba(30,40,20,.2)';
    ctx.beginPath(); ctx.ellipse(sx, sy0, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3c3c38';
    ctx.fillRect(sx - 22, sy - 3, 44, 4);
    const spin = Math.abs(Math.sin(performance.now() / 30)) * 12 + 2;
    ctx.fillStyle = 'rgba(200,205,214,.8)';
    for (const x of [-22, 22]) ctx.fillRect(sx + x - spin, sy - 6, spin * 2, 2);
    ctx.fillStyle = '#e8b83a';
    roundRect(sx - 12, sy - 8, 24, 14, 5); ctx.fill();
    if (drone.load) {
      ctx.fillStyle = '#3f9d4f';
      roundRect(sx - 8, sy + 6, 16, 12, 3); ctx.fill();
      flatLabel('$', sx, sy + 12, 10, '#fffaf0');
    }
  }

  function drawCashPile(key) {
    const p = PILES[key], [cx, cy] = toScreen(p.x, p.y), amt = pileAmt[key];
    const bills = Math.min(Math.ceil(amt / 5), 72);
    const spots = [[-16, -6], [0, -6], [16, -6], [-16, 6], [0, 6], [16, 6]];
    const per = Math.ceil(bills / 6);
    for (let s = 0; s < 6; s++) {
      const n = Math.max(0, Math.min(per, bills - s * per));
      const [ox, oy] = spots[s];
      for (let i = 0; i < n; i++) drawBill(cx + ox, cy + oy * TILT - i * 2.4);
    }
    if (amt > 0) tag(`$${amt}`, cx, cy - 30 - per * 2.4, 17, '#c9f2c9');
  }

  // ---------- Draw: trees ----------
  function drawTree(n) {
    const [sx, sy] = toScreen(n.x, n.y);
    let s = n.size;
    if (n.hp <= 0) {
      if (!n.farm || n.grow < 0.08) { drawStump(sx, sy, s, n.species); return; }
      s *= 0.3 + 0.55 * n.grow;
    }
    const wob = Math.sin(n.shake * 30) * n.shake * (n.species === 'redwood' ? 3 : 5);
    ctx.fillStyle = 'rgba(30,40,20,.26)';
    ctx.beginPath(); ctx.ellipse(sx + 6, sy + 2, 28 * s, 28 * s * TILT, 0, 0, Math.PI * 2); ctx.fill();
    const trunk = { pine: '#7a4f2c', oak: '#5e4129', redwood: '#9a4a2c' }[n.species];
    ctx.fillStyle = trunk;
    const th = n.species === 'redwood' ? 60 : 34;
    roundRect(sx - 6 * s, sy - th * s, 12 * s, (th + 2) * s, 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fillRect(sx + 1 * s, sy - th * s, 5 * s, th * s);
    ctx.save();
    ctx.translate(sx + wob, sy);
    if (n.species === 'oak') {
      // broad, round crown
      const blob = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2); ctx.fill(); };
      blob(0, -50, 32, '#4b6e2c'); blob(-18, -58, 22, '#577d33'); blob(18, -56, 23, '#52772f');
      blob(0, -74, 24, '#628c3a'); blob(-8, -80, 11, '#7aa64a');
    } else {
      // conifer: stacked triangles (pine bright green, redwood deep and tall)
      const layers = n.species === 'redwood' ? 5 : 3;
      const base = n.species === 'redwood' ? -40 : -26, step = n.species === 'redwood' ? 22 : 20;
      const cols = n.species === 'redwood' ? ['#1f4a2c', '#255533', '#2c603a', '#336b40', '#3b7748'] : ['#2f7a3d', '#378a46', '#41994f'];
      for (let i = 0; i < layers; i++) {
        const y = base - i * step, half = (26 - i * (n.species === 'redwood' ? 3.5 : 5)) * 1.0;
        ctx.fillStyle = cols[i];
        ctx.beginPath();
        ctx.moveTo(-half * s, y * s); ctx.lineTo(half * s, y * s); ctx.lineTo(0, (y - 34) * s);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
    if (n.hp > 0) drawPips(sx, sy - (n.species === 'redwood' ? 172 : 108) * s, n);
  }

  function drawMaple(n) {
    const [sx, sy] = toScreen(n.x, n.y);
    const wob = Math.sin(n.shake * 30) * n.shake * 3;
    ctx.fillStyle = 'rgba(30,40,20,.26)';
    ctx.beginPath(); ctx.ellipse(sx + 6, sy + 2, 28, 28 * TILT, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6e4a32';
    roundRect(sx - 6, sy - 36, 12, 38, 4); ctx.fill();
    ctx.save();
    ctx.translate(sx + wob, sy);
    const blob = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    blob(0, -54, 28, '#c4472b'); blob(-16, -62, 19, '#d65a2e'); blob(16, -60, 20, '#cf4f2c');
    blob(0, -78, 21, '#e07a33'); blob(-6, -84, 10, '#f0a24a');
    ctx.restore();
    // sap bucket on the trunk, filling up
    ctx.fillStyle = '#9aa3ad';
    ctx.beginPath(); ctx.moveTo(sx + 5, sy - 22); ctx.lineTo(sx + 17, sy - 22); ctx.lineTo(sx + 15, sy - 10); ctx.lineTo(sx + 7, sy - 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d79a2b';
    const f = n.sap;
    ctx.fillRect(sx + 7, sy - 10 - 10 * f, 8, 10 * f);
    if (n.sap >= 1) {
      const b = Math.sin(performance.now() / 200) * 3;
      tag('Sap!', sx + 11, sy - 112 + b, 13, '#2b2a22', '#ffd27a');
    } else {
      ctx.strokeStyle = 'rgba(255,250,240,.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx + 11, sy - 110, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
    }
  }

  function drawStump(sx, sy, s, species) {
    ctx.fillStyle = 'rgba(30,40,20,.2)';
    ctx.beginPath(); ctx.ellipse(sx + 3, sy + 1, 14 * s, 14 * s * TILT, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = { pine: '#6b4426', oak: '#55391f', redwood: '#8a3f24' }[species];
    ctx.fillRect(sx - 9 * s, sy - 10 * s, 18 * s, 10 * s);
    ctx.beginPath(); ctx.ellipse(sx, sy, 9 * s, 9 * s * TILT, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = species === 'redwood' ? '#d98a6c' : '#d9a86c';
    ctx.beginPath(); ctx.ellipse(sx, sy - 10 * s, 9 * s, 9 * s * TILT, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b5834b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(sx, sy - 10 * s, 4.5 * s, 4.5 * s * TILT, 0, 0, Math.PI * 2); ctx.stroke();
  }

  function drawPips(x, y, n) {
    if (n.hp === n.max && gather.node !== n) return;
    if (n.max > 6) {
      ctx.fillStyle = 'rgba(43,42,34,.6)'; roundRect(x - 30, y - 4, 60, 8, 4); ctx.fill();
      ctx.fillStyle = '#fffaf0'; roundRect(x - 30, y - 4, 60 * n.hp / n.max, 8, 4); ctx.fill();
    } else {
      const w = 9, x0 = x - (n.max - 1) * w / 2;
      for (let i = 0; i < n.max; i++) {
        ctx.fillStyle = i < n.hp ? '#fffaf0' : 'rgba(255,250,240,.3)';
        ctx.beginPath(); ctx.arc(x0 + i * w, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (gather.node === n) {
      ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y - 14, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (gather.t / gatherTime())); ctx.stroke();
    }
  }

  // ---------- Draw: items ----------
  function logSprite(x, y, bark, end, ring) {
    ctx.fillStyle = bark;
    roundRect(x - 9, y - 3.5, 18, 7, 3.5); ctx.fill();
    ctx.fillStyle = end;
    ctx.beginPath(); ctx.ellipse(x - 9, y, 2.4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    if (ring) { ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(x - 9, y, 1, 0, Math.PI * 2); ctx.fill(); }
  }
  const drawLog = (x, y) => logSprite(x, y, '#a8723f', '#ecc690');
  const drawOak = (x, y) => logSprite(x, y, '#5e3f24', '#c89a62', '#8a6236');
  const drawRedwood = (x, y) => logSprite(x, y, '#9a3f22', '#e09a7a', '#b5583a');
  function drawPlank(x, y) {
    ctx.fillStyle = '#c99b5f';
    ctx.fillRect(x - 10, y - 2.5, 20, 5);
    ctx.fillStyle = '#e6c38d';
    ctx.fillRect(x - 10, y - 2.5, 20, 2);
    ctx.fillStyle = '#a97c45';
    ctx.fillRect(x - 3, y, 7, 1);
  }
  function drawSap(x, y) {
    ctx.fillStyle = '#9aa3ad';
    ctx.beginPath(); ctx.moveTo(x - 5, y - 6); ctx.lineTo(x + 5, y - 6); ctx.lineTo(x + 4, y + 3); ctx.lineTo(x - 4, y + 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d79a2b';
    ctx.fillRect(x - 4, y - 5, 8, 3);
  }
  function drawSyrup(x, y) {
    ctx.fillStyle = '#b5651d';
    roundRect(x - 3.5, y - 8, 7, 11, 2); ctx.fill();
    ctx.fillStyle = '#e8a04a';
    ctx.fillRect(x - 2.5, y - 5, 2, 6);
    ctx.fillStyle = '#d9644a';
    ctx.fillRect(x - 2, y - 11, 4, 3);
  }
  function drawBill(x, y) {
    ctx.fillStyle = '#2f7f3d';
    ctx.fillRect(x - 8, y - 2, 16, 5);
    ctx.fillStyle = '#4fb05f';
    ctx.fillRect(x - 8, y - 3.5, 16, 4);
    ctx.fillStyle = '#a8dcae';
    ctx.fillRect(x - 2, y - 3, 4, 3);
  }
  function drawChair(x, y) {
    ctx.fillStyle = '#8a5a2e';
    ctx.fillRect(x - 6, y - 12, 3, 14);
    ctx.fillRect(x - 6, y - 2, 12, 3);
    ctx.fillRect(x + 4, y + 1, 2, 6); ctx.fillRect(x - 6, y + 1, 2, 6);
    ctx.fillStyle = '#b5824f';
    ctx.fillRect(x - 6, y - 12, 3, 4);
  }
  function drawTable(x, y) {
    ctx.fillStyle = '#a0683a';
    ctx.fillRect(x - 11, y - 4, 22, 4);
    ctx.fillStyle = '#c4935a';
    ctx.fillRect(x - 11, y - 4, 22, 1.5);
    ctx.fillStyle = '#7a4e2a';
    ctx.fillRect(x - 9, y, 2, 8); ctx.fillRect(x + 7, y, 2, 8);
  }
  const ITEM_DRAW = { wood: drawLog, oak: drawOak, redwood: drawRedwood, plank: drawPlank, sap: drawSap, syrup: drawSyrup, cash: drawBill, chair: drawChair, table: drawTable };
  const drawItem = (kind, x, y) => (ITEM_DRAW[kind] || drawBill)(x, y);

  // ---------- Draw: people and machines ----------
  function drawPerson(sx, sy, o) {
    ctx.fillStyle = 'rgba(30,40,20,.28)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 16, 16 * TILT, 0, 0, Math.PI * 2); ctx.fill();
    const bob = Math.abs(Math.sin(o.walk)) * 3;
    ctx.save();
    ctx.translate(sx, sy - bob);
    ctx.scale(o.face, 1);
    if (o.before) o.before();
    const step = Math.sin(o.walk) * 4;
    ctx.fillStyle = o.pants || '#3d3a4f';
    ctx.fillRect(-7, -12, 5, 10 + step * 0.4);
    ctx.fillRect(2, -12, 5, 10 - step * 0.4);
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
    if (o.after) o.after();
    ctx.restore();
  }

  function drawPlayer() {
    const [sx, sy] = toScreen(player.x, player.y);
    drawPerson(sx, sy, {
      walk: player.walk, face: player.face, shirt: '#d9644a', skin: '#6b4127', hair: '#16120f', beard: true, pack: true,
      before: () => {
        const lean = Math.sin(player.walk) * 0.6;
        const shown = stack.slice(-STACK_SHOW);
        for (let i = 0; i < shown.length; i++) drawItem(shown[i], -15 + lean * (i / 6), -22 - i * 6.5);
      },
      after: () => {
        const n = gather.node;
        if (!n || n.type === 'maple') return;
        const ph = (player.swing / gatherTime() * 2) % 1;
        const ang = ph < 0.7 ? -1.9 + ph / 0.7 * 0.6 : -1.3 + (ph - 0.7) / 0.3 * 2.4;
        ctx.save();
        ctx.translate(8, -26);
        ctx.rotate(ang);
        ctx.fillStyle = '#8a5a2e';
        roundRect(-2, -2, 24, 4, 2); ctx.fill();
        ctx.fillStyle = ['#c9ced6', '#d8dde4', '#e8c55a', '#7fd6e8', '#b47fe8', '#ff7a5c'][level.tools];
        ctx.beginPath(); ctx.moveTo(18, -2); ctx.lineTo(25, -9); ctx.lineTo(27, 3); ctx.lineTo(18, 2); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#6b4127';
        ctx.beginPath(); ctx.arc(8, -26, 3.5, 0, Math.PI * 2); ctx.fill();
      },
    });
  }

  function drawCustomer(c) {
    const [sx, sy] = toScreen(c.x, c.y);
    drawPerson(sx, sy, {
      walk: c.walk, face: c.state === 'leave' ? 1 : -1, shirt: c.shirt, skin: c.skin, hair: c.hair,
      before: () => { for (let i = 0; i < Math.min(c.got, 10); i++) drawItem(c.kind, -15, -22 - i * 6.5); },
    });
    if (c.state === 'leave') {
      if (c.happy > 0) flatLabel('Thanks!', sx, sy - 70 - (1.2 - c.happy) * 20, 15, '#fffaf0');
      return;
    }
    const left = c.want - c.got;
    const bx = sx, by = sy - 80;
    ctx.fillStyle = '#fffaf0';
    roundRect(bx - 30, by - 16, 60, 30, 11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - 4, by + 14); ctx.lineTo(bx, by + 20); ctx.lineTo(bx + 4, by + 14); ctx.fill();
    drawItem(c.kind, bx - 12, by);
    flatLabel(`${left}`, bx + 14, by, 17, '#2b2a22');
    if (c.state === 'checkout') flatLabel('$', bx + 34, by - 14, 18, '#3f9d4f');
    if (c.state === 'buy' && stock[c.kind] === 0 && c.taken < c.want) flatLabel('!', bx + 34, by - 14, 20, '#d9644a');
  }

  function drawBot(b) {
    const [sx, sy] = toScreen(b.x, b.y);
    const st = BOT_STATS[b.id], k = st.big ? 1.45 : 1;
    const moving = b.state === 'seek' || b.state === 'return';
    const hop = moving ? Math.abs(Math.sin(b.bounce)) * 1.5 : 0;
    ctx.fillStyle = 'rgba(30,40,20,.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 24 * k, 24 * k * TILT, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(sx, sy - hop);
    ctx.scale(b.face * k, k);
    ctx.fillStyle = '#2b2a22';
    ctx.beginPath(); ctx.arc(-12, -5, 6, 0, Math.PI * 2); ctx.arc(12, -5, 6, 0, Math.PI * 2); ctx.fill();
    if (st.big) { ctx.beginPath(); ctx.arc(-24, -5, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#7a7a72';
    ctx.beginPath(); ctx.arc(-12, -5, 2.5, 0, Math.PI * 2); ctx.arc(12, -5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = st.big ? '#4f9d5a' : '#e8b83a';
    roundRect(st.big ? -32 : -22, -22, st.big ? 54 : 44, 14, 4); ctx.fill();
    roundRect(2, -36, 18, 16, 4); ctx.fill();
    ctx.fillStyle = '#bfe3f0';
    roundRect(6, -33, 11, 8, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(st.big ? -32 : -22, -12, st.big ? 54 : 44, 4);
    if (st.big) { ctx.fillStyle = '#3c3c38'; ctx.fillRect(-30, -34, 3, 14); ctx.fillRect(-6, -34, 3, 14); }
    const shown = Math.min(b.load.length, st.big ? 14 : 10);
    for (let i = 0; i < shown; i++) {
      if (st.big) drawItem(b.load[i], -17 + (i % 2) * 6, -25 - Math.floor(i / 2) * 4);
      else drawItem(b.load[i], -10 + (i % 2) * 4, -26 - i * 3);
    }
    ctx.strokeStyle = '#5f646c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(18, -20); ctx.lineTo(30, -28); ctx.stroke();
    ctx.save(); ctx.translate(32, -29); ctx.rotate(b.state === 'work' ? performance.now() / 40 : 0);
    ctx.fillStyle = '#c9ced6';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a + 0.4) * 6, Math.sin(a + 0.4) * 6); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5f646c'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
    const cap = st.cap[level[b.id] - 1];
    if (b.load.length) tag(`${b.load.length}/${cap}`, sx, sy - 56 * k, 13, '#fffaf0');
  }

  function drawHauler(h) {
    const [sx, sy] = toScreen(h.x, h.y);
    if (h.id === 'porter' || h.id === 'tapper') {
      drawPerson(sx, sy, {
        walk: h.state === 'load' || h.state === 'unload' ? 0 : h.walk, face: h.face,
        shirt: h.id === 'tapper' ? '#8a5bc4' : '#e0a63a', skin: h.id === 'tapper' ? '#c68e62' : '#4a2c1a',
        hair: '#16120f', hat: h.id === 'tapper' ? '#5a3a28' : '#e8c54a',
        after: () => { for (let i = 0; i < Math.min(h.load.length, 8); i++) drawItem(h.load[i], 12, -28 - i * 5); },
      });
      return;
    }
    const hop = h.state === 'toPallet' || h.state === 'toWh' ? Math.abs(Math.sin(h.bounce)) * 1.2 : 0;
    ctx.fillStyle = 'rgba(30,40,20,.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 26, 26 * TILT, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(sx, sy - hop);
    ctx.scale(h.face, 1);
    ctx.fillStyle = '#2b2a22';
    ctx.beginPath(); ctx.arc(-10, -5, 6, 0, Math.PI * 2); ctx.arc(10, -5, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b83a';
    roundRect(-20, -24, 34, 18, 4); ctx.fill();
    ctx.fillStyle = '#3c3c38';
    ctx.fillRect(-14, -44, 3, 20); ctx.fillRect(6, -44, 3, 20);
    ctx.fillRect(-15, -46, 25, 3);
    ctx.fillStyle = '#4a2c1a'; ctx.beginPath(); ctx.arc(-3, -32, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5f646c';
    ctx.fillRect(16, -48, 4, 44);
    const lift = Math.min(h.load.length, 12) * 1.5;
    ctx.fillRect(18, -8 - lift, 18, 3);
    for (let i = 0; i < Math.min(h.load.length, 12); i++) drawItem(h.load[i], 27, -12 - lift - i * 3);
    ctx.restore();
    if (h.load.length) tag(`${h.load.length}`, sx, sy - 66, 13, '#fffaf0');
  }

  function drawDeliveryTruck() {
    if (!level.dock || truck.state === 'away') return;
    const [sx, sy] = toScreen(truck.x, DOCK.y);
    ctx.fillStyle = 'rgba(30,40,20,.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 80, 80 * TILT * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(truck.face, 1);
    ctx.fillStyle = '#2b2a22';
    for (const x of [-48, -30, 40]) { ctx.beginPath(); ctx.arc(x, -7, 8, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#f2ece0';
    roundRect(-70, -64, 96, 56, 4); ctx.fill();
    ctx.fillStyle = '#3d7cc9';
    ctx.fillRect(-70, -24, 96, 6);
    ctx.fillStyle = '#d9644a';
    roundRect(28, -46, 34, 38, 6); ctx.fill();
    ctx.fillStyle = '#bfe3f0';
    roundRect(42, -42, 16, 14, 3); ctx.fill();
    ctx.restore();
    if (truck.state === 'load') {
      const o = truck.order, g = truck.got;
      ctx.fillStyle = '#fffaf0';
      roundRect(sx - 72, sy - 160, 144, 88, 10); ctx.fill();
      LOGS.forEach((k, i) => {
        drawItem(k, sx - 36, sy - 144 + i * 20);
        flatLabel(`${g[k]}/${o[k]}`, sx + 10, sy - 144 + i * 20, 15, '#2b2a22');
      });
      const waiting = LOGS.some(k => g[k] < o[k] && !wh[k] && !pallet[k]);
      flatLabel(waiting ? 'Needs warehouse stock' : 'Loading…', sx, sy - 84, 13, waiting ? '#d9644a' : '#3f9d4f');
    }
  }

  // ---------- Draw: effects ----------
  function drawFx() {
    for (const f of fx) {
      const p = f.t / f.life;
      if (f.type === 'text') {
        const [sx, sy] = toScreen(f.x, f.y);
        const y = sy - f.h - 20 - p * 34;
        ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        ctx.font = `600 20px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(43,42,34,.75)';
        ctx.strokeText(f.text, sx, y);
        ctx.fillStyle = f.color; ctx.fillText(f.text, sx, y);
        ctx.globalAlpha = 1;
      } else if (f.type === 'fly') {
        const [tx, ty] = typeof f.to === 'function' ? f.to() : f.to;
        const e = p * (2 - p);
        const x = f.x0 + (tx - f.x0) * e, y = f.y0 + (ty - f.y0) * e - Math.sin(p * Math.PI) * f.lift;
        drawItem(f.kind, x, y);
      }
    }
  }

  function drawChip(f) {
    const [sx, sy] = toScreen(f.x, f.y);
    ctx.globalAlpha = 1 - f.t / f.life;
    ctx.fillStyle = { wood: '#e3b77e', leaf: '#5aa046', spark: '#fff3a6' }[f.kind];
    ctx.fillRect(sx - 2, sy - f.h - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  function drawGuide(time) {
    let target = null;
    const onZone = inRect(DROP, DROP.w, DROP.d) || inRect(SAW_IN, SAW_IN.w, SAW_IN.d) || inRect(SHACK_IN, SHACK_IN.w, SHACK_IN.d);
    if (stack.includes('sap') && level.shack && !onZone) target = [SHACK_IN.x, SHACK_IN.y, 30];
    else if (stack.some(k => k !== 'sap') && !onZone) target = [DROP.x, DROP.y, 30];
    else if (pileAmt.store > 0 && !stack.length) target = [PILES.store.x, PILES.store.y, 60];
    else if (!level.drone && !stack.length) {
      const key = ['dock', 'showroom', 'rail'].find(k => pileAmt[k] > 0);
      if (key) target = [PILES[key].x, PILES[key].y, 60];
    }
    if (!target) return;
    const [sx, sy] = toScreen(target[0], target[1]);
    const y = sy - target[2] - 20 + Math.sin(time * 6) * 5;
    ctx.fillStyle = '#fff3a6'; ctx.strokeStyle = 'rgba(43,42,34,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx - 13, y - 14); ctx.lineTo(sx + 13, y - 14); ctx.lineTo(sx, y + 2); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  // drawn in real screen pixels, not zoomed
  function drawStick() {
    if (stick.id === null) return;
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = 'rgba(43,42,34,.28)';
    ctx.strokeStyle = 'rgba(255,250,240,.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(stick.ox, stick.oy, stick.R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,250,240,.95)';
    ctx.beginPath(); ctx.arc(stick.ox + stick.dx, stick.oy + stick.dy, 24, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const onScreen = (x, y, m) => {
    const [sx, sy] = toScreen(x, y);
    return sx > -m && sx < W + m && sy > -20 && sy < H + m * 2;
  };

  function render(time) {
    drawGround();
    drawGroundMarks(time);
    const items = [];
    const add = (y, draw) => items.push({ y, draw });
    for (const d of decor) if (onScreen(d.x, d.y, 20)) add(d.y, () => drawDecor(d));
    for (const n of nodes) if (onScreen(n.x, n.y, 100 * n.size)) add(n.y, () => n.type === 'maple' ? drawMaple(n) : drawTree(n));
    for (const c of customers) if (onScreen(c.x, c.y, 60)) add(c.y, () => drawCustomer(c));
    for (const b of bots) if (onScreen(b.x, b.y, 80)) add(b.y, () => drawBot(b));
    for (const h of haulers) if (onScreen(h.x, h.y, 60)) add(h.y, () => drawHauler(h));
    for (const f of fx) if (f.type === 'chip') add(f.y, () => drawChip(f));
    add(STORE.front - 1, drawStore);
    if (level.sawmill) add(SAW.front - 1, drawSawmill);
    if (level.shack) add(SHACK.front - 1, drawShack);
    if (level.warehouse) {
      add(WH.y0 - 1, drawWhBack);
      add(WH.y0, () => drawWhSide(WH.x0 + 7, WH.y0, WH.y1));
      add(WH.y0, () => drawWhSide(WH.x1 - 7, WH.y0, CY - 150));
      add(CY - 10, () => drawWhSide(WH.x1 - 7, CY - 10, WH.y1));
      RACKS.forEach((ry, i) => add(ry, () => drawRack(i)));
      if (level.annex) {
        add(ANNEX.y0 - 1, () => drawWhBack(ANNEX));
        add(ANNEX.y0, () => drawWhSide(ANNEX.x0 + 7, ANNEX.y0, ANNEX.y1));
        add(ANNEX.y0, () => drawWhSide(ANNEX.x1 - 7, ANNEX.y0, ANNEX.y1));
        RACKS.forEach((ry, i) => add(ry, () => drawRack(i, true)));
      }
      for (let i = 0; i < palletCount(); i++) add(PALLETS[i].y, () => drawPallet(i));
    }
    if (level.dock) add(DOCK.y, drawDeliveryTruck);
    if (level.workshop) add(WORKSHOP.front - 1, drawWorkshop);
    if (level.showroom) { add(SHOWROOM.front - 1, drawShowroom); add(car.y, drawBuyerCar); }
    if (level.rail) { add(STATION.front - 1, drawStation); add(TRACK_Y, drawTrain); }
    if (level.ads) add(BILLBOARD.y, drawBillboard);
    if (level.hq) add(HQ.front - 1, drawHQ);
    else if (onScreen(HQ.x, HQ.front, 200)) add(HQ.front - 200, () => dashedPlot(HQ.x, HQ.front - HQ.d / 2, HQ.w, HQ.d, 'Head Office plot'));
    for (const key in PILES) if (key === 'store' || level[key]) add(PILES[key].y, () => drawCashPile(key));
    add(player.y, drawPlayer);
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
    drawDrone();
    drawFx();
    drawGuide(time);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(225,240,255,.16)'); g.addColorStop(0.45, 'rgba(225,240,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawStick();
  }

  function roundRect(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const varCache = {};
  function getVar(n) { return varCache[n] || (varCache[n] = getComputedStyle(document.documentElement).getPropertyValue(n).trim()); }

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); render(now / 1000);
    requestAnimationFrame(frame);
  }

  // ---------- Saving ----------
  // Progress saves to the player's private slot on their account, with a copy in this browser.
  const SAVE_KEY = 'homestead-save';
  let saveRef = null, lastSaved = '', loadedAt = 0, lastCloud = 0;

  function snapshot() {
    return {
      v: 9, savedAt: Date.now(), px: Math.round(player.x), py: Math.round(player.y),
      carried: { ...carried }, stock: { ...stock }, wh: { ...wh }, pallet: { ...pallet },
      saw: { q: { ...saw.q }, out: saw.out }, shack: { sap: shack.sap, out: shack.out },
      workshop: { planks: workshop.planks, chair: workshop.chair, table: workshop.table }, showroom: { ...showroom },
      level: { ...level }, paid: { ...paid }, cash, piles: { ...pileAmt }, served,
      hp: nodes.map(n => n.type === 'maple' ? Math.round(n.sap * 100) / 100 : n.hp),
      grow: nodes.map(n => n.farm ? Math.round((n.grow ?? 1) * 100) / 100 : 1),
      bots: bots.map(b => ({ id: b.id, load: b.load.length })),
    };
  }

  // copy only the keys this version knows, so older saves with stone or other leftovers load cleanly
  const merge = (into, from) => { if (from) for (const k in into) if (typeof from[k] === 'number') into[k] = from[k]; };

  function applySave(d) {
    if (!d || !(d.v >= 5)) return false;
    const old = d.v < 9;
    if (!old) { player.x = d.px; player.y = d.py; }
    merge(carried, d.carried); merge(stock, d.stock); merge(wh, d.wh); merge(pallet, d.pallet);
    if (d.saw && d.saw.q) { merge(saw.q, d.saw.q); saw.out = d.saw.out; }
    if (d.shack) { shack.sap = d.shack.sap; shack.out = d.shack.out; }
    if (d.workshop) { workshop.planks = d.workshop.planks; workshop.chair = d.workshop.chair; workshop.table = d.workshop.table; }
    merge(showroom, d.showroom);
    merge(level, d.level); merge(paid, d.paid);
    cash = d.cash; served = d.served;
    if (d.piles) merge(pileAmt, d.piles); else pileAmt.store = d.pile || 0;
    stack = [];
    for (const k of ['wood', 'oak', 'redwood', 'sap']) for (let i = 0; i < carried[k]; i++) stack.push(k);
    ensureYard();
    if (!old && d.hp && d.hp.length === nodes.length) {
      d.hp.forEach((v, i) => { if (nodes[i].type === 'maple') nodes[i].sap = v; else { nodes[i].hp = v; nodes[i].grow = d.grow[i]; } });
    }
    bots = []; ensureBots();
    for (const sb of d.bots || []) {
      const b = bots.find(x => x.id === sb.id && !x.load.length);
      if (b) b.load = Array(sb.load).fill('wood');
    }
    haulers = []; ensureHaulers();
    customers = []; fillQueue(true);
    loadedAt = d.savedAt || 0;
    clampPlayer(); snapCamera(); updateHud();
    return true;
  }

  function save(force) {
    const d = snapshot();
    const body = JSON.stringify({ ...d, savedAt: 0 });
    if (!force && body === lastSaved) return;
    lastSaved = body;
    const json = JSON.stringify(d);
    try { localStorage.setItem(SAVE_KEY, json); } catch (e) { /* storage blocked: account save still runs */ }
    if (saveRef && (force || Date.now() - lastCloud > 8000)) {
      lastCloud = Date.now();
      saveRef.set({ state: json, savedAt: d.savedAt }).catch(() => {});
    }
  }

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
  }

  async function connectAccountSave() {
    try {
      const use = window.claude?.use;
      if (!use) return;
      const [db, user] = await Promise.all([use('db'), use('user')]);
      const id = user && await user.id();
      if (!db || !id) return;
      const ref = db.doc('data/users/' + id + '/save');
      const snap = await ref.get();
      const d = snap.exists ? snap.data() : null;
      if (d && d.savedAt > loadedAt) applySave(JSON.parse(d.state));
      saveRef = ref;
    } catch (e) { /* no account save in this view; the browser copy still works */ }
  }

  function start(saved) {
    resize();
    if (!applySave(saved)) applySave(loadLocal());
    afterUpgrade();
    updateHud();
    addEventListener('resize', resize);
    setInterval(() => save(false), 3000);
    addEventListener('pagehide', () => save(true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
    connectAccountSave();
    requestAnimationFrame(frame);
  }
  window.claude?.hot?.snapshot?.(snapshot);
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
</script>
