'use client';

import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, CircleAlert, Clock3, LockKeyhole, RefreshCw, ShieldCheck} from 'lucide-react';
import {Header} from '../../components';
import {useCatalog} from '../../catalog';
import {useStore} from '../../store';
import {moneyMinor, readAttempt, saveAttempt, type CheckoutResult, type CheckoutStatus} from '../types';

const statusCopy: Record<CheckoutStatus, {title: string; description: string}> = {
  CREATING: {title: 'გადახდა მზადდება', description: 'ბანკისგან დადასტურებას ველოდებით. სტატუსს ავტომატურად გადავამოწმებთ.'},
  PENDING: {title: 'გადახდა მოწმდება', description: 'ბანკისგან დადასტურებას ველოდებით. სტატუსს ავტომატურად გადავამოწმებთ.'},
  PAID: {title: 'გადახდა დადასტურებულია', description: 'მადლობა, თქვენი შეკვეთა მიღებულია.'},
  FAILED: {title: 'გადახდა ვერ შესრულდა', description: 'შეგიძლიათ კალათას დაუბრუნდეთ და ხელახლა სცადოთ.'},
  EXPIRED: {title: 'გადახდის დრო ამოიწურა', description: 'მარაგის დაჯავშნის ვადა დასრულდა. შეკვეთის გაფორმება თავიდან შეგიძლიათ.'},
  REVIEW: {title: 'შეკვეთა გადამოწმებას საჭიროებს', description: 'გადახდის საბოლოო მდგომარეობა ზუსტდება. ხელახლა ნუ გადაიხდით; შეკვეთას მაღაზია გადაამოწმებს.'},
};

function bankUrl(value: string | undefined) {
  try {const url = new URL(value || ''); return url.protocol === 'https:' && ['payment.bog.ge', 'payment-sandbox.bog.ge'].includes(url.hostname) ? url.href : null} catch {return null}
}

