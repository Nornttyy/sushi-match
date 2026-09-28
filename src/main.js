import {
  INGREDIENTS,
  LEVELS,
  advanceGameTime,
  canCraftActive,
  craftActiveSushi,
  createGame,
  createEndlessGame,
  nextEndlessWave,
  getActiveCustomer,
  getLevel,
  getPantryItems,
  getRailTiles,
  getRecipe,
  getRecipeSlots,
  getRemainingTileCount,
  getServiceProgress,
  getVisibleCustomers,
  getVisibleTiles,
  isTilePickable,
  selectTile,
  serveActiveCustomer,
  undoRailPick
} from './game-core.js';
import { GameSound } from './sound.js';
import { mountShop } from './shop-ui.js';
import { mountFeedback } from './feedback.js';
import { createCatPortrait, setCatState } from './cat-portrait.js';
import { foodIcon, setFoodArt } from './food-art.js';
import { SEAL_HINT, SEAL_BANDS, getSealLayers } from './nori-seals.js';
import { mountJuice } from './juice.js';
import { MOTION } from './motion-core.js';
import { mountMenuBook } from './menu-book.js';
import { createPlayClock, formatTime } from './timer-core.js';
import { BOARD_SHAPES, shapeBoardFrame, svgPath } from './board-shapes.js';

const LEVEL_STORAGE_KEY = 'sushi-stack-kitchen-level';
const UNLOCK_STORAGE_KEY = 'sushi-stack-kitchen-unlocked-level';
const ENDLESS_WAVE_KEY = 'sushi-stack-endless-best-wave';
const ENDLESS_ORDERS_KEY = 'sushi-stack-endless-best-orders';

const gameShell = document.querySelector('.game-shell');
const levelName = document.querySelector('#level-name');
const targetProgress = document.querySelector('#target-progress');
const railProgress = document.querySelector('#rail-progress');
const coinCount = document.querySelector('#coin-count');
const comboCount = document.querySelector('#combo-count');
const customerRail = document.querySelector('#customer-rail');
const tileBoard = document.querySelector('#tile-board');
const tileField = document.querySelector('#tile-field');
const boardGuide = document.querySelector('#board-guide');
const tileCount = document.querySelector('#tile-count');
const prepTitle = document.querySelector('#prep-title');
const recipeSlots = document.querySelector('#recipe-slots');
const craftedPlate = document.querySelector('#crafted-plate');
const pantry = document.querySelector('#pantry');
const deliveryStatus = document.querySelector('#delivery-status');
const ingredientRail = document.querySelector('#ingredient-rail');
const undoButton = document.querySelector('#undo-button');
const message = document.querySelector('#message');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayText = document.querySelector('#overlay-text');
const overlayButton = document.querySelector('#overlay-button');
const overlayMenuButton = document.querySelector('#overlay-menu-button');
const overlayReplayButton = document.querySelector('#overlay-replay-button');
const countdown = document.querySelector('#countdown');
const countdownTime = document.querySelector('#countdown-time');
const countdownLabel = document.querySelector('#countdown-label');
const restartButton = document.querySelector('#restart-button');
const soundButton = document.querySelector('#sound-button');
const handoffFx = document.querySelector('#handoff-fx');
const mainMenu = document.querySelector('#main-menu');
const menuSoundButton = document.querySelector('#menu-sound-button');
const menuLevelTitle = document.querySelector('#menu-level-title');
const menuLevelCopy = document.querySelector('#menu-level-copy');
const levelPicker = document.querySelector('#level-picker');
const menuStartButton = document.querySelector('#menu-start-button');
const menuRadioLabel = document.querySelector('#menu-radio-label');
const menuRecipePreview = document.querySelector('#menu-recipe-preview');
const modePicker = document.querySelector('#mode-picker');
const levelPagination = document.querySelector('#level-pagination');
const levelPageLabel = document.querySelector('#level-page-label');
const levelPrevious = document.querySelector('#level-previous');
const levelNext = document.querySelector('#level-next');
const endlessPreview = document.querySelector('#endless-preview');
const endlessRecord = document.querySelector('#endless-record');
const endlessNewButton = document.querySelector('#endless-new-button');
const creditsDialog = document.querySelector('#credits-dialog');
const settingsSoundToggle = document.querySelector('#settings-sound-toggle');

