'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Heart,Minus,Plus,Check,ArrowLeft} from 'lucide-react';
import {Header,Footer,ProductVisual,Benefits,ProductCard} from '../../components';
import {useStore} from '../../store';
import {track} from '../../tracking';
import type {Product} from '../../data';
import {money} from '../../../lib/format';
import {useCatalog} from '../../catalog';
import {usePreferences} from '../../preferences';
import {translateCategoryName,translateProductName} from '../../../lib/category-labels';
export default function ProductClient({product:p,related}:{product:Product;related:Product[]}){
  const [size,setSize]=useState(p.sizes[0]||''),[q,setQ]=useState(1),[added,setAdded]=useState(false);
  const {add,wishlist,toggleWish,cart}=useStore();const liked=wishlist.includes(p.slug);
  const {categories}=useCatalog();const {lang,t}=usePreferences();
  const categoryName=categories.find(c=>c.slug===p.category)?.name||translateCategoryName(p.categoryName,lang);
  const productName=translateProductName(p.name,lang);
  const available=Math.max(0,p.sizes.length?((p.sizeStock?.[size]??0)-cart.filter(i=>i.slug===p.slug&&i.size===size).reduce((s,i)=>s+i.qty,0)):p.stock-cart.filter(i=>i.slug===p.slug).reduce((s,i)=>s+i.qty,0));
  useEffect(()=>{track('product_view',p.slug)},[p.slug]);
  useEffect(()=>{if(!added)return;const id=setTimeout(()=>setAdded(false),1800);return()=>clearTimeout(id)},[added]);
  return <main className="v7Store directCatalog"><Header/><div className="productBreadcrumb"><Link href="/shop"><ArrowLeft size={14}/>{t('collections')}</Link><span>/ {categoryName}</span></div><div className="productPage">
    <div className="gallery"><ProductVisual imageUrl={p.imageUrl} alt={productName} tall priority/></div>
    <div className="details"><span className="eyebrow">{categoryName}</span><h1>{productName}</h1><h2>{p.oldPrice!==undefined&&<del>₾{p.oldPrice}</del>} {money(p.price)}</h2><p className="availability">{available>0?'არჩეული ზომა · დარჩენილია '+available+' ც.':'არჩეული ზომა ამოწურულია'}</p>
      {p.description&&<p className="muted">{p.description}</p>}
      {p.colors.length>0&&<div className="productColors"><b>ფერი</b><p>{p.colors.join(' · ')}</p></div>}
      {p.sizes.length>0&&<><div className="sizeHead"><b>ზომა</b></div><div className="sizes big">{p.sizes.map(x=><button aria-pressed={size===x} className={size===x?'active':''} onClick={()=>{setSize(x);setQ(1)}} disabled={(p.sizeStock?.[x]??0)===0} title={(p.sizeStock?.[x]??0)===0?'ამოწურულია':'მარაგშია '+p.sizeStock?.[x]+' ცალი'} key={x}>{x}</button>)}</div></>}
      <div className="buy"><div className="qty"><button aria-label="რაოდენობის შემცირება" disabled={q<=1} onClick={()=>setQ(Math.max(1,q-1))}><Minus/></button>{q}<button aria-label="რაოდენობის გაზრდა" disabled={q>=available} onClick={()=>setQ(Math.min(available,q+1))}><Plus/></button></div>
      <button className="add" disabled={available===0||q>available} onClick={()=>{add(p.slug,size,q);setAdded(true)}}>{added?<><Check size={16}/> დამატებულია</>:available===0?'მიუწვდომელია':'კალათაში დამატება'}</button>
      <button aria-label="რჩეულებში დამატება" aria-pressed={liked} className={'heart '+(liked?'liked':'')} onClick={()=>toggleWish(p.slug)}><Heart fill={liked?'currentColor':'none'}/></button></div>
      <div className="accord"><details><summary>პროდუქტის აღწერა <span>+</span></summary><p>{p.description||p.name}</p></details><details><summary>მიწოდება <span>+</span></summary><p>თბილისი და საქართველოს რეგიონები. დეტალები დაადასტურეთ მაღაზიასთან შეკვეთამდე.</p></details></div>
    </div></div>{related.length>0&&<section className="collection"><div className="sectionHead"><h2>შეიძლება მოგეწონოს</h2></div><div className="productGrid">{related.map(p=><ProductCard key={p.slug} p={p}/>)}</div></section>}<Benefits/><Footer/></main>;
}
