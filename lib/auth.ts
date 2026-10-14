import {SignJWT,jwtVerify} from 'jose';
import {cookies} from 'next/headers';
import {db} from './db';
const secret=()=>{const value=process.env.AUTH_SECRET;if(!value)throw new Error('AUTH_SECRET is required');return new TextEncoder().encode(value)};
export async function createSession(user:{id:number,email:string,role:string}){
  const token=await new SignJWT({uid:user.id,email:user.email,role:user.role}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('8h').sign(secret());
  const c=await cookies();c.set('tp_admin',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:28800});
}
export async function getAdmin(){try{const c=await cookies();const t=c.get('tp_admin')?.value;if(!t)return null;const {payload}=await jwtVerify(t,secret());const id=Number(payload.uid);if(!id)return null;return await db.adminUser.findFirst({where:{id,active:true}});}catch{return null}}
export async function clearSession(){const c=await cookies();c.set('tp_admin','',{httpOnly:true,path:'/',maxAge:0});}