function readStoredLevel(key, fallback = 0) {
  try {
    const value = Number.parseInt(localStorage.getItem(key) || String(fallback), 10);
    return Number.isInteger(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredLevel(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Progress persistence is optional when browser storage is unavailable.
  }
}

const lastLevelIndex = LEVELS.length - 1;
let savedLevel = Math.max(0, Math.min(readStoredLevel(LEVEL_STORAGE_KEY), lastLevelIndex));
let unlockedLevel = Math.max(savedLevel, Math.min(readStoredLevel(UNLOCK_STORAGE_KEY, savedLevel), lastLevelIndex));
let selectedLevel = savedLevel;
let selectedMode = 'campaign';
let levelPage = Math.floor(savedLevel / 3);
let endlessSession = null;
let bestEndlessWave = Math.max(0, readStoredLevel(ENDLESS_WAVE_KEY));
let bestEndlessOrders = Math.max(0, readStoredLevel(ENDLESS_ORDERS_KEY));
let state = createGame(selectedLevel);
let previousVisibleTiles = new Set();
let isMenuOpen = true;
// Only rail merges briefly gate input. Delivery has its own single worker.
let isResolving = false;
let isDelivering = false;
let resolveEpoch = 0;
const playClock = createPlayClock();
let timerDisplay = '';

const sounds = new GameSound();
let menuBook;
const shop = mountShop({ root: mainMenu, onSound: name => sounds.play(name),
  onEditingChange:editing=>menuBook?.show(editing?'decor':'home') });
menuBook=mountMenuBook({root:mainMenu,onSound:name=>sounds.play(name),onChange:page=>{
  if(page==='decor')shop.openEditor({notify:false});else shop.closeEditor({notify:false});
}});
const feedback = mountFeedback({ overlay, gameShell, ingredientIcon });
const juice = mountJuice({ board: tileBoard, rail: ingredientRail, prep: document.querySelector('.recipe-plate') });
sounds.onPlaybackChange = syncMenuMusic;

function ingredientIcon(ingredient, className = '') {
  return foodIcon('ingredient', ingredient, className);
}

function sushiIcon(recipeId, className = '') {
  return foodIcon('sushi', getRecipe(recipeId).foodSprite, className);
}

function saveProgress() {
  if (state.mode === 'endless') return;
  savedLevel = state.levelIndex;
  writeStoredLevel(LEVEL_STORAGE_KEY, savedLevel);
}

function unlockNextDay() {
  if (state.mode === 'endless') return;
  unlockedLevel = Math.max(unlockedLevel, Math.min(state.levelIndex + 1, lastLevelIndex));
  writeStoredLevel(UNLOCK_STORAGE_KEY, unlockedLevel);
}

function recordEndless() {
  if (state.mode !== 'endless') return;
  bestEndlessWave = Math.max(bestEndlessWave, state.wave - (state.status === 'won' ? 0 : 1));
  bestEndlessOrders = Math.max(bestEndlessOrders, state.runServed);
  writeStoredLevel(ENDLESS_WAVE_KEY, bestEndlessWave);
  writeStoredLevel(ENDLESS_ORDERS_KEY, bestEndlessOrders);
}

function syncSoundButtons() {
  const enabled = sounds.enabled;
  soundButton.textContent = enabled ? '♪' : '×';
  soundButton.setAttribute('aria-pressed', String(enabled));
  soundButton.setAttribute('aria-label', enabled ? '关闭声音' : '开启声音');
  syncMenuMusic(sounds.isBgmPlaying());
}

function syncMenuMusic(playing) {
  mainMenu.classList.toggle('is-music-playing', playing);
  settingsSoundToggle.setAttribute('aria-pressed', String(sounds.enabled));
  settingsSoundToggle.textContent=sounds.enabled?'声音：开':'声音：关';
  settingsSoundToggle.setAttribute('aria-label',sounds.enabled?'关闭声音':'开启声音');
  menuRadioLabel.textContent = !sounds.enabled ? '音乐已关' : playing ? '小店电台' : '轻点播放';
}

function toggleSound() {
  const enabled = sounds.toggle();
  syncSoundButtons();
  if (enabled) {
    sounds.play('ui');
  }
}

function showMessage(text) {
  message.textContent = text;
}

function renderMenu() {
  const endless = selectedMode === 'endless';
  const level = LEVELS[selectedLevel];
  const available = endless || selectedLevel <= unlockedLevel;
  const canContinue = endlessSession && endlessSession.status !== 'lost';
  menuLevelTitle.textContent = endless ? '无尽营业' : '第 ' + level.id + ' 天 · ' + level.name;
  menuLevelCopy.textContent = endless ? '固定关卡 · 逐波加难' : available
    ? level.orders.length + ' 单 · ' + formatTime(level.timeLimitMs) + ' · ' + level.difficulty
    : '完成第 ' + selectedLevel + ' 天后解锁';
  menuStartButton.querySelector('span').textContent = endless ? (canContinue ? '继续第 ' + endlessSession.wave + ' 波' : '开始挑战') : available ? '开始营业' : '先完成第 ' + selectedLevel + ' 天';
  menuStartButton.disabled = !available;
  mainMenu.dataset.mode = selectedMode;
  levelPicker.hidden = endless;
  levelPagination.hidden = endless;
  endlessPreview.hidden = !endless;
  endlessNewButton.hidden = !endless || !canContinue;
  endlessRecord.textContent = '最高 ' + bestEndlessWave + ' 波 · 最多 ' + bestEndlessOrders + ' 单';
  modePicker.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === selectedMode)));
  levelPrevious.disabled = levelPage === 0;
  levelNext.disabled = (levelPage + 1) * 3 >= LEVELS.length;
  levelPageLabel.textContent = (levelPage * 3 + 1) + '–' + Math.min(LEVELS.length, (levelPage + 1) * 3) + ' / ' + LEVELS.length;
  modePicker.querySelector('[data-mode="campaign"]').textContent='闯关 · '+LEVELS.length+' 天';
  menuRecipePreview.replaceChildren();
  for (const recipeId of new Set(endless ? ['salmon', 'makiCucumber', 'roe', 'makiAvocado'] : level.orders)) {
    const recipe = getRecipe(recipeId);
    const item = document.createElement('span');
    item.className = 'menu-recipe-item';
    item.title = recipe.label;
    item.setAttribute('aria-label', recipe.label);
    item.append(sushiIcon(recipeId));
    menuRecipePreview.append(item);
  }
  levelPicker.querySelectorAll('.menu-day').forEach((button, slot) => {
    const index = levelPage * 3 + slot;
    button.hidden = index >= LEVELS.length;
    if (button.hidden) return;
    button.dataset.level = String(index);
    button.querySelector('.menu-day-label').textContent = '第 ' + (index + 1) + ' 天';
    setFoodArt(button.querySelector('.sushi-icon'), 'sushi', getRecipe(LEVELS[index].orders[0]).foodSprite);
    const available = index <= unlockedLevel;
    button.classList.toggle('is-selected', index === selectedLevel);
    button.classList.toggle('is-locked', !available);
    button.setAttribute('aria-pressed', String(index === selectedLevel));
    button.setAttribute('aria-label', available ? '选择第 ' + (index + 1) + ' 天，查看当日菜单' : '预览第 ' + (index + 1) + ' 天，尚未解锁');
  });
}

