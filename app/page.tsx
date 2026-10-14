'use client';
import Link from 'next/link';
import {ArrowRight,ArrowUpRight} from 'lucide-react';
import {usePreferences} from './preferences';
import {Header,Footer,ProductCard,Benefits,ProductVisual} from './components';
import {useCatalog,CatalogError} from './catalog';
export default function Home(){
  const {t}=usePreferences();const {products,categories,error}=useCatalog();
  const hero=products.find(p=>p.imageUrl);const second=products.find(p=>p.imageUrl&&p.slug!==hero?.slug)||hero;
  return <main className="v7Store"><Header/>
    <section className="v7Hero"><div className="v7HeroCopy"><span className="eyebrow">THE TOPURIA EDIT</span><h1>{t('heroTitle')}<br/><em>{t('heroAccent')}</em></h1><Link href="/shop" className="v7Link">{t('newCollection')} <ArrowUpRight size={19}/></Link><span className="heroIndex">01 — თანამედროვე კლასიკა</span></div>
      <div className="v7HeroImage"><ProductVisual imageUrl={hero?.imageUrl} alt={hero?.name||'Topuria Premium'} priority tall/>
      {hero&&<Link href={'/product/'+hero.slug} className="heroCaption"><span>{hero.name}</span><ArrowUpRight size={20}/></Link>}</div>
    </section>
    <div className="v7Manifesto"><span>ნაკლები სიტყვა.</span><span>მეტი ხასიათი.</span><span>TOPURIA PREMIUM</span></div>
    <CatalogError/>
    <section className="collection"><div className="sectionHead"><div><span>THE NEW COLLECTION</span><h2>{t('newCollection')}</h2></div><Link href="/shop">{t('all')} <ArrowRight/></Link></div>
      {products.length?<div className="productGrid">{products.slice(0,4).map(p=><ProductCard key={p.slug} p={p}/>)}</div>:!error?<div className="empty"><p>კოლექცია მალე დაემატება.</p></div>:null}
    </section>
    {categories.length>0&&<section className="v7Collections"><div className="sectionHead"><div><span>CURATED BY TOPURIA</span><h2>შენი არჩევანი</h2></div></div><div className="v7CategoryGrid">{categories.slice(0,3).map((c,i)=><Link key={c.slug} href={'/shop?category='+encodeURIComponent(c.slug)}><ProductVisual imageUrl={products.find(p=>p.category===c.slug&&p.imageUrl)?.imageUrl} alt={c.name}/><div><span>0{i+1}</span><h3>{c.name}</h3><ArrowUpRight/></div></Link>)}</div></section>}
    <section className="v7Editorial"><div><span className="eyebrow">A QUIET STATEMENT</span><h2>სტილი,<br/>რომელიც რჩება.</h2><Link href="/shop" className="v7Link">აღმოაჩინე კოლექცია <ArrowUpRight size={18}/></Link></div><ProductVisual imageUrl={second?.imageUrl} alt={second?.name||'Topuria Premium'} tall/></section>
    <Benefits/><Footer/>
  </main>;
}
