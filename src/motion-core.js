// Shared, deterministic squash-and-stretch for DOM and native Canvas.
export const MOTION = Object.freeze({ pick: 460, merge: 340, bounce: 360, craft: 300 });
export const PICK_LANDING = .42;
export const MERGE_IMPACT = .5;
const clamp = n => Math.max(0, Math.min(1, n));
const mix = (a, b, t) => a + (b - a) * t;
const REST = { sx: 1, sy: 1, y: 0, rotate: 0 };
const KEYS = [
  [0, 1.12, .88, 2, 0], [.32, .96, 1.04, -3, 0],
  [1, 1, 1, 0, 0]
];
export function jellyPose(progress, strength = 1) {
  if (progress < 0 || progress >= 1) return { ...REST };
  const index = KEYS.findIndex(key => key[0] >= progress);
  const b = KEYS[Math.max(1, index)], a = KEYS[Math.max(1, index) - 1];
  const t = clamp((progress-a[0])/(b[0]-a[0])), ease = t*t*(3-2*t);
  return { sx: 1+(mix(a[1],b[1],ease)-1)*strength, sy: 1+(mix(a[2],b[2],ease)-1)*strength,
    y: mix(a[3],b[3],ease)*strength, rotate: mix(a[4],b[4],ease)*strength };
}
// Rail arrival is one gentle compression, with a longer release and no shake.
export function settlePose(progress) {
  if(progress<=0||progress>=1)return { ...REST };
  const phase=progress<.3?progress/.3*.5:.5+(progress-.3)/.7*.5;
  const pressure=Math.pow(Math.sin(phase*Math.PI),2);
  return {sx:1+.055*pressure,sy:1-.07*pressure,y:1.6*pressure,rotate:0};
}
// Rectangles use center coordinates; layout/hit boxes never follow the wobble.
export function flightPose(progress, from, to, merge = false, softLanding = false) {
  const t=clamp(progress), landingAt=softLanding ? PICK_LANDING : .68;
  const travel=clamp(t/landingAt), ease=1-Math.pow(1-travel,3);
  if(t===0||t===1)return { ...(t===0?from:to), rotate:0, opacity:merge&&t===1?0:1 };
  const land=t<landingAt?{sx:1-.12*Math.sin(travel*Math.PI),sy:1+.14*Math.sin(travel*Math.PI),y:0,rotate:-7*Math.sin(travel*Math.PI)}
    :softLanding?settlePose((t-landingAt)/(1-landingAt)):jellyPose((t-landingAt)/(1-landingAt),.65);
  const lift=Math.min(62,Math.max(22,Math.abs(to.y-from.y)*.13));
  return { x:mix(from.x,to.x,ease),y:mix(from.y,to.y,ease)-Math.sin(travel*Math.PI)*lift+land.y,
    w:mix(from.w,to.w,ease)*land.sx,h:mix(from.h,to.h,ease)*land.sy,
    rotate:land.rotate,opacity:merge?1-clamp((t-.76)/.24):1 };
}
// Three cards meet in the rail first. Only the last card carries the merged
// ingredient onward, so the plate no longer receives three ghost copies.
export function mergePose(progress, from, gather, to, leader = true) {
  const t = clamp(progress);
  if (t === 1) return { ...(leader ? to : gather), rotate: 0, opacity: 0, card: 0 };
  if (t < MERGE_IMPACT) {
    const p = t / MERGE_IMPACT, ease = 1 - (1 - p) ** 3;
    return { x: mix(from.x, gather.x, ease), y: mix(from.y, gather.y, ease) - Math.sin(p * Math.PI) * 20,
      w: mix(from.w, gather.w, ease), h: mix(from.h, gather.h, ease), rotate: 0, opacity: 1, card: 1 };
  }
  const squeeze = clamp((t - MERGE_IMPACT) / .12);
  if (t < .62 || !leader) return { ...gather, w: gather.w * (1 + .1 * squeeze), h: gather.h * (1 - .1 * squeeze),
    rotate: 0, opacity: leader ? 1 : 1 - squeeze, card: 1 - squeeze };
  const p = (t - .62) / .38, ease = p * p * (3 - 2 * p);
  return { x: mix(gather.x, to.x, ease), y: mix(gather.y, to.y, ease) - Math.sin(p * Math.PI) * 16,
    w: mix(gather.w * 1.1, to.w, ease), h: mix(gather.h * .9, to.h, ease),
    rotate: 0, opacity: 1 - clamp((p - .8) / .2), card: 0 };
}
export function jellyFrames(strength = 1) {
  return Array.from({length:31},(_,i)=>{const p=jellyPose(i/30,strength);return {offset:i/30,transform:`translateY(${p.y}px) rotate(${p.rotate}deg) scale(${p.sx}, ${p.sy})`};});
}
