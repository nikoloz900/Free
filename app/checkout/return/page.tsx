import {Suspense} from 'react';
import PaymentResult from './payment-result';

export default function ReturnPage() {
  return <Suspense fallback={<main className="v7Store directCatalog checkoutPage"><div className="checkoutResultCard" role="status">გადახდის სტატუსი მოწმდება…</div></main>}><PaymentResult/></Suspense>;
}
