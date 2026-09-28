// Offline-only authored silhouettes. No random geometry in the shipped game.
const roll=[[30,22],[50,18],[70,22],[80,48],[70,74],[50,78],[30,74],[20,48],[50,48]];
const fish=[[12,25],[12,50],[12,75],[31,50],[50,25],[50,50],[50,75],[69,25],[69,50],[69,75],[88,37.5],[88,62.5]];
const duo=[16,36,64,84].flatMap(x=>[22,50,78].map(y=>[x,y]));
const wide=[[26,24],[50,24],[74,24],[86,50],[74,76],[50,76],[26,76],[14,50],[50,50]];
const stagger=[16,36,64,84].flatMap(x=>[25,50,75].map(y=>[x,y+(x<50?-8:8)]));
const cellsByShape={roll,fish,duo,'roll-wide':wide,'fish-left':fish.map(([x,y])=>[100-x,y]),'duo-stagger':stagger};
const names=['卷心初试','小鱼游游','双拼开张','层层寿司卷','海苔小鱼','双拼忙时',
  '回旋卷','逆游小鱼','错位双拼','横切大卷','鱼尾寻味','双盘接力',
  '卷心叠叠','海苔逆游','交错午市','厚切寿司卷','鲜味小鱼','双拼晚高峰',
  '卷心大挑战','三重海苔鱼','错位大满贯','横卷盛宴','鲜味满尾','双拼压轴'];

export function shapeDesign(day,count){
  if(day<1||day>24)return null;
  const shape=day<=6?['roll','fish','duo'][(day-1)%3]
    :['roll','fish-left','duo-stagger','roll-wide','fish','duo'][(day-7)%6];
  const family=shape.split('-')[0],cells=cellsByShape[shape];
  const positions=[];
  for(let layer=0;positions.length<count;layer++){
    const needed=Math.min(cells.length,count-positions.length);
    // Incomplete upper layers stay balanced across both plates / both halves.
    const order=family==='roll'?[8,0,4,2,6,1,5,3,7]:family==='fish'?[5,8,1,4,9,0,7,6,2,10,11,3]:[0,6,4,10,2,8,3,9,1,7,5,11];
    const indices=needed===cells.length?cells.map((_,i)=>i):order.slice(0,needed);
    const amplitude=2+Math.floor((day-7)/6)*.5;
    const dx=day<=6?(layer%2?1.5:-1.5):[-1,0,1,0][layer%4]*(family==='fish'?1.5:amplitude);
    const dy=day<=6?(layer%2?1.5:-1.5):(layer%2?1:-1)*(shape==='duo-stagger'?1.5:amplitude);
    for(const i of indices){const [x,y]=cells[i];positions.push({x:x+dx,y:y+dy,layer,tilt:0});}
  }
  return {shape,name:names[day-1],footprint:{x:17.5,y:24},positions};
}
