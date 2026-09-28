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

function removalRoute(positions, random, footprint = GENERATED_FOOTPRINT) {
  const remaining = new Set(positions.map((_, i) => i));
  const blockers = positions.map(tile => positions.flatMap((upper, i) => upper.layer > tile.layer
    && Math.abs(upper.x-tile.x)<footprint.x && Math.abs(upper.y-tile.y)<footprint.y ? [i] : []));
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

function ingredientSequence(groups, rank, random, route, neighbours) {
  const remaining = new Map();
  for(const ingredient of groups)remaining.set(ingredient,(remaining.get(ingredient)||0)+3);
  const open = new Map(), assigned = [];
  const sequence = [];
  const openLimit = rank < 3 ? 3 : 4;
  let rail = 0;
  while (sequence.length < route.length) {
    let choices = [...remaining.keys()].filter(id=>remaining.get(id)>0&&(open.has(id)||open.size<openLimit));
    if (rail === 6) choices = choices.filter(id => open.get(id) === 2);
    // Four unfinished types cannot occupy six slots without having a pair.
    if (!choices.length) throw new Error('Invalid generated ingredient sequence');
    const index=route[sequence.length];
    const ranked=choices.map(id=>({id,score:neighbours[index].filter(j=>assigned[j]===id).length*12
      +(sequence.at(-1)===id?2:0)-Math.log(remaining.get(id))*2+random()*5}));
    ranked.sort((a,b)=>a.score-b.score);
    const ingredient=ranked[0].id;
    const picked = (open.get(ingredient)||0) + 1;
    remaining.set(ingredient,remaining.get(ingredient)-1);assigned[index]=ingredient;
    sequence.push(ingredient);
    if (picked === 3) { open.delete(ingredient); rail -= 2; }
    else { open.set(ingredient, picked); rail++; }
  }
  return sequence;
}

export function spatialNeighbours(a,b,footprint=GENERATED_FOOTPRINT) {
  const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y),legacy=footprint.y===20;
  return ((dx>(legacy?8:6)&&dx<=(legacy?38:25)&&dy<6)
    || (dy>6&&dy<=(legacy?46:30)&&dx<(legacy?8:6)));
}

export function layoutMixMetrics(tiles, footprint=GENERATED_FOOTPRINT) {
  const neighbours=tiles.map((a,i)=>tiles.flatMap((b,j)=>i!==j&&a.layer===b.layer&&spatialNeighbours(a,b,footprint)?[j]:[]));
  return mixMetrics(tiles,neighbours);
}

function mixMetrics(tiles,neighbours) {
  const seen=new Set();let largestCluster=0,clusterPenalty=0,pairs=0,dominance=0;
  for(let i=0;i<tiles.length;i++){
    if(seen.has(i))continue;
    const queue=[i];seen.add(i);let size=0;
    while(queue.length){const j=queue.pop();size++;for(const k of neighbours[j])if(tiles[k].ingredient===tiles[j].ingredient){pairs++;if(!seen.has(k)){seen.add(k);queue.push(k);}}}
    largestCluster=Math.max(largestCluster,size);clusterPenalty+=Math.max(0,size-2)**2;
  }
  for(const layer of new Set(tiles.map(t=>t.layer))){
    const items=tiles.filter(t=>t.layer===layer),counts={};for(const t of items)counts[t.ingredient]=(counts[t.ingredient]||0)+1;
    dominance+=Math.max(0,Math.max(...Object.values(counts))-Math.ceil(items.length*.55));
  }
  return {largestCluster,pairs:pairs/2,dominance,score:clusterPenalty*100+dominance*30+pairs/2};
}

// A bounded cleanup for endless boards: swaps never change ingredient totals,
// geometry or the removal route, and are accepted only if that route still fits
// the seven-slot rail. This is not an unbounded random reshuffle on a phone.
function disperseClusters(tiles,route,footprint) {
  const neighbours=tiles.map((a,i)=>tiles.flatMap((b,j)=>i!==j&&a.layer===b.layer&&spatialNeighbours(a,b,footprint)?[j]:[]));
  let metrics=mixMetrics(tiles,neighbours);
  const routeFits=()=>{
    const counts=new Map();let slots=0;
    for(const index of route){const id=tiles[index].ingredient,n=(counts.get(id)||0)+1;
      counts.set(id,n%3);slots+=n===3?-2:1;if(slots>=7)return false;}
    return slots===0;
  };
  for(let pass=0;pass<8&&(metrics.largestCluster>2||metrics.dominance>0);pass++){
    let improved=false;
    for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++){
      const a=tiles[i],b=tiles[j];if(a.ingredient===b.ingredient)continue;
      [a.ingredient,b.ingredient]=[b.ingredient,a.ingredient];
      const candidate=mixMetrics(tiles,neighbours);
      if(candidate.score<metrics.score&&routeFits()){
        metrics=candidate;improved=true;
        if(metrics.largestCluster<=2&&metrics.dominance===0)return;
      }else [a.ingredient,b.ingredient]=[b.ingredient,a.ingredient];
    }
    if(!improved)break;
  }
}

export function generateLayout({ id, groups, seed, rank, positions:fixedPositions, footprint=GENERATED_FOOTPRINT, attempts=12, refine=false }) {
  let best=null,bestScore=Infinity;
  for(let attempt=0;attempt<attempts;attempt++){
    const random = randomSource(seed ^ Math.imul(attempt,0x9e3779b1));
    const positions = fixedPositions || makePositions(groups.length * 3, random);
    const route = removalRoute(positions, random, footprint);
    const neighbours=positions.map((a,i)=>positions.flatMap((b,j)=>i!==j&&a.layer===b.layer&&spatialNeighbours(a,b,footprint)?[j]:[]));
    const sequence = ingredientSequence(groups, rank, random, route, neighbours);
    const tiles = positions.map((position, i) => ({ id: 'l' + id + '-food-' + i, ...position, active: true }));
    route.forEach((index, step) => { tiles[index].ingredient = sequence[step]; });
    if(refine)disperseClusters(tiles,route,footprint);
    const metrics=layoutMixMetrics(tiles,footprint),score=metrics.score;
    if(score<bestScore){best={tiles,route};bestScore=score;}
    if(score===0||(refine&&metrics.largestCluster<=2&&metrics.dominance===0))break;
  }
  const {tiles,route}=best;
  const layers = Array.from({ length: Math.max(...tiles.map(t=>t.layer)) + 1 }, (_, layer) => tiles.filter(t => t.layer === layer).length);
  const layerFoods = layers.map((_, layer) => tiles.filter(t => t.layer === layer).map(t => t.ingredient));
  return { tiles, layers, layerFoods, top: layerFoods.at(-1), solution: route.map(i => tiles[i].id), footprint };
}
