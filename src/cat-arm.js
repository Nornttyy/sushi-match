// A continuous raster skin weighted to the shoulder and elbow. The old two
// closed, outlined capsules made a visible ring at the joint even when attached.
// Reuse the existing forearm/paw pixels; do not repaint the cat or merge bones.
export const ARM_BIND = Object.freeze({ left: -6, top: -4, width: 12, height: 24, elbow: 9, blendStart: 2, blendEnd: 16 });
export const ARM_CANVAS = Object.freeze({ size: 48, originX: 24, originY: 12, pixels: 192 });
const BANDS = 20;

export function skinPoint(u, v, radians) {
  const b = ARM_BIND, x = b.left + u * b.width, y = b.top + v * b.height;
  const t = Math.max(0, Math.min(1, (y - b.blendStart) / (b.blendEnd - b.blendStart)));
  const weight = t * t * (3 - 2 * t);
  const c = Math.cos(radians), s = Math.sin(radians);
  const fx = x * c - (y - b.elbow) * s;
  const fy = x * s + (y - b.elbow) * c + b.elbow;
  return { x: x + (fx - x) * weight, y: y + (fy - y) * weight };
}

export function armMesh(radians) {
  return Array.from({ length: BANDS + 1 }, (_, i) => [skinPoint(0, i / BANDS, radians), skinPoint(1, i / BANDS, radians)]);
}

// Affine UV transform for one mesh triangle, independently testable.
export function triangleTransform(source, target) {
  const [p, q, r] = source, [a, b, c] = target;
  const dx1 = q.x - p.x, dy1 = q.y - p.y, dx2 = r.x - p.x, dy2 = r.y - p.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < 1e-8) throw new Error('Degenerate arm UV triangle');
  const aa = ((b.x - a.x) * dy2 - (c.x - a.x) * dy1) / determinant;
  const cc = ((c.x - a.x) * dx1 - (b.x - a.x) * dx2) / determinant;
  const bb = ((b.y - a.y) * dy2 - (c.y - a.y) * dy1) / determinant;
  const dd = ((c.y - a.y) * dx1 - (b.y - a.y) * dx2) / determinant;
  return [aa, bb, cc, dd, a.x - aa * p.x - cc * p.y, a.y - bb * p.x - dd * p.y];
}

const textures = new Map();
const atlases = new Map();
const arms = new Set();
let frame = null;
let motionPreference = null;

function armTexture(file, crop) {
  if (!atlases.has(file)) atlases.set(file, new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = file;
  }));
  const key = file + ':' + crop.join(',');
  if (!textures.has(key)) textures.set(key, atlases.get(file).then(image => {
    const cutout = document.createElement('canvas'); cutout.width = crop[2]; cutout.height = crop[3];
    // Isolate source pixels before deforming: no neighbour sampling at any bend.
    cutout.getContext('2d').drawImage(image, ...crop, 0, 0, crop[2], crop[3]);
    return cutout;
  }));
  return textures.get(key);
}

function drawTriangle(ctx, texture, source, target) {
  const [a,b,c] = target;
  const sides = [Math.hypot(b.x-c.x,b.y-c.y), Math.hypot(a.x-c.x,a.y-c.y), Math.hypot(a.x-b.x,a.y-b.y)];
  const perimeter = sides.reduce((sum,n) => sum+n, 0);
  const cx = target.reduce((sum,p,i) => sum+p.x*sides[i],0)/perimeter;
  const cy = target.reduce((sum,p,i) => sum+p.y*sides[i],0)/perimeter;
  const radius = Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/perimeter;
  const expansion = 1 + .65 / radius;
  ctx.save(); ctx.beginPath();
  // Expand around the incenter: every edge overlaps by the same 0.65px,
  // including thin triangles. Radial centroid padding leaves AA hairline gaps.
  target.forEach((p, i) => {
    const x = cx + (p.x-cx)*expansion, y = cy + (p.y-cy)*expansion;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath(); ctx.clip(); ctx.transform(...triangleTransform(source, target));
  ctx.drawImage(texture, 0, 0); ctx.restore();
}

function paint(arm, radians) {
  const { ctx, texture } = arm, k = ARM_CANVAS.pixels / ARM_CANVAS.size;
  const rows = armMesh(radians).map(row => row.map(p => ({ x: (p.x + ARM_CANVAS.originX) * k, y: (p.y + ARM_CANVAS.originY) * k })));
  ctx.clearRect(0, 0, ARM_CANVAS.pixels, ARM_CANVAS.pixels);
  for (let i = 0; i < BANDS; i++) {
    const y = texture.height * i / BANDS, nextY = texture.height * (i + 1) / BANDS;
    const a = { x: 0, y }, b = { x: texture.width, y }, c = { x: 0, y: nextY }, d = { x: texture.width, y: nextY };
    drawTriangle(ctx, texture, [a,b,c], [rows[i][0],rows[i][1],rows[i+1][0]]);
    drawTriangle(ctx, texture, [b,d,c], [rows[i][1],rows[i+1][1],rows[i+1][0]]);
  }
  arm.canvas.dataset.ready = 'true'; arm.fallback.hidden = true;
}

function rotation(node) {
  if (!node) return 0;
  const matrix = new DOMMatrix(getComputedStyle(node).transform);
  return Math.atan2(matrix.b, matrix.a);
}

function tick(now) {
  frame = null;
  let moving = false;
  for (const arm of arms) {
    if (!arm.canvas.isConnected) { arms.delete(arm); continue; }
    const menu = arm.root.closest('.is-menu-open');
    const overlay = arm.root.closest('.result-overlay');
    if (document.hidden || menu || (overlay && !overlay.classList.contains('is-visible'))) continue;
    if (!arm.texture) continue;
    if (arm.pose !== arm.root.dataset.pose) { arm.pose = arm.root.dataset.pose; arm.until = now + 280; }
    const waving = !motionPreference.matches && ['happy','leaving'].includes(arm.pose);
    const angle = rotation(arm.elbow) + rotation(arm.wave);
    if (arm.angle === null || Math.abs(angle - arm.angle) > .0001) { paint(arm, angle); arm.angle = angle; }
    moving ||= now < arm.until || waving;
  }
  if (moving) requestArmFrame();
}

function requestArmFrame() {
  if (frame === null && typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(tick);
}

export function wakeCatArms() { requestArmFrame(); }

export function attachArmSkin({ root, shoulder, elbow, wave = null, file, crop, fallback }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'rig-arm-skin'; canvas.width = canvas.height = ARM_CANVAS.pixels;
  canvas.dataset.bones = 'shoulder elbow'; canvas.setAttribute('aria-hidden', 'true');
  shoulder.append(canvas);
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return canvas; // Keep the existing cutout visible if canvas is unavailable.
  if (!motionPreference) {
    motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    motionPreference.addEventListener('change', requestArmFrame);
    document.addEventListener('visibilitychange', requestArmFrame);
  }
  const arm = { root, canvas, ctx, elbow, wave, fallback, texture: null, angle: null, pose: null, until: 0 };
  arms.add(arm);
  armTexture(file, crop).then(texture => {
    arm.texture = texture; requestArmFrame();
  }).catch(() => { arms.delete(arm); });
  requestArmFrame();
  return canvas;
}
