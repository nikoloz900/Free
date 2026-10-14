'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
export function track(type:'page_view'|'product_view'|'add_to_cart',productSlug?:string){
  if(typeof window==='undefined')return;
  try{
    let sessionId=sessionStorage.getItem('tp-session');
    if(!sessionId){sessionId=crypto.randomUUID();sessionStorage.setItem('tp-session',sessionId)}
    let source=sessionStorage.getItem('tp-source');
    if(!source){
      const utm=new URLSearchParams(location.search).get('utm_source')?.toLowerCase()||'';
      const ref=document.referrer?new URL(document.referrer).hostname.toLowerCase():'';
      source=/instagram/.test(utm+ref)?'Instagram':/facebook|fb\./.test(utm+ref)?'Facebook':/google/.test(utm+ref)?'Google':utm?'Other':ref&&ref!==location.hostname?'Referral':'Direct';
      sessionStorage.setItem('tp-source',source);
    }
    void fetch('/api/analytics/track',{method:'POST',headers:{'content-type':'application/json'},keepalive:true,
      body:JSON.stringify({type,path:location.pathname,productSlug,sessionId,source,device:matchMedia('(max-width: 767px)').matches?'Mobile':'Desktop'})}).catch(()=>{});
  }catch{/* Analytics must never block shopping when storage is unavailable. */}
}
export function AnalyticsTracker(){const path=usePathname();useEffect(()=>{if(!path.startsWith('/admin'))track('page_view')},[path]);return null}
