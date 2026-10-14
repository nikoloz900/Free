'use client';
import Link from 'next/link';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import {Search,Heart,ShoppingBag,User,Menu,ArrowRight,Truck,PackageCheck,Headphones,X,Languages} from 'lucide-react';
import {useEffect,useState} from 'react';
import {usePreferences} from './preferences';
import type {Product} from './data';
import {useStore} from './store';
import {useCatalog} from './catalog';
import {money} from '../lib/format';
export function Header(){
  const [open,setOpen]=useState(false);const pathname=usePathname();const {cartCount,wishlist}=useStore();
  const {lang,theme,setLang,setTheme,t}=usePreferences();const {categories}=useCatalog();
  const nav=[{name:t('new'),href:'/shop'},...categories.slice(0,4).map(c=>({name:c.name,href:'/shop?category='+encodeURIComponent(c.slug)})),{name:'SALE',href:'/shop?category=sale'}];
  useEffect(()=>setOpen(false),[pathname]);
  useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};
    document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[open]);
  return <><div className="announcement">TOPURIA PREMIUM <span>·</span> თანამედროვე ქალის მოდა</div>
    <header className="header">
      <button aria-label={t('menu')} aria-expanded={open} aria-controls="store-menu" className="icon mobile" onClick={()=>setOpen(true)}><Menu/></button>
      <Link href="/" className="brand" aria-label="Topuria Premium — მთავარი"><b>TOPURIA</b><small>PREMIUM</small></Link>
      <nav aria-label="კოლექციები">{nav.map(n=><Link key={n.href} href={n.href}>{n.name}</Link>)}</nav>
      <div className="actions"><div className="tpPref"><Languages size={16}/><select aria-label="ენა" value={lang} onChange={e=>setLang(e.target.value as typeof lang)}><option value="ka">KA</option><option value="en">EN</option><option value="ru">RU</option></select></div>
      <Link aria-label={t('search')} href="/search"><Search/></Link>
      <Link aria-label={t('account')} href="/account" className="desktopIcon"><User/></Link>
      <Link aria-label={t('wishlist')} href="/wishlist" className="desktopIcon iconCount"><Heart/><em>{wishlist.length||''}</em></Link>
      <Link aria-label={t('cart')} href="/cart" className="iconCount"><ShoppingBag/><em>{cartCount||''}</em></Link></div>
    </header>
    {open&&<><button className="drawerBackdrop" aria-label="დახურვა" onClick={()=>setOpen(false)}/><div className="drawer" id="store-menu" role="dialog" aria-label="მენიუ" aria-modal="true">
      <button autoFocus aria-label="დახურვა" onClick={()=>setOpen(false)}><X/></button>
      {nav.map(n=><Link onClick={()=>setOpen(false)} key={n.href} href={n.href}>{n.name}<ArrowRight/></Link>)}
      <Link href="/wishlist">{t('wishlist')}<Heart/></Link><Link href="/account">{t('account')}<User/></Link>
      <label className="mobileTheme">თემა<select aria-label="მაღაზიის თემა" value={theme} onChange={e=>setTheme(e.target.value as typeof theme)}><option value="burgundy">ბორდო</option><option value="light">ნათელი</option><option value="dark">მუქი</option></select></label>
    </div></>}
  </>;
}
export function ProductVisual({imageUrl,alt='',tall=false,tone='burgundy',priority=false}:{imageUrl?:string;alt?:string;tall?:boolean;tone?:string;priority?:boolean}){
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[imageUrl]);
  // Stored HTTPS URLs can include Cloudinary and existing hosts; never invent product imagery.
  const optimized=imageUrl?.startsWith('/')&&!imageUrl.startsWith('//')||imageUrl?.startsWith('https://res.cloudinary.com/');
  return <div className={'fashion '+tone+(tall?' tall':'')}>{imageUrl&&!failed?
    optimized?<Image src={imageUrl} alt={alt} fill sizes={tall?'(max-width: 680px) 100vw, 56vw':'(max-width: 680px) 50vw, (max-width: 950px) 33vw, 25vw'} preload={priority} onError={()=>setFailed(true)}/>:
    <img src={imageUrl} alt={alt} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} onError={()=>setFailed(true)}/>:

    <div className="imagePlaceholder"><span>TP</span><small>ფოტო მალე დაემატება</small></div>}</div>;
}
export function ProductCard({p}:{p:Product}){
  const {wishlist,toggleWish}=useStore();const {t}=usePreferences();const liked=wishlist.includes(p.slug);
  return <article className="productCard"><Link href={'/product/'+p.slug} className="productImg"><ProductVisual imageUrl={p.imageUrl} alt={p.name}/>
    {p.stock===0?<span className="productBadge">ამოწურულია</span>:p.oldPrice!==undefined?<span className="productBadge">SALE</span>:null}
    <span className="quick">{t('viewProduct')} <ArrowRight size={14}/></span></Link>
    <button className={'wish '+(liked?'liked':'')} aria-label={t('addWishlist')} aria-pressed={liked} onClick={()=>toggleWish(p.slug)}><Heart size={18} fill={liked?'currentColor':'none'}/></button>
    <Link href={'/product/'+p.slug} className="productMeta"><div><small>{p.categoryName}</small><strong>{p.name}</strong></div>
    <b>{p.oldPrice!==undefined&&<del>₾{p.oldPrice}</del>} {money(p.price)}</b></Link></article>;
}
export function Benefits(){const {t}=usePreferences();return <section className="benefits"><div><Truck/><span><b>{t('shipping')}</b><small>{t('shippingSub')}</small></span></div><div><PackageCheck/><span><b>{t('returnTitle')}</b><small>{t('returnSub')}</small></span></div><div><Headphones/><span><b>{t('support')}</b><small>{t('supportSub')}</small></span></div></section>}
export function Footer(){const {theme,setTheme,t}=usePreferences();return <footer className="v7Footer"><div className="footerBrand"><b>TOPURIA</b><span>PREMIUM</span></div><div><b>{t('store')}</b><span>ვიქტორ დოლიძის 10, თბილისი</span><span>11:00–20:00</span></div><div><b>კოლექცია</b><Link href="/shop">{t('all')}</Link><Link href="/wishlist">{t('wishlist')}</Link></div><div><b>შენი სტილი</b><select aria-label="მაღაზიის თემა" value={theme} onChange={e=>setTheme(e.target.value as typeof theme)}><option value="burgundy">Burgundy</option><option value="light">Light</option><option value="dark">Dark</option></select></div><div className="footerBottom">© {new Date().getFullYear()} Topuria Premium <span>თბილისი, საქართველო</span></div></footer>}
