// Authored cutout bones. Forearms inherit shoulder transforms; eyes inherit the
// head transform; head, shoulders and tail inherit the torso transform.
import { foodIcon, setFoodArt } from './food-art.js';
import { clippedAtlas } from './atlas-art.js';
import { attachArmSkin, wakeCatArms } from './cat-arm.js';
export const CAT_PARTS = Object.freeze({
  ginger: [[68,20,288,232],[432,9,250,232],[781,61,105,148],[980,61,103,168],[1181,61,107,148],[1390,60,105,169],[1605,8,217,238],[1928,104,139,63]],
  calico: [[68,263,284,224],[424,258,259,217],[776,294,108,149],[977,294,101,167],[1180,293,109,150],[1391,293,106,170],[1607,256,245,216],[1928,336,139,62]],
  gray: [[64,494,289,225],[424,499,254,199],[776,523,105,148],[977,523,104,172],[1181,523,107,148],[1393,522,104,175],[1608,488,231,218],[1928,569,139,62]]
});
export const CAT_POSES = ['waiting', 'receiving', 'happy', 'leaving', 'disappointed'];
export const CAT_ATLAS = './assets/cat-rig-parts-v3.png';

function part(skin, index, className) {
  const node = document.createElement('span'); node.className = 'rig-part ' + className;
  node.append(clippedAtlas({ file: CAT_ATLAS, width: 2172, height: 724 }, CAT_PARTS[skin][index]));
  return node;
}
function bone(name) { const node = document.createElement('span'); node.className = 'rig-bone rig-' + name; node.dataset.bone = name; return node; }

export function createCatRig(skin, phase = 0) {
  if (!CAT_PARTS[skin]) skin = 'ginger';
  const root = document.createElement('span');
  root.className = 'customer-portrait cat-rig'; root.dataset.skin = skin; root.dataset.pose = 'waiting';
  root.style.setProperty('--phase', (-phase * .7) + 's'); root.setAttribute('aria-hidden', 'true');
  const torso = bone('torso');
  const tail = bone('tail'); tail.append(part(skin, 6, 'rig-tail-art'));
  const head = bone('head'); head.append(part(skin, 0, 'rig-head-art'), part(skin, 7, 'rig-eyes'));
  const left = bone('shoulder-left'), right = bone('shoulder-right');
  const elbowLeft = bone('elbow-left'), elbowRight = bone('elbow-right');
  const leftFallback = part(skin, 3, 'rig-arm-fallback'), rightFallback = part(skin, 5, 'rig-arm-fallback');
  left.append(leftFallback); right.append(rightFallback);
  // A small wrist gesture is additive, never replaces the shoulder pose.
  const wave = bone('wave'); elbowRight.append(wave);
  left.append(elbowLeft); right.append(elbowRight);
  attachArmSkin({ root, shoulder: left, elbow: elbowLeft, file: CAT_ATLAS, crop: CAT_PARTS[skin][3], fallback: leftFallback });
  attachArmSkin({ root, shoulder: right, elbow: elbowRight, wave, file: CAT_ATLAS, crop: CAT_PARTS[skin][5], fallback: rightFallback });
  const carried = foodIcon('sushi', 'salmon', 'rig-carried');
  torso.append(tail, part(skin, 1, 'rig-body-art'), carried, left, right, head);
  root.append(torso); return root;
}

export function poseCat(card, pose, recipeId) {
  const rig = card.matches('.cat-rig') ? card : card.querySelector('.cat-rig');
  if (!rig || !CAT_POSES.includes(pose)) return;
  rig.dataset.pose = pose;
  wakeCatArms();
  if (recipeId) setFoodArt(rig.querySelector('.rig-carried'), 'sushi', recipeId);
}
