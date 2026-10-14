import {NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {rejectCrossOrigin} from '../../../../lib/request';
import {getAdmin} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
export async function PATCH(req:Request){
 const blocked=rejectCrossOrigin(req);if(blocked)return blocked;
 const a=await getAdmin();if(!a?.manageOrders)return NextResponse.json({error:'შეკვეთების მართვის უფლება არ გაქვთ.'},{status:403});
 try{
  const x=await req.json();const id=Number(x.id);const data:Prisma.OrderUpdateInput={};
  if(!Number.isSafeInteger(id)||id<=0)return NextResponse.json({error:'არასწორი შეკვეთა.'},{status:400});
  if(x.status!==undefined){if(!['NEW','CONFIRMED','PREPARING','SHIPPED','DELIVERED','CANCELLED'].includes(x.status))return NextResponse.json({error:'არასწორი სტატუსი.'},{status:400});data.status=x.status}
  for(const field of ['customerName','phone','email','address'] as const)if(x[field]!==undefined){
   if(typeof x[field]!=='string'||x[field].length>(field==='address'?2000:254))return NextResponse.json({error:'შეამოწმეთ მომხმარებლის მონაცემები.'},{status:400});
   const value=x[field].trim();if((field==='customerName'||field==='phone')&&!value)return NextResponse.json({error:'სახელი და ტელეფონი აუცილებელია.'},{status:400});
   if(field==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return NextResponse.json({error:'შეიყვანეთ სწორი ელფოსტა.'},{status:400});
   if(field==='customerName'||field==='phone')data[field]=value;else data[field]=value||null;
  }
  if(!Object.keys(data).length)return NextResponse.json({error:'შესაცვლელი მონაცემი არ არის.'},{status:400});
  const order=await db.order.update({where:{id},data,select:{id:true,status:true,customerName:true,phone:true,email:true,address:true}});return NextResponse.json(order);
 }catch(e){return NextResponse.json({error:'შეკვეთის განახლება ვერ შესრულდა.'},{status:e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2025'?404:503})}
}
