import { getCampaignLevel, campaignPreviewLastPage, RECIPES, getTileCoverDepths, getVisibleCustomers, getRailTiles, getRecipeSlots } from '../../src/game-core.js';
import { tileDepthAppearance } from '../../src/tile-depth.js';
import { FOOD_CROPS, FOOD_MASKS } from '../../src/food-art.js';
import { CAT_CROPS } from '../../src/cat-portrait.js';
import { SHOP_THEMES, getDecoration, getTheme, DECOR_FILTERS, getDecorCatalog, getShopRoomFrame } from '../../src/shop-core.js';
import { DECOR_ART } from '../../src/decor-assets.js';
import { GAME_IMAGES } from '../../src/asset-manifest.js';
import { loadingSnapshot, createTaskCache } from '../../src/loading-core.js';
import { MOTION, jellyPose, flightPose } from '../../src/motion-core.js';
import { Session } from './session.js';
import { MENU_PAGES, menuPageIndex, stepMenuPage } from '../../src/menu-pages.js';
import { SEAL_HINT, SEAL_COLORS, SEAL_MOTION_MS, SEAL_BANDS, getSealLayers, sealPeelPose } from '../../src/nori-seals.js';
import { createPlayClock, formatTime } from '../../src/timer-core.js';
import { outcomeSummary } from '../../src/outcome-core.js';
import { BOARD_SHAPES, shapeBoardFrame, drawShapeGuide } from '../../src/board-shapes.js';

const W = 390;
const inside = (p, r) => p.x >= r.x && p.x <= r.x+r.w && p.y >= r.y && p.y <= r.y+r.h;