function syncMenuInteractivity() {
  mainMenu.inert = !isMenuOpen;
  for (const element of gameShell.children) {
    if (element !== mainMenu && element !== creditsDialog) {
      element.inert = isMenuOpen;
    }
  }
}

const customerNodes = new Map();
function renderCustomers() {
  const active = getActiveCustomer(state);
  const visibleIds = new Set();
  getVisibleCustomers(state).forEach((customer, index) => {
    visibleIds.add(customer.id);
    const recipe = getRecipe(customer.order);
    let card = customerNodes.get(customer.id);
    if (!card) {
      card = document.createElement('div');
      const bubble = document.createElement('span');
      bubble.className = 'order-bubble'; bubble.append(sushiIcon(recipe.id, 'bubble-sushi'));
      const body = document.createElement('span'); body.className = 'customer-body';
      body.append(createCatPortrait(customer.skin));
      card.append(bubble, body); customerNodes.set(customer.id, card);
    }
    card.classList.add('customer-card');
    card.classList.toggle('is-active', active?.id === customer.id);
    card.classList.toggle('is-queued', index > 0);
    card.dataset.customerId = customer.id;
    card.setAttribute('aria-label', '顾客，想要' + recipe.label);

    setFoodArt(card.querySelector('.bubble-sushi'), 'sushi', recipe.foodSprite);
    if (state.status === 'lost') setCatState(card, 'disappointed');
    else if (card.querySelector('.cat-portrait').dataset.state === 'disappointed') setCatState(card, 'waiting');
    if (customerRail.children[index] !== card) customerRail.insertBefore(card, customerRail.children[index] || null);
  });
  for (const [id, card] of customerNodes) if (!visibleIds.has(id)) { card.remove(); customerNodes.delete(id); }
}

