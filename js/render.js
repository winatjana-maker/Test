// Rendering. ALL placeholder art lives here — swap the draw* functions for
// sprite blits later without touching game logic.
window.CW = window.CW || {};

CW.Render = (function () {
  const C = CW.CONFIG, F = CW.FACILITIES, S = CW.State, R = CW.RESOURCES, Iso = CW.Iso;

  function Renderer(canvas, state, input) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.input = input;
    this.cam = Iso.toScreen(state.avatar.x, state.avatar.y);
    this.zoom = 1;
    this.time = 0;
    this.floaters = [];
    this.placement = null;   // facility type being placed, or null
    this.selected = null;    // selected facility
    this.canPlace = () => false;
    this.resize();
  }

  Renderer.prototype.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.zoom = this.w < 520 ? 1.2 : 1.5;
  };

  Renderer.prototype.screenToWorld = function (sx, sy) {
    const px = (sx - this.w / 2) / this.zoom + this.cam.x;
    const py = (sy - this.h / 2) / this.zoom + this.cam.y;
    return Iso.toWorld(px, py);
  };

  Renderer.prototype.addFloater = function (wx, wy, text, color) {
    const fl = { wx, wy, text, color, t: 0 };
    this.floaters.push(fl);
    return fl;
  };

  // ---------- helpers ----------
  function diamond(ctx, i, j, inset) {
    const a = inset || 0;
    const p0 = Iso.toScreen(i + a, j + a), p1 = Iso.toScreen(i + 1 - a, j + a);
    const p2 = Iso.toScreen(i + 1 - a, j + 1 - a), p3 = Iso.toScreen(i + a, j + 1 - a);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    return [p0, p1, p2, p3];
  }
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  function shade(hex, amt) { return mix(hex, amt < 0 ? '#000000' : '#ffffff', Math.abs(amt)); }

  // ---------- main draw ----------
  Renderer.prototype.render = function (dt) {
    this.time += dt;
    const st = this.state, ctx = this.ctx, G = C.GRID;

    // camera follows avatar
    const target = Iso.toScreen(st.avatar.x, st.avatar.y);
    const k = Math.min(1, dt * 7);
    this.cam.x += (target.x - this.cam.x) * k;
    this.cam.y += (target.y - this.cam.y) * k;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#1b2a1e';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    // occupancy lookup
    const occ = new Map();
    for (const f of st.facilities) occ.set(f.y * G + f.x, f);

    // ground
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) this.drawGround(i, j, st.tiles[j * G + i], occ.get(j * G + i));

    // placement highlights
    if (this.placement) {
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        if (this.canPlace(this.placement, i, j)) {
          diamond(ctx, i, j, 0.08);
          ctx.fillStyle = 'rgba(150, 230, 140, 0.45)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(200, 255, 190, 0.8)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // collection markers
    for (const f of st.facilities) if (F[f.type].rate && !f.staffed) this.drawCollectionMarker(f);

    // selection ring
    if (this.selected && st.facilities.includes(this.selected)) {
      diamond(ctx, this.selected.x, this.selected.y, -0.05);
      ctx.strokeStyle = '#f1d36a';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (this.selected) {
      this.selected = null;
    }

    // depth-sorted objects
    const objs = [];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const t = st.tiles[j * G + i];
      if (t.type === 'forest' && !occ.has(j * G + i)) objs.push({ d: i + j + 1, i, j, t, kind: 'tree' });
    }
    for (const f of st.facilities) objs.push({ d: f.x + f.y + 1, f, kind: 'bld' });
    objs.push({ d: st.avatar.x + st.avatar.y, kind: 'avatar' });
    objs.sort((a, b) => a.d - b.d);
    for (const o of objs) {
      if (o.kind === 'tree') this.drawTrees(o.i, o.j, o.t);
      else if (o.kind === 'bld') this.drawBuilding(o.f);
      else this.drawAvatar();
    }

    // bubbles on top
    for (const f of st.facilities) this.drawBubble(f);

    // floaters
    for (let n = this.floaters.length - 1; n >= 0; n--) {
      const fl = this.floaters[n];
      fl.t += dt;
      if (fl.t > 1.3) { this.floaters.splice(n, 1); continue; }
      const p = Iso.toScreen(fl.wx, fl.wy);
      const y = p.y - 30 - fl.t * 28;
      ctx.globalAlpha = fl.t < 0.9 ? 1 : 1 - (fl.t - 0.9) / 0.4;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(fl.text, p.x, y);
      ctx.fillStyle = fl.color || '#fff';
      ctx.fillText(fl.text, p.x, y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    this.drawJoystick();
  };

  // ---------- ground ----------
  Renderer.prototype.drawGround = function (i, j, t, fac) {
    const ctx = this.ctx;
    let color;
    if (t.type === 'forest') {
      // healthy forest floor -> bare, over-harvested earth
      color = mix('#8a7a4a', '#4f7a3c', t.yield);
    } else {
      color = ((i + j) % 2 === 0) ? '#6f9a4a' : '#699346';
    }
    if (fac && t.type === 'grass') color = shade(color, -0.15);
    diamond(ctx, i, j);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // ---------- trees ----------
  const TREE_OFFSETS = [[0.3, 0.32], [0.7, 0.42], [0.45, 0.72]];
  Renderer.prototype.drawTrees = function (i, j, t) {
    const ctx = this.ctx;
    const scale = 0.35 + 0.65 * t.yield;
    for (const [ox, oy] of TREE_OFFSETS) {
      const p = Iso.toScreen(i + ox, j + oy);
      const h = 26 * scale, w = 12 * scale;
      // trunk
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(p.x - 1.5, p.y - 6 * scale, 3, 6 * scale);
      // two tiers
      ctx.fillStyle = '#2f6b3a';
      ctx.beginPath(); ctx.moveTo(p.x, p.y - h); ctx.lineTo(p.x + w, p.y - h * 0.45); ctx.lineTo(p.x - w, p.y - h * 0.45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3f8a4a';
      ctx.beginPath(); ctx.moveTo(p.x, p.y - h * 0.75); ctx.lineTo(p.x + w * 0.9, p.y - h * 0.2); ctx.lineTo(p.x - w * 0.9, p.y - h * 0.2); ctx.closePath(); ctx.fill();
    }
  };

  // ---------- buildings ----------
  Renderer.prototype.buildingTop = function (f) {
    // screen point above the building, for bubbles
    const p = Iso.toScreen(f.x + 0.5, f.y + 0.5);
    return { x: p.x, y: p.y - 30 - C.TILE_H / 2 };
  };

  Renderer.prototype.drawBuilding = function (f) {
    const ctx = this.ctx, d = F[f.type];
    const base = d.color;
    const h = 24 + Math.min(12, (f.level - 1) * 3);
    const a = 0.14;
    const p0 = Iso.toScreen(f.x + a, f.y + a), p1 = Iso.toScreen(f.x + 1 - a, f.y + a);
    const p2 = Iso.toScreen(f.x + 1 - a, f.y + 1 - a), p3 = Iso.toScreen(f.x + a, f.y + 1 - a);

    // shadow footprint
    diamond(ctx, f.x, f.y, 0.06);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();

    // left (SW) face
    ctx.fillStyle = shade(base, -0.3);
    ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p2.x, p2.y - h); ctx.lineTo(p3.x, p3.y - h); ctx.closePath(); ctx.fill();
    // right (SE) face
    ctx.fillStyle = shade(base, -0.12);
    ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p1.x, p1.y - h); ctx.lineTo(p2.x, p2.y - h); ctx.closePath(); ctx.fill();
    // top
    ctx.fillStyle = shade(base, 0.18);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y - h); ctx.lineTo(p1.x, p1.y - h); ctx.lineTo(p2.x, p2.y - h); ctx.lineTo(p3.x, p3.y - h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // label
    const cx = (p0.x + p2.x) / 2, cy = (p0.y + p2.y) / 2 - h;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(d.code, cx, cy + 1);
    ctx.fillStyle = '#fff5dc';
    ctx.fillText(d.code, cx, cy);
    ctx.textBaseline = 'alphabetic';

    // level pips on the front edge
    for (let n = 0; n < Math.min(f.level, 6); n++) {
      ctx.fillStyle = '#f1d36a';
      ctx.fillRect(p2.x - 8 + n * 3.2, p2.y - 6, 2, 3);
    }
    // staffed badge
    if (f.staffed) {
      ctx.fillStyle = '#5a9a4e';
      ctx.beginPath(); ctx.arc(p1.x - 2, p1.y - h - 2, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    }
  };

  Renderer.prototype.drawCollectionMarker = function (f) {
    const ctx = this.ctx;
    const c = S.collectionTile(f);
    const hot = f.buffer >= 1;
    const pulse = hot ? 0.5 + 0.5 * Math.sin(this.time * 5) : 0;
    diamond(ctx, c.x, c.y, 0.2 - pulse * 0.05);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = hot ? `rgba(241, 211, 106, ${0.7 + pulse * 0.3})` : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = hot ? 2 : 1;
    ctx.stroke();
    ctx.setLineDash([]);
    if (hot) {
      const p = Iso.toScreen(c.x + 0.5, c.y + 0.5);
      ctx.fillStyle = `rgba(241, 211, 106, ${0.6 + pulse * 0.4})`;
      ctx.beginPath(); ctx.moveTo(p.x - 5, p.y - 12 - pulse * 3); ctx.lineTo(p.x + 5, p.y - 12 - pulse * 3); ctx.lineTo(p.x, p.y - 5 - pulse * 3); ctx.closePath(); ctx.fill();
    }
  };

  Renderer.prototype.drawBubble = function (f) {
    const d = F[f.type];
    if (!d.rate) return;
    const ctx = this.ctx;
    const res = CW.Sim.outputRes(f);
    const cap = CW.Sim.bufferCap(f);
    let text = null, stroke = 'rgba(255,255,255,0.25)', urgent = false, swatch = R[res].color;

    if (f.staffed) {
      if (f.stall === 'storage full') { text = 'storage full'; urgent = true; }
      else if (f.stall === 'no input') { text = 'needs input'; }
      else if (f.stall === 'depleted') { text = 'no trees'; urgent = true; }
      else return;
    } else {
      if (f.buffer >= 1) {
        text = String(Math.floor(f.buffer));
        if (f.buffer >= cap) { urgent = true; text += ' !'; }
      } else if (f.stall === 'no input') text = 'needs input';
      else if (f.stall === 'depleted') { text = 'no trees'; urgent = true; }
      else return;
    }
    if (urgent) stroke = 'rgba(224, 90, 74, 0.95)';

    const top = this.buildingTop(f);
    const bob = Math.sin(this.time * 3 + f.id) * 1.5;
    ctx.font = 'bold 11px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    const w = tw + 24, h = 18;
    const x = top.x - w / 2, y = top.y - h + bob;
    ctx.fillStyle = 'rgba(18, 24, 16, 0.9)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 9);
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = urgent ? 1.5 : 1;
    ctx.stroke();
    // pointer
    ctx.fillStyle = 'rgba(18, 24, 16, 0.9)';
    ctx.beginPath(); ctx.moveTo(top.x - 4, y + h); ctx.lineTo(top.x + 4, y + h); ctx.lineTo(top.x, y + h + 5); ctx.closePath(); ctx.fill();
    // swatch + text
    ctx.fillStyle = swatch;
    ctx.fillRect(x + 7, y + 5, 8, 8);
    ctx.fillStyle = urgent ? '#ffd6cc' : '#f1e9cf';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 19, y + h / 2 + 0.5);
    ctx.textBaseline = 'alphabetic';
  };

  // ---------- avatar ----------
  Renderer.prototype.drawAvatar = function () {
    const ctx = this.ctx, a = this.state.avatar;
    const p = Iso.toScreen(a.x, a.y);
    const moving = this.input && this.input.isMoving();
    const bob = moving ? Math.abs(Math.sin(this.time * 12)) * 2 : 0;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    // legs
    ctx.fillStyle = '#3b3a4a';
    ctx.fillRect(p.x - 5, p.y - 8 - bob, 4, 8);
    ctx.fillRect(p.x + 1, p.y - 8 - bob, 4, 8);
    // body (flannel)
    ctx.fillStyle = '#b4652e';
    ctx.beginPath(); ctx.roundRect(p.x - 7, p.y - 22 - bob, 14, 15, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(p.x - 7, p.y - 15 - bob, 14, 1.5);
    ctx.fillRect(p.x - 1, p.y - 22 - bob, 1.5, 15);
    // head
    ctx.fillStyle = '#f1d5b0';
    ctx.beginPath(); ctx.arc(p.x, p.y - 27 - bob, 6.5, 0, Math.PI * 2); ctx.fill();
    // hat
    ctx.fillStyle = '#2f4a33';
    ctx.beginPath(); ctx.arc(p.x, p.y - 29 - bob, 6.5, Math.PI, 0); ctx.fill();
    ctx.fillRect(p.x - 8, p.y - 30 - bob, 16, 2);
  };

  // ---------- joystick overlay ----------
  Renderer.prototype.drawJoystick = function () {
    const j = this.input && this.input.joy;
    if (!j || !j.active) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(j.ox, j.oy, 50, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(241, 211, 106, 0.85)';
    ctx.beginPath(); ctx.arc(j.ox + j.dx, j.oy + j.dy, 22, 0, Math.PI * 2); ctx.fill();
  };

  return { Renderer };
})();
