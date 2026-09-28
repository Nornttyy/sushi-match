import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { LEVELS, RECIPES, getCampaignLevel, createGame, getLevel, selectTile, getVisibleTiles,
  canCraftActive, craftActiveSushi, serveActiveCustomer, advanceGameTime,
  normalizeCampaignIndex, campaignPreviewLastPage } from '../src/game-core.js';
import { generateCampaignRecord, campaignSeed } from '../src/campaign-generator.js';
import { layoutMixMetrics } from '../src/level-generator.js';
import { outcomeSummary } from '../src/outcome-core.js';
import { Session } from '../wechat/src/session.js';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function settle(s){
  while(canCraftActive(s))s=serveActiveCustomer(craftActiveSushi(s).state).state;
  return s;
}
function complete(state){
  const definition=getLevel(state);
  for(const id of definition.solution){
    state=advanceGameTime(state,2500).state;
    const picked=selectTile(state,id);assert.equal(picked.changed,true,`${definition.id}: ${id}`);
    state=settle(picked.state);assert.notEqual(state.status,'lost',String(definition.id));
  }
  assert.equal(state.status,'won');assert.equal(state.rail.length,0);
  assert.equal(state.served,definition.orders.length);assert.ok(state.tiles.every(t=>!t.active&&!t.sealed));
  assert.ok(Object.values(state.pantry).every(n=>n===0));assert.ok(state.timeRemainingMs>0);
  const income=definition.orders.reduce((n,id,i)=>n+RECIPES[id].tip+Math.min(5,i)*4,0);
  assert.equal(state.coins,income);return state;
}

test('continuous campaign retains authored days and regenerates the same deal after cache eviction',()=>{
  assert.equal(LEVELS.length,48);
  for(let i=0;i<48;i++)assert.equal(getCampaignLevel(i),LEVELS[i]);
  const first=getCampaignLevel(48),snapshot=digest(first);
  assert.equal(snapshot,'3d656b5be895a0708b0bf29c9d6da9e237d2177b6eb31bd3e08628ce6f0c0673','version 1 saves must not silently receive a new deal');
  for(let i=49;i<70;i++)getCampaignLevel(i);
  const regenerated=getCampaignLevel(48);
  assert.notEqual(first,regenerated,'visited definitions are evicted from a bounded cache');
  assert.equal(digest(regenerated),snapshot);assert.ok(Object.isFrozen(regenerated.tiles[0]));
  const state=createGame(48);state.tiles[0].ingredient='rice';state.coins=999;
  assert.equal(digest(getCampaignLevel(48)),snapshot);
  assert.deepEqual(createGame(48),createGame(48));
  assert.notEqual(campaignSeed(48),campaignSeed(48+2**32));
  for(const bad of [NaN,Infinity,-Infinity,-4,undefined])assert.equal(normalizeCampaignIndex(bad),0);
  assert.equal(normalizeCampaignIndex(1000000.9),1000000);
});

test('first 200 generated days and distant days all win with real seals, timing and exact rewards',()=>{
  const indexes=[...Array.from({length:200},(_,i)=>48+i),999,9999,999999,2**32+48];
  const geometry=new Set(),shapes=new Set(),depths=new Set();let fallbacks=0;
  for(const index of indexes){
    const l=getCampaignLevel(index);assert.equal(l.id,index+1);
    assert.ok(l.tiles.length>=60&&l.tiles.length<=84);assert.ok(l.layers.length<=8);
    assert.ok(l.layers.every(n=>n>=3));assert.equal(l.railLimit,7);
    assert.equal(new Set(l.solution).size,l.tiles.length);
    assert.ok(l.tiles.filter(t=>t.sealed).length>=3);
    for(const t of l.tiles){
      assert.ok(t.x-l.footprint.x/2>=0&&t.x+l.footprint.x/2<=100);
      assert.ok(t.y-l.footprint.y/2>=0&&t.y+l.footprint.y/2<=100);
      if(t.sealed)assert.ok(t.sealLayers>=1&&t.sealLayers<=3);
      for(const other of l.tiles)if(t!==other&&t.layer===other.layer)
        assert.ok(Math.abs(t.x-other.x)+1e-8>=l.footprint.x||Math.abs(t.y-other.y)+1e-8>=l.footprint.y);
    }
    const mix=layoutMixMetrics(l.tiles,l.footprint);assert.ok(mix.largestCluster<=2);assert.equal(mix.dominance,0);
    complete(createGame(index));
    if(index<248){
      geometry.add(digest(l.tiles.map(t=>[t.layer,t.x,t.y])));shapes.add(l.shape);depths.add(l.layers.length);
      fallbacks+=!!l.generationFallback;
    }
  }
  assert.ok(geometry.size>160,'new geometry, not just cycling the old 48 boards');
  assert.equal(shapes.size,10);assert.ok(depths.size>=3);assert.ok(fallbacks<40);
});