function currentRecipeNeeds(ingredient) {
  const active = getActiveCustomer(state);
  if (!active || state.workbench.crafted) {
    return false;
  }
  const recipe = getRecipe(active.order);
  const totalNeeded = recipe.ingredients.filter((item) => item === ingredient).length;
  return totalNeeded > (state.pantry[ingredient] || 0);
}

const tileNodes = new Map();
function renderBoardGeometry() {
  const level=getLevel(state),shape=BOARD_SHAPES[level.shape];
  const frame=shapeBoardFrame({x:0,y:0,w:tileBoard.clientWidth,h:tileBoard.clientHeight},level.shape);
  tileBoard.dataset.shape=level.shape||'';
  tileBoard.style.setProperty('--tile-width',level.footprint.x+'%');
  tileBoard.style.setProperty('--tile-height',level.footprint.y+'%');
  for(const element of [tileField,boardGuide])Object.assign(element.style,{left:frame.x+'px',top:frame.y+'px',width:frame.w+'px',height:frame.h+'px'});
  if(boardGuide.dataset.shape!==(level.shape||'')){
    boardGuide.dataset.shape=level.shape||'';boardGuide.replaceChildren();
    if(shape){
      const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
      svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
      for(const guide of shape.paths){const p=document.createElementNS(ns,'path');p.setAttribute('d',svgPath(guide.commands));p.setAttribute('fill',guide.fill);p.setAttribute('stroke',guide.stroke);p.setAttribute('stroke-width',guide.width);svg.append(p);}
      boardGuide.append(svg);
    }
  }
}
function renderTileBoard() {
  renderBoardGeometry();
  const visible = getVisibleTiles(state);
  const visibleIds = new Set(visible.map((tile) => tile.id));
  const activeTiles = state.tiles.filter((tile) => tile.active);
  activeTiles.sort((left, right) => left.layer - right.layer || left.y - right.y || left.x - right.x);

  const activeIds = new Set(activeTiles.map(tile => tile.id));
  for (const [id, node] of tileNodes) if (!activeIds.has(id)) { node.remove(); tileNodes.delete(id); }
  activeTiles.forEach((tile, index) => {
    const isUncovered = visibleIds.has(tile.id);
    const pickable = isTilePickable(state, tile.id);
    const sealLayers = getSealLayers(tile);
    const canInteract = pickable && !isResolving && !isMenuOpen;
    const newlyRevealed = isUncovered && !previousVisibleTiles.has(tile.id);
    let button = tileNodes.get(tile.id);
    if (!button) {
      button = document.createElement('button');
      const plate = document.createElement('span'); plate.className = 'stack-plate'; button.append(plate);
      button.addEventListener('animationend', event => { if (event.target === button) button.classList.remove('is-revealed'); });
      tileNodes.set(tile.id, button);
    }
    button.type = 'button';
    button.className = 'stack-tile'
      + (isUncovered ? (tile.sealed ? ' is-sealed' : ' is-pickable') : ' is-covered')
      + (newlyRevealed || (isUncovered && button.classList.contains('is-revealed')) ? ' is-revealed' : '')
      + (pickable && getLevel(state).assist && currentRecipeNeeds(tile.ingredient) ? ' is-wanted' : '')
      + ' layer-' + tile.layer;
    button.style.setProperty('--x', tile.x + '%');
    button.style.setProperty('--y', tile.y + '%');
    button.style.setProperty('--layer', String(tile.layer));
    button.style.setProperty('--tilt', tile.tilt + 'deg');
    button.dataset.tileId = tile.id;
    button.dataset.sealLayers = String(sealLayers);
    button.disabled = !canInteract;
    button.setAttribute('aria-label', isUncovered
      ? INGREDIENTS[tile.ingredient].label + (tile.sealed ? '，' + sealLayers + '层海苔，邻牌三消揭一层' : '')
      : '被上方食材压住');

    const plate = button.firstElementChild;
    if (isUncovered && !plate.firstChild) plate.append(ingredientIcon(tile.ingredient, 'stack-food'));
    else if (isUncovered) setFoodArt(plate.firstChild, 'ingredient', tile.ingredient);
    else if (!isUncovered) plate.replaceChildren();
    for (const seal of button.querySelectorAll('.nori-seal')) {
      if (!isUncovered) seal.remove();
      else if (seal.dataset.locked === 'true' && Number(seal.dataset.band) >= sealLayers) {
        seal.dataset.locked = 'false'; juice.peel(seal);
      }
    }
    if (isUncovered) for (let band = 0; band < sealLayers; band++) {
      if (button.querySelector('.nori-seal[data-locked="true"][data-band="' + band + '"]')) continue;
      const seal = document.createElement('span'), geometry = SEAL_BANDS[band];
      seal.className = 'nori-seal'; seal.dataset.locked = 'true'; seal.dataset.band = String(band);
      for (const [key, value] of Object.entries(geometry)) seal.style.setProperty('--seal-' + key, value + (key === 'rotate' ? 'deg' : '%'));
      seal.setAttribute('aria-hidden', 'true'); button.append(seal);
    }
    let badge = button.querySelector('.seal-count');
    if (isUncovered && sealLayers > 1) {
      if (!badge) { badge = document.createElement('b'); badge.className = 'seal-count'; badge.setAttribute('aria-hidden', 'true'); button.append(badge); }
      badge.textContent = String(sealLayers);
    } else badge?.remove();
    if (tileField.children[index] !== button) tileField.insertBefore(button, tileField.children[index] || null);
  });
  previousVisibleTiles = visibleIds;
  tileBoard.classList.toggle('is-generated', getLevel(state).footprint.y === 26);
  tileCount.textContent = '剩 ' + getRemainingTileCount(state);
  document.getElementById('board-label').textContent = activeTiles.some(tile => tile.sealed) ? SEAL_HINT : BOARD_SHAPES[getLevel(state).shape]?.label || '食材台';
}

