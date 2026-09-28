// Version 1 is a fixed course: no clock, device state, retry count or wallet
// enters the seed. Keep this recipe stable so saved day numbers keep their deal.
import { CAMPAIGN_LAYOUTS } from './campaign-layouts.js';
import { generateLayout, randomSource, layoutMixMetrics } from './level-generator.js';
import { areSealNeighbours } from './nori-seals.js';

const FAMILIES = [['roll','roll-wide'],['fish','fish-left'],['duo','duo-stagger'],['boat'],['flower'],['fan'],['bento']];
const NAMES = {roll:'卷心拼盘','roll-wide':'横卷拼盘',fish:'鲜鱼拼盘','fish-left':'回游鲜鱼',duo:'双拼餐盘','duo-stagger':'错位双拼',boat:'寿司船',flower:'花开寿司',fan:'扇形盛宴',bento:'四格便当'};
const RHYTHM = [0,1,1,2,2,1,2,3,2,1];
const shuffle = (items, random) => {
  const result = [...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
};

export function campaignSeed(index) {
  // Hash every digit, rather than truncating the day to 32 bits.
  let seed = 2166136261;
  for(const char of 'sushi-campaign-v1:'+index)seed=Math.imul(seed^char.charCodeAt(0),16777619);
  return seed>>>0;
}

function cellsFor(shape) {
  const grid=(xs,ys)=>ys.flatMap(y=>xs.map(x=>[x,y]));
  const fish=[[12,25],[12,50],[12,75],[31,50],[50,25],[50,50],[50,75],[69,25],[69,50],[69,75],[88,37.5],[88,62.5]];
  switch(shape){
    case 'roll': return [[30,22],[50,18],[70,22],[80,48],[70,74],[50,78],[30,74],[20,48],[50,48]];
    case 'roll-wide': return [[26,24],[50,24],[74,24],[86,50],[74,76],[50,76],[26,76],[14,50],[50,50]];
    case 'fish': return fish;
    case 'fish-left': return fish.map(([x,y])=>[100-x,y]);
    case 'duo': return grid([16,36,64,84],[22,50,78]);
    case 'duo-stagger': return grid([16,36,64,84],[25,50,75]).map(([x,y])=>[x,y+(x<50?-8:8)]);
    case 'boat': return [...grid([31,50,69],[22]),...grid([12,31,50,69,88],[50]),...grid([31,50,69],[78])];
    case 'flower': return grid([14,38,62,86],[14,38,62,86]).filter(([x,y])=>!([14,86].includes(x)&&[14,86].includes(y)));
    case 'fan': return [...grid([12,31,50,69,88],[22]),...grid([31,50,69],[50]),...grid([40,60],[78])];
    default: return grid([14,37,63,86],[14,37,63,86]);
  }
}

function positionsFor(shape, count, stage, random) {
  const cells=cellsFor(shape),minimum=Math.ceil(count/cells.length);
  const depth=Math.min(8,Math.max(minimum,5+stage+Math.floor(random()*2)));
  const positions=[];
  let remaining=count;
  for(let layer=0;layer<depth;layer++){
    const left=depth-layer-1;
    const amount=layer===0?cells.length:Math.max(3,Math.ceil(remaining/(left+1)));
    const take=Math.min(cells.length,amount,remaining-left*3);
    const dx=(random()-.5)*3,dy=(random()-.5)*3;
    for(const [x,y] of shuffle(cells,random).slice(0,take))positions.push({layer,x:+(x+dx).toFixed(2),y:+(y+dy).toFixed(2),tilt:0});
    remaining-=take;
  }
  if(remaining)throw new Error('Invalid campaign position budget');
  return positions;
}

function sealsFor(layout, stage, random) {
  const steps=new Map(layout.solution.map((id,i)=>[id,i]));
  const events=new Map(layout.tiles.map(t=>[t.id,[]])),byId=new Map(layout.tiles.map(t=>[t.id,t]));
  let rail=[];
  layout.solution.forEach((id,step)=>{
    const tile=byId.get(id);rail.push(tile);
    const match=rail.filter(t=>t.ingredient===tile.ingredient);
    if(match.length!==3)return;
    for(const t of layout.tiles)if(steps.get(t.id)>step&&match.some(m=>areSealNeighbours(t,m)))events.get(t.id).push(step);
    rail=rail.filter(t=>t.ingredient!==tile.ingredient);
  });
  const options=shuffle(layout.tiles.map((t,index)=>{
    const hits=events.get(t.id);
    const exposed=1+Math.max(-1,...layout.tiles.filter(o=>o.layer>t.layer&&Math.abs(o.x-t.x)<layout.footprint.x&&Math.abs(o.y-t.y)<layout.footprint.y).map(o=>steps.get(o.id)));
    return {index,hits,exposed};
  }).filter(c=>c.hits.length&&c.hits[0]>=c.exposed),random);
  const depths=[[1,1,1],[2,1,1,1],[2,2,1,1,1],[3,2,2,1,1,1]][stage],result=[];
  for(const desired of depths){
    const available=options.filter(c=>!result.some(s=>s[0]===c.index));
    const depth=Math.min(desired,Math.max(0,...available.map(c=>c.hits.length)));
    const candidate=available.find(c=>c.hits.length>=depth);
    if(!candidate)return null;
    result.push([candidate.index,depth]);
  }
  return result;
}

function fallbackRecord(index, shape, stage, seed) {
  const random=randomSource(seed^0x3b57fa);
  const pool=CAMPAIGN_LAYOUTS.filter(l=>l.shape===shape&&l.id>=13);
  const source=pool[Math.floor(random()*pool.length)];
  const map={},recipes={};
  // These substitutions preserve each recipe's ingredient arity and every
  // equality in the known-good rail/seal witness, including salmon rolls.
  for(const group of [['tuna','shrimp','tamago'],['cucumber','avocado','roe']]){
    const next=shuffle(group,random);group.forEach((id,i)=>{map[id]=next[i];});
  }
  const roll={cucumber:'makiCucumber',avocado:'makiAvocado',roe:'roe'};
  for(const id of ['tuna','shrimp','tamago'])recipes[id]=map[id];
  for(const id of ['cucumber','avocado','roe'])recipes[roll[id]]=roll[map[id]];
  return {...source,id:index+1,name:NAMES[shape],assist:false,generatorVersion:1,generationFallback:true,designSeed:seed,
    difficulty:['进阶','挑战','挑战','高手'][stage],undoLimit:stage<2?2:1,
    orders:source.orders.map(id=>recipes[id]||id),
    cards:source.cards.map(([food,...rest])=>[map[food]||food,...rest]),
    solution:[...source.solution],seals:source.seals.map(s=>[...s])};
}

export function generateCampaignRecord(index, recipes, {fallback=false}={}) {
  const seed=campaignSeed(index),random=randomSource(seed),offset=index-CAMPAIGN_LAYOUTS.length;
  const family=FAMILIES[offset%FAMILIES.length],shape=family[Math.floor(random()*family.length)];
  const stage=RHYTHM[offset%RHYTHM.length];
  if(fallback)return fallbackRecord(index,shape,stage,seed);
  const simple=shuffle(['salmon','tuna','shrimp','tamago'],random),rolls=shuffle(['makiCucumber','makiSalmon','makiAvocado','roe'],random);
  const orderCount=8+stage;
  let rollCount=stage<2?4:5;
  const capacity=Math.min(84,cellsFor(shape).length*8);
  while((orderCount*2+rollCount)*3>capacity)rollCount--;
  const orders=shuffle([...Array.from({length:orderCount-rollCount},(_,i)=>simple[i%simple.length]),
    ...Array.from({length:rollCount},(_,i)=>rolls[i%rolls.length])],random);
  const groups=orders.flatMap(id=>recipes[id].ingredients),footprint={x:17.5,y:shape==='bento'?23:24};
  // Bounded work on phones, followed by a proven authored fallback. Never
  // retry until lucky or relax solvability/dispersion to accept a bad board.
  for(let attempt=0;attempt<4;attempt++){
    const positions=positionsFor(shape,groups.length*3,stage,random);
    const layout=generateLayout({id:index+1,groups,seed:seed^Math.imul(attempt+1,104729),rank:stage+1,positions,footprint,attempts:8});
    const mix=layoutMixMetrics(layout.tiles,footprint);
    if(mix.largestCluster>2||mix.dominance>0)continue;
    const seals=sealsFor(layout,stage,random);if(!seals)continue;
    const ids=new Map(layout.tiles.map((t,i)=>[t.id,i]));
    return {id:index+1,name:NAMES[shape],shape,orders,footprint,railLimit:7,undoLimit:stage<2?2:1,
      difficulty:['进阶','挑战','挑战','高手'][stage],subtitle:'',assist:false,designVersion:6,generatorVersion:1,designSeed:seed,
      cards:layout.tiles.map(t=>[t.ingredient,t.layer,t.x,t.y,t.tilt]),solution:layout.solution.map(id=>ids.get(id)),seals};
  }
  return fallbackRecord(index,shape,stage,seed);
}
