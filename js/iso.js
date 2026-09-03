// Isometric grid math. World units are tiles; screen units are pixels (pre-zoom).
window.CW = window.CW || {};

CW.Iso = {
  toScreen(wx, wy) {
    const TW = CW.CONFIG.TILE_W, TH = CW.CONFIG.TILE_H;
    return { x: (wx - wy) * TW / 2, y: (wx + wy) * TH / 2 };
  },
  toWorld(sx, sy) {
    const TW = CW.CONFIG.TILE_W, TH = CW.CONFIG.TILE_H;
    return {
      x: (sx / (TW / 2) + sy / (TH / 2)) / 2,
      y: (sy / (TH / 2) - sx / (TW / 2)) / 2,
    };
  },
  // Convert a screen-space direction into a unit world-space direction.
  dirToWorld(sx, sy) {
    const w = CW.Iso.toWorld(sx, sy);
    const l = Math.hypot(w.x, w.y);
    return l === 0 ? { x: 0, y: 0 } : { x: w.x / l, y: w.y / l };
  },
};
