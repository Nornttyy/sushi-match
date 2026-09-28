import {
  DECOR_ZONES, SHOP_STORAGE_KEY, createShop, restoreShop,
  getDecoration, earnShopCoins, purchaseAndPlace, moveDecoration, flipDecoration, storeDecoration,
  SHOP_THEMES, getTheme, purchaseTheme, DECOR_FILTERS, getDecorCatalog, getShopRoomFrame
} from './shop-core.js';
import { DECOR_ART } from './decor-assets.js';
import { clippedAtlas } from './atlas-art.js';

export function mountShop({ root, onSound = () => {}, onEditingChange = () => {} }) {
  const layer = root.querySelector('#shop-decor-layer');
  const tray = root.querySelector('#decor-tray');
  const catalog = root.querySelector('#decor-catalog');
  const wallet = root.querySelector('#shop-wallet');
  const hint = root.querySelector('#decor-hint');
  const selection = root.querySelector('#decor-selection');
  const done = root.querySelector('#decor-done');
  const homeButton = root.querySelector('#home-business-button');
  const zone = root.querySelector('#decor-zone');
  const room = root.querySelector('#shop-room');
  const roomImage = room.querySelector('.menu-interior');
  const themes = root.querySelector('#theme-catalog');
  const tabs = root.querySelector('#decor-tabs');
  const filters = root.querySelector('#decor-filters');
  let category = 'all';
  let tab = 'decor';
  let previewTheme = null;
  const normalControls = [...root.querySelectorAll('.menu-hero, #level-picker, #level-pagination, #endless-preview, #mode-picker, .menu-level-info, #menu-start-button')];
  let state = createShop();
  let editing = false;
  let selected = null;
  let drag = null;
  let saved = true;
  try {
    const stored = JSON.parse(localStorage.getItem(SHOP_STORAGE_KEY));
    state = restoreShop(stored);
    // Commit the retirement before showing the wallet, even if the player
    // reloads without buying or moving anything in the shop.
    if (Array.isArray(stored?.owned) && stored.owned.includes('lamp')) persist();
  } catch { /* A fresh shop is safe when storage is unavailable. */ }

  function persist() {
    try { localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(state)); saved = true; }
    catch { saved = false; hint.textContent = '无法保存，请勿关闭页面'; }
  }

  function fitRoom() {
    const toolbarTop=editing ? tray.getBoundingClientRect().top-root.getBoundingClientRect().top : null;
    const r=getShopRoomFrame(root.clientWidth,root.clientHeight,toolbarTop);
    Object.assign(room.style, {width:r.w+'px',height:r.h+'px',left:r.x+'px',top:r.y+'px'});
  }
  new ResizeObserver(fitRoom).observe(root);
  new ResizeObserver(fitRoom).observe(tray);
  fitRoom();

  function renderThemes() {
    const active = previewTheme || state.theme;
    root.dataset.theme = active;
    const src = './assets/menu/' + getTheme(active).image;
    if (roomImage.getAttribute('src') !== src) roomImage.src = src;
    themes.replaceChildren();
    for (const item of SHOP_THEMES) {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'decor-buy theme-buy'; card.dataset.themeId = item.id;
      card.setAttribute('aria-pressed', String(active === item.id));
      const thumb = document.createElement('img');
      thumb.src = './assets/menu/' + item.image; thumb.alt = ''; thumb.className = 'theme-thumbnail';
      const name = document.createElement('b'); name.textContent = item.name;
      const price = document.createElement('small');
      price.textContent = state.theme === item.id ? '使用中' : state.ownedThemes.includes(item.id) ? '免费切换' : previewTheme === item.id ? item.price + ' 金币 · 再点购买' : item.price + ' 金币 · 预览';
      card.append(thumb, name, price); themes.append(card);
    }
    catalog.hidden = tab !== 'decor'; themes.hidden = tab !== 'themes';
    filters.hidden = tab !== 'decor';
    tabs.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
  }

  function sprite(id) {
    const image = document.createElement('span');
    image.className = 'decor-sprite';
    image.dataset.decor = id;
    image.setAttribute('aria-hidden', 'true');
    const art = DECOR_ART[id];
    image.classList.add('is-cropped');
    image.style.setProperty('--dw',String(art.crop[2]));image.style.setProperty('--dh',String(art.crop[3]));
    image.append(clippedAtlas({...art,file:'./assets/'+art.file},art.crop));
    return image;
  }

  function positionButton(button, placement) {
    button.style.left = placement.x + '%';
    button.style.top = placement.y + '%';
    button.style.width = getDecoration(placement.id).width + '%';
    button.style.zIndex = placement.id === 'rug' ? '1' : String(10 + Math.round(placement.y));
    button.classList.toggle('is-flipped', placement.flipped);
    button.classList.toggle('is-selected', placement.id === selected);
  }

  function updateSelection() {
    const item = getDecoration(selected);
    selection.hidden = !item;
    zone.hidden = !item;
    if (item) {
      root.querySelector('#decor-selected-name').textContent = item.name;
      const area = DECOR_ZONES[item.zone];
      zone.textContent = area.name;
      zone.style.left = area.minX + '%';
      zone.style.top = area.minY + '%';
      zone.style.width = (area.maxX - area.minX) + '%';
      zone.style.height = (area.maxY - area.minY) + '%';
    }
    layer.querySelectorAll('.placed-decor').forEach(b => b.classList.toggle('is-selected', b.dataset.decorId === selected));
  }

  function select(id) {
    selected = id;
    const item = getDecoration(id);
    hint.textContent = '';
    updateSelection();
  }

  function render() {
    const catalogScroll = catalog.scrollLeft;
    wallet.textContent = String(state.coins);
    renderThemes();
    layer.replaceChildren();
    for (const p of state.placements) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'placed-decor';
      button.dataset.decorId = p.id;
      button.setAttribute('aria-label', getDecoration(p.id).name + '，拖动或按方向键移动');
      button.tabIndex = editing ? 0 : -1;
      button.append(sprite(p.id));
      positionButton(button, p);
      layer.append(button);
    }
    catalog.replaceChildren();
    filters.replaceChildren();
    for(const group of DECOR_FILTERS){
      const button=document.createElement('button');button.type='button';button.dataset.category=group.id;
      button.textContent=group.name;button.setAttribute('aria-pressed',String(category===group.id));filters.append(button);
    }
    for (const item of getDecorCatalog(category)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'decor-buy';
      button.dataset.buy = item.id;
      const placed = state.placements.some(p => p.id === item.id);
      const owned = state.owned.includes(item.id);
      button.classList.toggle('is-unaffordable', !owned && state.coins < item.price);
      const name = document.createElement('b');
      name.textContent = item.name;
      const price = document.createElement('small');
      price.textContent = placed ? '已摆放 · 调整' : owned ? '免费摆放' : item.price + ' 金币购买';
      const thumbnail = document.createElement('span');
      thumbnail.className = 'decor-thumbnail';
      thumbnail.append(sprite(item.id));
      button.append(thumbnail, name, price);
      button.setAttribute('aria-label', item.name + '，' + price.textContent);
      catalog.append(button);
    }
    catalog.scrollLeft = catalogScroll;
    updateSelection();
    fitRoom();
  }

  function finishDrag(cancel = false) {
    if (!drag) return;
    if (cancel) state = moveDecoration(state, drag.id, drag.original.x, drag.original.y);
    drag = null;
    persist();
    render();
  }

  function openEditor({notify=true}={}) {
    if(editing)return;
    editing = true;
    root.classList.add('is-decorating');
    tray.hidden = false;
    normalControls.forEach(el => { el.inert = true; });
    hint.textContent = '';
    render();
    if(notify)onEditingChange(true);
    done.focus({ preventScroll: true });
  }

  function closeEditor({notify=true}={}) {
    if(!editing)return;
    finishDrag();
    editing = false;
    selected = null;
    previewTheme = null;
    root.classList.remove('is-decorating');
    tray.hidden = true;
    normalControls.forEach(el => { el.inert = false; });
    render();
    if(notify){onEditingChange(false);homeButton.focus({ preventScroll: true });}
  }

  done.addEventListener('click', closeEditor);
  tabs.addEventListener('click', event => {
    const button = event.target.closest('[data-tab]');
    if (!button || !editing) return;
    tab = button.dataset.tab; selected = null; previewTheme = null;
    render();
    hint.textContent = '';
  });
  filters.addEventListener('click', event=>{
    const button=event.target.closest('[data-category]');if(!button||!editing)return;
    category=button.dataset.category;catalog.scrollLeft=0;render();hint.textContent='';
  });
  themes.addEventListener('click', event => {
    const button = event.target.closest('[data-theme-id]');
    if (!button || !editing) return;
    const id = button.dataset.themeId;
    if (!state.ownedThemes.includes(id) && previewTheme !== id) {
      previewTheme = id; renderThemes(); hint.textContent = '预览中 · 再点购买'; return;
    }
    const result = purchaseTheme(state, id);
    if (result.reason === 'coins') { hint.textContent = '还差 ' + (getTheme(id).price - state.coins) + ' 金币'; return; }
    state = result.state; previewTheme = null; persist(); render(); onSound('ui');
    hint.textContent = '';
  });
  catalog.addEventListener('click', event => {
    const button = event.target.closest('[data-buy]');
    if (!button || !editing) return;
    const id = button.dataset.buy;
    const result = purchaseAndPlace(state, id);
    if (result.reason === 'coins') {
      hint.textContent = '还差 ' + (getDecoration(id).price - state.coins) + ' 金币';
      onSound('ui');
      return;
    }
    if (result.reason === 'space') { hint.textContent = '空间不足'; return; }
    state = result.state;
    select(id);
    persist();
    render();
    layer.querySelector('[data-decor-id="' + id + '"]')?.focus({ preventScroll: true });
    onSound('pick');
  });
  layer.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-decor-id]');
    if (!editing || !button || event.button !== 0 || drag) return;
    event.preventDefault();
    select(button.dataset.decorId);
    const p = state.placements.find(p => p.id === selected);
    drag = { id: selected, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, original: { ...p }, rect: layer.getBoundingClientRect() };
    button.focus({ preventScroll: true });
    button.setPointerCapture(event.pointerId);
  });
  layer.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    state = moveDecoration(state, drag.id,
      drag.original.x + (event.clientX - drag.startX) / drag.rect.width * 100,
      drag.original.y + (event.clientY - drag.startY) / drag.rect.height * 100);
    const p = state.placements.find(p => p.id === drag.id);
    positionButton(layer.querySelector('[data-decor-id="' + drag.id + '"]'), p);
  });
  layer.addEventListener('pointerup', event => { if (drag?.pointer === event.pointerId) finishDrag(); });
  layer.addEventListener('pointercancel', event => { if (drag?.pointer === event.pointerId) finishDrag(true); });
  layer.addEventListener('keydown', event => {
    const button = event.target.closest('[data-decor-id]');
    if (!editing || !button) return;
    const offset = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!offset) return;
    event.preventDefault();
    select(button.dataset.decorId);
    const p = state.placements.find(p => p.id === selected);
    state = moveDecoration(state, selected, p.x + offset[0], p.y + offset[1]);
    positionButton(button, state.placements.find(p => p.id === selected));
    persist();
  });
  root.querySelector('#decor-flip').addEventListener('click', () => {
    if (!selected) return;
    state = flipDecoration(state, selected); persist(); render(); onSound('ui');
  });
  root.querySelector('#decor-store').addEventListener('click', () => {
    state = storeDecoration(state, selected); selected = null; persist(); render();
    if (saved) hint.textContent = '';
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && editing) { event.preventDefault(); closeEditor(); }
  });
  render();
  return {
    openEditor,
    closeEditor,
    award(amount) { state = earnShopCoins(state, amount); persist(); render(); }
  };
}
