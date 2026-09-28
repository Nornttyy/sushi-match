export const MIN_LOADING_MS = 3000;

export function loadingSnapshot({ startedAt, now, done, total, failed = 0, minimum = MIN_LOADING_MS }) {
  const progress = total > 0 ? Math.floor(Math.max(0, Math.min(done, total)) * 100 / total) : 0;
  const remaining = Math.max(0, minimum - Math.max(0, now - startedAt));
  return { progress, remaining, ready: total > 0 && done >= total && failed === 0 && remaining === 0 };
}

// Failed attempts are evicted; successes are reused when the player retries.
export function createTaskCache() {
  const cache = new Map();
  return (key, task) => {
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(task).catch(error => { cache.delete(key); throw error; }));
    return cache.get(key);
  };
}
