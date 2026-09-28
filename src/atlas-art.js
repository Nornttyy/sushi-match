// overflow:hidden clips an SVG's viewport, NOT its letterboxed viewBox.
// Clip source pixels explicitly so a narrow/tall part cannot reveal neighbours.
const NS = 'http://www.w3.org/2000/svg';
let nextClip = 0;
export function clippedAtlas(atlas, rect, maskPath = null) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', rect.join(' '));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true'); svg.style.overflow = 'hidden';
  const defs = document.createElementNS(NS, 'defs');
  const clip = document.createElementNS(NS, 'clipPath');
  const id = 'atlas-crop-' + nextClip++;
  clip.id = id; clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
  const shape = document.createElementNS(NS, maskPath ? 'path' : 'rect');
  if (maskPath) shape.setAttribute('d', maskPath);
  else ['x','y','width','height'].forEach((key, i) => shape.setAttribute(key, String(rect[i])));
  clip.append(shape); defs.append(clip);
  const image = document.createElementNS(NS, 'image');
  image.setAttribute('href', atlas.file);
  image.setAttribute('width', String(atlas.width)); image.setAttribute('height', String(atlas.height));
  image.setAttribute('clip-path', 'url(#' + id + ')');
  svg.append(defs, image);
  return svg;
}