function renderPrep() {
  const active = getActiveCustomer(state);
  recipeSlots.replaceChildren();
  pantry.replaceChildren();
  const crafted = state.workbench.crafted;
  const orderKey = crafted?.customerId || '';
  // Picking while serving must not recreate the dish or restart its animation.
  if (craftedPlate.dataset.order !== orderKey) {
    craftedPlate.dataset.order = orderKey;
    craftedPlate.replaceChildren(...(crafted ? [sushiIcon(crafted.recipeId, 'crafted-sushi')] : []));
  }
  craftedPlate.classList.toggle('is-ready', !!crafted);
  deliveryStatus.classList.toggle('is-delivering', !!crafted);

  if (!active) {
    prepTitle.textContent = '今天收工';
    deliveryStatus.textContent = '订单完成';
    return;
  }

  const recipe = getRecipe(active.order);
  prepTitle.textContent = recipe.label;
  if (state.workbench.crafted) {
    deliveryStatus.textContent = '正在端餐';
  } else {
    getRecipeSlots(state).forEach((slot) => {
      const item = document.createElement('span');
      item.className = 'recipe-slot' + (slot.filled ? ' is-filled' : '');
      item.append(ingredientIcon(slot.ingredient, 'recipe-ingredient'));
      recipeSlots.append(item);
    });
    deliveryStatus.textContent = '';
  }

  const items = getPantryItems(state);
  if (items.length > 0) {
    items.forEach((item) => {
      const chip = document.createElement('span');
      chip.className = 'pantry-item';
      chip.append(ingredientIcon(item.ingredient, 'pantry-icon'));
      const count = document.createElement('b');
      count.textContent = '×' + item.count;
      chip.append(count);
      pantry.append(chip);
    });
  }
}

function renderIngredientRail() {
  ingredientRail.replaceChildren();
  const level = getLevel(state);
  const items = getRailTiles(state);
  ingredientRail.closest('.ingredient-rail-area').dataset.pressure = items.length >= 7 ? 'full' : items.length >= 5 ? 'warning' : 'normal';
  ingredientRail.closest('.ingredient-rail-area').querySelector('.rail-heading small').textContent = items.length >= 7 ? '已满' : items.length === 6 ? '剩 1 格' : '';
  const counts = items.reduce((result, tile) => {
    result[tile.ingredient] = (result[tile.ingredient] || 0) + 1;
    return result;
  }, {});
  for (let index = 0; index < level.railLimit; index += 1) {
    const item = items[index];
    const slot = document.createElement('span');
    slot.className = 'rail-slot'
      + (item ? ' is-filled' : '')
      + (item && counts[item.ingredient] === 2 ? ' is-pair' : '');
    if (item) {
      slot.dataset.railId = item.id;
      slot.append(ingredientIcon(item.ingredient, 'rail-food'));
      if (counts[item.ingredient] === 2) {
        const badge = document.createElement('b');
        badge.className = 'pair-badge';
        badge.textContent = '2';
        slot.append(badge);
      }
    }
    ingredientRail.append(slot);
  }
  undoButton.disabled = isResolving || isMenuOpen || state.status !== 'playing' || items.length === 0 || state.undoTokens <= 0;
  undoButton.textContent = state.undoTokens > 0 ? '撤回 ×' + state.undoTokens : '撤回用完';
  juice.sync();
}

