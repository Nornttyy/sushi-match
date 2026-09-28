import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DECOR_ART, NEW_DECOR_IMAGES} from '../src/decor-assets.js';
import {DECORATIONS} from '../src/shop-core.js';
import {GAME_IMAGES} from '../src/asset-manifest.js';

test('all fourteen decorations use real RGBA sprites and valid shared source rectangles',()=>{
  assert.deepEqual(Object.keys(DECOR_ART).sort(), DECORATIONS.map(item=>item.id).sort());
  for(const [id,art] of Object.entries(DECOR_ART)){
    const png=readFileSync(new URL('../assets/'+art.file,import.meta.url));
    assert.equal(png.subarray(1,4).toString(),'PNG',id);
    assert.equal(png.readUInt32BE(16),art.width,id);
    assert.equal(png.readUInt32BE(20),art.height,id);
    assert.equal(png[25],6,id+' has an alpha channel');
    const [x,y,w,h]=art.crop;
    assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=art.width&&y+h<=art.height,id);
    const item=DECORATIONS.find(item=>item.id===id);
    assert.ok(Math.abs(item.ratio-h/w)<1e-9,id+' has the same aspect ratio on both platforms');
    assert.ok(GAME_IMAGES.includes(art.file));
  }
});

test('nine new ornaments have individual production PNGs included in the loader',()=>{
  assert.equal(NEW_DECOR_IMAGES.length,9);
  assert.equal(new Set(NEW_DECOR_IMAGES).size,9);
  assert.equal(GAME_IMAGES.length,new Set(GAME_IMAGES).size);
  for(const file of NEW_DECOR_IMAGES){
    assert.ok(readFileSync(new URL('../assets/'+file,import.meta.url)).length>100000);
    assert.ok(GAME_IMAGES.includes(file));
  }
});
