import { generateLayout, randomSource } from './level-generator.js';
import { CAMPAIGN_LAYOUTS } from './campaign-layouts.js';

export const INGREDIENTS = Object.freeze({
  rice: { label: '米饭' },
  salmon: { label: '三文鱼' },
  tuna: { label: '金枪鱼' },
  shrimp: { label: '甜虾' },
  tamago: { label: '玉子烧' },
  cucumber: { label: '黄瓜' },
  nori: { label: '海苔' },
  roe: { label: '鱼子' },
  avocado: { label: '牛油果' }
});

export const RECIPES = Object.freeze({
  salmon: {
    id: 'salmon',
    label: '三文鱼握寿司',
    ingredients: ['rice', 'salmon'],
    foodSprite: 'salmon',
    tip: 18
  },
  tuna: {
    id: 'tuna',
    label: '金枪鱼握寿司',
    ingredients: ['rice', 'tuna'],
    foodSprite: 'tuna',
    tip: 20
  },
  shrimp: {
    id: 'shrimp',
    label: '甜虾握寿司',
    ingredients: ['rice', 'shrimp'],
    foodSprite: 'shrimp',
    tip: 21
  },
  tamago: {
    id: 'tamago',
    label: '玉子烧握寿司',
    ingredients: ['rice', 'tamago'],
    foodSprite: 'tamago',
    tip: 18
  },
  makiCucumber: {
    id: 'makiCucumber',
    label: '黄瓜卷',
    ingredients: ['nori', 'rice', 'cucumber'],
    foodSprite: 'makiCucumber',
    tip: 28
  },
  makiSalmon: {
    id: 'makiSalmon',
    label: '三文鱼卷',
    ingredients: ['nori', 'rice', 'salmon'],
    foodSprite: 'makiSalmon',
    tip: 30
  },
  makiAvocado: {
    id: 'makiAvocado',
    label: '牛油果卷',
    ingredients: ['nori', 'rice', 'avocado'],
    foodSprite: 'makiAvocado',
    tip: 29
  },
  roe: {
    id: 'roe',
    label: '鱼子军舰',
    ingredients: ['nori', 'rice', 'roe'],
    foodSprite: 'roe',
    tip: 32
  }
});

export const CUSTOMER_SKINS = Object.freeze({
  ginger: { label: '橘猫' },
  calico: { label: '三花猫' },
  gray: { label: '灰猫' }
});

const CUSTOMER_SKIN_ORDER = ['ginger', 'calico', 'gray', 'ginger', 'calico'];

/* Cards are positioned in board percentages. A lower card is selectable whenever
 * no higher card overlaps its usable face; this is deliberately not a whole-layer
 * lock. The numbers match the physical tile footprint used by the CSS board. */
const TILE_FOOTPRINT = Object.freeze({ x: 20, y: 20 });

// Endless waves use a fixed course seed, not a new random deal per attempt.
export const ENDLESS_COURSE_SEED = 0x51f150;

function proceduralLevel(id, name, rank, seed) {
  const random = randomSource(seed ^ 0xa31f6a9d);
  const available = ['salmon', 'tamago', 'tuna', 'shrimp', 'makiCucumber', 'makiSalmon', 'roe', 'makiAvocado']
    .slice(0, Math.min(8, 3 + Math.floor(rank / 2)));
  const pool = [...available];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const orders = Array.from({ length: Math.min(10, 4 + Math.floor(rank / 3)) }, (_, i) => pool[i % pool.length]);
  const groups = orders.flatMap(recipe => RECIPES[recipe].ingredients);
  const layout = generateLayout({ id, groups, seed, rank });
  return {
    id, name, orders, ...layout, railLimit: 7, undoLimit: rank < 4 ? 2 : 1,
    difficulty: rank < 3 ? '进阶' : rank < 9 ? '挑战' : '高手',
    subtitle: rank < 3 ? '同类食材分散在多层，先给备料栏留空位' : '七格不扩容 · 跨层找三连，别急着收散牌',
    assist: false, seed, rank
  };
}

function freezeDefinition(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDefinition);
    Object.freeze(value);
  }
  return value;
}

