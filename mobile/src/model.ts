import { validReminder } from './reminders';
import type { Reminder } from './reminders';
export type Subscription = { id: string; name: string; price: number; date: string; cycle: 'monthly' | 'yearly'; status: 'active' | 'paused' | 'cancelled'; reminder?: Reminder };
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function validDate(value: string) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d]=value.split('-').map(Number);
  return dateKey(new Date(y,m-1,d))===value;
}
export function payment(s: Subscription, month: Date) {
  if(s.status!=='active') return null;
  const [y,m,d]=s.date.split('-').map(Number);
  if(s.cycle==='yearly' && month.getMonth()!==m-1) return null;
  const result=new Date(month.getFullYear(),month.getMonth(),Math.min(d,new Date(month.getFullYear(),month.getMonth()+1,0).getDate()));
  return result<new Date(y,m-1,d)?null:result;
}
export function validSubscriptions(value: unknown): value is Subscription[] {
 return Array.isArray(value)&&value.every(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&s.name.trim()&&Number.isInteger(s.price)&&s.price>=0&&validDate(s.date)&&['monthly','yearly'].includes(s.cycle)&&['active','paused','cancelled'].includes(s.status)&&(s.reminder===undefined||validReminder(s.reminder)));
}
