import test from 'node:test';
import assert from 'node:assert/strict';
import {priceInYen,validCurrency,dollarLabel} from '../src/currency.js';
import {monthlyPrice,demoSubscriptions} from '../src/model.js';
import {validCloudData} from '../src/cloud-sync.js';
test('1ドル155円で固定換算し、円未満を四捨五入する',()=>{
 assert.equal(priceInYen('20','USD'),3100);assert.equal(priceInYen('9.99','USD'),1548);assert.equal(priceInYen('0.10','USD'),16);assert.equal(priceInYen('0','USD'),0);assert.equal(priceInYen('12000','JPY'),12000);
});
test('空欄・負数・小数点以下3桁・円の小数・範囲外は保存しない',()=>{
 for(const [amount,currency] of [['','USD'],['-1','USD'],['1.234','USD'],['1e2','USD'],['1.5','JPY'],['999999999','USD'],['1','EUR'],[NaN,'USD'],[null,'USD'],[false,'USD'],[[],'USD']])assert.equal(priceInYen(amount,currency),null);
});
test('既存の円データとドルの入力額を保ち、二重換算や不正な換算額を拒否する',()=>{
 const s=demoSubscriptions()[0];assert.equal(validCurrency(s),true);
 const usd={...s,currency:'USD',originalPrice:20,price:3100};assert.equal(validCurrency(usd),true);assert.equal(monthlyPrice(usd),3100);assert.equal(monthlyPrice({...usd,cycle:'yearly'}),3100/12);assert.equal(dollarLabel(usd),'$20.00 · 1ドル＝155円');
 assert.equal(validCloudData({subscriptions:[usd],budget:10000}),true);
 assert.equal(validCloudData({subscriptions:[{...usd,price:20}],budget:10000}),false);
 assert.equal(validCurrency({...usd,originalPrice:undefined}),false);
 assert.equal(validCurrency({...s,currency:'EUR'}),false);
});
