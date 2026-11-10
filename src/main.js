import { createIcons, Layers2, Sprout, ChevronsUpDown, CalendarDays, LayoutGrid, ChartNoAxesCombined, Leaf, Settings2, HardDrive, CircleHelp, Plus, ArrowUpRight, Wallet, Layers, CalendarClock, Pause, Calendar, List, ChevronLeft, ChevronRight, SlidersHorizontal, X, Coffee, ArrowRight, ShieldCheck, Search, Info, Download, Upload, Database, Check, Pencil, ExternalLink, Play, Trash2, CircleAlert, Cloud, Youtube, Sparkles, AudioLines } from 'lucide';
import './style.css';
import './report.css';
import './mobile.css';
import './sync.css';
import './campaigns.css';
import './currency.css';
import { priceInYen, validCurrency, dollarLabel, USD_JPY_RATE } from './currency.js';
import { validCampaign, campaignFields, campaignSummary } from './campaigns.js';
import { createCloudSync, supabaseStore } from './cloud-sync.js';
import { validReminder, reminderKey, reminderDate, reminderTime, defaultCancellationDate, dueReminders, reminderMessage, reminderFields } from './reminders.js';
import { CATEGORIES, localDate, parseDate, occurrence, nextPayment, monthlyPrice } from './model.js';

