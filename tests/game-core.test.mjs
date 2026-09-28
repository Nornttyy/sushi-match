import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import {
  INGREDIENTS,
  LEVELS,
  RECIPES,
  canCraftActive,
  craftActiveSushi,
  createGame,
  getActiveCustomer,
  getLevel,
  getPantryItems,
  getRailTiles,
  getRecipe,
  getVisibleTiles,
  isTilePickable,
  selectTile,
  serveActiveCustomer,
  undoRailPick
} from '../src/game-core.js';
import {areSealNeighbours} from '../src/nori-seals.js';

function pickTriple(state, ingredient) {
  const before = state.pantry[ingredient];
  let guard = 0;
  while (state.pantry[ingredient] === before && guard < 20) {
    const tile = getVisibleTiles(state).find((item) => item.ingredient === ingredient);
    assert.ok(tile, 'a visible ' + ingredient + ' card should exist');
    state = selectTile(state, tile.id).state;
    guard += 1;
  }
  assert.equal(state.pantry[ingredient], before + 1);
  return state;
}

function advanceOrder(state) {
  let next = state;
  while (next.status === 'playing' && (next.workbench.crafted || canCraftActive(next))) {
    next = next.workbench.crafted
      ? serveActiveCustomer(next).state
      : craftActiveSushi(next).state;
  }
  return next;
}

function stateKey(state) {
  return [
    state.status,
    state.tiles.filter((tile) => tile.active).map((tile) => tile.id).join(','),
    state.tiles.filter((tile) => tile.sealed).map((tile) => tile.id+':'+tile.sealLayers).join(','),
    // The solver never undoes: order in the rail cannot affect matching or
    // seal adjacency. Keep source identities, but deduplicate permutations.
    [...state.rail].sort().join(','),
    Object.values(state.pantry).join(','),
    state.served,
    state.workbench.crafted?.recipeId || ''
  ].join('|');
}

/* A small solver proves each authored stack has at least one legal full route. */
function findWinningState(initialState) {
  const visited = new Set();
  let searched = 0,limit=10000,sealAware=false;

  function search(input) {
    const state = advanceOrder(input);
    if (state.status === 'won') {
      return state;
    }
    if (state.status !== 'playing' || searched >= limit) {
      return null;
    }
    const key = stateKey(state);
    if (visited.has(key)) {
      return null;
    }
    visited.add(key);
    searched += 1;

    const railCounts = getRailTiles(state).reduce((counts, tile) => {
      counts[tile.ingredient] = (counts[tile.ingredient] || 0) + 1;
      return counts;
    }, {});
    const choices = getVisibleTiles(state).filter(tile => isTilePickable(state, tile.id));
    const visibleCounts=choices.reduce((counts,tile)=>{
      counts[tile.ingredient]=(counts[tile.ingredient]||0)+1;return counts;
    },{});
    // Prefer a triple that is already accessible and neighbours of a wrapped
    // card. This solver does not consult the authored witness or hidden food.
    const priority=tile=>{
      const held=railCounts[tile.ingredient]||0;
      const complete=held+visibleCounts[tile.ingredient]>=3;
      const seals=state.tiles.filter(t=>t.active&&t.sealed&&areSealNeighbours(t,tile)).length;
      return sealAware?held*10+(complete?30:0)+seals*2+tile.layer*.1:held;
    };
    choices.sort((left,right)=>priority(right)-priority(left));
    for (const tile of choices) {
      const result = search(selectTile(state, tile.id).state);
      if (result) {
        return result;
      }
    }
    return null;
  }

  // Two ordinary strategies share a finite 20,000-state budget: fill held
  // pairs first, then prefer exposed triples / peelable neighbours. Neither
  // reads the saved witness, changes the rules, or grants a free undo.
  let result = search(initialState);
  if(!result){visited.clear();limit=20000;sealAware=true;result=search(initialState);}
  assert.ok(result, 'day '+(initialState.levelIndex+1)+' must have a discoverable complete route within 20,000 states');
  return result;
}

test('every level has a raw ingredient deck that exactly covers its customer recipes', () => {
  LEVELS.forEach((level, index) => {
    const state = createGame(index);
    const expectedRaw = level.orders
      .flatMap((recipeId) => RECIPES[recipeId].ingredients)
      .length * 3;
    assert.equal(state.tiles.length, expectedRaw);
    assert.equal(state.tiles.length, level.layers.reduce((total, count) => total + count, 0));
    assert.equal(level.layerFoods.flat().length, expectedRaw);
    level.orders.forEach((recipeId) => {
      getRecipe(recipeId).ingredients.forEach((ingredient) => assert.ok(INGREDIENTS[ingredient]));
    });
  });
});

