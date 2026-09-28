import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CAMPAIGN_LAYOUTS} from '../src/campaign-layouts.js';
import {LEVELS,createGame,getVisibleTiles,isTilePickable,selectTile,canCraftActive,craftActiveSushi,serveActiveCustomer} from '../src/game-core.js';
import {BOARD_SHAPES,shapeBoardFrame,drawShapeGuide,svgPath} from '../src/board-shapes.js';
import {shapeDesign} from '../scripts/shape-positions.mjs';

test('all 48 boards use authored silhouettes, preserving the opening and old campaign economy',()=>{
  assert.deepEqual(LEVELS.slice(0,6).map(l=>l.shape),['roll','fish','duo','roll','fish','duo']);
  assert.deepEqual(LEVELS.slice(6,24).map(l=>l.shape),Array.from({length:3},()=>['roll','fish-left','duo-stagger','roll-wide','fish','duo']).flat());
  assert.deepEqual(LEVELS.slice(24).map(l=>l.shape),Array.from({length:6},()=>['boat','flower','fan','bento']).flat());
  assert.deepEqual(LEVELS.slice(0,24).map(l=>l.tiles.length),[18,24,24,30,33,33,42,42,45,51,54,51,60,60,60,69,69,66,75,75,75,75,75,75]);
  const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
  assert.equal(hash(CAMPAIGN_LAYOUTS.slice(0,6)),'320d5110b85e28eca34da235e069a50e048e79b6a62c43ef849e89b977223914');
  assert.equal(hash(CAMPAIGN_LAYOUTS.slice(0,24).map(l=>({id:l.id,orders:l.orders,railLimit:l.railLimit,undoLimit:l.undoLimit}))),
    '86fcec05d946dc1d69c7588f9ecc8218c458bf4ec605653a9e3fcf243ad2b0e3');
  for(const l of LEVELS){
    const authored=shapeDesign(l.id,l.tiles.length);
    assert.deepEqual(l.tiles.map(({x,y,layer,tilt})=>({x,y,layer,tilt})),authored.positions);
    assert.equal(l.railLimit,7);assert.equal(l.layoutVersion,l.id<=6?3:l.id>24||[19,22].includes(l.id)?5:4);
    assert.ok(l.layers.length<=8);assert.ok(l.tiles.every(t=>t.layer>=0&&t.layer<8));
    assert.ok(getVisibleTiles(createGame(l.id-1)).length>=6);
  }
});

test('shape cards stay inside their frame and no same-layer cards visually overlap',()=>{
  for(const l of LEVELS)for(const t of l.tiles){
    assert.ok(t.x>=l.footprint.x/2&&t.x<=100-l.footprint.x/2);
    assert.ok(t.y>=l.footprint.y/2&&t.y<=100-l.footprint.y/2);
    for(const other of l.tiles.filter(o=>o!==t&&o.layer===t.layer))
      assert.ok(Math.abs(t.x-other.x)>=l.footprint.x||Math.abs(t.y-other.y)>=l.footprint.y,`${l.id}: ${t.id} and ${other.id}`);
  }
});

test('rolls have a ring and core, fish have a narrow neck, and duo recipes cross the plate gap',()=>{
  for(const l of LEVELS){
    const base=l.tiles.filter(t=>t.layer===([19,22].includes(l.id)?1:0));
    if(l.shape.startsWith('roll')){
      const cy=l.shape==='roll-wide'?50:48;
      assert.ok(base.some(t=>Math.hypot(t.x-50,t.y-cy)<5));
      assert.ok(base.filter(t=>Math.hypot(t.x-50,t.y-cy)>20).length>=8);
    }else if(l.shape.startsWith('fish')){
      const xs=base.map(t=>l.shape==='fish-left'?100-t.x:t.x);
      assert.equal(xs.filter(x=>x<20).length,3,'fan tail');
      assert.equal(xs.filter(x=>x>20&&x<40).length,1,'narrow neck');
      assert.equal(xs.filter(x=>x>80).length,2,'nose');
    }else if(l.shape.startsWith('duo')){
      assert.ok(l.tiles.every(t=>Math.abs(t.x-50)>10),'visible central gap');
      const counts={};for(const t of l.tiles.filter(t=>t.x<50))counts[t.ingredient]=(counts[t.ingredient]||0)+1;
      assert.ok(Object.values(counts).filter(n=>n%3!==0).length>=2,'both plates must contribute to matches');
    }
  }
});

test('all 48 shape routes use real cover, seal and seven-slot rules, without undo',()=>{
  for(const l of LEVELS){
    let s=createGame(l.id-1);const original=structuredClone(s),firstPeels=new Set();
    for(const id of l.solution){
      assert.ok(isTilePickable(s,id));const result=selectTile(s,id);
      for(const peel of result.peeled)if(!firstPeels.has(peel.id)){
        assert.ok(getVisibleTiles(s).some(t=>t.id===peel.id),`day ${l.id}: show the full wrap before its first peel`);
        firstPeels.add(peel.id);
      }
      s=result.state;assert.notEqual(s.status,'lost');assert.ok(s.rail.length<7);
      while(s.workbench.crafted||canCraftActive(s))s=s.workbench.crafted?serveActiveCustomer(s).state:craftActiveSushi(s).state;
    }
    assert.equal(s.status,'won');assert.equal(s.undoTokens,l.undoLimit);assert.equal(s.served,l.orders.length);
    assert.deepEqual(createGame(l.id-1),original,'retry preserves every position, ingredient and wrap');
  }
});

test('four new silhouettes have distinct authored footprints and balanced partial upper layers',()=>{
  assert.deepEqual([25,26,27,28].map(day=>shapeDesign(day,75).positions.filter(t=>t.layer===0).length),[11,12,10,16]);
  for(const l of LEVELS.slice(24)){
    const top=l.tiles.filter(t=>t.layer===l.layers.length-1);
    assert.ok(top.some(t=>t.x<50)&&top.some(t=>t.x>50),'caps span both sides');
    assert.ok(l.tiles.length>=75&&l.tiles.length<=84);
  }
  assert.throws(()=>shapeDesign(27,81),/eight-layer/);
  assert.equal(LEVELS[18].layers.length,8);assert.equal(LEVELS[21].layers.length,8);
});

test('later variants alter the real geometry and layer offsets, not just the tray artwork',()=>{
  const positions=(day,count)=>shapeDesign(day,count).positions;
  assert.deepEqual(positions(8,12).map(t=>t.x),positions(11,12).map(t=>100-t.x-3));
  const stagger=positions(9,12);
  assert.equal(stagger.find(t=>t.x>50).y-stagger[0].y,16);
  const round=positions(7,9),wide=positions(10,9);
  assert.ok(Math.max(...wide.map(t=>t.x))-Math.min(...wide.map(t=>t.x))>
    Math.max(...round.map(t=>t.x))-Math.min(...round.map(t=>t.x)));
  assert.notDeepEqual(positions(7,42),positions(13,42));
  assert.notDeepEqual(positions(13,42),positions(19,42));
  for(const [shape,definition] of Object.entries(BOARD_SHAPES))for(const p of definition.paths)
    for(const [, ...values] of p.commands)assert.ok(values.every(n=>Number.isFinite(n)&&n>=0&&n<=100),shape);
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
