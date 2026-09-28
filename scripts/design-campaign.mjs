// Offline level-design tool. Emits an apply_patch patch; never shuffles a
// shipped campaign on a player's device. Geometry, orders and rewards stay put.
import { CAMPAIGN_LAYOUTS } from '../src/campaign-layouts.js';
import { RECIPES } from '../src/game-core.js';
import { generateLayout, layoutMixMetrics } from '../src/level-generator.js';
import { areSealNeighbours } from '../src/nori-seals.js';
import { readFileSync } from 'node:fs';

function designSeals(layout, day) {
  if(day<4)return [];
  const steps=new Map(layout.solution.map((id,i)=>[id,i])),events=new Map(layout.tiles.map(t=>[t.id,[]]));
  let rail=[];
  layout.solution.forEach((id,step)=>{
    const tile=layout.tiles.find(t=>t.id===id);rail.push(tile);
    const match=rail.filter(t=>t.ingredient===tile.ingredient);
    if(match.length!==3)return;
    for(const t of layout.tiles)if(steps.get(t.id)>step&&match.some(m=>areSealNeighbours(t,m)))events.get(t.id).push(step);
    rail=rail.filter(t=>t.ingredient!==tile.ingredient);
  });
  const candidates=layout.tiles.flatMap((t,index)=>{
    const hits=events.get(t.id);
    const exposed=1+Math.max(-1,...layout.tiles.filter(o=>o.layer>t.layer&&Math.abs(o.x-t.x)<layout.footprint.x&&Math.abs(o.y-t.y)<layout.footprint.y).map(o=>steps.get(o.id)));
    return hits.length&&hits[0]>=exposed?[{index,hits,exposed,tile:t}]:[];
  });
  const depths=day===4?[1,1]:day<=6?[2,1,1]:day<=12?[2,2,1,1]:day<=18?[2,2,2,1,1]:[3,2,2,1,1,1];
  const selected=[];
  for(const depth of depths){
    const options=candidates.filter(c=>c.hits.length>=depth&&!selected.some(s=>s[0]===c.index));
    options.sort((a,b)=>a.exposed-b.exposed||a.hits[depth-1]-b.hits[depth-1]);
    if(!options.length)return null;
    selected.push([options[0].index,depth]);
  }
  return selected;
}

const designs=[];
for(const record of CAMPAIGN_LAYOUTS){
  const {cards,solution,seals,designVersion,designSeed,...info}=record;
  let chosen;
  for(let attempt=0;attempt<120&&!chosen;attempt++){
    const seed=(0x51f151+info.id*7919+attempt*104729)>>>0;
    const layout=generateLayout({id:info.id,groups:info.orders.flatMap(id=>RECIPES[id].ingredients),seed,rank:info.id,
      positions:cards.map(([,layer,x,y,tilt])=>({layer,x,y,tilt})),footprint:info.footprint,attempts:256});
    if(layoutMixMetrics(layout.tiles,info.footprint).largestCluster>2)continue;
    const nextSeals=designSeals(layout,info.id);if(!nextSeals)continue;
    const ids=new Map(layout.tiles.map((t,i)=>[t.id,i]));
    chosen={...info,designVersion:2,designSeed:seed,
      cards:layout.tiles.map(t=>[t.ingredient,t.layer,t.x,t.y,t.tilt]),solution:layout.solution.map(id=>ids.get(id)),seals:nextSeals};
  }
  if(!chosen)throw Error('No bounded, mixed, sealed design for day '+info.id);
  designs.push(chosen);
}
if(process.argv.includes('--patch')){
  const old=readFileSync(new URL('../src/campaign-layouts.js',import.meta.url),'utf8');
  const fresh='// Fixed campaign edition 2. Cards: [ingredient, layer, x%, y%, tilt].\n'
    +'// Authored offline with design-campaign.mjs; seals: [card index, layers].\n'
    +'// Every saved witness is replayed with the actual seven-slot, seal and timer rules.\n'
    +'export const CAMPAIGN_LAYOUTS = [\n'+designs.map(r=>'  '+JSON.stringify(r)).join(',\n')+'\n];\n';
  process.stdout.write('*** Begin Patch\n*** Update File: '+new URL('../src/campaign-layouts.js',import.meta.url).pathname+'\n@@\n'
    +old.trimEnd().split('\n').map(l=>'-'+l).join('\n')+'\n'+fresh.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch');
}else console.log(JSON.stringify(designs.map(r=>({day:r.id,seals:r.seals,seed:r.designSeed})),null,2));
