// Construct a legal removal route first, then deal an interleaved ingredient
// sequence along it. Every generated board has a witness solution, without a
// search that could stall a phone or an unlimited rejection-sampling loop.
export const GENERATED_FOOTPRINT = Object.freeze({ x: 20, y: 26 });

export function randomSource(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let n = Math.imul(value ^ value >>> 15, value | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makePositions(count, random) {
  const positions = [];
  let layer = 0;
  while (positions.length < count) {
    const xs = layer % 2 ? [26, 50, 74] : [14, 38, 62, 86];
    const ys = layer % 2 ? [17, 46, 75] : [22, 51, 80];
    const cells = shuffled(ys.flatMap(y => xs.map(x => ({ x, y, layer, tilt: 0 }))), random);
    positions.push(...cells.slice(0, count - positions.length));
    layer++;
  }
  return positions;
}

export function generatedOverlap(a, b) {
  return Math.abs(a.x - b.x) < GENERATED_FOOTPRINT.x && Math.abs(a.y - b.y) < GENERATED_FOOTPRINT.y;
}

function removalRoute(positions, random) {
  const remaining = new Set(positions.map((_, i) => i));
  const blockers = positions.map(tile => positions.flatMap((upper, i) => upper.layer > tile.layer && generatedOverlap(upper, tile) ? [i] : []));
  const route = [];
  while (remaining.size) {
    const visible = [...remaining].filter(i => blockers[i].every(j => !remaining.has(j)));
    // Prefer some deeper cards as soon as they become accessible, so a triple
    // can span layers rather than being delivered as an obvious top-layer set.
    const deepest = Math.min(...visible.map(i => positions[i].layer));
    const options = random() < .62 ? visible.filter(i => positions[i].layer === deepest) : visible;
    const selected = options[Math.floor(random() * options.length)];
    route.push(selected);
    remaining.delete(selected);
  }
  return route;
}

function ingredientSequence(groups, rank, random) {
  const pending = shuffled(groups, random);
  const open = new Map();
  const sequence = [];
  const openLimit = rank < 3 ? 3 : 4;
  let rail = 0;
  while (pending.length || open.size) {
    while (open.size < openLimit) {
      const next = pending.findIndex(id => !open.has(id));
      if (next < 0) break;
      open.set(pending.splice(next, 1)[0], 0);
    }
    let choices = [...open.keys()];
    if (rail === 6) choices = choices.filter(id => open.get(id) === 2);
    else if (rail < Math.min(6, rank + 2) && random() < .8) {
      const partial = choices.filter(id => open.get(id) < 2);
      if (partial.length) choices = partial;
    }
    // Four unfinished types cannot occupy six slots without having a pair.
    if (!choices.length) throw new Error('Invalid generated ingredient sequence');
    const ingredient = choices[Math.floor(random() * choices.length)];
    const picked = open.get(ingredient) + 1;
    sequence.push(ingredient);
    if (picked === 3) { open.delete(ingredient); rail -= 2; }
    else { open.set(ingredient, picked); rail++; }
  }
  return sequence;
}

export function generateLayout({ id, groups, seed, rank }) {
  const random = randomSource(seed);
  const positions = makePositions(groups.length * 3, random);
  const route = removalRoute(positions, random);
  const sequence = ingredientSequence(groups, rank, random);
  const tiles = positions.map((position, i) => ({ id: 'l' + id + '-food-' + i, ...position, active: true }));
  route.forEach((index, step) => { tiles[index].ingredient = sequence[step]; });
  const layers = Array.from({ length: positions.at(-1).layer + 1 }, (_, layer) => tiles.filter(t => t.layer === layer).length);
  const layerFoods = layers.map((_, layer) => tiles.filter(t => t.layer === layer).map(t => t.ingredient));
  return { tiles, layers, layerFoods, top: layerFoods.at(-1), solution: route.map(i => tiles[i].id), footprint: GENERATED_FOOTPRINT };
}
