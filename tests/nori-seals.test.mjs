import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_SEALS, areSealNeighbours, getSealLayers, sealPeelPose, SEAL_MOTION_MS } from '../src/nori-seals.js';
import { LEVELS, createGame, createEndlessGame, getVisibleTiles, isTilePickable,
  selectTile, undoRailPick, canCraftActive, craftActiveSushi, serveActiveCustomer } from '../src/game-core.js';
import { outcomeSummary } from '../src/feedback.js';
import { CanvasApp } from '../wechat/src/canvas-app.js';

const tile = (id, ingredient, x, y, layer=0, sealed=false) => ({id,ingredient,x,y,layer,sealed,active:true,tilt:0});
function fixture() {
  const s=createGame(3);
  s.tiles=[tile('a','rice',14,22),tile('b','rice',14,51),tile('c','rice',86,80),
    tile('seal','tuna',38,22,0,true),tile('spare','salmon',62,51)];
  return s;
}
const pick=(s,id)=>selectTile(s,id).state;

test('a visible sealed card keeps its face but cannot be picked or mutated',()=>{
  const s=fixture(),before=structuredClone(s);
  assert.ok(getVisibleTiles(s).some(t=>t.id==='seal'));
  assert.equal(isTilePickable(s,'seal'),false);
  const r=selectTile(s,'seal');assert.equal(r.state,s);assert.equal(r.changed,false);assert.equal(r.reason,'sealed');
  assert.deepEqual(s,before);
});

test('an adjacent member already in the rail peels the seal only when its triple resolves',()=>{
  const original=fixture();let s=pick(original,'a');
  assert.equal(s.tiles.find(t=>t.id==='seal').sealed,true);
  s=pick(s,'b');assert.equal(s.tiles.find(t=>t.id==='seal').sealed,true);
  const r=selectTile(s,'c');
  assert.deepEqual(r.unsealed,['seal']);assert.equal(r.harvested,'rice');
  assert.equal(isTilePickable(r.state,'seal'),true);assert.equal(r.state.pantry.rice,1);
  assert.equal(original.tiles.find(t=>t.id==='seal').sealed,true,'immutable level state');
  assert.equal(original.coins,r.state.coins,'opening a seal creates no coins or bonus ingredients');
});

test('adjacency excludes diagonals, distant cards and different layers',()=>{
  const t=tile('seal','rice',38,51,2,true);
  for(const [x,y,layer,expected] of [[14,51,2,true],[62,51,2,true],[38,22,2,true],[38,80,2,true],
    [14,22,2,false],[86,51,2,false],[38,51,1,false],[62,51,3,false]]) {
    assert.equal(areSealNeighbours(t,tile('other','tuna',x,y,layer)),expected);
  }
  assert.equal(areSealNeighbours(t,t),false);
  const s=fixture();s.tiles.find(t=>t.id==='seal').x=62;
  const r=selectTile(pick(pick(s,'a'),'b'),'c');assert.deepEqual(r.unsealed,[]);
});

test('one triple can peel several seals, even a covered one; undo never re-seals',()=>{
  const s=fixture();s.tiles.push(tile('second','tuna',38,51,0,true),tile('cover','salmon',38,51,1));
  const r=selectTile(pick(pick(s,'a'),'b'),'c');assert.deepEqual(r.unsealed,['seal','second']);
  assert.equal(isTilePickable(r.state,'second'),false,'cover still matters');
  let next=pick(r.state,'seal');next=undoRailPick(next).state;
  assert.equal(isTilePickable(next,'seal'),true);assert.equal(next.tiles.find(t=>t.id==='seal').sealed,false);
  assert.equal(next.pantry.rice,1);assert.equal(next.harvests,1);
  assert.equal(createGame(3).tiles.filter(t=>t.sealed).length,2,'retry restores authored seals');
});

test('a blocked board ends explicitly instead of hanging with fewer than seven rail cards',()=>{
  const s=fixture();s.tiles=[tile('last','rice',86,80),tile('seal','tuna',14,22,0,true)];
  const r=selectTile(s,'last');assert.equal(r.state.status,'lost');assert.equal(r.state.failureReason,'sealed');
  const recap=outcomeSummary(r.state);assert.equal(recap.title,'封条挡住了食材');
  assert.equal(recap.failureLabel,'先用邻牌三消揭开封条');assert.equal(recap.rail.length,1);
  assert.equal(selectTile(r.state,'seal').changed,false);
});

test('fixed multi-wrap seals start on day 4, ramp from two to six cards, and every route wins',()=>{
  for(let i=0;i<LEVELS.length;i++){
    let s=createGame(i);const seals=s.tiles.filter(t=>t.sealed).map(t=>t.id),peeled=[];
    const layers=s.tiles.reduce((sum,t)=>sum+getSealLayers(t),0);let layerPeels=0;
    assert.equal(seals.length,i<3?0:i===3?2:i<6?3:i<12?4:i<18?5:6);
    assert.equal(Math.max(...s.tiles.map(getSealLayers)),i<3?0:i===3?1:i<18?2:3);
    assert.deepEqual(createGame(i).tiles,s.tiles);
    for(const id of LEVELS[i].solution){
      assert.equal(isTilePickable(s,id),true,`day ${i+1}, ${id}`);
      const r=selectTile(s,id);s=r.state;peeled.push(...r.unsealed);layerPeels+=r.peeled.length;
      assert.notEqual(s.status,'lost');assert.ok(s.rail.length<7);
      while(s.status==='playing'&&(s.workbench.crafted||canCraftActive(s)))s=s.workbench.crafted?serveActiveCustomer(s).state:craftActiveSushi(s).state;
    }
    assert.deepEqual(peeled.sort(),seals.sort());assert.equal(s.status,'won');
    assert.equal(layerPeels,layers,'each layer needs a separate neighbouring triple');
    assert.equal(s.undoTokens,LEVELS[i].undoLimit);assert.ok(s.tiles.every(t=>!t.active&&!t.sealed));
  }
  assert.ok(Object.isFrozen(CAMPAIGN_SEALS[4]));
  assert.ok(createEndlessGame().tiles.every(t=>!t.sealed),'endless remains free of seals');
});

