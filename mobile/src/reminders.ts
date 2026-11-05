import { dateKey, validDate } from './model';
import type { Subscription } from './model';
export const REMINDER_DAYS = [0, 1, 2, 3, 7, 14, 30] as const;
export type Reminder = { enabled: boolean; date: string; days: number; readKey?: string };
export function validReminder(r: unknown): r is Reminder {
 if(!r || typeof r!=='object') return false;
 const v=r as Reminder;
 return typeof v.enabled==='boolean' && typeof v.date==='string' && validDate(v.date) && REMINDER_DAYS.some(n=>n===v.days) && (v.readKey===undefined || typeof v.readKey==='string');
}
export function defaultCancellationDate(date: string) {
 if(!validDate(date)) return '';
 const [y,m,d]=date.split('-').map(Number);
 return dateKey(new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate())));
}
export function reminderTime(r: Reminder) {
 // Subtract whole days in UTC, then interpret the resulting date at 09:00 JST.
 const day=new Date(`${r.date}T00:00:00Z`);
 day.setUTCDate(day.getUTCDate()-r.days);
 return new Date(`${day.toISOString().slice(0,10)}T09:00:00+09:00`);
}
export const reminderKey=(s: Subscription)=>s.reminder?`${s.id}:${s.reminder.date}:${s.reminder.days}`:'';
export function dueReminders(items: Subscription[], now: Date) {
 return items.filter(s=>s.status!=='cancelled'&&s.reminder?.enabled&&validReminder(s.reminder)&&reminderTime(s.reminder)<=now).sort((a,b)=>a.reminder!.date.localeCompare(b.reminder!.date));
}
