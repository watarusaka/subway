import { test as base, expect } from '@playwright/test';
import { demoSubscriptions } from '../src/model.js';
export const USER_ID='11111111-1111-4111-8111-111111111111';
export const DATA_KEY=`subnote-v1:user:${USER_ID}`;
export const TOKEN_KEY='sb-subway-test-auth-token';
export const user={id:USER_ID,aud:'authenticated',role:'authenticated',email:'owner@example.com',app_metadata:{provider:'google',providers:['google']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
export const session={access_token:'test-access-token',refresh_token:'test-refresh-token',token_type:'bearer',expires_in:3600,expires_at:4102444800,user};
export async function mockAuth(page) {
 await page.route('https://subway-test.supabase.co/auth/v1/**', async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/user'))return route.fulfill({json:user});
  if(url.pathname.endsWith('/token'))return route.fulfill({json:{...session,access_token:'refreshed-token'}});
  if(url.pathname.endsWith('/logout'))return route.fulfill({status:204});
  if(url.pathname.endsWith('/authorize'))return route.fulfill({contentType:'text/html',body:'<h1>Google OAuth test endpoint</h1>'});
  return route.abort();
 });
}
export const test=base.extend({page:async({page},use)=>{
 await mockAuth(page);
 await page.addInitScript(({session,tokenKey,dataKey,demo})=>{
  if(!sessionStorage.getItem('auth-fixture-initialized')){
   localStorage.setItem(tokenKey,JSON.stringify(session));
   if(!localStorage.getItem(dataKey))localStorage.setItem(dataKey,JSON.stringify({subscriptions:demo,demo:true,budget:15000}));
   sessionStorage.setItem('auth-fixture-initialized','1');
  }
 },{session,tokenKey:TOKEN_KEY,dataKey:DATA_KEY,demo:demoSubscriptions()});
 await use(page);
}});
export { expect };
