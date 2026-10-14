'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {products} from './data';
export type CartItem={slug:string;size:string;qty:number};
type Store={cart:CartItem[];wishlist:string[];add:(slug:string,size?:string,qty?:number)=>void;remove:(slug:string,size?:string)=>void;setQty:(slug:string,size:string,qty:number)=>void;toggleWish:(slug:string)=>void;cartCount:number};
const C=createContext<Store|null>(null);
export function StoreProvider({children}:{children:React.ReactNode}){const [cart,setCart]=useState<CartItem[]>([]);const [wishlist,setWishlist]=useState<string[]>([]);const [ready,setReady]=useState(false);
 useEffect(()=>{try{setCart(JSON.parse(localStorage.getItem('tp-cart')||'[]'));setWishlist(JSON.parse(localStorage.getItem('tp-wishlist')||'[]'))}catch{}setReady(true)},[]);
 useEffect(()=>{if(ready)localStorage.setItem('tp-cart',JSON.stringify(cart))},[cart,ready]);useEffect(()=>{if(ready)localStorage.setItem('tp-wishlist',JSON.stringify(wishlist))},[wishlist,ready]);
 const add=(slug:string,size='M',qty=1)=>setCart(c=>{const i=c.findIndex(x=>x.slug===slug&&x.size===size);if(i<0)return [...c,{slug,size,qty}];return c.map((x,n)=>n===i?{...x,qty:x.qty+qty}:x)});
 const remove=(slug:string,size?:string)=>setCart(c=>c.filter(x=>!(x.slug===slug&&(!size||x.size===size))));
 const setQty=(slug:string,size:string,qty:number)=>qty<=0?remove(slug,size):setCart(c=>c.map(x=>x.slug===slug&&x.size===size?{...x,qty}:x));
 const toggleWish=(slug:string)=>setWishlist(w=>w.includes(slug)?w.filter(x=>x!==slug):[...w,slug]);
 const value=useMemo(()=>({cart,wishlist,add,remove,setQty,toggleWish,cartCount:cart.reduce((a,b)=>a+b.qty,0)}),[cart,wishlist]);return <C.Provider value={value}>{children}</C.Provider>}
export function useStore(){const v=useContext(C);if(!v)throw new Error('StoreProvider missing');return v}
export const productBySlug=(slug:string)=>products.find(p=>p.slug===slug);
