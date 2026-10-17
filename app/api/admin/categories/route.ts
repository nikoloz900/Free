import {NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {rejectCrossOrigin} from '../../../../lib/request';
import {db} from '../../../../lib/db';
import {getAdmin} from '../../../../lib/auth';
import {CategoryTranslationsUnavailableError,getCategoryTranslations,requireCategoryTranslationsTable,saveCategoryTranslations,type CategoryTranslationValues} from '../../../../lib/category-translations-db';
class InputError extends Error{}
function failure(e:unknown){
 if(e instanceof InputError)return NextResponse.json({error:e.message},{status:400});
 if(e instanceof CategoryTranslationsUnavailableError)return NextResponse.json({error:e.message},{status:409});
 if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return NextResponse.json({error:'ეს მისამართი უკვე გამოყენებულია.'},{status:409});
 if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2025')return NextResponse.json({error:'კატეგორია ვერ მოიძებნა.'},{status:404});
 return NextResponse.json({error:'კატეგორიის შენახვა ვერ შესრულდა. სცადეთ ხელახლა.'},{status:503});
}
function fields(x:Record<string,unknown>,create=false){
 if(!x||typeof x!=='object'||Array.isArray(x))throw new InputError('არასწორი მოთხოვნა');
 const data:{name?:string;slug?:string;description?:string;active?:boolean;sortOrder?:number}={};
 if(create||x.name!==undefined){const name=String(x.name||'').trim();if(!name||name.length>200)throw new InputError('შეიყვანეთ კატეგორიის სახელი');data.name=name}
 if(create){const slug=String(x.slug||'').trim().toLowerCase();if(!/^[a-z0-9-]{1,150}$/.test(slug))throw new InputError('არასწორი კატეგორიის მისამართი');data.slug=slug}
 if(x.description!==undefined){if(typeof x.description!=='string'||x.description.length>5000)throw new InputError('აღწერა ზედმეტად გრძელია');data.description=x.description}
 if(x.sortOrder!==undefined){const value=Number(x.sortOrder);if(!Number.isInteger(value)||value<0||value>100000)throw new InputError('შეიყვანეთ სწორი რიგითობა');data.sortOrder=value}
 if(x.active!==undefined){if(typeof x.active!=='boolean')throw new InputError('არასწორი სტატუსი');data.active=x.active}
 return data;
}
function translationFields(x:Record<string,unknown>):CategoryTranslationValues|undefined{
 if(x.translations===undefined)return undefined;
 if(!x.translations||typeof x.translations!=='object'||Array.isArray(x.translations))throw new InputError('თარგმანები უნდა იყოს ქართული, ინგლისური ან რუსული დასახელებების ობიექტი.');
 const result:CategoryTranslationValues={};
 for(const [locale,value] of Object.entries(x.translations)){
  if(locale!=='ka'&&locale!=='en'&&locale!=='ru')throw new InputError('თარგმანის ენა უნდა იყოს ka, en ან ru.');
  if(typeof value!=='string'||value.trim().length>200)throw new InputError('კატეგორიის თარგმანი უნდა იყოს ტექსტი, მაქსიმუმ 200 სიმბოლო.');
  result[locale]=value.trim();
 }
 return Object.keys(result).length?result:undefined;
}
export async function GET(req:Request){const a=await getAdmin();if(!a)return NextResponse.json({error:'სესია დასრულდა. შედით ხელახლა.'},{status:401});try{
 const categories=await db.category.findMany({orderBy:[{sortOrder:'asc'},{name:'asc'}]});
 if(new URL(req.url).searchParams.get('translations')!=='1')return NextResponse.json(categories,{headers:{'Cache-Control':'no-store'}});
 const {ready,byId}=await getCategoryTranslations(categories.map(c=>c.id));
 return NextResponse.json({categories:categories.map(c=>({...c,translations:byId.get(c.id)??{}})),translationsReady:ready},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e)}}
export async function POST(req:Request){const blocked=rejectCrossOrigin(req);if(blocked)return blocked;const a=await getAdmin();if(!a||a.role!=='ADMIN')return NextResponse.json({error:'კატეგორიების მართვის უფლება არ გაქვთ.'},{status:403});
 try{const x=await req.json();const data=fields(x,true);const translations=translationFields(x);
 const category=await db.$transaction(async tx=>{
  if(translations)await requireCategoryTranslationsTable(tx);
  const row=await tx.category.create({data:{...data,name:data.name!,slug:data.slug!}});
  if(translations)await saveCategoryTranslations(tx,row.id,translations);
  return row;
 });
 return NextResponse.json(category,{status:201})}catch(e){return failure(e)}}
export async function PATCH(req:Request){const blocked=rejectCrossOrigin(req);if(blocked)return blocked;const a=await getAdmin();if(!a||a.role!=='ADMIN')return NextResponse.json({error:'კატეგორიების მართვის უფლება არ გაქვთ.'},{status:403});
 try{const x=await req.json();const data=fields(x);const translations=translationFields(x);const id=Number(x.id);if(!Number.isSafeInteger(id)||id<=0)throw new InputError('არასწორი კატეგორია');const old=await db.category.findUnique({where:{id},select:{slug:true}});if(!old)return NextResponse.json({error:'კატეგორია ვერ მოიძებნა.'},{status:404});
 if(x.slug!==undefined&&x.slug!==old.slug)throw new InputError('არსებული კატეგორიის მისამართი უცვლელი უნდა დარჩეს, რათა პროდუქტების კავშირი შენარჩუნდეს.');
 const category=await db.$transaction(async tx=>{
  if(translations)await requireCategoryTranslationsTable(tx);
  const row=await tx.category.update({where:{id},data});
  if(translations)await saveCategoryTranslations(tx,id,translations);
  return row;
 });
 return NextResponse.json(category)}catch(e){return failure(e)}}
export async function DELETE(req:Request){const blocked=rejectCrossOrigin(req);if(blocked)return blocked;const a=await getAdmin();if(!a||a.role!=='ADMIN')return NextResponse.json({error:'კატეგორიების მართვის უფლება არ გაქვთ.'},{status:403});
 try{const id=Number(new URL(req.url).searchParams.get('id'));if(!Number.isSafeInteger(id)||id<=0)throw new InputError('არასწორი კატეგორია');const c=await db.category.findUnique({where:{id}});if(!c)return NextResponse.json({error:'კატეგორია ვერ მოიძებნა.'},{status:404});
 const count=await db.product.count({where:{category:c.slug}});if(count)return NextResponse.json({error:'კატეგორიაში '+count+' პროდუქტია. ჯერ გადაიტანეთ სხვა კატეგორიაში ან დამალეთ კატეგორია.'},{status:409});
 await db.category.delete({where:{id}});return NextResponse.json({ok:true})}catch(e){return failure(e)}}
