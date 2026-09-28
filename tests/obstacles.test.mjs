import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS,createGame,getCampaignLevel,isTilePickable,selectTile,undoRailPick,canCraftActive,craftActiveSushi,serveActiveCustomer,getTileCoverDepths } from '../src/game-core.js';
import { isObstacleLocked,obstacleLabel,boardObstacleHint } from '../src/obstacles.js';
import { obstacleArt,drawObstacleArt } from '../src/obstacle-art.js';
import { outcomeSummary } from '../src/outcome-core.js';
import { Session } from '../wechat/src/session.js';
import { CanvasApp } from '../wechat/src/canvas-app.js';

function fixture(){
  const s=createGame(0);
  s.tiles=['tuna','rice','rice','rice','salmon','salmon','salmon','shrimp'].map((ingredient,i)=>({id:'f'+i,ingredient,layer:0,x:10+i%4*24,y:20+Math.floor(i/4)*30,tilt:0,active:true}));
  return s;
}
const pick=(s,id)=>{const r=selectTile(s,id);assert.ok(r.changed,id);return r.state;};
const triple=(s,start)=>[0,1,2].reduce((s,n)=>pick(s,'f'+(start+n)),s);
const settle=s=>{while(canCraftActive(s))s=serveActiveCustomer(craftActiveSushi(s).state).state;return s;};

test('visible ice blocks input without mutation; each real triple melts one layer',()=>{
  let s=fixture();s.tiles[0].obstacle={kind:'ice',remaining:2};const before=structuredClone(s);
  assert.equal(isTilePickable(s,'f0'),false);assert.equal(selectTile(s,'f0').reason,'obstacle');assert.deepEqual(s,before);
  s=pick(s,'f1');s=pick(s,'f2');assert.equal(s.tiles[0].obstacle.remaining,2);
  const r=selectTile(s,'f3');s=r.state;
  assert.deepEqual(r.obstacleChanges,[{id:'f0',kind:'ice',remaining:1}]);assert.equal(isTilePickable(s,'f0'),false);
  s=undoRailPick(pick(s,'f7')).state;assert.equal(s.tiles[0].obstacle.remaining,1);
  s=triple(s,4);assert.equal(isTilePickable(s,'f0'),true);assert.equal(s.tiles[0].obstacle.remaining,0);
  assert.equal(obstacleArt(s.tiles[0]).length,0);
});

test('removing a covering card never melts ice underneath on that same match',()=>{
  let s=fixture();s.tiles[0].obstacle={kind:'ice',remaining:1};
  Object.assign(s.tiles[3],{x:s.tiles[0].x,y:s.tiles[0].y,layer:1});
  s=triple(s,1);assert.equal(s.tiles[0].obstacle.remaining,1);assert.equal(getTileCoverDepths(s).get('f0'),0);
  s=triple(s,4);assert.equal(s.tiles[0].obstacle.remaining,0);
});

test('ice already exposed before a match thaws even away from that triple',()=>{
  let s=fixture();s.tiles[0].obstacle={kind:'ice',remaining:1};s.tiles[0].layer=2;
  s=triple(s,4);assert.equal(s.tiles[0].obstacle.remaining,0);
});

test('numbered key opens only matching locks; undo returns food, not a second key',()=>{
  let s=fixture();s.tiles[0].obstacle={kind:'lock',key:1,open:false};s.tiles[4].obstacle={kind:'lock',key:2,open:false};s.tiles[1].key=1;
  const initial=structuredClone(s);const r=selectTile(s,'f1');s=r.state;
  assert.deepEqual(initial.tiles[0].obstacle,{kind:'lock',key:1,open:false});
  assert.equal(isTilePickable(s,'f0'),true);assert.equal(isTilePickable(s,'f4'),false);
  assert.deepEqual(r.obstacleChanges,[{id:'f0',kind:'lock',remaining:0}]);
  s=undoRailPick(s).state;assert.equal(s.tiles[1].active,true);assert.equal(s.tiles[1].keyUsed,true);
  assert.equal(obstacleLabel(s.tiles[1]),'');assert.equal(obstacleArt(s.tiles[1]).length,0);
  assert.equal(selectTile(s,'f1').obstacleChanges.length,0);assert.equal(isTilePickable(s,'f0'),true);
});

test('delivery boxes wait for served orders, not harvested triples or crafting',()=>{
  let s=fixture();s.tiles[0].obstacle={kind:'crate',orders:1};
  s=triple(s,1);s=triple(s,4);assert.equal(isTilePickable(s,'f0'),false);
  s=craftActiveSushi(s).state;assert.equal(isTilePickable(s,'f0'),false);
  const r=serveActiveCustomer(s);s=r.state;assert.equal(isTilePickable(s,'f0'),true);
  assert.equal(serveActiveCustomer(s).changed,false);assert.equal(s.served,1);
  assert.equal(obstacleLabel(s.tiles[0],s.served),'');assert.equal(obstacleArt(s.tiles[0],s.served).length,0);
});

