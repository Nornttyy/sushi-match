import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OBSTACLE_ASSETS, OBSTACLE_IMAGES } from '../src/obstacle-assets.js';
import { GAME_IMAGES } from '../src/asset-manifest.js';
import { obstacleArt, drawObstacleArt } from '../src/obstacle-art.js';

test('five individual obstacle PNGs have alpha and valid source bounds in the shared loader',()=>{
  assert.equal(OBSTACLE_IMAGES.length,5);
  assert.equal(new Set(OBSTACLE_IMAGES).size,5);
  assert.equal(new Set(GAME_IMAGES).size,GAME_IMAGES.length);
  for(const [id,art] of Object.entries(OBSTACLE_ASSETS)){
    const png=readFileSync(new URL('../assets/'+art.file,import.meta.url));
    assert.equal(png.subarray(1,4).toString(),'PNG',id);
    assert.equal(png.readUInt32BE(16),art.width,id);
    assert.equal(png.readUInt32BE(20),art.height,id);
    assert.equal(png[25],6,id+' preserves its alpha channel');
    assert.ok(png.length>100000,id+' is the generated production file');
    const [x,y,w,h]=art.crop;
    assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=art.width&&y+h<=art.height,id);
    assert.ok(GAME_IMAGES.includes(art.file),id);
  }
});

test('intact and cracked ice share alignment and swap real artwork as layers melt',()=>{
  const sprite=(remaining)=>obstacleArt({obstacle:{kind:'ice',remaining}}).find(p=>p.type==='sprite');
  assert.equal(sprite(2).asset,'iceFull');
  assert.equal(sprite(1).asset,'iceCracked');
  assert.deepEqual(obstacleArt({obstacle:{kind:'ice',remaining:0}}),[]);
  assert.deepEqual(OBSTACLE_ASSETS.iceFull.crop,OBSTACLE_ASSETS.iceCracked.crop);
  const files=['iceFull','iceCracked'].map(id=>readFileSync(new URL('../assets/'+OBSTACLE_ASSETS[id].file,import.meta.url)));
  assert.equal(files[0].equals(files[1]),false);
});

test('Canvas draws the same PNG and explicit crop used by the DOM',()=>{
  const calls=[],images=new Map(OBSTACLE_IMAGES.map(file=>[file,{file}]));
  const ctx=new Proxy({}, {get:(_,name)=>(...args)=>{calls.push([name,...args]);},set:()=>true});
  for(const tile of [{obstacle:{kind:'ice',remaining:2}},{obstacle:{kind:'ice',remaining:1}},{key:1},{obstacle:{kind:'lock',key:1}},{obstacle:{kind:'crate',orders:2}}]){
    calls.length=0;
    drawObstacleArt(ctx,tile,0,0,0,64,64,images);
    const sprites=obstacleArt(tile).filter(p=>p.type==='sprite');
    assert.deepEqual(calls.filter(c=>c[0]==='drawImage'),sprites.map(p=>{
      const art=OBSTACLE_ASSETS[p.asset];
      return ['drawImage',images.get(art.file),...art.crop,p.x,p.y,p.w,p.h];
    }));
  }
  assert.deepEqual(obstacleArt({key:1,keyUsed:true}),[]);
  assert.deepEqual(obstacleArt({obstacle:{kind:'lock',key:1,open:true}}),[]);
  assert.deepEqual(obstacleArt({obstacle:{kind:'crate',orders:2}},2),[]);
});
