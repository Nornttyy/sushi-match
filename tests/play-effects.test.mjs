import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayEffects, EFFECT_TIME, COIN_ART, coinPose, drawPlayEffects, obstacleTransitions } from '../src/play-effects.js';
import { MOTION, MERGE_IMPACT, jellyPose, mergePose } from '../src/motion-core.js';
import { OBSTACLE_ASSETS } from '../src/obstacle-assets.js';
import { GAME_IMAGES } from '../src/asset-manifest.js';
import { createGame, getVisibleTiles, getLevel } from '../src/game-core.js';
import { CanvasApp } from '../wechat/src/canvas-app.js';

test('the generated reward coin is a bundled transparent production sprite', () => {
  const png = readFileSync(new URL('../assets/' + COIN_ART.file, import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png[25], 6);
  assert.equal(png.readUInt32BE(16), 1254);
  assert.ok(png.length > 100000);
  assert.ok(GAME_IMAGES.includes(COIN_ART.file));
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /effects\/coin-v1\.png/);
});

test('three tiles collide in the rail and only one ingredient continues to the plate', () => {
  const from = { x: 60, y: 240, w: 64, h: 70 }, gather = { x: 95, y: 790, w: 34, h: 34 }, to = { x: 195, y: 705, w: 34, h: 34 };
  assert.deepEqual(mergePose(0, from, gather, to), { ...from, rotate: 0, opacity: 1, card: 1 });
  for (const leader of [false, true]) {
    const impact = mergePose(MERGE_IMPACT, from, gather, to, leader);
    assert.equal(impact.x, gather.x); assert.equal(impact.y, gather.y);
    for (let i = 0; i <= 100; i++) {
      const p = mergePose(i / 100, from, gather, to, leader);
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(p.w > 0 && p.h > 0 && p.opacity >= 0 && p.opacity <= 1);
    }
  }
  assert.equal(mergePose(.8, from, gather, to, false).opacity, 0);
  assert.equal(mergePose(.8, from, gather, to, true).card, 0);
  assert.equal(mergePose(1, from, gather, to, true).y, to.y);
  assert.equal(mergePose(1, from, gather, to, true).opacity, 0);
  assert.ok(MOTION.merge <= 350);
});

test('a bounce has one soft overshoot instead of alternating oscillations', () => {
  let previous = jellyPose(0).sy;
  for (let i = 1; i <= 1000; i++) {
    const pose = jellyPose(i / 1000);
    if (i <= 320) assert.ok(pose.sy >= previous - 1e-9);
    else assert.ok(pose.sy <= previous + 1e-9);
    assert.equal(pose.rotate, 0);
    assert.ok(Math.abs(pose.y) <= 3);
    previous = pose.sy;
  }
});

test('coins start and end at supplied UI anchors, with bounded fan-out and no infinite animation', () => {
  const from = { x: 90, y: 145 }, to = { x: 300, y: 28 };
  for (let index = 0; index < 3; index++) {
    assert.equal(coinPose(0, from, to, index).opacity, 0);
    const end = coinPose(1, from, to, index);
    assert.equal(end.x, to.x); assert.equal(end.y, to.y); assert.equal(end.opacity, 0);
    for (let i = 0; i <= 100; i++) assert.ok(Object.values(coinPose(i / 100, from, to, index)).every(Number.isFinite));
  }
  assert.equal(EFFECT_TIME.reward, EFFECT_TIME.coin + EFFECT_TIME.coinGap * 2);
});

test('cosmetic pool is bounded, honors delays, clears and never runs money callbacks', () => {
  const pool = new PlayEffects(), point = { x: 80, y: 90 };
  let paid = 0;
  pool.add('merge', point, { delay: 170 }); point.x = 0;
  assert.equal(pool.items[0].at.x, 80);
  pool.step(100); assert.ok(pool.items[0].age < 0);
  pool.step(NaN); assert.equal(pool.items[0].age, -70);
  for (let i = 0; i < 40; i++) pool.add('reward', point, { to: { x: 190, y: 20 }, onComplete: () => paid++ });
  assert.equal(pool.items.length, 16);
  pool.step(1000); assert.equal(pool.items.length, 0); assert.equal(paid, 0);
  pool.add('craft', point); pool.clear(); assert.equal(pool.items.length, 0);
});

