import { getCampaignLevel, normalizeCampaignIndex, createGame, createEndlessGame, nextEndlessWave, getLevel, selectTile, undoRailPick, canCraftActive, craftActiveSushi, serveActiveCustomer, advanceGameTime } from '../../src/game-core.js';
import { SHOP_STORAGE_KEY, restoreShop, earnShopCoins, purchaseAndPlace, purchaseTheme, moveDecoration, flipDecoration, storeDecoration } from '../../src/shop-core.js';

const KEY = 'sushi-wechat-progress-v1';
export class Session {
  constructor(platform) {
    this.platform = platform;
    const stored = platform.get(KEY) || {};
    const integer = (value, max = 9999999) => Number.isSafeInteger(value) ? Math.max(0, Math.min(max, value)) : 0;
    this.unlocked = normalizeCampaignIndex(stored.unlocked);
    this.selected = Math.min(this.unlocked, normalizeCampaignIndex(stored.selected));
    this.bestWave = integer(stored.bestWave); this.bestOrders = integer(stored.bestOrders);
    this.muted = stored.muted === true;
    this.shop = restoreShop(platform.get(SHOP_STORAGE_KEY));
    this.scene = 'menu'; this.menuPage = 'home'; this.mode = 'campaign'; this.game = null; this.endless = null;
    this.delivery = 0; this.saved = true; this.persist();
  }
  persist() {
    const shopSaved = this.platform.set(SHOP_STORAGE_KEY, this.shop);
    const progressSaved = this.platform.set(KEY, { unlocked: this.unlocked, selected: this.selected, bestWave: this.bestWave, bestOrders: this.bestOrders, muted: this.muted });
    this.saved = shopSaved !== false && progressSaved !== false;
  }
  start(fresh = false) {
    if (this.mode === 'campaign' && this.selected > this.unlocked) return false;
    this.game = this.mode === 'endless'
      ? !fresh && this.endless?.status === 'playing' ? this.endless : createEndlessGame()
      : createGame(this.selected);
    this.scene = 'game'; this.delivery = 0; this.persist(); return true;
  }
  menu() { if (this.game?.mode === 'endless') this.endless = this.game; this.scene = 'menu'; this.menuPage = 'home'; this.delivery = 0; }
  pick(id) {
    if (this.scene !== 'game' || !this.game) return false;
    const result = selectTile(this.game, id);
    if (result.changed) { this.game = result.state; if(this.game.status==='lost')this.delivery=0; this.record(); this.platform.effect(this.game.status === 'lost' ? 'lose' : result.harvested ? 'triple' : 'pick'); }
    return result.changed;
  }
  undo() {
    if (this.scene !== 'game' || !this.game) return;
    const result = undoRailPick(this.game); this.game = result.state;
    if (result.changed) this.platform.effect('pick');
  }
  // Only foreground frames advance delivery. There are no orphaned timers.
  elapse(milliseconds) {
    if (this.scene !== 'game' || !this.game || this.delivery) return false;
    const result = advanceGameTime(this.game, milliseconds); this.game = result.state;
    if (result.expired) { this.record(); this.platform.effect('lose'); }
    return result.expired;
  }
  tick(milliseconds, allowCraft = true) {
    if (this.scene !== 'game' || this.game?.status !== 'playing') return;
    if (allowCraft && !this.game.workbench.crafted && canCraftActive(this.game)) {
      this.game = craftActiveSushi(this.game).state; this.delivery = 0;
    }
    if (!this.game.workbench.crafted) return;
    this.delivery += Math.min(50, Math.max(0, milliseconds));
    if (this.delivery < 760) return;
    const result = serveActiveCustomer(this.game);
    this.game = result.state; this.delivery = 0;
    if (result.changed) { this.shop = earnShopCoins(this.shop, result.reward); this.platform.effect(this.game.status === 'won' ? 'win' : this.game.status==='lost'?'lose':'serve'); this.record(); }
  }
  record() {
    if (this.game?.mode === 'endless') {
      this.endless = this.game;
      this.bestOrders = Math.max(this.bestOrders, this.game.runServed);
      this.bestWave = Math.max(this.bestWave, this.game.wave - (this.game.status === 'won' ? 0 : 1));
    } else if (this.game?.status === 'won') this.unlocked = Math.max(this.unlocked, this.game.levelIndex + 1);
    this.persist();
  }
  advance() {
    if (!this.game || this.game.status === 'playing') return;
    if (this.game.status === 'lost') { this.start(true); return; }
    if (this.game.mode === 'endless') this.game = nextEndlessWave(this.game).state;
    else { this.selected = this.game.levelIndex + 1; this.game = createGame(this.selected); }
    this.delivery = 0; this.persist();
  }
  replay() {
    if (!this.game || this.game.status !== 'won') return;
    this.mode = this.game.mode; this.selected = this.game.levelIndex; this.start(true);
  }
  buy(id) { const r = purchaseAndPlace(this.shop, id); this.shop = r.state; this.persist(); return r; }
  theme(id) { const r = purchaseTheme(this.shop, id); this.shop = r.state; this.persist(); return r; }
  move(id, x, y) { this.shop = moveDecoration(this.shop, id, x, y); this.persist(); }
  flip(id) { this.shop = flipDecoration(this.shop, id); this.persist(); }
  store(id) { this.shop = storeDecoration(this.shop, id); this.persist(); }
  toggleSound() { this.muted = !this.muted; this.platform.sound(!this.muted); this.persist(); }
  get level() { return this.game ? getLevel(this.game) : getCampaignLevel(this.selected); }
}
