import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createWechatPlatform } from '../wechat/src/platform.js';

test('wx adapter uses platform storage/audio and pauses foreground-only work',async()=>{
  const listeners={},calls=[],data=new Map();let audio;
  const api={createCanvas:()=>({}),getWindowInfo:()=>({windowWidth:390,windowHeight:844,pixelRatio:4,safeArea:{top:24,bottom:810}}),getMenuButtonBoundingClientRect:()=>({bottom:44}),
    getStorageSync:key=>data.get(key),setStorageSync:(key,value)=>data.set(key,value),
    createInnerAudioContext:()=>audio={play:()=>calls.push('play'),pause:()=>calls.push('pause'),onError(){}},
    onTouchStart:fn=>listeners.down=fn,onTouchMove:fn=>listeners.move=fn,onTouchEnd:fn=>listeners.up=fn,onTouchCancel:fn=>listeners.cancel=fn,onWindowResize:fn=>listeners.resize=fn,onHide:fn=>listeners.hide=fn,onShow:fn=>listeners.show=fn};
  const p=createWechatPlatform(api,()=>1,()=>{});p.bind({down:point=>calls.push(point),move(){},up(){},cancel(){},resize(){},hide:()=>calls.push('hidden'),show:()=>calls.push('shown')});
  assert.deepEqual(p.size(),{width:390,height:844,ratio:3,top:49,bottom:34});
  assert.equal(p.set('save',{coins:4}),true);assert.deepEqual(p.get('save'),{coins:4});
  p.musicReady();assert.equal(audio.src,'resources/assets/audio/bossa-antigua.mp3');
  listeners.hide();assert.deepEqual(calls.slice(-2),['pause','hidden']);
  listeners.show();assert.deepEqual(calls.slice(-2),['play','shown']);
  p.sound(false);listeners.hide();listeners.show();assert.equal(calls.at(-1),'shown');
  const plays=calls.filter(v=>v==='play').length;listeners.down({changedTouches:[{clientX:17,clientY:21,identifier:2}]});
  assert.equal(calls.filter(v=>v==='play').length,plays);assert.deepEqual(calls.at(-1),{x:17,y:21,id:2});
});

test('actual bundled entry boots with only wx and Canvas, without window or document',async()=>{
  const result=await build({entryPoints:[new URL('../wechat/src/entry.js',import.meta.url).pathname],bundle:true,format:'iife',platform:'neutral',target:'es2018',write:false});
  const code=result.outputFiles[0].text;
  assert.doesNotMatch(code,/\bdocument\.|\blocalStorage\b|\bwindow\./);
  const requests=[],text=[],ctx=new Proxy({fillText:value=>text.push(value)},{get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>{target[key]=value;return true;}});
  const canvas={getContext:()=>ctx},listeners={},queue=[];
  const api={createCanvas:()=>canvas,getWindowInfo:()=>({windowWidth:390,windowHeight:844,pixelRatio:2}),
    getStorageSync:()=>null,setStorageSync(){},createImage:()=>{const image={width:2172,height:724};Object.defineProperty(image,'src',{set(value){requests.push(value);queueMicrotask(()=>image.onload());}});return image;},
    loadSubpackage:options=>{queueMicrotask(options.success);return {onProgressUpdate(){}};},
    createInnerAudioContext:()=>({play(){},pause(){},onError(){}}),
    onTouchStart:fn=>listeners.down=fn,onTouchMove(){},onTouchEnd:fn=>listeners.up=fn,onTouchCancel(){},onHide(){},onShow(){},onWindowResize(){}};
  vm.runInNewContext(code,{wx:api,requestAnimationFrame:fn=>queue.push(fn),cancelAnimationFrame(){},setTimeout,clearTimeout,console},{timeout:1000});
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.equal(canvas.width,780);assert.ok(text.includes('寿司小转台'));assert.equal(requests.length,10);
  assert.ok(requests.every(path=>path.startsWith('boot/')||path.startsWith('resources/assets/')));
  assert.equal(typeof listeners.down,'function');assert.equal(typeof listeners.up,'function');
  const config=JSON.parse(readFileSync(new URL('../wechat/project.config.json',import.meta.url)));assert.equal(config.compileType,'game');assert.equal(config.appid,'touristappid');
});
