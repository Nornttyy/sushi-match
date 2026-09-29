import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_LAYOUTS } from '../src/campaign-layouts.js';
import { areSealNeighbours, getSealLayers, independentSealMatches, stabilizeCampaignSeals } from '../src/nori-seals.js';
import { LEVELS, createGame, getCampaignLevel, getLevel, getVisibleTiles, isTilePickable,
  selectTile, canCraftActive, craftActiveSushi, serveActiveCustomer } from '../src/game-core.js';
import { Session } from '../wechat/src/session.js';

const source = (id, ingredient = 'rice') => ({ id, ingredient });
const settle = state => {
  while (canCraftActive(state)) state = serveActiveCustomer(craftActiveSushi(state).state).state;
  return state;
};
const pick = (state, id) => {
  const result = selectTile(state, id);
  assert.ok(result.changed, id + ' must be pickable');
  return settle(result.state);
};
const prefix = ['l15-food-53', 'l15-food-49', 'l15-food-51'];

test('seal budgets count independent matches, not neighbours or repeated references', () => {
  assert.equal(independentSealMatches([]), 0);
  for (let count = 1; count <= 4; count++) {
    assert.equal(independentSealMatches(Array.from({ length: count }, (_, i) => source('r' + i))), Math.ceil(count / 3));
  }
  assert.equal(independentSealMatches([source('a'), source('b', 'tuna')]), 2);
  assert.equal(independentSealMatches([source('a'), source('a'), source('b')]), 1);
  assert.equal(independentSealMatches([source('a'), source('b', 'tuna'), source('c', 'salmon')]), 3);
});

test('normalization caps only unsafe wraps and does not count neighbours matched too late', () => {
  const tiles = [
    { ...source('a'), layer: 0, x: 14, y: 22 },
    { ...source('b'), layer: 0, x: 38, y: 51 },
    { ...source('c'), layer: 0, x: 90, y: 90 },
    { ...source('target', 'tuna'), layer: 0, x: 38, y: 22, sealed: true, sealLayers: 2 },
    { ...source('late', 'salmon'), layer: 0, x: 62, y: 22 },
    { ...source('s2', 'salmon'), layer: 0, x: 90, y: 22 },
    { ...source('s3', 'salmon'), layer: 0, x: 90, y: 51 }
  ];
  const level = { tiles, solution: tiles.map(t => t.id) }, original = structuredClone(level);
  const normalized = stabilizeCampaignSeals(level);
  assert.equal(normalized.tiles[3].sealLayers, 1);
  assert.equal(normalized.tiles[3].sealed, true);
  assert.deepEqual(level, original, 'input definitions remain untouched');
  assert.deepEqual(stabilizeCampaignSeals(normalized), normalized, 'normalization is idempotent');
  assert.throws(() => stabilizeCampaignSeals({ ...level, solution: ['target', 'a', 'b', 'c', 'late', 's2', 's3'] }),
    /No prior seal trigger/, 'a self-dependent seal is rejected instead of silently accepted');
});

test('all six orders of the day-15 failing triple now open the seal and can finish the entire level', () => {
  for (const a of prefix) for (const b of prefix.filter(id => id !== a)) {
    const picks = [a, b, prefix.find(id => id !== a && id !== b)];
    let state = createGame(14);
    assert.equal(getSealLayers(state.tiles.find(t => t.id === 'l15-food-50')), 1);
    for (const id of picks) state = pick(state, id);
    assert.equal(state.tiles.find(t => t.id === 'l15-food-50').sealed, false);
    assert.equal(state.rail.length, 0);
    assert.equal(state.status, 'playing');
    for (const id of getLevel(state).solution) if (!prefix.includes(id)) state = pick(state, id);
    assert.equal(state.status, 'won');
    assert.equal(state.served, 8);
    assert.equal(state.undoTokens, LEVELS[14].undoLimit);
  }
});

