import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOOD_ATLASES, FOOD_CROPS, FOOD_MASKS, foodIcon, setFoodArt } from '../src/food-art.js';
import { CAT_CROPS, CAT_ATLAS, CAT_STATES, createCatPortrait, setCatState } from '../src/cat-portrait.js';
import { INGREDIENTS, RECIPES } from '../src/game-core.js';

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.style = { setProperty() {} }; }
  setAttribute(name, value) { this.attributes[name] = value; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  matches(selector) { return selector === '.cat-portrait' && this.className?.split(' ').includes('cat-portrait'); }
  querySelector(selector) { return all(this).slice(1).find(n => n.matches(selector)) ?? null; }
}
const all = node => [node, ...node.children.flatMap(all)];
function withDocument(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag) };
  try { run(); } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
}

test('every playable ingredient and sushi has an explicit crop within its real PNG size', () => {
  assert.deepEqual(Object.keys(FOOD_CROPS.ingredient).sort(), Object.keys(INGREDIENTS).sort());
  assert.deepEqual(Object.keys(FOOD_CROPS.sushi).sort(), Object.values(RECIPES).map(r => r.foodSprite).sort());
  for (const [kind, atlas] of Object.entries(FOOD_ATLASES)) {
    const png = readFileSync(new URL('../assets/' + atlas.file, import.meta.url));
    assert.equal(png.readUInt32BE(16), atlas.width); assert.equal(png.readUInt32BE(20), atlas.height);
    for (const [x,y,w,h] of Object.values(FOOD_CROPS[kind])) assert.ok(x>=0 && y>=0 && w>0 && h>0 && x+w<=atlas.width && y+h<=atlas.height);
  }
  assert.ok(FOOD_MASKS.tamago && FOOD_MASKS.shrimp, 'neighbouring silhouette corners are excluded');
});

test('food icons and complete cat portraits clip actual image pixels, including letterboxed SVGs', () => withDocument(() => {
  const nodes = [];
  for (const [kind, foods] of Object.entries(FOOD_CROPS)) for (const id of Object.keys(foods)) nodes.push(foodIcon(kind, id));
  for (const skin of Object.keys(CAT_CROPS)) {
    const portrait = createCatPortrait(skin);
    const sprites = all(portrait).filter(n => n.tag === 'image' && n.attributes.href === CAT_ATLAS.file);
    assert.equal(sprites.length, 1, 'each cat is one complete illustration');
    assert.ok(all(portrait).every(n => n.tag !== 'canvas' && !n.dataset.bone && !n.dataset.bones));
    nodes.push(portrait);
  }
  const elements = nodes.flatMap(all), clips = elements.filter(n => n.tag === 'clipPath');
  const ids = clips.map(c => c.id);
  assert.equal(new Set(ids).size, clips.length, 'repeated icons have independent clip IDs');
  for (const image of elements.filter(n => n.tag === 'image')) {
    const target = image.attributes['clip-path'].match(/^url\(#(.+)\)$/)?.[1];
    const clip = clips.find(c => c.id === target);
    assert.ok(clip, 'every source image has a real clip, not only overflow:hidden');
    assert.equal(clip.attributes.clipPathUnits, 'userSpaceOnUse');
    assert.ok(['rect','path'].includes(clip.children[0].tag));
  }
}));

test('cat reactions reuse the same whole illustration without manipulating body parts', () => withDocument(() => {
  const cat = createCatPortrait('calico'), art = cat.children[0];
  const card = new Element('div'); card.append(cat);
  for (const state of CAT_STATES) {
    setCatState(card, state);
    assert.equal(cat.dataset.state, state);
    assert.equal(cat.children.length, 1);
    assert.equal(cat.children[0], art);
  }
  setCatState(cat, 'waiting');
  setCatState(cat, 'not-a-state'); assert.equal(cat.dataset.state, 'waiting');
  setCatState(new Element('div'), 'happy');
  assert.equal(createCatPortrait('missing').dataset.skin, 'ginger');
  assert.equal(createCatPortrait('toString').dataset.skin, 'ginger');
}));

test('changing a customer order replaces its crop and unchanged orders reuse their artwork', () => withDocument(() => {
  const icon = foodIcon('sushi', 'tamago');
  const before = icon.children[0];
  setFoodArt(icon, 'sushi', 'tamago'); assert.equal(icon.children[0], before);
  setFoodArt(icon, 'sushi', 'shrimp'); assert.notEqual(icon.children[0], before);
  assert.equal(icon.dataset.sushi, 'shrimp');
  assert.equal(all(icon).filter(n => n.tag === 'image').length, 1);
  assert.throws(() => setFoodArt(icon, 'sushi', 'unknown'));
}));
