import { CAMPAIGN_LAYOUTS } from './campaign-layouts.js';

// Authored [tile index, wrap layers]. No random obstacle roll on retries.
export const CAMPAIGN_SEALS = Object.freeze(Object.fromEntries(CAMPAIGN_LAYOUTS
  .filter(record=>record.seals?.length)
  .map(record=>[record.id,Object.freeze(record.seals.map(pair=>Object.freeze([...pair])))])
));

export function getSealLayers(tile) {
  return tile.sealed ? Math.max(1, Math.min(3, tile.sealLayers || 1)) : 0;
}

// Shared percentage geometry: thinner independent bands preserve the food face.
export const SEAL_BANDS = Object.freeze([
  Object.freeze({x:41,y:4,w:18,h:92,rotate:-5}),
  Object.freeze({x:5,y:43,w:90,h:14,rotate:6}),
  Object.freeze({x:62,y:5,w:14,h:90,rotate:14})
]);

// Orthogonal neighbours on the same layer, never a diagonal or a card hidden
// directly underneath. Coordinates match the committed 24 x 29 campaign grid.
export function areSealNeighbours(a, b) {
  if (a.id === b.id || a.layer !== b.layer) return false;
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return (dx <= 25 && dy < 6) || (dy <= 30 && dx < 6);
}

export const SEAL_HINT = '邻牌三消，揭一层海苔';
export const SEAL_MOTION_MS = 460;
export const SEAL_COLORS = Object.freeze({ fill: '#486950', edge: '#304d3b', fold: '#86a17a' });

// One slow peel, no oscillation. DOM and Canvas use this exact curve.
export function sealPeelPose(progress, angle = -5) {
  const t = Math.max(0, Math.min(1, progress));
  const ease = t * t * (3 - 2 * t);
  return { y: -20 * ease, rotate: angle - 13 * ease, sy: 1 - .75 * ease, opacity: 1 - ease };
}
