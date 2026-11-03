export const CATEGORIES = ['エンタメ', '仕事・学習', '暮らし', 'AI', 'その他'];
export const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function occurrence(sub, year, month) {
  if (sub.status !== 'active') return null;
  const anchor = parseDate(sub.date);
  if (sub.cycle === 'yearly' && anchor.getMonth() !== month) return null;
  const day = Math.min(anchor.getDate(), new Date(year, month + 1, 0).getDate());
  const date = new Date(year, month, day);
  return date < anchor ? null : date;
}
export function nextPayment(sub, from = new Date()) {
  if (sub.status !== 'active') return null;
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const anchor = parseDate(sub.date);
  if (anchor > today) return anchor;
  for (let i = 0; i <= 12; i++) {
    const month = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const date = occurrence(sub, month.getFullYear(), month.getMonth());
    if (date && date >= today) return date;
  }
  return null;
}
export const monthlyPrice = s => s.cycle === 'yearly' ? s.price / 12 : s.price;
export function demoSubscriptions(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  const rows = [
    ['Netflix', 'スタンダードプラン', 1590, 5, 'エンタメ', '#e34b48', 'N', 'https://www.netflix.com/youraccount'],
    ['Spotify', 'Premium Individual', 1080, 8, 'エンタメ', '#32a66a', 'spotify', 'https://www.spotify.com/account/'],
    ['Notion', 'プラスプラン', 1650, 12, '仕事・学習', '#484843', 'N', 'https://www.notion.so/'],
    ['iCloud+', '200 GB ストレージ', 450, 15, '暮らし', '#6496c9', 'cloud', 'https://account.apple.com/'],
    ['Adobe', 'フォトプラン', 2380, 18, '仕事・学習', '#de6259', 'A', 'https://account.adobe.com/plans'],
    ['YouTube Premium', '個人プラン', 1280, 22, 'エンタメ', '#e76e5b', 'youtube', 'https://www.youtube.com/paid_memberships'],
    ['Amazon Prime', '月間プラン', 600, 25, '暮らし', '#598e9b', 'a', 'https://www.amazon.co.jp/mc'],
    ['ChatGPT', 'Plus プラン', 3000, 28, '仕事・学習', '#7b8a72', 'sparkles', 'https://chatgpt.com/']
  ];
  return rows.map((r, i) => ({ id: `demo-${i}`, name: r[0], plan: r[1], price: r[2], date: localDate(new Date(y, m, r[3])), category: r[4], color: r[5], logo: r[6], url: r[7], cycle: 'monthly', status: i === 7 ? 'paused' : 'active', note: '', createdAt: now.toISOString() }));
}
