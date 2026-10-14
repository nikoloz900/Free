import {NextResponse} from 'next/server';
export function rejectCrossOrigin(req:Request){
  const origin=req.headers.get('origin');const host=req.headers.get('host')||new URL(req.url).host;
  try{const parsed=new URL(origin||'');
    if(parsed.host===host&&['http:','https:'].includes(parsed.protocol)&&req.headers.get('sec-fetch-site')!=='cross-site')return null;
  }catch{}
  return NextResponse.json({error:'Forbidden'},{status:403});
}