export const LEVELS = freezeDefinition(CAMPAIGN_LAYOUTS.map(record => {
  const { cards, solution, ...info } = record;
  const tiles = cards.map(([ingredient, layer, x, y, tilt], i) => ({
    id: 'l' + info.id + '-food-' + i, ingredient, layer, x, y, tilt, active: true
  }));
  const layerFoods = Array.from({ length: Math.max(...tiles.map(t => t.layer)) + 1 },
    (_, layer) => tiles.filter(t => t.layer === layer).map(t => t.ingredient));
  return { ...info, tiles, layoutVersion: 1, layerFoods, top: layerFoods.at(-1),
    layers: layerFoods.map(foods => foods.length), solution: solution.map(i => tiles[i].id) };
}));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}



function recipeIngredientCounts(recipe) {
  return recipe.ingredients.reduce((counts, ingredient) => {
    counts[ingredient] = (counts[ingredient] || 0) + 1;
    return counts;
  }, {});
}

function makeCustomerQueue(level) {
  return level.orders.map((order, index) => {
    const skin = CUSTOMER_SKIN_ORDER[index % CUSTOMER_SKIN_ORDER.length];
    return {
      id: 'l' + level.id + '-customer-' + index,
      skin,
      order,
      status: 'waiting'
    };
  });
}

function ingredientUnitCounts(level) {
  const units = {};
  level.orders.forEach((recipeId) => {
    RECIPES[recipeId].ingredients.forEach((ingredient) => {
      units[ingredient] = (units[ingredient] || 0) + 1;
    });
  });
  return units;
}

function validateLevel(level) {
  const expectedRawCount = level.orders
    .flatMap((recipeId) => RECIPES[recipeId].ingredients)
    .length * 3;
  const boardCount = level.layers.reduce((total, count) => total + count, 0);
  if (expectedRawCount !== boardCount || level.top.length !== level.layers.at(-1)) {
    throw new Error('关卡“' + level.name + '”的食材数量或顶层配置不一致。');
  }

  if (!Array.isArray(level.layerFoods) || level.layerFoods.length !== level.layers.length
    || level.layerFoods.some((foods, index) => foods.length !== level.layers[index])) {
    throw new Error('关卡“' + level.name + '”的每层食材配置不一致。');
  }

  if (level.layerFoods.at(-1).join('|') !== level.top.join('|')) {
    throw new Error('关卡“' + level.name + '”的顶层食材配置不一致。');
  }

  const expectedCounts = Object.fromEntries(
    Object.entries(ingredientUnitCounts(level)).map(([ingredient, units]) => [ingredient, units * 3])
  );
  const boardCounts = level.layerFoods.flat().reduce((counts, ingredient) => {
    if (!INGREDIENTS[ingredient]) {
      throw new Error('关卡“' + level.name + '”使用了未知食材。');
    }
    counts[ingredient] = (counts[ingredient] || 0) + 1;
    return counts;
  }, {});
  [...new Set([...Object.keys(expectedCounts), ...Object.keys(boardCounts)])].forEach((ingredient) => {
    if ((expectedCounts[ingredient] || 0) !== (boardCounts[ingredient] || 0)) {
      throw new Error('关卡“' + level.name + '”的' + ingredient + '数量无法完整覆盖订单。');
    }
  });
}

function makeTiles(level) {
  return clone(level.tiles);
}

function ingredientStock() {
  return Object.fromEntries(Object.keys(INGREDIENTS).map((ingredient) => [ingredient, 0]));
}

function activeTileCount(state) {
  return state.tiles.filter((tile) => tile.active).length;
}

function tilesOverlap(upper, lower, footprint = TILE_FOOTPRINT) {
  return Math.abs(upper.x - lower.x) < footprint.x
    && Math.abs(upper.y - lower.y) < footprint.y;
}

function isCovered(tile, activeTiles, footprint) {
  return activeTiles.some((upper) => upper.layer > tile.layer && tilesOverlap(upper, tile, footprint));
}

function insertRailTile(state, tileId) {
  const tile = getTile(state, tileId);
  const matchingIndexes = state.rail
    .map((id, index) => ({ id, index }))
    .filter(({ id }) => getTile(state, id).ingredient === tile.ingredient)
    .map(({ index }) => index);
  if (matchingIndexes.length === 0) {
    state.rail.push(tileId);
  } else {
    state.rail.splice(matchingIndexes.at(-1) + 1, 0, tileId);
  }
}

