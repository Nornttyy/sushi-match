import { foodIcon } from './food-art.js';
import { MOTION, flightPose, jellyFrames } from './motion-core.js';

const bounds = node => { const r=node?.getBoundingClientRect(); return r?.width?{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}:null; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountJuice({ board, rail, prep }) {
  const layer=document.createElement('div'); layer.className='juice-layer'; layer.setAttribute('aria-hidden','true'); document.body.append(layer);
  const flights=new Map(), animations=new Set(), animatedNodes=new WeakMap();
  let generation=0;
  function track(node, frames, duration, done=()=>{}) {
    if(reduced()||!node?.animate) { done(); return Promise.resolve(); }
    animatedNodes.get(node)?.cancel();
    const animation=node.animate(frames,{duration,easing:'linear',fill:'both'}); animations.add(animation);
    animatedNodes.set(node,animation);
    return animation.finished.catch(()=>{}).then(()=>{animations.delete(animation);if(animatedNodes.get(node)===animation)animatedNodes.delete(node);done();animation.cancel();});
  }
  function bounce(node,strength=1) { if(node)void track(node,jellyFrames(strength),MOTION.bounce); }
  function sync() {
    rail.querySelectorAll('[data-rail-id]').forEach(slot=>slot.classList.toggle('is-arriving',flights.has(slot.dataset.railId)));
  }
  function remove(id) {
    const f=flights.get(id);if(!f)return;
    flights.delete(id);f.node.getAnimations().forEach(a=>a.cancel());f.node.remove();sync();
  }
  function clear() { generation++;pressed?.animation.cancel();pressed=null;for(const id of [...flights.keys()])remove(id);for(const a of animations)a.cancel();layer.replaceChildren(); }
  function capture(tile,items) {
    return { tile, from:bounds(board.querySelector('[data-tile-id="'+tile.id+'"]')),
      rail:items.map(item=>({ ...item, from:bounds(flights.get(item.id)?.node)||bounds(rail.querySelector('[data-rail-id="'+item.id+'"]')) })) };
  }
  function fly(tile,from,to,merge=false) {
    if(!from||!to||reduced())return Promise.resolve();
    remove(tile.id);
    const node=document.createElement('span');node.className='juice-card'+(merge?' is-merging':'');node.dataset.flightId=tile.id;
    node.style.width=from.w+'px';node.style.height=from.h+'px';node.append(foodIcon('ingredient',tile.ingredient));layer.append(node);
    const entry={node,to};flights.set(tile.id,entry);sync();
    const frames=Array.from({length:41},(_,i)=>{const p=flightPose(i/40,from,to,merge);return {offset:i/40,opacity:p.opacity,transform:`translate(${p.x-from.w/2}px, ${p.y-from.h/2}px) rotate(${p.rotate}deg) scale(${p.w/from.w}, ${p.h/from.h})`};});
    return track(node,frames,merge?MOTION.merge:MOTION.pick,()=>{
      node.remove();if(flights.get(tile.id)!==entry)return;flights.delete(tile.id);sync();
      if(!merge)bounce(rail.querySelector('[data-rail-id="'+tile.id+'"]'),.45);
    });
  }
  function pick(snapshot,harvested) {
    // A matching insert can move older cards to the right. Retarget from the
    // current visual position, including cards still in flight after a fast tap.
    for(const tile of snapshot.rail) {
      if(tile.ingredient===harvested)continue;
      const target=bounds(rail.querySelector('[data-rail-id="'+tile.id+'"]')),old=flights.get(tile.id)?.to||tile.from;
      if(target&&old&&Math.hypot(target.x-old.x,target.y-old.y)>1)void fly(tile,tile.from,target);
    }
    if(!harvested){const slot=rail.querySelector('[data-rail-id="'+snapshot.tile.id+'"]');return fly(snapshot.tile,snapshot.from,bounds(slot));}
    const token=generation,target=bounds(prep),matches=snapshot.rail.filter(t=>t.ingredient===harvested);
    const tasks=[...matches,{...snapshot.tile,from:snapshot.from}].map(tile=>fly(tile,tile.from,target,true));
    return Promise.all(tasks).then(()=>{ if(token===generation&&!reduced())bounce(prep,.8); });
  }
  // Stable outer controls retain their layout transform; only inner artwork flexes.
  let pressed=null;
  document.addEventListener('pointerdown',event=>{
    const button=event.target.closest('button:not(:disabled)');if(!button||button.closest('[inert]')||reduced())return;
    const visual=button.querySelector('.stack-plate, .menu-dish, .decor-thumbnail')||button;
    animatedNodes.get(visual)?.cancel();
    const base=visual===button?getComputedStyle(visual).transform:'none';
    const prefix=base==='none'?'':base+' ';
    pressed?.animation.cancel();
    pressed={id:event.pointerId,node:visual,x:event.clientX,y:event.clientY,prefix,
      animation:visual.animate([{transform:prefix+'scale(1)'},{transform:prefix+'translateY(3px) scale(1.09,.84)'}],{duration:80,fill:'forwards'})};
  },{passive:true});
  const release=event=>{
    if(!pressed||event.pointerId!==pressed.id)return;
    const p=pressed;pressed=null;p.animation.cancel();
    if(event.type==='pointercancel'||Math.hypot(event.clientX-p.x,event.clientY-p.y)>10)return;
    void track(p.node,jellyFrames(.65).map(f=>({...f,transform:p.prefix+f.transform})),MOTION.bounce);
  };
  document.addEventListener('pointerup',release,{passive:true});document.addEventListener('pointercancel',release,{passive:true});
  window.addEventListener('resize',clear);
  window.addEventListener('blur',()=>{pressed?.animation.cancel();pressed=null;});
  return {capture,pick,bounce,sync,clear};
}
