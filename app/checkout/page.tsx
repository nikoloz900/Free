'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Check, CreditCard, Landmark, LockKeyhole, MapPin, PackageCheck, ShieldCheck, Smartphone, Wallet} from 'lucide-react';
import {Header, ProductVisual} from '../components';
import {useCatalog} from '../catalog';
import {useStore} from '../store';
import {moneyMinor, readAttempt, returnPath, saveAttempt, type CheckoutAttempt, type CheckoutConfig, type CheckoutPayload, type CheckoutResult, type PaymentMethod} from './types';

const methodCopy: Record<PaymentMethod, {title: string; description: string}> = {
  card: {title: 'საბანკო ბარათი', description: 'Visa / Mastercard'},
  apple_pay: {title: 'Apple Pay', description: 'თავსებად მოწყობილობაზე, ბანკის გვერდზე'},
  bnpl: {title: 'ნაწილ-ნაწილ', description: 'საქართველოს ბანკი'},
  bog_loan: {title: 'განვადება', description: 'საქართველოს ბანკი'},
};
const methodIds: PaymentMethod[] = ['card', 'apple_pay', 'bnpl', 'bog_loan'];

function MethodIcon({method}: {method: PaymentMethod}) {
  if (method === 'apple_pay') return <Smartphone size={22}/>;
  if (method === 'bnpl') return <Wallet size={22}/>;
  if (method === 'bog_loan') return <Landmark size={22}/>;
  return <CreditCard size={22}/>;
}

