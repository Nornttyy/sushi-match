// One complete illustration per customer. No bones, part overlays or render loop.
import { clippedAtlas } from './atlas-art.js';

export const CAT_ATLAS = Object.freeze({ file: './assets/cat-portraits-v1.png', width: 2172, height: 724 });
export const CAT_CROPS = Object.freeze({
  ginger: Object.freeze([160, 35, 550, 670]),
  calico: Object.freeze([823, 35, 550, 670]),
  gray: Object.freeze([1526, 35, 550, 670])
});
export const CAT_STATES = Object.freeze(['waiting', 'receiving', 'happy', 'leaving', 'disappointed']);

export function createCatPortrait(skin) {
  if (!Object.hasOwn(CAT_CROPS, skin)) skin = 'ginger';
  const portrait = document.createElement('span');
  portrait.className = 'customer-portrait cat-portrait';
  portrait.dataset.skin = skin;
  portrait.dataset.state = 'waiting';
  portrait.setAttribute('aria-hidden', 'true');
  portrait.append(clippedAtlas(CAT_ATLAS, CAT_CROPS[skin]));
  return portrait;
}

export function setCatState(card, state) {
  const portrait = card.matches('.cat-portrait') ? card : card.querySelector('.cat-portrait');
  if (portrait && CAT_STATES.includes(state)) portrait.dataset.state = state;
}
