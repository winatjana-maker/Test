// Input: floating joystick (drag anywhere on the canvas), taps, and WASD/arrow keys.
window.CW = window.CW || {};

CW.Input = function (canvas, opts) {
  const self = this;
  this.joy = { active: false, ox: 0, oy: 0, dx: 0, dy: 0, mag: 0 };
  this.keys = {};
  this.onTap = opts && opts.onTap;

  const DEAD = 10, RADIUS = 50;
  let pointerId = null, start = null, moved = false, downTime = 0;

  canvas.addEventListener('pointerdown', e => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    start = { x: e.clientX, y: e.clientY };
    moved = false;
    downTime = performance.now();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    const len = Math.hypot(dx, dy);
    if (!moved && len > DEAD) {
      moved = true;
      self.joy.active = true;
      self.joy.ox = start.x;
      self.joy.oy = start.y;
    }
    if (moved) {
      const cl = Math.min(len, RADIUS);
      const nx = len ? dx / len : 0, ny = len ? dy / len : 0;
      self.joy.dx = nx * cl;
      self.joy.dy = ny * cl;
      self.joy.mag = cl / RADIUS;
    }
  });

  const end = e => {
    if (e.pointerId !== pointerId) return;
    if (!moved && performance.now() - downTime < 600 && self.onTap) self.onTap(e.clientX, e.clientY);
    pointerId = null;
    self.joy.active = false;
    self.joy.dx = self.joy.dy = self.joy.mag = 0;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    self.keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', e => { self.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { self.keys = {}; });
};

// Screen-space intent from joystick or keys. Magnitude 0..1.
CW.Input.prototype.getScreenVector = function () {
  if (this.joy.active && this.joy.mag > 0) {
    return { x: this.joy.dx / 50, y: this.joy.dy / 50 };
  }
  const k = this.keys;
  let sx = 0, sy = 0;
  if (k['w'] || k['arrowup']) sy -= 1;
  if (k['s'] || k['arrowdown']) sy += 1;
  if (k['a'] || k['arrowleft']) sx -= 1;
  if (k['d'] || k['arrowright']) sx += 1;
  const l = Math.hypot(sx, sy);
  if (l > 1) { sx /= l; sy /= l; }
  return { x: sx, y: sy };
};

// World-space direction (unit vector scaled by intent magnitude).
CW.Input.prototype.getWorldVector = function () {
  const s = this.getScreenVector();
  if (s.x === 0 && s.y === 0) return { x: 0, y: 0 };
  const mag = Math.min(1, Math.hypot(s.x, s.y));
  const d = CW.Iso.dirToWorld(s.x, s.y);
  return { x: d.x * mag, y: d.y * mag };
};

CW.Input.prototype.isMoving = function () {
  const s = this.getScreenVector();
  return s.x !== 0 || s.y !== 0;
};
