import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MENU_PAGES,menuPageIndex,stepMenuPage} from '../src/menu-pages.js';
import {CanvasApp} from '../wechat/src/canvas-app.js';

test('main menu has three separate bounded pages, distinct from furniture pagination',()=>{
  assert.deepEqual(MENU_PAGES.map(p=>p.id),['home','business','decor']);
  assert.equal(stepMenuPage('home',1),'business');assert.equal(stepMenuPage('business',1),'decor');
  assert.equal(stepMenuPage('decor',1),'decor');assert.equal(stepMenuPage('home',-1),'home');
  assert.equal(stepMenuPage('decor',-1),'business');assert.equal(menuPageIndex('unknown'),0);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const page of MENU_PAGES)assert.match(html,new RegExp('data-book-page="'+page.id+'"'));
  assert.match(html,/id="menu-book-navigation"/);
  assert.ok(html.indexOf('id="menu-business-page"')<html.indexOf('id="level-picker"'));
  assert.ok(html.indexOf('id="menu-decor-page"')<html.indexOf('id="decor-tray"'));
});

function harness(){
  const data=new Map(),text=[];
  const ctx=new Proxy({fillText:value=>text.push(value)},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>{o[k]=v;return true;}});
  const p={canvas:{getContext:()=>ctx},size:()=>({width:390,height:844,ratio:1,top:40,bottom:0}),get:k=>data.get(k),set:(k,v)=>{data.set(k,v);return true;},sound(){},effect(){},bind(){},now:()=>0,raf:()=>1,cancelRaf(){},musicReady(){},resource:x=>x,image:()=>Promise.resolve({width:1448,height:1086}),loadResources:()=>Promise.resolve()};
  const app=new CanvasApp(p);app.loading=false;app.render(0);
  return {app,text};
}
test('native page changes separate controls and preserve wallet, layout and level selection',()=>{
  const {app,text}=harness(),shop=JSON.stringify(app.session.shop);
  const labels=()=>app.hits.filter(h=>h.key).map(h=>h.key.split(':')[1]);
  assert.ok(labels().includes('翻开营业手册 →'));assert.ok(!labels().includes('开始营业'));
  app.showMenuPage('business');assert.ok(labels().includes('开始营业'));assert.ok(!labels().includes('小盆栽'));
  app.session.selected=2;app.showMenuPage('decor');assert.ok(labels().includes('小盆栽'));assert.ok(!labels().includes('开始营业'));
  app.showMenuPage('home');assert.equal(app.session.selected,2);assert.equal(JSON.stringify(app.session.shop),shop);
  app.session.menu();assert.equal(app.session.menuPage,'home');
  assert.ok(!text.includes(undefined));
});
test('native background swipe flips main pages but a decoration drag does not',()=>{
  const {app}=harness();
  app.down({x:300,y:300,id:1});app.move({x:200,y:300,id:1});app.up({x:160,y:300,id:1});
  assert.equal(app.session.menuPage,'business');
  app.showMenuPage('decor');app.session.buy('bonsai');app.render(0);
  const hit=app.hits.find(h=>h.decor==='bonsai');
  const start={x:hit.x+hit.w/2,y:hit.y+hit.h/2,id:2};
  app.down(start);app.move({...start,x:start.x-65});app.up({...start,x:start.x-65});
  assert.equal(app.session.menuPage,'decor');assert.equal(app.session.shop.placements.length,1);
});
