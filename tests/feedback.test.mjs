import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEndlessGame, getLevel, getVisibleTiles, selectTile, canCraftActive, craftActiveSushi, serveActiveCustomer } from '../src/game-core.js';
import { outcomeSummary } from '../src/feedback.js';
import { CAT_CROPS, CAT_STATES, CAT_ATLAS } from '../src/cat-portrait.js';

const settle = s => { while (s.status === 'playing' && (s.workbench.crafted || canCraftActive(s))) s = s.workbench.crafted ? serveActiveCustomer(s).state : craftActiveSushi(s).state; return s; };
test('success recap uses actual earned coins without adding a second reward', () => {
  let state = createEndlessGame(42);
  assert.equal(outcomeSummary(state), null);
  for (const id of getLevel(state).solution) state = settle(selectTile(state, id).state);
  const before = JSON.stringify(state);
  const result = outcomeSummary(state);
  assert.equal(result.won, true);
  assert.equal(result.coins, state.runCoins);
  assert.match(result.primary, /第 2 波/);
  assert.equal(JSON.stringify(state), before);
});
test('failure recap shows the actual jam and preserves income and game state', () => {
  let lost;
  for (let attempt = 0; attempt < 50 && !lost; attempt++) {
    let s = createEndlessGame(42);
    let step = 0;
    while (s.status === 'playing') {
      const options = getVisibleTiles(s);
      s = settle(selectTile(s, options[(attempt + step++ * 7) % options.length].id).state);
    }
    if (s.status === 'lost') lost = s;
  }
  assert.ok(lost);
  const before = JSON.stringify(lost);
  const result = outcomeSummary(lost);
  assert.equal(result.won, false);
  assert.equal(result.rail.length, 7);
  assert.match(result.detail, /已赚金币保留/);
  assert.equal(result.secondary, '返回小店');
  assert.equal(JSON.stringify(lost), before);
});
test('three complete cat portraits are bundled with alpha and bounded isolated crops', () => {
  assert.equal(Object.keys(CAT_CROPS).length, 3);
  for (const [x,y,w,h] of Object.values(CAT_CROPS)) {
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x+w <= CAT_ATLAS.width && y+h <= CAT_ATLAS.height);
  }
  assert.ok(CAT_STATES.includes('disappointed'));
  const png = readFileSync(new URL('../' + CAT_ATLAS.file, import.meta.url));
  assert.equal(png.readUInt32BE(16), CAT_ATLAS.width); assert.equal(png.readUInt32BE(20), CAT_ATLAS.height); assert.equal(png[25], 6);
});
test('active game and victory screen never load the retired skeletal animation', () => {
  for (const path of ['src/main.js', 'src/feedback.js', 'src/cat-portrait.js', 'index.html']) {
    const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /cat-rig|cat-arm|createCatRig|poseCat/);
  }
  const css = readFileSync(new URL('../cat-portrait.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /infinite|rig-|rotate\(/);
  assert.match(css, /prefers-reduced-motion/);
});
test('new theme and victory images are bundled locally', () => {
  for (const filename of ['menu/theme-garden-v1.png', 'menu/theme-night-v1.png', 'victory-platter-v1.png']) {
    const png = readFileSync(new URL('../assets/' + filename, import.meta.url));
    assert.ok(png.length > 100000);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /🍣|😀|😢/);
});
