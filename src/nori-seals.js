import { CAMPAIGN_LAYOUTS } from './campaign-layouts.js';

// Authored [tile index, requested wrap layers]. Runtime definitions cap unsafe
// counts with stabilizeCampaignSeals; retries never roll new obstacles.
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

// Several neighbouring cards of the same food can disappear in ONE triple.
// Count the fewest independent matches they can form, not the number of
// matches in the designer's particular route. Four neighbours of one food
// still guarantee two matches; two different foods also guarantee two.
export function independentSealMatches(neighbours) {
  const counts = new Map();
  for (const tile of new Map(neighbours.map(tile => [tile.id, tile])).values()) {
    counts.set(tile.ingredient, (counts.get(tile.ingredient) || 0) + 1);
  }
  return [...counts.values()].reduce((sum, count) => sum + Math.ceil(count / 3), 0);
}

export function stabilizeCampaignSeals(level) {
  const byId = new Map(level.tiles.map(tile => [tile.id, tile]));
  const matched = new Set(), layers = new Map();
  let rail = [];
  for (const id of level.solution) {
    const tile = byId.get(id);
    if (tile.sealed) {
      // Only use neighbours actually matched BEFORE this card on the known
      // legal route. A neighbour that needs this card to unlock is not a
      // valid source. Peeling works while covered, so exposure is irrelevant.
      const sources = level.tiles.filter(other => matched.has(other.id) && areSealNeighbours(tile, other));
      const capacity = independentSealMatches(sources);
      if (!capacity) throw new Error('No prior seal trigger for ' + id);
      layers.set(id, Math.min(getSealLayers(tile), capacity));
    }
    rail.push(tile);
    const same = rail.filter(other => other.ingredient === tile.ingredient);
    if (same.length === 3) {
      for (const other of same) matched.add(other.id);
      rail = rail.filter(other => other.ingredient !== tile.ingredient);
    }
  }
  // Keep the authored ingredients, positions, seal locations, orders and
  // route intact. Only over-budget wrap counts change, deterministically.
  return { ...level, tiles: level.tiles.map(tile => layers.has(tile.id)
    ? { ...tile, sealLayers: layers.get(tile.id) } : tile) };
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