export default function PaymentResult() {
  const search = useSearchParams();
  const reference = search.get('reference') || '';
  const suppliedToken = search.get('token') || '';
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [pollingDone, setPollingDone] = useState(false);
  const [reload, setReload] = useState(0);
  const cleared = useRef('');
  const {clearPurchased, cartReady} = useStore();
  const {refresh} = useCatalog();

  useEffect(() => {
    let resolved = suppliedToken;
    try {
      if (!resolved) resolved = sessionStorage.getItem(`tp-checkout-token:${reference}`) || '';
      if (!resolved) {const attempt = readAttempt(); if (attempt?.id === reference) resolved = attempt.token || ''}
      if (resolved) sessionStorage.setItem(`tp-checkout-token:${reference}`, resolved);
    } catch {}
    setToken(resolved);
    setReady(true);
    // Keep the receipt token out of copied URLs and subsequent referrers.
    if (suppliedToken) window.history.replaceState(null, '', `/checkout/return?reference=${encodeURIComponent(reference)}`);
  }, [reference, suppliedToken]);

  useEffect(() => {
    if (!ready || !reference || !token) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let count = 0;
    setPollingDone(false);
    async function check() {
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 15_000);
      setChecking(true);
      let pending = true;
      try {
        const response = await fetch(`/api/checkout/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`, {cache: 'no-store', signal: controller.signal});
        const value = await response.json() as CheckoutResult & {error?: string};
        if (stopped) return;
        if (!response.ok) {if ([400, 401, 403, 404].includes(response.status)) pending = false; throw new Error(value.error || 'გადახდის სტატუსი ვერ გადამოწმდა.')}
        if (!value.id || !(value.status in statusCopy)) throw new Error('გადახდის სტატუსი ვერ დადასტურდა.');
        setResult(value);
        setError('');
        pending = value.status === 'CREATING' || value.status === 'PENDING';
        if (['PAID', 'FAILED', 'EXPIRED'].includes(value.status) && readAttempt()?.id === value.id) saveAttempt(null);
      } catch (reason) {
        if (!stopped) setError(reason instanceof Error && !(reason instanceof TypeError) && reason.name !== 'AbortError' ? reason.message : 'ბანკის პასუხი იგვიანებს. გადაამოწმეთ ხელახლა.');
      } finally {
        window.clearTimeout(timeout);
        if (!stopped) {
          setChecking(false);
          count += 1;
          if (pending && count < 12) timer = setTimeout(() => void check(), 5000);
          else setPollingDone(pending);
        }
      }
    }
    void check();
    return () => {stopped = true; controller?.abort(); if (timer) clearTimeout(timer)};
  }, [ready, reference, token, reload]);

  useEffect(() => {
    if (!cartReady || result?.status !== 'PAID' || cleared.current === result.id) return;
    const key = `tp-checkout-cleared:${result.id}`;
    try {if (sessionStorage.getItem(key)) {cleared.current = result.id; return}} catch {}
    cleared.current = result.id;
    clearPurchased(result.items.map(item => ({slug: item.slug, size: item.size, qty: item.qty})));
    try {sessionStorage.setItem(key, '1')} catch {}
    void refresh();
  }, [cartReady, result, clearPurchased, refresh]);

  const missing = ready && (!reference || !token);
  const copy = result ? statusCopy[result.status] : null;
  const pending = result?.status === 'PENDING' || result?.status === 'CREATING';
  const resumeUrl = pending ? bankUrl(result.redirectUrl) : null;

  return <main className="v7Store directCatalog checkoutPage"><Header/><div className="checkoutResultShell"><span className="checkoutEyebrow">TOPURIA PREMIUM</span><article className={`checkoutResultCard ${result?.status === 'PAID' ? 'paid' : ''}`} aria-live="polite">
    <div className={`checkoutResultIcon ${pending || !result ? 'pending' : ''}`}>{result?.status === 'PAID' ? <Check size={30}/> : result?.status === 'REVIEW' || result?.status === 'FAILED' || result?.status === 'EXPIRED' || missing ? <CircleAlert size={29}/> : <Clock3 size={29}/>}</div>
    <h1>{missing ? 'შეკვეთის ბმული არასრულია' : copy?.title || 'გადახდის სტატუსი მოწმდება'}</h1>
    <p>{missing ? 'შეკვეთის სტატუსის სანახავად გამოიყენეთ იმავე ბრაუზერში შენახული ბმული. დახმარებისთვის მიმართეთ მაღაზიას.' : copy?.description || 'ველოდებით ბანკის მიერ დადასტურებულ ინფორმაციას.'}</p>
    {result?.mode === 'sandbox' && <div className="checkoutTestNotice">სატესტო რეჟიმი — რეალური გადახდა არ შესრულებულა.</div>}
    {error && <div className="checkoutAlert" role="alert">{error}</div>}
    {result && <><dl className="checkoutReceipt"><div><dt>შეკვეთა</dt><dd>{result.orderNo}</dd></div><div><dt>თანხა</dt><dd>{moneyMinor(result.amountMinor)}</dd></div><div><dt>სტატუსი</dt><dd>{result.status === 'PAID' ? 'გადახდილია' : result.status === 'FAILED' ? 'ვერ შესრულდა' : result.status === 'EXPIRED' ? 'ვადა ამოიწურა' : result.status === 'REVIEW' ? 'გადასამოწმებელია' : 'მოლოდინში'}</dd></div></dl><div className="checkoutReceiptItems">{result.items.map((item, index) => <div key={`${item.slug}-${item.size}-${index}`}><span>{item.name}<small>{item.size ? `${item.size} · ` : ''}{item.qty} ცალი</small></span><b>{moneyMinor(item.priceMinor * item.qty)}</b></div>)}</div></>}
    {pollingDone && <p className="checkoutHint">დადასტურება ჯერ არ მიგვიღია. ხელახლა გადახდამდე სტატუსი გადაამოწმეთ.</p>}
    {!missing && (!result || pending || result.status === 'REVIEW' || error) && <button className="checkoutSecondary" disabled={checking} onClick={() => setReload(value => value + 1)}><RefreshCw size={14}/>{checking ? 'მოწმდება…' : 'სტატუსის გადამოწმება'}</button>}
    {resumeUrl && <a className="checkoutPrimary" href={resumeUrl}>გადახდის გაგრძელება <ArrowRight size={16}/></a>}
    {(result?.status === 'FAILED' || result?.status === 'EXPIRED') && <Link className="checkoutPrimary" href="/cart">კალათაში დაბრუნება <ArrowRight size={16}/></Link>}
    {(result?.status === 'PAID' || missing) && <Link className="checkoutPrimary" href="/shop">კოლექციის ნახვა <ArrowRight size={16}/></Link>}
    <div className="checkoutResultSecurity"><ShieldCheck size={15}/><span>სტატუსი მოწმდება ბანკის სისტემაში</span><LockKeyhole size={12}/></div>
  </article></div></main>;
}
