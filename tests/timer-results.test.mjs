import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVELS, createGame, createEndlessGame, getLevel, selectTile, advanceGameTime,
  canCraftActive, craftActiveSushi, serveActiveCustomer, undoRailPick } from '../src/game-core.js';
import { campaignTimeLimit, createPlayClock, formatTime } from '../src/timer-core.js';
import { outcomeSummary } from '../src/outcome-core.js';
import { Session } from '../wechat/src/session.js';
import { CanvasApp } from '../wechat/src/canvas-app.js';

const settle=s=>{while(s.status==='playing'&&(s.workbench.crafted||canCraftActive(s)))s=s.workbench.crafted?serveActiveCustomer(s).state:craftActiveSushi(s).state;return s;};
function win(index=0) { let s=createGame(index);for(const id of getLevel(s).solution)s=settle(selectTile(s,id).state);return s; }

test('campaign has scaled 2–4.5 minute budgets, starts on a valid pick, endless stays unlimited',()=>{
  for(const l of LEVELS){assert.ok(l.timeLimitMs>=120000&&l.timeLimitMs<=(l.id<=24?240000:270000));assert.equal(l.timeLimitMs%15000,0);}
  assert.equal(campaignTimeLimit(18,1),120000);
  const initial=createGame(3);assert.equal(advanceGameTime(initial,900000).state,initial);
  const sealed=initial.tiles.find(t=>t.sealed);assert.equal(selectTile(initial,sealed.id).state.timeStarted,false);
  const picked=selectTile(initial,LEVELS[3].solution[0]).state;assert.equal(picked.timeStarted,true);
  assert.equal(advanceGameTime(picked,1234).state.timeRemainingMs,picked.timeRemainingMs-1234);
  let endless=createEndlessGame();endless=selectTile(endless,getLevel(endless).solution[0]).state;
  assert.equal(advanceGameTime(endless,99999999).state.status,'playing');assert.equal(endless.timeRemainingMs,null);
});

test('clock spends actual foreground time, is immutable, ignores invalid deltas, and expires once',()=>{
  let s=selectTile(createGame(),LEVELS[0].solution[0]).state;
  for(const invalid of [0,-1,NaN,Infinity])assert.equal(advanceGameTime(s,invalid).state,s);
  const before=structuredClone(s),r=advanceGameTime(s,119999);assert.deepEqual(s,before);s=r.state;
  assert.equal(s.timeRemainingMs,1);assert.equal(s.status,'playing');
  s.coins=18;const expired=advanceGameTime(s,10);assert.equal(expired.expired,true);s=expired.state;
  assert.equal(s.status,'lost');assert.equal(s.failureReason,'timeout');assert.equal(s.timeRemainingMs,0);assert.equal(s.elapsedMs,120000);assert.equal(s.coins,18);
  assert.equal(selectTile(s,LEVELS[0].solution[1]).changed,false);assert.equal(undoRailPick(s).changed,false);
  assert.equal(craftActiveSushi(s).changed,false);assert.equal(serveActiveCustomer(s).changed,false);
  assert.equal(advanceGameTime(s,1000).state,s);
});

test('craft and delivery never steal time; a last-moment valid final triple can still win',()=>{
  let s=createGame();
  for(const id of LEVELS[0].solution){
    s=selectTile(s,id).state;
    if(canCraftActive(s)){
      assert.equal(advanceGameTime(s,500000).state,s);
      s=craftActiveSushi(s).state;assert.equal(advanceGameTime(s,500000).state,s);
    }
    s=settle(s);
  }
  assert.equal(s.status,'won');assert.equal(advanceGameTime(s,500000).state,s);
  s=createGame();for(const id of LEVELS[0].solution.slice(0,-1))s=settle(selectTile(s,id).state);
  s.timeRemainingMs=1;s=selectTile(s,LEVELS[0].solution.at(-1)).state;
  assert.equal(advanceGameTime(s,10000).state,s);assert.equal(settle(s).status,'won');
});

test('every authored sealed board fits its time budget with 2.5 seconds per decision',()=>{
  for(let i=0;i<LEVELS.length;i++){
    let s=createGame(i);
    for(const id of LEVELS[i].solution){s=advanceGameTime(s,2500).state;s=settle(selectTile(s,id).state);assert.notEqual(s.status,'lost',LEVELS[i].name);}
    assert.equal(s.status,'won');assert.ok(s.timeRemainingMs>0);
  }
});

test('foreground sampler discards paused/background gaps without clamping slow frames',()=>{
  const clock=createPlayClock();assert.equal(clock.sample(1000,true),0);
  assert.equal(clock.sample(1250,true),250);assert.equal(clock.sample(5000,false),0);
  clock.reset(50000);assert.equal(clock.sample(50100,true),100);
  assert.equal(clock.sample(49100,true),0);assert.equal(clock.sample(NaN,true),0);
  assert.equal(formatTime(1),'0:01');assert.equal(formatTime(0),'0:00');assert.equal(formatTime(120000),'2:00');assert.equal(formatTime(1999,false),'0:01');
});

