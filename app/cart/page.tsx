'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {ArrowRight, LockKeyhole, Minus, Plus, Trash2} from 'lucide-react';
import {Header, ProductVisual} from '../components';
import {useStore} from '../store';
import {useCatalog, CatalogError} from '../catalog';
import {money} from '../../lib/format';
import {readAttempt, returnPath, type CheckoutAttempt} from '../checkout/types';
import '../checkout.css';

export default function Cart() {
  const {cart, cartReady, remove, setQty} = useStore();
  const {products, error} = useCatalog();
  const [attempt, setAttempt] = useState<CheckoutAttempt | null>(null);
  useEffect(() => {setAttempt(readAttempt())}, []);
  const rows = cart.map(item => ({item, product: products.find(product => product.slug === item.slug)}));
  const total = rows.reduce((sum, row) => sum + (row.product?.price || 0) * row.item.qty, 0);
  const invalid = rows.some(({item, product}) => !product || (product.sizes.length > 0 && !product.sizes.includes(item.size))
    || cart.filter(row => row.slug === item.slug).reduce((sum, row) => sum + row.qty, 0) > product.stock);
  const resumeHref = attempt ? attempt.id && attempt.token ? returnPath(attempt.id, attempt.token) : '/checkout' : null;

  return <main className="v7Store directCatalog"><Header/><CatalogError/><div className="cart"><h1>კალათა <span>({cart.reduce((sum, item) => sum + item.qty, 0)})</span></h1>
    {!cartReady ? <p role="status">კალათა იტვირთება…</p> : !rows.length && !error ? <div className="empty"><h2>კალათა ცარიელია</h2><p>შეარჩიე შენი საყვარელი მოდელი Topuria Premium-ის კოლექციიდან.</p><Link className="btn" href="/shop">შოპინგის დაწყება</Link></div> : <div className="cartLayout"><section>{rows.map(({item, product}) => <div className="cartItem" key={JSON.stringify([item.slug, item.size])}>
      {product ? <ProductVisual imageUrl={product.imageUrl} alt={product.name}/> : <div className="cartUnavailableImage"/>}
      <div className="cartInfo"><h3>{product?.ka || 'პროდუქტი მიუწვდომელია'}</h3>{product && <p>{product.name}</p>}{item.size && <p>ზომა: <b>{item.size}</b></p>}<b>{product ? money(product.price) : '—'}</b>
        {product ? <><div className="cartQty"><button type="button" aria-label="რაოდენობის შემცირება" onClick={() => setQty(item.slug, item.size, item.qty - 1)}><Minus/></button><span>{item.qty}</span><button type="button" aria-label="რაოდენობის გაზრდა" disabled={cart.filter(row => row.slug === item.slug).reduce((sum, row) => sum + row.qty, 0) >= product.stock} onClick={() => setQty(item.slug, item.size, item.qty + 1)}><Plus/></button></div>{(product.stock === 0 || (product.sizes.length > 0 && !product.sizes.includes(item.size))) && <p className="cartStockNotice">არჩეული მოდელი ან ზომა აღარ არის ხელმისაწვდომი.</p>}</> : <p className="cartStockNotice">გთხოვთ, წაშალოთ პროდუქტი კალათიდან.</p>}
      </div><button type="button" className="remove" onClick={() => remove(item.slug, item.size)} aria-label="წაშლა"><Trash2/></button></div>)}</section>
      <aside className="summary cartCheckoutSummary"><h2>შეკვეთის შეჯამება</h2><p><span>პროდუქტები</span><b>{money(total)}</b></p><p><span>მიღების მეთოდი</span><span>გაფორმებისას</span></p><hr/><p className="total"><span>პროდუქტების ჯამი</span><b>{money(total)}</b></p>
        {resumeHref && <Link className="checkoutPrimary" href={resumeHref}>დაწყებული გადახდის გაგრძელება <ArrowRight size={16}/></Link>}
        {(invalid || error) ? <p className="cartStockNotice" role="alert">გადახდამდე გადაამოწმეთ კალათაში პროდუქტების ხელმისაწვდომობა და რაოდენობა.</p> : !resumeHref && <Link className="checkoutPrimary" href="/checkout">შეკვეთის გაფორმება <ArrowRight size={16}/></Link>}
        <p className="checkoutRedirectNote"><LockKeyhole size={12}/> გადახდის ხელმისაწვდომობა — გაფორმების გვერდზე</p><div className="checkoutBrands"><b>VISA</b><b>Mastercard</b><span>Apple Pay</span><span>ნაწილ-ნაწილ</span></div><Link className="cartContinue" href="/shop">← შოპინგის გაგრძელება</Link>
      </aside></div>}
  </div></main>;
}
