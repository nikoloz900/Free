'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {useCatalog} from './catalog';
import {track} from './tracking';
export type CartItem={slug:string;size:string;qty:number};
type Store={cart:CartItem[];wishlist:string[];add:(slug:string,size?:string,qty?:number)=>void;remove:(slug:string,size?:string)=>void;setQty:(slug:string,size:string,qty:number)=>void;toggleWish:(slug:string)=>void;cartCount:number};
const C=createContext<Store|null>(null);
export function StoreProvider({children}:{children:React.ReactNode}){const {products}=useCatalog();const [cart,setCart]=useState<CartItem[]>([]);const [wishlist,setWishlist]=useState<string[]>([]);const [ready,setReady]=useState(false);
 useEffect(()=>{try{
 const saved=JSON.parse(localStorage.getItem('tp-cart')||'[]');const wishes=JSON.parse(localStorage.getItem('tp-wishlist')||'[]');
 if(Array.isArray(saved))setCart(saved.filter((x)=>x&&typeof x.slug==='string'&&typeof x.size==='string'&&Number.isInteger(x.qty)&&x.qty>0).slice(0,100));
 if(Array.isArray(wishes))setWishlist(wishes.filter((x)=>typeof x==='string').slice(0,500));
 }catch{}setReady(true)},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem('tp-cart',JSON.stringify(cart))}catch{}},[cart,ready]);useEffect(()=>{if(ready)try{localStorage.setItem('tp-wishlist',JSON.stringify(wishlist))}catch{}},[wishlist,ready]);
 const add=(slug:string,size='',qty=1)=>{
  const p=products.find(p=>p.slug===slug);if(!p||p.stock<=0||!Number.isInteger(qty)||qty<=0||(p.sizes.length>0&&!p.sizes.includes(size)))return;
  setCart(c=>{const existing=c.filter(i=>i.slug===slug).reduce((s,i)=>s+i.qty,0);const count=Math.min(qty,p.stock-existing);if(count<=0)return c;
   const i=c.findIndex(x=>x.slug===slug&&x.size===size);return i<0?[...c,{slug,size,qty:count}]:c.map((x,n)=>n===i?{...x,qty:x.qty+count}:x)});
  if(cart.filter(i=>i.slug===slug).reduce((s,i)=>s+i.qty,0)<p.stock)track('add_to_cart',slug);
 };
 const remove=(slug:string,size?:string)=>setCart(c=>c.filter(x=>!(x.slug===slug&&(!size||x.size===size))));
 const setQty=(slug:string,size:string,qty:number)=>{
  if(!Number.isInteger(qty))return;if(qty<=0){remove(slug,size);return}
  const p=products.find(p=>p.slug===slug);if(!p)return;
  setCart(c=>{const others=c.filter(i=>i.slug===slug&&i.size!==size).reduce((s,i)=>s+i.qty,0);
   const count=Math.max(0,Math.min(qty,p.stock-others));return c.map(x=>x.slug===slug&&x.size===size?{...x,qty:count}:x).filter(x=>x.qty>0)});
 };
 const toggleWish=(slug:string)=>setWishlist(w=>w.includes(slug)?w.filter(x=>x!==slug):[...w,slug]);
 const value=useMemo(()=>({cart,wishlist,add,remove,setQty,toggleWish,cartCount:cart.reduce((a,b)=>a+b.qty,0)}),[cart,wishlist,products]);return <C.Provider value={value}>{children}</C.Provider>}
export function useStore(){const v=useContext(C);if(!v)throw new Error('StoreProvider missing');return v}
