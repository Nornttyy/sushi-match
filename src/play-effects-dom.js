import { PlayEffects, drawPlayEffects, COIN_ART } from './play-effects.js';
import { OBSTACLE_ASSETS } from './obstacle-assets.js';

// One small, input-transparent Canvas for both generated sprite fragments and
// vector particles. No persistent RAF when nothing is moving.
export function mountPlayEffects() {
  const canvas = document.createElement('canvas');
  canvas.className = 'play-effects'; canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d'), pool = new PlayEffects(), images = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frameId = null, previous = 0, ratio = 1;
  for (const file of [COIN_ART.file, ...Object.values(OBSTACLE_ASSETS).map(art => art.file)]) {
    const image = new Image(); image.onload = () => images.set(file, image); image.src = './assets/' + file;
  }
  function clear() {
    cancelAnimationFrame(frameId); frameId = null; pool.clear();
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    canvas.dataset.effects = '';
  }
  function resize() {
    clear(); ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function frame(now) {
    frameId = null;
    if (document.hidden || reduced.matches) { clear(); return; }
    // Match CSS/WAAPI wall time even after a dropped frame, so coins never
    // linger over a result panel on a slower phone.
    pool.step(Math.max(0, now - previous)); previous = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight); drawPlayEffects(ctx, pool, images);
    canvas.dataset.effects = pool.items.map(item => item.kind).join(' ');
    if (pool.items.length) frameId = requestAnimationFrame(frame);
  }
  function add(kind, at, options) {
    if (reduced.matches || document.hidden) return;
    pool.add(kind, at, options);
    if (frameId === null) { previous = performance.now(); frameId = requestAnimationFrame(frame); }
  }
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  reduced.addEventListener('change', () => { if (reduced.matches) clear(); });
  resize();
  return { add, clear };
}
