import { getLevel } from './game-core.js';
import { createCatPortrait, setCatState } from './cat-portrait.js';
import { outcomeSummary } from './outcome-core.js';
import { EFFECT_TIME } from './play-effects.js';
export { outcomeSummary } from './outcome-core.js';

export function mountFeedback({ overlay, gameShell, ingredientIcon }) {
  let key = '';
  let timer = null;
  let frame = null;
  let token = 0;
  let menuVisible = true;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const art = overlay.querySelector('#result-art');
  const stats = overlay.querySelector('#result-stats');
  const confetti = overlay.querySelector('#result-confetti');
  const primary = overlay.querySelector('#overlay-button');
  overlay.inert = true;

  function hide() {
    token++;
    clearTimeout(timer); cancelAnimationFrame(frame);
    overlay.classList.remove('is-visible'); overlay.setAttribute('aria-hidden', 'true'); overlay.inert = true;
    gameShell.classList.remove('is-failure-bump', 'is-winning');
    for (const el of gameShell.children) if (el !== overlay && el.id !== 'main-menu' && el.id !== 'credits-dialog') el.inert = menuVisible;
    key = '';
  }

  return {
    render(state, menuOpen) {
      menuVisible = menuOpen;
      const summary = outcomeSummary(state);
      if (!summary || menuOpen) { hide(); return; }
      const nextKey = [state.mode, getLevel(state).id, state.runSeed, state.status, state.coins].join(':');
      if (nextKey === key) return;
      hide(); key = nextKey;
      const epoch = token;
      overlay.dataset.outcome = summary.won ? 'won' : 'lost';
      overlay.dataset.reason = summary.won ? '' : summary.reason;
      overlay.querySelector('#overlay-title').textContent = summary.title;
      overlay.querySelector('#result-kicker').textContent = summary.kicker;
      overlay.querySelector('#overlay-text').textContent = summary.detail;
      primary.textContent = summary.primary;
      overlay.querySelector('#overlay-menu-button').textContent = summary.secondary;
      const replay = overlay.querySelector('#overlay-replay-button');
      replay.hidden = !summary.won; replay.textContent = summary.replay;
      const stars = overlay.querySelector('#result-stars'); stars.replaceChildren(); stars.hidden = !summary.won;
      if (summary.won) {
        stars.setAttribute('aria-label', summary.stars + ' / 3 星：通关一星，未撤回一星，剩余至少 35% 时间一星');
        for (let i = 0; i < 3; i++) {
          const star = document.createElement('span'); star.className = 'result-star' + (i < summary.stars ? ' is-earned' : '');
          star.style.setProperty('--star-delay', (180 + i * 220) + 'ms'); star.setAttribute('aria-hidden', 'true'); stars.append(star);
        }
      }
      art.replaceChildren(); stats.replaceChildren(); confetti.replaceChildren();
      if (summary.won) {
        const guests = document.createElement('span'); guests.className = 'result-guests';
        ['ginger', 'calico', 'gray'].forEach(skin => { const cat = createCatPortrait(skin); setCatState(cat, 'happy'); guests.append(cat); });
        const platter = document.createElement('img');
        platter.src = './assets/victory-platter-v1.png'; platter.alt = '';
        art.append(guests, platter);
        for (let i = 0; i < 22; i++) {
          const piece = document.createElement('i');
          piece.style.setProperty('--x', (i * 43 % 100) + '%');
          piece.style.setProperty('--delay', (i % 7 * 70) + 'ms');
          piece.style.setProperty('--turn', (i % 2 ? 260 : -240) + 'deg');
          piece.style.setProperty('--color', ['#de9c43', '#db775d', '#76977f', '#e7c582'][i % 4]);
          confetti.append(piece);
        }
        gameShell.classList.add('is-winning');
      } else {
        const tray = document.createElement('div');
        if (summary.reason === 'timeout') {
          tray.className = 'result-timeout-clock';
          const clock = document.createElement('span'); clock.className = 'clock-face';
          const zero = document.createElement('b'); zero.textContent = '0:00'; tray.append(clock, zero);
        } else {
          tray.className = 'result-full-tray';
          summary.rail.forEach((kind, i) => {
            const slot = document.createElement('span'); slot.className = 'result-stuck-tile';
            slot.style.setProperty('--i', i); slot.append(ingredientIcon(kind)); tray.append(slot);
          });
        }
        const full = document.createElement('b'); full.className = 'result-full-label'; full.textContent = summary.failureLabel;
        art.append(tray, full);
        if (summary.reason === 'full') gameShell.classList.add('is-failure-bump');
      }
      let coinValue;
      for (const [label, value] of [['完成订单', summary.orders], ['操作用时', summary.elapsed], ['营业收入', '+' + summary.coins]]) {
        const item = document.createElement('span');
        const number = document.createElement('b'); number.textContent = value;
        const caption = document.createElement('small'); caption.textContent = label;
        item.append(number, caption); stats.append(item);
        if (label === '营业收入') coinValue = number;
      }
      timer = setTimeout(() => {
        if (epoch !== token) return;
        overlay.classList.add('is-visible'); overlay.setAttribute('aria-hidden', 'false'); overlay.inert = false;
        for (const el of gameShell.children) if (el !== overlay && el.id !== 'main-menu' && el.id !== 'credits-dialog') el.inert = true;
        primary.focus({ preventScroll: true });
        const started = performance.now();
        function count(now) {
          if (epoch !== token) return;
          const progress = reducedMotion.matches ? 1 : Math.min(1, (now - started) / 680);
          coinValue.textContent = '+' + Math.round(summary.coins * (1 - (1 - progress) ** 3));
          if (progress < 1) frame = requestAnimationFrame(count);
        }
        frame = requestAnimationFrame(count);
      }, reducedMotion.matches ? 0 : summary.won ? EFFECT_TIME.reward+80 : 620);
    }
  };
}
