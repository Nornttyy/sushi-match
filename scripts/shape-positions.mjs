// Offline-only authored silhouettes. No random geometry in the shipped game.
const roll=[[30,22],[50,18],[70,22],[80,48],[70,74],[50,78],[30,74],[20,48],[50,48]];
const fish=[[12,25],[12,50],[12,75],[31,50],[50,25],[50,50],[50,75],[69,25],[69,50],[69,75],[88,37.5],[88,62.5]];
const duo=[16,36,64,84].flatMap(x=>[22,50,78].map(y=>[x,y]));
const names=['卷心初试','小鱼游游','双拼开张','层层寿司卷','海苔小鱼','双拼忙时'];

export function shapeDesign(day,count){
  if(day>6)return null;
  const shape=['roll','fish','duo'][(day-1)%3],cells={roll,fish,duo}[shape];
  const positions=[];
  for(let layer=0;positions.length<count;layer++){
    const needed=Math.min(cells.length,count-positions.length);
    // Incomplete upper layers stay balanced across both plates / both halves.
    const order=shape==='roll'?[8,0,4,2,6,1,5,3,7]:shape==='fish'?[5,8,1,4,9,0,7,6,2,10,11,3]:[0,6,4,10,2,8,3,9,1,7,5,11];
    const indices=needed===cells.length?cells.map((_,i)=>i):order.slice(0,needed);
    const dx=layer%2?1.5:-1.5,dy=layer%2?1.5:-1.5;
    for(const i of indices){const [x,y]=cells[i];positions.push({x:x+dx,y:y+dy,layer,tilt:0});}
  }
  return {shape,name:names[day-1],footprint:{x:17.5,y:24},positions};
}
