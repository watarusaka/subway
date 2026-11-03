import test from 'node:test';
import assert from 'node:assert/strict';
import { occurrence, nextPayment, localDate, monthlyPrice } from '../src/model.js';
const sub = {status:'active', cycle:'monthly', date:'2026-01-31', price:1200};
test('月末の支払日を短い月で調整し、翌月は元の日付に戻す',()=>{
  assert.equal(localDate(occurrence(sub,2026,1)),'2026-02-28');
  assert.equal(localDate(occurrence(sub,2026,2)),'2026-03-31');
  assert.equal(occurrence(sub,2025,11),null);
});
test('年払い・うるう日・基準日以前を正しく扱う',()=>{
  const yearly={...sub,cycle:'yearly',date:'2024-02-29'};
  assert.equal(localDate(occurrence(yearly,2025,1)),'2025-02-28');
  assert.equal(localDate(occurrence(yearly,2028,1)),'2028-02-29');
  assert.equal(occurrence(yearly,2026,2),null);
  assert.equal(monthlyPrice(yearly),100);
});
test('一時停止と利用終了は支払予定から除外する',()=>{
  for(const status of ['paused','cancelled']){
    assert.equal(occurrence({...sub,status},2026,1),null);
    assert.equal(nextPayment({...sub,status},new Date(2026,1,1)),null);
  }
});
test('当日支払いは時刻に関係なく含め、経過後は次の周期へ進む',()=>{
  assert.equal(localDate(nextPayment(sub,new Date(2026,1,28,22))),'2026-02-28');
  assert.equal(localDate(nextPayment(sub,new Date(2026,2,1))),'2026-03-31');
  const yearly={...sub,cycle:'yearly',date:'2024-02-29'};
  assert.equal(localDate(nextPayment(yearly,new Date(2026,2,1))),'2027-02-28');
});
test('1年以上先の初回支払いも表示する',()=>{
  assert.equal(localDate(nextPayment({...sub,date:'2028-01-31'},new Date(2026,1,1))),'2028-01-31');
});
