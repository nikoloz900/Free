import {Suspense} from 'react';
import ShopClient from './shop/shop-client';
export default function Home(){return <Suspense fallback={<div className="catalogLoading">კოლექცია იტვირთება...</div>}><ShopClient home/></Suspense>}
