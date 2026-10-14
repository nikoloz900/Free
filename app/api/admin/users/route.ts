import {NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import bcrypt from 'bcryptjs';
import {rejectCrossOrigin} from '../../../../lib/request';
import {getAdmin} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {adminUserSelect,permissions} from '../../../../lib/admin-users';
class InputError extends Error{}
const allowed=['active',...permissions];
function failure(e:unknown){
 if(e instanceof InputError)return NextResponse.json({error:e.message},{status:400});
 if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return NextResponse.json({error:'ამ ელფოსტით ანგარიში უკვე არსებობს.'},{status:409});
 return NextResponse.json({error:'მომხმარებლის შენახვა ვერ შესრულდა.'},{status:503});
}
async function profile(x:Record<string,unknown>,create=false){
 const data:Prisma.AdminUserUpdateInput={};
 if(create||x.name!==undefined){const name=String(x.name||'').trim();if(!name||name.length>200)throw new InputError('შეიყვანეთ სახელი');data.name=name}
 if(create||x.email!==undefined){const email=String(x.email||'').trim().toLowerCase();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new InputError('შეიყვანეთ სწორი ელფოსტა');data.email=email}
 if(create||x.password){if(typeof x.password!=='string'||x.password.length<10||Buffer.byteLength(x.password,'utf8')>72)throw new InputError('პაროლი უნდა იყოს მინიმუმ 10 სიმბოლო და მაქსიმუმ 72 ბაიტი');data.passwordHash=await bcrypt.hash(x.password,12)}
 return data;
}
export async function POST(req:Request){const blocked=rejectCrossOrigin(req);if(blocked)return blocked;const a=await getAdmin();if(!a?.manageUsers)return NextResponse.json({error:'ოპერატორების მართვის უფლება არ გაქვთ.'},{status:403});
 try{const x=await req.json();const data=await profile(x,true);return NextResponse.json(await db.adminUser.create({data:{name:data.name as string,email:data.email as string,passwordHash:data.passwordHash as string,role:'OPERATOR'},select:adminUserSelect}),{status:201})}catch(e){return failure(e)}}
export async function PATCH(req:Request){const blocked=rejectCrossOrigin(req);if(blocked)return blocked;const a=await getAdmin();if(!a?.manageUsers)return NextResponse.json({error:'ოპერატორების მართვის უფლება არ გაქვთ.'},{status:403});
 try{
  const x=await req.json();const id=Number(x.id);if(!Number.isSafeInteger(id)||id<=0)throw new InputError('არასწორი მომხმარებელი');
  const target=await db.adminUser.findUnique({where:{id}});if(!target)return NextResponse.json({error:'მომხმარებელი ვერ მოიძებნა.'},{status:404});
  if(target.role==='ADMIN'&&a.role!=='ADMIN')return NextResponse.json({error:'მფლობელის ანგარიშის შეცვლის უფლება არ გაქვთ.'},{status:403});
  let data:Prisma.AdminUserUpdateInput;
  if(x.key!==undefined){
   if(!allowed.includes(x.key)||typeof x.value!=='boolean')throw new InputError('არასწორი უფლება');
   if(x.key==='active'&&(target.id===a.id||target.role==='ADMIN')&&!x.value)throw new InputError('საკუთარი ან მფლობელის ანგარიშის გამორთვა შეუძლებელია');
   if(x.key==='manageUsers'&&(target.id===a.id||target.role==='ADMIN')&&!x.value)throw new InputError('საკუთარ ან მფლობელის ანგარიშს მართვის უფლებას ვერ წაართმევთ');
   data={[x.key]:x.value};
  }else{data=await profile(x);if(!Object.keys(data).length)throw new InputError('შესაცვლელი მონაცემი არ არის')}
  return NextResponse.json(await db.adminUser.update({where:{id},data,select:adminUserSelect}));
 }catch(e){return failure(e)}
}
