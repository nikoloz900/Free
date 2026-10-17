'use client';
import {createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import type {Catalog} from './data';
import {usePreferences} from './preferences';
import {translateCategoryName,translateProductName} from '../lib/category-labels';
type Value=Catalog & {error:string;refresh:()=>Promise<void>};
const Context=createContext<Value|null>(null);
export function CatalogProvider({children,initial,error:initialError}:{children:React.ReactNode;initial:Catalog;error:string}){
  const [catalog,setCatalog]=useState(initial),[error,setError]=useState(initialError);
  const pathname=usePathname();const first=useRef(true);
  async function refresh(){try{
    const r=await fetch('/api/catalog',{cache:'no-store'});if(!r.ok)throw new Error();
    setCatalog(await r.json());setError('');
  }catch{setError('კატალოგი დროებით მიუწვდომელია. სცადეთ ხელახლა.')}}
  useEffect(()=>{if(first.current)first.current=false;else if(!pathname.startsWith('/admin'))void refresh()},[pathname]);
  useEffect(()=>{const focus=()=>{if(!window.location.pathname.startsWith('/admin'))void refresh()};
    window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus)},[]);
  return <Context.Provider value={{...catalog,error,refresh}}>{children}</Context.Provider>;
}
export function useCatalog(){
  const c=useContext(Context);const {lang}=usePreferences();
  if(!c)throw new Error('CatalogProvider missing');
  const localized=useMemo(()=>{
    const categories=c.categories.map(category=>({...category,name:translateCategoryName(category.name,lang,category.translations)}));
    const names=new Map(categories.map(category=>[category.slug,category.name]));
    const products=c.products.map(product=>({...product,name:translateProductName(product.name,lang),ka:translateProductName(product.name,lang),categoryName:names.get(product.category)||translateCategoryName(product.categoryName,lang)}));
    return {categories,products};
  },[c.categories,c.products,lang]);
  return {...c,...localized};
}
export function CatalogError(){const {error,refresh}=useCatalog();return error?<div className="catalogError" role="alert"><p>{error}</p><button onClick={()=>void refresh()}>ხელახლა ცდა</button></div>:null}