export default function CheckoutPage() {
  const router = useRouter();
  const {cart, cartReady} = useStore();
  const {products, error: catalogError, refresh} = useCatalog();
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [configReload, setConfigReload] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [delivery, setDelivery] = useState<'pickup' | 'delivery'>('pickup');
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState<CheckoutAttempt | null>(null);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const errorElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = readAttempt();
    setAttempt(saved);
    if (saved) {
      setName(saved.payload.customer.name);
      setPhone(saved.payload.customer.phone);
      setEmail(saved.payload.customer.email || '');
      setAddress(saved.payload.customer.address || '');
      setDelivery(saved.payload.delivery);
      setMethod(saved.payload.method);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setConfigError('');
    fetch('/api/checkout/config', {cache: 'no-store', signal: controller.signal})
      .then(async response => {if (!response.ok) throw new Error(); return await response.json() as CheckoutConfig})
      .then(value => {
        if (controller.signal.aborted) return;
        setConfig(value);
        setMethod(readAttempt()?.payload.method || value.methods.find(item => item.enabled)?.id || 'card');
      })
      .catch(() => {if (!controller.signal.aborted) setConfigError('გადახდის მეთოდები ვერ ჩაიტვირთა. სცადეთ ხელახლა.')});
    return () => controller.abort();
  }, [configReload]);
  useEffect(() => {if (error) errorElement.current?.focus()}, [error]);

  const rows = cart.map(item => ({item, product: products.find(product => product.slug === item.slug)}));
  const totalMinor = rows.reduce((sum, row) => sum + (row.product ? row.product.price * 100 * row.item.qty : 0), 0);
  const invalidCart = rows.some(({item, product}) => !product || product.stock < cart.filter(row => row.slug === item.slug).reduce((sum, row) => sum + row.qty, 0)
    || (product.sizes.length > 0 && !product.sizes.includes(item.size)));
  const available = Boolean(config?.enabled && config.methods.some(item => item.id === method && item.enabled));
  const pendingPath = attempt?.id && attempt.token ? returnPath(attempt.id, attempt.token) : null;

  async function send(payload: CheckoutPayload) {
    if (sending.current) return;
    sending.current = true;
    setSubmitting(true);
    setError('');
    const current: CheckoutAttempt = {payload, state: 'uncertain'};
    setAttempt(current);
    saveAttempt(current);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch('/api/checkout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload), signal: controller.signal});
      const result = await response.json() as CheckoutResult & {error?: string; safeToRestart?: boolean};
      if (!response.ok) {
        if (result.safeToRestart === true) {
          setAttempt(null);
          saveAttempt(null);
          void refresh();
        }
        throw new Error(result.error || 'შეკვეთის გაფორმება ვერ მოხერხდა.');
      }
      if (!result.id || !result.token || !result.status) throw new Error('პასუხი ვერ დადასტურდა. გააგრძელეთ იგივე მცდელობა.');
      const saved: CheckoutAttempt = {...current, state: 'pending', id: result.id, token: result.token};
      setAttempt(saved);
      saveAttempt(saved);
      if (result.redirectUrl && (result.status === 'CREATING' || result.status === 'PENDING')) {
        const target = new URL(result.redirectUrl);
        if (target.protocol !== 'https:' || !['payment.bog.ge', 'payment-sandbox.bog.ge'].includes(target.hostname)) {
          router.push(returnPath(result.id, result.token));
          return;
        }
        window.location.assign(target.toString());
      } else router.push(returnPath(result.id, result.token));
    } catch (reason) {
      setError(reason instanceof Error && !(reason instanceof TypeError) && reason.name !== 'AbortError' ? reason.message : 'პასუხის მიღება ვერ მოხერხდა. ქვემოთ გააგრძელეთ იგივე მცდელობა — ახალი შეკვეთა არ შეიქმნება.');
    } finally {
      window.clearTimeout(timeout);
      sending.current = false;
      setSubmitting(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available || invalidCart || catalogError || cart.length === 0 || attempt || sending.current) return;
    const customer: CheckoutPayload['customer'] = {name: name.trim(), phone: phone.trim()};
    if (email.trim()) customer.email = email.trim();
    if (delivery === 'delivery') customer.address = address.trim();
    void send({idempotencyKey: crypto.randomUUID(), items: cart.map(item => ({...item})), expectedTotalMinor: totalMinor, customer, delivery, method});
  }

  return <main className="v7Store directCatalog checkoutPage">
    <Header/>
    <div className="checkoutShell">
      <div className="checkoutTopline"><Link href="/cart"><ArrowLeft size={14}/> კალათაში დაბრუნება</Link>{config?.enabled && <span><LockKeyhole size={13}/> დაცული გადახდა</span>}</div>
      <div className="checkoutHeading"><div><span className="checkoutEyebrow">TOPURIA PREMIUM</span><h1>შეკვეთის გაფორმება</h1></div><div className="checkoutSteps" aria-label="შეკვეთის ეტაპები"><span><Check size={12}/> კალათა</span><i/><b>02 <span>გადახდა</span></b><i/><span>03 <span>დადასტურება</span></span></div></div>
      {config?.mode === 'sandbox' && <p className="checkoutTestNotice" role="status">სატესტო რეჟიმი — რეალურ გადახდას არ ახორციელებთ.</p>}
      {error && <div className="checkoutAlert" role="alert" tabIndex={-1} ref={errorElement}>{error}</div>}
      {attempt && <div className="checkoutResume" role="status"><div><b>გადახდის მცდელობა უკვე დაწყებულია</b><p>ჯერ გადაამოწმეთ ეს მცდელობა, რომ შეკვეთა არ გაორმაგდეს.</p></div>{pendingPath ? <Link className="checkoutSecondary" href={pendingPath}>სტატუსის ნახვა <ArrowRight size={14}/></Link> : <button type="button" className="checkoutSecondary" disabled={submitting} onClick={() => void send(attempt.payload)}>{submitting ? 'მოწმდება…' : 'იგივე მცდელობის გაგრძელება'}<ArrowRight size={14}/></button>}</div>}
      {!cartReady ? <div className="checkoutEmpty" role="status">კალათა იტვირთება…</div> : !cart.length && !attempt ? <div className="checkoutEmpty"><PackageCheck size={32}/><h2>კალათა ცარიელია</h2><Link className="checkoutPrimary" href="/shop">კოლექციის ნახვა <ArrowRight size={16}/></Link></div> : <form onSubmit={submit} className="checkoutGrid">
        <div className="checkoutFields">
          <section className="checkoutSection"><div className="checkoutSectionHeading"><span>01</span><h2>საკონტაქტო ინფორმაცია</h2></div><fieldset disabled={submitting || Boolean(attempt)} className="checkoutInputGrid">
            <label className="checkoutFull">სახელი და გვარი<input name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required maxLength={120} placeholder="სახელი და გვარი"/></label>
            <label>ტელეფონი<input name="phone" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} required minLength={7} maxLength={30} placeholder="+995"/></label>
            <label>ელფოსტა <span>(სურვილისამებრ)</span><input name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={180} placeholder="you@example.com"/></label>
          </fieldset></section>
          <section className="checkoutSection"><div className="checkoutSectionHeading"><span>02</span><h2>მიღების მეთოდი</h2></div><fieldset disabled={submitting || Boolean(attempt)} className="checkoutDelivery">
            <label className={delivery === 'pickup' ? 'selected' : ''}><input type="radio" name="delivery" value="pickup" checked={delivery === 'pickup'} onChange={() => setDelivery('pickup')}/><MapPin size={20}/><span><b>მაღაზიიდან გატანა</b><small>{config?.delivery.mode === 'pickup' ? config.delivery.label : 'გატანის დეტალებს დაგიზუსტებთ'}</small></span><b className="checkoutFree">უფასო</b></label>
            {config?.delivery.mode === 'free' && <><label className={delivery === 'delivery' ? 'selected' : ''}><input type="radio" name="delivery" value="delivery" checked={delivery === 'delivery'} onChange={() => setDelivery('delivery')}/><PackageCheck size={20}/><span><b>მიწოდება</b><small>{config.delivery.label}</small></span><b className="checkoutFree">უფასო</b></label>{delivery === 'delivery' && <label className="checkoutAddress">მიწოდების მისამართი<textarea name="address" autoComplete="street-address" required maxLength={500} rows={3} value={address} onChange={event => setAddress(event.target.value)} placeholder="ქალაქი, ქუჩა, სახლის ნომერი"/> </label>}</>}
          </fieldset></section>
          <section className="checkoutSection"><div className="checkoutSectionHeading"><span>03</span><h2>გადახდის მეთოდი</h2><LockKeyhole size={15}/></div>
            {configError && <div className="checkoutConfigError" role="alert">{configError}<button type="button" onClick={() => setConfigReload(value => value + 1)}>ხელახლა ცდა</button></div>}
            {!config && !configError && <p className="checkoutHint" role="status">გადახდის მეთოდები იტვირთება…</p>}
            <fieldset className="checkoutMethods" disabled={submitting || Boolean(attempt)}>{methodIds.map(id => {
              const supported = Boolean(config?.enabled && config.methods.some(item => item.id === id && item.enabled));
              return <label key={id} className={`checkoutMethod${method === id ? ' selected' : ''}${supported ? '' : ' unavailable'}`}><input type="radio" name="method" value={id} disabled={!supported} checked={method === id} onChange={() => setMethod(id)}/><span className="checkoutMethodIcon"><MethodIcon method={id}/></span><span className="checkoutMethodCopy"><b>{methodCopy[id].title}</b><small>{methodCopy[id].description}</small></span><span className="checkoutRadio" aria-hidden="true">{method === id && <span/>}</span>{!supported && <em>ჯერ მიუწვდომელია</em>}</label>;
            })}</fieldset>
            {config && !config.enabled && <p className="checkoutActivation" role="status">{config.message || 'ონლაინ გადახდა ბანკის სერვისის გააქტიურების შემდეგ გახდება ხელმისაწვდომი.'}</p>}
            {(method === 'bnpl' || method === 'bog_loan') && <p className="checkoutHint">პირობებსა და ხელმისაწვდომობას საქართველოს ბანკი განსაზღვრავს. საბოლოო არჩევანსა და პირობებს ბანკის გვერდზე ნახავთ.</p>}
            {config?.enabled && <div className="checkoutSecurity"><ShieldCheck size={18}/><p>ბარათის მონაცემები შეგყავთ საქართველოს ბანკის დაცულ გვერდზე.</p></div>}
          </section>
        </div>
        <aside className="checkoutSummary"><div className="checkoutSummaryHeading"><h2>თქვენი შეკვეთა</h2><span>{cart.reduce((sum, item) => sum + item.qty, 0)} ნივთი</span></div><div className="checkoutProducts">{rows.map(({item, product}) => <div className="checkoutProduct" key={JSON.stringify([item.slug, item.size])}>{product && <ProductVisual imageUrl={product.imageUrl} alt={product.name}/>}<div><b>{product?.ka || item.slug}</b><small>{item.size ? `ზომა: ${item.size} · ` : ''}რაოდენობა: {item.qty}</small></div><span>{product ? moneyMinor(product.price * 100 * item.qty) : '—'}</span></div>)}</div>
          <dl className="checkoutTotals"><div><dt>პროდუქტები</dt><dd>{moneyMinor(totalMinor)}</dd></div><div><dt>{delivery === 'pickup' ? 'მაღაზიიდან გატანა' : 'მიწოდება'}</dt><dd>უფასო</dd></div><div className="checkoutTotal"><dt>სულ</dt><dd>{moneyMinor(totalMinor)}<small>GEL</small></dd></div></dl>
          {(invalidCart || catalogError) && <div className="checkoutStockError" role="alert">{catalogError || 'კალათაში პროდუქტის მარაგი ან ხელმისაწვდომობა შეიცვალა.'}<Link href="/cart">კალათის გადამოწმება</Link></div>}
          <button className="checkoutPrimary" type="submit" disabled={!cartReady || !available || !cart.length || invalidCart || Boolean(catalogError) || Boolean(attempt) || submitting}>{submitting ? 'გადახდა მზადდება…' : 'გადახდაზე გადასვლა'}<ArrowRight size={17}/></button>
          <p className="checkoutRedirectNote"><LockKeyhole size={12}/> გადახდის დასასრულებლად გადახვალთ ბანკის გვერდზე.</p>
          <div className="checkoutBrands" aria-label="ბანკის მიერ მხარდაჭერილი მეთოდები"><b>VISA</b><b>Mastercard</b><span>Apple Pay</span><span>ნაწილ-ნაწილ</span></div>
        </aside>
      </form>}
    </div>
  </main>;
}
