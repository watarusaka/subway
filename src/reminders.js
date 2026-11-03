import { localDate, parseDate } from './model.js';

export const REMINDER_DAYS = [0, 1, 2, 3, 7, 14, 30];
export function defaultCancellationDate(date) {
  const d=parseDate(date);
  return localDate(new Date(d.getFullYear(),d.getMonth()+1,Math.min(d.getDate(),new Date(d.getFullYear(),d.getMonth()+2,0).getDate())));
}
export function reminderTime(s) { return new Date(`${reminderDate(s)}T09:00:00+09:00`); }
export function validReminder(r) {
  return r === undefined || (r && typeof r.enabled === 'boolean' && REMINDER_DAYS.includes(r.days) && typeof r.date === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(r.date) && localDate(parseDate(r.date)) === r.date && ['readKey','deliveredKey'].every(k=>r[k]===undefined || typeof r[k]==='string'));
}
export function reminderKey(s) { return `${s.id}:${s.reminder.date}:${s.reminder.days}`; }
export function reminderDate(s) {
  const d=parseDate(s.reminder.date);
  d.setDate(d.getDate()-s.reminder.days);
  return localDate(d);
}
export function dueReminders(subscriptions, now=new Date()) {
  return subscriptions.filter(s=>s.status!=='cancelled' && s.reminder?.enabled && validReminder(s.reminder) && reminderTime(s)<=now).sort((a,b)=>a.reminder.date.localeCompare(b.reminder.date));
}
export function reminderMessage(s) {
  return `サブスク名：${s.name}\n解約日：${s.reminder.date.replaceAll('-','/')}`;
}
export function reminderFields(s) {
  const r=validReminder(s.reminder)&&s.reminder?.enabled?s.reminder:null;
  return `<fieldset class="reminder-fields"><legend>解約通知</legend><label class="reminder-toggle"><input type="checkbox" name="reminderEnabled" ${r?'checked':''} />解約通知を設定する</label><div class="form-grid"><label>解約日 <span>*</span><input type="date" name="cancellationDate" min="2000-01-01" max="2099-12-31" value="${r?.date||defaultCancellationDate(s.date)}" data-auto="${!r}" ${r?'required':'disabled'} /></label><label>何日前に通知するか<select name="reminderDays" ${r?'':'disabled'}>${REMINDER_DAYS.map(n=>`<option value="${n}" ${n===(r?.days??3)?'selected':''}>${n===0?'当日':`${n}日前`}</option>`).join('')}</select></label></div><p class="form-help">初期の解約日は支払い基準日の1か月後です。日付は変更できます。</p><p class="form-help">通知時刻：午前9時（日本時間）。アプリを閉じていた場合は次回起動時に通知します。</p></fieldset>`;
}