test('real obstacle transitions produce sprite fragments, not repeated effects every render', () => {
  const previous = { served: 0, tiles: [
    { id: 'ice', active: true, obstacle: { kind: 'ice', remaining: 2 } },
    { id: 'lock', active: true, obstacle: { kind: 'lock', key: 1, open: false } },
    { id: 'key', active: true, key: 1 },
    { id: 'crate', active: true, obstacle: { kind: 'crate', orders: 1 } }
  ] };
  const next = structuredClone(previous);
  next.tiles[0].obstacle.remaining = 1; next.tiles[1].obstacle.open = true;
  next.tiles[2].keyUsed = true; next.tiles[2].active = false; next.served = 1;
  const changes = obstacleTransitions(previous, next);
  assert.deepEqual(changes.map(c => c.asset), ['iceFull', 'lock', 'key', 'crate']);
  assert.equal(changes[0].partial, true);
  assert.deepEqual(obstacleTransitions(next, next), []);
  const opened = structuredClone(next); opened.tiles[0].obstacle.remaining = 0;
  assert.deepEqual(obstacleTransitions(next, opened).map(c => [c.asset, c.partial]), [['iceCracked', false]]);
  assert.equal(previous.tiles[0].obstacle.remaining, 2);
});

test('renderer uses real coin and obstacle PNGs with deterministic small particles', () => {
  const calls = [], ctx = new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]), set: () => true });
  const images = new Map([COIN_ART.file, ...Object.values(OBSTACLE_ASSETS).map(a => a.file)].map(file => [file, { file }]));
  const pool = new PlayEffects();
  pool.add('reward', { x: 90, y: 120 }, { to: { x: 290, y: 25 } });
  pool.add('obstacle', { x: 100, y: 400, w: 60, h: 60 }, { asset: 'iceFull' });
  pool.add('merge', { x: 90, y: 700 }); pool.step(200);
  drawPlayEffects(ctx, pool, images);
  const draws = calls.filter(c => c[0] === 'drawImage');
  assert.equal(draws.filter(c => c[1].file === COIN_ART.file).length, 3);
  assert.equal(draws.filter(c => c[1].file === OBSTACLE_ASSETS.iceFull.file).length, 4);
  assert.ok(calls.some(c => c[0] === 'ellipse'));
  const first = JSON.stringify(calls); calls.length = 0;
  drawPlayEffects(ctx, pool, images); assert.equal(JSON.stringify(calls), first);
});

function harness() {
  let now = 0;
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  const p = { canvas: { getContext: () => ctx }, size: () => ({ width: 390, height: 844, ratio: 1, top: 40, bottom: 0 }),
    get() {}, set() { return true; }, sound() {}, effect() {}, bind() {}, now: () => now, raf: () => 1, cancelRaf() {}, musicReady() {},
    resource: x => x, image: () => Promise.resolve({ width: 1254, height: 1254 }), loadResources: () => Promise.resolve() };
  const app = new CanvasApp(p); app.loading = false; app.session.start(); app.render(0);
  return { app, step(ms) { for (let i = 0; i < ms; i += 20) { now += 20; app.frame(); } } };
}

test('native merge uses rail collision and effects freeze offscreen or clear on scene changes', () => {
  const { app, step } = harness();
  for (let i = 0; i < 3; i++) {
    const tile = getVisibleTiles(app.session.game).find(t => t.ingredient === 'rice');
    app.pickTile(tile, { x: 100, y: 270, w: 65, h: 65 }); step(20);
  }
  assert.ok(app.effects.has('merge'));
  assert.equal([...app.flights.values()].filter(f => f.leader).length, 1);
  assert.ok([...app.flights.values()].every(f => f.gather.y === app.railRect(0).y));
  const before = structuredClone(app.effects.items);
  app.hide(); step(1000); assert.deepEqual(app.effects.items, before);
  app.show(); assert.equal(app.effects.items.length, 0);
  assert.equal(app.session.game.harvests, 1);
});

test('native serving emits three cosmetic coins once and never grants extra rewards', () => {
  const { app, step } = harness(), route = getLevel(app.session.game).solution;
  for (const id of route) {
    app.session.pick(id); step(20);
    if (app.session.game.workbench.crafted) break;
  }
  assert.ok(app.effects.has('craft'));
  for (let i = 0; i < 100 && !app.effects.has('reward'); i++) step(20);
  assert.equal(app.session.game.served, 1);
  assert.equal(app.effects.items.filter(e => e.kind === 'reward').length, 1);
  const income = app.session.game.coins, wallet = app.session.shop.coins;
  assert.equal(income, 18);
  step(1200); assert.equal(app.session.game.coins, income); assert.equal(app.session.shop.coins, wallet);
  assert.equal(app.effects.has('reward'), false);
});