test('a card is selectable only when no higher overlapping card covers it', () => {
  const state = createGame(2);
  state.tiles = [
    { id: 'lower', ingredient: 'rice', layer: 0, x: 50, y: 50, active: true },
    { id: 'left', ingredient: 'salmon', layer: 1, x: 41, y: 50, active: true },
    { id: 'right', ingredient: 'tuna', layer: 1, x: 59, y: 50, active: true },
    { id: 'unrelated', ingredient: 'shrimp', layer: 1, x: 85, y: 82, active: true }
  ];
  assert.equal(isTilePickable(state, 'left'), true);
  assert.equal(isTilePickable(state, 'lower'), false);
  let next = selectTile(state, 'left').state;
  assert.equal(isTilePickable(next, 'lower'), false, 'the second overlapping card still covers it');
  next = selectTile(next, 'right').state;
  assert.equal(isTilePickable(next, 'lower'), true, 'local removal unlocks the lower card');
  assert.equal(next.tiles.find(t => t.id === 'unrelated').active, true, 'no whole-layer lock');
});

test('three matching raw ingredients clear the seven-slot rail and produce one prepared ingredient', () => {
  let state = createGame(0);
  state = pickTriple(state, 'rice');
  assert.equal(state.rail.length, 0);
  assert.equal(state.pantry.rice, 1);
  assert.equal(state.harvests, 1);
  assert.equal(getPantryItems(state)[0].ingredient, 'rice');
});

test('the core craft transition produces sushi before the front customer receives it', () => {
  let state = createGame(0);
  state = pickTriple(state, 'rice');
  state = pickTriple(state, 'salmon');
  assert.equal(canCraftActive(state), true);
  assert.equal(serveActiveCustomer(state).changed, false);

  state = craftActiveSushi(state).state;
  assert.equal(state.workbench.crafted.recipeId, 'salmon');
  const first = getActiveCustomer(state);
  state = serveActiveCustomer(state).state;
  assert.equal(state.served, 1);
  assert.equal(state.customers.find((customer) => customer.id === first.id).status, 'served');
  assert.equal(state.coins >= RECIPES.salmon.tip, true);
});

test('the last raw pick can be undone only while an undo token remains', () => {
  let state = createGame(0);
  const firstSalmon = getVisibleTiles(state).find((tile) => tile.ingredient === 'salmon');
  state = selectTile(state, firstSalmon.id).state;
  const rice = getVisibleTiles(state).find((tile) => tile.ingredient === 'rice');
  state = selectTile(state, rice.id).state;
  const secondSalmon = getVisibleTiles(state).find((tile) => tile.ingredient === 'salmon');
  state = selectTile(state, secondSalmon.id).state;
  assert.deepEqual(getRailTiles(state).map((tile) => tile.ingredient), ['salmon', 'salmon', 'rice']);
  const tokensBefore = state.undoTokens;
  state = undoRailPick(state).state;
  assert.deepEqual(getRailTiles(state).map((tile) => tile.ingredient), ['salmon', 'rice']);
  assert.equal(state.undoTokens, tokensBefore - 1);
  assert.equal(state.tiles.find((item) => item.id === secondSalmon.id).active, true);
  assert.equal(state.tiles.find((item) => item.id === rice.id).active, false);
});

test('a legal seven-pick sequence with no triple loses the round', () => {
  let state = createGame(2);
  state.tiles = ['rice', 'salmon', 'tuna', 'shrimp', 'rice', 'salmon', 'tuna'].map((ingredient, i) => ({
    id: 'loss-' + i, ingredient, layer: 0, x: 15 + i % 3 * 30, y: 20 + Math.floor(i / 3) * 30, active: true
  }));
  const lossPath = state.tiles.map(t => t.id);
  lossPath.forEach((id) => {
    assert.equal(isTilePickable(state, id), true, id + ' should be a legal visible pick');
    state = selectTile(state, id).state;
  });
  assert.equal(state.status, 'lost');
  assert.equal(state.rail.length, 7);
  lossPath.forEach((id) => assert.equal(state.tiles.find((tile) => tile.id === id).active, false));
});

LEVELS.forEach((level,index)=>{
  test('day '+level.id+' has an independently discoverable route that crafts and serves every order',()=>{
    const result = findWinningState(createGame(index));
    assert.equal(result.status, 'won', level.name);
    assert.equal(result.served, level.orders.length);
  });
});

test('all project-bound generated art is present', () => {
  assert.equal(existsSync(new URL('../assets/sushi-atlas-v2.png', import.meta.url)), true);
  assert.equal(existsSync(new URL('../assets/ingredient-atlas-v1.png', import.meta.url)), true);
  assert.equal(existsSync(new URL('../assets/customer-atlas-v1.png', import.meta.url)), true);
});
