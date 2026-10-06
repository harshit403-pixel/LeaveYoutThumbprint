const c01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

const OLD_X_MIN = 4, OLD_X_MAX = 96, OLD_Y_MIN = 6;
const OLD_DESKTOP_Y_MAX = 45;
const OLD_PHONE_CUTOFF = 60;
const OLD_PHONE_Y_MAX = 190;

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

export { c01 };