function canCraftActiveInternal(state) {
  const active = getActiveCustomer(state);
  if (!active || state.workbench.crafted) {
    return false;
  }
  const needed = recipeIngredientCounts(getRecipe(active.order));
  return Object.entries(needed).every(([ingredient, count]) => state.pantry[ingredient] >= count);
}

function resolveFinish(state) {
  const hasWaiting = state.customers.some((customer) => customer.status === 'waiting');
  if (!hasWaiting && activeTileCount(state) === 0 && state.rail.length === 0 && !state.workbench.crafted) {
    state.status = 'won';
    state.event = '食材堆清空，今天的寿司全部送达！';
  }
}

LEVELS.forEach(validateLevel);

export function createGame(levelIndex = 0) {
  const normalizedIndex = Math.max(0, Math.min(Number.isFinite(levelIndex) ? Math.floor(levelIndex) : 0, LEVELS.length - 1));
  const level = LEVELS[normalizedIndex];
  return gameForLevel(level, normalizedIndex);
}

function gameForLevel(level, levelIndex = 0) {
  return {
    mode: 'campaign', levelIndex,
    tiles: makeTiles(level),
    rail: [],
    pickHistory: [],
    pantry: ingredientStock(),
    customers: makeCustomerQueue(level),
    workbench: { crafted: null },
    served: 0,
    coins: 0,
    combo: 0,
    harvests: 0,
    undoTokens: level.undoLimit,
    event: '点没有被压住的食材，七格里凑三份同类。',
    status: 'playing'
  };
}

export function createEndlessGame(_legacySeed = ENDLESS_COURSE_SEED, wave = 1, totals = {}) {
  const normalizedWave = Number.isSafeInteger(wave) && wave > 0 ? wave : 1;
  const runSeed = ENDLESS_COURSE_SEED;
  const rank = Math.min(26, normalizedWave + 4);
  const level = proceduralLevel('endless-' + normalizedWave, '无尽营业', rank, runSeed ^ Math.imul(normalizedWave, 2654435761));
  validateLevel(level);
  return {
    ...gameForLevel(level), mode: 'endless', definition: level,
    wave: normalizedWave, runSeed,
    runCoins: Number.isSafeInteger(totals.coins) && totals.coins >= 0 ? totals.coins : 0,
    runServed: Number.isSafeInteger(totals.served) && totals.served >= 0 ? totals.served : 0
  };
}

export function nextEndlessWave(state) {
  if (state.mode !== 'endless' || state.status !== 'won') return { state, changed: false };
  return { state: createEndlessGame(state.runSeed, state.wave + 1, { coins: state.runCoins, served: state.runServed }), changed: true };
}

export function getLevel(state) {
  return state.mode === 'endless' ? state.definition : LEVELS[state.levelIndex];
}

export function getRecipe(recipeId) {
  return RECIPES[recipeId] || null;
}

export function getTile(state, tileId) {
  return state.tiles.find((tile) => tile.id === tileId) || null;
}

export function getVisibleTiles(state) {
  const active = state.tiles.filter((tile) => tile.active);
  return active.filter((tile) => !isCovered(tile, active, getLevel(state).footprint));
}

export function isTilePickable(state, tileId) {
  const tile = getTile(state, tileId);
  return Boolean(tile && tile.active && state.status === 'playing' && getVisibleTiles(state).some((item) => item.id === tileId));
}

export function getRailTiles(state) {
  return state.rail.map((id) => getTile(state, id));
}

export function getActiveCustomer(state) {
  return state.customers.find((customer) => customer.status === 'waiting') || null;
}

export function getVisibleCustomers(state) {
  return state.customers.filter((customer) => customer.status === 'waiting').slice(0, 3);
}

export function getRecipeSlots(state) {
  const active = getActiveCustomer(state);
  if (!active) {
    return [];
  }
  const recipe = getRecipe(active.order);
  if (state.workbench.crafted?.recipeId === recipe.id) {
    return recipe.ingredients.map((ingredient) => ({ ingredient, filled: true }));
  }
  const inventory = { ...state.pantry };
  return recipe.ingredients.map((ingredient) => {
    if (inventory[ingredient] > 0) {
      inventory[ingredient] -= 1;
      return { ingredient, filled: true };
    }
    return { ingredient, filled: false };
  });
}

export function getPantryItems(state) {
  return Object.entries(state.pantry)
    .filter(([, count]) => count > 0)
    .map(([ingredient, count]) => ({ ingredient, count }));
}