test('bounded fallback preserves a proven cover/seal route and recipe identities',()=>{
  for(let index=48;index<76;index++){
    const r=generateCampaignRecord(index,RECIPES,{fallback:true});
    const sealed=new Map(r.seals),tiles=r.cards.map(([ingredient,layer,x,y,tilt],i)=>({id:'fallback-'+i,ingredient,layer,x,y,tilt,active:true,sealed:sealed.has(i),sealLayers:sealed.get(i)||0}));
    const definition={...r,tiles,solution:r.solution.map(i=>tiles[i].id)};
    const state={...createGame(index),definition,tiles,timeRemainingMs:270000,
      customers:r.orders.map((order,i)=>({id:'customer-'+i,skin:'ginger',status:'waiting',order}))};
    complete(state);
  }
});

test('late campaign is not an automatic win and losing never changes a retry layout',()=>{
  let lost;
  for(let attempt=0;attempt<30&&!lost;attempt++){
    let state=createGame(52),step=0;
    while(state.status==='playing'){
      const choices=getVisibleTiles(state).filter(t=>!t.sealed);assert.ok(choices.length);
      state=settle(selectTile(state,choices[(attempt+step++*7)%choices.length].id).state);
    }
    if(state.status==='lost')lost=state;
  }
  assert.ok(lost);assert.equal(digest(createGame(52).tiles),digest(getCampaignLevel(52).tiles));
  assert.equal(outcomeSummary(lost).primary,'再试一次');
});

test('native campaign crosses 48, 49 and 50 without resetting wallet or switching mode',()=>{
  const data=new Map([['sushi-wechat-progress-v1',{selected:47,unlocked:47,bestWave:9,bestOrders:100,muted:true}]]);
  const platform={get:k=>data.get(k),set:(k,v)=>{data.set(k,structuredClone(v));return true;},effect(){},sound(){}};
  let s=new Session(platform);s.start();
  for(let index=47;index<51;index++){
    assert.equal(s.game.levelIndex,index);const wallet=s.shop.coins;let picksDuringDelivery=0;
    for(const id of s.level.solution){if(s.delivery)picksDuringDelivery++;assert.ok(s.pick(id));s.tick(20);}
    for(let n=0;n<1000&&s.game.status==='playing';n++)s.tick(50);
    assert.equal(s.game.status,'won');assert.ok(picksDuringDelivery>0);assert.equal(s.unlocked,index+1);
    assert.equal(s.shop.coins,wallet+s.game.coins);assert.equal(outcomeSummary(s.game).primary,'下一关');
    const coins=s.shop.coins;s.advance();assert.equal(s.game.mode,'campaign');assert.equal(s.mode,'campaign');
    assert.equal(s.game.levelIndex,index+1);assert.equal(s.shop.coins,coins);
    s=new Session(platform);assert.equal(s.selected,index+1);assert.equal(s.bestWave,9);assert.equal(s.muted,true);s.start();
  }
  data.set('sushi-wechat-progress-v1',{selected:999,unlocked:1000});s=new Session(platform);s.start();
  assert.equal(s.level.id,1000);assert.equal(s.unlocked,1000);
  const cards=structuredClone(s.game.tiles),coins=s.shop.coins;s.game.status='lost';s.advance();
  assert.deepEqual(s.game.tiles,cards);assert.equal(s.shop.coins,coins);
});

test('level pagination has no total, stays bounded near progress and never mounts an infinite list',()=>{
  assert.equal(campaignPreviewLastPage(0),1);assert.equal(campaignPreviewLastPage(47),16);
  assert.equal(campaignPreviewLastPage(48),17);assert.equal(campaignPreviewLastPage(999999),333334);
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(main,/LEVELS\.length|lastLevelIndex/);
  assert.match(main,/normalizeCampaignIndex\(readStoredLevel/);
  assert.match(main,/campaignPreviewLastPage\(unlockedLevel\)/);
  assert.doesNotMatch(html,/闯关 · 48 天|1–3 \/ 48/);
  assert.equal((html.match(/class="menu-day(?: |")/g)||[]).length,3);
});
