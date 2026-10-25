import type {MetadataRoute} from 'next';
import {getPublicCatalog} from '../lib/catalog';
export const dynamic='force-dynamic';
const base='https://topuriapremium.ge';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const entries:MetadataRoute.Sitemap=[{url:base+'/',changeFrequency:'weekly',priority:1},{url:base+'/shop',changeFrequency:'daily',priority:0.9}];
 try{
  const catalog=await getPublicCatalog();
  for(const product of catalog.products)entries.push({url:base+'/product/'+encodeURIComponent(product.slug),changeFrequency:'weekly',priority:0.8});
 }catch{ /* Preserve main sitemap URLs if catalog is temporarily unavailable. */ }
 return entries;
}
