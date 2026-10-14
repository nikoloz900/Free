import {NextResponse} from 'next/server';
import {getPublicCatalog} from '../../../lib/catalog';
export const dynamic='force-dynamic';
export async function GET(){
  try{return NextResponse.json(await getPublicCatalog(),{headers:{'Cache-Control':'no-store'}})}
  catch{return NextResponse.json({error:'კატალოგი დროებით მიუწვდომელია. სცადეთ ხელახლა.'},{status:503})}
}