export async function startApp(user, signOut, client) {
const icons = { Layers2, Sprout, ChevronsUpDown, CalendarDays, LayoutGrid, ChartNoAxesCombined, Leaf, Settings2, HardDrive, CircleHelp, Plus, ArrowUpRight, Wallet, Layers, CalendarClock, Pause, Calendar, List, ChevronLeft, ChevronRight, SlidersHorizontal, X, Coffee, ArrowRight, ShieldCheck, Search, Info, Download, Upload, Database, Check, Pencil, ExternalLink, Play, Trash2, CircleAlert, Cloud, Youtube, Sparkles, AudioLines };

const KEY = `subnote-v1:user:${user.id}`;
const today = new Date();
let data, storageError = false;
let syncState='loading';
let sync;
try { data = JSON.parse(localStorage.getItem(KEY)); } catch { storageError = true; }
if (!data || !Array.isArray(data.subscriptions)) data = { subscriptions: [], demo: false, budget: 15000 };
let view = 'calendar', cursor = new Date(today.getFullYear(), today.getMonth(), 1), selectedDay = null;
let reportMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let reportMode = 'month';
let search = '', category = 'all', status = 'all', calendarMode = 'month';
let lastFocus;
const app = document.querySelector('#app');
const root = document.querySelector('#modal-root');
const money = n => `¥${Math.round(n).toLocaleString('ja-JP')}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;
const dateLabel = d => d ? `${d.getMonth() + 1}月${d.getDate()}日` : '—';
const stateLabel = s => ({ active: '利用中', paused: '一時停止中', cancelled: '利用終了' }[s]);
const active = () => data.subscriptions.filter(s => s.status === 'active');
const monthly = () => active().reduce((n, s) => n + monthlyPrice(s), 0);
const events = () => data.subscriptions.map(s => ({ sub: s, date: occurrence(s, cursor.getFullYear(), cursor.getMonth()) })).filter(e => e.date).sort((a,b) => a.date - b.date);
const filtered = () => data.subscriptions.filter(s => (!search || `${s.name} ${s.plan}`.toLowerCase().includes(search.toLowerCase())) && (category === 'all' || s.category === category) && (status === 'all' || s.status === status));
function logo(s, small = false) { const symbol = ['cloud', 'youtube', 'sparkles', 'spotify'].includes(s.logo) ? icon(s.logo === 'spotify' ? 'audio-lines' : s.logo) : esc(s.logo || s.name.slice(0, 1)); return `<span class="service-logo ${small ? 'small' : ''}" style="--brand:${esc(s.color)}">${symbol}</span>`; }
function refreshIcons() { createIcons({ icons, attrs: { 'stroke-width': 1.7 } }); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); if(sync&&!sync.enqueue(data)){toast('この端末には保存しましたが、同期待ちの記録を保存できませんでした。JSONバックアップを保存してください。');return false;}return true; } catch { toast('保存できませんでした。ブラウザーの保存設定を確認してください。'); return false; } }
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3800); }
function navItem(id, label, glyph, count = '') { return `<button class="nav-item ${view === id ? 'active' : ''}" data-nav="${id}">${icon(glyph)}<span>${label}</span>${count ? `<b>${count}</b>` : ''}</button>`; }

function render() {
  const total = monthly();
  app.innerHTML = `
    <aside class="sidebar">
      <a href="#" class="brand" aria-label="subway ホーム"><img class="brand-mark" src="/app-icon.png" alt="" width="40" height="40" />subway<span class="brand-dot">.</span></a>
      <div class="workspace"><div class="workspace-icon">${icon('sprout')}</div><div><strong>マイワークスペース</strong><span>わたしのサブスク管理</span></div>${icon('chevrons-up-down')}</div>
      <div class="nav-label">WORKSPACE</div>
      <nav>${navItem('calendar', 'カレンダー', 'calendar-days')}${navItem('subscriptions', 'サブスク一覧', 'layout-grid', data.subscriptions.length)}${navItem('insights', '支出レポート', 'chart-no-axes-combined')}</nav>
      <div class="sidebar-tip"><div class="tip-symbol">${icon('leaf')}</div><strong>ちょうどいい、を見つけよう。</strong><p>使っているものも、<br>少しお休みしたいものも。<br>ひとつずつ、心地よく整理。</p><span>LESS CLUTTER, MORE YOU.</span></div>
      <div class="sidebar-bottom">${navItem('settings', '設定・データ管理', 'settings-2')}<div class="profile"><span class="avatar">M</span><div><strong>マイアカウント</strong><small>ローカルワークスペース</small></div><span class="local-dot"></span></div></div>
    </aside>
    <div class="main-shell">
      <header class="topbar"><span>ワークスペース <span class="slash">/</span> <strong>${{calendar:'カレンダー',subscriptions:'サブスク一覧',insights:'支出レポート',settings:'設定・データ管理'}[view]}</strong></span><div class="topbar-right"><span class="save-label">${icon('hard-drive')}端末にもバックアップ</span><button class="icon-btn help-btn" data-action="help" aria-label="使い方">${icon('circle-help')}</button><span class="avatar small-avatar">M</span></div></header>
      <main>
        <div class="sync-banner" role="status"><span id="sync-state"></span><button class="text-btn" data-action="sync-refresh">同期を確認</button></div>
        <div class="page-heading"><div><div class="eyebrow">YOUR SUBSCRIPTIONS, SIMPLIFIED</div><h1>${{calendar:'サブスクを、ひと目で。',subscriptions:'お気に入りを、ひとまとめに。',insights:'支出を知って、心地よく。',settings:'あなたらしい管理を。'}[view]}</h1></div><button class="btn primary" data-action="add">${icon('plus')}サブスクを追加</button></div>
        ${data.demo ? `<div class="demo-note"><span class="demo-tag">DEMO</span>サンプルデータで体験中です。料金はデモ用の参考値です。<button data-action="start">自分のサブスクで始める ${icon('arrow-up-right')}</button></div>` : ''}
        ${['calendar','subscriptions'].includes(view) ? stats(total) : ''}
        ${view === 'calendar' ? calendarPage() : view === 'subscriptions' ? subscriptionsPage() : view === 'insights' ? insightsPage() : settingsPage()}
        <footer><span><span class="footer-mark">✳</span> 小さく整えて、暮らしを軽く。</span><span>Made for your everyday.</span></footer>
      </main>
    </div>`;
  if(view==='settings') {
    const account=document.createElement('section');
    account.className='panel account-section';
    const title=document.createElement('h2');title.textContent='アカウント';
    const email=document.createElement('p');email.textContent=user.email || 'Googleアカウントでログイン中';
    const note=document.createElement('p');note.textContent='同じGoogleアカウントの端末で、サブスク・解約通知設定・予算を同期します。通信できない間の編集は、この端末に保管して再接続時に送信します。';
    const logout=document.createElement('button');logout.className='btn secondary';logout.textContent='ログアウト';logout.onclick=()=>{if(window.confirm('このブラウザーからログアウトしますか？ 登録データは削除されません。'))void signOut();};
    const migrate=document.createElement('button');migrate.className='btn secondary';migrate.textContent='ログイン前のデータを取り込む';migrate.dataset.action='import-legacy';
    const resolve=document.createElement('button');resolve.className='btn secondary';resolve.textContent='クラウドの内容を読み直す';resolve.dataset.action='sync-accept';const backups=document.createElement('button');backups.className='btn secondary';backups.textContent='退避した端末データをダウンロード';backups.dataset.action='sync-backup';
    account.append(title,email,note,migrate,resolve,backups,logout);document.querySelector('main').insertBefore(account,document.querySelector('footer'));
  }
  refreshIcons();
  const notificationButton=document.createElement('button');
  notificationButton.className='notification-button';
  notificationButton.dataset.action='notifications';
  notificationButton.setAttribute('aria-label','解約通知を確認');
  notificationButton.innerHTML=`${icon('calendar-clock')}<span>解約通知</span><b id="reminder-count" hidden></b>`;
  document.querySelector('.topbar-right').prepend(notificationButton);
  refreshIcons();
  checkReminders();
  showSyncState();
}

let reminderTimer;
function checkReminders() {
  const due=dueReminders(data.subscriptions);
  const unread=due.filter(s=>s.reminder.readKey!==reminderKey(s));
  const badge=document.querySelector('#reminder-count');
  if(badge){badge.textContent=unread.length;badge.hidden=!unread.length;}
  if('Notification' in window && Notification.permission==='granted'){
    let changed=false;
    for(const s of unread){
      const key=reminderKey(s);
      if(s.reminder.deliveredKey===key)continue;
      try{
        const notification=new Notification('解約通知',{body:reminderMessage(s),tag:key,icon:'/app-icon.png'});
        notification.onclick=()=>{window.focus();notificationModal();notification.close();};
        s.reminder.deliveredKey=key;changed=true;
      }catch{/* ブラウザー通知非対応の場合もアプリ内通知は表示する */}
    }
    if(changed)save();
  }
  clearTimeout(reminderTimer);
  const next=data.subscriptions.filter(s=>s.status!=='cancelled'&&s.reminder?.enabled&&validReminder(s.reminder)).map(reminderTime).filter(d=>d>new Date()).sort((a,b)=>a-b)[0];
  if(next)reminderTimer=setTimeout(checkReminders,Math.min(Math.max(next-Date.now(),1),2147483647));
}
function notificationModal() {
  checkReminders();
  const due=dueReminders(data.subscriptions);
  const upcoming=data.subscriptions.filter(s=>s.status!=='cancelled'&&s.reminder?.enabled&&validReminder(s.reminder)&&reminderTime(s)>new Date()).sort((a,b)=>reminderTime(a)-reminderTime(b));
  const permission='Notification' in window?Notification.permission:'unsupported';
  const rows=(items,isDue)=>items.map(s=>`<article class="reminder-item"><p class="reminder-message">${esc(reminderMessage(s))}</p><div class="reminder-item-actions"><small>${isDue?(s.reminder.readKey===reminderKey(s)?'確認済み':'未確認'):`通知予定：${reminderDate(s).replaceAll('-','/')}（${s.reminder.days}日前）午前9時（日本時間）`}</small><button class="text-btn" data-detail="${s.id}">詳細</button>${isDue&&s.reminder.readKey!==reminderKey(s)?`<button class="text-btn" data-read-reminder="${s.id}">確認済みにする</button>`:''}</div></article>`).join('');
  openModal(`<h2 id="modal-title">解約通知</h2><p class="modal-description">解約日を忘れずに確認しましょう。</p><div class="notification-permission"><p>${permission==='granted'?'ブラウザー通知は許可されています。':permission==='denied'?'ブラウザー通知はブロックされています。許可する場合はブラウザーのサイト設定を変更してください。':permission==='unsupported'?'この環境ではアプリ内通知をご利用ください。':'ブラウザー通知を許可すると、アプリを開いている間はデスクトップにも通知します。'}</p>${permission==='default'?'<button class="btn secondary" data-action="enable-notifications">ブラウザー通知を有効にする</button>':''}<p>アプリを閉じている間の自動通知には対応していません。通知日を過ぎたものは次回起動時に表示します。</p></div><h3 class="reminder-section-title">届いた通知</h3>${rows(due,true)||'<p class="report-empty">届いた通知はありません。</p>'}<h3 class="reminder-section-title">これからの通知</h3>${rows(upcoming,false)||'<p class="report-empty">通知予定はありません。サブスクの追加・編集から設定できます。</p>'}`);
}

function stats(total) {
  const upcoming = active().map(s => ({sub:s,date:nextPayment(s)})).filter(e=>e.date).sort((a,b)=>a.date-b.date)[0];
  return `<section class="stats-grid" aria-label="サブスクの概要">
    <article class="stat-card main-stat"><div class="stat-label">月あたりの支出 ${icon('wallet')}</div><div class="stat-value">${money(total)}<span>/ 月</span></div><div class="stat-foot"><span class="tiny-pill">年額換算</span>${money(total*12)}<span class="per-year">/ 年</span></div><div class="stat-decoration"></div></article>
    <article class="stat-card"><div class="stat-label">利用中のサブスク ${icon('layers')}</div><div class="stat-value">${active().length}<span>サービス</span></div><div class="stat-foot muted"><span class="green-dot"></span>あなたの毎日を支えるサービス</div></article>
    <article class="stat-card"><div class="stat-label">次のお支払い ${icon('calendar-clock')}</div><div class="stat-value date-value">${upcoming ? dateLabel(upcoming.date) : '予定なし'}${upcoming ? `<span>${money(upcoming.sub.price)}</span>` : ''}</div><div class="stat-foot muted">${upcoming ? `${logo(upcoming.sub, true)}${esc(upcoming.sub.name)}` : 'サブスクを登録してみましょう'}</div></article>
  </section>`;
}

function calendarPage() {
  const ev = events().filter(e => category === 'all' || e.sub.category === category);
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const start = (new Date(y,m,1).getDay() + 6) % 7;
  const days = new Date(y,m+1,0).getDate();
  const cells = Math.ceil((start+days)/7)*7;
  let grid = '';
  for(let i=0;i<cells;i++) {
    const d = new Date(y,m,i-start+1), key = localDate(d), other = d.getMonth() !== m;
    const dayEvents = other ? [] : ev.filter(e => localDate(e.date) === key);
    grid += `<div class="day-cell ${other ? 'other-month' : ''} ${key === localDate(today) ? 'today' : ''} ${selectedDay === key ? 'selected-day' : ''}"><button class="day-number" data-day="${key}" aria-label="${d.getMonth()+1}月${d.getDate()}日の予定">${d.getDate()}</button>${key === localDate(today) ? '<span class="today-label">今日</span>' : ''}<div class="day-events">${dayEvents.slice(0,2).map(e=>`<button class="calendar-event" data-detail="${e.sub.id}" style="--brand:${e.sub.color}">${logo(e.sub,true)}<span>${esc(e.sub.name)}<small>${money(e.sub.price)}</small></span></button>`).join('')}${dayEvents.length>2?`<button class="more-events" data-day="${key}">+${dayEvents.length-2} 件</button>`:''}</div></div>`;
  }
  const selectedEvents = selectedDay ? ev.filter(e=>localDate(e.date)===selectedDay) : ev.filter(e=>localDate(e.date)>=localDate(today));
  return `<div class="calendar-layout"><section class="panel calendar-panel"><div class="panel-title"><div><h2>${icon('calendar-days')}お支払いカレンダー</h2><p>支払い予定を見渡して、ゆとりある毎日を。</p></div><div class="segmented"><button data-mode="month" class="${calendarMode==='month'?'selected':''}">${icon('calendar')}月</button><button data-mode="list" class="${calendarMode==='list'?'selected':''}">${icon('list')}リスト</button></div></div>
    <div class="calendar-toolbar"><div class="month-nav"><h3>${y}<span>年</span> ${m+1}<span>月</span></h3><button class="icon-btn" data-month="-1" aria-label="前の月">${icon('chevron-left')}</button><button class="icon-btn" data-month="1" aria-label="次の月">${icon('chevron-right')}</button><button class="today-btn" data-action="today">今月</button></div><label class="filter-select">${icon('sliders-horizontal')}<select id="calendar-category" aria-label="カレンダーのカテゴリ"><option value="all">すべてのカテゴリ</option>${CATEGORIES.map(c=>`<option ${category===c?'selected':''}>${c}</option>`).join('')}</select></label></div>
    ${calendarMode==='month' ? `<div class="weekdays">${['月','火','水','木','金','土','日'].map((d,i)=>`<span class="${i>4?'weekend':''}">${d}</span>`).join('')}</div><div class="calendar-grid">${grid}</div>` : `<div class="calendar-list">${ev.length ? ev.map(e=>`<button class="calendar-list-row" data-detail="${e.sub.id}"><time>${dateLabel(e.date)}</time>${logo(e.sub)}<span>${esc(e.sub.name)}<small>${esc(e.sub.plan)}</small></span><strong>${money(e.sub.price)}</strong>${icon('chevron-right')}</button>`).join('') : empty('この月のお支払い予定はありません')}</div>`}
    <div class="calendar-legend"><span><i class="legend-dot" style="background:#7a9b72"></i>利用中のサブスクの支払予定</span><span>一時停止・利用終了は非表示</span></div></section>
    <aside class="right-column"><section class="panel upcoming"><div class="upcoming-heading"><h2>${selectedDay ? dateLabel(parseDate(selectedDay))+'の予定' : 'これからのお支払い'}</h2>${selectedDay ? `<button class="icon-btn" data-action="clear-day" aria-label="日付の選択解除">${icon('x')}</button>` : `<span class="count-badge">${selectedEvents.length}</span>`}</div><p class="section-caption">${selectedDay?'選択した日のお支払い':`${m+1}月の残りの支払予定`}</p><div class="upcoming-list">${selectedEvents.length ? selectedEvents.slice(0,5).map(e=>`<button class="upcoming-item" data-detail="${e.sub.id}">${logo(e.sub)}<span><strong>${esc(e.sub.name)}</strong><small>${dateLabel(e.date)} <span>・ ${esc(e.sub.category)}</span></small></span><b>${money(e.sub.price)}</b></button>`).join('') : `<div class="quiet-empty">${icon('coffee')}<p>お支払い予定はありません。<br>ひと息つけそうですね。</p></div>`}</div><div class="upcoming-total"><span>${m+1}月の予定合計</span><strong>${money(ev.reduce((n,e)=>n+e.sub.price,0))}</strong></div></section>
    <section class="review-card"><div class="review-top"><span class="review-icon">${icon('sprout')}</span><span>MINDFUL SUBSCRIPTIONS</span></div><h3>最近、使っていますか？</h3><p>お気に入りも、ときどき見直し。<br>今の自分に必要なものを残しましょう。</p><button data-nav="subscriptions">サブスクを見直す ${icon('arrow-right')}</button><div class="leaf-art"><span></span><span></span><span></span><i></i></div></section>
    <div class="local-note">${icon('shield-check')}<span>データはこのブラウザー内に保存。<br>あなたのペースで管理できます。</span></div></aside></div>
    <section class="subscription-section"><div class="section-heading"><div><h2>あなたのサブスク <span>${data.subscriptions.length}</span></h2><p>暮らしに寄り添うサービスたち。</p></div><button class="text-btn" data-nav="subscriptions">すべて見る ${icon('arrow-right')}</button></div><div class="subscription-cards">${data.subscriptions.slice(0,4).map(subscriptionCard).join('') || empty('最初のサブスクを追加しましょう')}</div></section>`;
}

function subscriptionCard(s) { return `<button class="subscription-card" data-detail="${s.id}"><div class="subscription-card-top">${logo(s)}<span class="status ${s.status}">${stateLabel(s.status)}</span></div><h3>${esc(s.name)}</h3><p>${esc(s.plan || s.category)}</p><div class="subscription-card-bottom ${s.cycle==='yearly'?'yearly-card-price':''}"><strong>${money(s.price)}<small>/ ${s.cycle==='yearly'?'年':'月'}</small>${s.cycle==='yearly'?`<small class="monthly-equivalent">（月あたり${s.price%12?'約':''}${money(monthlyPrice(s))}）</small>`:''}</strong><span>${s.status==='active'?dateLabel(nextPayment(s))+' 更新':s.status==='paused'?'少し、お休み中':'利用終了'}</span></div>${s.currency==='USD'?`<span class="original-currency">${esc(dollarLabel(s))}</span>`:''}${campaignSummary(s.campaign)}</button>`; }
function empty(text) { return `<div class="empty-state">${icon('layers-2')}<h3>${text}</h3><p>サブスクを追加すると、ここに表示されます。</p></div>`; }
function subscriptionsPage() {
  return `<section class="panel subscriptions-panel"><div class="section-heading"><h2>すべてのサブスク <span>${data.subscriptions.length}</span></h2><div class="search-field">${icon('search')}<input id="search" placeholder="サービス名で検索" value="${esc(search)}" aria-label="サービス名で検索" /></div></div><div class="list-filters"><div class="status-tabs">${[['active','利用中'],['paused','一時停止中'],['cancelled','利用終了'],['all','すべて']].map(([v,l])=>`<button class="${status===v?'selected':''}" data-status="${v}">${l}</button>`).join('')}</div><select id="list-category" aria-label="カテゴリで絞り込み"><option value="all">すべてのカテゴリ</option>${CATEGORIES.map(c=>`<option ${category===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="subscription-cards full-list" id="filtered-list">${filtered().map(subscriptionCard).join('') || empty('該当するサブスクはありません')}</div></section>`;
}
const reportColors=['#385740','#8ea66b','#d0b17d','#789fa6','#b88b88','#9a8daf','#7d9b8a','#b5ba77'];
function annualReport(year) {
  const services=active().map((sub,i)=>({sub,color:reportColors[i%reportColors.length],amounts:Array.from({length:12},(_,m)=>occurrence(sub,year,m)?sub.price:0)})).filter(s=>s.amounts.some(n=>n>0));
  const totals=Array.from({length:12},(_,m)=>services.reduce((sum,s)=>sum+s.amounts[m],0));
  const total=totals.reduce((sum,n)=>sum+n,0), max=Math.max(...totals,1);
  return `<section class="panel report-panel annual-panel"><div class="annual-heading"><div><h2>${year}年の月ごとの支出</h2><p class="section-caption">サービス別の積み上げ棒グラフ・月を選ぶと内訳を表示</p></div><div class="annual-total"><span>年間の支払予定</span><strong>${money(total)}</strong></div></div>
    <div class="annual-chart-scroll" tabindex="0" role="region" aria-label="${year}年の月別支出グラフ。横にスクロールできます"><div class="annual-chart"><div class="chart-scale"><span>${money(max)}</span><span>${money(max/2)}</span><span>¥0</span></div><div class="annual-bars">${totals.map((amount,m)=>`<button class="annual-bar-column" data-report-drill="${m}" aria-label="${year}年${m+1}月、${money(amount)}。月別の内訳を表示"><span class="bar-total">${money(amount)}</span><span class="bar-track"><span class="bar-stack" style="height:${amount/max*100}%">${services.filter(s=>s.amounts[m]>0).map(s=>`<span style="height:${s.amounts[m]/amount*100}%;background:${s.color}" title="${esc(s.sub.name)}：${money(s.amounts[m])}"></span>`).join('')}</span></span><span class="bar-month">${m+1}月</span></button>`).join('')}</div></div></div>
    ${services.length ? `<div class="annual-legend">${services.map(s=>`<button data-detail="${s.sub.id}"><i style="background:${s.color}"></i>${esc(s.sub.name)}</button>`).join('')}</div><div class="annual-table-scroll" tabindex="0" role="region" aria-label="サービスごとの月別支払予定一覧"><table class="annual-table"><caption>${year}年のサブスク別支払予定</caption><thead><tr><th scope="col">サブスク</th>${totals.map((_,m)=>`<th scope="col">${m+1}月</th>`).join('')}<th scope="col">年間合計</th></tr></thead><tbody>${services.map(s=>`<tr><th scope="row"><button data-detail="${s.sub.id}">${esc(s.sub.name)}</button></th>${s.amounts.map(n=>`<td>${money(n)}</td>`).join('')}<td>${money(s.amounts.reduce((sum,n)=>sum+n,0))}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">合計</th>${totals.map(n=>`<td>${money(n)}</td>`).join('')}<td>${money(total)}</td></tr></tfoot></table></div>` : '<p class="report-empty">この年のお支払い予定はありません。</p>'}</section>`;
}
function insightsPage() {
  const year=reportMonth.getFullYear(), month=reportMonth.getMonth();
  const payments=active().map(sub=>({sub,date:occurrence(sub,year,month)})).filter(e=>e.date).sort((a,b)=>b.sub.price-a.sub.price);
  const total=payments.reduce((sum,e)=>sum+e.sub.price,0), budget=data.budget || 0;
  const colors=reportColors;
  let offset=0;
  const segments=payments.map(e=>{const start=offset;offset+=total?e.sub.price/total*100:0;const color=colors[active().findIndex(s=>s.id===e.sub.id)%colors.length];return {...e,color,gradient:`${color} ${start}% ${offset}%`};});
  return `<section class="panel report-month-toolbar"><div><h2>${reportMode==='year'?'年別':'月別'}の支出レポート</h2><p class="section-caption">${reportMode==='year'?'1月から12月までの支払いを見渡しましょう。':'月を選んで、支払いの内訳を確認しましょう。'}</p></div><div class="report-toolbar-actions"><div class="segmented" role="group" aria-label="レポートの表示期間"><button data-report-mode="month" aria-pressed="${reportMode==='month'}" class="${reportMode==='month'?'selected':''}">月別</button><button data-report-mode="year" aria-pressed="${reportMode==='year'}" class="${reportMode==='year'?'selected':''}">年別</button></div><div class="report-month-controls"><button class="icon-btn" data-report-month="-1" aria-label="レポートの前の${reportMode==='year'?'年':'月'}">${icon('chevron-left')}</button>${reportMode==='year'?`<label class="report-year-label"><input type="number" id="report-year" aria-label="レポートの対象年" min="2000" max="2099" step="1" value="${year}" />年</label>`:`<input type="month" id="report-month" aria-label="レポートの対象月" min="2000-01" max="2099-12" value="${year}-${String(month+1).padStart(2,'0')}" />`}<button class="icon-btn" data-report-month="1" aria-label="レポートの次の${reportMode==='year'?'年':'月'}">${icon('chevron-right')}</button><button class="today-btn" data-action="report-today">今月</button></div></div></section>
    <div class="insights-grid ${reportMode==='year'?'annual-layout':''}">${reportMode==='year'?annualReport(year):`<section class="panel report-panel"><h2>${year}年${month+1}月の支出</h2><p class="section-caption">サービス別の支払予定・${payments.length}サービス</p><div class="donut monthly-chart" role="img" aria-label="${year}年${month+1}月の支払予定の円グラフ。合計${money(total)}。内訳は下の一覧に記載。" style="background:conic-gradient(${total?segments.map(s=>s.gradient).join(','):'#e8ebe5 0% 100%'})"><div><span>${month+1}月の支払予定合計</span><strong>${money(total)}</strong></div></div><div class="service-breakdown">${segments.map(e=>`<button class="breakdown-row" data-detail="${e.sub.id}"><span class="breakdown-name"><i style="background:${e.color}"></i><span>${esc(e.sub.name)}<small>${dateLabel(e.date)}${e.sub.cycle==='yearly'?' ・ 年払い':''}</small></span></span><strong>${money(e.sub.price)}<small>${total?Math.round(e.sub.price/total*100):0}%</small></strong></button>`).join('') || '<p class="report-empty">この月のお支払い予定はありません。</p>'}</div></section>`}
    <section class="panel report-panel"><h2>${month+1}月の予算</h2><p class="section-caption">選択した月の支払予定と予算を比較</p><div class="budget-number">${money(total)}<span> / ${money(budget)}</span></div><div class="budget-track"><i style="width:${budget?Math.min(total/budget*100,100):0}%;background:${total>budget?'#c97856':'#718951'}"></i></div><p class="budget-caption">${budget ? total<=budget?`予算まで、あと ${money(budget-total)} です。`:`予算を ${money(total-budget)} 超えています。` : '設定から毎月の予算を登録できます。'}</p><button class="btn secondary" data-nav="settings">${icon('sliders-horizontal')}予算を変更</button><div class="ranking"><h3>${month+1}月の支出が大きいサービス</h3>${payments.slice(0,5).map(({sub:s},i)=>`<button class="rank-row" data-detail="${s.id}"><span class="rank">0${i+1}</span>${logo(s,true)}<span>${esc(s.name)}</span><strong>${money(s.price)}</strong></button>`).join('') || '<p class="report-empty">この月のお支払い予定はありません。</p>'}</div></section></div><p class="report-note">${icon('info')}現在の登録内容をもとにした支払予定です。年払いは支払月に全額を計上します。一時停止中・利用終了は集計に含みません。過去の月も実際の請求履歴ではありません。</p>`;
}
function settingsPage() { return `<div class="settings-grid"><section class="panel settings-panel"><h2>${icon('wallet')}毎月の予算</h2><p>月額換算の支出を予算と比較できます。</p><form id="budget-form"><label for="budget">月の予算（円）</label><input id="budget" type="number" min="0" max="999999999" step="1" required value="${data.budget}" /><button class="btn primary" type="submit">予算を保存</button></form></section><section class="panel settings-panel"><h2>${icon('database')}データ管理</h2><p>データはログイン中のアカウントへ同期し、この端末にも保存します。同期待ちの編集は端末内にあるため、バックアップもご活用ください。</p><button class="btn secondary" data-action="export">${icon('download')}JSONでバックアップ</button><label class="btn secondary import-label">${icon('upload')}バックアップから復元<input type="file" id="import-file" accept=".json,application/json" hidden /></label><button class="text-btn danger-text" data-action="reset">すべてのデータを削除</button></section><section class="panel settings-panel wide"><h2>${icon('circle-help')}subway について</h2><p>サブスクを登録し、カレンダーで支払予定を確認できます。月末日が存在しない月は、その月の末日を支払日として表示します。</p><p>「一時停止」「利用終了」はこのアプリ内の管理状態です。各サービスの契約を変更する際は、詳細画面の「サービスの管理ページ」から手続きを行ってください。停止中のサービスは予定と集計から除外され、再開すると登録済みの支払日に基づいて表示されます。</p><span class="version">subway · VERSION 1.0</span></section></div>`; }

function openModal(content, wide = false) { lastFocus=document.activeElement; root.innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide-modal':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close icon-btn" data-action="close" aria-label="閉じる">${icon('x')}</button>${content}</section></div>`; refreshIcons(); requestAnimationFrame(()=>root.querySelector('input, .modal-close')?.focus()); }
function closeModal() { root.innerHTML=''; lastFocus?.isConnected && lastFocus.focus(); }
function formModal(id) {
  const s=data.subscriptions.find(s=>s.id===id) || { name:'', plan:'', price:'', date:localDate(today), category:'エンタメ', cycle:'monthly', color:'#718951', url:'', note:'' };
  openModal(`<div class="modal-eyebrow">MAKE ROOM FOR WHAT MATTERS</div><h2 id="modal-title">${id?'サブスクを編集':'新しいサブスクを追加'}</h2><p class="modal-description">いつものサービスを、ひとつずつ。</p><form id="subscription-form" data-id="${id||''}"><div class="form-grid"><label class="full">サービス名 <span>*</span><input name="name" required maxlength="50" placeholder="例：Netflix" value="${esc(s.name)}" /></label><label class="full">プラン名<input name="plan" maxlength="60" placeholder="例：スタンダードプラン" value="${esc(s.plan)}" /></label><div class="currency-amount"><label>通貨<select name="currency" aria-label="通貨"><option value="JPY" ${s.currency!=='USD'?'selected':''}>日本円（JPY）</option><option value="USD" ${s.currency==='USD'?'selected':''}>米ドル（USD）</option></select></label><label><span id="price-field-label">${s.currency==='USD'?'料金（米ドル）':'料金（円）'}</span> <span>*</span><input name="price" type="number" min="0" max="999999999" step="${s.currency==='USD'?'0.01':'1'}" required placeholder="${s.currency==='USD'?'20.00':'1,000'}" value="${esc(s.currency==='USD'?s.originalPrice:s.price)}" /></label><p id="currency-preview" class="currency-preview" role="status" ${s.currency==='USD'?'':'hidden'}></p></div><label>支払いサイクル<select name="cycle"><option value="monthly" ${s.cycle==='monthly'?'selected':''}>月払い</option><option value="yearly" ${s.cycle==='yearly'?'selected':''}>年払い</option></select></label><label>支払い基準日 <span>*</span><input name="date" type="date" min="2000-01-01" max="2099-12-31" required value="${s.date}" /></label><label>カテゴリ<select name="category">${CATEGORIES.map(c=>`<option ${s.category===c?'selected':''}>${c}</option>`).join('')}</select></label><p class="form-help full">基準日以降、毎月同じ日（年払いは毎年同じ月日）に予定を表示します。</p><label class="full">サービスの管理ページ URL<input name="url" type="url" placeholder="https://..." value="${esc(s.url)}" /></label><label>表示カラー<input type="color" name="color" value="${s.color}" /></label><label>メモ<input name="note" maxlength="300" placeholder="使い方や見直しのメモ" value="${esc(s.note)}" /></label></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close">キャンセル</button><button type="submit" class="btn primary">${icon(id?'check':'plus')}${id?'変更を保存':'サブスクを追加'}</button></div></form>`,true);
  document.querySelector('#subscription-form .modal-actions').insertAdjacentHTML('beforebegin',campaignFields(s.campaign)+reminderFields(s));
  updateCurrencyForm(document.querySelector('#subscription-form'));
}
function detailModal(id) {
  const s=data.subscriptions.find(s=>s.id===id); if(!s)return;
  const next=nextPayment(s);
  openModal(`<div class="detail-hero">${logo(s)}<span class="status ${s.status}">${stateLabel(s.status)}</span></div><h2 id="modal-title">${esc(s.name)}</h2><p class="modal-description">${esc(s.plan||s.category)}</p><div class="detail-price">${money(s.price)}<span>/ ${s.cycle==='yearly'?'年':'月'}</span></div>${s.currency==='USD'?`<p class="original-currency">${esc(dollarLabel(s))}</p>`:''}<div class="detail-info"><div><span>次のお支払い</span><strong>${next?`${next.getFullYear()}年${dateLabel(next)}`:'予定なし'}</strong></div><div><span>カテゴリ</span><strong>${esc(s.category)}</strong></div><div><span>支払い基準日</span><strong>${esc(s.date)}</strong></div>${s.note?`<div class="note-row"><span>メモ</span><strong>${esc(s.note)}</strong></div>`:''}</div>${campaignSummary(s.campaign)}${s.url?`<a class="btn secondary service-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">サービスの管理ページ ${icon('external-link')}</a>`:'<p class="form-help">編集から管理ページのURLを登録できます。</p>'}<div class="management-note">${icon('info')}<span>状態変更はアプリ内の管理用です。実際の契約停止・再開はサービスの管理ページでお手続きください。</span></div><div class="detail-buttons"><button class="btn secondary" data-edit="${s.id}">${icon('pencil')}編集</button>${s.status==='active'?`<button class="btn secondary" data-transition="paused" data-id="${s.id}">${icon('pause')}一時停止</button>`:`<button class="btn primary" data-transition="active" data-id="${s.id}">${icon('play')}利用を再開</button>`}</div><div class="detail-bottom">${s.status!=='cancelled'?`<button class="text-btn danger-text" data-transition="cancelled" data-id="${s.id}">利用終了にする</button>`:'<span></span>'}<button class="text-btn muted" data-delete="${s.id}">${icon('trash-2')}記録を削除</button></div>`);
}
function confirmation(title, description, label, callback, danger=false) { openModal(`<span class="confirm-icon">${icon(danger?'circle-alert':'sprout')}</span><h2 id="modal-title">${title}</h2><p class="confirm-description">${description}</p><div class="modal-actions"><button class="btn secondary" data-action="close">キャンセル</button><button class="btn ${danger?'danger':'primary'}" id="confirm-action">${label}</button></div>`); document.querySelector('#confirm-action').onclick=callback; }
function resumeModal(s) {
  openModal(`<span class="confirm-icon">${icon('play')}</span><h2 id="modal-title">${esc(s.name)}の利用を再開</h2><p class="confirm-description">支払日が変わる場合は、再開後の次の支払日に変更してください。</p><form id="resume-form" data-id="${s.id}"><div class="form-grid"><label class="full">再開後の支払い基準日 <span>*</span><input type="date" name="date" required min="2000-01-01" max="2099-12-31" value="${s.date}" aria-describedby="resume-date-help" /></label><p id="resume-date-help" class="form-help full">現在の基準日を表示しています。変更しなければ従来の周期を引き継ぎます。変更すると、この日以降${s.cycle==='yearly'?'毎年同じ月日':'毎月同じ日'}に支払予定を表示します。存在しない日は月末に調整します。</p></div><div class="management-note">${icon('info')}<span>アプリ内の利用状態と支払予定を更新します。実際の再開手続きは各サービスで行ってください。</span></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close">キャンセル</button><button type="submit" class="btn primary" id="confirm-action">${icon('play')}利用を再開</button></div></form>`);
}

document.addEventListener('click', e=>{
  const el=e.target.closest('button, a.brand'); if(!el)return;
  if(el.matches('.brand')) { e.preventDefault();view='calendar';render(); }
  if(el.dataset.nav) { view=el.dataset.nav;category='all';search='';status='all';render();window.scrollTo(0,0); }
  if(el.dataset.detail)detailModal(el.dataset.detail);
  if(el.dataset.edit)formModal(el.dataset.edit);
  if(el.dataset.month) {cursor=new Date(cursor.getFullYear(),cursor.getMonth()+Number(el.dataset.month),1);selectedDay=null;render();}
  if(el.dataset.reportMonth) {const next=new Date(reportMonth.getFullYear(),reportMonth.getMonth()+Number(el.dataset.reportMonth)*(reportMode==='year'?12:1),1);if(next.getFullYear()>=2000&&next.getFullYear()<=2099){reportMonth=next;render();}}
  if(el.dataset.reportMode){reportMode=el.dataset.reportMode;render();}
  if(el.dataset.reportDrill!==undefined){reportMonth=new Date(reportMonth.getFullYear(),Number(el.dataset.reportDrill),1);reportMode='month';render();document.querySelector('[data-report-mode="month"]').focus();}
  if(el.dataset.day) {selectedDay=el.dataset.day;render();}
  if(el.dataset.mode) {calendarMode=el.dataset.mode;render();}
  if(el.dataset.status) {status=el.dataset.status;render();}
  if(el.dataset.transition) {
    const s=data.subscriptions.find(s=>s.id===el.dataset.id), target=el.dataset.transition;
    if(target==='active'){resumeModal(s);return;}
    const verb={active:'利用を再開',paused:'一時停止',cancelled:'利用終了に変更'}[target];
    confirmation(`${esc(s.name)}を${verb}しますか？`,target==='active'?'登録済みの支払日をもとに、カレンダーと支出集計に再び表示します。各サービスでの再開手続きも確認してください。':'支払予定と支出集計から除外します。実際の契約は変更されません。各サービスでの停止・解約手続きが完了していることを確認してください。',verb,()=>{s.status=target;s.updatedAt=new Date().toISOString();const ok=save();closeModal();render();if(ok)toast(`${s.name}を「${stateLabel(target)}」に変更しました`);},target==='cancelled');
  }
  if(el.dataset.delete) {const s=data.subscriptions.find(s=>s.id===el.dataset.delete);confirmation('この記録を削除しますか？',`${esc(s.name)}の登録情報が削除されます。この操作は元に戻せません。`,'削除する',()=>{data.subscriptions=data.subscriptions.filter(x=>x.id!==s.id);const ok=save();closeModal();render();if(ok)toast('記録を削除しました');},true);}
  const a=el.dataset.action;
  if(a==='sync-refresh')void sync?.refresh(data);
  if(a==='sync-accept')confirmation('クラウドの内容を読み直しますか？','この端末の編集は退避してから、クラウドの内容を表示します。退避したデータは設定からダウンロードできます。','読み直す',()=>{closeModal();void sync?.acceptRemote(data);});
  if(a==='sync-backup') {const copies=sync?.backups()||[];if(!copies.length){toast('退避したデータはありません');return;}for(const copy of copies){const file=URL.createObjectURL(new Blob([JSON.stringify(copy.payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=file;a.download=`subway-local-backup-${copy.at.replaceAll(':','-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(file),1000);}}
  if(a==='import-legacy') {
    try {
      const previous=JSON.parse(localStorage.getItem('subnote-v1'));
      if(!previous || !Array.isArray(previous.subscriptions)) {toast('このブラウザーに以前のデータはありません');return;}
      confirmation('以前のデータを取り込みますか？',`${previous.subscriptions.length}件のサブスクで、現在のアカウントの登録データを置き換えます。必要なら先にJSONバックアップを保存してください。`,'取り込む',()=>{data=previous;const ok=save();closeModal();render();if(ok)toast('以前のデータを取り込みました');});
    }catch{toast('以前のデータを読み込めませんでした');}
  }
  if(a==='notifications')notificationModal();
  if(el.dataset.readReminder){const s=data.subscriptions.find(s=>s.id===el.dataset.readReminder);if(s?.reminder){s.reminder.readKey=reminderKey(s);save();notificationModal();}}
  if(a==='enable-notifications'&&'Notification' in window){Notification.requestPermission().then(()=>notificationModal()).catch(()=>toast('ブラウザー通知を有効にできませんでした。アプリ内通知をご利用ください。'));}
  if(a==='add')formModal();
  if(a==='close')closeModal();
  if(a==='today'){cursor=new Date(today.getFullYear(),today.getMonth(),1);selectedDay=null;render();}
  if(a==='report-today'){reportMonth=new Date(today.getFullYear(),today.getMonth(),1);reportMode='month';render();}
  if(a==='clear-day'){selectedDay=null;render();}
  if(a==='help')openModal(`<div class="modal-eyebrow">WELCOME TO subway</div><h2 id="modal-title">サブスク管理を、もっと気軽に。</h2><div class="help-steps"><p><b>01　サービスを登録</b>サービス名・料金・支払日を入力しましょう。</p><p><b>02　カレンダーで確認</b>支払い予定をひと目で把握。日付を選ぶと、その日の予定が表示されます。</p><p><b>03　ときどき見直し</b>サービスを選んで、一時停止や利用終了を管理。実際の契約変更は各サービスのサイトで行います。</p></div><button class="btn primary" data-action="close">はじめましょう</button>`);
  if(a==='start'||a==='reset')confirmation(a==='start'?'自分のサブスクで始めましょう':'すべてのデータを削除しますか？',a==='start'?'現在のサンプルを含む登録データをクリアして、空のカレンダーから始めます。':'登録したサブスクと予算を削除します。必要なデータは先にバックアップしてください。',a==='start'?'空のカレンダーで始める':'すべて削除',()=>{data={subscriptions:[],demo:false,budget:15000};const ok=save();closeModal();render();if(ok)toast(a==='start'?'準備ができました。最初のサブスクを追加しましょう。':'データを削除しました');},a==='reset');
  if(a==='export') {const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`subway-backup-${localDate(today)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('バックアップをダウンロードしました');}
});
function updateCurrencyForm(form,reset=false){
 const usd=form.elements.currency.value==='USD',input=form.elements.price;
 if(reset)input.value='';
 input.step=usd?'0.01':'1';input.placeholder=usd?'20.00':'1,000';
 document.querySelector('#price-field-label').textContent=usd?'料金（米ドル）':'料金（円）';
 const output=form.querySelector('#currency-preview');output.hidden=!usd;
 const yen=priceInYen(input.value,usd?'USD':'JPY');
 output.textContent=yen===null?`米ドルの料金を入力すると円換算します。1ドル＝${USD_JPY_RATE}円、円未満は四捨五入します。`:`日本円換算：${money(yen)}（1ドル＝${USD_JPY_RATE}円固定・円未満は四捨五入）`;
}
document.addEventListener('input',e=>{if(e.target.form?.id==='subscription-form'&&e.target.name==='price')updateCurrencyForm(e.target.form);if(e.target.id==='search'){search=e.target.value;document.querySelector('#filtered-list').innerHTML=filtered().map(subscriptionCard).join('')||empty('該当するサブスクはありません');refreshIcons();}});
document.addEventListener('change',async e=>{
  if(e.target.form?.id==='subscription-form'){
    if(e.target.name==='currency')updateCurrencyForm(e.target.form,true);
    if(e.target.name==='campaignEnabled'){
      const fields=e.target.form.querySelector('[data-campaign-fields]');fields.hidden=!e.target.checked;
      for(const field of fields.querySelectorAll('input,textarea')){field.disabled=!e.target.checked;field.required=e.target.checked;}
    }
    const cancellation=e.target.form.elements.cancellationDate;
    if(e.target.name==='cancellationDate')cancellation.dataset.auto='false';
    if(e.target.name==='date'&&e.target.value&&e.target.validity.valid&&cancellation.dataset.auto==='true')cancellation.value=defaultCancellationDate(e.target.value);
  }
  if(e.target.name==='reminderEnabled'){const form=e.target.form;for(const name of ['cancellationDate','reminderDays'])form.elements[name].disabled=!e.target.checked;form.elements.cancellationDate.required=e.target.checked;}
  if(e.target.id==='report-year'&&e.target.value&&e.target.validity.valid){reportMonth=new Date(Number(e.target.value),reportMonth.getMonth(),1);render();}
  if(e.target.id==='report-month'&&e.target.validity.valid&&/^20\d{2}-\d{2}$/.test(e.target.value)){reportMonth=parseDate(`${e.target.value}-01`);render();}
  if(['calendar-category','list-category'].includes(e.target.id)){category=e.target.value;render();}
  if(e.target.id==='import-file'&&e.target.files[0]) {
    try {const file=e.target.files[0];if(file.size>2000000)throw Error();const parsed=JSON.parse(await file.text());
      if(!Array.isArray(parsed.subscriptions)||parsed.subscriptions.length>1000||!Number.isFinite(parsed.budget)||parsed.budget<0||parsed.budget>999999999)throw Error();
      if(!parsed.subscriptions.every(s=>validReminder(s.reminder)&&validCampaign(s.campaign)&&validCurrency(s)))throw Error();
      const ids=new Set();
      for(const s of parsed.subscriptions){if(typeof s.id!=='string'||! /^[a-zA-Z0-9-]{1,80}$/.test(s.id)||ids.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>50||!Number.isInteger(s.price)||s.price<0||s.price>999999999||!['monthly','yearly'].includes(s.cycle)||!['active','paused','cancelled'].includes(s.status)||!CATEGORIES.includes(s.category)||!/^#[0-9a-fA-F]{6}$/.test(s.color)||typeof s.date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(s.date)||localDate(parseDate(s.date))!==s.date||!['plan','note','url','logo'].every(k=>s[k]===undefined||typeof s[k]==='string')||(s.url&&!/^https?:\/\//i.test(s.url)))throw Error();ids.add(s.id);}
      confirmation('バックアップを復元しますか？',`${parsed.subscriptions.length}件のサブスクで現在のデータを置き換えます。`,'復元する',()=>{data={subscriptions:parsed.subscriptions,budget:parsed.budget,demo:!!parsed.demo};const ok=save();closeModal();render();if(ok)toast('バックアップを復元しました');});
    }catch{toast('読み込めませんでした。有効なsubwayのバックアップを選んでください。');}finally{e.target.value='';}
  }
});
document.addEventListener('submit',e=>{
  if(e.target.id==='subscription-form'){
    // 後続の登録処理と同じ送信イベントで、通知設定を検証・保存する。
    const f=e.target, id=f.dataset.id, existing=data.subscriptions.find(s=>s.id===id);
    const name=f.elements.name.value.trim(), url=f.elements.url.value;
    if(!name||(url&&!/^https?:\/\//i.test(url))){e.preventDefault();toast(!name?'サービス名を入力してください':'URLは https:// または http:// で始めてください');return;}
    const yen=priceInYen(f.elements.price.value,f.elements.currency.value);
    if(yen===null){e.preventDefault();toast('料金を確認してください。米ドルは小数点以下2桁まで入力できます。');return;}
    f.yenValue=yen;
    const enabled=f.elements.reminderEnabled.checked;
    const reminder=enabled?{enabled:true,date:f.elements.cancellationDate.value,days:Number(f.elements.reminderDays.value)}:undefined;
    if(!validReminder(reminder)){e.preventDefault();toast('解約日と通知日数を確認してください');return;}
    if(reminder&&existing?.reminder?.enabled&&existing.reminder.date===reminder.date&&existing.reminder.days===reminder.days)Object.assign(reminder,{readKey:existing.reminder.readKey,deliveredKey:existing.reminder.deliveredKey});
    const campaign=f.elements.campaignEnabled.checked?{content:f.elements.campaignContent.value.trim(),startDate:f.elements.campaignStart.value,endDate:f.elements.campaignEnd.value}:undefined;
    if(!validCampaign(campaign)){e.preventDefault();toast('キャンペーン内容と期間を確認してください。終了日は開始日以降にしてください。');return;}
    f.campaignValue=campaign;
    f.reminderValue=reminder;
  }
  if(e.target.id==='resume-form'){
    e.preventDefault();
    const date=new FormData(e.target).get('date');
    if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||localDate(parseDate(date))!==date){toast('有効な支払日を入力してください');return;}
    const s=data.subscriptions.find(s=>s.id===e.target.dataset.id);
    if(!s)return;
    Object.assign(s,{date,status:'active',updatedAt:new Date().toISOString()});
    const ok=save();closeModal();render();if(ok)toast(`${s.name}の支払日を保存し、利用を再開しました`);
  }
  if(e.target.id==='subscription-form'){e.preventDefault();const values=Object.fromEntries(new FormData(e.target));values.reminder=e.target.reminderValue;values.campaign=e.target.campaignValue;for(const field of ['campaignEnabled','campaignContent','campaignStart','campaignEnd'])delete values[field];delete values.reminderEnabled;delete values.cancellationDate;delete values.reminderDays;values.name=values.name.trim();if(!values.name){toast('サービス名を入力してください');return;}if(values.url&&!/^https?:\/\//i.test(values.url)){toast('URLは https:// または http:// で始めてください');return;}values.originalPrice=Number(values.price);values.price=e.target.yenValue;const id=e.target.dataset.id;const existing=data.subscriptions.find(s=>s.id===id);if(existing)Object.assign(existing,values);else data.subscriptions.push({...values,id:crypto.randomUUID(),logo:values.name[0],status:'active',createdAt:new Date().toISOString()});const ok=save();closeModal();render();if(ok)toast(id?'変更を保存しました':'サブスクを追加しました');}
  if(e.target.id==='budget-form'){e.preventDefault();data.budget=Number(document.querySelector('#budget').value);const ok=save();render();if(ok)toast('予算を保存しました');}
});
root.addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop'))closeModal();});
document.addEventListener('keydown',e=>{if(!root.firstChild)return;if(e.key==='Escape')closeModal();if(e.key==='Tab'){const focusable=[...root.querySelectorAll('button,a,input,select,textarea')].filter(el=>!el.disabled);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
function showSyncState(){
 const label=document.querySelector('#sync-state');if(!label)return;
 label.textContent=({loading:'クラウドを確認中…',synced:'クラウドに同期済み',saving:'クラウドに保存中…',pending:'この端末に保存済み・同期待ち',conflict:'他の端末の更新と重なりました。この端末の編集は保管しています。設定からクラウドを読み直してください。',setup:'同期の設定が必要です。データはこの端末に保管しています。',error:'同期できませんでした。この端末に保存しています。通信状態を確認して再試行してください。',storage:'同期待ちの編集を保存できません。JSONバックアップを保存してください。'})[syncState];
 label.parentElement.dataset.state=syncState;
}
try{
 sync=createCloudSync({store:supabaseStore(client,user.id),storage:localStorage,key:KEY,onStatus:state=>{syncState=state;showSyncState()},onData:next=>{data=next;render()},canApply:()=>!root.firstChild&&!document.activeElement?.matches('input,select,textarea')});
 data=await sync.initialize(data);
 localStorage.setItem(KEY,JSON.stringify(data));
}catch{syncState='storage';}
render();
const reminderInterval=setInterval(checkReminders,60000);
const syncInterval=setInterval(()=>{if(!document.hidden)void sync?.refresh(data)},15000);
const syncFocus=()=>{if(!document.hidden)void sync?.refresh(data)};
window.addEventListener('focus',syncFocus);document.addEventListener('visibilitychange',syncFocus);window.addEventListener('online',syncFocus);

document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkReminders();});
window.addEventListener('focus',checkReminders);
if(storageError)toast('保存データを読み込めませんでした。バックアップをご確認ください。');
return ()=>{sync?.stop();clearInterval(syncInterval);clearInterval(reminderInterval);clearTimeout(reminderTimer);window.removeEventListener('focus',syncFocus);document.removeEventListener('visibilitychange',syncFocus);window.removeEventListener('online',syncFocus);};
}
