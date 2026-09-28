// Pixel bounds, not equal grid cells: the shrimp tail crosses the old cell edge.
// Keep the source PNGs intact; nested SVG viewports clip their cached pixels.
import { clippedAtlas } from './atlas-art.js';
export const FOOD_ATLASES = {
  ingredient: { file: 'ingredient-atlas-v1.png', width: 1448, height: 1086 },
  sushi: { file: 'sushi-atlas-v2.png', width: 1448, height: 1086 }
};
export const FOOD_CROPS = {
  ingredient: {
    rice: [34,67,329,281], salmon: [395,79,327,266], tuna: [749,79,324,267],
    shrimp: [1111,73,321,267], tamago: [37,413,318,266], cucumber: [417,413,273,265],
    nori: [737,413,336,277], roe: [1112,419,293,248], avocado: [46,734,316,261]
  },
  sushi: {
    salmon: [41,102,324,247], tuna: [388,102,322,247], shrimp: [730,101,367,261],
    tamago: [1092,99,319,246], makiCucumber: [62,403,263,272],
    makiSalmon: [419,402,264,272], makiAvocado: [769,403,261,270], roe: [1127,395,261,279]
  }
};
const NS = 'http://www.w3.org/2000/svg';
export const FOOD_MASKS = {
  tamago: 'M1092 99H1411V345H1108V256L1092 239Z',
  shrimp: 'M730 101H1082V250L1097 271V362H730Z'
};
export function setFoodArt(node, kind, id) {
  const rect = FOOD_CROPS[kind]?.[id];
  if (!rect) throw new Error('Unknown food sprite: ' + kind + '/' + id);
  node.dataset[kind === 'sushi' ? 'sushi' : 'ingredient'] = id;
  node.setAttribute('aria-hidden', 'true');
  if (node.dataset.artKey === kind + '/' + id) return node;
  node.dataset.artKey = kind + '/' + id;
  const atlas = FOOD_ATLASES[kind];
  const outer = document.createElementNS(NS, 'svg');
  outer.setAttribute('viewBox', '0 0 100 100');
  outer.setAttribute('aria-hidden', 'true');
  const viewport = clippedAtlas({ ...atlas, file: './assets/' + atlas.file }, rect,
    kind === 'sushi' ? FOOD_MASKS[id] : null);
  const scale = 92 / Math.max(rect[2], rect[3]);
  viewport.setAttribute('x', String((100 - rect[2] * scale) / 2));
  viewport.setAttribute('y', String((100 - rect[3] * scale) / 2));
  viewport.setAttribute('width', String(rect[2] * scale));
  viewport.setAttribute('height', String(rect[3] * scale));
  outer.append(viewport); node.replaceChildren(outer);
  return node;
}
export function foodIcon(kind, id, className = '') {
  const node = document.createElement('span');
  node.className = (kind === 'sushi' ? 'sushi-icon ' : 'ingredient-icon ') + className;
  return setFoodArt(node, kind, id);
}
