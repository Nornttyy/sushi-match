// Shared by CSS and Canvas. Darken colours, never card opacity: buried food
// stays completely hidden and even the deepest card keeps a readable edge.
const BRIGHTNESS = [1, .86, .77, .68, .60, .53, .47, .42];
function shade(hex, brightness) {
  return '#' + hex.slice(1).match(/../g)
    .map(channel => Math.round(parseInt(channel, 16) * brightness).toString(16).padStart(2, '0')).join('');
}
const APPEARANCES = BRIGHTNESS.map(brightness => Object.freeze({
  brightness,
  face: shade('#e2c994', brightness),
  border: shade('#c7b180', brightness),
  side: shade('#cbb083', brightness)
}));

export function tileDepthAppearance(depth) {
  const index = Number.isFinite(depth) ? Math.max(0, Math.min(7, Math.floor(depth))) : 0;
  return APPEARANCES[index];
}
