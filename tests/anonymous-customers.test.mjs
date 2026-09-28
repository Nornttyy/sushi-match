import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {LEVELS,RECIPES,CUSTOMER_SKINS,createGame,createEndlessGame,serveActiveCustomer} from '../src/game-core.js';

test('campaign and endless customers have orders and appearances but no names',()=>{
  const games=[...LEVELS.map((_,i)=>createGame(i)),createEndlessGame(42)];
  const skins=['ginger','calico','gray','ginger','calico'];
  for(const game of games){
    assert.equal(new Set(game.customers.map(c=>c.id)).size,game.customers.length);
    game.customers.forEach((c,i)=>{
      assert.equal(Object.hasOwn(c,'name'),false);
      assert.equal(c.skin,skins[i%skins.length]);
      assert.ok(CUSTOMER_SKINS[c.skin]&&RECIPES[c.order]);
    });
  }
});

test('delivery feedback ignores names from legacy state and keeps the same reward',()=>{
  for(const legacy of [false,true]){
    const game=createGame(0),customer=game.customers[0];
    if(legacy)customer.name='旧名字';
    game.workbench.crafted={customerId:customer.id,recipeId:customer.order};
    const delivered=serveActiveCustomer(game),recipe=RECIPES[customer.order];
    assert.equal(delivered.changed,true);
    assert.equal(delivered.reward,recipe.tip);
    assert.equal(delivered.state.event,recipe.label+'已送达！获得 '+recipe.tip+' 金币。');
    assert.equal(delivered.state.served,1);
  }
});

test('web and native renderers do not create name tags or read customer names',()=>{
  for(const file of ['src/main.js','wechat/src/canvas-app.js','styles.css','cat-portrait.css']){
    const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/customer-name|customer\.name|cat\.name/,file);
  }
});
