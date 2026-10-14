import {NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {db} from '../../../../lib/db';
import {getAdmin} from '../../../../lib/auth';
import {rejectCrossOrigin} from '../../../../lib/request';
class InputError extends Error{}
type Permissions={viewCost:boolean};
function parse(x:Record<string,unknown>,a:Permissions){
  if(!x||typeof x!=='object'||Array.isArray(x))throw new InputError('არასწორი ფორმა');
  const name=String(x.name||'').trim(),slug=String(x.slug||'').trim().toLowerCase(),sku=String(x.sku||'').trim();
  const price=Number(x.price),stock=Number(x.stock||0),category=String(x.category||'').trim();
  const salePrice=x.salePrice===''||x.salePrice==null?null:Number(x.salePrice);
  const cost=Number(x.cost||0);const imageUrl=String(x.imageUrl||'').trim();
  if(!name||name.length>200||!slug||slug.length>150||!/^[a-z0-9-]+$/.test(slug)||!sku||sku.length>100||!category)throw new InputError('შეავსეთ დასახელება და კატეგორია. მისამართი უნდა შეიცავდეს ლათინურ ასოებსა და ციფრებს.');
  if(!Number.isSafeInteger(price)||price<0||price>2147483647)throw new InputError('ფასი მიუთითეთ მთელი ლარებით, ნულის ან მეტი მნიშვნელობით.');
  if(!Number.isSafeInteger(stock)||stock<0||stock>2147483647)throw new InputError('მარაგი უნდა იყოს მთელი, არაუარყოფითი რაოდენობა.');
  if(salePrice!==null&&(!Number.isSafeInteger(salePrice)||salePrice<0||salePrice>=price))throw new InputError('ფასდაკლებული ფასი უნდა იყოს ჩვეულებრივ ფასზე ნაკლები. თუ ფასდაკლება არ გსურთ, გაასუფთავეთ ეს ველი.');
  if(a.viewCost&&(!Number.isSafeInteger(cost)||cost<0||cost>2147483647))throw new InputError('თვითღირებულება მიუთითეთ მთელი, არაუარყოფითი რიცხვით.');
  if(imageUrl&&!imageUrl.startsWith('/')){
    try{const url=new URL(imageUrl);if(url.protocol!=='https:'||url.username||url.password)throw new Error()}
    catch{throw new InputError('ფოტოსთვის გამოიყენეთ უსაფრთხო HTTPS ბმული')}
  }
  if(imageUrl.startsWith('//')||imageUrl.length>2048)throw new InputError('არასწორი ფოტოს ბმული');
  return {name,slug,sku,category,description:String(x.description||'').slice(0,10000),imageUrl,
    sizes:String(x.sizes||'').slice(0,300),colors:String(x.colors||'').slice(0,300),price,stock,
    status:['ACTIVE','DRAFT','ARCHIVED'].includes(String(x.status))?String(x.status):'ACTIVE',salePrice,
    ...(a.viewCost?{cost}:{})};
}
function publicAdminProduct<T extends {cost:number}>(p:T,a:Permissions){if(a.viewCost)return p;const {cost:_,...rest}=p;return rest}
function failure(e:unknown){
  if(e instanceof InputError)return NextResponse.json({error:e.message},{status:400});
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return NextResponse.json({error:'Slug ან SKU უკვე გამოყენებულია'},{status:409});
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2025')return NextResponse.json({error:'პროდუქტი ვერ მოიძებნა'},{status:404});
  return NextResponse.json({error:'ოპერაცია ვერ შესრულდა. სცადეთ ხელახლა.'},{status:503});
}
async function checkCategory(category:string,existing?:string){if(category===existing)return;const c=await db.category.findUnique({where:{slug:category},select:{active:true}});if(!c?.active)throw new InputError('აირჩიეთ აქტიური კატეგორია')}
export async function GET(){const a=await getAdmin();if(!a)return NextResponse.json({error:'ადმინის სესია დასრულდა. შედით ხელახლა.'},{status:401});
  try{const rows=await db.product.findMany({orderBy:{createdAt:'desc'}});return NextResponse.json(rows.map(p=>publicAdminProduct(p,a)),{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
export async function POST(req:Request){const blocked=rejectCrossOrigin(req);if(blocked)return blocked;const a=await getAdmin();if(!a)return NextResponse.json({error:'ადმინის სესია დასრულდა. შედით ხელახლა.'},{status:401});
  try{const data=parse(await req.json(),a);await checkCategory(data.category);const p=await db.product.create({data:{cost:0,...data}});return NextResponse.json(publicAdminProduct(p,a),{status:201})}catch(e){return failure(e)}}
export async function PATCH(req:Request){const blocked=rejectCrossOrigin(req);if(blocked)return blocked;const a=await getAdmin();if(!a)return NextResponse.json({error:'ადმინის სესია დასრულდა. შედით ხელახლა.'},{status:401});
  try{const x=await req.json();const id=Number(x.id);if(!Number.isSafeInteger(id)||id<=0)throw new InputError('არასწორი პროდუქტი');const old=await db.product.findUnique({where:{id}});if(!old)return NextResponse.json({error:'პროდუქტი ვერ მოიძებნა'},{status:404});
    const data=parse({...old,...x},a);await checkCategory(data.category,old.category);const p=await db.product.update({where:{id},data});return NextResponse.json(publicAdminProduct(p,a))}catch(e){return failure(e)}}
export async function DELETE(req:Request){const blocked=rejectCrossOrigin(req);if(blocked)return blocked;const a=await getAdmin();if(!a?.deleteProducts)return NextResponse.json({error:'პროდუქტის წაშლის უფლება არ გაქვთ.'},{status:403});
  try{const id=Number(new URL(req.url).searchParams.get('id'));if(!Number.isSafeInteger(id)||id<=0)throw new InputError('არასწორი პროდუქტი');const used=await db.orderItem.count({where:{productId:id}});
    if(used)return NextResponse.json({error:'ამ პროდუქტზე შეკვეთებია. წაშლის ნაცვლად დაარქივეთ.'},{status:409});await db.product.delete({where:{id}});return NextResponse.json({ok:true})}catch(e){return failure(e)}}
