// Shared by the page and the API. No server imports here.
const c01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

// Old coordinate systems (kept so no existing print is lost).
const OLD_X_MIN = 4, OLD_X_MAX = 96, OLD_Y_MIN = 6;
const OLD_DESKTOP_Y_MAX = 45, OLD_PHONE_CUTOFF = 60, OLD_PHONE_Y_MAX = 190;

export function withFrac(p) {
  if (typeof p.fx === "number" && typeof p.fy === "number") return p;
  const x = p.x ?? 50, y = p.y ?? 20;
  const fx = c01((x - OLD_X_MIN) / (OLD_X_MAX - OLD_X_MIN));
  const fy =
    y > OLD_PHONE_CUTOFF
      ? c01((y - OLD_Y_MIN) / (OLD_PHONE_Y_MAX - OLD_Y_MIN))
      : c01((y - OLD_Y_MIN) / (OLD_DESKTOP_Y_MAX - OLD_Y_MIN));
  return { ...p, fx, fy };
}

// Infinite canvas: wx, wy are world units, origin (0,0) is the middle of the first board.
export const SIZE = 88; // print width in world units
export const RX = SIZE * 1.15; // keep-out ellipse around each print
export const RY = SIZE * 1.6;
export const REF = { w: 2200, h: 1200 }; // where all old prints are laid out
export const LIMIT = 100000;

export const hasWorld = (p) => Number.isFinite(p.wx) && Number.isFinite(p.wy);

export function legacyWorld(p) {
  const f = withFrac(p);
  return { wx: (f.fx - 0.5) * REF.w, wy: (f.fy - 0.5) * REF.h };
}