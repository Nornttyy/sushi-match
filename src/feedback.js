import { LEVELS, getLevel, getRailTiles } from './game-core.js';
import { createCatPortrait, setCatState } from './cat-portrait.js';

export function outcomeSummary(state) {
  if (!['won', 'lost'].includes(state.status)) return null;
  const level = getLevel(state);
  const won = state.status === 'won';
  const endless = state.mode === 'endless';
  const rail = getRailTiles(state);
  const sealed = state.failureReason === 'sealed';
  return {
    won,
    title: endless ? won ? '第 ' + state.wave + ' 波完成！' : '无尽挑战结束' : won ? '今日寿司全送达！' : sealed ? '封条挡住了食材' : '七格备料栏满了',
    failureLabel: sealed ? '先用邻牌三消揭开封条' : '7 / 7 · 没有空位了',
    kicker: won ? state.undoTokens === level.undoLimit ? '零撤回' : '营业完成' : '营业结束',
    orders: state.served + ' / ' + level.orders.length,
    coins: endless ? state.runCoins : state.coins,
    rail: rail.map(t => t.ingredient),
    detail: won ? '金币已入账' : '已赚金币保留',
    primary: endless ? won ? '继续第 ' + (state.wave + 1) + ' 波' : '再开一局'
      : won ? state.levelIndex < LEVELS.length - 1 ? '下一天' : '挑战无尽模式' : '重新开始',
    secondary: won ? '回店布置' : '返回小店'
  };
}

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
      overlay.querySelector('#overlay-title').textContent = summary.title;
      overlay.querySelector('#result-kicker').textContent = summary.kicker;
      overlay.querySelector('#overlay-text').textContent = summary.detail;
      primary.textContent = summary.primary;
      overlay.querySelector('#overlay-menu-button').textContent = summary.secondary;
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
        const tray = document.createElement('div'); tray.className = 'result-full-tray';
        summary.rail.forEach((kind, i) => {
          const slot = document.createElement('span'); slot.className = 'result-stuck-tile';
          slot.style.setProperty('--i', i); slot.append(ingredientIcon(kind)); tray.append(slot);
        });
        const full = document.createElement('b'); full.className = 'result-full-label'; full.textContent = summary.failureLabel;
        art.append(tray, full);
        gameShell.classList.add('is-failure-bump');
      }
      let coinValue;
      for (const [label, value] of [['完成订单', summary.orders], ['金币已入账', '+' + summary.coins]]) {
        const item = document.createElement('span');
        const number = document.createElement('b'); number.textContent = value;
        const caption = document.createElement('small'); caption.textContent = label;
        item.append(number, caption); stats.append(item);
        if (label === '金币已入账') coinValue = number;
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
      }, reducedMotion.matches ? 0 : summary.won ? 160 : 620);
    }
  };
}
