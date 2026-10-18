import {db} from './db';
import {parseSizeStock} from './size-stock';
import {cache} from 'react';
import {getCategoryTranslations} from './category-translations-db';
import type {Catalog} from '../app/data';
export const getPublicCatalog=cache(async (): Promise<Catalog> => {
  const [rows,categories]=await Promise.all([
    db.product.findMany({where:{status:'ACTIVE'},orderBy:{createdAt:'desc'},select:{
      slug:true,name:true,category:true,description:true,imageUrl:true,sizes:true,sizeStock:true,colors:true,price:true,salePrice:true,stock:true,
    }}),
    db.category.findMany({orderBy:[{sortOrder:'asc'},{name:'asc'}],select:{id:true,slug:true,name:true,description:true,active:true}}),
  ]);
  const hidden=new Set(categories.filter(c=>!c.active).map(c=>c.slug));
  const {byId}=await getCategoryTranslations(categories.filter(c=>c.active).map(c=>c.id));
  const visible:Catalog['categories']=categories.filter(c=>c.active).map(({id,slug,name,description})=>({slug,name,description,...(byId.has(id)?{translations:byId.get(id)}:{})}));
  const names=new Map(visible.map(c=>[c.slug,c.name]));
  // Preserve legacy categories without rewriting existing database records.
  for(const p of rows)if(!hidden.has(p.category)&&!names.has(p.category)){
    names.set(p.category,p.category);visible.push({slug:p.category,name:p.category,description:''});
  }
  const split=(s:string)=>s.split(',').map(x=>x.trim()).filter(Boolean);
  return {categories:visible,products:rows.filter(p=>!hidden.has(p.category)).map(p=>{
    const discounted=p.salePrice!==null&&p.salePrice<p.price&&p.salePrice>=0;
    return {slug:p.slug,name:p.name,ka:p.name,category:p.category,categoryName:names.get(p.category)||p.category,
      description:p.description,imageUrl:p.imageUrl,stock:p.stock,sizeStock:parseSizeStock(p.sizeStock),sizes:split(p.sizes),colors:split(p.colors),
      tone:'burgundy',categories:[p.category,...(discounted?['sale']:[])],price:discounted?p.salePrice!:p.price,
      ...(discounted?{oldPrice:p.price}:{}),
    };
  })};
});
