import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DECORATIONS, DECOR_ZONES, createShop, restoreShop, earnShopCoins,
  purchaseAndPlace, moveDecoration, flipDecoration, storeDecoration, getDecoration,
  SHOP_THEMES, purchaseTheme, decorationBounds, overlapsDecoration, DECOR_FILTERS, getDecorCatalog, getShopRoomFrame
} from '../src/shop-core.js';

test('a new shop starts with no money and a free plant, without changing puzzle progress', () => {
  assert.deepEqual(createShop(), { version: 2, coins: 0, owned: ['bonsai'], placements: [], theme: 'cream', ownedThemes: ['cream'] });
  assert.equal(DECORATIONS.length, 14);
  assert.equal(getDecoration('lamp'), undefined);
});

test('completed-order income is accumulated, invalid rewards cannot alter the wallet', () => {
  const start = createShop();
  const shop = earnShopCoins(earnShopCoins(start, 18), 22);
  assert.equal(shop.coins, 40);
  assert.equal(start.coins, 0);
  for (const invalid of [-4, 0, 1.5, NaN, Infinity, '90']) assert.equal(earnShopCoins(shop, invalid), shop);
});

test('a purchase requires sufficient balance and cannot charge twice for the same object', () => {
  let shop = createShop();
  assert.equal(purchaseAndPlace(shop, 'picture').reason, 'coins');
  assert.equal(purchaseAndPlace(shop, 'unknown').reason, 'unknown');
  const price = getDecoration('picture').price;
  shop = earnShopCoins(shop, price + 5);
  const bought = purchaseAndPlace(shop, 'picture');
  assert.equal(bought.changed, true);
  assert.equal(bought.state.coins, 5);
  assert.equal(shop.coins, price + 5);
  const duplicate = purchaseAndPlace(bought.state, 'picture');
  assert.equal(duplicate.reason, 'placed');
  assert.equal(duplicate.state.coins, 5);
  assert.equal(duplicate.state.placements.length, 1);
});

test('stored decorations remain owned and can be placed again for free', () => {
  let shop = purchaseAndPlace(earnShopCoins(createShop(), getDecoration('rug').price), 'rug').state;
  shop = storeDecoration(shop, 'rug');
  assert.equal(shop.coins, 0);
  assert.ok(shop.owned.includes('rug'));
  assert.equal(shop.placements.length, 0);
  assert.equal(purchaseAndPlace(shop, 'rug').state.placements.length, 1);
});

test('each movable decoration remains inside its surface and finite after bad coordinates', () => {
  for (const item of DECORATIONS) {
    const bought = purchaseAndPlace(earnShopCoins(createShop(), 10000), item.id);
    assert.equal(bought.changed, true, item.id);
    let shop = bought.state;
    shop = moveDecoration(shop, item.id, -10000, 10000);
    const p = shop.placements.find(p => p.id === item.id);
    const zone = DECOR_ZONES[item.zone];
    assert.ok(p.x >= zone.minX && p.x <= zone.maxX);
    assert.ok(p.y >= zone.minY && p.y <= zone.maxY);
    const box = decorationBounds(p);
    assert.ok(box.left >= zone.minX - .001 && box.right <= zone.maxX + .001, item.id);
    assert.ok(box.top >= zone.minY - .001 && box.bottom <= zone.maxY + .001, item.id);
    shop = moveDecoration(shop, item.id, NaN, Infinity);
    assert.ok(Number.isFinite(shop.placements.find(p => p.id === item.id).x));
  }
});

test('positions, ownership, flipped state and balance survive serialization', () => {
  let shop = purchaseAndPlace(earnShopCoins(createShop(), getDecoration('board').price + 45), 'board').state;
  shop = moveDecoration(shop, 'board', 65, 67);
  shop = flipDecoration(shop, 'board');
  const restored = restoreShop(JSON.parse(JSON.stringify(shop)));
  assert.deepEqual(restored, shop);
  assert.equal(restored.coins, 45);
  assert.equal(restored.placements[0].flipped, true);
});

test('malformed saved data does not create unknown or duplicate decorations', () => {
  assert.deepEqual(restoreShop(null), createShop());
  assert.deepEqual(restoreShop({ version: 99 }), createShop());
  const restored = restoreShop({ version: 1, coins: -7, owned: ['picture', 'picture', 'unknown'], placements: [
    null, { id: 'picture', x: -999, y: 'bad' }, { id: 'picture' }, { id: 'board' }, { id: 'unknown' }
  ] });
  assert.equal(restored.coins, 0);
  assert.deepEqual(restored.owned, ['bonsai', 'picture']);
  assert.equal(restored.placements.length, 1);
  assert.ok(Number.isFinite(restored.placements[0].y));
});

test('themes cost coins once, preserve furniture, and survive reload', () => {
  let shop = purchaseAndPlace(earnShopCoins(createShop(), 5000), 'bonsai').state;
  const positions = shop.placements;
  shop = purchaseTheme(shop, 'garden').state;
  assert.equal(shop.coins, 3600);
  assert.deepEqual(shop.placements, positions);
  shop = purchaseTheme(shop, 'cream').state;
  shop = purchaseTheme(shop, 'garden').state;
  assert.equal(shop.coins, 3600);
  assert.deepEqual(restoreShop(JSON.parse(JSON.stringify(shop))), shop);
  assert.equal(purchaseTheme(createShop(), 'night').reason, 'coins');
  assert.equal(SHOP_THEMES.length, 3);
});

