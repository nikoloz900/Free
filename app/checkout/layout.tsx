import type {Metadata} from 'next';
import '../checkout.css';

export const metadata: Metadata = {title: 'შეკვეთის გაფორმება', robots: {index: false, follow: false}, referrer: 'no-referrer'};

export default function CheckoutLayout({children}: {children: React.ReactNode}) {
  return children;
}