export class CanvasApp {
  constructor(platform) {
    this.p = platform; this.ctx = platform.canvas.getContext('2d'); this.session = new Session(platform);
    this.images = new Map(); this.cache = createTaskCache(); this.hits = []; this.bounce = 0;
    this.motionTime = 0; this.flights = new Map(); this.pulses = new Map(); this.sealPeels = new Map(); this.mergeUntil = 0;
    this.playClock = createPlayClock(); this.resultGame = null; this.resultStarted = 0;
    this.loading = true; this.loadError = false; this.busyLoading = false; this.startedAt = platform.now();
    this.loaded = 0; this.total = GAME_IMAGES.length + 1; this.packageProgress = 0;
    this.page = Math.floor(this.session.selected / 3); this.tab = 'decor'; this.selectedDecor = null; this.previewTheme = null;
    this.decorCategory = 'all'; this.decorPage = 0;
    this.hidden = false; this.lastFrame = platform.now(); this.message = ''; this.messageUntil = 0;
    platform.sound(!this.session.muted); this.resize();
    platform.bind({ down: p => this.down(p), move: p => this.move(p), up: p => this.up(p), cancel: () => { this.press = null; this.dirty = true; }, resize: () => this.resize(), hide: () => this.hide(), show: () => this.show() });
    this.frame(); void this.load();
  }
  resize() {
    this.clearMotion();
    this.dirty = true;
    this.viewport = this.p.size(); const { width, height, ratio } = this.viewport;
    this.viewWidth = Math.min(width, 500); this.offset = (width - this.viewWidth) / 2; this.scale = this.viewWidth / W;
    this.H = height / this.scale; this.top = (this.viewport.top || 0) / this.scale; this.bottom = (this.viewport.bottom || 0) / this.scale;
    this.p.canvas.width = Math.round(width * ratio); this.p.canvas.height = Math.round(height * ratio);
  }
  async load() {
    if (this.busyLoading) return;
    this.busyLoading = true; this.loadError = false; this.loaded = 0; this.packageProgress = 0; this.startedAt = this.p.now();
    try {
      const boot = this.cache('sushi-atlas-v2.png', () => this.p.image(this.p.resource('sushi-atlas-v2.png'))).then(img => { this.images.set('sushi-atlas-v2.png', img); this.loaded++; });
      const pack = this.cache('package', () => this.p.loadResources(value => { this.packageProgress = value; })).then(() => { this.loaded++; this.packageProgress = 1; });
      const initial = await Promise.all([boot, pack].map(p => p.then(() => null, error => error)));
      if (initial.some(Boolean)) throw initial.find(Boolean);
      const rest = GAME_IMAGES.filter(path => path !== 'sushi-atlas-v2.png').map(path => this.cache(path, () => this.p.image(this.p.resource(path))).then(img => { this.images.set(path, img); this.loaded++; }));
      // Wait for every image attempt, so retry never overlaps an earlier load.
      const results = await Promise.all(rest.map(p => p.then(() => null, error => error)));
      if (results.some(Boolean)) throw results.find(Boolean);
    } catch { this.loadError = true; }
    finally { this.busyLoading = false; }
  }
  hide() { this.advanceClock(this.p.now()); this.hidden = true; this.press = null; this.p.cancelRaf(this.frameId); }
  show() { if (!this.hidden) return; this.hidden = false; this.lastFrame = this.p.now(); this.playClock.reset(this.lastFrame); this.resize(); this.frame(); }
  advanceClock(now) {
    const elapsed=this.playClock.sample(now,!this.loading&&!this.hidden&&this.motionTime>=this.mergeUntil);
    const before=this.session.game,oldSecond=Math.ceil((before?.timeRemainingMs||0)/1000);
    const expired=this.session.elapse(elapsed);
    if(expired){this.clearMotion();this.dirty=true;}
    if(oldSecond!==Math.ceil((this.session.game?.timeRemainingMs||0)/1000))this.dirty=true;
    return expired;
  }
  frame() {
    if (this.hidden) return;
    const now = this.p.now(), elapsed = Math.min(50, now-this.lastFrame); this.lastFrame = now;
    this.advanceClock(now);
    this.motionTime += elapsed;
    const wasMoving = this.flights.size || this.pulses.size || this.sealPeels.size;
    for (const [id, peel] of this.sealPeels) if (this.motionTime-peel.start >= SEAL_MOTION_MS) this.sealPeels.delete(id);
    for (const [id, flight] of this.flights) if (this.motionTime-flight.start >= flight.duration) {
      this.flights.delete(id); if(flight.merge)this.pulses.set('prep',this.motionTime);
    }
    for (const [id, start] of this.pulses) if (this.motionTime-start >= MOTION.bounce) this.pulses.delete(id);
    if (this.loading && loadingSnapshot({ startedAt: this.startedAt, now, done: this.loaded, total: this.total, failed: Number(this.loadError) }).ready) {
      this.loading = false; this.dirty = true; this.p.musicReady();
    }
    const previous = this.session.game, delivery = this.session.delivery;
    // An in-flight dish keeps moving during a rail merge; only starting a new
    // dish waits until its ingredient animation has reached the pantry.
    if (!this.loading) this.session.tick(elapsed, this.motionTime >= this.mergeUntil);
    const noticeVisible = now < this.messageUntil;
    const resultMoving=this.session.scene==='game'&&this.session.game?.status!=='playing'&&this.motionTime-this.resultStarted<2100;
    if (this.loading || this.dirty || wasMoving || this.pulses.size || delivery || this.session.delivery || previous !== this.session.game || noticeVisible !== this.noticeVisible || resultMoving) {
      this.render(now); this.dirty = false;
    }
    this.noticeVisible = noticeVisible; this.frameId = this.p.raf(() => this.frame());
  }
  point(p) { return { ...p, x: (p.x-this.offset)/this.scale, y: p.y/this.scale }; }
  down(raw) {
    const p = this.point(raw); this.press = { ...p, target: [...this.hits].reverse().find(hit => inside(p, hit)), moved: false };
    const overCatalog=this.session.scene==='shop'&&p.y>=this.H-this.bottom-71-(this.tab==='decor'?184:155);
    this.press.bookSwipe=!this.loading&&['menu','shop'].includes(this.session.scene)&&!this.soundSettings&&!this.press.target&&!overCatalog;
    this.dirty = true;
    if (this.press.target?.decor) { this.selectedDecor = this.press.target.decor; this.dirty = true; }
  }
  move(raw) {
    if (!this.press || raw.id !== this.press.id) return;
    const p = this.point(raw);
    if (Math.hypot(p.x-this.press.x, p.y-this.press.y) > 6) { this.press.moved = true; this.dirty = true; }
    if (this.press.target?.decor && this.session.scene === 'shop') {
      const r = this.room; const item = getDecoration(this.press.target.decor);
      const placement = this.session.shop.placements.find(v => v.id === item.id);
      // Preserve the grab offset; first movement never snaps the prop's base.
      if (!this.press.anchor) this.press.anchor = { x: placement.x-(this.press.x-r.x)/r.w*100, y: placement.y-(this.press.y-r.y)/r.h*100 };
      this.session.move(item.id, (p.x-r.x)/r.w*100+this.press.anchor.x, (p.y-r.y)/r.h*100+this.press.anchor.y);
      this.dirty = true;
    }
  }
  up(raw) {
    if (!this.press || raw.id !== this.press.id) return;
    if(this.advanceClock(this.p.now())){this.press=null;this.render(this.p.now());return;}
    const press = this.press; this.press = null;
    this.dirty = true;
    const end=this.point(raw),dx=end.x-press.x,dy=end.y-press.y;
    if(press.bookSwipe&&Math.abs(dx)>=55&&Math.abs(dx)>Math.abs(dy)*1.5){
      this.showMenuPage(stepMenuPage(this.session.scene==='shop'?'decor':this.session.menuPage,dx<0?1:-1));
      return;
    }
    if (!press.moved && press.target && inside(this.point(raw), press.target)) {
      const scene=this.session.scene,game=this.session.game;
      if(press.target.key)this.pulses.set(press.target.key,this.motionTime);
      press.target.action?.();
      if(scene!==this.session.scene || (game && game!==this.session.game && (game.status!=='playing'||game.levelIndex!==this.session.game?.levelIndex||game.wave!==this.session.game?.wave)))this.clearMotion();
      this.render(this.p.now());
    }
  }
  clearMotion() { this.flights.clear();this.pulses.clear();this.sealPeels.clear();this.mergeUntil=0;this.resultGame=null; }
  elastic(key,x,y,w,h,draw,strength=1) {
    const start=this.pulses.get(key),held=this.press?.target?.key===key&&!this.press.moved;
    const pose=held?{sx:1.09,sy:.84,y:3,rotate:0}:jellyPose(start===undefined?-1:(this.motionTime-start)/MOTION.bounce,strength);
    const c=this.ctx;c.save();c.translate(x+w/2,y+h*.75+pose.y);c.rotate(pose.rotate*Math.PI/180);c.scale(pose.sx,pose.sy);c.translate(-x-w/2,-y-h*.75);draw();c.restore();
  }
  railRect(index) { return {x:46+index*49,y:this.H-this.bottom-40,w:44,h:42}; }
  pickTile(tile,from) {
    if(this.motionTime<this.mergeUntil)return;
    const before=getRailTiles(this.session.game),matches=before.filter(t=>t.ingredient===tile.ingredient);
    const sealed=this.session.game.tiles.filter(t=>t.active&&t.sealed).map(t=>({id:t.id,layers:getSealLayers(t)}));
    if(!this.session.pick(tile.id))return;
    for(const {id,layers} of sealed)if(getSealLayers(this.session.game.tiles.find(t=>t.id===id))<layers)this.sealPeels.set(id,{start:this.motionTime,band:layers-1});
    const merge=matches.length===2,duration=merge?MOTION.merge:MOTION.pick;
    const after=getRailTiles(this.session.game);
    for(const [index,item] of before.entries()){
      if(merge&&item.ingredient===tile.ingredient)continue;
      const nextIndex=after.findIndex(t=>t.id===item.id);if(nextIndex===index)continue;
      const current=this.flights.get(item.id),source=current?flightPose((this.motionTime-current.start)/current.duration,current.from,current.to,current.merge,!current.merge):this.railRect(index);
      this.flights.set(item.id,{id:item.id,ingredient:item.ingredient,from:source,to:this.railRect(nextIndex),start:this.motionTime,duration:MOTION.pick,merge:false});
    }
    const target=merge?{x:215,y:this.H-this.bottom-139,w:37,h:37}:this.railRect(this.session.game.rail.indexOf(tile.id));
    const ingredients=merge?[...matches,tile]:[tile];
    for(const item of ingredients){const current=this.flights.get(item.id),source=item.id===tile.id?from:current?flightPose((this.motionTime-current.start)/current.duration,current.from,current.to,current.merge,!current.merge):this.railRect(before.findIndex(t=>t.id===item.id));
      this.flights.set(item.id,{id:item.id,ingredient:item.ingredient,from:source,to:target,start:this.motionTime,duration,merge});
    }
    if(merge)this.mergeUntil=this.motionTime+duration;
  }
  drawFlights() {
    for(const flight of this.flights.values()){
      const pose=flightPose((this.motionTime-flight.start)/flight.duration,flight.from,flight.to,flight.merge,!flight.merge),c=this.ctx;
      c.save();c.globalAlpha=pose.opacity;c.translate(pose.x,pose.y);c.rotate(pose.rotate*Math.PI/180);
      this.box(-pose.w/2,-pose.h/2+3,pose.w,pose.h,'#cbaa83',9);this.box(-pose.w/2,-pose.h/2,pose.w,pose.h,'#fff9e8',9,flight.merge?'#f3ce83':'#fff2d6');
      this.food('ingredient',flight.ingredient,-pose.w*.44,-pose.h*.44,pose.w*.88,pose.h*.88);c.restore();
    }
  }
  drawSeal(tile,w,h) {
    const peel=this.sealPeels.get(tile.id),layers=getSealLayers(tile),c=this.ctx;
    const indices=Array.from({length:layers},(_,i)=>i);if(peel)indices.push(peel.band);
    for(const index of indices){
      const band=SEAL_BANDS[index],pose=sealPeelPose(peel?.band===index?(this.motionTime-peel.start)/SEAL_MOTION_MS:0,band.rotate);
      const sw=w*band.w/100,sh=h*band.h/100;
      c.save();c.globalAlpha*=pose.opacity;c.translate(w*(band.x+band.w/2-50)/100,h*(band.y+band.h/2-50)/100+pose.y);c.rotate(pose.rotate*Math.PI/180);c.scale(1,pose.sy);
      this.box(-sw/2,-sh/2,sw,sh,SEAL_COLORS.fill,3,SEAL_COLORS.edge);
      c.beginPath();c.moveTo(sw/2-Math.min(9,sw*.45),-sh/2);c.lineTo(sw/2,-sh/2);c.lineTo(sw/2,-sh/2+Math.min(9,sh*.6));c.closePath();c.fillStyle=SEAL_COLORS.fold;c.fill();c.restore();
    }
    if(layers>1){this.box(w/2-20,h/2-20,19,19,'#fff5db',10,SEAL_COLORS.fill);this.text(layers,w/2-10.5,h/2-10.5,11,SEAL_COLORS.edge);}
  }
  hit(x,y,w,h,action,extra = {}) { this.hits.push({ x,y,w,h,action,...extra }); }
  box(x,y,w,h,color = '#fff4db', radius = 14, border = '') {
    const c=this.ctx,r=Math.min(radius,w/2,h/2); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); c.fillStyle=color; c.fill(); if(border){ c.strokeStyle=border;c.lineWidth=2;c.stroke(); }
  }
  text(value,x,y,size=14,color='#80553d',align='center') { const c=this.ctx; c.fillStyle=color;c.font='600 '+size+'px sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillText(String(value),x,y); }
  button(label,x,y,w,h,action,{ active=false, disabled=false, size=14 }={}) {
    const key='button:'+label+':'+x+':'+y;
    this.ctx.save(); if(disabled)this.ctx.globalAlpha=.5;
    this.elastic(key,x,y,w,h,()=>{this.box(x,y,w,h,active?'#b96b4c':'#fff0d3',12,'#bf9067'); this.text(label,x+w/2,y+h/2,size,active?'#fff9e9':'#80553d');},.5); this.ctx.restore();
    this.hit(x,y,w,h,disabled?null:action,disabled?{}:{key});
  }
  sprite(path,crop,x,y,w,h,mask=null,flip=false) {
    const img=this.images.get(path); if(!img)return;
    const r=crop||[0,0,img.width,img.height], scale=Math.min(w/r[2],h/r[3]);
    const dw=r[2]*scale,dh=r[3]*scale,dx=x+(w-dw)/2,dy=y+(h-dh)/2,c=this.ctx;
    c.save(); if(flip){c.translate(x+w/2,0);c.scale(-1,1);c.translate(-(x+w/2),0);}
    if(mask){const points=mask.match(/-?\d+(?:\.\d+)?/g).map(Number);c.beginPath();for(let i=0;i<points.length;i+=2){const px=dx+(points[i]-r[0])*scale,py=dy+(points[i+1]-r[1])*scale;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.clip();}
    c.drawImage(img,...r,dx,dy,dw,dh);c.restore();
  }
  food(kind,id,x,y,w,h,alpha=1) {
    this.ctx.save();this.ctx.globalAlpha*=alpha;
    // Canvas uses polygon equivalents of the SVG corner masks.
    const masks={tamago:'1092 99 1411 99 1411 345 1108 345 1108 256 1092 239',shrimp:'730 101 1082 101 1082 250 1097 271 1097 362 730 362'};
    this.sprite(kind==='sushi'?'sushi-atlas-v2.png':'ingredient-atlas-v1.png',FOOD_CROPS[kind][id],x,y,w,h,kind==='sushi'&&FOOD_MASKS[id]?masks[id]:null);this.ctx.restore();
  }
  notice(message) { this.message=message;this.messageUntil=this.p.now()+1600; }
  render(now) {
    const c=this.ctx,dpr=this.viewport.ratio;c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#f5e3c6';c.fillRect(0,0,this.viewport.width,this.viewport.height);
    c.translate(this.offset,0);c.scale(this.scale,this.scale);this.hits=[];
    c.save();c.beginPath();c.rect(0,0,W,this.H);c.clip();
    if(this.loading)this.drawLoading(now);else if(this.session.scene==='game')this.drawGame();else this.drawMenu();
    if(!this.loading&&(!this.session.saved||now<this.messageUntil)){this.box(65,this.H-this.bottom-48,260,30,'#80553de6',12);this.text(!this.session.saved?'存档失败，请勿关闭':this.message,195,this.H-this.bottom-33,12,'#fff8e8');}
    c.restore();
  }
  drawLoading(now) {
    this.box(0,0,W,this.H,'#fff2d9',0);const mid=this.H/2;
    this.text('寿司小转台',195,mid-145,33,'#b9674c');
    const c=this.ctx;c.beginPath();c.ellipse(195,mid+16,92,35,0,0,Math.PI*2);c.fillStyle='#fffbec';c.fill();c.strokeStyle='#c58960';c.lineWidth=3;c.stroke();
    this.elastic('loading',121,mid-82,148,113,()=>this.food('sushi','salmon',121,mid-82,148,113),1.35);
    this.hit(90,mid-95,210,145,()=>{this.pulses.set('loading',this.motionTime);},{key:'loading'});
    const progress=Math.floor(Math.min(1,(this.loaded+(!this.loaded?this.packageProgress:0))/this.total)*100);
    this.box(75,mid+79,240,15,'#f0d9b6',8,'#c5956c');if(progress)this.box(77,mid+81,236*progress/100,11,'#d1815d',6);
    this.text(this.loadError?'没连上，再试一次':this.loaded===this.total?'马上开店':'开店准备',75,mid+115,12,'#85593d','left');this.text(progress+'%',315,mid+115,12,'#85593d','right');
    if(this.loadError)this.button('再试一次',125,mid+148,140,40,()=>void this.load(),{active:true});
  }
  drawRoom() {
    const toolbarTop=this.session.scene==='shop'?this.H-this.bottom-71-(this.tab==='decor'?184:155):null;
    this.room=getShopRoomFrame(W,this.H,toolbarTop,this.top+48);const r=this.room;
    this.box(0,0,W,this.H,'#ffe7be',0);
    this.sprite('menu/'+getTheme(this.previewTheme||this.session.shop.theme).image,null,r.x,r.y,r.w,r.h);
    const placements=[...this.session.shop.placements].sort((a,b)=>a.id==='rug'?-1:b.id==='rug'?1:a.y-b.y);
    for(const p of placements){const item=getDecoration(p.id),w=r.w*item.width/100,h=w*item.ratio,x=r.x+r.w*p.x/100-w/2,y=r.y+r.h*p.y/100-h;
      if(this.session.scene==='shop'&&this.selectedDecor===p.id){this.ctx.strokeStyle='#628966';this.ctx.lineWidth=2;this.ctx.strokeRect(x-3,y-3,w+6,h+6);}
      const art=DECOR_ART[p.id];this.sprite(art.file,art.crop,x,y,w,h,null,p.flipped);
      if(this.session.scene==='shop')this.hit(x,y,w,h,()=>{this.selectedDecor=p.id;},{decor:p.id});
    }
  }
  showMenuPage(id) {
    if(!MENU_PAGES.some(page=>page.id===id))return;
    this.session.menuPage=id;this.session.scene=id==='decor'?'shop':'menu';
    this.selectedDecor=null;this.previewTheme=null;this.press=null;this.dirty=true;
    this.p.effect('ui');this.render(this.p.now());
  }
  drawMenuNavigation() {
    const current=this.session.scene==='shop'?'decor':this.session.menuPage||'home',y=this.H-this.bottom-56;
    this.box(14,y,362,46,'#fff6df',10,'#bd9064');
    this.text((menuPageIndex(current)+1)+' / 3',195,y-10,10);
    this.button('‹',20,y+7,30,32,()=>this.showMenuPage(stepMenuPage(current,-1)),{disabled:current==='home'});
    MENU_PAGES.forEach((page,i)=>this.button(page.label,57+i*92,y+7,86,32,()=>this.showMenuPage(page.id),{active:current===page.id,size:13}));
    this.button('›',341,y+7,29,32,()=>this.showMenuPage(stepMenuPage(current,1)),{disabled:current==='decor'});
  }
  drawBusinessPage() {
    const s=this.session,H=this.H-this.bottom,top=this.top+58,bottom=H-79;
    this.box(13,top,364,bottom-top,'#e5cba4',13,'#c59f72');
    this.box(21,top+2,354,bottom-top-6,'#fff7e3',12);
    this.text('营业手册',195,top+35,29,'#a45e42');
    this.button('闯关',67,top+70,135,34,()=>{s.mode='campaign';},{active:s.mode==='campaign',size:12});
    this.button('无尽模式',213,top+70,110,34,()=>{s.mode='endless';},{active:s.mode==='endless',size:12});
    if(s.mode==='campaign'){
      for(let i=0;i<3;i++){const level=this.page*3+i,x=35+i*116,y=top+147,locked=level>s.unlocked;
        this.ctx.save();if(locked)this.ctx.globalAlpha=.5;
        this.sprite('menu/shop-parts-v1.png',[44,806,537,299],x,y+12,88,50);this.food('sushi',RECIPES[getCampaignLevel(level).orders[0]].foodSprite,x+8,y-17,72,63);this.ctx.restore();
        this.button('第 '+(level+1)+' 天'+(locked?' · 锁':''),x-2,y+65,94,27,()=>{s.selected=level;},{active:s.selected===level,size:11});
      }
      this.button('‹',106,top+250,35,29,()=>{this.page--;s.selected=this.page*3;},{disabled:this.page===0});
      this.text((this.page*3+1)+'–'+(this.page*3+3),195,top+265,11);
      this.button('›',249,top+250,35,29,()=>{this.page++;s.selected=this.page*3;},{disabled:this.page>=campaignPreviewLastPage(s.unlocked)});
    }else{
      this.text('∞',195,top+161,57,'#b76348');this.text('无尽营业',195,top+222,23);
      this.text('最高 '+s.bestWave+' 波 · 最多 '+s.bestOrders+' 单',195,top+260,12);
    }
    const definition=getCampaignLevel(s.mode==='campaign'?s.selected:3);
    this.text(s.mode==='campaign'?'第 '+(s.selected+1)+' 天 · '+definition.name:'七格备料 · 持续挑战',195,bottom-141,18);
    if(s.mode==='campaign')this.text('限时 '+formatTime(definition.timeLimitMs),195,bottom-176,12,'#956c48');
    const orders=[...new Set(definition.orders)];
    orders.slice(0,6).forEach((id,i)=>this.food('sushi',RECIPES[id].foodSprite,195-orders.length*16+i*32,bottom-119,28,28));
    const locked=s.mode==='campaign'&&s.selected>s.unlocked;
    this.button(locked?'尚未解锁':s.mode==='endless'&&s.endless?.status==='playing'?'继续挑战':'开始营业',64,bottom-75,262,46,()=>s.start(),{active:true,disabled:locked,size:20});
    if(s.mode==='endless'&&s.endless?.status==='playing')this.button('重新挑战',145,bottom-25,100,23,()=>s.start(true),{size:11});
  }
  drawMenu() {
    const s=this.session,H=this.H,bottom=this.bottom;
    if(s.scene==='shop'||s.menuPage!=='business')this.drawRoom();else this.box(0,0,W,H,'#ffe7be',0);
    this.box(16,this.top+10,100,32,'#fff3daeb',17);this.text(s.shop.coins+' 金币',66,this.top+26,13);
    this.button('声音设置',292,this.top+10,82,32,()=>{this.soundSettings=true;this.musicCredits=false;},{size:12});
    if(s.scene==='shop')this.drawShop();
    else if(s.menuPage==='business')this.drawBusinessPage();
    else{
      this.text('寿司小转台',195,Math.max(this.top+82,H*.15),35,'#b76348');
      this.button('翻开营业手册 →',64,H-bottom-130,262,48,()=>this.showMenuPage('business'),{active:true,size:18});
    }
    this.drawMenuNavigation();
    if(this.soundSettings){
      this.hits=[];this.box(0,0,W,H,'#543b2b66',0);this.box(25,H/2-172,340,344,'#fff5df',20,'#c5956c');
      this.text('声音设置',195,H/2-135,23);
      this.button(s.muted?'声音：关':'声音：开',75,H/2-99,240,39,()=>s.toggleSound(),{active:!s.muted,size:15});
      this.button('音乐鸣谢',145,H/2-47,100,27,()=>{this.musicCredits=!this.musicCredits;},{size:11});
      if(this.musicCredits){this.text('Bossa Antigua · Kevin MacLeod',195,H/2+1,14);this.text('incompetech.com · CC BY 4.0',195,H/2+26,12);this.text('原曲未修改，降低音量并循环播放',195,H/2+51,11);}
      this.button('关闭',125,H/2+105,140,39,()=>{this.soundSettings=false;});
    }
  }
  drawShop() {
    const s=this.session,H=this.H-this.bottom-71,y=H-(this.tab==='decor'?184:155);
    // Room remains connected to the furniture; catalog is only a bottom toolbar.
    this.box(8,y,374,H-y-7,'#fff5df',16,'#c5956c');
    this.button('摆件',18,y+9,58,29,()=>{this.tab='decor';},{active:this.tab==='decor',size:12});
    this.button('主题',81,y+9,58,29,()=>{this.tab='themes';},{active:this.tab==='themes',size:12});
    if(this.selectedDecor&&this.tab==='decor'){
      this.button('翻转',154,y+9,53,29,()=>s.flip(this.selectedDecor),{size:11});
      this.button('收起',211,y+9,53,29,()=>{s.store(this.selectedDecor);this.selectedDecor=null;},{size:11});
    }
    this.button('完成',299,y+9,68,29,()=>this.showMenuPage('home'),{active:true,size:12});
    if(this.tab==='themes')SHOP_THEMES.forEach((theme,i)=>{
      const x=18+i*120;this.sprite('menu/'+theme.image,null,x,y+43,111,56);
      this.button(theme.name,x,y+104,111,28,()=>{if(this.previewTheme!==theme.id){this.previewTheme=theme.id;return;}const r=s.theme(theme.id);if(!r.changed&&r.reason==='coins')this.notice('金币不足');else this.previewTheme=null;},{active:(this.previewTheme||s.shop.theme)===theme.id,size:11});
      this.text(s.shop.ownedThemes.includes(theme.id)?'已拥有':theme.price+' 金币',x+55,y+96,10);
    });else {
      DECOR_FILTERS.forEach((group,i)=>this.button(group.name,18+i*50,y+43,44,23,()=>{this.decorCategory=group.id;this.decorPage=0;},{active:this.decorCategory===group.id,size:10}));
      const items=getDecorCatalog(this.decorCategory),pages=Math.ceil(items.length/5);this.decorPage=Math.min(this.decorPage,pages-1);
      this.button('‹',255,y+43,27,23,()=>{this.decorPage--;},{disabled:this.decorPage===0,size:12});
      this.text((this.decorPage+1)+'/'+pages,309,y+55,10);
      this.button('›',338,y+43,27,23,()=>{this.decorPage++;},{disabled:this.decorPage===pages-1,size:12});
      items.slice(this.decorPage*5,this.decorPage*5+5).forEach((item,i)=>{
        const x=16+i*73,art=DECOR_ART[item.id];this.sprite(art.file,art.crop,x+8,y+70,54,46);
        this.button(item.name,x,y+125,68,27,()=>{const r=s.buy(item.id);if(r.changed||r.reason==='placed')this.selectedDecor=item.id;else this.notice(r.reason==='coins'?'金币不足':'暂时没有合适位置');},{size:10});
        this.text(s.shop.owned.includes(item.id)?'已拥有':item.price+' 金币',x+34,y+164,10);
      });
    }
  }
  drawGame() {
    const s=this.session,g=s.game,H=this.H-this.bottom,top=this.top;this.box(0,0,W,this.H,'#93ded8',0);
    this.button('小店',12,top+9,55,29,()=>s.menu(),{size:12});
    this.text('订单 '+g.served+'/'+g.customers.length,124,top+24,12);this.text('备料 '+g.rail.length+'/7',226,top+24,12);
    this.button(s.muted?'静音':'♪',326,top+9,49,29,()=>s.toggleSound(),{size:12});
    this.text(g.mode==='endless'?'无尽 · 第 '+g.wave+' 波':'第 '+(g.levelIndex+1)+' 天 · '+s.level.name,15,top+51,11,'#527d77','left');
    if(Number.isFinite(g.timeRemainingMs))this.text((g.timeStarted?(s.delivery||this.motionTime<this.mergeUntil?'暂停 ':'剩余 '):'点牌开始 ')+formatTime(g.timeRemainingMs),375,top+51,11,g.timeRemainingMs<=20000?'#ae453f':'#376f72','right');
    const customerY=top+65;this.box(12,customerY,366,98,'#fff5df',17);
    getVisibleCustomers(g).forEach((cat,i)=>{const x=40+i*115,pose=jellyPose(i===0&&s.delivery>470?(s.delivery-470)/290:-1,.55);
      this.ctx.save();if(i>0)this.ctx.globalAlpha=.85;this.ctx.translate(x+39,customerY+87+pose.y);this.ctx.scale(pose.sx,pose.sy);this.sprite('cat-portraits-v1.png',CAT_CROPS[cat.skin],-39,-80,78,80);this.ctx.restore();
      this.box(x+57,customerY+6,29,27,'#fffbed',9,'#deb587');this.food('sushi',RECIPES[cat.order].foodSprite,x+60,customerY+9,23,21);
    });
    const bay={x:21,y:top+196,w:348,h:H-top-387},shape=BOARD_SHAPES[s.level.shape];
    const board=shapeBoardFrame(bay,s.level.shape);this.board=board;
    this.box(12,top+170,366,bay.h+45,'#b96e4f',18,'#b97f60');this.text(g.tiles.some(t=>t.active&&t.sealed)?SEAL_HINT:shape?.label||'食材台',28,top+187,11,'#fff5df','left');this.text('剩 '+g.tiles.filter(t=>t.active).length,365,top+187,11,'#fff5df','right');
    this.box(bay.x,bay.y,bay.w,bay.h,shape?'#f2ddb8':'#efd19a',11);
    drawShapeGuide(this.ctx,s.level.shape,board);
    const coverDepths=getTileCoverDepths(g);
    const tiles=g.tiles.filter(t=>t.active).sort((a,b)=>a.layer-b.layer||a.y-b.y||a.x-b.x);
    for(const tile of tiles){const w=board.w*(shape?s.level.footprint.x/100:.195),h=shape?board.h*s.level.footprint.y/100:Math.min(87,board.h*s.level.footprint.y/100*.85),x=board.x+tile.x/100*board.w-w/2,y=board.y+tile.y/100*board.h-h/2,depth=coverDepths.get(tile.id),open=depth===0,back=tileDepthAppearance(depth);
      this.elastic('tile:'+tile.id,x,y,w,h,()=>{this.ctx.save();this.ctx.translate(x+w/2,y+h/2);this.ctx.rotate(tile.tilt*Math.PI/180);this.box(-w/2+1,-h/2+4,w,h,open?'#bf9d70':back.side,11);this.box(-w/2,-h/2,w,h,open?'#fffcf0':back.face,10,open?(tile.sealed?'#aec399':'#dcb37f'):back.border);if(open){this.food('ingredient',tile.ingredient,-w*.41,-h*.41,w*.82,h*.82);if(tile.sealed||this.sealPeels.has(tile.id))this.drawSeal(tile,w,h);}this.ctx.restore();});
      const available=open&&!tile.sealed&&g.status==='playing'&&this.motionTime>=this.mergeUntil;
      this.hit(x,y,w,h,available?()=>this.pickTile(tile,{x:x+w/2,y:y+h/2,w,h}):null,available?{key:'tile:'+tile.id}:{});
    }
    const prepY=H-174;this.box(12,prepY,366,74,'#fff2d4',14,'#cb8d63');
    const customer=getVisibleCustomers(g)[0];this.text(customer?RECIPES[customer.order].label:'今天收工',26,prepY+20,12,'#9b5b42','left');
    if(g.workbench.crafted){
      const id=RECIPES[g.workbench.crafted.recipeId].foodSprite;
      if(s.delivery<240){const pose=jellyPose(s.delivery/240,.95);this.ctx.save();this.ctx.translate(195,prepY+44+pose.y);this.ctx.scale(pose.sx,pose.sy);this.food('sushi',id,-25,-41,51,51);this.ctx.restore();}
      else if(s.delivery<590){const pose=flightPose((s.delivery-240)/350,{x:195,y:prepY+28,w:51,h:51},{x:79,y:customerY+52,w:43,h:43});this.food('sushi',id,pose.x-pose.w/2,pose.y-pose.h/2,pose.w,pose.h);}
    }
    else this.elastic('prep',168,prepY+10,144,46,()=>getRecipeSlots(g).forEach((slot,i)=>this.food('ingredient',slot.ingredient,175+i*48,prepY+15,39,39,slot.filled?1:.22)),.7);
    this.box(12,H-94,366,82,'#cf926b',14,'#b67752');this.text('备料栏',27,H-79,11,'#fff5e5','left');this.button('撤回 ×'+g.undoTokens,284,H-89,80,23,()=>{this.clearMotion();s.undo();},{disabled:this.motionTime<this.mergeUntil||!g.undoTokens||!g.rail.length,size:10});
    const rail=getRailTiles(g);for(let i=0;i<7;i++){const x=24+i*49;this.box(x,H-61,44,42,'#8f8495',8,'#6e627d');if(rail[i]&&!this.flights.has(rail[i].id))this.elastic('rail:'+rail[i].id,x,H-61,44,42,()=>{this.box(x,H-61,44,42,'#fff8e6',8,'#f0d4a7');this.food('ingredient',rail[i].ingredient,x+4,H-58,36,36);},.45);}
    this.drawFlights();
    if(g.status!=='playing')this.drawResult();
  }
  drawResult() {
    const s=this.session,g=s.game,summary=outcomeSummary(g),won=summary.won;
    const height=won?526:438,y=(this.H-height)/2,c=this.ctx;this.hits=[];
    if(this.resultGame!==g){this.resultGame=g;this.resultStarted=this.motionTime;}
    const age=this.motionTime-this.resultStarted;
    this.box(0,0,W,this.H,'#543b2b99',0);this.box(23,y,344,height,'#fff4db',23,'#c7996b');
    this.text(summary.kicker,195,y+23,11,'#95734f');
    if(won){
      ['ginger','calico','gray'].forEach((skin,i)=>this.sprite('cat-portraits-v1.png',CAT_CROPS[skin],68+i*91,y+39,68,71));
      const reveal=Math.min(1,age/550);c.save();c.translate(195,y+168);c.scale(.85+.15*reveal,.85+.15*reveal);this.sprite('victory-platter-v1.png',null,-140,-72,280,138);c.restore();
      for(let i=0;i<3;i++){
        const earned=i<summary.stars,p=Math.max(0,Math.min(1,(age-180-i*220)/520)),scale=earned?.45+.55*p:1;
        c.save();c.translate(149+i*46,y+232);c.scale(scale,scale);c.globalAlpha=earned?p:1;c.beginPath();
        for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,r=k%2?8:18;k?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
        c.closePath();c.fillStyle=earned?'#edb13e':'#dbcdb1';c.fill();c.restore();
      }
      c.save();c.beginPath();c.rect(26,y+3,338,height-6);c.clip();
      for(let i=0;i<18;i++){const p=(age-i%5*80)/1800;if(p<0||p>1)continue;c.save();c.globalAlpha=Math.sin(p*Math.PI)*.7;c.translate(44+i*71%300,y+15+p*270);c.rotate(p*5);this.box(-3,-5,6,10,['#de9c43','#db775d','#76977f'][i%3],2);c.restore();}c.restore();
    }else if(summary.reason==='timeout'){
      c.save();c.translate(0,-7*(1-Math.min(1,age/500)));c.beginPath();c.arc(150,y+112,27,0,Math.PI*2);c.strokeStyle='#b36755';c.lineWidth=4;c.stroke();c.beginPath();c.moveTo(150,y+94);c.lineTo(150,y+112);c.lineTo(164,y+116);c.stroke();this.text('0:00',222,y+112,35,'#b36755');c.restore();
    }else{const width=summary.rail.length*43,x0=(390-width)/2;summary.rail.forEach((id,i)=>{this.box(x0+i*43,y+85,39,44,'#fff9e7',7,'#c99a72');this.food('ingredient',id,x0+3+i*43,y+89,33,35);});}
    const titleY=won?y+272:y+175;
    this.text(summary.title,195,titleY,23,'#a05d3e');
    if(!won)this.text(summary.failureLabel,195,y+207,12,'#ae6250');
    const statsY=won?y+316:y+255;
    [[summary.orders,'完成订单'],[summary.elapsed,'操作用时'],['+'+Math.round(summary.coins*Math.min(1,age/680)),'营业收入']].forEach(([value,label],i)=>{this.text(value,85+i*110,statsY,22,'#be7a2e');this.text(label,85+i*110,statsY+24,10,'#95734f');});
    this.text(summary.detail,195,statsY+49,11);
    const buttonY=won?y+383:y+326;
    this.button(summary.primary,60,buttonY,270,44,()=>s.advance(),{active:true,size:18});
    if(won)this.button(summary.replay,88,buttonY+54,214,34,()=>s.replay(),{size:13});
    this.button(summary.secondary,121,y+height-42,148,29,()=>s.menu(),{size:12});
  }
}
