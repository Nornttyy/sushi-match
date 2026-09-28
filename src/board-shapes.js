// Flat tray guides and responsive geometry shared by DOM and native Canvas.
// Food artwork stays in the existing atlases; these paths are UI, not textures.
const oval=(cx,cy,rx,ry)=>[['M',cx-rx,cy],['C',cx-rx,cy-ry*.552,cx-rx*.552,cy-ry,cx,cy-ry],
  ['C',cx+rx*.552,cy-ry,cx+rx,cy-ry*.552,cx+rx,cy],['C',cx+rx,cy+ry*.552,cx+rx*.552,cy+ry,cx,cy+ry],
  ['C',cx-rx*.552,cy+ry,cx-rx,cy+ry*.552,cx-rx,cy],['Z']];
const plate=(x,w)=>[['M',x+7,5],['L',x+w-7,5],['Q',x+w,5,x+w,12],['L',x+w,88],
  ['Q',x+w,95,x+w-7,95],['L',x+7,95],['Q',x,95,x,88],['L',x,12],['Q',x,5,x+7,5],['Z']];
const path=(commands,fill,stroke,width=1.2)=>({commands,fill,stroke,width});
export const BOARD_SHAPES={
  roll:{label:'寿司卷',ratio:.9,paths:[
    path(oval(50,50,47,47),'#789671','#527450'),
    path(oval(50,50,42,42),'#fff4d5','#d4d9a1'),
    path(oval(50,50,19,24),'#f7cba6','#e3b78f')
  ]},
  fish:{label:'小鱼餐盘',ratio:.9,paths:[
    path([['M',3,13],['Q',17,17,29,34],['Q',45,5,68,10],['Q',91,15,98,50],
      ['Q',91,85,68,90],['Q',45,95,29,66],['Q',17,83,3,87],['Q',9,64,12,50],['Q',9,36,3,13],['Z']], '#d0e5ce','#7aa58c'),
    path([['M',31,35],['Q',25,50,31,65]],'none','#a9c9b1',1.3)
  ]},
  duo:{label:'双拼餐盘',ratio:.92,paths:[
    path(plate(1,46),'#e4edce','#8ba579'),path(plate(53,46),'#fbe0c7','#ca9d7c'),
    path(plate(4,40),'none','#faf8db',.9),path(plate(56,40),'none','#fff0d8',.9)
  ]}
};
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
freeze(BOARD_SHAPES);

export function shapeBoardFrame(bounds, shape) {
  const definition=BOARD_SHAPES[shape];
  if(!definition)return {...bounds};
  const h=Math.min(bounds.h,bounds.w*definition.ratio);
  return {...bounds,y:bounds.y+(bounds.h-h)/2,h};
}

export function svgPath(commands){return commands.map(command=>command.join(' ')).join(' ');}

export function drawShapeGuide(ctx, shape, bounds) {
  const definition=BOARD_SHAPES[shape];if(!definition)return;
  ctx.save();ctx.translate(bounds.x,bounds.y);ctx.scale(bounds.w/100,bounds.h/100);
  const methods={M:'moveTo',L:'lineTo',C:'bezierCurveTo',Q:'quadraticCurveTo',Z:'closePath'};
  for(const p of definition.paths){
    ctx.beginPath();for(const [command,...values] of p.commands)ctx[methods[command]](...values);
    if(p.fill!=='none'){ctx.fillStyle=p.fill;ctx.fill();}
    ctx.strokeStyle=p.stroke;ctx.lineWidth=p.width;ctx.stroke();
  }
  ctx.restore();
}