test('three layers require three triples, undo preserves partial peeling, and retry restores all layers',()=>{
  let s=createGame(18);
  s.tiles=[tile('seal','nori',38,51,0,true),tile('spare','shrimp',38,80),
    tile('r1','rice',14,51),tile('r2','rice',14,80),tile('r3','rice',86,80),
    tile('s1','salmon',62,51),tile('s2','salmon',62,80),tile('s3','salmon',86,51),
    tile('t1','tuna',38,22),tile('t2','tuna',14,22),tile('t3','tuna',86,22)];
  s.tiles[0].sealLayers=3;
  for(const [index,prefix] of ['r','s','t'].entries()){
    const result=selectTile(pick(pick(s,prefix+'1'),prefix+'2'),prefix+'3');s=result.state;
    assert.deepEqual(result.peeled,[{id:'seal',band:2-index,remaining:2-index}]);
    assert.equal(getSealLayers(s.tiles[0]),2-index);
    assert.equal(isTilePickable(s,'seal'),index===2);
    assert.deepEqual(result.unsealed,index===2?['seal']:[]);
    if(index<2){
      assert.equal(selectTile(s,'seal').reason,'sealed');
      s=undoRailPick(pick(s,'spare')).state;
      assert.equal(getSealLayers(s.tiles[0]),2-index);
    }
  }
  assert.equal(selectTile(s,'seal').changed,true);
  assert.equal(Math.max(...createGame(18).tiles.map(getSealLayers)),3);
});

test('multiple neighbouring members in the same triple still remove only one layer per card',()=>{
  const s=fixture();s.tiles.find(t=>t.id==='seal').sealLayers=2;
  Object.assign(s.tiles.find(t=>t.id==='b'),{x:38,y:51});
  const result=selectTile(pick(pick(s,'a'),'b'),'c');
  assert.deepEqual(result.peeled,[{id:'seal',band:1,remaining:1}]);
  assert.deepEqual(result.unsealed,[]);assert.equal(isTilePickable(result.state,'seal'),false);
});

test('seal animation is a single bounded, monotonic peel without a second bounce',()=>{
  let previous=sealPeelPose(0);
  for(let i=1;i<=100;i++){
    const p=sealPeelPose(i/100);assert.ok(Object.values(p).every(Number.isFinite));
    assert.ok(p.y<=previous.y&&p.opacity<=previous.opacity&&p.sy<=previous.sy&&p.rotate<=previous.rotate);
    assert.ok(p.sy>0&&p.opacity>=0);previous=p;
  }
  assert.equal(sealPeelPose(1).opacity,0);assert.equal(SEAL_MOTION_MS,460);
});

test('native sealed hit boxes block taps, peel with the shared state, pause and clean up',()=>{
  let now=0;const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
  const p={canvas:{getContext:()=>ctx},size:()=>({width:390,height:844,ratio:1,top:40,bottom:0}),get(){},set(){return true;},sound(){},effect(){},bind(){},now:()=>now,raf:()=>1,cancelRaf(){},musicReady(){},resource:x=>x,image:()=>Promise.resolve({width:1448,height:1086}),loadResources:()=>Promise.resolve()};
  const app=new CanvasApp(p);app.loading=false;app.session.unlocked=23;app.session.selected=3;app.session.start();
  app.session.game=fixture();app.session.game.tiles.find(t=>t.id==='seal').sealLayers=2;app.render(0);
  const sealed=app.session.game.tiles.find(t=>t.sealed);
  assert.ok(!app.hits.some(h=>h.key==='tile:'+sealed.id));
  const before=app.session.game;app.pickTile(sealed,{x:80,y:200,w:60,h:60});assert.equal(app.session.game,before);
  app.session.pick('a');app.session.pick('b');
  app.pickTile(app.session.game.tiles.find(t=>t.id==='c'),{x:80,y:200,w:60,h:60});
  assert.equal(getSealLayers(app.session.game.tiles.find(t=>t.id===sealed.id)),1);
  assert.ok(app.sealPeels.has(sealed.id));app.render(0);
  assert.equal(app.sealPeels.get(sealed.id).band,1);
  assert.ok(!app.hits.some(h=>h.key==='tile:'+sealed.id),'partially peeled card stays locked');
  app.hide();now+=1000;app.frame();assert.equal(app.motionTime,0);
  app.show();assert.equal(app.sealPeels.size,0,'resume resize clears stale visual overlays, not game state');
  assert.equal(getSealLayers(app.session.game.tiles.find(t=>t.id===sealed.id)),1);
  app.sealPeels.set(sealed.id,{start:app.motionTime,band:1});
  for(let elapsed=0;elapsed<SEAL_MOTION_MS+50;elapsed+=20){now+=20;app.frame();}
  assert.equal(app.sealPeels.size,0);
  app.clearMotion();assert.equal(app.sealPeels.size,0);
});
