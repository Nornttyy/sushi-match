import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../wechat/src/session.js';
import { LEVELS, getLevel, getVisibleTiles, canCraftActive, serveActiveCustomer } from '../src/game-core.js';
const platform=()=>{const data=new Map();return {get:k=>data.get(k),set:(k,v)=>{data.set(k,JSON.parse(JSON.stringify(v)));return true;},effect(){},sound(){}};};
function finishDelivery(s){
  // Interleaved boards can complete several queued recipes on the same pick.
  // Drain actual orders, not an assumed maximum of six deliveries.
  for(let i=0;i<1000&&(s.game.workbench.crafted||canCraftActive(s.game));i++)s.tick(50);
  assert.equal(s.delivery,0,'all ready orders finish before the next pick');
}

test('an old day-24 save keeps its progress and unlocks day 25 after completion',()=>{
  const p=platform();p.set('sushi-wechat-progress-v1',{selected:23,unlocked:23,bestWave:7,bestOrders:32,muted:true});
  const s=new Session(p);assert.equal(s.selected,23);assert.equal(s.unlocked,23);assert.equal(s.bestWave,7);assert.equal(s.muted,true);
  s.start();for(const id of LEVELS[23].solution){assert.equal(s.pick(id),true);finishDelivery(s);}
  assert.equal(s.unlocked,24);const wallet=s.shop.coins;s.advance();
  assert.equal(s.game.mode,'campaign');assert.equal(s.game.levelIndex,24);assert.equal(s.shop.coins,wallet);
  const restored=new Session(p);assert.equal(restored.selected,24);assert.equal(restored.unlocked,24);
});

test('WeChat uses the same 48 authored campaign levels, orders and rewards',()=>{
  const p=platform(),s=new Session(p);
  for(let level=0;level<LEVELS.length;level++){
    s.selected=level;assert.equal(s.start(),true);
    for(const id of LEVELS[level].solution){assert.equal(s.pick(id),true);finishDelivery(s);}
    assert.equal(s.game.status,'won');assert.equal(s.game.served,LEVELS[level].orders.length);
    assert.ok(s.shop.coins>=s.game.coins);
  }
  assert.equal(new Session(p).unlocked,LEVELS.length-1);
});
test('no duplicate reward when leaving during delivery or returning from the background',()=>{
  const p=platform(),s=new Session(p);s.mode='endless';s.start();
  for(const id of getLevel(s.game).solution){s.pick(id);s.tick(20);if(s.game.workbench.crafted)break;}
  assert.ok(s.game.workbench.crafted);assert.equal(s.shop.coins,0);
  s.menu();for(let i=0;i<100;i++)s.tick(50);assert.equal(s.shop.coins,0);
  s.start();finishDelivery(s);const wallet=s.shop.coins;assert.ok(wallet>0);
  finishDelivery(s);assert.equal(s.shop.coins,wallet);assert.equal(new Session(p).shop.coins,wallet);
});
test('locked days cannot start and storage failures stay visible instead of pretending to save',()=>{
  const s=new Session(platform());s.selected=23;assert.equal(s.start(),false);
  const broken=new Session({get(){return null;},set(){return false;},effect(){},sound(){}});assert.equal(broken.saved,false);
});

test('picking all 48 boards during delivery preserves every ingredient, order and reward',()=>{
  for(let level=0;level<LEVELS.length;level++){
    const s=new Session(platform()),reference=new Session(platform());
    for(const session of [s,reference]){session.unlocked=LEVELS.length-1;session.selected=level;session.start();}
    let picksInFlight=0;
    for(const id of LEVELS[level].solution){
      if(s.delivery)picksInFlight++;
      assert.equal(s.pick(id),true);s.tick(20);
      assert.equal(reference.pick(id),true);finishDelivery(reference);
    }
    finishDelivery(s);
    assert.ok(picksInFlight>0);assert.equal(s.game.status,'won');
    assert.equal(s.game.served,LEVELS[level].orders.length);assert.equal(s.game.rail.length,0);
    assert.ok(Object.values(s.game.pantry).every(n=>n===0));
    assert.equal(s.game.coins,reference.game.coins);assert.equal(s.shop.coins,reference.shop.coins);
    const wallet=s.shop.coins;finishDelivery(s);assert.equal(s.shop.coins,wallet);
  }
});

