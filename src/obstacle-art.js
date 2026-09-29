import { isObstacleLocked } from './obstacles.js';
import { OBSTACLE_ASSETS } from './obstacle-assets.js';
import { clippedAtlas } from './atlas-art.js';

// Generated PNGs supply the artwork. Only live numeric UI is drawn by code.
const sprite=(asset,x,y,w,h)=>({type:'sprite',asset,x,y,w,h});
const badge=(value,x,y,w=17,h=16,color='#90613b',fill='#fff1cf')=>({type:'badge',value:String(value),x,y,w,h,color,fill});

export function obstacleArt(tile,served=0){
  const parts=[],o=tile.obstacle;
  if(isObstacleLocked(tile,served)){
    if(o.kind==='ice')parts.push(sprite(o.remaining>1?'iceFull':'iceCracked',1,1,62,62),badge(o.remaining,45,46,17,16,'#437f8c','#eefbfc'));
    else if(o.kind==='lock')parts.push(sprite('lock',20,30,25,32),badge(o.key,45,46));
    else parts.push(sprite('crate',1,1,62,62),{type:'text',value:Math.max(0,o.orders-served)+'单',x:53,y:55,size:10,color:'#90613b',rotate:-16});
  }
  if(tile.key&&!tile.keyUsed)parts.push(sprite('key',3,3,29,16),badge(tile.key,32,3,15,15));
  return parts;
}

export function drawObstacleArt(ctx,tile,served,x,y,w,h,images){
  ctx.save();ctx.translate(x,y);ctx.scale(w/64,h/64);
  for(const part of obstacleArt(tile,served)){
    if(part.type==='sprite'){
      const a=OBSTACLE_ASSETS[part.asset],img=images?.get(a.file);
      if(img)ctx.drawImage(img,...a.crop,part.x,part.y,part.w,part.h);
      continue;
    }
    ctx.save();
    if(part.type==='badge'){
      const {x,y,w,h}=part,r=5;ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
      ctx.fillStyle=part.fill;ctx.fill();ctx.strokeStyle=part.color;ctx.lineWidth=1.4;ctx.stroke();ctx.translate(x+w/2,y+h/2);
    }else {ctx.translate(part.x,part.y);ctx.rotate((part.rotate||0)*Math.PI/180);}
    ctx.font='800 '+(part.size||12)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=part.color;ctx.fillText(part.value,0,0);ctx.restore();
  }
  ctx.restore();
}

export function renderObstacleArt(button,tile,served,visible){
  const parts=visible?obstacleArt(tile,served):[],signature=JSON.stringify(parts);
  if(button.dataset.obstacleArt===signature)return;
  const previous=button.querySelector('.obstacle-art:not(.is-opening)');
  // The shared cosmetic layer carries the original sprite pieces away.
  // Remove the old static overlay immediately; never fade a duplicate on top.
  if(previous)previous.remove();
  if(!visible)button.querySelectorAll('.obstacle-art').forEach(n=>n.remove());
  button.dataset.obstacleArt=signature;if(!parts.length)return;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  svg.classList.add('obstacle-art');if(previous&&visible)svg.classList.add('is-changed');
  const attrs=(node,values)=>{for(const [k,v] of Object.entries(values))node.setAttribute(k,String(v));return node;};
  for(const part of parts){
    if(part.type==='sprite'){
      const art=OBSTACLE_ASSETS[part.asset],node=clippedAtlas({...art,file:'./assets/'+art.file},art.crop);
      attrs(node,{x:part.x,y:part.y,width:part.w,height:part.h,preserveAspectRatio:'none','data-obstacle-sprite':part.asset});svg.append(node);continue;
    }
    if(part.type==='badge')svg.append(attrs(document.createElementNS(ns,'rect'),{x:part.x,y:part.y,width:part.w,height:part.h,rx:5,fill:part.fill,stroke:part.color,'stroke-width':1.4}));
    const node=document.createElementNS(ns,'text'),x=part.type==='badge'?part.x+part.w/2:part.x,y=part.type==='badge'?part.y+part.h/2:part.y;
    attrs(node,{x,y,fill:part.color,'font-size':part.size||12,'font-family':'sans-serif','font-weight':800,'text-anchor':'middle','dominant-baseline':'central'});
    if(part.rotate)node.setAttribute('transform','rotate('+part.rotate+' '+x+' '+y+')');
    node.textContent=part.value;svg.append(node);
  }
  button.append(svg);
}