function renderOverlay() {
  feedback.render(state, isMenuOpen || (isResolving && state.status === 'lost'));
}

function render() {
  const level = getLevel(state);
  const progress = getServiceProgress(state);
  levelName.textContent = state.mode === 'endless' ? '无尽 · 第 ' + state.wave + ' 波' : '第 ' + level.id + ' 天 · ' + level.name;
  targetProgress.textContent = progress.served + ' / ' + progress.target;
  railProgress.textContent = progress.rail + ' / ' + progress.railLimit;
  coinCount.textContent = String(state.mode === 'endless' ? state.runCoins : state.coins);
  comboCount.textContent = state.combo > 1 ? '连击 ×' + state.combo : '';
  renderCustomers();
  renderTileBoard();
  renderPrep();
  renderIngredientRail();
  renderOverlay();
  renderTimer();
}

function renderTimer() {
  const limited = Number.isFinite(state.timeRemainingMs);
  const paused = document.hidden || isMenuOpen || isResolving || isDelivering;
  const label = !state.timeStarted ? '点牌开始' : paused && state.status === 'playing' ? '暂停' : '剩余';
  const value = formatTime(state.timeRemainingMs);
  const key = [limited, label, value, state.status].join(':');
  if (key === timerDisplay) return;
  timerDisplay = key; countdown.hidden = !limited;
  countdownTime.textContent = value; countdownLabel.textContent = label;
  countdown.classList.toggle('is-urgent', limited && state.timeRemainingMs <= 20000);
  countdown.setAttribute('aria-label', label + '时间 ' + value);
}

function updateClock(now = performance.now()) {
  const elapsed = playClock.sample(now, !document.hidden && !isMenuOpen && !isResolving && !isDelivering);
  const result = advanceGameTime(state, elapsed); state = result.state;
  if (result.expired) {
    resolveEpoch++; isResolving = false; isDelivering = false; juice.clear(); clearHandoff();
    sounds.play('lose'); render();
  } else renderTimer();
  return result.expired;
}

function clockFrame(now) { updateClock(now); requestAnimationFrame(clockFrame); }