test('undo and new triples during a handoff retain its identity and do not consume its ingredients twice',()=>{
  const s=new Session(platform());s.start();let step=0;
  for(;step<LEVELS[0].solution.length;step++){s.pick(LEVELS[0].solution[step]);s.tick(20);if(s.delivery){step++;break;}}
  const order=structuredClone(s.game.workbench.crafted),delivery=s.delivery,pantry=structuredClone(s.game.pantry),harvests=s.game.harvests;
  const id=LEVELS[0].solution[step];assert.equal(s.pick(id),true);s.undo();
  assert.equal(s.game.tiles.find(t=>t.id===id).active,true);assert.deepEqual(s.game.pantry,pantry);
  assert.equal(s.delivery,delivery);assert.deepEqual(s.game.workbench.crafted,order);
  while(s.game.harvests===harvests)assert.equal(s.pick(LEVELS[0].solution[step++]),true);
  assert.equal(s.delivery,delivery);assert.deepEqual(s.game.workbench.crafted,order);
  s.tick(50,false);assert.equal(s.delivery,delivery+50,'existing handoff advances while a merge gates new crafting');
  for(const id of LEVELS[0].solution.slice(step))assert.equal(s.pick(id),true);
  finishDelivery(s);assert.equal(s.game.status,'won');assert.ok(Object.values(s.game.pantry).every(n=>n===0));
});

test('a full rail during delivery cancels payout, and restarting rejects the old order',()=>{
  const s=new Session(platform());s.start();
  for(const id of LEVELS[0].solution){s.pick(id);s.tick(20);if(s.delivery)break;}
  assert.ok(s.game.workbench.crafted);
  const ingredients=['rice','rice','salmon','salmon','tuna','tuna','shrimp'];
  s.game.tiles=ingredients.map((ingredient,i)=>({id:'fail-'+i,ingredient,active:i===6,layer:0,x:10+i*10,y:50,tilt:0}));
  s.game.rail=s.game.tiles.slice(0,6).map(t=>t.id);s.game.pickHistory=[...s.game.rail];
  const wallet=s.shop.coins;
  assert.equal(s.pick('fail-6'),true);assert.equal(s.game.status,'lost');assert.equal(s.delivery,0);
  for(let i=0;i<50;i++)s.tick(50);assert.equal(s.shop.coins,wallet);
  assert.equal(serveActiveCustomer(s.game).changed,false);
  s.advance();assert.equal(s.game.workbench.crafted,null);
  for(let i=0;i<50;i++)s.tick(50);assert.equal(s.shop.coins,wallet);
});

test('a dish cannot be applied to another customer even when their recipes match',()=>{
  const s=new Session(platform());s.start();
  for(const id of LEVELS[0].solution){s.pick(id);s.tick(20);if(s.delivery)break;}
  s.game.workbench.crafted.customerId='another-customer';
  assert.equal(serveActiveCustomer(s.game).changed,false);
});
test('WeChat endless loss, retry and fixed layouts preserve income and records',()=>{
  let lost;
  for(let attempt=0;attempt<50&&!lost;attempt++){
    const s=new Session(platform());s.mode='endless';s.start();let step=0;
    while(s.game.status==='playing'){const choices=getVisibleTiles(s.game);s.pick(choices[(attempt+step++*7)%choices.length].id);finishDelivery(s);}
    if(s.game.status==='lost')lost=s;
  }
  assert.ok(lost);const coins=lost.shop.coins;lost.advance();assert.equal(lost.game.status,'playing');assert.equal(lost.shop.coins,coins);
});
