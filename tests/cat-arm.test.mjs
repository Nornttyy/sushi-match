import test from 'node:test';
import assert from 'node:assert/strict';
import { ARM_BIND, ARM_CANVAS, skinPoint, armMesh, triangleTransform } from '../src/cat-arm.js';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} ≠ ${b}`);

test('rest skin preserves the original image and shoulder/elbow anchors stay fixed', () => {
  for (const u of [0,.25,.5,.75,1]) for (const v of [0,.2,.5,.8,1]) {
    const p=skinPoint(u,v,0);
    near(p.x,ARM_BIND.left+u*ARM_BIND.width);near(p.y,ARM_BIND.top+v*ARM_BIND.height);
  }
  for (let degrees=-60;degrees<=60;degrees++) {
    const a=degrees*Math.PI/180;
    const elbow=skinPoint(.5,(ARM_BIND.elbow-ARM_BIND.top)/ARM_BIND.height,a);
    near(elbow.x,0);near(elbow.y,ARM_BIND.elbow);
    const shoulder=skinPoint(.5,-ARM_BIND.top/ARM_BIND.height,a);
    near(shoulder.x,0);near(shoulder.y,0);
  }
});

test('all intermediate bends form a continuous non-flipped mesh within its canvas', () => {
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  for(let degrees=-60;degrees<=60;degrees++) {
    const rows=armMesh(degrees*Math.PI/180);
    for (const row of rows) for (const p of row) {
      assert.ok(p.x+ARM_CANVAS.originX>1 && p.x+ARM_CANVAS.originX<ARM_CANVAS.size-1);
      assert.ok(p.y+ARM_CANVAS.originY>1 && p.y+ARM_CANVAS.originY<ARM_CANVAS.size-1);
    }
    for(let i=0;i<rows.length-1;i++) {
      assert.ok(cross(rows[i][0],rows[i][1],rows[i+1][0])>0);
      assert.ok(cross(rows[i][1],rows[i+1][1],rows[i+1][0])>0);
    }
    for(const y of [ARM_BIND.blendStart,ARM_BIND.elbow,ARM_BIND.blendEnd]) {
      const v=(y-ARM_BIND.top)/ARM_BIND.height;
      const a=skinPoint(.5,v-1e-7,degrees*Math.PI/180),b=skinPoint(.5,v+1e-7,degrees*Math.PI/180);
      assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-5,'no seam at either bone-weight boundary');
    }
  }
});

test('UV triangles map shared source vertices to exactly the same skin position', () => {
  const source=[{x:0,y:20},{x:100,y:20},{x:0,y:40}];
  for(const angle of [-Math.PI/3,0,Math.PI/3]) {
    const rows=armMesh(angle),target=[rows[7][0],rows[7][1],rows[8][0]];
    const [a,b,c,d,e,f]=triangleTransform(source,target);
    source.forEach((p,i)=>{near(a*p.x+c*p.y+e,target[i].x);near(b*p.x+d*p.y+f,target[i].y);});
  }
  assert.throws(()=>triangleTransform([{x:0,y:0},{x:1,y:1},{x:2,y:2}],source));
});
