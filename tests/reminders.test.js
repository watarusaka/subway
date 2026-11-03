import test from 'node:test';
import assert from 'node:assert/strict';
import { dueReminders, reminderDate, reminderMessage, validReminder, defaultCancellationDate } from '../src/reminders.js';
const sub={id:'test',name:'Netflix',status:'active',reminder:{enabled:true,date:'2027-01-03',days:7}};
test('通知日は年をまたいで計算し、当日から期限後も通知対象とする',()=>{
  assert.equal(reminderDate(sub),'2026-12-27');
  assert.equal(dueReminders([sub],new Date(2026,11,26)).length,0);
  assert.equal(dueReminders([sub],new Date('2026-12-27T09:00:00+09:00')).length,1);
  assert.equal(dueReminders([sub],new Date(2027,1,1)).length,1);
  const sameDay={...sub,reminder:{...sub.reminder,days:0}};
  assert.equal(dueReminders([sameDay],new Date(2027,0,2)).length,0);
  assert.equal(dueReminders([sameDay],new Date('2027-01-03T09:00:00+09:00')).length,1);
});
test('停止中は通知し、利用終了・設定オフは除外する',()=>{
  const now=new Date('2027-01-03T09:00:00+09:00');
  assert.equal(dueReminders([{...sub,status:'paused'}],now).length,1);
  assert.equal(dueReminders([{...sub,status:'cancelled'}],now).length,0);
  assert.equal(dueReminders([{...sub,reminder:{...sub.reminder,enabled:false}}],now).length,0);
});
test('日本時間9時直前は通知せず、9時ちょうどから通知する',()=>{
  assert.equal(dueReminders([sub],new Date('2026-12-27T08:59:59+09:00')).length,0);
  assert.equal(dueReminders([sub],new Date('2026-12-27T09:00:00+09:00')).length,1);
  assert.equal(dueReminders([sub],new Date('2026-12-27T00:00:00Z')).length,1);
});
test('初期解約日は1か月後、月末・うるう年・年越しに対応する',()=>{
  assert.equal(defaultCancellationDate('2027-01-31'),'2027-02-28');
  assert.equal(defaultCancellationDate('2028-01-31'),'2028-02-29');
  assert.equal(defaultCancellationDate('2026-12-15'),'2027-01-15');
});
test('通知は指定の2行で表示し、不正な日付・日数を拒否する',()=>{
  assert.equal(reminderMessage(sub),'サブスク名：Netflix\n解約日：2027/01/03');
  assert.equal(validReminder({...sub.reminder,date:'2027-02-30'}),false);
  assert.equal(validReminder({...sub.reminder,days:-1}),false);
  assert.equal(validReminder(undefined),true);
});
