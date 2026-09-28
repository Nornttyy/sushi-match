import { getLevel, getRailTiles } from './game-core.js';
import { formatTime } from './timer-core.js';

export function outcomeSummary(state) {
  if (!['won', 'lost'].includes(state.status)) return null;
  const level = getLevel(state), won = state.status === 'won', endless = state.mode === 'endless';
  const reason = state.failureReason || 'full';
  const reasons = {
    timeout: ['时间到了', '下次先找能凑成三份的食材'],
    sealed: ['封条挡住了食材', '先用邻牌三消揭开封条'],
    obstacle: ['机关挡住了食材', '先解冻、取钥匙，或配齐前面的订单'],
    full: ['七格备料栏满了', '7 / 7 · 没有空位了']
  };
  const [failureTitle, failureLabel] = reasons[reason] || reasons.full;
  const noUndo = state.undoTokens === level.undoLimit;
  const timeStar = !Number.isFinite(level.timeLimitMs) || state.timeRemainingMs >= level.timeLimitMs * .35;
  return {
    won, reason, stars: won ? 1 + Number(noUndo) + Number(timeStar) : 0,
    title: won ? endless ? '第 ' + state.wave + ' 波完成！' : '今日寿司全送达！' : failureTitle,
    failureLabel,
    kicker: won ? noUndo ? '零撤回' : '营业完成' : '营业结束',
    orders: state.served + ' / ' + level.orders.length,
    coins: endless ? state.runCoins : state.coins,
    elapsed: formatTime(state.elapsedMs, false),
    rail: getRailTiles(state).map(t => t.ingredient),
    detail: won ? '金币已入账' : '已赚金币保留',
    primary: won ? endless ? '继续第 ' + (state.wave + 1) + ' 波'
      : '下一关' : '再试一次',
    replay: endless ? '重新挑战' : '再玩本关',
    secondary: '返回主界面'
  };
}
