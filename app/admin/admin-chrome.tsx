'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {LayoutDashboard,Layers,ShoppingBag,ShoppingCart,ChartNoAxesCombined,Users,UserRound,ArrowUpRight,LogOut,Menu,X,Sun,Moon,Search} from 'lucide-react';
const icons={dashboard:LayoutDashboard,categories:Layers,products:ShoppingBag,orders:ShoppingCart,analytics:ChartNoAxesCombined,users:Users,customers:UserRound};
type Nav={id:string;label:string;href:string};
export default function AdminChrome({active,links,name,role}:{active:string;links:Nav[];name:string;role:string}){
  const router=useRouter();const [open,setOpen]=useState(false),[light,setLight]=useState(false),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{try{setLight(localStorage.getItem('tp-admin-theme')==='light')}catch{}},[]);
  useEffect(()=>{const shell=document.querySelector('.dash');shell?.setAttribute('data-admin-theme',light?'light':'dark');try{localStorage.setItem('tp-admin-theme',light?'light':'dark')}catch{}},[light]);
  useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);
  async function logout(){setBusy(true);try{const r=await fetch('/api/admin/logout',{method:'POST'});if(!r.ok)throw new Error();router.replace('/admin/login');router.refresh()}catch{setError('გასვლა ვერ შესრულდა. სცადეთ ხელახლა.');setBusy(false)}}
  return <><aside id="admin-navigation" className={'adminSidebar '+(open?'isOpen':'')}>
    <Link href="/admin/dashboard" className="adminBrand"><span className="brandMonogram">T</span><div><b>TOPURIA</b><small>PREMIUM · V7</small></div></Link>
    <span className="navLabel">სამუშაო სივრცე</span><nav aria-label="ადმინის მენიუ">{links.map(l=>{const Icon=icons[l.id as keyof typeof icons];return <Link key={l.id} aria-current={active===l.id?'page':undefined} className={active===l.id?'active':''} href={l.href} onClick={()=>setOpen(false)}><Icon size={18}/><span>{l.label}</span>{active===l.id&&<i/>}</Link>})}</nav>
    <div className="sidebarBottom"><div className="adminVersion"><span>TOPURIA STUDIO</span><p>შენი მაღაზია.<br/>ერთი სივრცე.</p></div><Link href="/" target="_blank" rel="noopener noreferrer">მაღაზიის ნახვა <ArrowUpRight size={17}/></Link><button disabled={busy} onClick={logout}><LogOut size={17}/>{busy?'გასვლა...':'გასვლა'}</button>{error&&<p role="alert">{error}</p>}</div>
  </aside>
  {open&&<button className="adminBackdrop" aria-label="მენიუს დახურვა" onClick={()=>setOpen(false)}/>}
  <header className="adminToolbar"><div><button className="adminMenuButton" aria-controls="admin-navigation" aria-label={open?'მენიუს დახურვა':'მენიუს გახსნა'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X size={19}/>:<Menu size={19}/>}</button>
    <form action="/admin/products" className="adminSearch"><Search size={16}/><input aria-label="პროდუქტის ძებნა" name="q" placeholder="მოძებნე პროდუქტი..." value={query} onChange={e=>setQuery(e.target.value)}/></form></div>
    <div className="adminTools"><span className="adminLive">სამუშაო სივრცე</span><button aria-label={light?'მუქი რეჟიმი':'ნათელი რეჟიმი'} onClick={()=>setLight(!light)}>{light?<Moon size={19}/>:<Sun size={19}/>}</button><span className="toolbarDivider"/><span className="adminAvatar">{name.charAt(0).toUpperCase()}</span><div className="adminIdentity"><b>{name}</b><small>{role==='ADMIN'?'მფლობელი':'ოპერატორი'}</small></div></div>
  </header></>;
}
