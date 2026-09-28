// Shared, deterministic squash-and-stretch for DOM and native Canvas.
export const MOTION = { pick: 400, merge: 500, bounce: 460, craft: 340 };
const clamp = n => Math.max(0, Math.min(1, n));
const mix = (a, b, t) => a + (b - a) * t;
const REST = { sx: 1, sy: 1, y: 0, rotate: 0 };
const KEYS = [
  [0, 1.22, .76, 3, -3], [.2, .86, 1.18, -9, 3],
  [.43, 1.12, .88, 2, -2], [.65, .96, 1.05, -2, 1],
  [.82, 1.025, .98, 0, -.3], [1, 1, 1, 0, 0]
];
export function jellyPose(progress, strength = 1) {
  if (progress < 0 || progress >= 1) return { ...REST };
  const index = KEYS.findIndex(key => key[0] >= progress);
  const b = KEYS[Math.max(1, index)], a = KEYS[Math.max(1, index) - 1];
  const t = clamp((progress-a[0])/(b[0]-a[0])), ease = t*t*(3-2*t);
  return { sx: 1+(mix(a[1],b[1],ease)-1)*strength, sy: 1+(mix(a[2],b[2],ease)-1)*strength,
    y: mix(a[3],b[3],ease)*strength, rotate: mix(a[4],b[4],ease)*strength };
}
// Rectangles use center coordinates; layout/hit boxes never follow the wobble.
export function flightPose(progress, from, to, merge = false) {
  const t=clamp(progress), travel=clamp(t/.68), ease=1-Math.pow(1-travel,3);
  if(t===0||t===1)return { ...(t===0?from:to), rotate:0, opacity:merge&&t===1?0:1 };
  const land=t<.68?{sx:1-.12*Math.sin(travel*Math.PI),sy:1+.14*Math.sin(travel*Math.PI),y:0,rotate:-7*Math.sin(travel*Math.PI)}:jellyPose((t-.68)/.32,.65);
  const lift=Math.min(62,Math.max(22,Math.abs(to.y-from.y)*.13));
  return { x:mix(from.x,to.x,ease),y:mix(from.y,to.y,ease)-Math.sin(travel*Math.PI)*lift+land.y,
    w:mix(from.w,to.w,ease)*land.sx,h:mix(from.h,to.h,ease)*land.sy,
    rotate:land.rotate,opacity:merge?1-clamp((t-.76)/.24):1 };
}
export function jellyFrames(strength = 1) {
  return Array.from({length:31},(_,i)=>{const p=jellyPose(i/30,strength);return {offset:i/30,transform:`translateY(${p.y}px) rotate(${p.rotate}deg) scale(${p.sx}, ${p.sy})`};});
}
