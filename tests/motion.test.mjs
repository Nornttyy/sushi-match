import test from 'node:test';
import assert from 'node:assert/strict';
import { jellyPose, settlePose, flightPose, jellyFrames, MOTION } from '../src/motion-core.js';
import { CanvasApp } from '../wechat/src/canvas-app.js';
import { LEVELS, getRailTiles, getVisibleTiles } from '../src/game-core.js';

test('jelly compresses, overshoots, damps, and ends exactly at rest',()=>{
  assert.ok(jellyPose(0).sx>1 && jellyPose(0).sy<1);
  assert.ok(jellyPose(.2).sx<1 && jellyPose(.2).sy>1);
  assert.deepEqual(jellyPose(1),{sx:1,sy:1,y:0,rotate:0});
  assert.deepEqual(jellyPose(-1),jellyPose(1));
  for(let i=0;i<=1000;i++){const p=jellyPose(i/1000);assert.ok(p.sx>0&&p.sy>0);assert.ok(Math.abs(p.sx*p.sy-1)<.13);}
  assert.equal(jellyFrames().at(-1).transform,'translateY(0px) rotate(0deg) scale(1, 1)');
});
test('food follows an arc and reaches the actual destination without drift or a flipped sprite',()=>{
  const from={x:120,y:260,w:70,h:70},to={x:46,y:730,w:40,h:40};
  assert.deepEqual(flightPose(0,from,to),{...from,rotate:0,opacity:1});
  assert.deepEqual(flightPose(1,from,to),{...to,rotate:0,opacity:1});
  assert.equal(flightPose(1,from,to,true).opacity,0);
  for(let i=0;i<=1000;i++){const p=flightPose(i/1000,from,to);assert.ok(Object.values(p).every(Number.isFinite));assert.ok(p.w>0&&p.h>0&&p.opacity>=0&&p.opacity<=1);}
});
test('rail landing presses once, releases slowly, and never rotates or bounces above rest',()=>{
  let previous=1;
  for(let i=0;i<=1000;i++){
    const t=i/1000,p=settlePose(t);
    assert.equal(p.rotate,0);assert.ok(p.y>=0&&p.y<=1.6);
    assert.ok(p.sy>=.93-1e-10&&p.sy<=1);assert.ok(p.sx>=1&&p.sx<=1.055+1e-10);
    if(i<=300)assert.ok(p.sy<=previous+1e-10);else assert.ok(p.sy>=previous-1e-10);
    previous=p.sy;
  }
  const from={x:120,y:260,w:70,h:70},to={x:46,y:730,w:40,h:40};
  for(let i=440;i<=1000;i++){
    const p=flightPose(i/1000,from,to,false,true);
    assert.equal(p.x,to.x);assert.equal(p.rotate,0);assert.ok(p.y>=to.y-1e-10);
  }
  assert.ok(MOTION.pick*.56>=350,'the landing gets time to settle');
  assert.deepEqual(flightPose(1,from,to,false,true),{...to,rotate:0,opacity:1});
});

