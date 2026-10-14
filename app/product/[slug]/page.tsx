import {notFound} from 'next/navigation';
import {getPublicCatalog} from '../../../lib/catalog';
import ProductClient from './product-client';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;try{const p=(await getPublicCatalog()).products.find(p=>p.slug===slug);return {title:p?.name||'პროდუქტი',description:p?.description}}catch{return {title:'პროდუქტი'}}
}
export default async function Page({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const catalog=await getPublicCatalog();const product=catalog.products.find(p=>p.slug===slug);
  if(!product)notFound();return <ProductClient product={product} related={catalog.products.filter(p=>p.slug!==slug&&p.category===product.category).slice(0,4)}/>;
}