function pause(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function clearHandoff(expectedEpoch) {
  if (expectedEpoch !== undefined && expectedEpoch !== resolveEpoch) {
    return false;
  }
  handoffFx.classList.remove('is-flying');
  handoffFx.replaceChildren();
  customerRail.querySelectorAll('.customer-card').forEach(customer => {
    customer.classList.remove('is-fed', 'is-leaving');
    setCatState(customer, state.status === 'lost' ? 'disappointed' : 'waiting');
  });
  return true;
}

async function animateHandoff(recipeId, customerId, epoch) {
  if (epoch !== resolveEpoch) {
    return false;
  }
  const source = craftedPlate.getBoundingClientRect();
  const target = customerRail.querySelector('[data-customer-id="' + customerId + '"]');
  if (!source.width || !target) {
    await pause(180);
    return epoch === resolveEpoch;
  }
  const targetRect = target.getBoundingClientRect();
  const sourceX = source.left + source.width / 2;
  const sourceY = source.top + source.height / 2;
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height * 0.62;
  handoffFx.replaceChildren(sushiIcon(recipeId, 'handoff-sushi'));
  handoffFx.style.left = sourceX + 'px';
  handoffFx.style.top = sourceY + 'px';
  handoffFx.style.setProperty('--fly-x', (targetX - sourceX) + 'px');
  handoffFx.style.setProperty('--fly-y', (targetY - sourceY) + 'px');
  target.classList.add('is-fed');
  handoffFx.classList.remove('is-flying');
  window.requestAnimationFrame(() => {
    if (epoch === resolveEpoch) {
      handoffFx.classList.add('is-flying');
    }
  });
  await pause(360);
  if (epoch !== resolveEpoch) {
    return false;
  }
  handoffFx.classList.remove('is-flying');
  handoffFx.replaceChildren();
  setCatState(target, 'receiving');
  await pause(230);
  if (epoch !== resolveEpoch) return false;
  setCatState(target, 'happy');
  await pause(280);
  if (epoch !== resolveEpoch) return false;
  setCatState(target, 'leaving'); target.classList.add('is-leaving');
  await pause(160);
  if (epoch !== resolveEpoch) return false;
  clearHandoff(epoch);
  return true;
}

async function resolveAutoOrders() {
  if (isDelivering || isResolving || isMenuOpen || state.status !== 'playing') {
    return;
  }
  isDelivering = true;
  const currentEpoch = resolveEpoch;
  render();

  while (currentEpoch === resolveEpoch && !isMenuOpen && !isResolving && state.status === 'playing') {
    if (!state.workbench.crafted && canCraftActive(state)) {
      const crafted = craftActiveSushi(state);
      if (!crafted.changed) {
        break;
      }
      state = crafted.state;
      state.event = getRecipe(crafted.recipe).label + '做好了，自动递给顾客！';
      sounds.play('craft');
      render();
      await pause(MOTION.craft);
      continue;
    }

    if (!state.workbench.crafted) {
      break;
    }

    const crafted = state.workbench.crafted;
    await animateHandoff(crafted.recipeId, crafted.customerId, currentEpoch);
    if (currentEpoch !== resolveEpoch || isMenuOpen || state.status !== 'playing') {
      break;
    }

    // Read the latest state, which may include picks/merges/undo during flight.
    // Never settle an animation against a different order or a restarted game.
    if (state.workbench.crafted?.customerId !== crafted.customerId) break;
    const result = serveActiveCustomer(state);
    if (!result.changed) {
      break;
    }
    state = result.state;
    shop.award(result.reward);
    recordEndless();
    saveProgress();
    sounds.play('serve');
    if (state.status === 'won') {
      unlockNextDay();
      sounds.play('win');
    }
    render();
    if (state.status === 'won') {
      break;
    }
    await pause(160);
  }

  if (currentEpoch === resolveEpoch) {
    isDelivering = false;
    render();
  }
}

async function chooseTile(tileId) {
  if (isResolving || isMenuOpen) {
    return;
  }
  if (updateClock()) return;
  const result = selectTile(state, tileId);
  if (!result.changed) {
    showMessage(result.reason === 'sealed' ? SEAL_HINT : '这张食材还被上面的牌压着。');
    return;
  }
  const snapshot = juice.capture(state.tiles.find(tile => tile.id === tileId), getRailTiles(state));
  state = result.state;
  // A merge has a short visual resolution; ordinary picks remain rapid-fire.
  isResolving = !!result.harvested || state.status === 'lost';
  sounds.play(result.harvested ? 'triple' : 'pick');
  if (state.status === 'lost') {
    resolveEpoch++; isDelivering = false; clearHandoff();
    recordEndless();
    sounds.play('lose');
  }
  const epoch = resolveEpoch;
  render();
  await juice.pick(snapshot, result.harvested);
  if (epoch !== resolveEpoch || isMenuOpen) return;
  if (state.status === 'lost') { isResolving = false; render(); return; }
  if (result.harvested) { isResolving = false; render(); void resolveAutoOrders(); }
}

function undoPick() {
  if (isResolving || isMenuOpen) {
    return;
  }
  if (updateClock()) return;
  const result = undoRailPick(state);
  if (!result.changed) {
    if (result.reason === 'tokens') {
      showMessage('本关的撤回次数已经用完。');
    }
    return;
  }
  state = result.state;
  juice.clear();
  sounds.play('undo');
  render();
}

function restart(levelIndex = state.levelIndex) {
  playClock.reset(performance.now());
  juice.clear();
  resolveEpoch += 1;
  isResolving = false;
  isDelivering = false;
  clearHandoff();
  state = createGame(levelIndex);
  previousVisibleTiles = new Set();
  selectedLevel = levelIndex;
  saveProgress();
  render();
}

function showMainMenu() {
  updateClock();
  juice.clear();
  if (state.mode === 'endless') endlessSession = state;
  resolveEpoch += 1;
  isResolving = false;
  isDelivering = false;
  isMenuOpen = true;
  void sounds.startBgm();
  clearHandoff();
  selectedLevel = savedLevel;
  levelPage = Math.floor(savedLevel / 3);
  mainMenu.classList.add('is-visible');
  mainMenu.setAttribute('aria-hidden', 'false');
  gameShell.classList.add('is-menu-open');
  syncMenuInteractivity();
  render();
  renderMenu();
  menuBook.show('home',{animate:false});
  window.requestAnimationFrame(() => {
    if(menuBook.page==='home')document.querySelector('#home-business-button').focus({preventScroll:true});
  });
}

function startSelectedLevel() {
  if (selectedMode === 'campaign' && selectedLevel > unlockedLevel) return;
  shop.closeEditor({notify:false});
  sounds.unlock();
  void sounds.startBgm();
  sounds.play('ui');
  isMenuOpen = false;
  mainMenu.classList.remove('is-visible');
  mainMenu.setAttribute('aria-hidden', 'true');
  gameShell.classList.remove('is-menu-open');
  syncMenuInteractivity();
  if (selectedMode === 'endless') {
    installEndless(endlessSession && endlessSession.status !== 'lost' ? endlessSession : newEndlessGame());
  } else restart(selectedLevel);
  void resolveAutoOrders();
  window.requestAnimationFrame(() => tileBoard.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }));
}

