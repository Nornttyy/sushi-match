// Flat tray guides and responsive geometry shared by DOM and native Canvas.
// Food artwork stays in the existing atlases; these paths are UI, not textures.
const oval=(cx,cy,rx,ry)=>[['M',cx-rx,cy],['C',cx-rx,cy-ry*.552,cx-rx*.552,cy-ry,cx,cy-ry],
  ['C',cx+rx*.552,cy-ry,cx+rx,cy-ry*.552,cx+rx,cy],['C',cx+rx,cy+ry*.552,cx+rx*.552,cy+ry,cx,cy+ry],
  ['C',cx-rx*.552,cy+ry,cx-rx,cy+ry*.552,cx-rx,cy],['Z']];
const plate=(x,w,y=5,h=90)=>[['M',x+7,y],['L',x+w-7,y],['Q',x+w,y,x+w,y+7],['L',x+w,y+h-7],
  ['Q',x+w,y+h,x+w-7,y+h],['L',x+7,y+h],['Q',x,y+h,x,y+h-7],['L',x,y+7],['Q',x,y,x+7,y],['Z']];
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
  ]},
  'roll-wide':{label:'横切寿司卷',ratio:.9,paths:[
    path(oval(50,50,49,40),'#789671','#527450'),
    path(oval(50,50,44,35),'#fff4d5','#d4d9a1'),
    path(oval(50,50,20,17),'#f7cba6','#e3b78f')
  ]},
  'duo-stagger':{label:'错位双拼',ratio:.92,paths:[
    path(plate(1,46,1,81),'#e4edce','#8ba579'),path(plate(53,46,18,81),'#fbe0c7','#ca9d7c'),
    path(plate(4,40,4,75),'none','#faf8db',.9),path(plate(56,40,21,75),'none','#fff0d8',.9)
  ]},
  boat:{label:'寿司船',ratio:.92,paths:[
    path([['M',2,50],['Q',18,3,50,3],['Q',82,3,98,50],['Q',82,97,50,97],['Q',18,97,2,50],['Z']],'#ddb78b','#ac805a'),
    path([['M',7,50],['Q',21,8,50,8],['Q',79,8,93,50],['Q',79,92,50,92],['Q',21,92,7,50],['Z']],'#fff0d0','#c79c70')
  ]},
  flower:{label:'花瓣餐盘',ratio:.96,paths:[
    path([['M',34,2],['L',66,2],['Q',77,2,77,15],['L',77,23],['L',85,23],['Q',98,23,98,34],
      ['L',98,66],['Q',98,77,85,77],['L',77,77],['L',77,85],['Q',77,98,66,98],['L',34,98],
      ['Q',23,98,23,85],['L',23,77],['L',15,77],['Q',2,77,2,66],['L',2,34],['Q',2,23,15,23],
      ['L',23,23],['L',23,15],['Q',23,2,34,2],['Z']],'#f3d6cf','#c69791'),
    path(oval(50,50,23,23),'#ffedc8','#ddba91')
  ]},
  fan:{label:'折扇餐盘',ratio:.92,paths:[
    path([['M',2,18],['Q',50,0,98,18],['L',71,94],['Q',50,99,29,94],['Z']],'#dbe6c5','#8da478'),
    path([['M',8,21],['Q',50,6,92,21],['L',67,88],['Q',50,93,33,88],['Z']],'#f4f0cd','#b8c29a'),
    path([['M',50,91],['L',31,18],['M',50,91],['L',69,18]],'none','#d2d6b3',.8)
  ]},
  bento:{label:'四格便当',ratio:.96,paths:[
    path(plate(1,98,1,98),'#d8b490','#aa805c'),
    path(plate(3,46,3,46),'#e4edce','#abbe91'),path(plate(51,46,3,46),'#f9ddc6','#d0a28a'),
    path(plate(3,46,51,46),'#f9e9bd','#d2b784'),path(plate(51,46,51,46),'#dce8e2','#9ebcac')
  ]}
};
BOARD_SHAPES['fish-left']={label:'逆游小鱼',ratio:BOARD_SHAPES.fish.ratio,
  paths:BOARD_SHAPES.fish.paths.map(p=>({...p,commands:p.commands.map(([cmd,...values])=>
    [cmd,...values.map((n,i)=>i%2===0?100-n:n)])}))};
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
