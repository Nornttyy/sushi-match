import { isObstacleLocked } from './obstacles.js';

// Small flat status drawings, shared verbatim by SVG and WeChat Canvas.
// These are overlays, not replacement food art or emoji-font placeholders.
const path=(points,fill='none',stroke='#996b45',width=2)=>({type:'path',points,fill,stroke,width});
const rect=(x,y,w,h,fill,stroke='#996b45',radius=4)=>({type:'rect',x,y,w,h,fill,stroke,radius,width:2});
const text=(value,x,y,color='#765138',size=12)=>({type:'text',value:String(value),x,y,color,size});

export function obstacleArt(tile, served=0) {
  const shapes=[],o=tile.obstacle;
  if(isObstacleLocked(tile,served)){
    if(o.kind==='ice'){
      shapes.push(path([['M',9,4],['L',53,3],['L',60,11],['L',59,53],['L',52,60],['L',10,59],['L',4,51],['L',5,12],['Z']],'#d1f0f580','#65aab8',2.5));
      shapes.push(path([['M',10,21],['L',10,11],['L',23,10]],'none','#f4fdff',3));
      shapes.push(path([['M',54,34],['L',49,40],['L',52,49]],'none','#82b9c4',2));
      if(o.remaining===1)shapes.push(path([['M',34,5],['L',30,17],['L',36,26],['L',30,35]],'none','#7db5c2',2));
      shapes.push(rect(38,40,22,20,'#eefbfc','#65aab8',7),text(o.remaining,49,50,'#437f8c',14));
    }else if(o.kind==='lock'){
      shapes.push(rect(27,4,10,53,'#e9be65','#b38948',3));
      shapes.push(path([['M',23,42],['L',23,34],['Q',23,25,32,25],['Q',41,25,41,34],['L',41,42]],'none','#967344',4));
      shapes.push(rect(17,38,30,23,'#ffe1a0','#a57944',6),text(o.key,32,50,'#90613b',15));
    }else{
      shapes.push(rect(3,4,58,8,'#eed09a','#b78a5d',3),rect(3,52,58,8,'#eed09a','#b78a5d',3));
      shapes.push(path([['M',7,12],['L',7,50],['M',57,12],['L',57,50]],'none','#c79b66',3));
      shapes.push(rect(17,41,38,20,'#fff1cb','#b78a5d',5),text(Math.max(0,o.orders-served)+'单',36,51,'#94623f',12));
      shapes.push(path([['M',7,42],['L',16,42],['L',16,32],['M',7,36],['L',11,32],['L',15,36]],'none','#b77c4c',2));
    }
  }
  if(tile.key&&!tile.keyUsed){
    shapes.push(rect(3,3,34,21,'#fff3bf','#ba8d46',7));
    shapes.push(path([['M',11,9],['L',16,9],['L',16,14],['L',11,14],['Z'],['M',16,12],['L',23,12],['L',23,16]],'none','#ba8d46',2.5));
    shapes.push(text(tile.key,29,14,'#9b6e32',12));
  }
  return shapes;
}

function commands(ctx,points) {
  ctx.beginPath();
  for(const [op,...v] of points){if(op==='M')ctx.moveTo(...v);else if(op==='L')ctx.lineTo(...v);else if(op==='Q')ctx.quadraticCurveTo(...v);else ctx.closePath();}
}
export function drawObstacleArt(ctx,tile,served,x,y,w,h) {
  ctx.save();ctx.translate(x,y);ctx.scale(w/64,h/64);ctx.lineJoin='round';ctx.lineCap='round';
  for(const s of obstacleArt(tile,served)){
    if(s.type==='text'){
      ctx.font='800 '+s.size+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=s.color;ctx.fillText(s.value,s.x,s.y);continue;
    }
    if(s.type==='rect'){
      const {x,y,w,h,radius:r}=s;ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
    }else commands(ctx,s.points);
    if(s.fill!=='none'){ctx.fillStyle=s.fill;ctx.fill();}
    ctx.strokeStyle=s.stroke;ctx.lineWidth=s.width;ctx.stroke();
  }
  ctx.restore();
}

export function renderObstacleArt(button,tile,served,visible) {
  const shapes=visible?obstacleArt(tile,served):[],signature=JSON.stringify(shapes);
  if(button.dataset.obstacleArt===signature)return;
  const previous=button.querySelector('.obstacle-art:not(.is-opening)');
  if(previous){
    if(visible&&shapes.length===0){previous.classList.add('is-opening');previous.addEventListener('animationend',()=>previous.remove(),{once:true});}
    else previous.remove();
  }
  if(!visible)button.querySelectorAll('.obstacle-art').forEach(n=>n.remove());
  button.dataset.obstacleArt=signature;if(!shapes.length)return;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  svg.classList.add('obstacle-art');if(previous&&visible)svg.classList.add('is-changed');
  for(const s of shapes){
    const node=document.createElementNS(ns,s.type);
    if(s.type==='text'){
      for(const [k,v] of Object.entries({x:s.x,y:s.y,fill:s.color,'font-size':s.size,'font-family':'sans-serif','font-weight':800,'text-anchor':'middle','dominant-baseline':'central'}))node.setAttribute(k,String(v));
      node.textContent=s.value;
    }else{
      if(s.type==='rect')for(const [k,v] of Object.entries({x:s.x,y:s.y,width:s.w,height:s.h,rx:s.radius}))node.setAttribute(k,String(v));
      else node.setAttribute('d',s.points.map(p=>p.join(' ')).join(' '));
      for(const [k,v] of Object.entries({fill:s.fill,stroke:s.stroke,'stroke-width':s.width,'stroke-linecap':'round','stroke-linejoin':'round'}))node.setAttribute(k,String(v));
    }
    svg.append(node);
  }
  button.append(svg);
}