function newEndlessGame() {
  return createEndlessGame();
}

function installEndless(next) {
  playClock.reset(performance.now());
  juice.clear();
  resolveEpoch++;
  isResolving = false;
  isDelivering = false;
  clearHandoff();
  state = next;
  endlessSession = next;
  previousVisibleTiles = new Set();
  render();
}

tileBoard.addEventListener('click', (event) => {
  const tile = event.target.closest('.stack-tile');
  if (tile) {
    chooseTile(tile.dataset.tileId);
  }
});

undoButton.addEventListener('click', undoPick);
restartButton.addEventListener('click', showMainMenu);
overlayButton.addEventListener('click', () => {
  sounds.play('ui');
  if (state.mode === 'endless') {
    installEndless(state.status === 'won' ? nextEndlessWave(state).state : newEndlessGame());
    return;
  }
  if (state.status === 'won' && state.levelIndex < LEVELS.length - 1) {
    selectedLevel = state.levelIndex + 1;
    unlockedLevel = Math.max(unlockedLevel, selectedLevel);
    writeStoredLevel(UNLOCK_STORAGE_KEY, unlockedLevel);
    restart(selectedLevel);
  } else if (state.status === 'won') {
    selectedMode = 'endless';
    installEndless(newEndlessGame());
  } else {
    restart(state.levelIndex);
  }
});
overlayMenuButton.addEventListener('click', () => {
  sounds.play('ui');
  showMainMenu();
});
overlayReplayButton.addEventListener('click', () => {
  if (state.status !== 'won') return;
  sounds.play('ui');
  if (state.mode === 'endless') installEndless(newEndlessGame());
  else restart(state.levelIndex);
});
soundButton.addEventListener('click', toggleSound);
menuSoundButton.addEventListener('click', () => {
  if(sounds.enabled&&!sounds.isBgmPlaying())void sounds.startBgm();
  creditsDialog.showModal();
});
settingsSoundToggle.addEventListener('click',toggleSound);
levelPicker.addEventListener('click', (event) => {
  const day = event.target.closest('.menu-day');
  if (!day) {
    return;
  }
  const next = Number(day.dataset.level);
  selectedLevel = next;
  sounds.play('ui');
  renderMenu();
});
modePicker.addEventListener('click', event => {
  const button = event.target.closest('[data-mode]');
  if (!button) return;
  selectedMode = button.dataset.mode;
  sounds.play('ui');
  renderMenu();
});
function turnLevelPage(direction) {
  levelPage = Math.max(0, Math.min(Math.ceil(LEVELS.length / 3) - 1, levelPage + direction));
  selectedLevel = levelPage * 3;
  sounds.play('ui');
  renderMenu();
}
levelPrevious.addEventListener('click', () => turnLevelPage(-1));
levelNext.addEventListener('click', () => turnLevelPage(1));
endlessNewButton.addEventListener('click', () => {
  endlessSession = null;
  startSelectedLevel();
});
creditsDialog.addEventListener('click', (event) => {
  if (event.target !== creditsDialog) return;
  const box = creditsDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) {
    creditsDialog.close();
  }
});
menuStartButton.addEventListener('click', startSelectedLevel);
document.querySelector('#home-business-button').addEventListener('click',()=>{
  sounds.play('ui');menuBook.show('business',{focus:true});
});
document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('#menu-sound-button, #sound-button')) return;
  void sounds.unlock();
  void sounds.resumeBgm();
}, { capture: true, passive: true });
document.addEventListener('keydown', (event) => {
  if (event.target.closest('#menu-sound-button, #sound-button')) return;
  void sounds.unlock();
  void sounds.resumeBgm();
}, { capture: true });
document.addEventListener('visibilitychange', () => {
  playClock.reset(performance.now());
  renderTimer();
  if (document.hidden) {
    sounds.pauseForVisibility();
  } else {
    void sounds.resumeAfterVisibility();
  }
});

syncSoundButtons();
syncMenuInteractivity();
render();
renderMenu();
new ResizeObserver(renderBoardGeometry).observe(tileBoard);
void sounds.startBgm();
requestAnimationFrame(clockFrame);
