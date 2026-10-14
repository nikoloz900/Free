'use client';
import {useEffect,useMemo,useState} from 'react';
import {useSearchParams,useRouter} from 'next/navigation';
import {SlidersHorizontal,X,ArrowUpRight} from 'lucide-react';
import {Header,Footer,ProductCard} from '../components';
import {useCatalog,CatalogError} from '../catalog';
import {usePreferences} from '../preferences';
export default function Shop({home=false}:{home?:boolean}){
 const {t}=usePreferences();const {products,categories,error}=useCatalog();const sp=useSearchParams();const router=useRouter();
 const category=sp.get('category')||'all';const [filter,setFilter]=useState(false),[sort,setSort]=useState('new'),[size,setSize]=useState(''),[max,setMax]=useState(''),[inStock,setInStock]=useState(false);
 useEffect(()=>{if(!filter)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setFilter(false)};window.addEventListener('keydown',close);return()=>{document.body.style.overflow=old;window.removeEventListener('keydown',close)}},[filter]);
 const shown=useMemo(()=>{const rows=products.filter(p=>(category==='all'||category==='new'||p.categories.includes(category))&&(!size||p.sizes.includes(size))&&(!max||p.price<=Number(max))&&(!inStock||p.stock>0));return sort==='low'?rows.sort((a,b)=>a.price-b.price):sort==='high'?rows.sort((a,b)=>b.price-a.price):rows},[products,category,size,max,inStock,sort]);
 const go=(key:string)=>{router.push((home?'/':'/shop')+'?category='+encodeURIComponent(key));setFilter(false)};
 const options=[{slug:'all',name:'ყველა პროდუქტი'},...categories,{slug:'sale',name:'SALE'}];const sizes=[...new Set(products.flatMap(p=>p.sizes))];
 const title=category==='all'||category==='new'?t('newCollection'):category==='sale'?'SALE':categories.find(c=>c.slug===category)?.name||category;
 return <main className="v7Store directCatalog"><Header/><CatalogError/>
 <div className="shopLayout">{filter&&<><button className="catalogFilterBackdrop" aria-label="ფილტრების დახურვა" onClick={()=>setFilter(false)}/><aside className="show catalogFilterPanel" role="dialog" aria-label="პროდუქტის ფილტრები" aria-modal="true"><div className="filterHead"><h3>{t('filters')}</h3><button autoFocus aria-label="ფილტრების დახურვა" onClick={()=>setFilter(false)}><X size={20}/></button></div><h3>{t('category')}</h3>
 {options.map(c=><label key={c.slug}><input type="radio" name="category" checked={category===c.slug} onChange={()=>go(c.slug)}/>{c.name}</label>)}
 {sizes.length>0&&<><h3>{t('size')}</h3><div className="sizes">{sizes.map(s=><button key={s} aria-pressed={size===s} className={size===s?'active':''} onClick={()=>setSize(size===s?'':s)}>{s}</button>)}</div></>}
 <h3>მაქსიმალური ფასი ₾</h3><input aria-label="მაქსიმალური ფასი" type="number" min="0" value={max} onChange={e=>setMax(e.target.value)} className="priceInput"/><label><input type="checkbox" checked={inStock} onChange={e=>setInStock(e.target.checked)}/>მარაგშია</label>
 <button className="resetFilters" onClick={()=>{setSize('');setMax('');setInStock(false);setSort('new');go('all')}}>ფილტრების გასუფთავება</button><button className="filterApply" onClick={()=>setFilter(false)}>პროდუქტების ნახვა <ArrowUpRight size={16}/></button></aside></>}
 <section className="catalog"><div className="directCatalogHeading"><div><h1>{title}</h1><span>{shown.length} {t('products')}</span></div><div className="catalogBar"><button aria-expanded={filter} onClick={()=>setFilter(true)}><SlidersHorizontal size={15}/>{t('filters')}</button><select aria-label="სორტირება" value={sort} onChange={e=>setSort(e.target.value)}><option value="new">ახლახან დამატებული</option><option value="low">{t('low')}</option><option value="high">{t('high')}</option></select></div></div>
 {shown.length?<div className="productGrid three">{shown.map(p=><ProductCard key={p.slug} p={p}/>)}</div>:!error?<div className="empty"><h2>{t('empty')}</h2><p>სცადე სხვა კატეგორია ან ფილტრი.</p></div>:null}
 </section></div><Footer/></main>;
}