test('legacy ownership and wallet are migrated without charging raised prices', () => {
  const shop = restoreShop({ version: 1, coins: 87, owned: ['board', 'picture'], placements: [{ id: 'board', x: 74, y: 69 }] });
  assert.equal(shop.version, 2);
  assert.equal(shop.coins, 87);
  assert.ok(shop.owned.includes('board') && shop.owned.includes('picture'));
  assert.equal(purchaseAndPlace(shop, 'picture').state.coins, 87);
});

test('retired paper lantern is removed and refunded once without disturbing other progress', () => {
  for (const version of [1, 2]) {
    const stored = { version, coins: 87, owned: ['lamp', 'lamp', 'picture'],
      placements: [{ id: 'lamp', x: 74, y: 27 }, { id: 'picture', x: 51, y: 25.5 }],
      theme: 'garden', ownedThemes: ['cream', 'garden'] };
    const shop = restoreShop(stored);
    assert.equal(shop.coins, 307);
    assert.deepEqual(shop.owned, ['bonsai', 'picture']);
    assert.equal(shop.placements.length, 1);
    assert.equal(shop.placements[0].id, 'picture');
    assert.equal(shop.theme, 'garden');
    assert.deepEqual(restoreShop(JSON.parse(JSON.stringify(shop))), shop);
    assert.equal(purchaseAndPlace(shop, 'lamp').reason, 'unknown');
    assert.deepEqual(stored.owned, ['lamp', 'lamp', 'picture']);
  }
  assert.equal(restoreShop({ version: 2, coins: 9999999, owned: ['lamp'] }).coins, 9999999);
  assert.equal(restoreShop({ version: 2, coins: 50, owned: [], placements: [{ id: 'lamp' }] }).coins, 50);
});

test('all five legacy sprites can still coexist fully on their mounting surfaces', () => {
  let shop = earnShopCoins(createShop(), 10000);
  for (const item of DECORATIONS.slice(0,5)) {
    const result = purchaseAndPlace(shop, item.id);
    assert.equal(result.changed, true, item.id + ' can be placed');
    shop = result.state;
  }
  for (const p of shop.placements) {
    const box = decorationBounds(p), zone = DECOR_ZONES[getDecoration(p.id).zone];
    assert.ok(box.left >= zone.minX - .001 && box.right <= zone.maxX + .001);
    assert.ok(box.top >= zone.minY - .001 && box.bottom <= zone.maxY + .001);
    assert.equal(overlapsDecoration(shop.placements, p), false, p.id + ' does not cross other furniture');
  }
});

test('four catalogs expose all fourteen decorations without losing any in a category', () => {
  assert.deepEqual(DECOR_FILTERS.map(item=>item.id), ['all','counter','wall','floor']);
  assert.equal(getDecorCatalog().length, 14);
  assert.equal(getDecorCatalog('counter').length, 4);
  assert.equal(getDecorCatalog('wall').length, 4);
  assert.equal(getDecorCatalog('floor').length, 6);
  const ids = ['counter','wall','floor'].flatMap(zone=>getDecorCatalog(zone).map(item=>item.id));
  assert.equal(new Set(ids).size, 14);
  assert.deepEqual(getDecorCatalog('unknown'), []);
});

test('every new decoration can be bought, flipped, stored and restored without repeat charges', () => {
  let shop = earnShopCoins(createShop(), 10000);
  let spent = 0;
  for (const item of DECORATIONS.slice(5)) {
    assert.ok(item.price >= 360 && item.price <= 1180);
    let result = purchaseAndPlace(shop, item.id);
    assert.equal(result.changed, true, item.id);
    spent += item.price;
    shop = flipDecoration(result.state, item.id);
    assert.deepEqual(restoreShop(JSON.parse(JSON.stringify(shop))), shop);
    assert.equal(shop.placements.at(-1).flipped, true);
    shop = storeDecoration(shop, item.id);
    result = purchaseAndPlace(shop, item.id);
    assert.equal(result.changed, true);
    assert.equal(result.state.coins, 10000-spent);
    shop = storeDecoration(result.state, item.id);
  }
  assert.equal(shop.owned.length, 10);
  assert.deepEqual(restoreShop(JSON.parse(JSON.stringify(shop))), shop);
});

test('a crowded shop does not charge for furniture that cannot fit', () => {
  let shop = earnShopCoins(createShop(), 20000), blocked=0;
  for(const item of DECORATIONS){
    const result = purchaseAndPlace(shop, item.id);
    if(result.reason==='space'){
      blocked++;
      assert.equal(result.state, shop);
      assert.ok(!shop.owned.includes(item.id));
    } else { assert.equal(result.changed,true);shop=result.state; }
  }
  assert.ok(blocked>0);
  for(const p of shop.placements)assert.equal(overlapsDecoration(shop.placements,p),false,p.id);
});

test('short-screen editing keeps wall and floor surfaces clear of both toolbars',()=>{
  for(const [w,h,toolbar] of [[320,568,405],[390,844,672],[500,900,728],[390,692,508]]){
    const r=getShopRoomFrame(w,h,toolbar);
    assert.ok(Math.abs(r.w/r.h-4/7)<1e-9);
    assert.ok(r.y+r.h*.11>=52-.001,'wall stays below wallet');
    assert.ok(r.y+r.h*.79<=toolbar-8+.001,'floor stays above catalog');
  }
  assert.deepEqual(getShopRoomFrame(320,560),{x:0,y:0,w:320,h:560});
});