test('a board with only boxes waits for queued delivery; genuine deadlocks lose afterwards',()=>{
  for(const orders of [1,2]){
    let s=fixture();s.tiles=s.tiles.slice(0,2);s.tiles[0].obstacle={kind:'crate',orders};
    s.customers=[{id:'c1',order:'salmon',status:'waiting'},{id:'c2',order:'salmon',status:'waiting'}];
    s.pantry.rice=1;s.pantry.salmon=1;s=pick(s,'f1');
    assert.equal(s.status,'playing');s=craftActiveSushi(s).state;assert.equal(s.status,'playing');
    s=serveActiveCustomer(s).state;
    assert.equal(s.status,orders===1?'playing':'lost');
    if(orders===2){assert.equal(s.failureReason,'obstacle');assert.match(outcomeSummary(s).title,/机关/);}
  }
});

test('a second already-prepared order is allowed to open a two-order box',()=>{
  let s=fixture();s.tiles=s.tiles.slice(0,2);s.tiles[0].obstacle={kind:'crate',orders:2};
  s.customers=[{id:'c1',order:'salmon',status:'waiting'},{id:'c2',order:'salmon',status:'waiting'}];
  s.pantry.rice=2;s.pantry.salmon=2;s=pick(s,'f1');s=settle(s);
  assert.equal(s.served,2);assert.equal(s.status,'playing');assert.ok(isTilePickable(s,'f0'));
});

test('introductions are spaced, later kinds rotate, and lightweight days remain',()=>{
  assert.ok(LEVELS.slice(0,6).every(l=>!l.obstacleKinds));
  assert.deepEqual(LEVELS[6].obstacleKinds,['ice']);assert.deepEqual(LEVELS[10].obstacleKinds,['lock']);assert.deepEqual(LEVELS[14].obstacleKinds,['crate']);
  assert.deepEqual(new Set(LEVELS[30].obstacleKinds),new Set(['ice','lock','crate']));assert.equal(LEVELS[23].obstacleKinds,undefined);
  for(const level of [...LEVELS,...Array.from({length:60},(_,i)=>getCampaignLevel(i+48)),getCampaignLevel(622)]){
    for(const t of level.tiles){
      if(t.obstacle){assert.equal(t.sealed,false);assert.ok(!t.key);}
      if(t.obstacle?.kind==='lock')assert.ok(level.tiles.some(k=>k.key===t.obstacle.key));
    }
    let s=createGame(level.id-1);const seen=new Set();
    for(const id of level.solution){
      for(const [tileId,depth] of getTileCoverDepths(s))if(!depth&&isObstacleLocked(s.tiles.find(t=>t.id===tileId),s.served))seen.add(tileId);
      s=settle(pick(s,id));
    }
    assert.equal(s.status,'won');
    for(const t of level.tiles.filter(t=>t.obstacle))assert.ok(seen.has(t.id),'each obstacle must actually appear locked: '+t.id);
    assert.deepEqual(createGame(level.id-1).tiles,level.tiles);
  }
});

test('shared art and short hints need no emoji font, DOM, Path2D or external assets in Canvas',()=>{
  for(const obstacle of [{kind:'ice',remaining:1},{kind:'ice',remaining:2},{kind:'lock',key:1,open:false},{kind:'crate',orders:2}]){
    const tile={id:'art',active:true,obstacle},calls=[];
    const ctx=new Proxy({},{get:(_,k)=>(...v)=>calls.push([k,...v]),set:()=>true});
    drawObstacleArt(ctx,tile,0,0,0,50,55);assert.ok(calls.some(([k])=>k==='stroke'));
    assert.ok(obstacleArt(tile).length>2);assert.ok(obstacleLabel(tile));
    assert.ok(boardObstacleHint({tiles:[tile],served:0},new Set(['art'])));
    assert.equal(boardObstacleHint({tiles:[tile],served:0},new Set()),'');
  }
});

function platform(){return {canvas:{getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})},size:()=>({width:390,height:844,ratio:1,top:40,bottom:0}),get(){},set(){return true;},effect(){},sound(){},bind(){},now:()=>0,raf:()=>1,cancelRaf(){},musicReady(){},resource:x=>x,image:()=>Promise.resolve({width:100,height:100}),loadResources:()=>Promise.resolve()};}

test('native canvas removes blocked hit targets, including exposed ice, locks and boxes',()=>{
  const app=new CanvasApp(platform());app.loading=false;app.session.unlocked=30;
  for(const day of [7,11,15,23]){
    app.session.selected=day-1;app.session.start();app.render(0);
    for(const tile of app.session.game.tiles.filter(t=>t.obstacle)){
      assert.equal(app.hits.some(h=>h.key==='tile:'+tile.id),false);
      const before=app.session.game;app.pickTile(tile,{x:40,y:200,w:50,h:50});assert.equal(app.session.game,before);
    }
  }
});

test('native delivery continues with only a box left and pays exactly once',()=>{
  const session=new Session(platform());session.start();let s=fixture();s.tiles=s.tiles.slice(0,2);s.tiles[0].obstacle={kind:'crate',orders:1};s.pantry.rice=1;s.pantry.salmon=1;
  session.game=s;session.pick('f1');session.tick(20);const before=session.shop.coins;
  assert.equal(session.game.status,'playing');assert.ok(session.delivery>0);
  for(let i=0;i<30;i++)session.tick(50);
  assert.ok(isTilePickable(session.game,'f0'));assert.equal(session.shop.coins,before+18);
});
