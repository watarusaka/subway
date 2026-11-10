import test from 'node:test';
import assert from 'node:assert/strict';
import {validCampaign,campaignStatus,campaignSummary} from '../src/campaigns.js';
import {validCloudData} from '../src/cloud-sync.js';
import {demoSubscriptions,monthlyPrice,occurrence} from '../src/model.js';
const c={content:'初月半額・10%オフ',startDate:'2026-11-10',endDate:'2026-12-09'};
test('キャンペーンがない既存データと内容・期間付きデータを受け入れる',()=>{
 assert.equal(validCampaign(undefined),true);assert.equal(validCampaign(c),true);
 const s=demoSubscriptions(new Date(2026,10,10))[0];
 assert.equal(validCloudData({subscriptions:[s],budget:10000}),true);
 assert.equal(validCloudData({subscriptions:[{...s,campaign:c}],budget:10000}),true);
});
test('空欄・不正な日付・逆転した期間・過大な内容を拒否する',()=>{
 for(const invalid of [null,{}, {...c,content:'  '},{...c,content:'あ'.repeat(301)},{...c,startDate:'2026-02-30'},{...c,startDate:'2026-12-10'},{...c,endDate:'2026-01-01'}])assert.equal(validCampaign(invalid),false);
 const s=demoSubscriptions()[0];assert.equal(validCloudData({subscriptions:[{...s,campaign:{...c,endDate:'invalid'}}],budget:10000}),false);
});
test('開始日・終了日を含む期間中、開始前、終了後を区別する',()=>{
 assert.equal(campaignStatus(c,new Date(2026,10,9)),'upcoming');
 assert.equal(campaignStatus(c,new Date(2026,10,10)),'active');
 assert.equal(campaignStatus(c,new Date(2026,11,9)),'active');
 assert.equal(campaignStatus(c,new Date(2026,11,10)),'ended');
});
test('内容をHTMLとして実行せず、キャンペーン情報で料金を自動変更しない',()=>{
 const html=campaignSummary({...c,content:'<img src=x onerror=alert(1)>'});assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
 const s={...demoSubscriptions()[0],price:1000,campaign:c};assert.equal(monthlyPrice(s),1000);assert.ok(occurrence(s,2026,11));
});
