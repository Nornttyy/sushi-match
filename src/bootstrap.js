import { MIN_LOADING_MS, loadingSnapshot, createTaskCache } from './loading-core.js';
import { GAME_IMAGES } from './asset-manifest.js';
import { MOTION, jellyFrames } from './motion-core.js';

const screen = document.querySelector('#loading-screen');
const shell = document.querySelector('.game-shell');
const bar = document.querySelector('#loading-progress');
const percent = document.querySelector('#loading-percent');
const status = document.querySelector('#loading-status');
const retry = document.querySelector('#loading-retry');
const treat = document.querySelector('#loading-sushi');
const cached = createTaskCache();
let running = false;
let appFailed = false;
let animation;

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => finish(new Error('Image timeout: ' + path)), 15000);
    const finish = error => {
      clearTimeout(timeout); image.onload = null; image.onerror = null;
      error ? reject(error) : resolve(image);
    };
    image.onload = () => image.decode ? image.decode().then(() => finish(), finish) : finish();
    image.onerror = () => finish(new Error('Image failed: ' + path));
    image.src = './assets/' + path;
  });
}

function loadApplication() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { appFailed = true; reject(new Error('Application timeout')); }, 15000);
    import('./main.js').then(value => { clearTimeout(timeout); resolve(value); }, error => { clearTimeout(timeout); appFailed = true; reject(error); });
  });
}

async function start() {
  if (running) return;
  if (appFailed) { location.reload(); return; }
  running = true; retry.hidden = true; screen.dataset.state = 'loading';
  shell.inert = true;
  // Start the minimum AFTER a painted loading frame, including cached visits.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const startedAt = performance.now();
  const tasks = GAME_IMAGES.map(path => [path, () => loadImage(path)]);
  tasks.push(['application', loadApplication]);
  let done = 0, failed = 0, settled = 0;
  const update = () => {
    const snapshot = loadingSnapshot({ startedAt, now: performance.now(), done, total: tasks.length, failed, minimum: MIN_LOADING_MS });
    bar.value = snapshot.progress; percent.textContent = snapshot.progress + '%';
    status.textContent = failed ? '没连上，再试一次' : done === tasks.length ? '马上开店' : '开店准备';
    if (snapshot.ready) {
      running = false; screen.hidden = true; shell.inert = false;
      document.querySelector('#menu-start-button')?.focus({ preventScroll: true });
      return;
    }
    if (settled === tasks.length && failed) {
      running = false; screen.dataset.state = 'error'; retry.hidden = false;
      return;
    }
    requestAnimationFrame(update);
  };
  for (const [key, task] of tasks) cached(key, task).then(() => { done++; }, () => { failed++; }).finally(() => { settled++; });
  update();
}

treat.addEventListener('click', () => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  animation?.cancel();
  animation = treat.animate(jellyFrames(1.35), { duration: MOTION.bounce, easing: 'linear' });
});
retry.addEventListener('click', start);
void start();