export function getRemainingTileCount(state) {
  return activeTileCount(state);
}

export function canCraftActive(state) {
  return state.status === 'playing' && canCraftActiveInternal(state);
}

export function selectTile(state, tileId) {
  if (!isTilePickable(state, tileId)) {
    return { state, changed: false, reason: 'covered' };
  }

  const next = clone(state);
  const tile = getTile(next, tileId);
  tile.active = false;
  insertRailTile(next, tileId);
  next.pickHistory.push(tileId);
  const same = next.rail.filter((id) => getTile(next, id).ingredient === tile.ingredient);
  let harvested = null;

  if (same.length === 3) {
    next.rail = next.rail.filter((id) => !same.includes(id));
    next.pickHistory = next.pickHistory.filter((id) => !same.includes(id));
    next.pantry[tile.ingredient] += 1;
    next.harvests += 1;
    harvested = tile.ingredient;
    next.event = '三份' + INGREDIENTS[tile.ingredient].label + '变成一份备料！';
  }

  if (next.rail.length >= getLevel(next).railLimit) {
    next.status = 'lost';
    next.event = '七格备料栏满了，没能凑出三连。';
  } else if (!harvested) {
    const pairCount = next.rail.filter((id) => getTile(next, id).ingredient === tile.ingredient).length;
    next.event = pairCount === 2
      ? '再找一份' + INGREDIENTS[tile.ingredient].label + '就能三连！'
      : INGREDIENTS[tile.ingredient].label + '进入备料栏。';
  }

  return { state: next, changed: true, harvested, crafted: false };
}

export function craftActiveSushi(state) {
  const active = getActiveCustomer(state);
  if (state.status !== 'playing' || !active || !canCraftActiveInternal(state)) {
    return { state, changed: false, reason: 'ingredients' };
  }
  const next = clone(state);
  const customer = getActiveCustomer(next);
  const recipe = getRecipe(customer.order);
  const needed = recipeIngredientCounts(recipe);
  Object.entries(needed).forEach(([ingredient, count]) => {
    next.pantry[ingredient] -= count;
  });
  next.workbench.crafted = { recipeId: recipe.id, customerId: customer.id };
  next.event = recipe.label + '做好了，正在自动出餐！';
  return { state: next, changed: true, recipe: recipe.id };
}

export function undoRailPick(state) {
  if (state.status !== 'playing' || state.rail.length === 0) {
    return { state, changed: false, reason: 'empty' };
  }
  if (state.undoTokens <= 0) {
    return { state, changed: false, reason: 'tokens' };
  }
  const next = clone(state);
  const tileId = next.pickHistory.pop();
  const railIndex = next.rail.lastIndexOf(tileId);
  next.rail.splice(railIndex, 1);
  const tile = getTile(next, tileId);
  tile.active = true;
  next.undoTokens -= 1;
  next.event = INGREDIENTS[tile.ingredient].label + '回到了食材堆。';
  return { state: next, changed: true };
}

export function serveActiveCustomer(state) {
  const active = getActiveCustomer(state);
  if (state.status !== 'playing' || !active) {
    return { state, changed: false, reason: 'unavailable' };
  }
  if (!state.workbench.crafted) {
    return { state, changed: false, reason: 'not-crafted' };
  }
  if (state.workbench.crafted.recipeId !== active.order) {
    return { state, changed: false, reason: 'wrong-sushi' };
  }

  const next = clone(state);
  const served = getActiveCustomer(next);
  const recipe = getRecipe(served.order);
  served.status = 'served';
  next.workbench.crafted = null;
  next.served += 1;
  next.combo += 1;
  const reward = recipe.tip + Math.min(5, Math.max(0, next.combo - 1)) * 4;
  next.coins += reward;
  if (next.mode === 'endless') {
    next.runCoins += reward;
    next.runServed += 1;
  }
  next.event = recipe.label + '已送达！获得 ' + reward + ' 金币。';
  resolveFinish(next);
  return { state: next, changed: true, served: recipe.id, reward };
}

export function getServiceProgress(state) {
  return {
    served: state.served,
    target: state.customers.length,
    rail: state.rail.length,
    railLimit: getLevel(state).railLimit,
    undoTokens: state.undoTokens
  };
}
