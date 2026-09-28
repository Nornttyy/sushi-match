import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../wechat/src/session.js';
import { LEVELS, getLevel, getVisibleTiles, canCraftActive } from '../src/game-core.js';
const platform=()=>{const data=new Map();return {get:k=>data.get(k),set:(k,v)=>{data.set(k,JSON.parse(JSON.stringify(v)));return true;},effect(){},sound(){}};};
function finishDelivery(s){
  // Interleaved boards can complete several queued recipes on the same pick.
  // Drain actual orders, not an assumed maximum of six deliveries.
  for(let i=0;i<1000&&(s.game.workbench.crafted||canCraftActive(s.game));i++)s.tick(50);
  assert.equal(s.delivery,0,'all ready orders finish before the next pick');
}

test('WeChat uses the same 24 authored campaign levels, orders and rewards',()=>{
  const p=platform(),s=new Session(p);
  for(let level=0;level<LEVELS.length;level++){
    s.selected=level;assert.equal(s.start(),true);
    for(const id of LEVELS[level].solution){assert.equal(s.pick(id),true);finishDelivery(s);}
    assert.equal(s.game.status,'won');assert.equal(s.game.served,LEVELS[level].orders.length);
    assert.ok(s.shop.coins>=s.game.coins);
  }
  assert.equal(new Session(p).unlocked,23);
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
test('WeChat endless loss, retry and fixed layouts preserve income and records',()=>{
  let lost;
  for(let attempt=0;attempt<50&&!lost;attempt++){
    const s=new Session(platform());s.mode='endless';s.start();let step=0;
    while(s.game.status==='playing'){const choices=getVisibleTiles(s.game);s.pick(choices[(attempt+step++*7)%choices.length].id);finishDelivery(s);}
    if(s.game.status==='lost')lost=s;
  }
  assert.ok(lost);const coins=lost.shop.coins;lost.advance();assert.equal(lost.game.status,'playing');assert.equal(lost.shop.coins,coins);
});
