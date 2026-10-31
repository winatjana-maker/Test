  // ---------- 3D view (beta) ----------
  // Draws the same game state with Three.js. The 2D canvas stays on top as a clear overlay for
  // labels, pop-up text, the guide arrow and the joystick, so input and HUD code are shared.
  // World px map to 3D units with S (40 px = 1 unit); heights given in screen px use HS.
  var R3 = (() => {
    if (typeof THREE === 'undefined') return null;
    const S = 1 / 40, HS = 1 / 32;
    let on = false, ready = false;
    let renderer, scene, camera, sun, canvas3;
    const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
    const vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    const vmatFade = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, transparent: true, opacity: 0.35, depthWrite: false });
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
      new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
    const G = {
      box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
      cyl: (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n),
      cone: (r, h, n = 7) => new THREE.ConeGeometry(r, h, n),
      ico: (r, d = 0) => new THREE.IcosahedronGeometry(r, d),
    };
    // one geometry from many coloured parts: [geometry, colour, matrix]
    function merged(parts) {
      const pos = [], col = [];
      for (const [g0, hex, m] of parts) {
        const g = g0.index ? g0.toNonIndexed() : g0.clone();
        if (m) g.applyMatrix4(m);
        const c = lin(hex), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); col.push(c.r, c.g, c.b); }
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      out.computeVertexNormals();
      return out;
    }
    const mesh = (geo, mat = vmat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
    const wx = x => x * S, wz = y => y * S;

    // ---------- Items (instanced: one draw call per kind) ----------
    const log = (bark, end, r = 0.15, len = 0.9) => [
      [G.cyl(r, r, len, 8), bark, M(0, 0, 0, 0, 0, Math.PI / 2)],
      [G.cyl(r * 0.85, r * 0.85, 0.02, 8), end, M(len / 2 + 0.005, 0, 0, 0, 0, Math.PI / 2)],
      [G.cyl(r * 0.85, r * 0.85, 0.02, 8), end, M(-len / 2 - 0.005, 0, 0, 0, 0, Math.PI / 2)],
    ];
    const ITEM_PARTS = {
      wood: log('#a0703f', '#f0cf98'),
      oak: log('#6b4a2c', '#d9a868'),
      redwood: log('#8a3b2e', '#e09a70', 0.2, 1.0),
      plank: [[G.box(0.95, 0.09, 0.28), '#e2b77a'], [G.box(0.95, 0.092, 0.03), '#c9965a', M(0, 0, 0.06)]],
      syrup: [[G.cyl(0.11, 0.11, 0.3, 8), '#c9771e', M(0, 0.15, 0)], [G.cyl(0.112, 0.112, 0.1, 8), '#fffaf0', M(0, 0.14, 0)],
        [G.cyl(0.045, 0.06, 0.1, 6), '#c9771e', M(0, 0.35, 0)], [G.cyl(0.05, 0.05, 0.05, 6), '#d9644a', M(0, 0.42, 0)]],
      sap: [[G.cyl(0.16, 0.12, 0.26, 8), '#9aa3ad', M(0, 0.13, 0)], [G.cyl(0.15, 0.15, 0.02, 8), '#e0a640', M(0, 0.25, 0)]],
      cash: [[G.box(0.5, 0.07, 0.28), '#56b45f'], [G.box(0.11, 0.075, 0.285), '#e9e1cf']],
      chair: [[G.box(0.36, 0.06, 0.36), '#a0703f', M(0, 0.24, 0)], [G.box(0.36, 0.36, 0.06), '#8a5a32', M(0, 0.45, -0.15)],
        [G.box(0.05, 0.24, 0.05), '#6e4526', M(0.14, 0.12, 0.14)], [G.box(0.05, 0.24, 0.05), '#6e4526', M(-0.14, 0.12, 0.14)],
        [G.box(0.05, 0.24, 0.05), '#6e4526', M(0.14, 0.12, -0.14)], [G.box(0.05, 0.24, 0.05), '#6e4526', M(-0.14, 0.12, -0.14)]],
      table: [[G.box(0.6, 0.06, 0.4), '#b5824a', M(0, 0.32, 0)], [G.box(0.05, 0.3, 0.05), '#6e4526', M(0.25, 0.15, 0.15)],
        [G.box(0.05, 0.3, 0.05), '#6e4526', M(-0.25, 0.15, 0.15)], [G.box(0.05, 0.3, 0.05), '#6e4526', M(0.25, 0.15, -0.15)],
        [G.box(0.05, 0.3, 0.05), '#6e4526', M(-0.25, 0.15, -0.15)]],
      chips: [[G.ico(0.17, 0), '#e3c08a']],
      paper: [[G.box(0.42, 0.14, 0.3), '#f4f1e8'], [G.box(0.43, 0.04, 0.31), '#7aa5c9']],
      pellets: [[G.box(0.34, 0.18, 0.26), '#b9a06a'], [G.box(0.2, 0.19, 0.27), '#8a6f3e']],
      charcoal: [[G.box(0.34, 0.2, 0.26), '#3a3532'], [G.box(0.35, 0.05, 0.27), '#d9644a']],
      water: [[G.cyl(0.14, 0.12, 0.26, 8), '#5aa0d0', M(0, 0.13, 0)]],
      chip_wood: [[G.box(0.08, 0.08, 0.08), '#e3b77e']],
      chip_leaf: [[G.box(0.08, 0.03, 0.08), '#5aa046']],
      chip_spark: [[G.box(0.08, 0.08, 0.08), '#fff3a6']],
    };
    const batches = {};
    const dummy = new THREE.Object3D(), tmpM = new THREE.Matrix4();
    function batch(kind) {
      if (!ITEM_PARTS[kind]) kind = 'chips';
      let b = batches[kind];
      if (!b) {
        const m = new THREE.InstancedMesh(merged(ITEM_PARTS[kind]), vmat, 700);
        m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
        scene.add(m);
        b = batches[kind] = { m, n: 0 };
      }
      return b;
    }
    function item(kind, x, y, z, ry = 0, s = 1, rx = 0) {
      const b = batch(kind);
      if (b.n >= 700) return;
      dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
      b.m.setMatrixAt(b.n++, dummy.matrix);
    }
    function itemOn(parent, kind, x, y, z, ry = 0, s = 1) {   // in a group's local space
      const b = batch(kind);
      if (b.n >= 700) return;
      dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
      tmpM.multiplyMatrices(parent.matrixWorld, dummy.matrix);
      b.m.setMatrixAt(b.n++, tmpM);
    }

    // ---------- Trees ----------
    const TREE = {};
    function makeTreeTemplates() {
      const mi = prestige.map;
      if (mi === 1) return snowTrees();
      if (mi === 2) return tropicTrees();
      TREE.pine = merged([[G.cyl(0.14, 0.2, 1.0, 6), '#7a4f2c', M(0, 0.5, 0)],
        [G.cone(1.1, 1.4), '#2f7a45', M(0, 1.4, 0)], [G.cone(0.88, 1.25), '#2a6e3f', M(0, 2.1, 0, 0, 0.6)], [G.cone(0.6, 1.1), '#34834a', M(0, 2.8, 0, 0, 1.2)]]);
      TREE.oak = merged([[G.cyl(0.18, 0.26, 1.3, 6), '#5e4129', M(0, 0.65, 0)],
        [G.ico(1.0), '#5f9a3a', M(0, 2.0, 0)], [G.ico(0.75), '#6aa843', M(0.6, 1.7, 0.25, 1, 2)], [G.ico(0.8), '#5a9236', M(-0.55, 1.8, -0.15, 2)],
        [G.ico(0.7), '#6aa843', M(0.1, 2.6, -0.15, 0.5, 1)]]);
      TREE.redwood = merged([[G.cyl(0.26, 0.4, 2.6, 7), '#9a4a2c', M(0, 1.3, 0)],
        [G.cone(1.3, 1.9), '#2d5e3a', M(0, 2.9, 0)], [G.cone(1.05, 1.7), '#33683f', M(0, 3.8, 0, 0, 0.7)], [G.cone(0.72, 1.5), '#2d5e3a', M(0, 4.6, 0, 0, 1.3)]]);
      TREE.maple = merged([[G.cyl(0.17, 0.24, 1.2, 6), '#6b4a2c', M(0, 0.6, 0)],
        [G.ico(0.95), '#e0702f', M(0, 1.9, 0)], [G.ico(0.7), '#d9502f', M(0.6, 1.6, 0.2, 1, 2)], [G.ico(0.72), '#f08a3a', M(-0.55, 1.7, -0.1, 2)],
        [G.ico(0.62), '#e66a2e', M(0.05, 2.5, -0.1, 0.5, 1)],
        [G.cyl(0.13, 0.1, 0.22, 7), '#9aa3ad', M(0, 0.55, 0.26)]]);
      TREE.stump = merged([[G.cyl(0.22, 0.28, 0.3, 7), '#7a4f2c', M(0, 0.15, 0)], [G.cyl(0.2, 0.2, 0.02, 7), '#e8c48e', M(0, 0.31, 0)]]);
    }
    const snowCap = (r, h, y, rot = 0) => [G.cone(r * 0.45, h * 0.42), '#f4f7f9', M(0, y + h * 0.29, 0, 0, rot)];
    function snowTrees() {
      TREE.pine = merged([[G.cyl(0.14, 0.2, 1.0, 6), '#5e4129', M(0, 0.5, 0)],
        [G.cone(1.1, 1.4), '#244f3c', M(0, 1.4, 0)], snowCap(1.1, 1.4, 1.4), [G.cone(0.88, 1.25), '#2b5e45', M(0, 2.1, 0, 0, 0.6)], snowCap(0.88, 1.25, 2.1, 0.6),
        [G.cone(0.6, 1.1), '#316b4e', M(0, 2.8, 0, 0, 1.2)], snowCap(0.6, 1.1, 2.8, 1.2)]);
      const birch = (leaves, extra = []) => merged([[G.cyl(0.15, 0.2, 1.6, 6), '#ece8df', M(0, 0.8, 0)],
        [G.box(0.31, 0.05, 0.1), '#3a3532', M(0, 0.5, 0.12)], [G.box(0.25, 0.05, 0.1), '#3a3532', M(0, 1.0, -0.12)], [G.box(0.22, 0.05, 0.1), '#3a3532', M(0.05, 1.35, 0.1)],
        [G.ico(0.85), leaves[0], M(0, 2.1, 0)], [G.ico(0.62), leaves[1], M(0.5, 1.8, 0.2, 1, 2)], [G.ico(0.66), leaves[2], M(-0.48, 1.9, -0.1, 2)],
        [G.ico(0.55), leaves[1], M(0.05, 2.7, -0.1, 0.5, 1)], ...extra]);
      TREE.oak = birch(['#e3c25a', '#d9b54a', '#efd27a']);
      TREE.maple = birch(['#f0a43a', '#e8903a', '#f5c45a'], [[G.cyl(0.13, 0.1, 0.22, 7), '#9aa3ad', M(0, 0.55, 0.24)]]);
      TREE.redwood = merged([[G.cyl(0.26, 0.4, 2.6, 7), '#6b3b2a', M(0, 1.3, 0)],
        [G.cone(1.3, 1.9), '#1c3f31', M(0, 2.9, 0)], snowCap(1.3, 1.9, 2.9), [G.cone(1.05, 1.7), '#214837', M(0, 3.8, 0, 0, 0.7)], snowCap(1.05, 1.7, 3.8, 0.7),
        [G.cone(0.72, 1.5), '#26513d', M(0, 4.6, 0, 0, 1.3)], snowCap(0.72, 1.5, 4.6, 1.3)]);
      TREE.stump = merged([[G.cyl(0.22, 0.28, 0.3, 7), '#5e4129', M(0, 0.15, 0)], [G.cyl(0.2, 0.2, 0.04, 7), '#f4f7f9', M(0, 0.32, 0)]]);
    }
    function tropicTrees() {
      const stalk = (x, z, h, lean) => [[G.cyl(0.07, 0.08, h, 6), '#7fb04a', M(x, h / 2, z, lean, 0, -lean)],
        [G.cyl(0.085, 0.085, 0.05, 6), '#5f8f3a', M(x + lean * h * 0.15, h * 0.3, z + lean * h * 0.15)],
        [G.cyl(0.085, 0.085, 0.05, 6), '#5f8f3a', M(x + lean * h * 0.3, h * 0.6, z + lean * h * 0.3)],
        [G.ico(0.32, 0), '#6aa843', M(x + lean * h * 0.5, h, z + lean * h * 0.5, 0, x * 5)]];
      TREE.pine = merged([...stalk(0, 0, 3.4, 0), ...stalk(0.25, 0.1, 3.0, 0.08), ...stalk(-0.2, 0.15, 2.7, -0.1), ...stalk(0.05, -0.25, 3.1, 0.05), ...stalk(-0.15, -0.15, 2.4, -0.06)]);
      TREE.oak = merged([[G.cyl(0.2, 0.3, 1.5, 6), '#7a3b28', M(0, 0.75, 0)],
        [G.ico(1.15), '#2f6b32', M(0, 2.0, 0, 0, 0, 0, 1.2, 0.7, 1.2)], [G.ico(0.8), '#3a7a3a', M(0.55, 2.4, 0.2, 1, 0, 0, 1, 0.7, 1)], [G.ico(0.8), '#245a2a', M(-0.5, 2.3, -0.2, 2, 0, 0, 1, 0.7, 1)]]);
      TREE.redwood = merged([[G.cyl(0.24, 0.36, 3.6, 7), '#8a5a32', M(0, 1.8, 0)],
        [G.ico(1.6), '#3d6e2f', M(0, 3.8, 0, 0, 0, 0, 1.3, 0.45, 1.3)], [G.ico(1.2), '#457836', M(0.3, 4.4, -0.2, 1, 0, 0, 1.2, 0.45, 1.2)], [G.ico(0.9), '#346430', M(-0.2, 4.9, 0.1, 2, 0, 0, 1, 0.45, 1)]]);
      const palm = [];
      for (let i = 0; i < 6; i++) palm.push([G.cyl(0.13 - i * 0.008, 0.15 - i * 0.008, 0.6, 7), i % 2 ? '#a8834f' : '#977445', M(i * i * 0.012, 0.3 + i * 0.58, 0, 0, 0, -i * 0.03)]);
      const top = V(0.3, 3.6, 0);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; palm.push([G.box(1.6, 0.05, 0.32), i % 2 ? '#4f9a3a' : '#468f36', M(top.x + Math.cos(a) * 0.7, top.y - 0.2, Math.sin(a) * 0.7, 0, -a, -0.35)]); }
      for (let i = 0; i < 3; i++) palm.push([G.ico(0.13, 0), '#6b4a2c', M(top.x + Math.cos(i * 2.1) * 0.15, top.y - 0.25, Math.sin(i * 2.1) * 0.15)]);
      TREE.maple = merged(palm);
      TREE.stump = merged([[G.cyl(0.22, 0.28, 0.3, 7), '#8a5a32', M(0, 0.15, 0)], [G.cyl(0.2, 0.2, 0.02, 7), '#e8c48e', M(0, 0.31, 0)]]);
    }
    const SKY = ['#bfe0ee', '#d8e6ef', '#a8e0f0'];
    const GRASS = [['#7fae4c', '#6c9c3f'], ['#e6edf1', '#d3dee5'], ['#8cc45a', '#77b04a']];
    const TUFT = ['#5f9a3a', '#b9c9d2', '#4f9a3a'];
    let groundMesh, slabs = [], tuftMat;
    function paintGround() {
      const [ca, cb] = GRASS[prestige.map] || GRASS[0], a = lin(ca), b = lin(cb), c = new THREE.Color();
      const pos = groundMesh.geometry.attributes.position, col = groundMesh.geometry.attributes.color;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const n = Math.sin(x * 0.35) * Math.cos(z * 0.29) * 0.5 + Math.sin(x * 0.9 + z * 0.7) * 0.25;
        c.copy(a).lerp(b, 0.5 + n * 0.5); col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
      for (const m of slabs) m.material.color.copy(lin(MAP().plaza));
      if (tuftMat) tuftMat.color.copy(lin(TUFT[prestige.map] || TUFT[0]));
      scene.background = lin(SKY[prestige.map] || SKY[0]); scene.fog.color.copy(scene.background);
    }
    function retheme() {
      if (!ready) return;
      paintGround();
      makeTreeTemplates();
      for (const m of treeMesh.values()) scene.remove(m.tree, m.stump);
      treeMesh.clear();
      for (const f of fallPool) for (const k in f.meshes) scene.remove(f.meshes[k]);
      fallPool.length = 0;
    }
    const treeMesh = new Map();
    const fallPool = [];

    // ---------- People ----------
    function person(o) {
      const g = new THREE.Group();
      const part = (parts, x, y, z) => { const m = mesh(merged(parts)); m.position.set(x, y, z); g.add(m); return m; };
      const leg = () => [[G.box(0.24, 0.6, 0.28), o.pants || '#34405a', M(0, -0.3, 0)], [G.box(0.26, 0.12, 0.36), '#1d1a17', M(0, -0.6, 0.05)]];
      const arm = () => [[G.box(0.2, 0.62, 0.24), o.shirt, M(0, -0.31, 0)], [G.box(0.18, 0.15, 0.2), o.skin, M(0, -0.69, 0)]];
      const head = [[G.ico(0.34, 1), o.skin], [new THREE.SphereGeometry(0.355, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.36), o.hair, M(0, 0.03, 0)],
        [G.box(0.07, 0.09, 0.04), '#1d1a17', M(-0.12, 0.05, 0.32)], [G.box(0.07, 0.09, 0.04), '#1d1a17', M(0.12, 0.05, 0.32)],
        [G.ico(0.07, 0), o.skin, M(-0.34, 0, 0)], [G.ico(0.07, 0), o.skin, M(0.34, 0, 0)]];
      if (o.beard) head.push([new THREE.SphereGeometry(0.352, 12, 6, Math.PI / 2 - 1.25, 2.5, Math.PI * 0.52, Math.PI * 0.36), o.hair]);
      if (o.hat) head.push([G.cyl(0.42, 0.42, 0.05, 10), o.hat, M(0, 0.2, 0)], [G.cyl(0.3, 0.33, 0.22, 10), o.hat, M(0, 0.32, 0)]);
      const p = {
        g, legL: part(leg(), -0.17, 0.66, 0), legR: part(leg(), 0.17, 0.66, 0),
        body: part([[G.box(0.72, 0.74, 0.44), o.shirt]], 0, 1.03, 0),
        armL: part(arm(), -0.47, 1.36, 0), armR: part(arm(), 0.47, 1.36, 0),
        head: part(head, 0, 1.72, 0), heading: 0,
      };
      g.scale.setScalar(o.scale || 1);
      scene.add(g);
      return p;
    }
    function animPerson(p, walk, moving) {
      const s = moving ? Math.sin(walk) * 0.7 : 0;
      p.legL.rotation.x = s; p.legR.rotation.x = -s; p.armL.rotation.x = -s * 0.8;
      if (!p.swinging) p.armR.rotation.x = s * 0.8;
      p.g.position.y = moving ? Math.abs(Math.sin(walk)) * 0.05 : 0;
    }

    // ---------- Vehicles ----------
    const wheel = (x, z, r = 0.22) => [G.cyl(r, r, 0.16, 10), '#2b2a22', M(x, r, z, 0, 0, Math.PI / 2)];
    const VEH = {};
    function makeVehicleTemplates() {
      VEH.lumber = merged([wheel(-0.4, 0.35), wheel(0.4, 0.35), wheel(-0.4, -0.35), wheel(0.4, -0.35),
        [G.box(0.9, 0.35, 1.2), '#e8b83a', M(0, 0.45, 0)], [G.box(0.6, 0.45, 0.42), '#e8b83a', M(0, 0.85, 0.3)],
        [G.box(0.5, 0.25, 0.05), '#bfe3f0', M(0, 0.9, 0.52)], [G.box(0.06, 0.06, 0.6), '#5f646c', M(0.35, 0.8, 0.75, 0.5)],
        [G.cyl(0.18, 0.18, 0.03, 12), '#c9ced6', M(0.35, 0.95, 1.05, 0, 0, Math.PI / 2)]]);
      VEH.truck = merged([wheel(-0.6, 0.9, 0.3), wheel(0.6, 0.9, 0.3), wheel(-0.6, -0.7, 0.3), wheel(0.6, -0.7, 0.3),
        [G.box(1.3, 0.3, 2.6), '#3c3c38', M(0, 0.55, 0)], [G.box(1.3, 0.9, 0.9), '#4f9d5a', M(0, 1.15, 0.9)],
        [G.box(1.1, 0.35, 0.05), '#bfe3f0', M(0, 1.35, 1.36)], [G.box(0.08, 0.7, 0.08), '#3c3c38', M(-0.6, 1.0, -0.4)],
        [G.box(0.08, 0.7, 0.08), '#3c3c38', M(0.6, 1.0, -0.4)], [G.box(0.08, 0.7, 0.08), '#3c3c38', M(-0.6, 1.0, -1.2)], [G.box(0.08, 0.7, 0.08), '#3c3c38', M(0.6, 1.0, -1.2)]]);
      VEH.forklift = merged([wheel(-0.35, 0.3, 0.18), wheel(0.35, 0.3, 0.18), wheel(-0.35, -0.3, 0.18), wheel(0.35, -0.3, 0.18),
        [G.box(0.8, 0.45, 0.9), '#e8a23a', M(0, 0.45, -0.05)], [G.box(0.7, 0.08, 0.6), '#3c3c38', M(0, 1.35, -0.1)],
        [G.box(0.05, 0.9, 0.05), '#3c3c38', M(-0.33, 0.95, -0.35)], [G.box(0.05, 0.9, 0.05), '#3c3c38', M(0.33, 0.95, -0.35)],
        [G.box(0.08, 1.4, 0.08), '#5f646c', M(-0.25, 0.75, 0.45)], [G.box(0.08, 1.4, 0.08), '#5f646c', M(0.25, 0.75, 0.45)],
        [G.box(0.08, 0.05, 0.7), '#5f646c', M(-0.18, 0.12, 0.8)], [G.box(0.08, 0.05, 0.7), '#5f646c', M(0.18, 0.12, 0.8)]]);
      VEH.sapbot = merged([wheel(-0.25, 0.2, 0.14), wheel(0.25, 0.2, 0.14), wheel(-0.25, -0.2, 0.14), wheel(0.25, -0.2, 0.14),
        [G.box(0.6, 0.3, 0.7), '#8a5bc4', M(0, 0.32, 0)], [G.cyl(0.18, 0.18, 0.4, 10), '#c9ced6', M(0, 0.67, -0.12)],
        [G.cyl(0.185, 0.185, 0.18, 10), '#e0a640', M(0, 0.58, -0.12)], [G.box(0.32, 0.26, 0.26), '#6b4a9a', M(0, 0.65, 0.22)],
        [G.box(0.18, 0.06, 0.02), '#ffe9a8', M(0, 0.67, 0.36)], [G.cyl(0.02, 0.02, 0.25, 4), '#5f646c', M(0, 0.9, 0.22)],
        [G.ico(0.05, 0), '#ff7a59', M(0, 1.04, 0.22)]]);
      VEH.van = merged([wheel(-0.5, 0.7, 0.24), wheel(0.5, 0.7, 0.24), wheel(-0.5, -0.7, 0.24), wheel(0.5, -0.7, 0.24),
        [G.box(1.1, 1.0, 2.1), '#f4f1e8', M(0, 0.85, 0)], [G.box(1.12, 0.14, 2.12), '#3d6fa8', M(0, 0.75, 0)],
        [G.box(0.95, 0.35, 0.05), '#bfe3f0', M(0, 1.1, 1.06)]]);
      VEH.car = c => merged([wheel(-0.45, 0.6), wheel(0.45, 0.6), wheel(-0.45, -0.6), wheel(0.45, -0.6),
        [G.box(1.0, 0.4, 1.8), c, M(0, 0.48, 0)], [G.box(0.85, 0.35, 0.95), c, M(0, 0.85, -0.1)], [G.box(0.8, 0.28, 0.97), '#bfe3f0', M(0, 0.86, -0.1)]]);
      VEH.drone = merged([[G.box(0.5, 0.18, 0.5), '#e8b83a'], [G.box(1.3, 0.05, 0.08), '#3c3c38', M(0, 0.05, 0, 0, Math.PI / 4)],
        [G.box(1.3, 0.05, 0.08), '#3c3c38', M(0, 0.05, 0, 0, -Math.PI / 4)],
        ...[[0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]].map(([x, z]) => [G.cyl(0.22, 0.22, 0.02, 10), '#c9ced6', M(x, 0.1, z)])]);
      VEH.loco = merged([wheel(-0.6, 1.0, 0.3), wheel(0.6, 1.0, 0.3), wheel(-0.6, -1.0, 0.3), wheel(0.6, -1.0, 0.3),
        [G.box(1.4, 0.3, 3.2), '#2b2a22', M(0, 0.5, 0)], [G.cyl(0.6, 0.6, 2.0, 12), '#c4413a', M(0, 1.25, 0.5, Math.PI / 2)],
        [G.box(1.4, 1.5, 1.1), '#c4413a', M(0, 1.4, -1.0)], [G.box(1.5, 0.12, 1.3), '#2b2a22', M(0, 2.2, -1.0)],
        [G.cyl(0.18, 0.22, 0.6, 8), '#2b2a22', M(0, 2.0, 1.2)]]);
      VEH.wagon = merged([wheel(-0.6, 1.0, 0.3), wheel(0.6, 1.0, 0.3), wheel(-0.6, -1.0, 0.3), wheel(0.6, -1.0, 0.3),
        [G.box(1.4, 0.3, 3.0), '#3c3c38', M(0, 0.5, 0)], [G.box(1.4, 0.7, 3.0), '#8a5a32', M(0, 1.0, 0)]]);
      VEH.ship = merged([[G.box(3.2, 1.4, 9.0), '#3d4a5a', M(0, 0.3, 0)], [G.box(3.25, 0.25, 9.05), '#c4413a', M(0, -0.25, 0)],
        [G.cone(1.6, 2.2, 4), '#3d4a5a', M(0, 0.3, 5.6, Math.PI / 2, Math.PI / 4)],
        [G.box(2.6, 1.8, 1.8), '#f4f1e8', M(0, 1.9, -3.2)], [G.box(2.7, 0.3, 0.3), '#bfe3f0', M(0, 2.3, -2.3)],
        [G.cyl(0.3, 0.35, 1.4, 8), '#c4413a', M(0, 3.4, -3.4)]]);
    }

    // ---------- Static scene ----------
    const groups = {};      // building groups by bump key
    const roofs = [];       // { mesh, R }
    let tileMeshes = [], groundSig = '', districtGroup;
    function makeGround() {
      const W3 = WORLD_W * S, H3 = WORLD_H * S;
      const g = new THREE.PlaneGeometry(W3, H3, 140, 140); g.rotateX(-Math.PI / 2); g.translate(W3 / 2, 0, H3 / 2);
      const pos = g.attributes.position, col = [], a = lin('#7fae4c'), b = lin('#6c9c3f'), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const n = Math.sin(x * 0.35) * Math.cos(z * 0.29) * 0.5 + Math.sin(x * 0.9 + z * 0.7) * 0.25;
        c.copy(a).lerp(b, 0.5 + n * 0.5); col.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
      ground.receiveShadow = true; scene.add(ground); groundMesh = ground;
      // dirt plaza + roads, rounded slabs a hair above the grass
      const slab = (cx, cy, w, d, color, y = 0.01, r = 0.6) => {
        const sh = new THREE.Shape(), x0 = -w / 2, z0 = -d / 2;
        sh.moveTo(x0 + r, z0); sh.lineTo(x0 + w - r, z0); sh.quadraticCurveTo(x0 + w, z0, x0 + w, z0 + r);
        sh.lineTo(x0 + w, z0 + d - r); sh.quadraticCurveTo(x0 + w, z0 + d, x0 + w - r, z0 + d);
        sh.lineTo(x0 + r, z0 + d); sh.quadraticCurveTo(x0, z0 + d, x0, z0 + d - r); sh.lineTo(x0, z0 + r); sh.quadraticCurveTo(x0, z0, x0 + r, z0);
        const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: lin(color), roughness: 1 }));
        m.position.set(cx, y, cy); m.receiveShadow = true; scene.add(m); return m;
      };
      slabs.push(slab(wx(CX + 40), wz(CY + 380), 2200 * S, 1440 * S, '#c9b48a'));
      slabs.push(slab(wx(CX - 440), wz(CY + 1180), 1280 * S, 400 * S, '#c9b48a'));
      for (const r of ROADS) slabs.push(slab(wx((r.x0 + r.x1) / 2), wz((r.y0 + r.y1) / 2), (r.x1 - r.x0) * S, (r.y1 - r.y0) * S, '#c9b48a', 0.012, 0.3));
      // sea
      const sea = new THREE.Mesh(new THREE.PlaneGeometry((WORLD_W - SEA.x0) * S, SEA.y1 * S), new THREE.MeshStandardMaterial({ color: lin('#4f8fb3'), roughness: 0.35, metalness: 0.1 }));
      sea.rotation.x = -Math.PI / 2; sea.position.set(wx((SEA.x0 + WORLD_W) / 2), 0.04, wz(SEA.y1 / 2)); sea.receiveShadow = true; scene.add(sea);
      const shore = new THREE.Mesh(new THREE.PlaneGeometry((WORLD_W - SEA.x0) * S, 0.5), new THREE.MeshStandardMaterial({ color: lin('#e3d3a6'), roughness: 1 }));
      shore.rotation.x = -Math.PI / 2; shore.position.set(wx((SEA.x0 + WORLD_W) / 2), 0.045, wz(SEA.y1) + 0.2); scene.add(shore);
      districtGroup = new THREE.Group(); scene.add(districtGroup);
      for (const id in DISTRICTS) {
        const d = DISTRICTS[id];
        const m = slab(wx((d.x0 + d.x1) / 2), wz((d.y0 + d.y1) / 2), (d.x1 - d.x0) * S, (d.y1 - d.y0) * S, d.ground, 0.015, 0.8);
        m.userData.id = id; scene.remove(m); districtGroup.add(m);
      }
    }
    function syncDistricts() {
      const sig = Object.keys(DISTRICTS).map(id => level[id] ? 1 : 0).join('');
      if (sig === groundSig) return;
      groundSig = sig;
      for (const m of districtGroup.children) m.material.color.copy(lin(level[m.userData.id] ? DISTRICTS[m.userData.id].ground : '#4a6a34'));
    }
    function makeDecor() {
      const tuft = G.cone(0.08, 0.36, 4); tuft.translate(0, 0.18, 0);
      const tufts = decor.filter(d => d.kind === 'tuft'), flowers = decor.filter(d => d.kind !== 'tuft');
      tuftMat = new THREE.MeshStandardMaterial({ color: lin('#5f9a3a'), flatShading: true });
      const im = new THREE.InstancedMesh(tuft, tuftMat, tufts.length);
      tufts.forEach((d, i) => { dummy.position.set(wx(d.x), 0, wz(d.y)); dummy.rotation.set(0, d.hue * 6, (d.hue - 0.5) * 0.4); dummy.scale.setScalar(0.8 + d.hue * 0.6); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
      scene.add(im);
      const fl = new THREE.InstancedMesh(G.ico(0.09, 0), new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), flowers.length);
      const fc = new THREE.Color();
      flowers.forEach((d, i) => { dummy.position.set(wx(d.x), 0.14, wz(d.y)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); fl.setMatrixAt(i, dummy.matrix); fl.setColorAt(i, fc.copy(lin(d.hue < 0.5 ? '#fff4c7' : '#f4a3b5'))); });
      scene.add(fl);
    }

    // gable roof over a box: ridge along x
    function roofGeo(w, d, rise, over = 0.35) {
      const sh = new THREE.Shape(); sh.moveTo(-d / 2 - over, 0); sh.lineTo(0, rise); sh.lineTo(d / 2 + over, 0); sh.lineTo(-d / 2 - over, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: w + over * 2, bevelEnabled: false });
      g.translate(0, 0, -(w + over * 2) / 2); g.rotateY(Math.PI / 2);
      return g;
    }
    // a walk-in building: floor, three walls and a front with a door gap, plus a fading roof
    function walkIn(key, B, o) {
      const g = new THREE.Group(); g.position.set(wx(B.x), 0, wz(B.front - B.d / 2)); scene.add(g);
      const w = B.w * S, d = B.d * S, h = o.h || 3.2, t = 0.25, door = (o.door || 70) * S, side = (w - door) / 2;
      const parts = [[G.box(w + 0.3, 0.16, d + 0.3), o.floor, M(0, 0.08, 0)],
        [G.box(w, h, t), o.wall, M(0, h / 2, -d / 2 + t / 2)],
        [G.box(t, h, d), o.wall, M(-w / 2 + t / 2, h / 2, 0)], [G.box(t, h, d), o.wall, M(w / 2 - t / 2, h / 2, 0)],
        [G.box(side, h, t), o.wall, M(-w / 2 + side / 2, h / 2, d / 2 - t / 2)], [G.box(side, h, t), o.wall, M(w / 2 - side / 2, h / 2, d / 2 - t / 2)],
        [G.box(door, h * 0.25, t), o.wall, M(0, h * 0.875, d / 2 - t / 2)],
        [G.box(w + 0.1, 0.18, t + 0.08), o.trim || '#6e4526', M(0, h, d / 2 - t / 2)],
        [G.box(0.9, 0.7, 0.06), '#bfe3f0', M(-w / 2 + side / 2, h * 0.55, d / 2 + 0.01)], [G.box(0.9, 0.7, 0.06), '#bfe3f0', M(w / 2 - side / 2, h * 0.55, d / 2 + 0.01)]];
      if (o.extra) parts.push(...o.extra(w, d, h));
      g.add(mesh(merged(parts)));
      const rm = new THREE.MeshStandardMaterial({ color: lin(o.roof), roughness: 0.8, flatShading: true, transparent: true });
      const roof = mesh(roofGeo(w, d, Math.min(2.2, d * 0.55)), rm); roof.position.y = h; g.add(roof);
      groups[key] = g;
      return { g, roof };
    }

    function makeStore() {
      const g = new THREE.Group(); g.position.set(wx(STORE.x), 0, wz(STORE.front)); scene.add(g);
      const w = STORE.w * S;
      // shop building behind the counter
      const parts = [[G.box(w + 0.6, 0.2, 4.6), '#9a948a', M(0, 0.1, -2.6)],
        [G.box(w, 3.4, 3.2), '#d9b27c', M(0, 1.9, -3.3)],
        ...[0, 1, 2, 3, 4, 5].map(i => [G.box(w + 0.02, 0.05, 3.22), '#b98a55', M(0, 0.6 + i * 0.5, -3.3)]),
        [G.box(1.1, 1.9, 0.08), '#6e4526', M(-1.6, 1.15, -1.66)], [G.box(1.2, 0.9, 0.08), '#bfe3f0', M(1.6, 1.9, -1.66)],
        [G.box(1.2, 0.9, 0.08), '#bfe3f0', M(-3.0, 1.9, -1.66)],
        // counter with four bins: pine, oak, planks, syrup
        [G.box(w, 0.8, 1.0), '#8a5a32', M(0, 0.4, -1.05)], [G.box(w + 0.1, 0.08, 1.1), '#c99a62', M(0, 0.82, -1.05)],
        ...[-2, -1, 0, 1, 2].map(i => [G.box(0.08, 0.3, 1.0), '#6e4526', M(i * 76 * S, 0.98, -1.05)]),
        // awning posts
        [G.box(0.18, 3.0, 0.18), '#6e4526', M(-w / 2 + 0.1, 1.5, -0.45)], [G.box(0.18, 3.0, 0.18), '#6e4526', M(w / 2 - 0.1, 1.5, -0.45)]];
      g.add(mesh(merged(parts)));
      const roof = mesh(roofGeo(w + 0.2, 3.2, 1.9), new THREE.MeshStandardMaterial({ color: lin('#b5523b'), roughness: 0.8, flatShading: true }));
      roof.position.set(0, 3.6, -3.3); g.add(roof);
      // striped awning over the counter
      const stripes = [];
      for (let i = 0; i < 16; i++) stripes.push([G.box(w / 16, 0.06, 1.7), i % 2 ? '#3f9d4f' : '#f4f1e8', M(-w / 2 + (i + 0.5) * w / 16, 0, 0)]);
      const aw = mesh(merged(stripes)); aw.position.set(0, 3.0, -1.0); aw.rotation.x = 0.28; g.add(aw);
      const sign = new THREE.CanvasTexture((() => {
        const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
        x.fillStyle = '#3a2a1c'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#fffaf0'; x.font = `600 56px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('LUMBER & CO', 256, 52); return c;
      })());
      sign.encoding = THREE.sRGBEncoding;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.9 }));
      board.position.set(0, 3.85, -1.66); g.add(board);
      groups.store = g;
    }

    function makeWarehouse(box, key, dx = 0) {
      const g = new THREE.Group(); const w = (box.x1 - box.x0) * S, d = (box.y1 - box.y0) * S, h = 4.2, t = 0.3;
      g.position.set(wx((box.x0 + box.x1) / 2), 0, wz((box.y0 + box.y1) / 2)); scene.add(g);
      const gapZ0 = (CY - 150 - box.y0) * S - d / 2, gapZ1 = (CY - 10 - box.y0) * S - d / 2;
      const parts = [[G.box(w, 0.12, d), '#a9a59a', M(0, 0.06, 0)],
        [G.box(w, h, t), '#8a3b2e', M(0, h / 2, -d / 2)], [G.box(t, h, d), '#8a3b2e', M(-w / 2, h / 2, 0)],
        [G.box(t, h, gapZ0 + d / 2), '#8a3b2e', M(w / 2, h / 2, (-d / 2 + gapZ0) / 2)],
        [G.box(t, h, d / 2 - gapZ1), '#8a3b2e', M(w / 2, h / 2, (gapZ1 + d / 2) / 2)],
        [G.box(0.4, h, 0.4), '#6b2c22', M(-w / 2, h / 2, d / 2)], [G.box(0.4, h, 0.4), '#6b2c22', M(w / 2, h / 2, d / 2)],
        [G.box(w + 0.3, 0.4, 0.4), '#6b2c22', M(0, h, d / 2)],
        ...[0, 1, 2, 3].map(i => [G.box(w + 0.02, 0.06, t + 0.02), '#a8493a', M(0, 0.9 + i, -d / 2)])];
      // three metal racks
      RACKS.forEach(ry => {
        const rz = (ry - box.y0) * S - d / 2, rx = (RACK.x + dx) * S - g.position.x, rw = RACK.w * S;
        for (const lvl of [0.15, 1.05, 1.95]) parts.push([G.box(rw, 0.06, 0.7), '#5f646c', M(rx, lvl, rz)]);
        for (const px of [-rw / 2, 0, rw / 2]) parts.push([G.box(0.07, 2.4, 0.07), '#3d6fa8', M(rx + px, 1.2, rz - 0.33)], [G.box(0.07, 2.4, 0.07), '#3d6fa8', M(rx + px, 1.2, rz + 0.33)]);
      });
      g.add(mesh(merged(parts)));
      const roof = mesh(roofGeo(w + 0.4, d, 1.6), new THREE.MeshStandardMaterial({ color: lin('#5f646c'), roughness: 0.7, flatShading: true, transparent: true }));
      roof.position.y = h + 0.2; g.add(roof);
      groups[key] = g;
      return { g, roof, box };
    }
    let whParts = [];

    function makeTiles() {
      const arrow = new THREE.Shape();
      arrow.moveTo(0, -0.55); arrow.lineTo(0.5, -0.05); arrow.lineTo(0.2, -0.05); arrow.lineTo(0.2, 0.45); arrow.lineTo(-0.2, 0.45); arrow.lineTo(-0.2, -0.05); arrow.lineTo(-0.5, -0.05); arrow.closePath();
      const ag = new THREE.ExtrudeGeometry(arrow, { depth: 0.08, bevelEnabled: false }); ag.rotateX(Math.PI / 2);
      const am = new THREE.MeshStandardMaterial({ color: lin('#fffaf0'), roughness: 0.6 });
      tileMeshes = GROUPS.map(gp => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE * S, 0.16, TILE_SIZE * S), new THREE.MeshStandardMaterial({ color: lin('#6f9c6a'), roughness: 0.7 }));
        m.position.set(wx(gp.x), 0.08, wz(gp.y)); m.receiveShadow = true; scene.add(m);
        const a = new THREE.Mesh(ag, am); a.position.set(wx(gp.x), 0.26, wz(gp.y)); a.castShadow = true; scene.add(a);
        return { m, a, gp };
      });
    }
    const zoneMat = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.8, transparent: true, opacity: 0.85 });
    let zones = [];
    function makeZones() {
      const z = (r, color, show) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(r.w * S, 0.06, r.d * S), zoneMat(color));
        m.position.set(wx(r.x), 0.03, wz(r.y)); m.receiveShadow = true; scene.add(m); zones.push({ m, show });
      };
      z(DROP, '#f4f1e8', () => true);
      z(SAW_IN, '#f4f1e8', () => level.sawmill);
      z(SHACK_IN, '#f4f1e8', () => level.shack);
      z({ ...BOT_HOME.lumber, w: 56, d: 56 }, '#e8b83a', () => level.lumber);
      z({ ...BOT_HOME.truck, w: 90, d: 56 }, '#e8b83a', () => level.truck);
      for (const key of ['store', 'dock']) {
        const p = PILES[key];
        const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r * S, p.r * S, 0.04, 24), zoneMat('#7cc488'));
        m.position.set(wx(p.x), 0.02, wz(p.y)); scene.add(m); zones.push({ m, show: () => key === 'store' || level.dock });
      }
    }

    // simple stand-ins for buildings that get full 3D treatment in later rounds
    let props = [];
    function prop(show, x, y, parts, key) {
      const m = mesh(merged(parts)); m.position.set(wx(x), 0, wz(y)); scene.add(m);
      props.push({ m, show }); if (key) groups[key] = m;
      return m;
    }
    function makeProps() {
      for (const R of ROOFED) {
        const extra = {
          sawmill: (w, d) => [[G.box(1.6, 0.9, 0.8), '#5f646c', M(0, 0.6, -d / 4)], [G.cyl(0.45, 0.45, 0.05, 16), '#c9ced6', M(0, 1.2, -d / 4, Math.PI / 2)]],
          shack: (w, d) => [[G.cyl(0.7, 0.7, 0.9, 10), '#5f646c', M(0, 0.55, -d / 4)], [G.box(0.4, 1.6, 0.4), '#7d776d', M(w / 3, 4, -d / 3)]],
          generator: (w, d) => [[G.box(1.8, 1.2, 1.0), '#3c4654', M(0, 0.7, -d / 4)], [G.cyl(0.25, 0.3, 2.2, 8), '#5f646c', M(w / 3, 4.2, -d / 3)]],
          papermill: (w, d) => [[G.cyl(0.5, 0.5, 2.6, 12), '#c9ced6', M(0, 0.9, -d / 4, 0, 0, Math.PI / 2)]],
          workshop: (w, d) => [[G.box(1.6, 0.8, 0.8), '#b5824a', M(0, 0.5, -d / 4)]],
          lab: (w, d) => [[G.box(1.6, 0.9, 0.7), '#f4f1e8', M(0, 0.55, -d / 4)], [G.cyl(0.6, 0.2, 0.4, 10), '#c9ced6', M(w / 3, 3.9, -d / 4, 0.6)]],
          rail: () => [], hq: () => [], dispatch: (w, d) => [[G.cyl(0.04, 0.04, 2.0, 4), '#5f646c', M(w / 3, 4.2, 0)]],
        }[R.key];
        const o = { wall: R.wall, roof: R.roof, floor: R.floor, door: R.door || 70, h: R.key === 'hq' ? 4.6 : 3.2, extra };
        const b = walkIn(R.key, R.B, o);
        roofs.push({ ...b, R });
      }
      // showroom: glass front
      prop(() => level.showroom, SHOWROOM.x, SHOWROOM.front - SHOWROOM.d / 2, [[G.box(SHOWROOM.w * S, 2.8, SHOWROOM.d * S), '#e9e4da', M(0, 1.4, 0)],
        [G.box(SHOWROOM.w * S - 0.4, 1.8, 0.06), '#bfe3f0', M(0, 1.3, SHOWROOM.d * S / 2 + 0.01)], [G.box(SHOWROOM.w * S + 0.3, 0.3, SHOWROOM.d * S + 0.3), '#3c4654', M(0, 2.9, 0)]]);
      const belt3 = (BELT.x1 - BELT.x0) * S;
      prop(() => level.conveyor, (BELT.x0 + BELT.x1) / 2, BELT.y, [[G.box(belt3, 0.12, 0.7), '#3c3c38', M(0, 0.68, 0)],
        [G.box(belt3, 0.16, 0.08), '#e8b83a', M(0, 0.7, 0.38)], [G.box(belt3, 0.16, 0.08), '#e8b83a', M(0, 0.7, -0.38)],
        ...Array.from({ length: 9 }, (_, i) => [G.box(0.1, 0.62, 0.6), '#5f646c', M(-belt3 / 2 + 0.2 + i * (belt3 - 0.4) / 8, 0.31, 0)])]);
      prop(() => level.ads, BILLBOARD.x, BILLBOARD.y, [[G.box(0.15, 2.4, 0.15), '#5f646c', M(-1.2, 1.2, 0)], [G.box(0.15, 2.4, 0.15), '#5f646c', M(1.2, 1.2, 0)],
        [G.box(3.2, 1.6, 0.12), '#fffaf0', M(0, 3.0, 0)], [G.box(2.8, 1.2, 0.13), '#3f9d4f', M(0, 3.0, 0)]]);
      prop(() => level.pump, PUMP.x, PUMP.front - PUMP.d / 2, [[G.box(PUMP.w * S, 1.4, PUMP.d * S), '#6a6f78', M(0, 0.7, 0)], [G.cyl(0.18, 0.18, 1.2, 8), '#3d6fa8', M(0.6, 1.8, 0)]]);
      prop(() => level.charcoal, KILN.x, KILN.front - KILN.d / 2, [[G.box(KILN.w * S, 0.3, KILN.d * S), '#9a948a', M(0, 0.15, 0)],
        [new THREE.SphereGeometry(1.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#8a4a32', M(-0.9, 0.3, 0)], [new THREE.SphereGeometry(1.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#8a4a32', M(1.4, 0.3, 0)],
        [G.cyl(0.18, 0.22, 1.4, 8), '#3a3532', M(-0.9, 1.9, 0)]]);
      prop(() => level.pump, POND.x, POND.y, [[G.cyl(2.2, 2.2, 0.05, 20), '#4f8fb3', M(0, 0.03, 0, 0, 0, 0, 1, 1, 0.6)]]);
      for (const c of CRANES) prop(() => level.cranes, c.x, c.y, [[G.box(0.6, 7, 0.6), '#e8b83a', M(0, 3.5, 0)], [G.box(0.5, 0.5, 6), '#e8b83a', M(0, 7, -1.5)],
        [G.box(1.2, 1, 1.2), '#3c4654', M(0, 6.6, 0.6)], [G.cyl(0.02, 0.02, 3, 4), '#2b2a22', M(0, 5.5, -4)]]);
      prop(() => level.harbor, (PIER.x0 + PIER.x1) / 2, (PIER.y0 + PIER.y1) / 2, [[G.box((PIER.x1 - PIER.x0) * S, 0.3, (PIER.y1 - PIER.y0) * S), '#8a5a32', M(0, 0.25, 0)]]);
      prop(() => level.builder, BUILDER.x, BUILDER.front - BUILDER.d / 2, [[G.box(BUILDER.w * S, 0.12, BUILDER.d * S), '#b49a74', M(0, 0.06, 0)],
        ...[-1, 1].map(s => [G.box(BUILDER.w * S, 0.9, 0.1), '#8a5a32', M(0, 0.45, s * BUILDER.d * S / 2)]),
        [G.box(1.6, 0.6, 0.8), '#e2b77a', M(-1.2, 0.4, -0.6)], [G.box(1.2, 0.5, 0.7), '#9a4a2c', M(1.2, 0.35, -0.6)]]);
      prop(() => level.rail, WORLD_W / 2, TRACK_Y, [[G.box(WORLD_W * S, 0.08, 0.1), '#7d776d', M(0, 0.1, -0.7)], [G.box(WORLD_W * S, 0.08, 0.1), '#7d776d', M(0, 0.1, 0.7)],
        ...Array.from({ length: 70 }, (_, i) => [G.box(0.3, 0.06, 2.0), '#6e4526', M(-WORLD_W * S / 2 + i * WORLD_W * S / 70, 0.04, 0)])]);
    }

    // ---------- Init ----------
    function init() {
      canvas3 = document.getElementById('game3d');
      renderer = new THREE.WebGLRenderer({ canvas: canvas3, antialias: true });
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      scene = new THREE.Scene();
      scene.background = lin('#bfe0ee'); scene.fog = new THREE.Fog(lin('#bfe0ee'), 45, 95);
      camera = new THREE.PerspectiveCamera(40, 1, 0.5, 220);
      scene.add(new THREE.HemisphereLight(lin('#dff1ff'), lin('#6b7a3a'), 0.55));
      sun = new THREE.DirectionalLight(lin('#fff1d6'), 1.7);
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
      sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
      scene.add(sun, sun.target);
      makeTreeTemplates(); makeVehicleTemplates();
      makeGround(); makeDecor(); makeStore(); makeTiles(); makeZones(); makeProps();
      whParts = [makeWarehouse(WH, 'warehouse'), makeWarehouse(ANNEX, 'annex', ANNEX_DX)];
      ready = true;
      paintGround();
      resize();
    }
    function resize() {
      if (!ready) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.fov = camera.aspect < 0.8 ? 46 : 34;
      camera.updateProjectionMatrix();
    }

    // ---------- Projection for the 2D overlay ----------
    const pv = new THREE.Vector3();
    function project(x, y) {
      if (!ready) return [x - cam.x, y * TILT - cam.y];
      pv.set(x * S, 0, y * S).project(camera);
      return [(pv.x + 1) / 2 * Wc / ZOOM, (1 - pv.y) / 2 * Hc / ZOOM];
    }
    const ray = new THREE.Vector3(), out = new THREE.Vector3();
    function unproject(sx, sy, h = 1.1) {   // overlay px → point on the plane at height h
      ray.set(sx * ZOOM / Wc * 2 - 1, -(sy * ZOOM / Hc) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
      const t = (h - camera.position.y) / ray.y;
      return out.copy(camera.position).addScaledVector(ray, t).clone();
    }

    // ---------- Per-frame sync ----------
    const entityMesh = new Map();
    function persistent(e, make) {
      let m = entityMesh.get(e);
      if (!m) { m = make(); entityMesh.set(e, m); }
      m.seen = true;
      return m;
    }
    function face(m, x, z, dt, fallback) {
      const g = m.g || m, last = m.last || (m.last = { x, z });
      const dx = x - last.x, dz = z - last.z, d = Math.hypot(dx, dz);
      if (d > 0.002) m.heading = Math.atan2(dx, dz);
      else if (fallback !== undefined && m.heading === undefined) m.heading = fallback;
      last.x = x; last.z = z;
      let a = (m.heading || 0) - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
      g.rotation.y += a * Math.min(1, dt * 10);
      return d / Math.max(dt, 1e-3);
    }
    const bump = key => {
      const t0 = bumps[key];
      if (t0 === undefined) return [1, 1];
      const p = (performance.now() - t0) / 650;
      if (p >= 1) { delete bumps[key]; return [1, 1]; }
      const e = Math.sin(p * Math.PI * 3) * (1 - p);
      return [1 - 0.07 * e, 1 + 0.14 * e];
    };

    let playerP = null, axe;
    const look = new THREE.Vector3(), CAM = new THREE.Vector3(0, 25, 20);
    let lastT = 0;
    function render(time) {
      if (!ready) return;
      const dt = Math.min(0.05, lastT ? time - lastT : 0.016); lastT = time;
      for (const k in batches) batches[k].n = 0;
      for (const m of entityMesh.values()) m.seen = false;
      syncDistricts();

      // camera follows the player
      const px = wx(player.x), pz = wz(player.y);
      if (!look.lengthSq()) look.set(px, 0.8, pz);
      look.lerp(V(px, 0.8, pz), Math.min(1, dt * 6));
      camera.position.copy(look).add(CAM); camera.lookAt(look);
      camera.updateMatrixWorld();
      sun.position.set(look.x - 14, 26, look.z + 10); sun.target.position.copy(look);

      // buildings: visibility, bounce, roof fade
      const sq = (g, key) => { const [sx, sy] = bump(key); g.scale.set(sx, sy, sx); };
      sq(groups.store, 'store');
      for (const r of roofs) {
        const vis = builtR(r.R); r.g.visible = vis; if (!vis) continue;
        sq(r.g, r.R.key);
        const a = r.R.a ?? 1; r.roof.material.opacity = a; r.roof.material.depthWrite = a > 0.95; r.roof.castShadow = a > 0.5;
      }
      whParts[0].g.visible = level.warehouse > 0; whParts[1].g.visible = level.annex > 0;
      for (const p of whParts) {
        const b = p.box, inside = player.x > b.x0 && player.x < b.x1 && player.y > b.y0 - 60 && player.y < b.y1 + 10;
        const a = p.roof.material.opacity + ((inside ? 0.08 : 1) - p.roof.material.opacity) * Math.min(1, dt * 8);
        p.roof.material.opacity = a; p.roof.material.depthWrite = a > 0.95;
      }
      for (const z of zones) z.m.visible = !!z.show();
      for (const p of props) p.m.visible = !!p.show();
      for (const t of tileMeshes) {
        const items = UPGRADES.filter(u => u.group === t.gp.id), open = items.filter(canBuy);
        const onT = inRect(t.gp, TILE_SIZE, TILE_SIZE), afford = open.some(u => cash >= u.costs[level[u.id]]);
        const isMove = t.gp.id === 'move', ok = isMove ? moveGain() > 0 : afford;
        t.m.material.color.copy(lin(onT ? '#9a9a8c' : isMove ? (ok ? '#6f9c6a' : '#7c7c72') : !open.length ? '#9cc27f' : afford ? '#6f9c6a' : '#7c7c72'));
        t.a.position.y = 0.26 + Math.abs(Math.sin(time * 2 + t.gp.x)) * 0.12;
      }

      // store shelves
      Object.keys(SHELF_BASE).forEach(kind => {
        const n = Math.min(stock[kind], SHELF_SHOW), bx = wx(STORE.x) + (SHELF_BASE[kind] + 38) * S, bz = wz(STORE.front) - 1.05;
        for (let i = 0; i < n; i++) {
          if (kind === 'syrup') item('syrup', bx - 0.72 + (i % 5) * 0.36, 0.86 + Math.floor(i / 5) * 0.0, bz - 0.36 + Math.floor(i / 5) * 0.18);
          else if (kind === 'plank') item('plank', bx + (i % 2 ? 0.2 : -0.2), 0.9 + Math.floor(i / 2) * 0.1, bz, Math.PI / 2 + (i % 2) * 0.1, 0.9);
          else { const layer = Math.floor(i / 5), k = i % 5; item(kind, bx - 0.72 + k * 0.36 + (layer % 2) * 0.18, 1.02 + layer * 0.28, bz, Math.PI / 2, 0.95); }
        }
      });
      // warehouse racks and the annex
      if (level.warehouse) {
        const per = Math.max(1, whCap() / 3 / 57);
        RACK_KIND.forEach((kind, i) => {
          const total = Math.ceil(wh[kind] / per), rz = wz(RACKS[i]);
          for (const [dx, share] of [[0, level.annex ? 0.5 : 1], [ANNEX_DX, level.annex ? 0.5 : 0]]) {
            const n = Math.min(57, Math.ceil(total * share)), x0 = wx(RACK.x + dx - RACK.w / 2) + 0.2;
            for (let j = 0; j < n; j++) item(kind, x0 + (j % 19) * 0.34, 0.33 + Math.floor(j / 19) * 0.9, rz, Math.PI / 2, 0.85);
          }
        });
        // pallets
        const kinds = []; for (const k in pallet) for (let i = 0; i < pallet[k]; i++) kinds.push(k);
        for (let i = 0; i < palletCount(); i++) {
          const p = PALLETS[i], x = wx(p.x), z = wz(p.y);
          item('plank', x, 0.06, z - 0.25, 0, 1.4); item('plank', x, 0.06, z + 0.25, 0, 1.4);
          const mine = kinds.filter((_, j) => j % palletCount() === i).slice(0, 12);
          mine.forEach((k, j) => item(k, x - 0.36 + (j % 3) * 0.36, 0.3 + Math.floor(j / 3) * 0.3, z, Math.PI / 2, 0.95));
        }
      }
      if (level.conveyor) {
        for (const it of belt) item(it.kind, wx(BELT.x0 + it.d), 0.88, wz(BELT.y), Math.PI / 2, 0.85);
      }
      // cash piles
      for (const key in PILES) {
        if (key !== 'store' && !level[key]) continue;
        const p = PILES[key], n = Math.min(Math.ceil(pileAmt[key] / 5), 72);
        for (let i = 0; i < n; i++) { const L = Math.floor(i / 4), k = i % 4; item('cash', wx(p.x) + (k % 2) * 0.54 - 0.27, 0.05 + L * 0.08, wz(p.y) + Math.floor(k / 2) * 0.3 - 0.15, (L * 0.37) % 0.3 - 0.15); }
      }

      // trees and maples near the camera
      const R2 = 34 * 34;
      for (const n of nodes) {
        const x = wx(n.x), z = wz(n.y), d2 = (x - look.x) ** 2 + (z - look.z - 4) ** 2;
        let m = treeMesh.get(n);
        if (d2 > R2) { if (m) m.visible = false; continue; }
        const kind = n.type === 'maple' ? 'maple' : n.species;
        if (!m) { m = { tree: mesh(TREE[kind]), stump: mesh(TREE.stump) }; m.tree.position.set(x, 0, z); m.stump.position.set(x, 0, z); m.tree.rotation.y = (n.x * 7 + n.y) % 6; scene.add(m.tree, m.stump); treeMesh.set(n, m); }
        m.visible = true;
        let s = n.size || 1, up = true;
        if (n.type !== 'maple' && n.hp <= 0) {
          if (!n.farm || n.grow < 0.08) up = false;
          else s *= 0.3 + 0.55 * n.grow;
        }
        m.tree.visible = up; m.stump.visible = !up || (n.type !== 'maple' && n.hp <= 0);
        m.stump.scale.setScalar(n.size || 1);
        m.tree.scale.setScalar(s);
        m.tree.rotation.z = Math.sin((n.shake || 0) * 30) * (n.shake || 0) * 0.08;
        // see-through when it stands between the camera and you
        const hides = Math.abs(x - wx(player.x)) < 1.6 * s && z - wz(player.y) > 0 && z - wz(player.y) < 3.2 * s;
        m.tree.material = hides ? vmatFade : vmat; m.tree.castShadow = !hides;
      }
      for (const [n, m] of treeMesh) if (!m.visible) { m.tree.visible = m.stump.visible = false; }
      // falling trees
      let fi = 0;
      for (const f of fx) {
        if (f.type !== 'fall') continue;
        let m = fallPool[fi];
        if (!m) { m = { meshes: {} }; fallPool[fi] = m; }
        for (const k in m.meshes) m.meshes[k].visible = false;
        const mm = m.meshes[f.species] || (m.meshes[f.species] = (() => { const t = mesh(TREE[f.species] || TREE.pine); scene.add(t); return t; })());
        const p = f.t / f.life, e = Math.min(1, p / 0.7);
        mm.visible = true; mm.position.set(wx(f.x), 0, wz(f.y)); mm.rotation.set(0, 0, -f.dir * e * e * Math.PI / 2);
        mm.scale.setScalar((f.size || 1) * (p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1));
        fi++;
      }
      for (let i = fi; i < fallPool.length; i++) for (const k in fallPool[i].meshes) fallPool[i].meshes[k].visible = false;
      for (const f of fx) if (f.type === 'chip' && f.kind !== 'dust') item('chip_' + f.kind, wx(f.x), f.h * HS, wz(f.y), f.t * 8);

      // the player
      if (!playerP) {
        playerP = person({ skin: '#5b3a24', shirt: '#d9644a', hair: '#16120f', beard: true, scale: 1.05 });
        axe = new THREE.Group();
        axe.add(mesh(merged([[G.box(0.08, 0.8, 0.08), '#8a5a32', M(0, -0.1, 0)], [G.box(0.06, 0.26, 0.3), '#c9ced6', M(0, 0.22, 0.14)]])));
        axe.position.set(0, -0.72, 0.1); axe.rotation.x = Math.PI / 2; playerP.armR.add(axe);
      }
      playerP.g.position.x = px; playerP.g.position.z = pz;
      const n = gather.node, chopping = n && n.type !== 'maple';
      if (n) playerP.heading = Math.atan2(wx(n.x) - px, wz(n.y) - pz);
      const spd = face(playerP, px, pz, dt);
      animPerson(playerP, player.walk, spd > 0.6);
      playerP.swinging = chopping; axe.visible = !!chopping;
      if (chopping) {
        const ph = (player.swing / gatherTime() * 2) % 1;
        playerP.armR.rotation.x = ph < 0.7 ? -2.4 * (ph / 0.7) : -2.4 + (ph - 0.7) / 0.3 * 2.6;
      }
      playerP.g.updateMatrixWorld();
      stack.slice(-STACK_SHOW).forEach((k, i) => itemOn(playerP.g, k, 0, 0.9 + i * 0.2, -0.48, 0, 0.9));

      // customers
      for (const c of customers) {
        const p = persistent(c, () => person({ skin: c.skin, shirt: c.shirt, hair: c.hair }));
        const x = wx(c.x), z = wz(c.y); p.g.position.x = x; p.g.position.z = z;
        const sp = face(p, x, z, dt, Math.PI);
        if (c.state !== 'leave' && sp < 0.3) p.heading = Math.PI;
        animPerson(p, c.walk, sp > 0.3);
        p.g.updateMatrixWorld();
        for (let i = 0; i < Math.min(c.got, 8); i++) itemOn(p.g, c.kind, 0, 1.0 + i * 0.2, 0.45, 0, 0.85);
      }
      for (const v of villagers) {
        const p = persistent(v, () => person({ skin: SKINS[v.i % SKINS.length], shirt: SHIRTS[(v.i * 3) % SHIRTS.length], hair: HAIR[v.i % HAIR.length], scale: 0.95 }));
        const x = wx(v.x), z = wz(v.y); p.g.position.x = x; p.g.position.z = z;
        p.g.visible = v.state !== 'home' && v.state !== 'inside';
        animPerson(p, v.walk, face(p, x, z, dt) > 0.3);
      }
      // bots, haulers, vans
      for (const b of bots) {
        const m = persistent(b, () => { const g = new THREE.Group(); g.add(mesh(VEH[b.id === 'truck' ? 'truck' : 'lumber'])); scene.add(g); return { g }; });
        const x = wx(b.x), z = wz(b.y); m.g.position.set(x, b.state === 'seek' || b.state === 'return' ? Math.abs(Math.sin(b.bounce || 0)) * 0.04 : 0, z);
        face(m, x, z, dt); m.g.updateMatrixWorld();
        const big = b.id === 'truck';
        b.load.slice(0, big ? 24 : 10).forEach((k, i) => itemOn(m.g, k, big ? (i % 3 - 1) * 0.36 : 0, (big ? 0.9 : 0.75) + Math.floor(i / (big ? 3 : 1)) * 0.26, big ? -0.8 : -0.25, 0, 0.9));
      }
      for (const h of haulers) {
        const m = persistent(h, () => {
          if (h.id === 'porter' || h.id === 'tapper') return person({ skin: h.id === 'tapper' ? '#c68e62' : '#4a2c1a', shirt: h.id === 'tapper' ? '#8a5bc4' : '#e0a63a', hair: '#16120f', hat: h.id === 'tapper' ? '#5a3a28' : '#e8c54a' });
          const g = new THREE.Group(); g.add(mesh(VEH[h.id === 'sapbot' ? 'sapbot' : 'forklift'])); scene.add(g); return { g };
        });
        const x = wx(h.x), z = wz(h.y); m.g.position.x = x; m.g.position.z = z;
        const sp = face(m, x, z, dt);
        if (m.legL) animPerson(m, h.walk, sp > 0.3);
        m.g.updateMatrixWorld();
        const ld = h.load.slice(0, 12);
        if (h.id === 'forklift') ld.forEach((k, i) => itemOn(m.g, k, (i % 2 - 0.5) * 0.36, 0.3 + Math.floor(i / 2) * 0.28, 0.8, Math.PI / 2, 0.9));
        else if (m.legL) ld.slice(0, 8).forEach((k, i) => itemOn(m.g, k, 0, 1.0 + i * 0.2, 0.45, 0, 0.85));
      }
      for (const v of vans) {
        const m = persistent(v, () => { const g = new THREE.Group(); g.add(mesh(VEH.van)); scene.add(g); return { g }; });
        const x = wx(v.x), z = wz(v.y); m.g.position.set(x, 0, z); face(m, x, z, dt);
      }
      // drone, delivery truck, buyer car, train, ship, houses
      single('drone', !!level.drone, VEH.drone, wx(drone.x), 3.6 + Math.sin(time * 3) * 0.15, wz(drone.y), dt, true);
      single('dtruck', !!level.dock && truck.state !== 'away', VEH.truck, wx(truck.x), 0, wz(DOCK.y), dt);
      single('car', !!level.showroom && car.state !== 'away', VEH.car(car.color), wx(CAR.x), 0, wz(car.y), dt);
      single('loco', !!level.rail && train.state !== 'away', VEH.loco, wx(train.x), 0, wz(TRACK_Y), dt, false, Math.PI / 2);
      for (let i = 0; i < 3; i++) single('wagon' + i, !!level.rail && train.state !== 'away', VEH.wagon, wx(train.x - 110 - i * 135), 0, wz(TRACK_Y), dt, false, Math.PI / 2);
      single('ship', !!level.harbor && ship.state !== 'away', VEH.ship, wx(ship.x), 0, wz(SHIP.y), dt, false, -Math.PI / 2);
      houses.forEach((h, i) => {
        const B = HOUSE_SPOTS[i];
        const m = persistent('house' + i, () => ({ g: new THREE.Group(), color: null }));
        if (!m.g.parent) { m.g.position.set(wx(B.x), 0, wz(B.front - B.d / 2)); scene.add(m.g); }
        const key = h.state + h.color;
        if (m.color !== key) {
          m.color = key; m.g.clear();
          const w = B.w * S, d = B.d * S;
          if (h.state === 'done') {
            m.g.add(mesh(merged([[G.box(w, 2.2, d), '#f4f1e8', M(0, 1.1, 0)], [G.box(0.6, 1.2, 0.06), '#6e4526', M(0, 0.6, d / 2 + 0.01)],
              [G.box(0.6, 0.5, 0.06), '#bfe3f0', M(-w / 3, 1.3, d / 2 + 0.01)], [G.box(0.6, 0.5, 0.06), '#bfe3f0', M(w / 3, 1.3, d / 2 + 0.01)]])));
            const r = mesh(roofGeo(w, d, 1.3), new THREE.MeshStandardMaterial({ color: lin(h.color || '#a5483a'), flatShading: true })); r.position.y = 2.2; m.g.add(r);
          } else if (h.state === 'building') {
            m.g.add(mesh(merged([[G.box(w, 0.12, d), '#b49a74', M(0, 0.06, 0)], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [G.box(0.12, 2.2, 0.12), '#c99a62', M(a * w / 2, 1.1, b * d / 2)])])));
          }
        }
        const [sx, sy] = bump('house' + i); m.g.scale.set(sx, sy, sx);
      });

      // flying items: overlay positions turned back into 3D points
      for (const f of fx) {
        if (f.type !== 'fly') continue;
        if (!f.w0) f.w0 = unproject(f.x0, f.y0);
        const [tx, ty] = typeof f.to === 'function' ? f.to() : f.to;
        const w1 = unproject(tx, ty), p = f.t / f.life, e = p * (2 - p);
        item(f.kind, f.w0.x + (w1.x - f.w0.x) * e, f.w0.y + (w1.y - f.w0.y) * e + Math.sin(p * Math.PI) * f.lift * HS, f.w0.z + (w1.z - f.w0.z) * e, time * 8 + f.x0, 0.9);
      }

      // tidy up meshes for things that are gone
      for (const [e, m] of entityMesh) if (!m.seen) { scene.remove(m.g); entityMesh.delete(e); }
      for (const k in batches) { const b = batches[k]; b.m.count = b.n; b.m.instanceMatrix.needsUpdate = true; }
      renderer.render(scene, camera);
      overlay(time);
    }
    const singles = {};
    function single(key, show, geo, x, y, z, dt, spin, rot) {
      let m = singles[key];
      if (!m) { const g = new THREE.Group(); g.add(mesh(geo)); scene.add(g); m = singles[key] = { g }; }
      m.g.visible = show; if (!show) return;
      m.g.position.set(x, y, z);
      if (rot !== undefined) m.g.rotation.y = rot; else face(m, x, z, dt);
      if (spin) m.g.rotation.y += dt * 2;
    }

    // ---------- 2D overlay: labels, pop-ups, guide, joystick ----------
    function overlay(time) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.save();
      for (const t of tileMeshes) {
        if (!t.m.visible) continue;
        const g = t.gp, [sx, sy] = project(g.x, g.y);
        if (sx < -160 || sx > W + 160 || sy < -120 || sy > H + 80) continue;
        const items = UPGRADES.filter(u => u.group === g.id), open = items.filter(canBuy);
        const cheapest = open.length ? Math.min(...open.map(u => u.costs[level[u.id]])) : 0;
        const afford = open.some(u => cash >= u.costs[level[u.id]]);
        const bob = Math.sin(time * 2 + g.x) * 2;
        tag(g.name, sx, sy - 58 + bob, 17, '#fffaf0');
        const note = g.id === 'move' ? moveNote() : !open.length ? (items.every(u => level[u.id] >= u.costs.length) ? 'All upgraded' : 'Nothing to buy yet')
          : `${open.length} upgrade${open.length > 1 ? 's' : ''} · from $${cheapest.toLocaleString()}`;
        tag(note, sx, sy - 34 + bob, 13, afford || (g.id === 'move' && moveGain()) ? '#c8f5c8' : '#fffaf0');
      }
      {
        const [dx, dy] = project(DROP.x, DROP.y); tag('Restock', dx, dy - 10, 13, '#fffaf0');
        for (const kind of Object.keys(SHELF_BASE)) {
          if ((kind === 'plank' && !level.sawmill) || (kind === 'syrup' && !level.shack)) continue;
          const [sx, sy] = project(STORE.x + SHELF_BASE[kind] + 38, STORE.front - 40);
          tag(`${stock[kind]}/${shelfCap()}`, sx, sy - 70, 12, '#fffaf0');
        }
        for (const c of customers) {
          if (c.state === 'leave' || c.got >= c.want) continue;
          const [sx, sy] = project(c.x, c.y);
          if (sx > -40 && sx < W + 40 && sy > 0 && sy < H + 60) tag(`${c.want - c.got} ${ITEM_NAME[c.kind]}`, sx, sy - 90, 12, '#2b2a22', 'rgba(255,250,240,.92)');
        }
      }
      if (level.warehouse) { const [sx, sy] = project((WH.x0 + WH.x1) / 2, WH.y0); tag(`Warehouse ${sum(wh)} / ${whCap()}`, sx, sy - 150, 14, '#fffaf0'); }
      for (const n of nodes) {
        if (n.type !== 'maple' || n.sap < 1) continue;
        const [sx, sy] = project(n.x, n.y);
        if (sx > -40 && sx < W + 40 && sy > 0 && sy < H + 40) tag('Sap!', sx, sy - 105, 12, '#ffd27a');
      }
      for (const f of fx) {
        if (f.type !== 'text') continue;
        const p = f.t / f.life, [sx, sy] = project(f.x, f.y), y = sy - f.h - 40 - p * 34;
        ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        const pop = p < 0.1 ? 0.6 + p * 7 : p < 0.2 ? 1.3 - (p - 0.1) * 3 : 1;
        ctx.font = `600 ${Math.round(20 * pop)}px ${FONT}`; ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(43,42,34,.75)'; ctx.strokeText(f.text, sx, y);
        ctx.fillStyle = f.color; ctx.fillText(f.text, sx, y);
        ctx.globalAlpha = 1;
      }
      drawGuide(time);
      ctx.restore();
      drawStick();
    }

    function set(want) {
      on = !!want && typeof THREE !== 'undefined';
      if (on && !ready) { try { init(); } catch (e) { console.error(e); on = false; } }
      document.body.classList.toggle('is3d', on);
      if (canvas3) canvas3.hidden = !on;
      try { localStorage.setItem('homestead-view', on ? '3d' : '2d'); } catch (e) { /* view choice just won't be remembered */ }
      const btn = document.getElementById('view-toggle');
      if (btn) btn.textContent = on ? '2D view' : '3D view';
    }
    return { set, render, resize, project, retheme, get on() { return on; } };
  })();
  function view3d() { return !!(R3 && R3.on); }
  {
    const btn = document.getElementById('view-toggle');
    if (!R3) btn.hidden = true;
    else {
      btn.addEventListener('click', () => R3.set(!R3.on));
      let pref = null; try { pref = localStorage.getItem('homestead-view'); } catch (e) { /* no stored choice */ }
      if (pref === '3d') R3.set(true);
    }
  }

