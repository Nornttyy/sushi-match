export const SHOP_STORAGE_KEY = 'sushi-stack-shop-v1';

export const DECORATIONS = Object.freeze([
  { id: 'bonsai', name: '小盆栽', price: 0, width: 21, ratio: 383 / 366, zone: 'counter', x: 29, y: 34.5 },
  { id: 'picture', name: '寿司挂画', price: 320, width: 26, ratio: 292 / 380, zone: 'wall', x: 51, y: 25.5 },
  { id: 'cabinet', name: '收纳小柜', price: 720, width: 34, ratio: 307 / 423, zone: 'floor', x: 31, y: 72 },
  { id: 'rug', name: '奶油地毯', price: 460, width: 55, ratio: 207 / 458, zone: 'floor', x: 50, y: 78 },
  { id: 'board', name: '今日菜单牌', price: 380, width: 24, ratio: 370 / 369, zone: 'floor', x: 74, y: 73 }
]);

export const SHOP_THEMES = Object.freeze([
  { id: 'cream', name: '奶油原木', price: 0, image: 'sushi-interior-v1.png' },
  { id: 'garden', name: '樱庭春日', price: 1400, image: 'theme-garden-v1.png' },
  { id: 'night', name: '月港夜食', price: 2200, image: 'theme-night-v1.png' }
]);
export const ROOM_RATIO = 4 / 7;
export function getTheme(id) { return SHOP_THEMES.find(t => t.id === id); }

export const DECOR_ZONES = Object.freeze({
  wall: { name: '墙面', minX: 25, maxX: 83, minY: 11, maxY: 29 },
  counter: { name: '台面', minX: 14, maxX: 85, minY: 21, maxY: 34.5 },
  floor: { name: '地面', minX: 13, maxX: 87, minY: 55, maxY: 79 }
});

export function getDecoration(id) { return DECORATIONS.find(item => item.id === id); }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function decorationPosition(id, x, y) {
  const item = getDecoration(id);
  if (!item) return null;
  const zone = DECOR_ZONES[item.zone];
  const half = item.width / 2;
  return {
    x: clamp(finite(x, item.x), zone.minX + half, zone.maxX - half),
    y: clamp(finite(y, item.y), zone.minY + item.width * item.ratio * ROOM_RATIO, zone.maxY)
  };
}

export function decorationBounds(placement) {
  const item = getDecoration(placement.id);
  return { left: placement.x - item.width / 2, right: placement.x + item.width / 2,
    top: placement.y - item.width * item.ratio * ROOM_RATIO, bottom: placement.y };
}

export function overlapsDecoration(placements, candidate) {
  if (candidate.id === 'rug') return false;
  const a = decorationBounds(candidate);
  return placements.some(p => {
    if (p.id === candidate.id || p.id === 'rug') return false;
    const b = decorationBounds(p);
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  });
}

function freePosition(placements, id, x, y) {
  const pos = { id, ...decorationPosition(id, x, y) };
  if (!overlapsDecoration(placements, pos)) return pos;
  const zone = DECOR_ZONES[getDecoration(id).zone];
  for (let py = zone.maxY; py >= zone.minY; py -= 1) {
    for (let px = zone.minX; px <= zone.maxX; px += 1) {
      const candidate = { id, ...decorationPosition(id, px, py) };
      if (!overlapsDecoration(placements, candidate)) return candidate;
    }
  }
  return null;
}

export function createShop() {
  return { version: 2, coins: 0, owned: ['bonsai'], placements: [], theme: 'cream', ownedThemes: ['cream'] };
}

export function restoreShop(value) {
  if (!value || typeof value !== 'object' || ![1, 2].includes(value.version)) return createShop();
  // Historical saves do not retain purchase prices. Refund the last catalog
  // price once; removing the retired ID makes subsequent restores idempotent.
  const retiredRefund = Array.isArray(value.owned) && value.owned.includes('lamp') ? 220 : 0;
  const owned = [...new Set(['bonsai', ...(Array.isArray(value.owned) ? value.owned : [])])].filter(id => getDecoration(id));
  const placements = [];
  for (const p of Array.isArray(value.placements) ? value.placements : []) {
    if (!p || !owned.includes(p.id) || placements.some(item => item.id === p.id)) continue;
    const pos = freePosition(placements, p.id, p.x, p.y);
    if (pos) placements.push({ ...pos, flipped: p.flipped === true });
  }
  const ownedThemes = [...new Set(['cream', ...(Array.isArray(value.ownedThemes) ? value.ownedThemes : [])])].filter(id => getTheme(id));
  const theme = ownedThemes.includes(value.theme) ? value.theme : 'cream';
  return { version: 2, coins: Math.min(9999999, clamp(Math.floor(finite(value.coins, 0)), 0, 9999999) + retiredRefund), owned, placements, theme, ownedThemes };
}

export function purchaseTheme(state, id) {
  const theme = getTheme(id);
  if (!theme) return { state, changed: false, reason: 'unknown' };
  if (state.theme === id) return { state, changed: false, reason: 'selected' };
  const owned = state.ownedThemes.includes(id);
  if (!owned && state.coins < theme.price) return { state, changed: false, reason: 'coins' };
  return { state: { ...state, theme: id, coins: state.coins - (owned ? 0 : theme.price),
    ownedThemes: owned ? state.ownedThemes : [...state.ownedThemes, id] }, changed: true };
}

export function earnShopCoins(state, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return state;
  return { ...state, coins: Math.min(9999999, state.coins + amount) };
}

export function purchaseAndPlace(state, id) {
  const item = getDecoration(id);
  if (!item) return { state, changed: false, reason: 'unknown' };
  if (state.placements.some(p => p.id === id)) return { state, changed: false, reason: 'placed' };
  const owned = state.owned.includes(id);
  if (!owned && state.coins < item.price) return { state, changed: false, reason: 'coins' };
  const pos = freePosition(state.placements, id, item.x, item.y);
  if (!pos) return { state, changed: false, reason: 'space' };
  return {
    state: {
      ...state,
      coins: state.coins - (owned ? 0 : item.price),
      owned: owned ? state.owned : [...state.owned, id],
      placements: [...state.placements, { ...pos, flipped: false }]
    },
    changed: true
  };
}

export function moveDecoration(state, id, x, y) {
  const pos = decorationPosition(id, x, y);
  if (!pos || !state.placements.some(p => p.id === id)) return state;
  if (overlapsDecoration(state.placements, { id, ...pos })) return state;
  return { ...state, placements: state.placements.map(p => p.id === id ? { ...p, ...pos } : p) };
}

export function flipDecoration(state, id) {
  return { ...state, placements: state.placements.map(p => p.id === id ? { ...p, flipped: !p.flipped } : p) };
}

export function storeDecoration(state, id) {
  return { ...state, placements: state.placements.filter(p => p.id !== id) };
}
