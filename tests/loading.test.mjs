import test from 'node:test';
import assert from 'node:assert/strict';
import { loadingSnapshot, MIN_LOADING_MS, createTaskCache } from '../src/loading-core.js';

test('even cached startup stays visible for at least three seconds', () => {
  assert.equal(MIN_LOADING_MS, 3000);
  for(const now of [0,100,1000,2999]) assert.equal(loadingSnapshot({ startedAt:0,now,done:11,total:11 }).ready,false);
  assert.equal(loadingSnapshot({ startedAt:0,now:3000,done:11,total:11 }).ready,true);
});
test('slow or failed assets never enter the game when the minimum elapses', () => {
  assert.deepEqual(loadingSnapshot({startedAt:0,now:9000,done:5,total:10}),{progress:50,remaining:0,ready:false});
  assert.equal(loadingSnapshot({startedAt:0,now:9000,done:10,total:10,failed:1}).ready,false);
  assert.equal(loadingSnapshot({startedAt:0,now:9001,done:10,total:10}).ready,true);
  assert.equal(loadingSnapshot({startedAt:0,now:9000,done:0,total:0}).ready,false);
});
test('retries reuse successful assets, retry failures, and coalesce duplicate loads', async () => {
  const cache=createTaskCache(); let calls=0;
  const success=()=>{calls++;return 42;};
  const a=cache('a',success),b=cache('a',success);assert.equal(a,b);assert.equal(await a,42);assert.equal(calls,1);
  await assert.rejects(cache('b',()=>Promise.reject(new Error('offline'))));
  assert.equal(await cache('b',success),42);assert.equal(calls,2);assert.equal(await cache('a',success),42);assert.equal(calls,2);
});
