import {NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {rejectCrossOrigin} from '../../../../lib/request';
const events=new Set(['page_view','product_view','add_to_cart']);
const sources=new Set(['Direct','Instagram','Facebook','Google','Referral','Other']);
// Best-effort per-instance protection; use a shared limiter for high-traffic deployments.
const limits=new Map<string,{count:number;until:number}>();
export async function POST(req:Request){
  if(process.env.ANALYTICS_DISABLED==='1')return NextResponse.json({ok:true,disabled:true});
  const blocked=rejectCrossOrigin(req);if(blocked)return blocked;
  try{
    const text=await req.text();if(text.length>2048)return NextResponse.json({error:'Payload too large'},{status:413});
    let x;try{x=JSON.parse(text)}catch{return NextResponse.json({error:'Invalid event'},{status:400})}
    if(!x||typeof x!=='object'||!events.has(x.type)||typeof x.path!=='string'||x.path.length>250||!x.path.startsWith('/')||x.path.startsWith('/admin')||
      typeof x.sessionId!=='string'||! /^[0-9a-f-]{36}$/i.test(x.sessionId)||
      (x.productSlug!==undefined&&(typeof x.productSlug!=='string'||x.productSlug.length>150||!/^[a-z0-9-]+$/.test(x.productSlug)))||
      (x.type!=='page_view'&&!x.productSlug))return NextResponse.json({error:'Invalid event'},{status:400});
    const now=Date.now();for(const [k,v] of limits)if(v.until<now)limits.delete(k);
    const current=limits.get(x.sessionId)||{count:0,until:now+60000};
    if(current.count>=60||limits.size>=10000)return NextResponse.json({error:'Too many events'},{status:429});
    current.count++;limits.set(x.sessionId,current);
    if(x.productSlug&&!(await db.product.findFirst({where:{slug:x.productSlug,status:'ACTIVE'},select:{id:true}})))return NextResponse.json({error:'Unknown product'},{status:400});
    await db.analyticsEvent.create({data:{type:x.type,path:x.path,productSlug:x.productSlug||null,sessionId:x.sessionId,
      source:sources.has(x.source)?x.source:'Other',device:x.device==='Mobile'?'Mobile':'Desktop'}});
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:'Tracking unavailable'},{status:503})}
}
