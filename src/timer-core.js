// Later days allow less thinking time per tile; larger stacks and seals still
// get a larger total budget. Round to a readable quarter-minute (2–4 minutes).
export function campaignTimeLimit(cardCount, day, seals = 0) {
  return Math.ceil((60 + cardCount * (day <= 3 ? 3 : 2) + seals * 5) / 15) * 15000;
}

export function formatTime(milliseconds, roundUp = true) {
  const seconds = Math.max(0, (roundUp ? Math.ceil : Math.floor)((Number.isFinite(milliseconds) ? milliseconds : 0) / 1000));
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

// Monotonic foreground clock. Paused samples discard time, and explicit
// resets at lifecycle boundaries prevent a background gap being charged later.
export function createPlayClock() {
  let previous = null;
  return {
    reset(now) { previous = now; },
    sample(now, running) {
      if (!Number.isFinite(now)) return 0;
      if (previous !== null && now < previous) return 0;
      const elapsed = previous === null ? 0 : Math.max(0, now - previous);
      previous = now;
      return running ? elapsed : 0;
    }
  };
}
