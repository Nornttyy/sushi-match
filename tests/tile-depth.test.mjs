import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createEndlessGame, getLevel, getVisibleTiles, getTileCoverDepths,
  selectTile, undoRailPick, canCraftActive, craftActiveSushi, serveActiveCustomer } from '../src/game-core.js';
import { tileDepthAppearance } from '../src/tile-depth.js';
import { CanvasApp } from '../wechat/src/canvas-app.js';

const tile=(id,layer,x=45,y=50)=>({id,layer,x,y,active:true,ingredient:'rice',tilt:0,sealed:false,sealLayers:0});

test('buried depth follows overlapping chains, not layer numbers or unrelated piles',()=>{
  const state=createGame();
  state.tiles=[tile('low',0),tile('mid',3),tile('top',7),tile('neighbour',0,90),tile('same-row',7,70)];
  const snapshot=structuredClone(state);
  assert.deepEqual([...getTileCoverDepths(state)], [['top',0],['same-row',0],['mid',1],['low',2],['neighbour',0]]);
  assert.deepEqual(state,snapshot,'rendering never mutates the game or its tile order');
  state.tiles[2].active=false;
  assert.equal(getTileCoverDepths(state).get('mid'),0);assert.equal(getTileCoverDepths(state).get('low'),1);
  // A shifted chain still has depth, even if its outermost ends do not overlap.
  state.tiles=[tile('low',0,20),tile('mid',1,32),tile('top',2,44)];
  assert.equal(getTileCoverDepths(state).get('low'),2);
  state.tiles[1].active=false;assert.equal(getTileCoverDepths(state).get('low'),0);
});

test('eight layers darken progressively without losing opaque colour or crushing to black',()=>{
  const state=createGame();state.tiles=Array.from({length:8},(_,i)=>tile('layer-'+i,i));
  const depths=getTileCoverDepths(state);
  assert.deepEqual(state.tiles.map(t=>depths.get(t.id)),[7,6,5,4,3,2,1,0]);
  let previous=2;
  for(let depth=0;depth<=7;depth++){
    const appearance=tileDepthAppearance(depth);assert.ok(appearance.brightness<previous);
    previous=appearance.brightness;assert.ok(appearance.brightness>=.4);
    for(const colour of [appearance.face,appearance.side,appearance.border])assert.match(colour,/^#[0-9a-f]{6}$/);
    assert.ok(Object.isFrozen(appearance));
  }
  assert.equal(tileDepthAppearance(0).brightness,1);assert.equal(tileDepthAppearance(99),tileDepthAppearance(7));
  for(const invalid of [-1,NaN,undefined,Infinity])assert.equal(tileDepthAppearance(invalid),tileDepthAppearance(0));
});

test('exposure restores full brightness and undo restores depth, regardless of nori',()=>{
  const state=createGame();state.tiles=[tile('bottom',0),tile('top',1),tile('free',0,90)];state.tiles[0].sealed=true;state.tiles[0].sealLayers=2;
  const after=selectTile(state,'top').state;
  assert.equal(getTileCoverDepths(after).get('bottom'),0,'exposed sealed food remains bright');
  assert.equal(getTileCoverDepths(after).has('top'),false,'rail food never casts a shadow');
  const undone=undoRailPick(after).state;
  assert.equal(getTileCoverDepths(undone).get('bottom'),1);
  assert.equal(getTileCoverDepths(undone).get('top'),0);
});

test('visual depth agrees with real exposure throughout authored, generated and endless games',()=>{
  for(let state of [createGame(),createGame(18),createGame(47),createGame(48),createGame(54),createEndlessGame()]){
    for(const id of getLevel(state).solution){
      const depths=getTileCoverDepths(state);
      assert.deepEqual([...depths].filter(([,d])=>d===0).map(([id])=>id).sort(),getVisibleTiles(state).map(t=>t.id).sort());
      assert.ok([...depths.values()].every(d=>Number.isInteger(d)&&d>=0&&d<=7));
      state=selectTile(state,id).state;
      while(canCraftActive(state))state=serveActiveCustomer(craftActiveSushi(state).state).state;
    }
    assert.equal(state.status,'won');assert.equal(getTileCoverDepths(state).size,0);
  }
});

test('native renderer applies the shared opaque palette only to covered cards',()=>{
  const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
  const p={canvas:{getContext:()=>ctx},size:()=>({width:390,height:844,ratio:1,top:40,bottom:0}),get(){},set(){return true;},sound(){},effect(){},bind(){},now:()=>0,raf:()=>1,cancelRaf(){},musicReady(){},resource:x=>x,image:()=>Promise.resolve({width:1448,height:1086}),loadResources:()=>Promise.resolve()};
  const app=new CanvasApp(p);app.loading=false;app.session.start();
  app.session.game.tiles=Array.from({length:8},(_,i)=>tile('layer-'+i,i));
  const faces=new Map(),foods=[],box=app.box.bind(app);let current;
  app.elastic=(key,x,y,w,h,draw)=>{current=key;draw();current=null;};
  app.box=(...args)=>{if(current?.startsWith('tile:')&&args[5]===10)faces.set(current,args[4]);return box(...args);};
  app.food=(kind,food)=>{if(current?.startsWith('tile:'))foods.push(current);};
  app.drawGame();
  for(let layer=0;layer<7;layer++)assert.equal(faces.get('tile:layer-'+layer),tileDepthAppearance(7-layer).face);
  assert.equal(faces.get('tile:layer-7'),'#fffcf0');assert.deepEqual(foods,['tile:layer-7']);
  assert.equal(app.hits.filter(h=>h.key?.startsWith('tile:')).length,1);
});