function appHarness(){
  let now=0;const data=new Map();
  const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
  const p={canvas:{getContext:()=>ctx},size:()=>({width:390,height:844,ratio:1,top:40,bottom:0}),get:k=>data.get(k),set:(k,v)=>{data.set(k,v);return true;},sound(){},effect(){},bind(){},now:()=>now,raf:()=>1,cancelRaf(){},musicReady(){},resource:x=>x,image:()=>Promise.resolve({width:1448,height:1086}),loadResources:()=>Promise.resolve()};
  const app=new CanvasApp(p);app.loading=false;app.session.start();app.render(now);
  return {app,step(ms){for(let elapsed=0;elapsed<ms;elapsed+=20){now+=20;app.frame();}}};
}
test('native rapid picks merge from current positions, gate crafting, and clean up when finished',()=>{
  const {app,step}=appHarness();
  for(let i=0;i<3;i++){const tile=getVisibleTiles(app.session.game).find(t=>t.ingredient==='rice');assert.ok(tile);app.pickTile(tile,{x:100,y:270,w:65,h:65});step(20);}
  assert.equal(app.session.game.harvests,1);assert.equal(app.flights.size,3);
  assert.ok([...app.flights.values()].every(f=>f.merge));
  assert.ok(app.mergeUntil>app.motionTime);
  const count=app.session.game.tiles.filter(t=>t.active).length;
  app.pickTile(getVisibleTiles(app.session.game)[0],{x:100,y:270,w:65,h:65});
  assert.equal(app.session.game.tiles.filter(t=>t.active).length,count,'merge cannot consume an accidental extra tap');
  step(MOTION.merge+MOTION.bounce+100);assert.equal(app.flights.size,0);assert.equal(app.pulses.size,0);
  assert.equal(getRailTiles(app.session.game).length,0);
});
test('native flight clocks pause in the background and cannot leave ghosts in another scene',()=>{
  const {app,step}=appHarness();const tile=app.session.game.tiles.find(t=>t.id===LEVELS[0].solution[0]);app.pickTile(tile,{x:100,y:270,w:65,h:65});step(80);
  const before=app.motionTime;app.hide();step(2000);assert.equal(app.motionTime,before);
  app.show();assert.equal(app.motionTime,before);step(MOTION.pick);assert.equal(app.flights.size,0);
  app.clearMotion();assert.equal(app.pulses.size,0);assert.equal(app.mergeUntil,0);
});
test('a grouped insert retargets older airborne cards to their new rail slots',()=>{
  const {app,step}=appHarness();
  for(const ingredient of ['salmon','rice','salmon']){
    const tile=getVisibleTiles(app.session.game).find(t=>t.ingredient===ingredient);
    app.pickTile(tile,{x:100,y:270,w:65,h:65});step(20);
  }
  const rail=getRailTiles(app.session.game);assert.deepEqual(rail.map(t=>t.ingredient),['salmon','salmon','rice']);
  rail.forEach((tile,index)=>assert.equal(app.flights.get(tile.id).to.x,app.railRect(index).x));
  step(MOTION.pick+MOTION.bounce+100);assert.equal(app.flights.size,0);
});
test('native rail arrival cannot start a second bounce after the flight settles',()=>{
  const {app,step}=appHarness();
  const tile=getVisibleTiles(app.session.game)[0];app.pickTile(tile,{x:100,y:270,w:65,h:65});
  step(MOTION.pick+20);assert.equal(app.flights.size,0);assert.equal(app.pulses.size,0);
  assert.equal(getRailTiles(app.session.game)[0].id,tile.id);
});

test('native delivery keeps tile and undo hit targets enabled, and moves during a concurrent merge',()=>{
  const {app,step}=appHarness();let index=0;
  for(;index<LEVELS[0].solution.length;index++){
    app.session.pick(LEVELS[0].solution[index]);app.session.tick(20);
    if(app.session.delivery){index++;break;}
  }
  app.render(0);const order=structuredClone(app.session.game.workbench.crafted),id=LEVELS[0].solution[index];
  const hit=app.hits.find(h=>h.key==='tile:'+id);assert.ok(hit?.action);hit.action();
  app.render(0);assert.ok(app.hits.some(h=>h.key?.startsWith('button:撤回')&&h.action));
  app.session.undo();app.clearMotion();
  const harvests=app.session.game.harvests;
  while(app.session.game.harvests===harvests){
    const id=LEVELS[0].solution[index++],tile=app.session.game.tiles.find(t=>t.id===id);
    assert.ok(tile);app.pickTile(tile,{x:100,y:270,w:65,h:65});
  }
  const before=app.session.delivery;assert.ok(app.motionTime<app.mergeUntil);
  step(100);assert.ok(app.session.delivery>before);assert.deepEqual(app.session.game.workbench.crafted,order);
  app.hide();const paused=app.session.delivery;step(500);assert.equal(app.session.delivery,paused);
});
