// Board units: x and y are both measured in % of the board width, so spacing is identical on every screen.
export const D = 9;          // minimum distance between two print centers
export const X_MIN = 4, X_MAX = 96, Y_MIN = 6, Y_MAX = 5000;
// Ink grows smoothly while pressing: 0.3 (light tap) to 1 (about 1.4 s hold).
export const inkAt = (t0) => {
  const k = Math.min(1, (performance.now() - t0) / 1400);
  return 0.3 + 0.7 * (1 - (1 - k) * (1 - k));
};