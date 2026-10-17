import {Prisma} from '@prisma/client';
import {db} from './db';

export type CategoryTranslationValues=Partial<Record<'ka'|'en'|'ru',string>>;

// Only the additive translation table may be absent on an older database.
// Connection, permission and unrelated schema failures must remain visible.
export function isMissingCategoryTranslationsTable(error:unknown):boolean{
 if(!(error instanceof Prisma.PrismaClientKnownRequestError)||error.code!=='P2021')return false;
 const table=error.meta?.table;
 return typeof table==='string'&&table.replaceAll('"','').split('.').at(-1)==='CategoryTranslation';
}

export class CategoryTranslationsUnavailableError extends Error{
 constructor(){super('ინდივიდუალური თარგმანების ველები ჯერ არ არის გააქტიურებული. საჭიროა ბაზის განახლება; კატეგორიის სხვა ველების შეცვლა ახლაც შეგიძლიათ.')}
}

export async function getCategoryTranslations(ids:number[]):Promise<{ready:boolean;byId:Map<number,CategoryTranslationValues>}>{
 const byId=new Map<number,CategoryTranslationValues>();
 try{
  // Do not use an empty `in`: Prisma can resolve it without checking the table.
  const rows=await db.categoryTranslation.findMany({
   where:ids.length?{categoryId:{in:ids}}:undefined,
   take:ids.length?undefined:1,
   select:{categoryId:true,locale:true,name:true},
  });
  for(const row of rows){
   if(!ids.length)continue;
   if(row.locale!=='ka'&&row.locale!=='en'&&row.locale!=='ru')continue;
   const values=byId.get(row.categoryId)??{};
   values[row.locale]=row.name;
   byId.set(row.categoryId,values);
  }
  return {ready:true,byId};
 }catch(error){
  if(isMissingCategoryTranslationsTable(error))return {ready:false,byId};
  throw error;
 }
}

export async function requireCategoryTranslationsTable(tx:Prisma.TransactionClient):Promise<void>{
 try{await tx.categoryTranslation.findFirst({select:{id:true}})}catch(error){
  if(isMissingCategoryTranslationsTable(error))throw new CategoryTranslationsUnavailableError();
  throw error;
 }
}

export async function saveCategoryTranslations(tx:Prisma.TransactionClient,categoryId:number,values:CategoryTranslationValues):Promise<void>{
 for(const locale of ['ka','en','ru'] as const){
  const name=values[locale];
  if(name===undefined)continue;
  if(name){
   await tx.categoryTranslation.upsert({where:{categoryId_locale:{categoryId,locale}},create:{categoryId,locale,name},update:{name}});
  }else{
   await tx.categoryTranslation.deleteMany({where:{categoryId,locale}});
  }
 }
}
