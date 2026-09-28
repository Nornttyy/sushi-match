// Authored tile indices, not a random obstacle roll. The original removal
// routes remain valid; tests replay every one with seals and the real rail.
export const CAMPAIGN_SEALS = Object.freeze({
  4: [27], 5: [22], 6: [31],
  7: [39, 23], 8: [37, 17], 9: [36, 41],
  10: [48, 37], 11: [44, 36], 12: [28, 37],
  13: [49, 44, 54], 14: [51, 45, 49], 15: [55, 59, 41],
  16: [68, 46, 59], 17: [68, 58, 43], 18: [53, 59, 35],
  19: [63, 57, 64, 62], 20: [64, 56, 55, 53],
  21: [67, 68, 47, 51], 22: [58, 71, 50, 57],
  23: [69, 71, 62, 59], 24: [67, 45, 60, 21]
});
Object.values(CAMPAIGN_SEALS).forEach(Object.freeze);

// Orthogonal neighbours on the same layer, never a diagonal or a card hidden
// directly underneath. Coordinates match the committed 24 x 29 campaign grid.
export function areSealNeighbours(a, b) {
  if (a.id === b.id || a.layer !== b.layer) return false;
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return (dx <= 25 && dy < 6) || (dy <= 30 && dx < 6);
}

export const SEAL_HINT = '封条：邻牌三消揭开';
export const SEAL_MOTION_MS = 460;
export const SEAL_COLORS = Object.freeze({ fill: '#486950', edge: '#304d3b', fold: '#86a17a' });

// One slow peel, no oscillation. DOM and Canvas use this exact curve.
export function sealPeelPose(progress) {
  const t = Math.max(0, Math.min(1, progress));
  const ease = t * t * (3 - 2 * t);
  return { y: -20 * ease, rotate: -5 - 13 * ease, sy: 1 - .75 * ease, opacity: 1 - ease };
}
