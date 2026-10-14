import {NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import {db} from '../../../../lib/db';
import {createSession} from '../../../../lib/auth';
import {rejectCrossOrigin} from '../../../../lib/request';
const attempts=new Map<string,{count:number;until:number}>();
export async function POST(req:Request){
  const blocked=rejectCrossOrigin(req);if(blocked)return blocked;
  try{
    const text=await req.text();if(text.length>4096)return NextResponse.json({error:'არასწორი მოთხოვნა'},{status:400});
    const x=JSON.parse(text);if(typeof x.email!=='string'||typeof x.password!=='string'||x.email.length>254||x.password.length>512)return NextResponse.json({error:'არასწორი მოთხოვნა'},{status:400});
    const email=x.email.trim().toLowerCase();const now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
    const current=attempts.get(email)||{count:0,until:now+900000};
    if(current.count>=10||attempts.size>=10000)return NextResponse.json({error:'ძალიან ბევრი მცდელობა. სცადეთ მოგვიანებით.'},{status:429});
    current.count++;attempts.set(email,current);
    const user=await db.adminUser.findUnique({where:{email}});
    if(!user||!user.active||!(await bcrypt.compare(x.password,user.passwordHash)))return NextResponse.json({error:'არასწორი ელფოსტა ან პაროლი'},{status:401});
    await createSession(user);attempts.delete(email);return NextResponse.json({ok:true,role:user.role});
  }catch{return NextResponse.json({error:'შესვლა დროებით მიუწვდომელია.'},{status:503})}
}
