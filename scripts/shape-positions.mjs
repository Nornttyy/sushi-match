// Offline-only authored silhouettes. No random geometry in the shipped game.
const roll=[[30,22],[50,18],[70,22],[80,48],[70,74],[50,78],[30,74],[20,48],[50,48]];
const fish=[[12,25],[12,50],[12,75],[31,50],[50,25],[50,50],[50,75],[69,25],[69,50],[69,75],[88,37.5],[88,62.5]];
const duo=[16,36,64,84].flatMap(x=>[22,50,78].map(y=>[x,y]));
const wide=[[26,24],[50,24],[74,24],[86,50],[74,76],[50,76],[26,76],[14,50],[50,50]];
const stagger=[16,36,64,84].flatMap(x=>[25,50,75].map(y=>[x,y+(x<50?-8:8)]));
const boat=[[31,22],[50,22],[69,22],...[12,31,50,69,88].map(x=>[x,50]),[31,78],[50,78],[69,78]];
const flower=[14,38,62,86].flatMap((y,row)=>[14,38,62,86].filter((x,col)=>!([0,3].includes(row)&&[0,3].includes(col))).map(x=>[x,y]));
const fan=[...[12,31,50,69,88].map(x=>[x,22]),...[31,50,69].map(x=>[x,50]),[40,78],[60,78]];
const bento=[14,37,63,86].flatMap(y=>[14,37,63,86].map(x=>[x,y]));
const denseRoll=[22,48,74].flatMap(y=>[16,38,62,84].map(x=>[x,y]));
const cellsByShape={roll,fish,duo,boat,flower,fan,bento,'roll-wide':wide,'fish-left':fish.map(([x,y])=>[100-x,y]),'duo-stagger':stagger};
const partialOrders={roll:[8,0,4,2,6,1,5,3,7],fish:[5,8,1,4,9,0,7,6,2,10,11,3],duo:[0,6,4,10,2,8,3,9,1,7,5,11],
  boat:[5,0,10,2,8,3,7,1,9,4,6],flower:[3,8,0,11,1,10,2,9,5,6,4,7],fan:[2,8,0,9,4,6,1,7,3,5],
  bento:[0,15,3,12,5,10,6,9,1,14,2,13,4,11,7,8]};
const names=['卷心初试','小鱼游游','双拼开张','层层寿司卷','海苔小鱼','双拼忙时',
  '回旋卷','逆游小鱼','错位双拼','横切大卷','鱼尾寻味','双盘接力',
  '卷心叠叠','海苔逆游','交错午市','厚切寿司卷','鲜味小鱼','双拼晚高峰',
  '卷心大挑战','三重海苔鱼','错位大满贯','横卷盛宴','鲜味满尾','双拼压轴',
  '寿司船启航','花开满盘','折扇初宴','四格便当','鲜味小舟','花瓣交错','扇底寻鲜','便当接力',
  '海苔舟行','花心层叠','八层折扇','四味午市','满载小船','花间藏鲜','扇面三叠','便当晚市',
  '鲜味远航','繁花满席','折扇压轴','四格盛宴','寿司船归港','花盘大满贯','八层扇宴','满席便当'];

export function shapeDesign(day,count){
  if(day<1||day>48)return null;
  const shape=day<=6?['roll','fish','duo'][(day-1)%3]
    :day<=24?['roll','fish-left','duo-stagger','roll-wide','fish','duo'][(day-7)%6]
    :['boat','flower','fan','bento'][(day-25)%4];
  const family=shape.split('-')[0];
  const positions=[];
  for(let layer=0;positions.length<count;layer++){
    if(layer===8)throw Error('Day '+day+' exceeds the eight-layer limit');
    // Two old 75-card rolls need a wider bottom tray, not a ninth layer.
    const cells=family==='roll'&&count>72&&layer===0?denseRoll:cellsByShape[shape];
    const remaining=count-positions.length;
    const needed=day>24&&remaining>cells.length&&remaining<cells.length+3?remaining-3:Math.min(cells.length,remaining);
    // Incomplete upper layers stay balanced across both plates / both halves.
    const order=partialOrders[family];
    const indices=needed===cells.length?cells.map((_,i)=>i):order.slice(0,needed);
    const amplitude=day>24?1.5:2+Math.floor((day-7)/6)*.5;
    const phase=day>24?Math.floor((day-25)/4)%4:0;
    const dx=day<=6?(layer%2?1.5:-1.5):[-1,0,1,0][(layer+phase)%4]*(family==='fish'?1.5:amplitude);
    const dy=day<=6?(layer%2?1.5:-1.5):((layer+phase)%2?1:-1)*(shape==='duo-stagger'?1.5:amplitude);
    for(const i of indices){const [x,y]=cells[i];positions.push({x:x+dx,y:y+dy,layer,tilt:0});}
  }
  return {shape,name:names[day-1],footprint:{x:17.5,y:shape==='bento'?23:24},positions};
}