test('result stars, time, distinct loss causes and routes reflect real state without rewards',()=>{
  const won=win();won.elapsedMs=27000;
  assert.equal(outcomeSummary(won).stars,3);assert.equal(outcomeSummary(won).elapsed,'0:27');
  won.undoTokens--;assert.equal(outcomeSummary(won).stars,2);
  won.timeRemainingMs=1;assert.equal(outcomeSummary(won).stars,1);
  assert.equal(outcomeSummary(won).primary,'下一关');assert.equal(outcomeSummary(won).replay,'再玩本关');assert.equal(outcomeSummary(won).secondary,'返回主界面');
  const before=JSON.stringify(won);outcomeSummary(won);assert.equal(JSON.stringify(won),before);
  for(const [reason,title] of [['timeout','时间到了'],['full','七格备料栏满了'],['sealed','封条挡住了食材']]){
    const r=outcomeSummary({...won,status:'lost',failureReason:reason});assert.equal(r.title,title);assert.equal(r.primary,'再试一次');assert.equal(r.stars,0);assert.equal(r.detail,'已赚金币保留');
  }
  assert.equal(outcomeSummary(win(23)).primary,'下一关');
  assert.equal(outcomeSummary(win(LEVELS.length-1)).primary,'下一关');
});

test('native session expires once, retains earned wallet, replays same day, and returns home',()=>{
  const calls=[],data=new Map(),s=new Session({get:k=>data.get(k),set:(k,v)=>data.set(k,v),effect:x=>calls.push(x),sound(){}});
  s.start();s.pick(LEVELS[0].solution[0]);s.shop.coins=42;
  assert.equal(s.elapse(120000),true);assert.equal(s.elapse(120000),false);assert.equal(calls.filter(x=>x==='lose').length,1);
  assert.equal(s.shop.coins,42);s.advance();assert.equal(s.game.timeRemainingMs,120000);assert.equal(s.game.timeStarted,false);
  s.game=win();s.selected=0;const coins=s.shop.coins;s.replay();assert.equal(s.selected,0);assert.equal(s.game.status,'playing');assert.equal(s.shop.coins,coins);
  s.menu();assert.equal(s.menuPage,'home');assert.equal(s.scene,'menu');const before=s.game;assert.equal(s.elapse(120000),false);assert.equal(s.game,before);
});

test('native background, merge and delivery pauses cannot drain the timer or duplicate outcomes',()=>{
  let now=0;const ctx=new Proxy({},{get:()=>()=>{},set:()=>true}),effects=[];
  const p={canvas:{getContext:()=>ctx},size:()=>({width:390,height:844,ratio:1,top:40,bottom:0}),get(){},set(){return true;},sound(){},effect:x=>effects.push(x),bind(){},now:()=>now,raf:()=>1,cancelRaf(){},musicReady(){},resource:x=>x,image:()=>Promise.resolve({width:1448,height:1086}),loadResources:()=>Promise.resolve()};
  const app=new CanvasApp(p);app.loading=false;app.session.start();
  now=50000;app.frame();assert.equal(app.session.game.timeRemainingMs,120000,'first pick has not happened');
  app.session.pick(LEVELS[0].solution[0]);now+=1000;app.frame();assert.equal(app.session.game.timeRemainingMs,119000,'slow frames charge real elapsed time');
  app.mergeUntil=app.motionTime+500;now+=100;app.frame();assert.equal(app.session.game.timeRemainingMs,119000);
  app.hide();now+=100000;app.frame();app.show();assert.equal(app.session.game.timeRemainingMs,119000);
  now+=119000;app.frame();assert.equal(app.session.game.failureReason,'timeout');assert.equal(effects.filter(x=>x==='lose').length,1);
  now+=1000;app.frame();assert.equal(effects.filter(x=>x==='lose').length,1);
  app.session.game=win();app.render(now);
  for(const label of ['下一关','再玩本关','返回主界面'])assert.ok(app.hits.some(h=>h.key?.startsWith('button:'+label+':')));
  const buttons=app.hits.filter(h=>h.action).sort((a,b)=>a.y-b.y);
  for(let i=1;i<buttons.length;i++)assert.ok(buttons[i].y-buttons[i-1].y-buttons[i-1].h>=8,'result buttons have separate touch targets');
});

test('web timer is quiet for screen readers, result routes are explicit, and feedback honours reduced motion',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(html,/id="countdown"[^>]*role="timer"[^>]*aria-live="off"/);
  assert.match(html,/id="overlay-replay-button"/);assert.match(html,/id="result-stars"/);
  assert.doesNotMatch(main,/if \(won\) shop\.openEditor/);
  assert.match(readFileSync(new URL('../feedback.css',import.meta.url),'utf8'),/prefers-reduced-motion/);
});
