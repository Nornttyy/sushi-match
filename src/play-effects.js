import { OBSTACLE_ASSETS } from './obstacle-assets.js';
import { obstacleArt } from './obstacle-art.js';
import { isObstacleLocked } from './obstacles.js';

export const EFFECT_TIME = Object.freeze({ burst: 440, obstacle: 440, coin: 540, coinGap: 70, reward: 680 });
export const COIN_ART = Object.freeze({ file: 'effects/coin-v1.png' });
const clamp = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;

// Cosmetic only: no callbacks, rewards, timer changes or access to game state.
// A bounded pool also bounds Canvas work during very fast repeated taps.
export class PlayEffects {
  constructor() { this.items = []; this.serial = 0; }
  add(kind, at, options = {}) {
    if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
    const duration = kind === 'reward' ? EFFECT_TIME.reward : kind === 'obstacle' ? EFFECT_TIME.obstacle : EFFECT_TIME.burst;
    this.items.push({ ...options, kind, at: { ...at }, age: -(options.delay || 0), duration, id: ++this.serial });
    if (this.items.length > 16) this.items.shift();
  }
  step(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
    for (const item of this.items) item.age += milliseconds;
    this.items = this.items.filter(item => item.age < item.duration);
  }
  clear() { this.items.length = 0; }
  has(kind) { return this.items.some(item => item.kind === kind); }
}

export function coinPose(progress, from, to, index = 0) {
  const t = clamp(progress), travel = clamp((t - .16) / .84), ease = travel * travel * (3 - 2 * travel);
  if (t === 1) return { x: to.x, y: to.y, size: 15, opacity: 0, rotate: 0 };
  const spread = Math.sin(Math.min(1, t / .2) * Math.PI / 2) * (1 - ease);
  return { x: mix(from.x, to.x, ease) + (index - 1) * 15 * spread,
    y: mix(from.y, to.y, ease) - Math.sin(t * Math.PI) * (24 + index * 8),
    size: mix(25, 15, ease), opacity: Math.min(1, t * 14) * (1 - clamp((t - .88) / .12)),
    rotate: (index - 1) * .24 * (1 - ease) };
}

export function obstacleTransitions(previous, next) {
  const beforeById = new Map(previous.tiles.map(tile => [tile.id, tile])), changes = [];
  for (const tile of next.tiles) {
    const before = beforeById.get(tile.id);
    if (!before) continue;
    const locked = isObstacleLocked(before, previous.served);
    const opened = locked && !isObstacleLocked(tile, next.served);
    const chipped = locked && before.obstacle.kind === 'ice' && tile.obstacle?.remaining < before.obstacle.remaining;
    const usedKey = before.key && !before.keyUsed && tile.keyUsed;
    if ((tile.active && (opened || chipped)) || usedKey) {
      const part = obstacleArt(before, previous.served).find(part => part.type === 'sprite' && (!usedKey || part.asset === 'key'));
      if (part) changes.push({ id: tile.id, asset: part.asset, part, partial: chipped && !opened });
    }
  }
  return changes;
}

function star(ctx, x, y, size, color) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? size * .32 : size;
    i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function drawBurst(ctx, item) {
  const t = clamp(item.age / item.duration), radius = 6 + 26 * (1 - (1 - t) ** 3), craft = item.kind === 'craft';
  ctx.globalAlpha = (1 - t) ** 1.5;
  ctx.strokeStyle = '#fff3ce'; ctx.lineWidth = 3 * (1 - t);
  ctx.beginPath(); ctx.ellipse(item.at.x, item.at.y + 3, radius, radius * .4, 0, 0, Math.PI * 2); ctx.stroke();
  const colors = craft ? ['#fff5ce', '#f3bf68', '#ffdc9f'] : ['#fff5df', '#f4c57e', '#dca37a'];
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7 - .4, distance = radius * (.7 + i % 3 * .2);
    const x = item.at.x + Math.cos(angle) * distance, y = item.at.y + Math.sin(angle) * distance * .7 - 8 * t;
    const size = (i % 3 === 0 ? 5 : 3) * (1 - t * .65);
    if (i % 3 === 0) star(ctx, x, y, size, colors[i % 3]);
    else { ctx.beginPath(); ctx.ellipse(x, y, size, size * .6, angle, 0, Math.PI * 2); ctx.fillStyle = colors[i % 3]; ctx.fill(); }
  }
}

function drawObstacle(ctx, item, images) {
  const art = OBSTACLE_ASSETS[item.asset], image = images.get(art.file);
  if (!image) return;
  const t = clamp(item.age / item.duration), ease = 1 - (1 - t) ** 2, [sx, sy, sw, sh] = art.crop;
  const ice = item.asset.startsWith('ice'), frame = ice || item.asset === 'crate';
  const columns = frame ? 2 : 1, rows = ice ? 2 : 1;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    if (item.partial && row === col) continue;
    const sign = col ? 1 : -1, w = item.at.w / columns, h = item.at.h / rows;
    const dx = frame ? sign * (ice ? 17 : 23) * ease : 8 * ease;
    const dy = frame ? (row ? 10 : -13) * ease + 12 * t * t : -27 * ease + 10 * t * t;
    ctx.save(); ctx.globalAlpha = (1 - t) ** 1.3 * (item.partial ? .65 : 1);
    ctx.translate(item.at.x - item.at.w / 2 + (col + .5) * w + dx, item.at.y - item.at.h / 2 + (row + .5) * h + dy);
    ctx.rotate((frame ? sign : 1) * ease * .35);
    ctx.drawImage(image, sx + col * sw / columns, sy + row * sh / rows, sw / columns, sh / rows, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

export function drawPlayEffects(ctx, pool, images) {
  for (const item of pool.items) {
    if (item.age < 0) continue;
    ctx.save();
    if (item.kind === 'reward') {
      const image = images.get(COIN_ART.file);
      if (image && item.to) for (let i = 0; i < 3; i++) {
        const age = item.age - i * EFFECT_TIME.coinGap;
        if (age < 0 || age > EFFECT_TIME.coin) continue;
        const p = coinPose(age / EFFECT_TIME.coin, item.at, item.to, i);
        ctx.save(); ctx.globalAlpha = p.opacity; ctx.translate(p.x, p.y); ctx.rotate(p.rotate);
        ctx.drawImage(image, -p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
      }
      const impact = (item.age - EFFECT_TIME.coin + 60) / 160;
      if (item.to && impact >= 0 && impact < 1) {
        ctx.globalAlpha = (1 - impact) * .7; ctx.strokeStyle = '#fff0b4'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(item.to.x, item.to.y, 9 + impact * 9, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (item.kind === 'obstacle') drawObstacle(ctx, item, images);
    else drawBurst(ctx, item);
    ctx.restore();
  }
}
