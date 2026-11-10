import { localDate, parseDate } from './model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validDate=s=>typeof s==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(s)&&localDate(parseDate(s))===s;
export function validCampaign(campaign){
 return campaign===undefined || !!(campaign&&typeof campaign.content==='string'&&campaign.content.trim().length>0&&campaign.content.length<=300&&validDate(campaign.startDate)&&validDate(campaign.endDate)&&campaign.startDate<=campaign.endDate);
}
export function campaignStatus(campaign,now=new Date()){
 if(!campaign||!validCampaign(campaign))return null;
 const date=localDate(now);
 return date<campaign.startDate?'upcoming':date>campaign.endDate?'ended':'active';
}
export function campaignSummary(campaign,now=new Date()){
 const status=campaignStatus(campaign,now);if(!status)return '';
 return `<span class="campaign-summary ${status}"><strong>${{upcoming:'キャンペーン予定',active:'キャンペーン中',ended:'キャンペーン終了'}[status]}</strong><span class="campaign-content">${esc(campaign.content)}</span><small>${campaign.startDate.replaceAll('-','/')} 〜 ${campaign.endDate.replaceAll('-','/')}</small></span>`;
}
export function campaignFields(campaign,now=new Date()){
 const c=campaign&&validCampaign(campaign)?campaign:null;
 return `<fieldset class="campaign-fields"><legend>キャンペーン</legend><label class="campaign-toggle"><input type="checkbox" name="campaignEnabled" ${c?'checked':''} />キャンペーンを設定する</label><div class="form-grid" data-campaign-fields ${c?'':'hidden'}><label class="full">キャンペーン内容 <span>*</span><textarea name="campaignContent" rows="3" maxlength="300" placeholder="例：10%オフ、初月半額" ${c?'required':'disabled'}>${esc(c?.content)}</textarea></label><label>キャンペーン開始日 <span>*</span><input type="date" name="campaignStart" min="2000-01-01" max="2099-12-31" value="${c?.startDate||localDate(now)}" ${c?'required':'disabled'} /></label><label>キャンペーン終了日 <span>*</span><input type="date" name="campaignEnd" min="2000-01-01" max="2099-12-31" value="${c?.endDate||''}" ${c?'required':'disabled'} /></label><p class="form-help full">開始日と終了日を含む期間です。キャンペーンは記録用で、支払予定・集計には「料金（円）」の金額を使用します。</p></div></fieldset>`;
}
