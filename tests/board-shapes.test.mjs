import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CAMPAIGN_LAYOUTS} from '../src/campaign-layouts.js';
import {LEVELS,createGame,getVisibleTiles,isTilePickable,selectTile,canCraftActive,craftActiveSushi,serveActiveCustomer} from '../src/game-core.js';
import {BOARD_SHAPES,shapeBoardFrame,drawShapeGuide,svgPath} from '../src/board-shapes.js';
import {shapeDesign} from '../scripts/shape-positions.mjs';

test('opening six boards alternate three authored silhouettes; days 7–24 are unchanged',()=>{
  assert.deepEqual(LEVELS.slice(0,6).map(l=>l.shape),['roll','fish','duo','roll','fish','duo']);
  assert.deepEqual(LEVELS.slice(0,6).map(l=>l.tiles.length),[18,24,24,30,33,33]);
  assert.equal(createHash('sha256').update(JSON.stringify(CAMPAIGN_LAYOUTS.slice(6))).digest('hex'),'b081b0f454da04843b546897d0c8a21602239c14e678e8dbc89d9f605d99429b');
  for(const l of LEVELS.slice(0,6)){
    const authored=shapeDesign(l.id,l.tiles.length);
    assert.deepEqual(l.tiles.map(({x,y,layer,tilt})=>({x,y,layer,tilt})),authored.positions);
    assert.equal(l.railLimit,7);assert.equal(l.layoutVersion,3);
    assert.ok(getVisibleTiles(createGame(l.id-1)).length>=6);
  }
});

test('shape cards stay inside their frame and no same-layer cards visually overlap',()=>{
  for(const l of LEVELS.slice(0,6))for(const t of l.tiles){
    assert.ok(t.x>=l.footprint.x/2&&t.x<=100-l.footprint.x/2);
    assert.ok(t.y>=l.footprint.y/2&&t.y<=100-l.footprint.y/2);
    for(const other of l.tiles.filter(o=>o!==t&&o.layer===t.layer))
      assert.ok(Math.abs(t.x-other.x)>=l.footprint.x||Math.abs(t.y-other.y)>=l.footprint.y,`${l.id}: ${t.id} and ${other.id}`);
  }
});

test('rolls have a ring and core, fish have a narrow neck, and duo recipes cross the plate gap',()=>{
  for(const l of LEVELS.slice(0,6)){
    const base=l.tiles.filter(t=>t.layer===0);
    if(l.shape==='roll'){
      assert.ok(base.some(t=>Math.hypot(t.x-50,t.y-48)<4));
      assert.ok(base.filter(t=>Math.hypot(t.x-50,t.y-48)>20).length>=8);
    }else if(l.shape==='fish'){
      assert.equal(base.filter(t=>t.x<20).length,3,'fan tail');
      assert.equal(base.filter(t=>t.x>20&&t.x<40).length,1,'narrow neck');
      assert.equal(base.filter(t=>t.x>80).length,2,'nose');
    }else{
      assert.ok(l.tiles.every(t=>Math.abs(t.x-50)>10),'visible central gap');
      const counts={};for(const t of l.tiles.filter(t=>t.x<50))counts[t.ingredient]=(counts[t.ingredient]||0)+1;
      assert.ok(Object.values(counts).filter(n=>n%3!==0).length>=2,'both plates must contribute to matches');
    }
  }
});

test('all six shape routes use real cover, seal and seven-slot rules, without undo',()=>{
  for(const l of LEVELS.slice(0,6)){
    let s=createGame(l.id-1);const original=structuredClone(s);
    for(const id of l.solution){
      assert.ok(isTilePickable(s,id));s=selectTile(s,id).state;assert.notEqual(s.status,'lost');assert.ok(s.rail.length<7);
      while(s.workbench.crafted||canCraftActive(s))s=s.workbench.crafted?serveActiveCustomer(s).state:craftActiveSushi(s).state;
    }
    assert.equal(s.status,'won');assert.equal(s.undoTokens,l.undoLimit);assert.equal(s.served,l.orders.length);
    assert.deepEqual(createGame(l.id-1),original,'retry preserves every position, ingredient and wrap');
  }
});

test('shared shape framing is bounded on short and tall phones and needs no native DOM or Path2D',()=>{
  for(const [shape,definition] of Object.entries(BOARD_SHAPES)){
    assert.ok(Object.isFrozen(definition));
    for(const bounds of [{x:0,y:0,w:296,h:196},{x:21,y:240,w:348,h:400}]){
      const frame=shapeBoardFrame(bounds,shape);
      assert.equal(frame.w,bounds.w);assert.ok(frame.y>=bounds.y&&frame.y+frame.h<=bounds.y+bounds.h);
      assert.ok(frame.w*.175>=44&&frame.h*.24>=44);
      const calls=[];const ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
      drawShapeGuide(ctx,shape,frame);assert.ok(calls.some(([method])=>method==='stroke'));
      for(const p of definition.paths)assert.match(svgPath(p.commands),/^M /);
    }
  }
  const classic={x:3,y:9,w:300,h:470};assert.deepEqual(shapeBoardFrame(classic),classic);
});
