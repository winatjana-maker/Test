<script>
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint');
  const ui = {
    rate: document.getElementById('n-rate'),
    goals: document.getElementById('goals'), toast: document.getElementById('toast'),
    panel: document.getElementById('panel'), panelTitle: document.getElementById('panel-title'), panelList: document.getElementById('panel-list'),
    map: document.getElementById('map'),
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
  const ITEM_NAME = { wood: 'Pine', oak: 'Oak', redwood: 'Redwood', plank: 'Planks', syrup: 'Syrup', sap: 'Sap', chair: 'Chairs', table: 'Tables',
    chips: 'Wood chips', water: 'Water', paper: 'Paper', pellets: 'Pellets', charcoal: 'Charcoal' };
  const PLANKS_PER = { wood: 1, oak: 2, redwood: 4 };            // sawmill yield per log
  const PRICE = { wood: 2, oak: 4, plank: 6, syrup: 12, redwood: 10, chair: 45, table: 90, paper: 15, pellets: 8, charcoal: 7 };
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
    showroom: { ...P(1700, 320), r: 46 }, rail: { ...P(-420, 1780), r: 52 },
    harbor: { ...P(1250, -1400), r: 52 }, village: { ...P(-1180, -540), r: 46 } };
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
    industry: { name: 'Industrial Park', x0: CX + 200, x1: CX + 1500, y0: CY + 1220, y1: CY + 1660, ground: '#a9a59a' },
    harbor: { name: 'Harbor', x0: CX + 700, x1: CX + 2080, y0: CY - 1860, y1: CY - 1300, ground: '#cdbb94' },
    village: { name: 'Pine Village', x0: CX - 2080, x1: CX - 1220, y0: CY - 1500, y1: CY - 620, ground: '#9fb87a' },
  };
  // dirt roads through the forest to each district (trees never grow on them)
  const ROADS = [
    { x0: CX - 70, x1: CX + 70, y0: CY - 1600, y1: CY - 640 },
    { x0: CX + 1100, x1: CX + 1600, y0: CY - 60, y1: CY + 60 },
    { x0: CX - 870, x1: CX - 730, y0: CY + 1160, y1: CY + 1600 },
    { x0: CX + 1990, x1: CX + 2090, y0: CY + 430, y1: CY + 1100 },
    { x0: CX + 730, x1: CX + 870, y0: CY + 1080, y1: CY + 1230 },
    { x0: CX + 1000, x1: CX + 1120, y0: CY - 1300, y1: CY - 700 },
    { x0: CX - 1230, x1: CX - 1070, y0: CY - 700, y1: CY - 590 },
  ];
  const GEN = { x: CX + 420, front: CY + 1510, w: 190, d: 100 };
  const MILL = { x: CX + 760, front: CY + 1520, w: 230, d: 110 };
  const POND = P(1090, 1400);
  const PUMP = { x: CX + 1090, front: CY + 1560, w: 100, d: 60 };
  const KILN = { x: CX + 1360, front: CY + 1520, w: 180, d: 100 };
  const DEPOT = { x: CX + 420, front: CY + 1632, w: 240, d: 90 };
  const LAB = { x: CX - 350, front: CY + 900, w: 240, d: 110 };
  const DISPATCH = { x: CX - 600, front: CY + 380, w: 170, d: 90 };
  // harbor: the sea runs along the north edge east of the reserve
  const SEA = { x0: CX + 620, y1: CY - 1870 };
  const CUSTOMS = { x: CX + 950, front: CY - 1420, w: 200, d: 100 };
  const SHIP = { x: CX + 1760, y: CY - 1990 };
  const CRANES = [P(1380, -1872), P(1820, -1872)];
  const PIER = { x0: CX + 1460, x1: CX + 1540, y0: CY - 2060, y1: CY - 1870 };
  // village: houses on plots, a village store you walk into, and a builder's yard
  const VSTORE = { x: CX - 1380, front: CY - 720, w: 220, d: 110 };
  const BUILDER = { x: CX - 1350, front: CY - 1150, w: 210, d: 140 };
  const VILLAGE_GATE = P(-1250, -650);
  const HOUSE_SPOTS = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) HOUSE_SPOTS.push({ x: CX - 2000 + c * 150, front: CY - 1380 + r * 160, w: 110, d: 80 });
  const RESERVE = { x: CX, y: CY - 1835, cols: 8, gap: 115 };
  const WORKSHOP = { x: CX + 1740, front: CY - 80, w: 220, d: 110 };
  const SHOWROOM = { x: CX + 1880, front: CY + 170, w: 190, d: 110 };
  const CAR = { x: CX + 2040, park: CY + 120, start: CY + 1150 };
  const STATION = { x: CX - 800, front: CY + 1870, w: 260, d: 100 };
  const TRACK_Y = CY + 1990;
  const BILLBOARD = P(330, 700);

  // ---------- Upgrades (pay by standing on the tile) ----------
  // Every upgrade belongs to a group. Each group has one tile on the ground; stand on it and its
  // upgrades open in a panel where you choose what to buy.
  const UPGRADES = [
    // you
    { id: 'run', group: 'you', name: 'Run Speed', costs: [15, 45, 100, 500, 1200], note: 'Move faster' },
    { id: 'swing', group: 'you', name: 'Faster Swing', costs: [10, 35, 90, 400], note: 'Chop faster' },
    { id: 'tools', group: 'you', name: 'Better Tools', costs: [25, 70, 160, 600, 1500], note: '+1 per hit' },
    // store
    { id: 'store', group: 'store', name: 'Store Size', hire: 'Expand Store', costs: [120, 350, 800, 2500, 6000], note: 'Bigger orders, more shelf space' },
    { id: 'price', group: 'store', name: 'Better Prices', costs: [40, 110, 250, 800, 2000], note: '+$1 per item sold' },
    { id: 'cashier', group: 'store', name: 'Cashier', hire: 'Hire Cashier', costs: [30, 80, 180, 600], note: 'Serve customers faster' },
    { id: 'lane2', group: 'store', name: 'Lane 2', hire: 'Open Lane 2', costs: [350], note: 'Serve two lines at once' },
    { id: 'ads', group: 'store', name: 'Billboards', hire: 'Put Up Billboards', costs: [1200, 3000, 7000], note: 'Customers buy more' },
    // machines
    { id: 'lumber', group: 'machines', name: 'Lumber Bot', hire: 'Buy Lumber Bot', costs: [150, 220, 400, 1200], note: 'Chops & restocks logs', more: 'Faster, carries more' },
    { id: 'fleet', group: 'machines', name: 'Bot Fleet', hire: 'Add Lumber Bot', costs: [1500, 3000, 6000], note: '+1 Lumber Bot', needs: 'lumber' },
    { id: 'truck', group: 'machines', name: 'Logging Truck', hire: 'Buy Logging Truck', costs: [600, 900, 1500, 4000], note: 'Hauls 40+ logs, loves redwood', more: 'Faster, hauls more' },
    { id: 'trucks', group: 'machines', name: 'Truck Fleet', hire: 'Add Logging Truck', costs: [5000, 10000], note: '+1 logging truck', needs: 'truck' },
    { id: 'drone', group: 'machines', name: 'Cash Drone', hire: 'Buy Cash Drone', costs: [2500, 5000], note: 'Collects cash for you', more: 'Faster drone' },
    // tree yard
    { id: 'farm', group: 'farm', name: 'Tree Yard', hire: 'Build Tree Yard', costs: [60, 200, 450, 1500], note: 'Pine & oak that grow back', more: 'More rows, faster growth' },
    // maple & syrup
    { id: 'grove', group: 'maple', name: 'Maple Grove', hire: 'Plant Maple Grove', costs: [150, 300, 600, 1500, 3000], note: 'Maples drip sap', more: 'More maples, faster sap' },
    { id: 'shack', group: 'maple', name: 'Sugar Shack', hire: 'Build Sugar Shack', costs: [200, 400, 800, 2000, 5000, 12000], note: 'Boils sap into syrup', more: 'Boils faster', needs: 'grove' },
    { id: 'tapper', group: 'maple', name: 'Sap Tapper', hire: 'Hire Sap Tapper', costs: [200, 350, 600, 1500], note: 'Collects sap for you', more: 'Faster, carries more', needs: 'shack' },
    { id: 'sapbots', group: 'maple', name: 'Sap Bots', hire: 'Add Sap Bot', costs: [1200, 2500, 5000, 10000], note: '+1 robot that taps maples', needs: 'tapper' },
    { id: 'buckets', group: 'maple', name: 'Bigger Buckets', hire: 'Upgrade Buckets', costs: [800, 2500, 7000], note: '+1 sap from every tap', more: '+1 more sap per tap', needs: 'grove' },
    { id: 'evap', group: 'maple', name: 'Evaporator', hire: 'Install Evaporator', costs: [1500, 5000, 15000], note: 'More syrup from the same sap', more: 'Even more syrup per sap', needs: 'shack' },
    // sawmill
    { id: 'sawmill', group: 'sawmill', name: 'Sawmill', hire: 'Build Sawmill', costs: [250, 500, 900, 2500, 6000, 15000, 40000, 100000], note: 'Logs into planks (and wood chips)', more: 'Cuts faster' },
    { id: 'sawfeed', group: 'sawmill', name: 'Log Feeder', hire: 'Build Log Feeder', costs: [2500, 8000, 25000], note: 'Warehouse logs reach the sawmill faster', more: 'Feeds faster', needs: 'sawmill' },
    { id: 'kiln', group: 'sawmill', name: 'Drying Kiln', hire: 'Build Drying Kiln', costs: [1500, 4000], note: 'Planks sell for +$4', more: 'Planks sell for +$8', needs: 'sawmill' },
    // warehouse & logistics
    { id: 'warehouse', group: 'warehouse', name: 'Warehouse', hire: 'Build Warehouse', costs: [100, 250, 600, 2000, 5000], note: 'Stores extra logs', more: 'Holds more' },
    { id: 'forklift', group: 'warehouse', name: 'Forklift', hire: 'Buy Forklift', costs: [200, 450, 800, 2000, 4000], note: 'Moves pallets inside', more: 'Faster, carries more', needs: 'warehouse' },
    { id: 'forkfleet', group: 'warehouse', name: 'Forklift Fleet', hire: 'Add a Forklift', costs: [800, 1600, 3200, 6400], note: '+1 forklift', needs: 'forklift' },
    { id: 'palletyard', group: 'warehouse', name: 'Pallet Yard', hire: 'Expand Pallet Yard', costs: [500, 1500, 4000], note: 'More pallets for overflow', needs: 'warehouse' },
    { id: 'conveyor', group: 'warehouse', name: 'Conveyor', hire: 'Build Conveyor', costs: [180, 360, 700, 2000, 5000], note: 'Belt to the shelves', more: 'Faster belt', needs: 'warehouse' },
    { id: 'annex', group: 'warehouse', name: 'Warehouse Annex', hire: 'Build Annex', costs: [3000, 6000, 12000], note: '+1,500 storage', more: 'More storage', needs: 'warehouse' },
    { id: 'dock', group: 'warehouse', name: 'Loading Dock', hire: 'Build Loading Dock', costs: [250, 500, 1500], note: 'Trucks place big orders', more: 'Bigger orders, more often', needs: 'warehouse' },
    // head office
    { id: 'hq', group: 'hq', name: 'Head Office', hire: 'Build Head Office', costs: [20000, 50000, 100000], note: '+10% on every sale', more: 'Bigger bonus on every sale' },
    // land deeds and what you build on them
    { id: 'reserve', group: 'reserve', name: 'Redwood Reserve', hire: 'Buy Redwood Reserve', costs: [3000, 4000, 8000, 16000], note: 'Redwoods that grow back', more: 'More redwoods, faster growth' },
    { id: 'east', group: 'east', name: 'Furniture District', hire: 'Buy the land', costs: [5000], note: 'Land for furniture making' },
    { id: 'workshop', group: 'east', name: 'Workshop', hire: 'Build Workshop', costs: [2000, 4000, 8000, 16000], note: 'Planks into chairs & tables', more: 'Builds faster', needs: 'east' },
    { id: 'showroom', group: 'east', name: 'Showroom', hire: 'Build Showroom', costs: [3000, 6000, 12000], note: 'Rich buyers drive in', more: 'More buyers, bigger buys', needs: 'workshop' },
    { id: 'rail', group: 'rail', name: 'Rail Yard', hire: 'Buy Rail Yard', costs: [10000, 15000, 30000, 60000], note: 'Freight trains, huge orders', more: 'More trains, bigger orders' },
    // industrial park: chips, power, water, paper, charcoal, and the vans that connect it all
    { id: 'industry', group: 'industry', name: 'Industrial Park', hire: 'Buy the land', costs: [8000], note: 'Land for power, paper & charcoal' },
    { id: 'depot', group: 'industry', name: 'Van Depot', hire: 'Build Van Depot', costs: [1500], note: 'Delivery vans connect your buildings', needs: 'industry' },
    { id: 'vans', group: 'industry', name: 'Van Fleet', hire: 'Add a Van', costs: [2500, 5000, 10000, 20000], note: '+1 delivery van', needs: 'depot' },
    { id: 'vanpro', group: 'industry', name: 'Bigger Vans', hire: 'Upgrade Vans', costs: [2000, 6000, 15000], note: 'Vans carry more and drive faster', needs: 'depot' },
    { id: 'generator', group: 'industry', name: 'Generator', hire: 'Build Generator', costs: [4000, 10000, 25000], note: 'Burns wood chips; power speeds up machines', more: 'More power per chip', needs: 'industry' },
    { id: 'pellets', group: 'industry', name: 'Pellet Press', hire: 'Build Pellet Press', costs: [3000, 8000], note: 'Spare chips into pellets (trains buy them)', more: 'Presses faster', needs: 'generator' },
    { id: 'pump', group: 'industry', name: 'Water Pump', hire: 'Build Water Pump', costs: [2500, 6000, 15000], note: 'Pipes water to the paper mill', more: 'Pumps faster', needs: 'industry' },
    { id: 'papermill', group: 'industry', name: 'Paper Mill', hire: 'Build Paper Mill', costs: [6000, 15000, 35000], note: 'Chips + water + power → paper', more: 'Makes paper faster', needs: 'industry' },
    // dispatch office: you decide where wood goes
    { id: 'dispatch', group: 'dispatch', name: 'Dispatch Office', hire: 'Build Dispatch Office', costs: [800], note: 'Control reserves, bot targets and the Tree Yard mix' },
    // research lab: projects take time and boost everything
    { id: 'lab', group: 'lab', name: 'Research Lab', hire: 'Build Research Lab', costs: [15000], note: 'Unlocks research projects' },
    { id: 'r_saw', group: 'lab', name: 'Laser Saws', costs: [8000, 20000], research: [45, 90], note: 'Sawmill & workshop +25% speed', needs: 'lab' },
    { id: 'r_engine', group: 'lab', name: 'Efficient Engines', costs: [6000, 18000], research: [40, 80], note: 'Vans, bots, trucks & forklifts +20% speed', needs: 'lab' },
    { id: 'r_market', group: 'lab', name: 'Market Research', costs: [10000, 30000, 70000], research: [60, 120, 180], note: '+10% on all prices', needs: 'lab' },
    { id: 'r_growth', group: 'lab', name: 'Fertilizer', costs: [5000, 15000], research: [40, 80], note: 'Trees & maples grow 30% faster', needs: 'lab' },
    { id: 'r_logistics', group: 'lab', name: 'Route Planning', costs: [8000, 25000], research: [50, 100], note: 'Vans carry 50% more, forklifts work faster', needs: 'lab' },
    { id: 'r_power', group: 'lab', name: 'Turbines', costs: [7000, 20000], research: [45, 90], note: '+50% generator power', needs: 'lab' },
    // harbor: cargo ships buy huge mixed orders and pay 3×
    { id: 'harbor', group: 'harbor', name: 'Harbor', hire: 'Buy the Harbor', costs: [25000], note: 'Cargo ships, huge export orders' },
    { id: 'cranes', group: 'harbor', name: 'Dock Cranes', hire: 'Upgrade Cranes', costs: [10000, 25000, 60000], note: 'Load ships faster', needs: 'harbor' },
    { id: 'shipping', group: 'harbor', name: 'Shipping Lines', hire: 'Sign Shipping Line', costs: [20000, 50000, 100000], note: 'Bigger ships, more often', needs: 'harbor' },
    // village: a second store, and houses you build that bring in shoppers and rent
    { id: 'village', group: 'village', name: 'Pine Village', hire: 'Buy the Village Land', costs: [12000], note: 'A village to supply and grow' },
    { id: 'vstore', group: 'village', name: 'Village Store', hire: 'Build Village Store', costs: [6000, 15000], note: 'Villagers shop here; vans keep it stocked', more: 'More shelf space, bigger baskets', needs: 'village' },
    { id: 'builder', group: 'village', name: "Builder's Yard", hire: "Build Builder's Yard", costs: [10000], note: 'Builds houses from planks & redwood (vans deliver)', needs: 'village' },
    { id: 'housing', group: 'village', name: 'House Plots', hire: 'Survey More Plots', costs: [8000, 20000, 45000], note: '+4 house plots', needs: 'builder' },
    { id: 'crew', group: 'village', name: 'Construction Crew', hire: 'Hire a Crew', costs: [5000, 15000], note: 'Build faster', more: 'Build two houses at once', needs: 'builder' },
    { id: 'charcoal', group: 'industry', name: 'Charcoal Kiln', hire: 'Build Charcoal Kiln', costs: [3000, 8000, 20000, 45000, 90000, 180000], note: 'Oak → charcoal; doubles syrup speed', more: 'Burns faster', needs: 'industry' },
    { id: 'kilnfeed', group: 'industry', name: 'Oak Feeder', hire: 'Build Oak Feeder', costs: [4000, 12000, 30000], note: 'Kiln pulls oak straight from the warehouse', more: 'Feeds faster, holds more oak', needs: 'charcoal' },
  ];
  const GROUPS = [
    { id: 'you', name: 'Your Skills', ...P(-370, 210) },
    { id: 'store', name: 'Store', ...P(-70, 210) },
    { id: 'machines', name: 'Machines', ...P(-370, 480) },
    { id: 'warehouse', name: 'Warehouse & Logistics', ...P(-815, 170) },
    { id: 'farm', name: 'Tree Yard', ...P(560, -470) },
    { id: 'maple', name: 'Maple & Syrup', ...P(1080, -250) },
    { id: 'sawmill', name: 'Sawmill', ...P(720, 150) },
    { id: 'hq', name: 'Head Office', ...P(540, 960) },
    { id: 'industry', name: 'Industrial Park', ...P(800, 1130) },
    { id: 'reserve', name: 'Redwood Reserve', ...P(0, -1490) },
    { id: 'east', name: 'Furniture District', ...P(1490, 0) },
    { id: 'rail', name: 'Rail Yard', ...P(-800, 1490) },
    { id: 'lab', name: 'Research Lab', ...P(-350, 1030) },
    { id: 'dispatch', name: 'Dispatch Office', ...P(-600, 480) },
    { id: 'harbor', name: 'Harbor', ...P(1060, -1230) },
    { id: 'village', name: 'Pine Village', ...P(-1000, -650) },
  ];
  const TILE_SIZE = 110;
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
  const rSaw = () => [1, 1.25, 1.5][level.r_saw];
  const rEng = () => [1, 1.2, 1.4][level.r_engine];
  const rMarket = () => [1, 1.1, 1.2, 1.3][level.r_market];
  const rGrowth = () => [1, 1.3, 1.6][level.r_growth];
  const rLog = () => [1, 1.5, 2][level.r_logistics];
  const rPower = () => [1, 1.5, 2][level.r_power];
  // village and harbor numbers
  const vstoreCap = () => [0, 30, 60][level.vstore];
  const houseSlots = () => level.builder ? Math.min(16, 4 + 4 * level.housing) : 0;
  const buildTime = () => [40, 25, 15][level.crew];
  const shipEvery = () => [90, 90, 60, 35][level.shipping];
  const craneStep = () => [0.06, 0.04, 0.025, 0.015][level.cranes];
  const HOUSE_PLANKS = 30, HOUSE_REDWOOD = 6, BUILDER_CAP = { plank: 90, redwood: 30 };
  // industrial park numbers
  const vanCount = () => level.depot ? 1 + level.vans : 0;
  const vanCap = () => Math.round([10, 20, 35, 50][level.vanpro] * rLog());
  const vanSpeed = () => [240, 300, 360, 440][level.vanpro] * rEng();
  const genCap = () => [0, 40, 80, 150][level.generator] * rPower();           // power units supplied while fuelled
  const genBurn = () => [4, 4, 5.5, 7][level.generator];             // seconds per chip at full load
  const pelletTime = () => [2, 2, 1][level.pellets];
  const pumpRate = () => [0, 1, 2, 4][level.pump];                   // water per second
  const paperTime = () => [3, 3, 1.8, 1][level.papermill];            // 2 chips + 1 water → 1 ream
  const coalTime = () => [4, 4, 2.5, 1.5, 1, 0.65, 0.4][level.charcoal];            // 1 oak → 2 charcoal
  const CHIP_CAP = 80, FUEL_CAP = 60, MILL_CAP = 40, WATER_CAP = 40, OUT_CAP = 60, KILN_IN_CAP = 30, SHACK_COAL_CAP = 30;
  const yardSpots = () => [0, 12, 24, 48, 60][level.farm];
  const growTime = () => [25, 25, 18, 12, 8][level.farm];
  const groveSpots = () => [0, 6, 10, 15, 20, 25][level.grove];
  const sapTime = () => [20, 20, 14, 9, 7, 5][level.grove];            // seconds for a maple's bucket to fill
  const sawTime = () => [2, 2, 1.2, 0.6, 0.35, 0.2, 0.13, 0.09, 0.06][level.sawmill];
  const sawCap = () => [20, 20, 30, 40, 60, 80, 100, 130, 160][level.sawmill];
  const sawOutCap = () => [60, 60, 60, 60, 60, 60, 90, 120, 150][level.sawmill];
  const sawOutGap = () => [0.2, 0.2, 0.2, 0.15, 0.1, 0.08, 0.06, 0.05, 0.04][level.sawmill];   // seconds between planks leaving
  const feedGap = () => [0.3, 0.15, 0.08, 0.04][level.sawfeed];        // warehouse → sawmill
  const feedLow = () => [8, 20, 35, 50][level.sawfeed];
  const coalOutCap = () => [60, 60, 60, 60, 90, 120, 160][level.charcoal];
  const kilnInCap = () => [30, 50, 80, 120][level.kilnfeed];
  const kilnGap = () => [0, 0.6, 0.3, 0.15][level.kilnfeed];
  const boilTime = () => [3, 3, 1.8, 1, 0.5, 0.32, 0.2][level.shack];
  const evapBonus = () => [0, 0.35, 0.7, 1][level.evap];               // extra bottles per boil            // two sap → one bottle
  const reserveSpots = () => [0, 8, 16, 24, 32][level.reserve];
  const reserveGrow = () => [60, 60, 45, 30, 20][level.reserve];
  const workshopTime = () => [3, 3, 2, 1.2, 0.6][level.workshop];
  const buyerEvery = () => [12, 12, 6, 3][level.showroom];
  const trainEvery = () => [60, 60, 40, 25, 15][level.rail];
  const adsMul = () => [1, 1.25, 1.5, 2][level.ads];
  const BELT_SPEED = [0, 140, 200, 280, 380, 500], BELT_GAP = [0, 0.45, 0.25, 0.12, 0.07, 0.04];
  const WS_CAP = 30, WS_OUT_CAP = 20, SHOW_CAP = 24;
  const PALLET_CAP = 40, SAW_CAP = 20, SAW_OUT_CAP = 60;
  const shackCap = () => [30, 30, 30, 30, 30, 50, 80][level.shack];       // sap the shack can hold
  const shackOutCap = () => [30, 30, 30, 30, 30, 50, 80][level.shack];
  const syrupGap = () => [0.25, 0.25, 0.25, 0.2, 0.15, 0.1, 0.07][level.shack];   // seconds between bottles to the shelf
  const ORDER = [[1, 4], [2, 6], [4, 10], [6, 15], [8, 20], [10, 28]];
  const STORE_LOOK = [
    { name: 'GENERAL STORE', awning: '#d9644a' }, { name: 'MARKET', awning: '#3d7cc9' },
    { name: 'BIG MARKET', awning: '#2f9d8f' }, { name: 'SUPERSTORE', awning: '#c9a227' },
    { name: 'MEGASTORE', awning: '#8a5bc4' }, { name: 'FLAGSHIP STORE', awning: '#2b2a22' },
  ];
  const unitPrice = kind => Math.round((PRICE[kind] + level.price + (kind === 'plank' ? [0, 4, 8][level.kiln] : 0)) * rMarket());
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
    sapbot: { cap: [8, 12, 18, 26], speed: [130, 160, 195, 230], step: 0.1 },        // uses the Sap Tapper's level
  };

  let W = 0, H = 0, Wc = 0, Hc = 0, DPR = 1;   // W/H: view size in world-zoomed px; Wc/Hc: real CSS px
  const cam = { x: 0, y: 0 };

  const player = { x: CX - 100, y: CY + 110, vx: 0, vy: 0, r: 16, face: 1, walk: 0, swing: 0 };
  const carried = { wood: 0, oak: 0, redwood: 0, sap: 0 };
  const stock = { wood: 0, oak: 0, plank: 0, syrup: 0 };   // store shelves
  const wh = { wood: 0, oak: 0, redwood: 0 };              // warehouse racks
  const pallet = { wood: 0, oak: 0, redwood: 0 };
  const saw = { q: { wood: 0, oak: 0, redwood: 0 }, out: 0, t: 0, chips: 0 };
  const shack = { sap: 0, out: 0, t: 0, coal: 0, coalUse: 0 };
  const pileAmt = { store: 0, dock: 0, showroom: 0, rail: 0, harbor: 0, village: 0 };
  const workshop = { planks: 0, chair: 0, table: 0, t: 0 };   // planks in, finished pieces waiting
  const showroom = { chair: 0, table: 0 };
  const car = { state: 'away', t: 6, y: 0, want: 0, got: 0, owed: 0, color: '#3d7cc9' };
  const train = { state: 'away', t: 10, x: 0, order: null, got: null, idle: 0 };
  const drone = { x: 0, y: 0, state: 'idle', target: null, load: 0, face: 1, bounce: 0, walk: 0, t: 0 };
  const gen = { fuel: 0, t: 0, pellets: 0, pt: 0 };                // generator: chips as fuel, pellets pressed
  const mill = { chips: 0, water: 0, out: 0, t: 0 };                // paper mill
  const coalKiln = { oak: 0, out: 0, t: 0 };                        // charcoal kiln
  let vans = [];
  const stats = { earned: 0, sold: {}, goal: 0, contractsDone: 0 };
  let contract = null;                                              // { kind, need, have, time, reward }
  let ratePerMin = 0;
  // player-controlled logistics settings (Dispatch Office)
  const dispatch = { reserve: { wood: 0, oak: 0, redwood: 0 }, bots: 'any', trucks: 'redwood', yard: 'mixed',
    saw: 'best', planks: 'mixed', oak: 'shelf', coal: 'shack' };
  const RESERVE_STEPS = [0, 50, 100, 200, 400, 800];
  const keep = kind => level.dispatch ? (dispatch.reserve[kind] || 0) : 0;   // logs held back in the warehouse for big orders
  const spare = kind => Math.max(0, wh[kind] - keep(kind));                // what local uses may take
  const SAW_ORDER = { best: ['redwood', 'oak', 'wood'], nopine: ['redwood', 'oak'], wood: ['wood'], oak: ['oak'], redwood: ['redwood'] };
  let kilnPend = 0;
  // oak is held for the charcoal kiln while it's hungry ("Oak goes first to: Charcoal kiln")
  const kilnHungry = () => level.charcoal && dispatch.oak === 'kiln' && coalKiln.oak + kilnPend < kilnInCap() * 0.66;
  const sawKinds = () => (SAW_ORDER[dispatch.saw] || SAW_ORDER.best).filter(k => k !== 'oak' || !kilnHungry());
  const shelfLimit = kind => {
    if (kind !== 'oak' || !level.charcoal) return shelfCap();
    if (dispatch.oak === 'even') return Math.ceil(shelfCap() / 2);
    return kilnHungry() ? 0 : shelfCap();
  };
  const plankHold = () => ({ village: 30, export: 40 })[dispatch.planks] || 0;   // planks kept at the sawmill for vans / exports
  const coalHold = () => ({ even: 20, export: 45 })[dispatch.coal] || 0;          // charcoal kept at the kiln for exports
  let research = null;                                              // { id, t, total } while the lab works
  const vstock = { wood: 0, plank: 0, syrup: 0, chair: 0 };         // village store shelves
  const builder = { planks: 0, redwood: 0 };
  let houses = [];                                                  // { state: 'empty'|'building'|'done', p, color }
  let villagers = [];
  const ship = { state: 'away', t: 20, x: 0, order: null, got: null, idle: 0 };
  const income = [];                                          // [time, amount] for the $/min chip
  const pendingV = { wood: 0, plank: 0, syrup: 0, chair: 0 };
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
  const timers = { kilnPull: 0, drop: 0, sawDrop: 0, shackDrop: 0, collect: 0, pay: 0, refill: 0, full: 0, saw: 0, sawPull: 0, syrup: 0, ws: 0, rate: 0 };
  const tileState = { id: null, wait: 0, lock: null };

  const palletCount = () => [1, 2, 4, 6][level.palletyard];
  // demand from built machines vs what a fuelled generator supplies
  function powerDemand() {
    return (level.sawmill ? 20 : 0) + (level.workshop ? 20 : 0) + (level.papermill ? 40 : 0) + (level.conveyor ? 10 : 0);
  }
  const powerRatio = () => {
    const d = powerDemand();
    if (!level.generator || gen.fuel <= 0 || !d) return 0;
    return Math.min(1, genCap() / d);
  };
  const boost = () => 1 + 0.5 * powerRatio();                      // up to +50% speed with full power
  const sawIn = () => saw.q.wood + saw.q.oak + saw.q.redwood;
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

  function seeded(seed) {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  const inTown = (x, y) => (x > CX - 1080 && x < CX + 1160 && y > CY - 720 && y < CY + 1160) ||
    (x > CX - 1080 && x < CX + 200 && y >= CY + 1160 && y < CY + 1400) ||
    (x > CX - 1520 && x <= CX - 1080 && y > CY - 420 && y < CY + 520);
  const inRectXY = (r, x, y, m = 0) => x > r.x0 - m && x < r.x1 + m && y > r.y0 - m && y < r.y1 + m;
  const offLimits = (x, y) => inTown(x, y) || (x > SEA.x0 - 40 && y < SEA.y1 + 60) || Object.values(DISTRICTS).some(d => inRectXY(d, x, y, 70)) ||
    ROADS.some(r => inRectXY(r, x, y, 40));

  function makeDecor() {
    const rnd = seeded(7);
    decor = [];
    const n = Math.round(WORLD_W * WORLD_H / 9000);
    for (let i = 0; i < n; i++) {
      const x = rnd() * WORLD_W, y = rnd() * WORLD_H, kind = rnd() < 0.8 ? 'tuft' : 'flower', hue = rnd();
      if (x > WH.x0 - 10 && x < WH.x1 + 10 && y > WH.y0 && y < WH.y1 + 10) continue;
      if (Math.abs(x - LEAVE_X) < 120 && y > CY) continue;
      if (x > SEA.x0 - 10 && y < SEA.y1 + 12) continue;
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
  function yardSpecies(i) {
    if (level.dispatch && dispatch.yard === 'pine') return 'pine';
    if (level.dispatch && dispatch.yard === 'oak') return 'oak';
    return Math.floor(i / YARD.cols) % 2 ? 'oak' : 'pine';
  }
  // switch the yard over; standing trees are replanted with the new kind straight away
  function applyYardMix() {
    for (const n of nodes) {
      if (!n.farm || n.reserve || n.yi === undefined) continue;
      const species = yardSpecies(n.yi), sp = SPECIES[species];
      if (n.species === species) continue;
      n.species = species; n.r = sp.r; n.max = sp.hp; n.hp = n.hp > 0 ? sp.hp : 0; n.shake = 1;
    }
  }
  function ensureYard() {
    const have = nodes.filter(n => n.farm && !n.reserve).length;
    for (let i = have; i < yardSpots(); i++) {
      const row = Math.floor(i / YARD.cols), col = i % YARD.cols;
      const species = yardSpecies(i), sp = SPECIES[species];
      nodes.push({ type: 'tree', species, farm: true, yi: i, x: YARD.x + (col - (YARD.cols - 1) / 2) * YARD.gap + (row % 2) * 18,
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
    if (R3) R3.resize();
  }

  const toScreen = (x, y) => view3d() ? R3.project(x, y) : [x - cam.x, y * TILT - cam.y];

  function camTarget() {
    const pad = 40;
    const fw = WORLD_W, fh = WORLD_H * TILT;
    const tx = player.x - W / 2, ty = player.y * TILT - H * 0.55;
    const cx = fw + pad * 2 <= W ? (fw - W) / 2 : Math.max(-pad, Math.min(fw - W + pad, tx));
    const cy = fh + pad * 2 <= H ? (fh - H) / 2 : Math.max(-pad - 220, Math.min(fh - H + pad, ty));   // extra room up top so ships at sea show
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
    for (const R of ROOFED) if (builtR(R)) boxes.push(...wallBoxes(R.B, R.door || 70));
    boxes.push({ x: (SEA.x0 + WORLD_W) / 2, front: SEA.y1, w: WORLD_W - SEA.x0, d: SEA.y1 });
    houses.forEach((h, i) => { if (h.state !== 'empty') boxes.push(HOUSE_SPOTS[i]); });
    if (level.showroom) boxes.push(SHOWROOM);
    if (level.annex) {
      const cxa = (ANNEX.x0 + ANNEX.x1) / 2, wa = ANNEX.x1 - ANNEX.x0;
      boxes.push({ x: cxa, front: ANNEX.y0 + 14, w: wa, d: 14 });
      boxes.push({ x: ANNEX.x0 + 7, front: ANNEX.y1, w: 14, d: ANNEX.y1 - ANNEX.y0 });
      boxes.push({ x: ANNEX.x1 - 7, front: ANNEX.y1, w: 14, d: ANNEX.y1 - ANNEX.y0 });
      for (const ry of RACKS) boxes.push({ x: RACK.x + ANNEX_DX, front: ry, w: RACK.w, d: RACK.d });
    }
    if (level.pump) boxes.push(PUMP);
    if (level.charcoal) boxes.push(KILN);
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
    stats.earned += total;
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
      const dir = player.x <= n.x ? 1 : -1;
      fx.push({ type: 'fall', x: n.x, y: n.y + 0.1, species: n.species, size: n.size, dir, t: 0, life: 1.1 });
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
    const amt = n.type === 'maple' ? perHit() + level.buckets : perHit() * SPECIES[n.species].mult;
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
    for (let i = haulers.filter(h => h.id === 'sapbot').length; i < level.sapbots; i++) {
      haulers.push({ id: 'sapbot', idx: i, x: SHACK_IN.x + 40 + i * 30, y: SHACK_IN.y + 60, state: 'idle', load: [], t: 0, face: 1, walk: 0, bounce: 0, target: null });
    }
  }
  const bedOf = e => {
    const [x, y] = toScreen(e.x, e.y);
    if (e.id === 'sapbot') return [x - 8 * e.face, y - 24 - Math.min(e.load.length, 8) * 4];
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
      const spd = st.speed[lv] * rEng(), cap = st.cap[lv];
      b.t += dt;
      if (b.state === 'seek') {
        if (b.load.length >= cap) { b.state = 'return'; continue; }
        if (!b.target || b.target.hp <= 0) {
          // nearest standing tree no other machine is on; the truck heads for redwoods first
          const want = st.big ? dispatch.trucks : dispatch.bots;
          const pick = strict => {
            let best = null, bd = Infinity;
            for (const n of nodes) {
              if (n.type !== 'tree' || n.hp <= 0 || bots.some(o => o !== b && o.target === n)) continue;
              if (!st.big && n.species === 'redwood') continue;
              const sp = n.species === 'pine' ? 'wood' : n.species;
              if (strict && level.dispatch && want !== 'any' && sp !== want) continue;
              const d = Math.hypot(n.x - b.x, n.y - b.y);
              if (d < bd) { bd = d; best = n; }
            }
            return best;
          };
          b.target = pick(true) || pick(false);
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
      const st = HAULER_STATS[h.id], lv = h.id === 'porter' ? 0 : level[h.id === 'sapbot' ? 'tapper' : h.id] - 1;
      const spd = st.speed[lv] * rEng(), cap = st.cap[lv];
      st.stepNow = st.step / (h.id === 'forklift' ? rLog() : 1);
      h.t += dt;
      if (h.id === 'tapper' || h.id === 'sapbot') { if (h.id === 'sapbot') h.bounce += dt * 12; updateTapper(h, st, spd, cap, dt); continue; }
      const onPallet = sum(pallet);
      if (h.state === 'idle') {
        if (onPallet > 0) h.state = 'toPallet';
        else moveEntity(h, WH_IN.x - (h.id === 'forklift' ? 70 + (h.idx || 0) * 50 : 0), WH_IN.y + 40, spd, dt);
      } else if (h.state === 'toPallet') {
        const pspot = PALLETS[(h.idx || 0) % palletCount()];
        if (moveEntity(h, pspot.x - (h.id === 'forklift' ? 40 : 0), pspot.y + 30, spd, dt) < 2) { h.state = 'load'; h.t = 0; }
      } else if (h.state === 'load') {
        if (h.t >= st.stepNow) {
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
      const target = nodes.filter(n => n.type === 'maple' && n.sap >= 1 && !haulers.some(o => o !== h && o.target === n && o.state === 'toMaple'))
        .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if (target) { h.target = target; h.state = 'toMaple'; }
      else if (h.load.length) h.state = 'toShack';
      else moveEntity(h, SHACK_IN.x - 60 + (h.id === 'sapbot' ? 100 + h.idx * 34 : 0), SHACK_IN.y + 40, spd, dt);
    } else if (h.state === 'toMaple') {
      const n = h.target;
      if (!n || n.sap < 1) { h.state = 'idle'; return; }
      if (moveEntity(h, n.x - 26, n.y + 10, spd, dt) < 2) {
        const amt = Math.min(cap - h.load.length, 1 + level.tools + level.buckets);
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
        if (shack.sap + pending.shack >= shackCap()) return;
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
          src[kind]--; truck.got[kind]++; noteSale(kind);
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
      if (level.shack && shack.sap + pending.shack < shackCap()) { pending.shack++; return 'shack'; }
      return null;
    }
    const palletRoom = level.warehouse && sum(pallet) + sum(pending.pallet) < palletCap();
    if (palletRoom && keep(kind) && wh[kind] + pallet[kind] + pending.pallet[kind] < keep(kind)) { pending.pallet[kind]++; return 'pallet'; }
    if (kind !== 'redwood' && stock[kind] + pending.shelf[kind] < shelfLimit(kind)) { pending.shelf[kind]++; return 'shelf'; }
    if (level.sawmill && sawKinds().includes(kind) && sawIn() + pending.saw < sawCap()) { pending.saw++; return 'saw'; }
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
      if (spare(kind) <= 0 || stock[kind] + pending.shelf[kind] >= shelfLimit(kind)) continue;
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
          timers.refill = BELT_GAP[level.conveyor] / boost();
        } else {
          fly(kind, whSpot, () => shelfSpot(kind), 0.9, () => { pending.shelf[kind]--; stock[kind]++; }, 100);
          timers.refill = 0.9;
        }
      }
    }
    const beltSpeed = BELT_SPEED[level.conveyor] * boost(), beltLen = BELT.x1 - BELT.x0;
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
          stock[c.kind]--; noteSale(c.kind);
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

    // group tiles: stand on one to open its panel
    const here = GROUPS.find(g => inRect(g, TILE_SIZE, TILE_SIZE));
    if ((here ? here.id : null) !== tileState.id) {
      tileState.id = here ? here.id : null;
      openPanel(here);
    }
  }

  const canBuy = u => level[u.id] < u.costs.length && !(u.needs && !level[u.needs]) && !(u.research && research);
  function buy(id) {
    const u = UPGRADES.find(x => x.id === id);
    if (!u || !canBuy(u)) return;
    const cost = u.costs[level[u.id]];
    if (cash < cost) return;
    cash -= cost;
    if (u.research) {
      research = { id: u.id, t: 0, total: u.research[level[u.id]] };
      updateHud('cash');
      popText(LAB.x, LAB.front, 120, `Researching ${u.name}…`, '#cfe6ff');
      bumps.lab = performance.now();
      save(true); renderPanel();
      return;
    }
    level[u.id]++;
    updateHud('cash');
    const g = GROUPS.find(x => x.id === u.group);
    for (let i = 0; i < 10; i++) fly('cash', playerChest, toScreen(g.x, g.y), 0.25 + i * 0.03, null, 30);
    popText(g.x, g.y, 50, u.hire && level[u.id] === 1 ? `${u.name} ready!` : `${u.name} Lv ${level[u.id]}!`, '#fff3a6');
    for (let i = 0; i < 16; i++) {
      fx.push({ type: 'chip', kind: 'spark', x: g.x, y: g.y, h: 4, vx: (Math.random() - 0.5) * 260,
                vy: (Math.random() - 0.5) * 160, vh: 120 + Math.random() * 140, t: 0, life: 0.9 });
    }
    const RB = ROOFED.find(r => r.ids.includes(u.id));
    if (RB) bumps[RB.key] = performance.now();
    if (u.group === 'store') bumps.store = performance.now();
    afterUpgrade();
    save(true);
    renderPanel();
  }

  let panelGroup = null, panelKey = '';
  function openPanel(g) {
    panelGroup = g;
    ui.panel.hidden = !g;
    ui.goals.hidden = !!g;
    if (g) { ui.panelTitle.textContent = g.name; panelKey = ''; renderPanel(); hint.style.opacity = 0; }
  }
  function renderPanel() {
    if (!panelGroup) return;
    const items = UPGRADES.filter(u => u.group === panelGroup.id);
    // only rebuild when something visible changed, so buttons don't flicker under a finger
    const key = items.map(u => level[u.id] + (cash >= (u.costs[level[u.id]] ?? Infinity) ? 'y' : 'n')).join('|') +
      (panelGroup.id === 'dispatch' ? JSON.stringify(dispatch) + LOGS.map(k => Math.floor(wh[k] / 10) + ':' + stock[k]).join() : '') +
      (research ? research.id + Math.ceil(research.total - research.t) : '');
    if (key === panelKey) return;
    panelKey = key;
    const controls = panelGroup.id === 'dispatch' && level.dispatch ? dispatchControls() : '';
    ui.panelList.innerHTML = controls + items.map(u => {
      const lv = level[u.id], max = lv >= u.costs.length, blocked = u.needs && !level[u.needs];
      const cost = u.costs[lv];
      const dots = u.costs.length > 1 ? `<span class="dots">${u.costs.map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>` : '';
      const title = max ? u.name : lv === 0 && u.hire ? u.hire : u.name;
      const busy = research && u.research;
      const note = max ? 'Fully upgraded' : blocked ? `Needs ${NAMES[u.needs]}`
        : busy && research.id === u.id ? `Researching… ${Math.ceil(research.total - research.t)}s left`
        : busy ? 'Lab is busy with another project' : upgradeNote(u, lv) + (u.research ? ` · takes ${u.research[lv]}s` : '');
      const btn = max ? '<span class="maxed">MAX</span>'
        : blocked ? '<span class="locked">Locked</span>'
        : busy && research.id === u.id ? `<span class="maxed">${Math.round(research.t / research.total * 100)}%</span>`
        : busy ? '<span class="locked">Busy</span>'
        : `<button type="button" data-buy="${u.id}" ${cash < cost ? 'disabled' : ''}>$${cost.toLocaleString()}</button>`;
      return `<div class="up${max ? ' done' : ''}"><div class="up-text"><div class="up-name">${title}${dots}</div><div class="up-note">${note}</div></div>${btn}</div>`;
    }).join('');
  }
  function updatePanel(dt) {
    timers.panel = (timers.panel || 0) - dt;
    if (panelGroup && timers.panel <= 0) { timers.panel = 0.2; renderPanel(); }
  }
  ui.panelList.addEventListener('click', e => {
    const b = e.target.closest('[data-buy]');
    if (b) buy(b.dataset.buy);
    const c = e.target.closest('[data-set]');
    if (c) {
      const [group, key] = c.dataset.set.split('.'), val = c.dataset.val;
      if (key) dispatch[group][key] = Number(val); else dispatch[group] = val;
      if (group === 'yard') applyYardMix();
      for (const bt of bots) bt.target = null;     // bots re-pick with the new orders
      bumps.dispatch = performance.now();
      panelKey = ''; renderPanel(); save(true);
    }
  });

  const seg = (set, options, current) => `<div class="seg">${options.map(([val, label]) =>
    `<button type="button" data-set="${set}" data-val="${val}" class="${String(current) === String(val) ? 'on' : ''}">${label}</button>`).join('')}</div>`;
  function dispatchControls() {
    const name = { wood: 'Pine', oak: 'Oak', redwood: 'Redwood' };
    const rows = LOGS.map(k => {
      const r = dispatch.reserve[k], low = r && wh[k] < r;
      return `<div class="ctl"><div class="ctl-head"><b>${name[k]}</b><span class="${low ? 'warn' : ''}">Warehouse ${wh[k]}${r ? ` / keep ${r}` : ''}${k !== 'redwood' ? ` · shelf ${stock[k]}` : ''}</span></div>` +
        seg(`reserve.${k}`, RESERVE_STEPS.map(v => [v, v || 'None']), r) + '</div>';
    }).join('');
    return `<div class="ctl-sec"><h3>Keep for big orders</h3><p>New logs top up this amount in the warehouse first. Shelves, the sawmill and village vans only use what's above it. Trucks, trains and ships can use all of it.</p>${rows}</div>` +
      `<div class="ctl-sec"><h3>Lumber bots chop</h3>${seg('bots', [['any', 'Nearest'], ['wood', 'Pine'], ['oak', 'Oak']], dispatch.bots)}` +
      `<h3>Logging trucks chop</h3>${seg('trucks', [['redwood', 'Redwood'], ['any', 'Nearest'], ['wood', 'Pine'], ['oak', 'Oak']], dispatch.trucks)}` +
      `<p>If none of that kind is left standing, they chop the nearest tree.</p></div>` +
      `<div class="ctl-sec"><h3>Tree Yard grows</h3>${seg('yard', [['pine', 'All pine'], ['mixed', 'Half & half'], ['oak', 'All oak']], dispatch.yard)}</div>` +
      (level.sawmill ? `<div class="ctl-sec"><h3>Sawmill cuts</h3>${seg('saw', [['best', 'Best'], ['nopine', 'No pine'], ['wood', 'Pine'], ['oak', 'Oak'], ['redwood', 'Redwood']], dispatch.saw)}` +
        `<p>Which logs it pulls from the warehouse. Best = redwood, then oak, then pine.</p>` +
        `<h3>Planks go first to</h3>${seg('planks', [['mixed', 'Mixed'], ['shelf', 'Shelf'], ['workshop', 'Workshop'], ['village', 'Village'], ['export', 'Exports']], dispatch.planks)}` +
        `<p>Village keeps 30 planks at the sawmill for vans. Exports keeps 40 for trucks, trains and ships. Sawmill has ${saw.out} planks.</p></div>` : '') +
      (level.charcoal ? `<div class="ctl-sec"><h3>Oak goes first to</h3>${seg('oak', [['shelf', 'Shelf'], ['even', 'Even'], ['kiln', 'Charcoal kiln']], dispatch.oak)}` +
        `<p>Charcoal kiln holds oak off the shelf and sawmill until the kiln is ⅔ full. Kiln has ${coalKiln.oak} / ${kilnInCap()} oak.</p>` +
        `<h3>Charcoal goes first to</h3>${seg('coal', [['shack', 'Syrup shack'], ['even', 'Even'], ['export', 'Exports']], dispatch.coal)}` +
        `<p>Even keeps 20 at the kiln for exports, Exports keeps 45. Kiln has ${coalKiln.out} charcoal.</p></div>` : '');
  }

  function afterUpgrade() {
    ensureBots(); ensureYard(); ensureHaulers(); ensureVans(); ensureHouses();
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
    if (level.warehouse && sawIn() + pending.saw < Math.min(feedLow(), sawCap()) && timers.sawPull <= 0) {
      const kind = sawKinds().find(k => spare(k) > 0);
      if (kind) {
        timers.sawPull = feedGap();
        wh[kind]--; pending.saw++;
        fly(kind, whSpot, sawInSpot, level.sawfeed ? 0.8 : 1.2, () => { pending.saw--; saw.q[kind]++; }, 160);
      }
    }
    // cutting: redwood first (4 planks), then oak (2), then pine (1)
    const next = sawKinds().find(k => saw.q[k] > 0) || ['redwood', 'oak', 'wood'].find(k => saw.q[k] > 0);
    if (next && saw.out < sawOutCap()) {
      saw.t += dt;
      if (saw.t >= sawTime() / boost() / rSaw()) { saw.t = 0; saw.q[next]--; saw.out += PLANKS_PER[next]; saw.chips = Math.min(CHIP_CAP, saw.chips + PLANKS_PER[next]); }
    } else saw.t = 0;
    timers.saw -= dt;
    if (saw.out > plankHold() && timers.saw <= 0) {
      const wsRoom = level.workshop ? WS_CAP - workshop.planks - pending.ws : 0;
      const shelfRoom = stock.plank + pending.shelf.plank < shelfCap();
      // mixed: the workshop gets first pick while it's low; otherwise the shelf, then the workshop
      const wsFirst = dispatch.planks === 'workshop' ? true : dispatch.planks === 'shelf' ? false : workshop.planks + pending.ws < 12;
      if (wsRoom > 0 && (wsFirst || !shelfRoom)) {
        timers.saw = sawOutGap();
        saw.out--; pending.ws++;
        fly('plank', sawOutSpot, wsInSpot, 1.4, () => { pending.ws--; workshop.planks++; }, 240);
      } else if (shelfRoom) {
        timers.saw = sawOutGap();
        saw.out--; pending.shelf.plank++;
        fly('plank', sawOutSpot, () => shelfSpot('plank'), 0.7, () => { pending.shelf.plank--; stock.plank++; }, 80);
      }
    }
  }

  function updateShack(dt) {
    if (!level.shack) return;
    timers.shackDrop -= dt;
    if (inRect(SHACK_IN, SHACK_IN.w, SHACK_IN.d) && timers.shackDrop <= 0 && shack.sap + pending.shack < shackCap()) {
      const i = stack.lastIndexOf('sap');
      if (i >= 0) {
        timers.shackDrop = 0.07;
        const from = backTop();
        stack.splice(i, 1); carried.sap--; updateHud();
        pending.shack++;
        fly('sap', from, shackInSpot, 0.35, () => { pending.shack--; shack.sap++; });
      }
    }
    if (shack.sap >= 2 && shack.out < shackOutCap()) {
      shack.t += dt;
      if (shack.t >= boilTime() / (shack.coal > 0 ? 2 : 1)) {
        shack.t = 0; shack.sap -= 2; shack.out++;
        shack.extra = (shack.extra || 0) + evapBonus();
        if (shack.extra >= 1) { shack.extra--; shack.out++; }
        if (shack.coal > 0 && ++shack.coalUse >= 2) { shack.coal--; shack.coalUse = 0; }
      }
    } else shack.t = 0;
    timers.syrup -= dt;
    if (shack.out > 0 && timers.syrup <= 0 && stock.syrup + pending.shelf.syrup < shelfCap()) {
      timers.syrup = syrupGap();
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
      if (workshop.t >= workshopTime() / boost() / rSaw()) {
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
          showroom[k]--; car.got++; car.owed += unitPrice(k); noteSale(k);
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
    paper: [[() => mill, 'out', () => bSpot(MILL)]],
    pellets: [[() => gen, 'pellets', () => bSpot(GEN)]],
    charcoal: [[() => coalKiln, 'out', () => bSpot(KILN)]],
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
        if (level.papermill) want.push(['paper', 16]);
        if (level.pellets) want.push(['pellets', 20]);
        if (level.charcoal) want.push(['charcoal', 20]);
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
          src[0]()[src[1]]--; train.got[k]++; train.idle = 0; noteSale(k);
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

  const bSpot = B => { const [x, y] = toScreen(B.x, B.front); return [x, y - 40]; };

  function updateIndustry(dt) {
    // generator burns chips in proportion to how much power is being drawn
    if (level.generator && gen.fuel > 0) {
      const load = Math.min(1, powerDemand() / genCap()) || 0.1;
      gen.t += dt * load;
      if (gen.t >= genBurn()) { gen.t = 0; gen.fuel--; }
    }
    // pellet press turns spare fuel into pellets
    if (level.pellets && gen.fuel > 40 && gen.pellets < OUT_CAP) {
      gen.pt += dt;
      if (gen.pt >= pelletTime()) { gen.pt = 0; gen.fuel -= 2; gen.pellets++; }
    }
    // the pump fills the paper mill's water tank through a pipe
    if (level.pump && level.papermill) mill.water = Math.min(WATER_CAP, mill.water + pumpRate() * dt);
    // paper mill: 2 chips + 1 water → 1 ream, only with power
    const pr = powerRatio();
    if (level.papermill && pr > 0 && mill.chips >= 2 && mill.water >= 1 && mill.out < OUT_CAP) {
      mill.t += dt * pr;
      if (mill.t >= paperTime()) { mill.t = 0; mill.chips -= 2; mill.water -= 1; mill.out++; }
    }
    // oak feeder: the kiln pulls oak straight from the warehouse
    timers.kilnPull -= dt;
    if (level.kilnfeed && level.charcoal && level.warehouse && timers.kilnPull <= 0 && spare('oak') > 0 && coalKiln.oak + kilnPend < kilnInCap()) {
      timers.kilnPull = kilnGap();
      wh.oak--; kilnPend++;
      fly('oak', whSpot, () => bSpot(KILN), 1.6, () => { kilnPend--; coalKiln.oak = Math.min(kilnInCap(), coalKiln.oak + 1); }, 220);
    }
    // charcoal kiln: 1 oak → 2 charcoal
    if (level.charcoal && coalKiln.oak > 0 && coalKiln.out < coalOutCap() - 1) {
      coalKiln.t += dt;
      if (coalKiln.t >= coalTime()) { coalKiln.t = 0; coalKiln.oak--; coalKiln.out += 2; }
    }
  }

  function updateResearch(dt) {
    if (!research) return;
    research.t += dt;
    if (research.t >= research.total) {
      const u = UPGRADES.find(x => x.id === research.id);
      level[u.id]++;
      research = null;
      toast(`Research done: ${u.name} Lv ${level[u.id]}`);
      bumps.lab = performance.now();
      save(true);
    }
  }

  // Cargo ships sail in along the coast, load a big mixed order and pay 3×.
  function updateShip(dt) {
    if (!level.harbor) return;
    const park = SHIP.x, out = WORLD_W + 700;
    if (ship.state === 'away') {
      ship.t -= dt;
      if (ship.t <= 0) {
        const size = 1.5 + level.shipping * 0.8;
        const want = [];
        if (level.sawmill) want.push(['plank', 40]);
        if (level.workshop) want.push(['chair', 8], ['table', 5]);
        if (level.papermill) want.push(['paper', 25]);
        if (level.shack) want.push(['syrup', 15]);
        if (level.truck || level.reserve) want.push(['redwood', 15]);
        if (level.pellets) want.push(['pellets', 25]);
        if (level.charcoal) want.push(['charcoal', 25]);
        if (!want.length) want.push(['wood', 80]);
        ship.order = {}; ship.got = {};
        for (const [k, n] of want) { ship.order[k] = Math.max(1, Math.round(n * size * (0.7 + Math.random() * 0.6))); ship.got[k] = 0; }
        ship.state = 'arrive'; ship.x = out; ship.idle = 0;
      }
    } else if (ship.state === 'arrive') {
      ship.x = Math.max(park, ship.x - 300 * dt);
      if (ship.x <= park) { ship.state = 'load'; ship.t = 0; }
    } else if (ship.state === 'load') {
      ship.t += dt; ship.idle += dt;
      if (ship.t >= craneStep()) {
        ship.t = 0;
        for (const k in ship.order) {
          if (ship.got[k] >= ship.order[k]) continue;
          const src = (TRAIN_SRC[k] || TRAIN_SRC.wood).find(([o, f]) => o()[f] > 0);
          if (!src) continue;
          src[0]()[src[1]]--; ship.got[k]++; ship.idle = 0; noteSale(k);
          fly(k, src[2], shipSpot, 1.1, null, 200);
          break;
        }
        const done = Object.keys(ship.order).every(k => ship.got[k] >= ship.order[k]);
        if (done || ship.idle > 50) {
          const total = Math.round(Object.keys(ship.got).reduce((a, k) => a + ship.got[k] * unitPrice(k), 0) * 3);
          if (total) {
            popText(SHIP.x, SHIP.y + 150, 120, done ? `Export paid $${total.toLocaleString()}` : `Part cargo $${total.toLocaleString()}`, '#c9f2c9');
            payBills(shipSpot, 'harbor', total);
            stats.ships = (stats.ships || 0) + 1;
          }
          ship.state = 'leave';
        }
      }
    } else if (ship.state === 'leave') {
      ship.x += 300 * dt;
      if (ship.x >= out) { ship.state = 'away'; ship.t = shipEvery(); }
    }
  }
  const shipSpot = () => { const [x, y] = toScreen(ship.x, SHIP.y); return [x - 40, y - 70]; };

  // Builder's yard: when planks and redwood are in stock, a house goes up on the next empty plot.
  function ensureHouses() {
    while (houses.length < houseSlots()) {
      const colors = ['#d9644a', '#3d7cc9', '#2f9d8f', '#8a5bc4', '#c9a227', '#5f6b7a'];
      houses.push({ state: 'empty', p: 0, color: colors[houses.length % colors.length], wall: ['#f2ece0', '#e9d8b4', '#dfe8ec', '#f0dcc8'][houses.length % 4] });
    }
  }
  const doneHouses = () => houses.filter(h => h.state === 'done').length;
  function updateBuilder(dt) {
    if (!level.builder) return;
    const at = houses.filter(h => h.state === 'building');
    for (const h of at) {
      h.p += dt / buildTime();
      if (h.p >= 1) {
        h.state = 'done'; h.p = 1;
        const spot = HOUSE_SPOTS[houses.indexOf(h)];
        bumps['house' + houses.indexOf(h)] = performance.now();
        popText(spot.x, spot.front, 110, 'New house!', '#fff3a6');
        toast('A new family moved into Pine Village');
      }
    }
    const crews = 1 + (level.crew >= 2 ? 1 : 0);
    if (at.length < crews && builder.planks >= HOUSE_PLANKS && builder.redwood >= HOUSE_REDWOOD) {
      const next = houses.find(h => h.state === 'empty');
      if (next) { builder.planks -= HOUSE_PLANKS; builder.redwood -= HOUSE_REDWOOD; next.state = 'building'; next.p = 0; }
    }
    // every finished house pays rent
    timers.rent = (timers.rent || 30) - dt;
    if (timers.rent <= 0) {
      timers.rent = 30;
      const n = doneHouses();
      if (n) payBills(() => { const [x, y] = toScreen(VILLAGE_GATE.x, VILLAGE_GATE.y); return [x, y - 40]; }, 'village', n * 40);
    }
  }

  // Villagers walk from home into the village store, buy at the counter, and walk back.
  const VKINDS = [['wood', 3], ['plank', 3], ['syrup', 2], ['chair', 1]];
  function ensureVillagers() {
    const want = level.vstore ? Math.min(34, 2 + doneHouses() * 2) : 0;
    while (villagers.length < want) {
      const i = villagers.length, home = homeOf(i);
      villagers.push({ i, x: home.x, y: home.y, state: 'home', t: 2 + Math.random() * 8, walk: 0, face: 1, bounce: 0, slot: -1,
        skin: SKINS[i % SKINS.length], shirt: SHIRTS[(i * 3) % SHIRTS.length], hair: HAIR[(i * 2) % HAIR.length] });
    }
  }
  function homeOf(i) {
    const done = houses.map((h, k) => h.state === 'done' ? k : -1).filter(k => k >= 0);
    if (!done.length) return { x: VILLAGE_GATE.x + (i % 3) * 20, y: VILLAGE_GATE.y };
    const spot = HOUSE_SPOTS[done[i % done.length]];
    return { x: spot.x, y: spot.front + 24 };
  }
  const counterSpot = slot => ({ x: VSTORE.x - 60 + slot * 50, y: VSTORE.front - 42 });
  const vShelfSpot = k => () => { const [x, y] = toScreen(VSTORE.x - 80 + ['wood', 'plank', 'syrup', 'chair'].indexOf(k) * 54, VSTORE.front - VSTORE.d); return [x, y - 30]; };
  function updateVillagers(dt) {
    if (!level.vstore) return;
    const door = { x: VSTORE.x, y: VSTORE.front + 22 };
    for (const v of villagers) {
      v.t -= dt;
      if (v.state === 'home') {
        const h = homeOf(v.i);
        moveEntity(v, h.x, h.y, 90, dt);
        if (v.t <= 0) v.state = 'toDoor';
      } else if (v.state === 'toDoor') {
        if (moveEntity(v, door.x + (v.i % 5 - 2) * 14, door.y + 10 + (v.i % 3) * 10, 100, dt) < 3) {
          const used = villagers.filter(o => o.slot >= 0).map(o => o.slot);
          const free = [0, 1, 2].find(k => !used.includes(k));
          if (free !== undefined) { v.slot = free; v.state = 'toCounter'; }
        }
      } else if (v.state === 'toCounter') {
        const c = counterSpot(v.slot);
        // through the door first, then inside to the counter
        if (!v.inside) { if (moveEntity(v, door.x, door.y, 100, dt) < 3) v.inside = true; }
        else if (moveEntity(v, c.x, c.y, 100, dt) < 3) {
          const opts = VKINDS.filter(([k]) => vstock[k] > 0);
          if (opts.length) {
            let r = Math.random() * opts.reduce((a, o) => a + o[1], 0);
            v.kind = opts.find(o => (r -= o[1]) < 0)[0];
          } else v.kind = null;
          v.want = 1 + Math.floor(Math.random() * (2 + level.vstore * 2));
          v.got = 0; v.owed = 0; v.state = 'buy'; v.t = 0; v.wait = 0;
        }
      } else if (v.state === 'buy') {
        v.face = -1;
        if (v.kind && v.got < v.want && vstock[v.kind] > 0) {
          if (v.t <= 0) {
            v.t = 0.45; vstock[v.kind]--; v.got++; v.owed += Math.round(unitPrice(v.kind) * 1.2); noteSale(v.kind);
            fly(v.kind, vShelfSpot(v.kind), () => { const [x, y] = toScreen(v.x, v.y); return [x, y - 40]; }, 0.35, null, 30);
          }
        } else v.wait += dt;
        if ((v.kind && v.got >= v.want) || v.wait > 5 || !v.kind) {
          if (v.owed) {
            popText(v.x, v.y, 70, `+$${v.owed}`, '#c9f2c9');
            payBills(() => { const [x, y] = toScreen(v.x, v.y); return [x, y - 40]; }, 'village', v.owed);
          }
          v.slot = -1; v.state = 'leave';
        }
      } else if (v.state === 'leave') {
        if (v.inside) { if (moveEntity(v, door.x, door.y, 100, dt) < 3) v.inside = false; }
        else { v.state = 'home'; v.t = 6 + Math.random() * 10; v.got = 0; }
      }
    }
  }

  // ---------- Delivery vans ----------
  // Each route moves one good from a building that has it to a building that needs it.
  // Vans pick the route with the biggest shortfall that no other van is already running.
  const ROUTES = [
    { id: 'fuel', kind: 'chips', from: () => level.sawmill && level.generator, take: () => saw.chips, src: () => ({ x: SAW.x + 64, y: SAW.front + 30 }),
      pick: n => { saw.chips -= n; }, need: () => FUEL_CAP - gen.fuel, dst: () => ({ x: GEN.x, y: GEN.front + 30 }), drop: n => { gen.fuel = Math.min(FUEL_CAP, gen.fuel + n); } },
    { id: 'pulp', kind: 'chips', from: () => level.sawmill && level.papermill, take: () => saw.chips, src: () => ({ x: SAW.x + 64, y: SAW.front + 30 }),
      pick: n => { saw.chips -= n; }, need: () => MILL_CAP - mill.chips, dst: () => ({ x: MILL.x, y: MILL.front + 30 }), drop: n => { mill.chips = Math.min(MILL_CAP, mill.chips + n); } },
    { id: 'oak', kind: 'oak', from: () => level.warehouse && level.charcoal, take: () => spare('oak'), src: () => ({ x: WH_IN.x, y: WH_IN.y + 60 }),
      pick: n => { wh.oak -= n; }, need: () => kilnInCap() - coalKiln.oak, dst: () => ({ x: KILN.x, y: KILN.front + 30 }), drop: n => { coalKiln.oak = Math.min(kilnInCap(), coalKiln.oak + n); } },
    { id: 'coal', kind: 'charcoal', from: () => level.charcoal && level.shack, take: () => Math.max(0, coalKiln.out - coalHold()), src: () => ({ x: KILN.x, y: KILN.front + 30 }),
      pick: n => { coalKiln.out -= n; }, need: () => SHACK_COAL_CAP - shack.coal, dst: () => ({ x: SHACK.x, y: SHACK.front + 30 }), drop: n => { shack.coal = Math.min(SHACK_COAL_CAP, shack.coal + n); } },
  ];
  const vDst = () => ({ x: VSTORE.x, y: VSTORE.front + 30 });
  const vRoute = (id, kind, from, take, pick, src) => ({ id, kind, from: () => level.vstore && from(), take, src, pick,
    need: () => vstoreCap() - vstock[kind], dst: vDst, drop: n => { vstock[kind] = Math.min(vstoreCap(), vstock[kind] + n); } });
  ROUTES.push(
    vRoute('v-wood', 'wood', () => level.warehouse, () => spare('wood'), n => { wh.wood -= n; }, () => ({ x: WH_IN.x, y: WH_IN.y + 60 })),
    vRoute('v-plank', 'plank', () => level.sawmill, () => dispatch.planks === 'export' ? Math.max(0, saw.out - 40) : saw.out, n => { saw.out -= n; }, () => ({ x: SAW.x + 64, y: SAW.front + 30 })),
    vRoute('v-syrup', 'syrup', () => level.shack, () => shack.out, n => { shack.out -= n; }, () => ({ x: SHACK.x, y: SHACK.front + 30 })),
    vRoute('v-chair', 'chair', () => level.workshop, () => workshop.chair, n => { workshop.chair -= n; }, () => ({ x: WORKSHOP.x, y: WORKSHOP.front + 30 })),
    { id: 'b-plank', kind: 'plank', from: () => level.builder && level.sawmill, take: () => dispatch.planks === 'export' ? Math.max(0, saw.out - 40) : saw.out, src: () => ({ x: SAW.x + 64, y: SAW.front + 30 }),
      pick: n => { saw.out -= n; }, need: () => BUILDER_CAP.plank - builder.planks, dst: () => ({ x: BUILDER.x, y: BUILDER.front + 20 }),
      drop: n => { builder.planks = Math.min(BUILDER_CAP.plank, builder.planks + n); } },
    { id: 'b-red', kind: 'redwood', from: () => level.builder && level.warehouse, take: () => spare('redwood'), src: () => ({ x: WH_IN.x, y: WH_IN.y + 60 }),
      pick: n => { wh.redwood -= n; }, need: () => BUILDER_CAP.redwood - builder.redwood, dst: () => ({ x: BUILDER.x, y: BUILDER.front + 20 }),
      drop: n => { builder.redwood = Math.min(BUILDER_CAP.redwood, builder.redwood + n); } },
  );

  function ensureVans() {
    for (let i = vans.length; i < vanCount(); i++) {
      vans.push({ idx: i, x: DEPOT.x - 80 + i * 40, y: DEPOT.front + 30, state: 'idle', route: null, load: 0, face: 1, bounce: 0, walk: 0, t: 0 });
    }
  }
  function updateVans(dt) {
    const spd = vanSpeed(), cap = vanCap();
    for (const v of vans) {
      v.t += dt;
      if (v.state === 'idle') {
        let best = null, bn = 0;
        for (const r of ROUTES) {
          if (!r.from() || vans.some(o => o !== v && o.route === r)) continue;
          const n = Math.min(r.need(), r.take());
          if (n >= 3 && n > bn) { bn = n; best = r; }
        }
        if (best) { v.route = best; v.state = 'toSrc'; }
        else moveEntity(v, DEPOT.x - 80 + v.idx * 40, DEPOT.front + 30, spd, dt);
      } else if (v.state === 'toSrc') {
        const p = v.route.src();
        if (moveEntity(v, p.x, p.y, spd, dt) < 3) {
          const n = Math.min(cap, v.route.take(), v.route.need());
          if (n <= 0) { v.state = 'idle'; v.route = null; continue; }
          v.route.pick(n); v.load = n;
          const [sx, sy] = toScreen(p.x, p.y);
          for (let i = 0; i < Math.min(n, 8); i++) fly(v.route.kind, [sx, sy - 40], () => vanSpot(v), 0.3 + i * 0.04, null, 20);
          v.state = 'toDst';
        }
      } else if (v.state === 'toDst') {
        const p = v.route.dst();
        if (moveEntity(v, p.x, p.y, spd, dt) < 3) {
          const [dx, dy] = toScreen(p.x, p.y);
          for (let i = 0; i < Math.min(v.load, 8); i++) fly(v.route.kind, () => vanSpot(v), [dx, dy - 40], 0.3 + i * 0.04, null, 20);
          v.route.drop(v.load); v.load = 0;
          v.state = 'idle'; v.route = null;
        }
      }
    }
  }
  const vanSpot = v => { const [x, y] = toScreen(v.x, v.y); return [x, y - 34]; };

  // ---------- Contracts and milestones ----------
  const CONTRACT_BASE = { wood: 40, oak: 25, plank: 30, syrup: 15, chair: 6, table: 4, paper: 20, charcoal: 25, pellets: 20 };
  function contractKinds() {
    const k = ['wood', 'oak'];
    if (level.sawmill) k.push('plank');
    if (level.shack) k.push('syrup');
    if (level.showroom || level.rail) { if (level.workshop) k.push('chair', 'table'); }
    if (level.rail) {
      if (level.papermill) k.push('paper');
      if (level.charcoal) k.push('charcoal');
      if (level.pellets) k.push('pellets');
    }
    return k;
  }
  function newContract() {
    const kinds = contractKinds();
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const need = Math.round(CONTRACT_BASE[kind] * (1 + 0.35 * stats.contractsDone) * (1 + level.store * 0.3));
    contract = { kind, need, have: 0, time: 240, reward: Math.round(need * unitPrice(kind) * 3 + 100) };
  }
  function noteSale(kind, n = 1) {
    stats.sold[kind] = (stats.sold[kind] || 0) + n;
    if (contract && contract.kind === kind && contract.time > 0) contract.have += n;
  }
  const MILESTONES = [
    ['Earn your first $100', () => stats.earned >= 100, 50],
    ['Build a Warehouse', () => level.warehouse > 0, 150],
    ['Reach $100/min', () => ratePerMin >= 100, 300],
    ['Build the Sawmill', () => level.sawmill > 0, 300],
    ['Own 3 machines', () => bots.length >= 3, 600],
    ['Buy a land deed', () => level.reserve || level.east || level.rail || level.industry, 1000],
    ['Reach $500/min', () => ratePerMin >= 500, 2000],
    ['Power up the Industrial Park', () => level.generator > 0, 3000],
    ['Run 3 delivery vans', () => vanCount() >= 3, 4000],
    ['Sell 100 reams of paper', () => (stats.sold.paper || 0) >= 100, 6000],
    ['Finish a research project', () => UPGRADES.some(u => u.research && level[u.id] > 0), 6000],
    ['Build your first house', () => houses.some(h => h.state === 'done'), 5000],
    ['Load a cargo ship', () => (stats.ships || 0) >= 1, 8000],
    ['Grow the village to 8 houses', () => doneHouses() >= 8, 20000],
    ['Reach $2,000/min', () => ratePerMin >= 2000, 10000],
    ['Earn $1,000,000 in total', () => stats.earned >= 1e6, 50000],
    ['Reach $10,000/min', () => ratePerMin >= 10000, 100000],
  ];
  function reward(amount, text) {
    cash += amount; updateHud('cash');
    popText(player.x, player.y, 90, `${text} +$${amount.toLocaleString()}`, '#fff3a6');
    toast(`${text} · +$${amount.toLocaleString()}`);
    for (let i = 0; i < 20; i++) {
      fx.push({ type: 'chip', kind: 'spark', x: player.x, y: player.y, h: 30, vx: (Math.random() - 0.5) * 300,
                vy: (Math.random() - 0.5) * 180, vh: 140 + Math.random() * 160, t: 0, life: 1 });
    }
  }
  let toastTimer = 0;
  function toast(text) {
    ui.toast.textContent = text;
    ui.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 3200);
  }
  function updateGoals(dt) {
    if (!contract && stats.earned > 0) newContract();
    if (contract) {
      contract.time -= dt;
      if (contract.have >= contract.need) {
        stats.contractsDone++;
        reward(contract.reward, 'Contract done!');
        contract = null;
      } else if (contract.time <= 0) {
        toast(`Contract expired: ${contract.have}/${contract.need} ${ITEM_NAME[contract.kind].toLowerCase()}`);
        contract = null;
      }
    }
    const m = MILESTONES[stats.goal];
    if (m && m[1]()) { stats.goal++; reward(m[2], m[0]); }
    timers.goalsUi = (timers.goalsUi || 0) - dt;
    if (timers.goalsUi <= 0) { timers.goalsUi = 0.25; renderGoals(); }
  }
  function renderGoals() {
    const c = contract, m = MILESTONES[stats.goal];
    let html = '';
    if (c) {
      const mm = Math.floor(Math.max(0, c.time) / 60), ss = String(Math.floor(Math.max(0, c.time) % 60)).padStart(2, '0');
      html += `<div class="goal-row"><b>Contract</b> Sell ${c.need} ${ITEM_NAME[c.kind].toLowerCase()} · ${Math.min(c.have, c.need)}/${c.need} · ${mm}:${ss} · <span class="rw">$${c.reward.toLocaleString()}</span></div>`;
      html += `<div class="bar"><i style="width:${Math.min(100, c.have / c.need * 100)}%"></i></div>`;
    }
    if (m) html += `<div class="goal-row"><b>Goal</b> ${m[0]} · <span class="rw">$${m[2].toLocaleString()}</span></div>`;
    ui.goals.innerHTML = html;
    ui.goals.hidden = !html || !ui.panel.hidden;
  }

  function updateRate(dt) {
    timers.rate -= dt;
    if (timers.rate > 0) return;
    timers.rate = 1;
    const now = performance.now();
    while (income.length && now - income[0][0] > 60000) income.shift();
    ratePerMin = income.reduce((a, e) => a + e[1], 0);
    ui.rate.textContent = '$' + ratePerMin.toLocaleString() + '/min';
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
        node.grow = Math.min(1, (node.grow || 0) + dt * rGrowth() / (node.reserve ? reserveGrow() : growTime()));
        if (node.grow >= 1) node.hp = node.max;
      }
      if (node.type === 'maple' && node.sap < 1) node.sap = Math.min(1, node.sap + dt * rGrowth() / sapTime());
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
    updateRoofs(dt);
    updateIndustry(dt);
    updateResearch(dt);
    updateShip(dt);
    updateBuilder(dt);
    ensureVillagers();
    updateVillagers(dt);
    updateVans(dt);
    updateGoals(dt);
    updatePanel(dt);

    if (sp > 160) {
      timers.dust = (timers.dust || 0) - dt;
      if (timers.dust <= 0) {
        timers.dust = 0.11;
        fx.push({ type: 'chip', kind: 'dust', x: player.x - player.face * 8, y: player.y + 1, h: 2, vx: -player.vx * 0.15, vy: -player.vy * 0.15, vh: 20, t: 0, life: 0.5 });
      }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt;
      if (f.type === 'fall' && !f.landed && f.t > f.life * 0.55) {
        f.landed = true;
        const len = (f.species === 'redwood' ? 150 : 80) * f.size;
        for (let k = 0; k < 14; k++) {
          fx.push({ type: 'chip', kind: 'dust', x: f.x + f.dir * Math.random() * len, y: f.y + (Math.random() - 0.5) * 20, h: 2,
                    vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 30, vh: 30 + Math.random() * 40, t: 0, life: 0.8 });
        }
      }
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
    groundRect(CX - 440, CY + 1180, 1280, 400, 30); ctx.fill();
    groundRect((ANNEX.x0 + ANNEX.x1) / 2 + 40, CY + 60, ANNEX.x1 - ANNEX.x0 + 160, 840, 30); ctx.fill();
    groundRect(LEAVE_X, (CY + SPAWN_Y) / 2 + 80, 230, SPAWN_Y - CY + 160, 16); ctx.fill();
    ctx.fillStyle = '#bba57a';
    for (const lx of LANES) { groundRect(lx, (CY + SPAWN_Y) / 2 + 80, 26, SPAWN_Y - CY + 160, 8); ctx.fill(); }

    // the sea along the north-east coast, with a sandy shore
    {
      const [sx0, sy1] = toScreen(SEA.x0, SEA.y1), [, sy0] = toScreen(SEA.x0, 0);
      if (sy1 > -20) {
        ctx.fillStyle = '#4f8fb3'; ctx.fillRect(sx0, sy0 - 400, W - sx0 + 40, sy1 - sy0 + 400);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        const off = (time * 30) % 60;
        for (let y = sy1 - 10; y > sy0 - 400; y -= 22) for (let x = sx0 + ((y * 7) % 60) - off; x < W; x += 60) ctx.fillRect(x, y, 22, 2);
        ctx.fillStyle = '#e3d3a5'; ctx.fillRect(sx0, sy1 - 6, W - sx0 + 40, 14);
        // pier
        const [px0, py0] = toScreen(PIER.x0, PIER.y0), [px1, py1] = toScreen(PIER.x1, PIER.y1);
        ctx.fillStyle = '#8a6a43'; ctx.fillRect(px0, py0, px1 - px0, py1 - py0);
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        for (let y = py0 + 4; y < py1; y += 7) ctx.fillRect(px0, y, px1 - px0, 1.5);
      }
    }
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

    for (const g of GROUPS) drawGroupTile(g, time);
  }

  function drawDistrict(id) {
    const d = DISTRICTS[id], cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2, w = d.x1 - d.x0, dd = d.y1 - d.y0;
    const [lx, ly] = toScreen(cx, cy), [ax, ay] = toScreen(d.x0, d.y0), [bx, by] = toScreen(d.x1, d.y1);
    if (bx < -50 || ax > W + 50 || by < -50 || ay > H + 50) return;
    if (level[id]) {
      ctx.fillStyle = d.ground;
      groundRect(cx, cy, w, dd, 24); ctx.fill();
      if (id === 'village') {
        if (!level.vstore) dashedPlot(VSTORE.x, VSTORE.front - VSTORE.d / 2, VSTORE.w, VSTORE.d, 'Village Store plot');
        if (!level.builder) dashedPlot(BUILDER.x, BUILDER.front - BUILDER.d / 2, BUILDER.w, BUILDER.d, "Builder's Yard plot");
      }
      if (id === 'harbor' && level.harbor === 0) {}
      if (id === 'industry') {
        drawPond();
        if (!level.depot) dashedPlot(DEPOT.x, DEPOT.front - DEPOT.d / 2, DEPOT.w, DEPOT.d, 'Van Depot plot');
        if (!level.generator) dashedPlot(GEN.x, GEN.front - GEN.d / 2, GEN.w, GEN.d, 'Generator plot');
        if (!level.papermill) dashedPlot(MILL.x, MILL.front - MILL.d / 2, MILL.w, MILL.d, 'Paper Mill plot');
        if (!level.pump) dashedPlot(PUMP.x, PUMP.front - PUMP.d / 2, PUMP.w, PUMP.d, 'Pump plot');
        if (!level.charcoal) dashedPlot(KILN.x, KILN.front - KILN.d / 2, KILN.w, KILN.d, 'Charcoal Kiln plot');
      }
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
  let tagSink = null;
  function tag(text, x, y, size, color, bg = 'rgba(43,42,34,.78)') {
    if (tagSink) { tagSink.push([text, x, y, size, color, bg]); return; }
    ctx.font = `600 ${size}px ${FONT}`;
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = bg;
    roundRect(x - w / 2, y - size / 2 - 4, w, size + 8, (size + 8) / 2); ctx.fill();
    flatLabel(text, x, y, size, color);
  }

  function drawGroupTile(g, time) {
    const [sx, sy] = toScreen(g.x, g.y);
    if (sx < -160 || sx > W + 160 || sy < -120 || sy > H + 80) return;
    const items = UPGRADES.filter(u => u.group === g.id);
    const open = items.filter(canBuy);
    const cheapest = open.length ? Math.min(...open.map(u => u.costs[level[u.id]])) : 0;
    const afford = open.some(u => cash >= u.costs[level[u.id]]);
    const on = inRect(g, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#4d4d46';
    groundRect(g.x, g.y + 8, TILE_SIZE, TILE_SIZE, 16); ctx.fill();
    ctx.fillStyle = !open.length ? '#9cc27f' : on ? '#9a9a8c' : afford ? '#6f9c6a' : '#7c7c72';
    groundRect(g.x, g.y, TILE_SIZE, TILE_SIZE, 16); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = on ? '#fff3a6' : afford ? '#d8f5c8' : 'rgba(255,250,240,.6)';
    groundRect(g.x, g.y, TILE_SIZE, TILE_SIZE, 16); ctx.stroke();
    // a little up-arrow icon so tiles read as "upgrades here"
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath(); ctx.moveTo(sx, sy - 14); ctx.lineTo(sx + 12, sy - 2); ctx.lineTo(sx + 5, sy - 2); ctx.lineTo(sx + 5, sy + 10);
    ctx.lineTo(sx - 5, sy + 10); ctx.lineTo(sx - 5, sy - 2); ctx.lineTo(sx - 12, sy - 2); ctx.closePath(); ctx.fill();
    const bob = Math.sin(time * 2 + g.x) * 2;
    tag(g.name, sx, sy - 66 + bob, 17, '#fffaf0');
    const note = !open.length ? (items.every(u => level[u.id] >= u.costs.length) ? 'All upgraded' : 'Nothing to buy yet')
      : `${open.length} upgrade${open.length > 1 ? 's' : ''} · from $${cheapest.toLocaleString()}`;
    flatLabel(note, sx, sy - 40 + bob, 15, afford ? '#1f5a2a' : '#2b2a22', 600);
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
      flatLabel(`${wh[k]}`, x + 26, sy0 - wallH + 54, 15, keep(k) && wh[k] < keep(k) ? '#c0392b' : '#5a4630');
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
  // where a building's interior sits on screen (its floor and roof are drawn as separate layers)
  function shed(x, front, w, d) {
    const [sx, sy] = toScreen(x, front);
    return [sx, sy, d * TILT];
  }

  // ---------- Roofed buildings ----------
  // Each has three layers sorted by depth: floor + back wall, the interior (machines, workers), then
  // front wall + roof. Walk in through the door and the front wall and roof fade away.
  const ROOFED = [
    { key: 'sawmill', B: SAW, ids: ['sawmill', 'kiln'], wall: '#9a7650', roof: '#6b6f78', floor: '#a98a62', H: 72, draw: () => drawSawmill(), top: kilnChimney },
    { key: 'shack', B: SHACK, ids: ['shack', 'grove', 'tapper', 'sapbots', 'buckets', 'evap'], wall: '#8a4a32', roof: '#4f6b3a', floor: '#9b7a52', H: 66, draw: () => drawShack(), top: shackChimney },
    { key: 'workshop', B: WORKSHOP, ids: ['workshop'], wall: '#6b4f3a', roof: '#a5483a', floor: '#a98a62', H: 72, draw: () => drawWorkshop() },
    { key: 'generator', B: GEN, ids: ['generator', 'pellets'], wall: '#6a6f78', roof: '#3c4654', floor: '#9a978d', H: 72, draw: () => drawGenerator(), top: genStack },
    { key: 'papermill', B: MILL, ids: ['papermill'], wall: '#d9d2c2', roof: '#5f6b7a', floor: '#b9b4a8', H: 78, draw: () => drawPaperMill() },
    { key: 'depot', B: DEPOT, ids: ['depot', 'vans', 'vanpro'], wall: '#d9d2c2', roof: '#3d6fa8', floor: '#a9a59a', H: 70, door: 200, garage: true, draw: () => drawDepot() },
    { key: 'hq', B: HQ, ids: ['hq'], wall: '#e9e4da', roof: '#3c4654', floor: '#cfc6b5', H: () => (2 + level.hq) * 34, door: 60, office: true, draw: () => drawHQ(), top: hqFlag },
    { key: 'dispatch', B: DISPATCH, ids: ['dispatch'], wall: '#d9d2c2', roof: '#3d6fa8', floor: '#c9c1ae', H: 66, door: 60, draw: () => drawDispatch(), top: dispatchMast },
    { key: 'lab', B: LAB, ids: ['lab'], wall: '#e9eef2', roof: '#5f6b7a', floor: '#d9dfe3', H: 74, door: 70, draw: () => drawLab(), top: labDish },
    { key: 'harbor', B: CUSTOMS, ids: ['harbor', 'cranes', 'shipping'], wall: '#3d6fa8', roof: '#2b3a4a', floor: '#c3b598', H: 70, arched: true, draw: () => drawCustoms() },
    { key: 'vstore', B: VSTORE, ids: ['vstore'], wall: '#e9d8b4', roof: '#8a3b2e', floor: '#b49a74', H: 70, door: 80, draw: () => drawVStore() },
    { key: 'rail', B: STATION, ids: ['rail'], wall: '#c4703f', roof: '#7a3428', floor: '#b8a588', H: 80, door: 80, arched: true, draw: () => drawStation(), top: stationClock },
  ];
  const builtR = R => level[R.ids[0]] > 0;
  const hOf = R => typeof R.H === 'function' ? R.H() : R.H;

  // walls you can't walk through, with a door gap in the middle of the front
  function wallBoxes(B, door = 70) {
    const hw = B.w / 2, t = 12, side = hw - door / 2;
    return [
      { x: B.x, front: B.front - B.d + t, w: B.w, d: t },
      { x: B.x - hw + t / 2, front: B.front, w: t, d: B.d },
      { x: B.x + hw - t / 2, front: B.front, w: t, d: B.d },
      { x: B.x - hw + side / 2, front: B.front, w: side, d: t },
      { x: B.x + hw - side / 2, front: B.front, w: side, d: t },
    ];
  }

  function updateRoofs(dt) {
    for (const R of ROOFED) {
      const B = R.B;
      let target = 1;
      if (builtR(R) && Math.abs(player.x - B.x) < B.w / 2 + 10) {
        if (player.y < B.front + 12 && player.y > B.front - B.d - 10) target = 0.08;          // inside
        else if (player.y <= B.front - B.d - 10 && player.y > B.front - B.d - 240) target = 0.4; // behind it
      }
      R.a = (R.a ?? 1) + (target - (R.a ?? 1)) * Math.min(1, dt * 8);
    }
  }

  function drawBase(R) {
    const B = R.B, [sx, sy] = toScreen(B.x, B.front), hw = B.w / 2, back = B.d * TILT, H = hOf(R);
    ctx.fillStyle = 'rgba(30,40,20,.22)';
    roundRect(sx - hw - 4, sy - back + 4, B.w + 16, back + 10, 8); ctx.fill();
    ctx.fillStyle = R.floor;
    ctx.fillRect(sx - hw, sy - back, B.w, back);
    ctx.fillStyle = 'rgba(0,0,0,.06)';
    for (let y = sy - back + 6; y < sy; y += 7) ctx.fillRect(sx - hw, y, B.w, 1);
    // inside of the back wall, a little darker than the outside
    ctx.fillStyle = R.wall;
    ctx.fillRect(sx - hw, sy - back - H, B.w, H);
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.fillRect(sx - hw, sy - back - H, B.w, H);
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    ctx.fillRect(sx - hw, sy - back - 10, B.w, 3);
  }

  function drawRoof(R) {
    const B = R.B, [sx, sy] = toScreen(B.x, B.front), hw = B.w / 2, back = B.d * TILT, H = hOf(R);
    ctx.save();
    ctx.globalAlpha = R.a ?? 1;
    // side walls seen edge-on
    ctx.fillStyle = R.wall;
    ctx.fillRect(sx - hw, sy - back - H, 7, back + H); ctx.fillRect(sx + hw - 7, sy - back - H, 7, back + H);
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fillRect(sx - hw, sy - back - H, 7, back + H); ctx.fillRect(sx + hw - 7, sy - back - H, 7, back + H);
    // front wall with siding
    ctx.fillStyle = R.wall;
    ctx.fillRect(sx - hw, sy - H, B.w, H);
    ctx.fillStyle = 'rgba(0,0,0,.07)';
    for (let y = sy - H + 7; y < sy; y += 8) ctx.fillRect(sx - hw, y, B.w, 1);
    const door = R.door || 70;
    if (R.office) {
      const floors = Math.round(H / 34);
      for (let f = 0; f < floors; f++) {
        for (let x = sx - hw + 14; x < sx + hw - 20; x += 30) {
          if (f === floors - 1 && Math.abs(x + 10 - sx) < 30) continue;
          ctx.fillStyle = '#7fb4cf'; ctx.fillRect(x, sy - H + f * 34 + 8, 20, 20);
          ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, sy - H + f * 34 + 8, 6, 20);
        }
      }
    } else if (!R.garage) {
      for (let x = sx - hw + 22; x < sx + hw - 40; x += 52) {
        if (Math.abs(x + 13 - sx) < door / 2 + 16) continue;
        ctx.fillStyle = '#fffaf0'; roundRect(x - 2, sy - H + 14, 30, 26, R.arched ? 12 : 3); ctx.fill();
        ctx.fillStyle = '#9ec9de'; roundRect(x + 1, sy - H + 17, 24, 20, R.arched ? 10 : 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x + 4, sy - H + 19, 5, 16);
      }
    }
    // door or garage doors
    if (R.garage) {
      for (const dx of [-70, 0, 70]) {
        ctx.fillStyle = '#5f6b7a'; ctx.fillRect(sx + dx - 28, sy - 48, 56, 48);
        ctx.fillStyle = '#9aa3ad'; for (let y = 0; y < 48; y += 8) ctx.fillRect(sx + dx - 28, sy - 48 + y, 56, 2);
      }
    } else {
      const dh = Math.min(46, H - 14);
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(sx - 20, sy - dh - 3, 40, dh + 3);
      ctx.fillStyle = '#5a3a28'; ctx.fillRect(sx - 17, sy - dh, 34, dh);
      ctx.fillStyle = '#e8c54a'; ctx.beginPath(); ctx.arc(sx + 10, sy - dh / 2, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // roof: shingled top face plus a shadowed eave
    ctx.fillStyle = R.roof;
    ctx.fillRect(sx - hw - 8, sy - H - back - 8, B.w + 16, back + 10);
    ctx.fillStyle = 'rgba(0,0,0,.13)';
    for (let y = sy - H - back - 4; y < sy - H; y += 6) ctx.fillRect(sx - hw - 8, y, B.w + 16, 1.5);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(sx - hw - 8, sy - H - back - 8, B.w + 16, 3);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(sx - hw - 10, sy - H - 2, B.w + 20, 5);
    if (R.top) R.top(sx, sy, back, H);
    ctx.restore();
    for (const t of R.tags || []) tag(...t);
  }

  function dispatchMast(sx, sy, back, H) {
    ctx.fillStyle = '#5f646c'; ctx.fillRect(sx + 50, sy - back - H - 44, 3, 44);
    const blink = Math.sin(performance.now() / 250) > 0;
    ctx.fillStyle = blink ? '#ff6a5a' : '#7a3428'; ctx.beginPath(); ctx.arc(sx + 51.5, sy - back - H - 46, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  function drawDispatch() {
    const [sx, sy, back] = shed(DISPATCH.x, DISPATCH.front, DISPATCH.w, DISPATCH.d);
    // wall board: warehouse stock against each reserve
    const bx = sx - 60, by = sy - back - 52;
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(bx, by, 120, 44);
    ctx.strokeStyle = '#5f646c'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, 120, 44);
    LOGS.forEach((k, i) => {
      const r = dispatch.reserve[k] || 200, f = Math.min(1, wh[k] / r);
      drawItem(k, bx + 14, by + 9 + i * 13);
      ctx.fillStyle = '#e2d8c3'; ctx.fillRect(bx + 28, by + 6 + i * 13, 84, 7);
      ctx.fillStyle = dispatch.reserve[k] && wh[k] < dispatch.reserve[k] ? '#d9644a' : '#3f9d4f';
      ctx.fillRect(bx + 28, by + 6 + i * 13, 84 * f, 7);
    });
    worker(sx + 40, sy - back * 0.5, '#3d6fa8', true, '#4a2c1a');
    ctx.fillStyle = '#8a6a43'; ctx.fillRect(sx + 14, sy - back * 0.5 + 2, 56, 8);
    tag('DISPATCH', sx, sy - back - 110, 15, '#cfe6ff', '#2b3a4a');
  }
  function labDish(sx, sy, back, H) {
    // rooftop dish that slowly turns while research runs
    const a = research ? Math.sin(performance.now() / 900) * 0.5 : 0;
    ctx.fillStyle = '#9aa3ad'; ctx.fillRect(sx + 60, sy - back - H - 30, 4, 30);
    ctx.save(); ctx.translate(sx + 62, sy - back - H - 32); ctx.rotate(a - 0.5);
    ctx.fillStyle = '#e9eef2'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5f6b7a'; ctx.fillRect(-1, -12, 2, 12);
    ctx.restore();
  }
  function drawLab() {
    const [sx, sy, back] = shed(LAB.x, LAB.front, LAB.w, LAB.d);
    // benches with bubbling glassware and two scientists in white coats
    const t = performance.now() / 300;
    worker(sx - 50, sy - back * 0.6, '#f2f2f2', !!research, '#6b4127');
    worker(sx + 50, sy - back * 0.6, '#f2f2f2', !!research, '#f0c7a0');
    for (const bx of [-50, 50]) {
      ctx.fillStyle = '#9aa3ad'; ctx.fillRect(sx + bx - 34, sy - back * 0.6 + 2, 68, 8);
      ctx.fillRect(sx + bx - 30, sy - back * 0.6 + 10, 4, 12); ctx.fillRect(sx + bx + 26, sy - back * 0.6 + 10, 4, 12);
      ['#7fe08a', '#7fb4cf', '#e88a9a'].forEach((c, i) => {
        const x = sx + bx - 20 + i * 18, y = sy - back * 0.6;
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x - 4, y - 14, 8, 14);
        ctx.fillStyle = c; ctx.fillRect(x - 3, y - 7 - (research ? Math.abs(Math.sin(t + i)) * 4 : 0), 6, 7 + (research ? Math.abs(Math.sin(t + i)) * 4 : 0));
      });
    }
    tag('RESEARCH LAB', sx, sy - back - 114, 15, '#cfe6ff', '#2b3a4a');
    if (research) {
      const u = UPGRADES.find(x => x.id === research.id);
      tag(`${u.name} · ${Math.round(research.t / research.total * 100)}%`, sx, sy - back - 86, 13, '#fffaf0');
    } else tag('Idle · pick a project at the tile', sx, sy - back - 86, 13, '#fffaf0');
  }
  function drawCustoms() {
    const [sx, sy, back] = shed(CUSTOMS.x, CUSTOMS.front, CUSTOMS.w, CUSTOMS.d);
    worker(sx - 30, sy - back * 0.6, '#2b3a4a', ship.state === 'load', '#8d5a3b', '#2b3a4a');
    ctx.fillStyle = '#8a5a2e'; ctx.fillRect(sx - 64, sy - back * 0.6, 70, 16);
    ctx.fillStyle = '#5f6b7a';
    for (let i = 0; i < 3; i++) ctx.fillRect(sx + 30 + i * 22, sy - back + 6, 18, 30);
    tag('HARBOR OFFICE', sx, sy - back - 114, 15, '#cfe6ff', '#2b3a4a');
    const next = ship.state === 'away' ? `Next ship in ${Math.ceil(ship.t)}s` : ship.state === 'load' ? 'Loading cargo' : ship.state === 'arrive' ? 'Ship arriving' : 'Ship departing';
    tag(next, sx, sy - back - 86, 13, '#fffaf0');
  }
  function drawVStore() {
    const [sx, sy, back] = shed(VSTORE.x, VSTORE.front, VSTORE.w, VSTORE.d);
    // shelves along the back wall
    ['wood', 'plank', 'syrup', 'chair'].forEach((k, i) => {
      const x = sx - 80 + i * 54, y = sy - back + 10;
      ctx.fillStyle = '#8a6a43'; ctx.fillRect(x - 24, y, 48, 4); ctx.fillRect(x - 24, y - 16, 48, 4);
      for (let n = 0; n < Math.min(vstock[k], 8); n++) drawItem(k, x - 16 + (n % 4) * 10, y - 4 - Math.floor(n / 4) * 16);
    });
    // counter with the shopkeeper behind it
    const busy = villagers.some(v => v.state === 'buy');
    worker(sx + 70, sy - back * 0.72, '#c94f7c', busy, '#a8714a');
    ctx.fillStyle = '#8a5a2e'; ctx.fillRect(sx - 90, sy - back * 0.5, 180, 14);
    ctx.fillStyle = '#c49565'; ctx.fillRect(sx - 92, sy - back * 0.5 - 4, 184, 5);
    tag('VILLAGE STORE', sx, sy - back - 114, 15, '#ffe2b0', '#5a4630');
    tag(`${vstock.wood} pine · ${vstock.plank} planks · ${vstock.syrup} syrup · ${vstock.chair} chairs`, sx, sy - back - 86, 12, '#fffaf0');
  }
  function kilnChimney(sx, sy, back, H) {
    if (!level.kiln) return;
    ctx.fillStyle = '#9b4434'; ctx.fillRect(sx + 40, sy - back - H - 46, 26, 46);
    ctx.fillStyle = '#7a3428'; ctx.fillRect(sx + 36, sy - back - H - 52, 34, 8);
    smoke(sx + 53, sy - back - H - 56, 'rgba(120,110,100,', 2);
  }
  function shackChimney(sx, sy, back, H) {
    ctx.fillStyle = '#6b4c2e'; ctx.fillRect(sx - 40, sy - back - H - 34, 16, 36);
    if (shack.sap >= 2) smoke(sx - 32, sy - back - H - 38, 'rgba(255,255,255,', 3);
  }
  function genStack(sx, sy, back, H) {
    ctx.fillStyle = '#4a4a46'; ctx.fillRect(sx + 50, sy - back - H - 60, 20, 64);
    ctx.fillStyle = '#d9644a'; ctx.fillRect(sx + 50, sy - back - H - 52, 20, 5);
    if (gen.fuel > 0) smoke(sx + 60, sy - back - H - 64, 'rgba(110,110,110,', 3);
  }
  function hqFlag(sx, sy, back, H) {
    const hw = HQ.w / 2;
    ctx.fillStyle = '#5f646c'; ctx.fillRect(sx + hw - 30, sy - H - back - 58, 3, 50);
    ctx.fillStyle = '#d9644a';
    const wave = Math.sin(performance.now() / 300) * 3;
    ctx.beginPath(); ctx.moveTo(sx + hw - 27, sy - H - back - 58); ctx.lineTo(sx + hw + 3, sy - H - back - 52 + wave); ctx.lineTo(sx + hw - 27, sy - H - back - 44); ctx.fill();
  }
  function stationClock(sx, sy, back, H) {
    ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(sx, sy - H - back - 10, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2b2a22'; ctx.lineWidth = 2;
    const a = performance.now() / 4000;
    ctx.beginPath(); ctx.moveTo(sx, sy - H - back - 10); ctx.lineTo(sx + Math.cos(a) * 9, sy - H - back - 10 + Math.sin(a) * 9); ctx.stroke();
  }
  function smoke(x, y, rgba, n) {
    const t = performance.now() / 650;
    for (let i = 0; i < n; i++) {
      const p = (t + i / n) % 1;
      ctx.fillStyle = `${rgba}${0.45 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(p * 5 + i) * 6, y - p * 55, 7 + p * 10, 0, Math.PI * 2); ctx.fill();
    }
  }
  // someone at work inside a building; busy workers keep moving
  function worker(x, y, shirt, busy, skin = '#8d5a3b', hat) {
    drawPerson(x, y, { walk: busy ? performance.now() / 110 : 0, face: 1, shirt, skin, hair: '#16120f', hat, arms: busy ? 'work' : true });
  }

  function drawSawmill() {
    const [sx, sy, back] = shed(SAW.x, SAW.front, SAW.w, SAW.d);
    worker(sx - 12, sy - back * 0.55, '#3d7cc9', sawIn() > 0, '#8d5a3b', '#e8c54a');
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
    for (let i = 0; i < Math.min(saw.chips, 24); i++) drawChips(sx + 92 + (i % 3) * 7, sy - 4 - Math.floor(i / 3) * 4);
    tag(level.kiln ? 'SAWMILL + KILN' : 'SAWMILL', sx, sy - back - 114, 15, '#ffe2b0', '#5a4630');
    tag(`${sawIn()} logs → ${saw.out} planks`, sx, sy - back - 86, 13, '#fffaf0');
  }

  function drawShack() {
    const [sx, sy, back] = shed(SHACK.x, SHACK.front, SHACK.w, SHACK.d);
    worker(sx + 34, sy - back * 0.6, '#8a5bc4', shack.sap >= 2, '#c68e62');
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
    tag(`${shack.sap} sap → ${shack.out} syrup${shack.coal ? ` · charcoal ${shack.coal} (2× speed)` : ''}`, sx, sy - back - 86, 13, '#fffaf0');
  }

  function drawWorkshop() {
    const [sx, sy, back] = shed(WORKSHOP.x, WORKSHOP.front, WORKSHOP.w, WORKSHOP.d);
    worker(sx - 6, sy - back * 0.55, '#d9644a', workshop.t > 0, '#6b4127');
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
    const hw = STATION.w / 2, back = STATION.d * TILT;
    // ticket counter with a clerk, and benches for passengers
    worker(sx + 70, sy - back * 0.62, '#7a3428', train.state === 'load', '#c68e62');
    ctx.fillStyle = '#8a5a2e'; ctx.fillRect(sx + 36, sy - back * 0.62 - 4, 70, 18);
    ctx.fillStyle = '#c49565'; ctx.fillRect(sx + 34, sy - back * 0.62 - 8, 74, 5);
    for (let i = 0; i < 3; i++) {
      const x = sx - hw + 24 + i * 46;
      ctx.fillStyle = '#6b4426'; ctx.fillRect(x, sy - 22, 36, 6);
      ctx.fillRect(x + 2, sy - 16, 3, 8); ctx.fillRect(x + 31, sy - 16, 3, 8);
    }
    tag('RAIL YARD', sx, sy - 80 - back - 40, 15, '#ffe2b0', '#5a4630');
    const next = train.state === 'away' ? `Next train in ${Math.ceil(train.t)}s` : train.state === 'load' ? 'Loading freight' : 'Train arriving';
    tag(next, sx, sy + 16, 13, '#fffaf0');
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
    const hw = HQ.w / 2, back = HQ.d * TILT, H = (2 + level.hq) * 34;
    // two rows of desks, each with someone typing away
    const shirts = ['#3d7cc9', '#8a5bc4', '#2f9d8f', '#d9644a', '#5f6b7a', '#c94f7c'];
    const skins = ['#6b4127', '#f0c7a0', '#8d5a3b', '#c68e62', '#4a2c1a', '#a8714a'];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const x = sx - hw + 50 + c * 80, y = sy - back * (0.78 - r * 0.42);
        worker(x, y - 2, shirts[r * 3 + c], true, skins[r * 3 + c]);
        ctx.fillStyle = '#8a6a43'; ctx.fillRect(x - 24, y - 20, 48, 8);
        ctx.fillRect(x - 22, y - 12, 4, 12); ctx.fillRect(x + 18, y - 12, 4, 12);
        ctx.fillStyle = '#2b2a22'; ctx.fillRect(x - 9, y - 36, 18, 14);
        ctx.fillStyle = '#7fb4cf'; ctx.fillRect(x - 7, y - 34, 14, 10);
      }
    }
    // a potted plant by the door
    ctx.fillStyle = '#8a4a32'; ctx.fillRect(sx + hw - 28, sy - 16, 14, 14);
    ctx.fillStyle = '#4f7a36'; ctx.beginPath(); ctx.arc(sx + hw - 21, sy - 24, 11, 0, Math.PI * 2); ctx.fill();
    tag(`HOMESTEAD HQ · +${Math.round((incomeMul() - 1) * 100)}% on all sales`, sx, sy - H - back - 28, 16, '#ffd75a', '#2b2a22');
  }

  function drawGenerator() {
    const [sx, sy, back] = shed(GEN.x, GEN.front, GEN.w, GEN.d);
    worker(sx - 62, sy - back * 0.6, '#5f6b7a', gen.fuel > 0, '#4a2c1a', '#e8c54a');
    const pr = powerRatio();
    // turbine housing and a smokestack that smokes while burning
    ctx.fillStyle = '#9aa3ad';
    roundRect(sx - 40, sy - 52, 80, 40, 10); ctx.fill();
    ctx.fillStyle = pr > 0 ? '#ffd75a' : '#5f646c';
    ctx.beginPath(); ctx.arc(sx, sy - 32, 10, 0, Math.PI * 2); ctx.fill();
    // chip pile, pellet bags
    for (let i = 0; i < Math.min(gen.fuel, 30); i++) drawChips(sx - 70 + (i % 5) * 7, sy - 6 - Math.floor(i / 5) * 4);
    for (let i = 0; i < Math.min(gen.pellets, 12); i++) drawPellets(sx - 20 + (i % 4) * 10, sy - 4 - Math.floor(i / 4) * 8);
    tag('GENERATOR', sx, sy - back - 140, 15, '#ffe2b0', '#5a4630');
    tag(`Power ${Math.round(pr * 100)}% · fuel ${gen.fuel}/${FUEL_CAP}`, sx, sy - back - 114, 13, pr > 0 ? '#fff3a6' : '#ffd0c4');
    if (level.pellets) tag(`${gen.pellets} pellets`, sx, sy + 18, 12, '#fffaf0');
  }
  function drawPaperMill() {
    const [sx, sy, back] = shed(MILL.x, MILL.front, MILL.w, MILL.d);
    worker(sx + 52, sy - back * 0.6, '#2f9d8f', level.papermill && powerRatio() > 0 && mill.chips >= 2, '#f0c7a0');
    // rollers spin while it works
    const running = level.papermill && powerRatio() > 0 && mill.chips >= 2 && mill.water >= 1;
    const a = running ? performance.now() / 200 : 0;
    for (const dx of [-30, 0, 30]) {
      ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.arc(sx + dx, sy - 30, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5f646c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx + dx, sy - 30); ctx.lineTo(sx + dx + Math.cos(a) * 10, sy - 30 + Math.sin(a) * 10); ctx.stroke();
    }
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(sx - 44, sy - 20, 88, 4);
    for (let i = 0; i < Math.min(mill.out, 15); i++) drawPaper(sx + 80, sy - 6 - i * 4);
    for (let i = 0; i < Math.min(mill.chips, 20); i++) drawChips(sx - 90 + (i % 4) * 7, sy - 6 - Math.floor(i / 4) * 4);
    tag('PAPER MILL', sx, sy - back - 114, 15, '#ffe2b0', '#5a4630');
    const why = !powerRatio() ? 'Needs power' : mill.water < 1 ? 'Needs water' : mill.chips < 2 ? 'Needs chips' : 'Running';
    tag(`${mill.chips} chips · ${Math.floor(mill.water)} water → ${mill.out} paper · ${why}`, sx, sy - back - 88, 12, why === 'Running' ? '#fffaf0' : '#ffd0c4');
  }
  function drawPond() {
    const [px, py] = toScreen(POND.x, POND.y);
    ctx.fillStyle = '#5a8fb0';
    ctx.beginPath(); ctx.ellipse(px, py, 110, 110 * TILT, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.ellipse(px - 30, py - 10, 30, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (level.pump && level.papermill) {
      // pipe from the pump to the paper mill
      const [ax, ay] = toScreen(PUMP.x - 50, PUMP.front - 20), [bx, by] = toScreen(MILL.x + MILL.w / 2, MILL.front - 30);
      ctx.strokeStyle = '#5f6b7a'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = '#7fb4cf'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -performance.now() / 30;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  function drawPump() {
    const [sx, sy] = toScreen(PUMP.x, PUMP.front);
    ctx.fillStyle = '#3d6fa8'; roundRect(sx - 40, sy - 50, 80, 50, 6); ctx.fill();
    ctx.fillStyle = '#2b3a4a'; ctx.fillRect(sx - 44, sy - 56, 88, 8);
    const bob = Math.sin(performance.now() / 200) * 6;
    ctx.fillStyle = '#9aa3ad'; ctx.fillRect(sx + 20, sy - 76 + bob, 6, 24);
    tag(`PUMP · ${pumpRate()}/s`, sx, sy - 74, 12, '#fffaf0');
  }
  function drawCoalKiln() {
    const [sx, sy] = toScreen(KILN.x, KILN.front);
    // three brick domes glowing while they burn
    const burning = coalKiln.oak > 0;
    for (const dx of [-55, 0, 55]) {
      ctx.fillStyle = '#9b4434'; ctx.beginPath(); ctx.arc(sx + dx, sy - 12, 28, Math.PI, 0); ctx.fill();
      ctx.fillRect(sx + dx - 28, sy - 12, 56, 12);
      ctx.fillStyle = burning ? `rgba(255,${140 + Math.sin(performance.now() / 150 + dx) * 40},40,.9)` : '#3a2a22';
      roundRect(sx + dx - 8, sy - 22, 16, 18, 6); ctx.fill();
    }
    for (let i = 0; i < Math.min(coalKiln.oak, 12); i++) drawOak(sx - 96, sy - 6 - i * 5);
    for (let i = 0; i < Math.min(coalKiln.out, 20); i++) drawCharcoal(sx + 92 + (i % 3) * 7, sy - 6 - Math.floor(i / 3) * 5);
    tag('CHARCOAL KILN', sx, sy - 74, 15, '#ffe2b0', '#5a4630');
    tag(`${coalKiln.oak} oak → ${coalKiln.out} charcoal`, sx, sy - 48, 12, '#fffaf0');
  }
  function drawDepot() {
    const [sx, sy, back] = shed(DEPOT.x, DEPOT.front, DEPOT.w, DEPOT.d);
    // tool wall, tyre stack and the dispatcher
    ctx.fillStyle = '#8a6a43'; ctx.fillRect(sx - 100, sy - back - 40, 60, 6);
    ctx.fillStyle = '#2b2a22';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(sx + 90, sy - 12 - i * 9, 14, 5, 0, 0, Math.PI * 2); ctx.fill(); }
    worker(sx - 70, sy - back * 0.5, '#3d6fa8', vans.some(v => v.state !== 'idle'), '#c68e62');
    tag(`VAN DEPOT · ${vanCount()} van${vanCount() === 1 ? '' : 's'}`, sx, sy - back - 114, 14, '#ffe2b0', '#5a4630');
  }
  function drawVan(v) {
    const [sx, sy] = toScreen(v.x, v.y);
    const hop = v.state !== 'idle' ? Math.abs(Math.sin(v.bounce)) * 1.2 : 0;
    ctx.fillStyle = 'rgba(30,40,20,.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(sx, sy - hop); ctx.scale(v.face, 1);
    ctx.fillStyle = '#2b2a22';
    ctx.beginPath(); ctx.arc(-16, -5, 6, 0, Math.PI * 2); ctx.arc(16, -5, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2ece0'; roundRect(-28, -34, 44, 28, 5); ctx.fill();
    ctx.fillStyle = '#e8e2d4'; roundRect(14, -26, 16, 20, 5); ctx.fill();
    ctx.fillStyle = '#bfe3f0'; roundRect(18, -23, 9, 9, 2); ctx.fill();
    ctx.fillStyle = '#3f9d4f'; ctx.fillRect(-28, -18, 44, 4);
    ctx.restore();
    if (v.load && v.route) {
      drawItem(v.route.kind, sx - 8, sy - 48);
      flatLabel(`${v.load}`, sx + 10, sy - 48, 12, '#fffaf0');
    }
  }

  function drawCrane(c) {
    const [sx, sy] = toScreen(c.x, c.y);
    const working = ship.state === 'load';
    const a = working ? Math.sin(performance.now() / 500 + c.x) * 0.5 : 0.2;
    ctx.fillStyle = 'rgba(30,40,20,.25)'; ctx.fillRect(sx - 30, sy - 4, 60, 8);
    ctx.fillStyle = '#e8b83a';
    ctx.fillRect(sx - 22, sy - 12, 44, 12);
    ctx.fillRect(sx - 6, sy - 150, 12, 140);
    for (let y = sy - 145; y < sy - 15; y += 14) { ctx.fillStyle = '#c99a2a'; ctx.fillRect(sx - 6, y, 12, 2); }
    // jib swings toward the ship
    ctx.save(); ctx.translate(sx, sy - 150); ctx.rotate(-Math.PI / 2 + 1.2 + a);
    ctx.fillStyle = '#e8b83a'; ctx.fillRect(0, -4, 150, 8);
    ctx.strokeStyle = '#3c3c38'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(140, 4); ctx.lineTo(140, 40 + Math.sin(performance.now() / 300) * 8); ctx.stroke();
    ctx.fillStyle = '#d9644a'; ctx.fillRect(132, 40 + Math.sin(performance.now() / 300) * 8, 16, 10);
    ctx.restore();
    ctx.fillStyle = '#3c3c38'; ctx.fillRect(sx - 12, sy - 162, 24, 14);
  }

  function drawShip() {
    if (!level.harbor || ship.state === 'away') return;
    const [sx, sy] = toScreen(ship.x, SHIP.y);
    if (sx < -500 || sx > W + 500) return;
    const L = 420;
    // hull, waterline, bridge at the stern (right), containers filling the deck
    ctx.fillStyle = 'rgba(20,40,60,.3)'; ctx.fillRect(sx - L / 2, sy + 2, L, 10);
    ctx.fillStyle = '#2b2a22';
    ctx.beginPath(); ctx.moveTo(sx - L / 2 - 30, sy - 50); ctx.lineTo(sx + L / 2, sy - 50); ctx.lineTo(sx + L / 2 - 10, sy); ctx.lineTo(sx - L / 2 + 10, sy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a1f2b'; ctx.fillRect(sx - L / 2 + 6, sy - 14, L - 16, 12);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(sx + L / 2 - 80, sy - 110, 60, 60);
    ctx.fillStyle = '#7fb4cf'; for (let i = 0; i < 3; i++) ctx.fillRect(sx + L / 2 - 74 + i * 18, sy - 100, 12, 10);
    ctx.fillStyle = '#d9644a'; ctx.fillRect(sx + L / 2 - 46, sy - 136, 16, 26);
    const total = ship.order ? Object.values(ship.order).reduce((a, b) => a + b, 0) : 1;
    const got = ship.got ? Object.values(ship.got).reduce((a, b) => a + b, 0) : 0;
    const slots = 24, filled = ship.state === 'leave' ? slots : Math.floor(got / total * slots);
    const colors = ['#d9644a', '#3d7cc9', '#2f9d8f', '#e8b83a', '#8a5bc4', '#5f6b7a'];
    for (let i = 0; i < filled; i++) {
      const col = i % 8, row = Math.floor(i / 8);
      ctx.fillStyle = colors[(i * 7) % colors.length];
      ctx.fillRect(sx - L / 2 + 10 + col * 36, sy - 74 - row * 22, 34, 20);
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(sx - L / 2 + 10 + col * 36, sy - 60 - row * 22, 34, 6);
    }
    if (ship.state === 'load') {
      const keys = Object.keys(ship.order);
      const h = 26 + keys.length * 22, cx = sx - 60, cy = sy + 24;
      ctx.fillStyle = '#fffaf0'; roundRect(cx - 95, cy, 190, h, 12); ctx.fill();
      flatLabel('EXPORT ORDER · pays 3×', cx, cy + 14, 13, '#2b3a4a');
      keys.forEach((k, i) => {
        drawItem(k, cx - 50, cy + 36 + i * 22);
        flatLabel(`${ship.got[k]}/${ship.order[k]}`, cx + 22, cy + 36 + i * 22, 15, ship.got[k] >= ship.order[k] ? '#3f9d4f' : '#2b2a22');
      });
    }
  }

  // a little house with a gable roof; while being built it's a scaffold that rises
  function drawHouse(i) {
    const h = houses[i], B = HOUSE_SPOTS[i], [sx, sy] = toScreen(B.x, B.front);
    const hw = B.w / 2, back = B.d * TILT;
    if (h.state === 'empty') {
      ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,250,240,.6)';
      ctx.strokeRect(sx - hw, sy - back, B.w, back); ctx.setLineDash([]);
      return;
    }
    ctx.fillStyle = 'rgba(30,40,20,.22)'; roundRect(sx - hw - 4, sy - back + 4, B.w + 14, back + 8, 6); ctx.fill();
    if (h.state === 'building') {
      const H = 60 * h.p;
      ctx.fillStyle = '#c99b5f'; ctx.fillRect(sx - hw, sy - H, B.w, H);
      ctx.strokeStyle = '#8a6a43'; ctx.lineWidth = 3;
      for (const x of [sx - hw, sx, sx + hw]) { ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy - 76); ctx.stroke(); }
      for (let y = sy - 18; y > sy - 76; y -= 20) { ctx.beginPath(); ctx.moveTo(sx - hw, y); ctx.lineTo(sx + hw, y); ctx.stroke(); }
      worker(sx + hw - 10, sy - 6, '#e8b83a', true, '#8d5a3b', '#e8b83a');
      tag(`${Math.round(h.p * 100)}%`, sx, sy - 92, 13, '#fffaf0');
      return;
    }
    bounceWrap('house' + i, B, () => {
      const H = 54;
      ctx.fillStyle = h.wall; ctx.fillRect(sx - hw, sy - H, B.w, H);
      ctx.fillStyle = 'rgba(0,0,0,.06)'; for (let y = sy - H + 6; y < sy; y += 7) ctx.fillRect(sx - hw, y, B.w, 1);
      ctx.fillStyle = '#5a3a28'; ctx.fillRect(sx - 10, sy - 30, 20, 30);
      ctx.fillStyle = '#9ec9de'; ctx.fillRect(sx - hw + 10, sy - 40, 18, 16); ctx.fillRect(sx + hw - 28, sy - 40, 18, 16);
      // roof: front gable triangle and the slope behind it
      ctx.fillStyle = h.color;
      ctx.beginPath(); ctx.moveTo(sx - hw - 8, sy - H); ctx.lineTo(sx, sy - H - 36); ctx.lineTo(sx + hw + 8, sy - H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.moveTo(sx, sy - H - 36); ctx.lineTo(sx + hw + 8, sy - H); ctx.lineTo(sx + hw + 8, sy - H - back); ctx.lineTo(sx, sy - H - 36 - back); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b4c2e'; ctx.fillRect(sx + 18, sy - H - 34, 10, 18);
      smoke(sx + 23, sy - H - 38, 'rgba(230,230,230,', 2);
    });
  }

  function drawBuilderYard() {
    const [sx, sy] = toScreen(BUILDER.x, BUILDER.front);
    const hw = BUILDER.w / 2, back = BUILDER.d * TILT;
    ctx.fillStyle = '#b8a07a'; ctx.fillRect(sx - hw, sy - back, BUILDER.w, back);
    ctx.fillStyle = '#6b4c2e';
    for (let x = sx - hw; x <= sx + hw; x += 30) ctx.fillRect(x, sy - back - 14, 3, 14);
    ctx.fillRect(sx - hw, sy - back - 12, BUILDER.w, 3);
    // stacks of planks and redwood waiting to become houses
    for (let i = 0; i < Math.min(builder.planks, 36); i++) drawPlank(sx - 60 + (i % 3) * 22, sy - 10 - Math.floor(i / 3) * 4);
    for (let i = 0; i < Math.min(builder.redwood, 15); i++) drawRedwood(sx + 50 + (i % 3) * 4, sy - 10 - Math.floor(i / 3) * 7);
    worker(sx - 6, sy - back * 0.4, '#e8b83a', houses.some(h => h.state === 'building'), '#4a2c1a', '#e8b83a');
    tag("BUILDER'S YARD", sx, sy - back - 40, 15, '#ffe2b0', '#5a4630');
    tag(`${builder.planks}/${HOUSE_PLANKS} planks · ${builder.redwood}/${HOUSE_REDWOOD} redwood per house`, sx, sy - back - 14, 12, '#fffaf0');
  }

  function drawVillager(v) {
    const [sx, sy] = toScreen(v.x, v.y);
    drawPerson(sx, sy, {
      walk: v.state === 'buy' || v.state === 'home' ? 0 : v.walk, face: v.face, shirt: v.shirt, skin: v.skin, hair: v.hair,
      before: () => { for (let i = 0; i < Math.min(v.got || 0, 6); i++) drawItem(v.kind, -15, -22 - i * 6.5); },
    });
    if (v.state === 'buy' && v.kind) {
      ctx.fillStyle = '#fffaf0'; roundRect(sx - 24, sy - 92, 48, 26, 10); ctx.fill();
      drawItem(v.kind, sx - 9, sy - 79);
      flatLabel(`${v.want - v.got}`, sx + 12, sy - 79, 15, '#2b2a22');
    }
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
    treeBody(sx, sy, s, n.species, wob);
    if (n.hp > 0) drawPips(sx, sy - (n.species === 'redwood' ? 172 : 108) * s, n);
  }

  function treeBody(sx, sy, s, species, wob) {
    const n = { species };
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
  }

  // a chopped tree swinging down around its base, then fading out
  function drawFall(f) {
    const [sx, sy] = toScreen(f.x, f.y), p = f.t / f.life;
    const k = Math.min(1, p / 0.55), ang = k * k * (Math.PI / 2) * f.dir;
    ctx.save();
    ctx.globalAlpha = p > 0.6 ? Math.max(0, 1 - (p - 0.6) / 0.4) : 1;
    ctx.translate(sx, sy); ctx.rotate(ang); ctx.translate(-sx, -sy);
    treeBody(sx, sy, f.size, f.species, 0);
    ctx.restore();
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
  function drawChips(x, y) {
    ctx.fillStyle = '#e3c28e'; ctx.fillRect(x - 3, y - 2, 4, 3);
    ctx.fillStyle = '#c9a26a'; ctx.fillRect(x + 1, y - 1, 3, 2);
  }
  function drawPaper(x, y) {
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(x - 9, y - 3, 18, 5);
    ctx.fillStyle = '#c9d6e0'; ctx.fillRect(x - 9, y + 1, 18, 1.5);
  }
  function drawPellets(x, y) {
    ctx.fillStyle = '#b58a55'; roundRect(x - 5, y - 7, 10, 10, 3); ctx.fill();
    ctx.fillStyle = '#8a6a43'; ctx.fillRect(x - 3, y - 9, 6, 3);
  }
  function drawCharcoal(x, y) {
    ctx.fillStyle = '#2b2a22'; ctx.beginPath(); ctx.ellipse(x, y, 5, 3.5, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a5850'; ctx.fillRect(x - 2, y - 2, 2, 1.5);
  }
  function drawWater(x, y) {
    ctx.fillStyle = '#5a8fb0'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  }
  const ITEM_DRAW = { wood: drawLog, oak: drawOak, redwood: drawRedwood, plank: drawPlank, sap: drawSap, syrup: drawSyrup, cash: drawBill, chair: drawChair, table: drawTable,
    chips: drawChips, paper: drawPaper, pellets: drawPellets, charcoal: drawCharcoal, water: drawWater };
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
    const swing = Math.sin(o.walk) * 0.55;
    const limb = (x, y, a, w, h, c) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = c; roundRect(-w / 2, 0, w, h, w / 2); ctx.fill(); ctx.restore(); };
    const armSwing = o.arms === 'work' ? Math.sin(o.walk * 1.6) * 0.9 - 0.6 : swing;
    if (o.arms !== false) limb(-6, -31, armSwing, 5, 15, o.skin);                 // back arm
    limb(-4.5, -13, swing, 5.5, 12, o.pants || '#3d3a4f');                         // legs
    limb(4.5, -13, -swing, 5.5, 12, o.pants || '#3d3a4f');
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
    if (o.arms !== false) {                                                       // front arm, in a sleeve
      ctx.save(); ctx.translate(5, -31); ctx.rotate(o.arms === 'work' ? -armSwing : -swing);
      ctx.fillStyle = o.shirt; roundRect(-3, 0, 6, 8, 3); ctx.fill();
      ctx.fillStyle = o.skin; roundRect(-2.5, 6, 5, 9, 2.5); ctx.fill();
      ctx.restore();
    }
    if (o.after) o.after();
    ctx.restore();
  }

  function drawPlayer() {
    const [sx, sy] = toScreen(player.x, player.y);
    drawPerson(sx, sy, {
      walk: player.walk, face: player.face, shirt: '#d9644a', skin: '#6b4127', hair: '#16120f', beard: true, pack: true,
      arms: !(gather.node && gather.node.type !== 'maple'),
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
    if (h.id === 'sapbot') {
      const hop = h.state === 'toMaple' || h.state === 'toShack' ? Math.abs(Math.sin(h.bounce)) * 1.5 : 0;
      ctx.fillStyle = 'rgba(30,40,20,.3)';
      ctx.beginPath(); ctx.ellipse(sx, sy, 18, 18 * TILT, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(sx, sy - hop); ctx.scale(h.face, 1);
      ctx.fillStyle = '#2b2a22';
      ctx.beginPath(); ctx.arc(-9, -4, 5, 0, Math.PI * 2); ctx.arc(9, -4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a5bc4'; roundRect(-15, -20, 30, 13, 4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-15, -11, 30, 4);
      ctx.fillStyle = '#c9ced6'; roundRect(-12, -36, 14, 17, 5); ctx.fill();          // sap tank
      ctx.fillStyle = '#e0a640'; ctx.fillRect(-10, -30 + Math.min(1, h.load.length / 8) * -4, 10, 9);
      ctx.fillStyle = '#6b4a9a'; roundRect(4, -32, 12, 12, 3); ctx.fill();             // head
      ctx.fillStyle = '#ffe9a8'; ctx.fillRect(10, -28, 4, 3);
      ctx.strokeStyle = '#5f646c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(10, -32); ctx.lineTo(10, -38); ctx.stroke();
      ctx.fillStyle = '#ff7a59'; ctx.beginPath(); ctx.arc(10, -39, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (h.load.length) tag(`${h.load.length} sap`, sx, sy - 52, 12, '#fffaf0');
      return;
    }
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
        const pop = p < 0.1 ? 0.6 + p * 7 : p < 0.2 ? 1.3 - (p - 0.1) * 3 : 1;
        ctx.font = `600 ${Math.round(20 * pop)}px ${FONT}`;
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
    if (f.kind === 'dust') {
      const p = f.t / f.life;
      ctx.fillStyle = `rgba(200,188,160,${0.55 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(sx, sy - f.h, 3 + p * 9, 0, Math.PI * 2); ctx.fill();
      return;
    }
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
      const key = ['dock', 'showroom', 'rail', 'harbor', 'village'].find(k => pileAmt[k] > 0);
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

  const bumps = {};
  function bounceWrap(key, B, fn) {
    const t0 = bumps[key];
    if (t0 === undefined) return fn();
    const p = (performance.now() - t0) / 650;
    if (p >= 1) { delete bumps[key]; return fn(); }
    const e = Math.sin(p * Math.PI * 3) * (1 - p);
    const [sx, sy] = toScreen(B.x, B.front);
    ctx.save(); ctx.translate(sx, sy); ctx.scale(1 - 0.07 * e, 1 + 0.14 * e); ctx.translate(-sx, -sy);
    fn();
    ctx.restore();
  }

  function render(time) {
    ctx.save();
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
    add(STORE.front - 1, () => bounceWrap('store', STORE, drawStore));
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
    if (level.showroom) { add(SHOWROOM.front - 1, drawShowroom); add(car.y, drawBuyerCar); }
    if (level.rail) add(TRACK_Y, drawTrain);
    if (level.ads) add(BILLBOARD.y, drawBillboard);
    if (level.pump) add(PUMP.front - 1, drawPump);
    if (level.charcoal) add(KILN.front - 1, drawCoalKiln);
    for (const v of vans) if (onScreen(v.x, v.y, 60)) add(v.y, () => drawVan(v));
    if (!level.hq && onScreen(HQ.x, HQ.front, 200)) add(HQ.front - 200, () => dashedPlot(HQ.x, HQ.front - HQ.d / 2, HQ.w, HQ.d, 'Head Office plot'));
    for (const R of ROOFED) {
      if (!builtR(R) || !onScreen(R.B.x, R.B.front, 320)) continue;
      const B = R.B;
      add(B.front - B.d - 1, () => bounceWrap(R.key, B, () => drawBase(R)));
      add(B.front - B.d * 0.35, () => bounceWrap(R.key, B, () => { tagSink = []; R.draw(); R.tags = tagSink; tagSink = null; }));
      add(B.front + 0.5, () => bounceWrap(R.key, B, () => drawRoof(R)));
    }
    for (const f of fx) if (f.type === 'fall') add(f.y, () => drawFall(f));
    if (level.harbor) {
      for (const c of CRANES) if (onScreen(c.x, c.y, 260)) add(c.y, () => drawCrane(c));
      add(SHIP.y, drawShip);
    }
    if (level.builder) {
      if (onScreen(BUILDER.x, BUILDER.front, 260)) add(BUILDER.front - 1, drawBuilderYard);
      houses.forEach((h, i) => { const B = HOUSE_SPOTS[i]; if (onScreen(B.x, B.front, 200)) add(B.front - 1, () => drawHouse(i)); });
    }
    for (const v of villagers) if (onScreen(v.x, v.y, 60)) add(v.y, () => drawVillager(v));
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
    ctx.restore();
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

  // ---------- Mini map ----------
  const mapCtx = ui.map.getContext('2d');
  let mapBig = false;
  ui.map.addEventListener('click', () => { mapBig = !mapBig; ui.map.classList.toggle('big', mapBig); drawMap(); });
  function drawMap() {
    const size = mapBig ? 240 : 110, k = size / WORLD_W;
    if (ui.map.width !== size * DPR) { ui.map.width = size * DPR; ui.map.height = size * DPR; }
    const m = mapCtx;
    m.setTransform(DPR, 0, 0, DPR, 0, 0);
    m.fillStyle = '#4f7a36'; m.fillRect(0, 0, size, size);
    const rect = (x0, y0, x1, y1, c) => { m.fillStyle = c; m.fillRect(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k); };
    rect(CX - 1080, CY - 720, CX + 1160, CY + 1160, '#c9b48a');
    for (const r of ROADS) rect(r.x0, r.y0, r.x1, r.y1, '#c9b48a');
    rect(SEA.x0, 0, WORLD_W, SEA.y1, '#4f8fb3');
    for (const id in DISTRICTS) { const d = DISTRICTS[id]; rect(d.x0, d.y0, d.x1, d.y1, level[id] ? d.ground : 'rgba(30,40,24,.55)'); }
    houses.forEach((h, i) => { if (h.state === 'done') rect(HOUSE_SPOTS[i].x - 40, HOUSE_SPOTS[i].front - 60, HOUSE_SPOTS[i].x + 40, HOUSE_SPOTS[i].front, h.color); });
    const dot = (x, y, r, c) => { m.fillStyle = c; m.beginPath(); m.arc(x * k, y * k, r, 0, Math.PI * 2); m.fill(); };
    dot(STORE.x, STORE.front, 3.5, '#d9644a');
    if (level.warehouse) rect(WH.x0, WH.y0, WH.x1, WH.y1, '#8a3b2e');
    for (const key in PILES) if (pileAmt[key] > 0) dot(PILES[key].x, PILES[key].y, 3, '#7fe08a');
    for (const g of GROUPS) if (UPGRADES.some(u => u.group === g.id && canBuy(u) && cash >= u.costs[level[u.id]])) dot(g.x, g.y, 2.5, '#fff3a6');
    for (const v of vans) dot(v.x, v.y, 1.6, '#fffaf0');
    for (const b of bots) dot(b.x, b.y, 1.6, '#e8b83a');
    // you, and the view
    m.strokeStyle = 'rgba(255,255,255,.6)'; m.lineWidth = 1;
    m.strokeRect(cam.x * k, (cam.y / TILT) * k, W * k, (H / TILT) * k);
    dot(player.x, player.y, 3.5, '#fffaf0'); dot(player.x, player.y, 2, '#2b2a22');
  }

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt);
    if (view3d()) R3.render(now / 1000); else render(now / 1000);
    if ((timers.map = (timers.map || 0) - dt) <= 0) { timers.map = 0.3; drawMap(); }
    requestAnimationFrame(frame);
  }

  // ---------- Saving ----------
  // Progress saves to the player's private slot on their account, with a copy in this browser.
  const SAVE_KEY = 'homestead-save';
  let saveRef = null, lastSaved = '', loadedAt = 0, lastCloud = 0;

  function snapshot() {
    return {
      v: 10, savedAt: Date.now(), px: Math.round(player.x), py: Math.round(player.y),
      carried: { ...carried }, stock: { ...stock }, wh: { ...wh }, pallet: { ...pallet },
      saw: { q: { ...saw.q }, out: saw.out }, shack: { sap: shack.sap, out: shack.out },
      workshop: { planks: workshop.planks, chair: workshop.chair, table: workshop.table }, showroom: { ...showroom },
      gen: { fuel: gen.fuel, pellets: gen.pellets }, mill: { chips: mill.chips, water: Math.floor(mill.water), out: mill.out },
      coalKiln: { oak: coalKiln.oak, out: coalKiln.out }, shackCoal: shack.coal, chips: saw.chips,
      stats, contract, research, dispatch, vstock: { ...vstock }, builder: { ...builder },
      houses: houses.map(h => ({ s: h.state, p: Math.round(h.p * 100) / 100 })),
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
    merge(gen, d.gen); merge(mill, d.mill); merge(coalKiln, d.coalKiln);
    shack.coal = d.shackCoal || 0; saw.chips = d.chips || 0;
    if (d.stats) { Object.assign(stats, d.stats); stats.sold = { ...(d.stats.sold || {}) }; }
    contract = d.contract || null;
    research = d.research || null;
    if (d.dispatch) { Object.assign(dispatch, d.dispatch); dispatch.reserve = { wood: 0, oak: 0, redwood: 0, ...(d.dispatch.reserve || {}) }; }
    merge(vstock, d.vstock); merge(builder, d.builder);
    merge(level, d.level); merge(paid, d.paid);
    cash = d.cash; served = d.served;
    // upgrades used to be paid off a bit at a time; give back anything that was part-paid
    for (const id in paid) { cash += paid[id] || 0; paid[id] = 0; }
    vans = []; ensureVans();
    houses = []; ensureHouses();
    applyYardMix();
    (d.houses || []).forEach((h, i) => { if (houses[i]) { houses[i].state = h.s; houses[i].p = h.p; } });
    villagers = [];
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
