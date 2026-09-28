import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, RECIPES, createGame, createEndlessGame, nextEndlessWave, getLevel,
  isTilePickable, getVisibleTiles, selectTile, canCraftActive, craftActiveSushi, serveActiveCustomer } from '../src/game-core.js';
import { layoutMixMetrics } from '../src/level-generator.js';

function finishViaWitness(input) {
  let state = input;
  let peak = 0;
  for (const id of getLevel(state).solution) {
    assert.equal(isTilePickable(state, id), true, 'each witness pick is physically uncovered');
    state = selectTile(state, id).state;
    peak = Math.max(peak, state.rail.length);
    assert.notEqual(state.status, 'lost');
    while (state.workbench.crafted || canCraftActive(state)) {
      state = state.workbench.crafted ? serveActiveCustomer(state).state : craftActiveSushi(state).state;
    }
  }
  assert.equal(state.status, 'won');
  assert.equal(state.served, getLevel(state).orders.length);
  assert.equal(state.rail.length, 0);
  assert.ok(state.tiles.every(t => !t.active));
  assert.ok(Object.values(state.pantry).every(n => n === 0));
  return { state, peak };
}

test('24 campaign days preserve the tutorial and increase variety, depth and decisions', () => {
  assert.equal(LEVELS.length, 24);
  assert.equal(LEVELS[0].assist, true);
  for (let i = 0; i < LEVELS.length; i++) {
    const initial = createGame(i);
    const result = finishViaWitness(initial);
    assert.equal(LEVELS[i].assist, i === 0);
    assert.equal(LEVELS[i].railLimit, 7);
    const mix=layoutMixMetrics(initial.tiles,LEVELS[i].footprint);
    assert.ok(mix.largestCluster<=2,`day ${i+1}: no three-food same-layer clumps`);
    assert.equal(mix.dominance,0,`day ${i+1}: no layer dominated by one ingredient`);
    if (i > 4) assert.ok(result.peak >= 5, 'later layouts require buffering unmatched ingredients');
  }
  assert.ok(createGame(23).tiles.length > createGame(1).tiles.length);
  assert.ok(new Set(createGame(23).tiles.map(t => t.ingredient)).size >= 8);
  assert.ok(LEVELS[23].layers.length > LEVELS[1].layers.length);
});

test('endless waves are fixed across attempts, with different layouts per wave', () => {
  const first = createEndlessGame(123);
  assert.deepEqual(createEndlessGame(123), first);
  assert.deepEqual(createEndlessGame(124).tiles, first.tiles);
  assert.deepEqual(createEndlessGame().tiles, first.tiles);
  assert.notDeepEqual(createEndlessGame(123, 2).tiles, first.tiles);
  assert.equal(nextEndlessWave(first).changed, false);
  assert.equal(nextEndlessWave(createGame(0)).changed, false);
});

test('the first 100 and very late fixed waves have legal solutions and bounded board size', () => {
  for (const wave of [...Array.from({ length: 100 }, (_, i) => i + 1), 1000, 1000000]) {
      const initial = createEndlessGame(undefined, wave);
      const expected = getLevel(initial).orders.flatMap(id => RECIPES[id].ingredients).length * 3;
      assert.equal(initial.tiles.length, expected);
      assert.ok(initial.tiles.length <= 90, 'phone workload does not grow with run length');
      assert.equal(initial.wave, wave);
      const mix=layoutMixMetrics(initial.tiles,getLevel(initial).footprint);
      assert.ok(mix.largestCluster<=2,`wave ${wave}: no three-food same-layer clumps`);
      assert.equal(mix.dominance,0);
      finishViaWitness(initial);
  }
});

test('campaign layouts are stored records, immutable and identical after any retry', () => {
  for (let index = 0; index < LEVELS.length; index++) {
    const initial = createGame(index);
    const original = structuredClone(initial);
    const picked = selectTile(initial, getLevel(initial).solution[0]);
    assert.equal(picked.changed, true);
    assert.deepEqual(createGame(index), original);
    initial.tiles[0].ingredient = 'broken';
    assert.deepEqual(createGame(index), original, 'runtime state cannot mutate the authored board');
    assert.ok(Object.isFrozen(LEVELS[index].tiles[0]));
    assert.equal(LEVELS[index].layoutVersion, index<6?3:2);
    assert.equal(new Set(LEVELS[index].solution).size, original.tiles.length);
  }
});

test('advancing a wave keeps run totals, resets the board and does not award extra income', () => {
  let finished = finishViaWitness(createEndlessGame(42)).state;
  const next = nextEndlessWave(finished);
  assert.equal(next.changed, true);
  assert.equal(next.state.wave, 2);
  assert.equal(next.state.runCoins, finished.runCoins);
  assert.equal(next.state.runServed, finished.runServed);
  assert.equal(next.state.coins, 0);
  assert.equal(next.state.served, 0);
  assert.equal(next.state.rail.length, 0);
  assert.equal(next.state.status, 'playing');
  assert.equal(serveActiveCustomer(finished).changed, false);
  finished = finishViaWitness(next.state).state;
  assert.ok(finished.runCoins > next.state.runCoins);
  assert.equal(finished.runServed, next.state.runServed + getLevel(finished).orders.length);
});

test('real later boards can lose to careless choices, rather than every sequence being safe', () => {
  let losses = 0;
  for (let seed = 1; seed <= 30; seed++) {
    let state = createEndlessGame(seed, 8);
    let guard = 0;
    while (state.status === 'playing' && guard++ < 100) {
      const choices = getVisibleTiles(state);
      state = selectTile(state, choices[(seed + guard * 7) % choices.length].id).state;
      while (state.status === 'playing' && (state.workbench.crafted || canCraftActive(state))) {
        state = state.workbench.crafted ? serveActiveCustomer(state).state : craftActiveSushi(state).state;
      }
    }
    if (state.status === 'lost') losses++;
  }
  assert.ok(losses >= 20, 'random picking should be risky on challenging layouts');
});
