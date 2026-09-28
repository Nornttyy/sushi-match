// Flat, deterministic obstacles layered onto the existing deal. Neither the
// ingredients, positions, order queue nor the solution are shuffled here.
export const OBSTACLE_NAMES = Object.freeze({ ice:'冰块', lock:'钥匙锁', crate:'订单封箱' });
export const OBSTACLE_HINTS = Object.freeze({ ice:'冰块：露出后三消解冻', lock:'钥匙锁：先取同号钥匙牌', crate:'封箱：出餐后自动打开' });

export function isObstacleLocked(tile, served = 0) {
  const o=tile?.obstacle;
  return !!o && (o.kind==='ice' ? o.remaining>0 : o.kind==='lock' ? !o.open : o.kind==='crate' ? served<o.orders : false);
}

export function obstacleLabel(tile, served = 0) {
  const o=tile.obstacle;
  if(isObstacleLocked(tile,served))return o.kind==='ice' ? o.remaining+'层冰块，露出后三消解冻'
    : o.kind==='lock' ? '先取'+o.key+'号钥匙牌' : '再出餐'+Math.max(0,o.orders-served)+'单开箱';
  return tile.key&&!tile.keyUsed ? tile.key+'号钥匙牌' : '';
}

export function boardObstacleHint(state, visibleIds) {
  const target=state.tiles.find(t=>t.active&&visibleIds.has(t.id)&&isObstacleLocked(t,state.served));
  return target ? OBSTACLE_HINTS[target.obstacle.kind] : '';
}

function schedule(day) {
  if(day<7)return [];
  if(day<11)return ['ice'];
  if(day<13)return ['lock'];
  if(day<15)return ['ice','lock'];
  if(day<17)return ['crate'];
  return [['ice'],['lock'],['crate'],['ice','lock'],['lock','crate'],['ice','crate'],['ice','lock','crate'],[]][(day-17)%8];
}

export function addCampaignObstacles(level, recipes) {
  const kinds=schedule(level.id);if(!kinds.length)return level;
  const tiles=level.tiles.map(t=>({...t})),byId=new Map(tiles.map(t=>[t.id,t]));
  const steps=new Map(level.solution.map((id,i)=>[id,i])),exposed=new Map();
  for(const t of tiles)exposed.set(t.id,1+Math.max(-1,...tiles.filter(u=>u.layer>t.layer&&Math.abs(u.x-t.x)<level.footprint.x&&Math.abs(u.y-t.y)<level.footprint.y).map(u=>steps.get(u.id))));
  let rail=[],served=0;const pantry={},triples=[],servedBefore=[],deliverySteps=[];
  for(const [step,id] of level.solution.entries()){
    servedBefore[step]=served;const t=byId.get(id);rail.push(t.ingredient);
    if(rail.filter(f=>f===t.ingredient).length===3){
      rail=rail.filter(f=>f!==t.ingredient);pantry[t.ingredient]=(pantry[t.ingredient]||0)+1;triples.push(step);
      while(served<level.orders.length&&recipes[level.orders[served]].ingredients.every(f=>pantry[f]>0)){
        for(const food of recipes[level.orders[served]].ingredients)pantry[food]--;
        served++;deliverySteps.push(step);
      }
    }
  }
  const free=t=>!t.sealed&&!t.obstacle&&!t.key;
  const candidates=()=>tiles.filter(free).sort((a,b)=>exposed.get(a.id)-exposed.get(b.id)||steps.get(a.id)-steps.get(b.id));
  for(const kind of kinds){
    const count=kind==='ice'&&level.id>=19?2:1;
    for(let n=0;n<count;n++){
      if(kind==='ice'){
        const target=candidates().find(t=>triples.some(s=>s>=exposed.get(t.id)&&s<steps.get(t.id)));
        if(!target)continue;
        const hits=triples.filter(s=>s>=exposed.get(target.id)&&s<steps.get(target.id)).length;
        target.obstacle={kind,remaining:Math.min(level.id>=19?2:1,hits)};
      }else if(kind==='lock'){
        for(const target of candidates()){
          const key=candidates().find(t=>t!==target&&steps.get(t.id)>=exposed.get(target.id)&&steps.get(t.id)+3<=steps.get(target.id));
          if(!key)continue;
          key.key=1;target.obstacle={kind,key:1,open:false};break;
        }
      }else{
        // A box must be visible while still locked along the verified route.
        // Skip unsuitable positions instead of adding a meaningless box that
        // automatically opens before the player can ever see it.
        const required=t=>[1,...(level.id>=25?[2]:[])].find(n=>servedBefore[steps.get(t.id)]>=n&&exposed.get(t.id)<=deliverySteps[n-1]);
        const target=candidates().find(t=>required(t));
        if(target)target.obstacle={kind,orders:required(target)};
      }
    }
  }
  const obstacleKinds=[...new Set(tiles.filter(t=>t.obstacle).map(t=>t.obstacle.kind))];
  return obstacleKinds.length?{...level,tiles,obstacleVersion:1,obstacleKinds}:level;
}
