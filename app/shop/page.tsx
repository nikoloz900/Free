import { Suspense } from 'react'; import ShopClient from './shop-client'; export default function Page() { return <Suspense fallback={<div>იტვირთება...</div>}><ShopClient /></Suspense>; }