test('safe wrap counts preserve every authored card, seal location, order and timed difficulty', () => {
  let corrected = 0;
  for (const [index, record] of CAMPAIGN_LAYOUTS.entries()) {
    const level = LEVELS[index], seals = new Map(record.seals);
    assert.deepEqual(level.tiles.map(t => [t.ingredient, t.layer, t.x, t.y, t.tilt]), record.cards);
    assert.deepEqual(level.orders, record.orders);
    assert.deepEqual(level.solution, record.solution.map(i => level.tiles[i].id));
    for (const [i, tile] of level.tiles.entries()) {
      assert.equal(tile.sealed, seals.has(i));
      assert.ok(tile.sealLayers <= (seals.get(i) || 0));
      if (tile.sealLayers < (seals.get(i) || 0)) corrected++;
    }
    assert.equal(level.railLimit, 7);
    assert.equal(level.undoLimit, record.undoLimit);
  }
  assert.ok(corrected > 1, 'repair the whole family of bad placements, not only day 15');
  assert.ok(LEVELS.some(level => level.tiles.some(t => t.sealLayers === 3)), 'supported three-layer seals remain');
});

test('authored and generated seals stay within independent prior-trigger budgets', () => {
  for (const level of [...LEVELS, ...Array.from({ length: 80 }, (_, i) => getCampaignLevel(i + 48)),
    getCampaignLevel(999), getCampaignLevel(9999), getCampaignLevel(999999)]) {
    const matched = new Set(), byId = new Map(level.tiles.map(t => [t.id, t]));
    let rail = [];
    for (const id of level.solution) {
      const tile = byId.get(id);
      if (tile.sealed) {
        const counts = new Map();
        for (const other of level.tiles) if (matched.has(other.id) && areSealNeighbours(tile, other)) {
          counts.set(other.ingredient, (counts.get(other.ingredient) || 0) + 1);
        }
        const capacity = [...counts.values()].reduce((sum, count) => sum + Math.ceil(count / 3), 0);
        assert.ok(tile.sealLayers >= 1 && tile.sealLayers <= capacity, tile.id);
      }
      rail.push(tile);
      const same = rail.filter(t => t.ingredient === tile.ingredient);
      if (same.length === 3) {
        same.forEach(t => matched.add(t.id));
        rail = rail.filter(t => t.ingredient !== tile.ingredient);
      }
    }
  }
});

test('alternative legal play cannot consume every neighbour and leave a wrapped card behind', () => {
  let selections = 0;
  for (const index of [4, 11, 14, 18, 30, 46, 47, 48, 52, 99, 999]) for (let attempt = 0; attempt < 24; attempt++) {
    let state = createGame(index), seed = (index + 1) * 1009 + attempt;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    while (state.status === 'playing') {
      let choices = getVisibleTiles(state).filter(t => isTilePickable(state, t.id));
      assert.ok(choices.length, 'a playing board must have an action after delivery settles');
      if (attempt % 2) {
        const matching = choices.filter(t => state.rail.some(id => state.tiles.find(other => other.id === id).ingredient === t.ingredient));
        if (matching.length) choices = matching;
      }
      state = pick(state, choices[Math.floor(random() * choices.length)].id);
      selections++;
      for (const tile of state.tiles.filter(t => t.active && t.sealed)) {
        assert.ok(state.tiles.some(other => (other.active || state.rail.includes(other.id)) && areSealNeighbours(tile, other)),
          tile.id + ' lost every trigger in attempt ' + attempt);
      }
    }
  }
  assert.ok(selections > 1500, 'exercise alternate routes, not only the stored witness');
});

test('WeChat delivery, rewards, progress and retry also use the repaired day-15 deal', () => {
  const data = new Map([['sushi-wechat-progress-v1', { selected: 14, unlocked: 14 }]]);
  const platform = { get: key => data.get(key), set: (key, value) => { data.set(key, structuredClone(value)); return true; }, effect() {} };
  const session = new Session(platform);
  session.start();
  const initialWallet = session.shop.coins;
  const route = [...prefix, ...session.level.solution.filter(id => !prefix.includes(id))];
  for (const id of route) {
    for (let n = 0; n < 100 && !isTilePickable(session.game, id); n++) session.tick(50);
    assert.ok(session.pick(id), id);
    session.tick(50);
  }
  for (let n = 0; n < 300 && session.game.status === 'playing'; n++) session.tick(50);
  assert.equal(session.game.status, 'won');
  assert.equal(session.shop.coins, initialWallet + session.game.coins);
  assert.equal(session.unlocked, 15);
  session.replay();
  assert.deepEqual(session.game.tiles, createGame(14).tiles);
  assert.equal(session.shop.coins, initialWallet + settle(route.reduce(pick, createGame(14))).coins);
});
