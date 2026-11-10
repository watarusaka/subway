export const USD_JPY_RATE = 155;
const LIMIT=999999999;
export function priceInYen(amount,currency='JPY'){
 if(typeof amount!=='number'&&typeof amount!=='string')return null;
 if(typeof amount==='string'&&!/^\d+(?:\.\d{1,2})?$/.test(amount.trim()))return null;
 const value=Number(amount);
 if(!Number.isFinite(value)||value<0||!['JPY','USD'].includes(currency))return null;
 if(currency==='JPY')return Number.isSafeInteger(value)&&value<=LIMIT?value:null;
 const cents=Math.round(value*100);
 if(Math.abs(value*100-cents)>0.000001||!Number.isSafeInteger(cents))return null;
 const yen=Math.round(cents*USD_JPY_RATE/100);
 return Number.isSafeInteger(yen)&&yen<=LIMIT?yen:null;
}
export function validCurrency(s){
 if(s.currency===undefined)return s.originalPrice===undefined;
 if(s.currency==='JPY')return s.originalPrice===undefined||(typeof s.originalPrice==='number'&&priceInYen(s.originalPrice,'JPY')===s.price);
 return s.currency==='USD'&&typeof s.originalPrice==='number'&&priceInYen(s.originalPrice,'USD')===s.price;
}
export function dollarLabel(s){
 if(s.currency!=='USD'||!validCurrency(s))return '';
 return `$${s.originalPrice.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} · 1ドル＝${USD_JPY_RATE}円`;
}
