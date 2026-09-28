import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('the page is wired for a layered ingredient puzzle with automatic delivery', () => {
  [
    'customer-rail',
    'recipe-slots',
    'crafted-plate',
    'delivery-status',
    'tile-board',
    'ingredient-rail',
    'handoff-fx',
    'main-menu',
    'level-picker',
    'level-pagination',
    'level-previous',
    'level-next',
    'level-page-label',
    'mode-picker',
    'endless-preview',
    'endless-record',
    'endless-new-button',
    'menu-start-button',
    'overlay-menu-button',
    'sound-button',
    'menu-sound-button'
  ].forEach((id) => assert.match(html, new RegExp('id="' + id + '"')));

  assert.doesNotMatch(html + main + css, /ingredient-dock|serving-rack|fresh-cover|回转餐盘|craft-button/);
  assert.match(main, /selectTile/);
  assert.match(main, /resolveAutoOrders/);
  assert.match(main, /craftActiveSushi/);
  assert.match(main, /serveActiveCustomer/);
  assert.match(main, /animateHandoff/);
  assert.match(main, /GameSound/);
  assert.doesNotMatch(main, /customerRail\.addEventListener/);
  assert.match(main, /ingredient-rail/);
});

test('the page references every generated gameplay art atlas', () => {
  const art = readFileSync(new URL('../src/food-art.js', import.meta.url), 'utf8');
  assert.match(art, /sushi-atlas-v2\.png/);
  assert.match(art, /ingredient-atlas-v1\.png/);
  assert.doesNotMatch(css, /background-size: 400% 300%/);
});

test('repetitive instructions are removed without removing accessible labels or music credits', () => {
  assert.doesNotMatch(html, /叠出食材，捏好寿司|只选没被压住的牌|三份同类自动合成|把好心情|id="level-subtitle"|id="prep-hint"/);
  assert.doesNotMatch(main, /showMessage\(state.event|每局不同|getRandomValues|Math.random/);
  assert.match(html, /id="message" class="sr-only"/);
  assert.match(html, /aria-label="七格备料栏"/);
});

test('menu art is bundled locally with the expected size and transparent sprite atlases', () => {
  const artCss = readFileSync(new URL('../assets/menu/menu-interior.css', import.meta.url), 'utf8');
  assert.match(html, /assets\/menu\/menu-interior\.css/);
  const assets = [
    ['sushi-interior-v1.png', 948, 1659, 2],
    ['shop-decorations-v1.png', 1536, 1024, 6],
    ['shop-parts-v1.png', 1254, 1254, 6],
    ['shop-details-v1.png', 1254, 1254, 6]
  ];
  for (const [name, width, height, colorType] of assets) {
    const png = readFileSync(new URL('../assets/menu/' + name, import.meta.url));
    assert.ok(png.length > 10000, name + ' is a complete raster asset');
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
    assert.equal(png[25], colorType, name + ' preserves its original color/alpha channels');
    assert.ok((artCss + html).includes(name), name + ' is used by the menu');
  }
});

test('the menu is an indoor shop without the old cat or feeding interaction', () => {
  const menu = html.split('id="main-menu"')[1].split('<dialog')[0];
  assert.match(menu, /寿司店内主菜单/);
  assert.match(menu, /menu-recipe-preview/);
  assert.match(menu, /decorate-button/);
  assert.doesNotMatch(menu, /menu-chef|猫猫|customer-portrait|menu-seaside/);
  assert.doesNotMatch(main, /feedMenuChef|reactMenuChef|clearMenuTreat/);
  assert.match(main, /shop\.award\(result\.reward\)/);
});

test('background music is bundled with its artist credit and remains optional', () => {
  const sound = readFileSync(new URL('../src/sound.js', import.meta.url), 'utf8');
  assert.match(sound, /AudioContext/);
  assert.match(sound, /localStorage/);
  assert.match(sound, /case 'triple'/);
  assert.match(sound, /case 'serve'/);
  assert.match(sound, /startBgm/);
  assert.match(sound, /pauseForVisibility/);
  assert.match(sound, /resumeAfterVisibility/);
  assert.match(main, /sounds\.startBgm/);
  assert.match(sound, /assets\/audio\/bossa-antigua\.mp3/);
  assert.match(html, /Bossa Antigua — Kevin MacLeod/);
  assert.match(html, /creativecommons\.org\/licenses\/by\/4\.0/);
  const music = readFileSync(new URL('../assets/audio/bossa-antigua.mp3', import.meta.url));
  assert.ok(music.length > 1000000, 'the complete music asset is bundled');
  assert.equal(music.subarray(0, 3).toString(), 'ID3');
});
