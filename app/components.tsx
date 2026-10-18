'use client';
import Link from 'next/link';
import Image from 'next/image';
import {usePathname,useSearchParams} from 'next/navigation';
import {Search,Heart,ShoppingBag,User,Menu,ArrowRight,Truck,PackageCheck,Headphones,X,Languages} from 'lucide-react';
import {useEffect,useState} from 'react';
import {usePreferences} from './preferences';
import type {Product} from './data';
import {useStore} from './store';
import {useCatalog} from './catalog';
import {money} from '../lib/format';
import {translateProductName} from '../lib/category-labels';
export function Header(){
  const [open,setOpen]=useState(false);const pathname=usePathname();const params=useSearchParams();const {cartCount,wishlist}=useStore();
  const {lang,theme,setLang,setTheme,t}=usePreferences();const {categories}=useCatalog();
  const nav=[{name:t('new'),href:'/shop',category:'all'},...categories.slice(0,4).map(c=>({name:c.name,href:'/shop?category='+encodeURIComponent(c.slug),category:c.slug})),{name:'SALE',href:'/shop?category=sale',category:'sale'}];
  const currentCategory=params.get('category')||'all';const active=(key:string)=>['/','/shop'].includes(pathname)&&(currentCategory===key||(currentCategory==='new'&&key==='all'));
  useEffect(()=>setOpen(false),[pathname]);
  useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};
    document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[open]);
  const previewText=lang==='en'?'PREVIEW MODE · Our online store is being prepared. Online orders and payments are not available yet.':lang==='ru'?'ТЕСТОВЫЙ РЕЖИМ · Интернет-магазин готовится к запуску. Онлайн-заказы и оплата пока недоступны.':'სატესტო რეჟიმი · ჩვენი ონლაინ მაღაზია მზადების პროცესშია. ონლაინ შეკვეთები და გადახდა ჯერ მიუწვდომელია.';
  return <>
    <div role="status" aria-label={lang==='ka'?'საიტის სტატუსი':'Store status'} style={{background:'#6e2637',color:'#fff8f3',padding:'11px 18px',textAlign:'center',fontSize:'clamp(11px, 1.1vw, 13px)',fontWeight:500,lineHeight:1.65,letterSpacing:'.015em'}}><span aria-hidden="true" style={{marginRight:8}}>✦</span>{previewText}<span aria-hidden="true" style={{marginLeft:8}}>✦</span></div>
    <header className="header">
      <button aria-label={t('menu')} aria-expanded={open} aria-controls="store-menu" className="icon mobile" onClick={()=>setOpen(true)}><Menu/></button>
      <Link href="/" className="brand" aria-label={'Topuria Premium — '+t('home')}><b>TOPURIA</b><small>PREMIUM</small></Link>
      <nav aria-label={t('collections')}>{nav.map(n=><Link key={n.href} href={n.href} aria-current={active(n.category)?'page':undefined}>{n.name}</Link>)}</nav>
      <div className="actions"><div className="tpPref"><Languages size={16}/><select aria-label={t('language')} value={lang} onChange={e=>setLang(e.target.value as typeof lang)}><option value="ka">KA</option><option value="en">EN</option><option value="ru">RU</option></select></div>
      <Link aria-label={t('search')} href="/search"><Search/></Link>
      <Link aria-label={t('account')} href="/account" className="desktopIcon"><User/></Link>
      <Link aria-label={t('wishlist')} href="/wishlist" className="desktopIcon iconCount"><Heart/><em>{wishlist.length||''}</em></Link>
      <Link aria-label={t('cart')} href="/cart" className="iconCount"><ShoppingBag/><em>{cartCount||''}</em></Link></div>
    </header>
    {open&&<><button className="drawerBackdrop" aria-label={t('close')} onClick={()=>setOpen(false)}/><div className="drawer" id="store-menu" role="dialog" aria-label={t('menu')} aria-modal="true">
      <button autoFocus aria-label={t('close')} onClick={()=>setOpen(false)}><X/></button>
      {nav.map(n=><Link onClick={()=>setOpen(false)} key={n.href} href={n.href} aria-current={active(n.category)?'page':undefined}>{n.name}<ArrowRight/></Link>)}
      <Link href="/wishlist">{t('wishlist')}<Heart/></Link><Link href="/account">{t('account')}<User/></Link>
      <label className="mobileTheme">{t('language')}<select aria-label={t('language')} value={lang} onChange={e=>setLang(e.target.value as typeof lang)}><option value="ka">ქართული</option><option value="en">English</option><option value="ru">Русский</option></select></label><label className="mobileTheme">{t('theme')}<select aria-label={t('theme')} value={theme} onChange={e=>setTheme(e.target.value as typeof theme)}><option value="burgundy">{t('themeBurgundy')}</option><option value="light">{t('themeLight')}</option><option value="dark">{t('themeDark')}</option></select></label>
    </div></>}
  </>;
}
export function ProductVisual({imageUrl,alt='',tall=false,tone='burgundy',priority=false}:{imageUrl?:string;alt?:string;tall?:boolean;tone?:string;priority?:boolean}){
  const {t}=usePreferences();
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[imageUrl]);
  // Stored HTTPS URLs can include Cloudinary and existing hosts; never invent product imagery.
  const optimized=imageUrl?.startsWith('/')&&!imageUrl.startsWith('//')||imageUrl?.startsWith('https://res.cloudinary.com/');
  return <div className={'fashion '+tone+(tall?' tall':'')}>{imageUrl&&!failed?
    optimized?<Image src={imageUrl} alt={alt} fill sizes={tall?'(max-width: 680px) 100vw, 56vw':'(max-width: 680px) 50vw, (max-width: 1100px) 33vw, (max-width: 1320px) 25vw, 300px'} preload={priority} onError={()=>setFailed(true)}/>:
    <img src={imageUrl} alt={alt} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} onError={()=>setFailed(true)}/>:

    <div className="imagePlaceholder"><span>TP</span><small>{t('imageComingSoon')}</small></div>}</div>;
}
export function ProductCard({p}:{p:Product}){
  const {wishlist,toggleWish}=useStore();const {lang,t}=usePreferences();const {categories}=useCatalog();const liked=wishlist.includes(p.slug);
  const categoryName=categories.find(c=>c.slug===p.category)?.name||p.categoryName;
  const name=translateProductName(p.name,lang);
  return <article className="productCard"><Link href={'/product/'+p.slug} className="productImg"><ProductVisual imageUrl={p.imageUrl} alt={name}/>
    {p.stock===0?<span className="productBadge">{t('soldOut')}</span>:p.oldPrice!==undefined?<span className="productBadge">SALE</span>:null}
    <span className="quick">{t('viewProduct')} <ArrowRight size={14}/></span></Link>
    <button className={'wish '+(liked?'liked':'')} aria-label={t('addWishlist')} aria-pressed={liked} onClick={()=>toggleWish(p.slug)}><Heart size={18} fill={liked?'currentColor':'none'}/></button>
    <Link href={'/product/'+p.slug} className="productMeta"><div><small>{categoryName}</small><strong>{name}</strong></div>
    <b>{p.oldPrice!==undefined&&<del>₾{p.oldPrice}</del>} {money(p.price)}</b></Link></article>;
}
export function Benefits(){const {t}=usePreferences();return <section className="benefits"><div><Truck/><span><b>{t('shipping')}</b><small>{t('shippingSub')}</small></span></div><div><PackageCheck/><span><b>{t('returnTitle')}</b><small>{t('returnSub')}</small></span></div><div><Headphones/><span><b>{t('support')}</b><small>{t('supportSub')}</small></span></div></section>}
export function Footer(){const {theme,setTheme,t}=usePreferences();return <footer className="v7Footer"><div className="footerBrand"><b>TOPURIA</b><span>PREMIUM</span></div><div><b>{t('store')}</b><span>{t('storeAddress')}</span><span>11:00–20:00</span></div><div><b>{t('collections')}</b><Link href="/shop">{t('all')}</Link><Link href="/wishlist">{t('wishlist')}</Link></div><div><b>{t('yourStyle')}</b><select aria-label={t('theme')} value={theme} onChange={e=>setTheme(e.target.value as typeof theme)}><option value="burgundy">{t('themeBurgundy')}</option><option value="light">{t('themeLight')}</option><option value="dark">{t('themeDark')}</option></select></div><div className="footerBottom">© {new Date().getFullYear()} Topuria Premium <span>{t('tbilisiGeorgia')}</span></div></footer>}
