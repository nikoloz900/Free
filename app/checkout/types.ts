export type PaymentMethod = 'card' | 'apple_pay' | 'bnpl' | 'bog_loan';
export type CheckoutStatus = 'CREATING' | 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REVIEW';
export type CheckoutConfig = {
  enabled: boolean;
  mode: 'sandbox' | 'production' | 'disabled';
  delivery: {mode: 'pickup' | 'free' | 'courier'; label: string};
  methods: {id: PaymentMethod; label: string; enabled: boolean}[];
  message?: string;
};
export type CheckoutPayload = {
  idempotencyKey: string;
  items: {slug: string; size: string; qty: number}[];
  expectedTotalMinor: number;
  customer: {name: string; phone: string; email?: string; address?: string};
  delivery: 'pickup' | 'delivery';
  method: PaymentMethod;
};
export type CheckoutResult = {
  id: string;
  token?: string;
  orderNo: string;
  status: CheckoutStatus;
  redirectUrl?: string;
  amountMinor: number;
  currency: 'GEL';
  expiresAt: string;
  mode: 'sandbox' | 'production';
  items: {slug: string; name: string; priceMinor: number; qty: number; size: string}[];
  message?: string;
};
export type CheckoutAttempt = {payload: CheckoutPayload; state: 'uncertain' | 'pending'; id?: string; token?: string};
export const attemptStorageKey = 'tp-checkout-attempt-v1';
export function moneyMinor(value: number) {
  return new Intl.NumberFormat('ka-GE', {style: 'currency', currency: 'GEL', currencyDisplay: 'narrowSymbol'}).format(value / 100);
}
export function readAttempt(): CheckoutAttempt | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(attemptStorageKey) || 'null') as CheckoutAttempt | null;
    if (saved?.payload && typeof saved.payload.idempotencyKey === 'string' && Array.isArray(saved.payload.items)
      && saved.payload.customer && typeof saved.payload.customer.name === 'string' && typeof saved.payload.customer.phone === 'string'
      && (saved.state === 'uncertain' || saved.state === 'pending')) return saved;
  } catch {}
  return null;
}
export function saveAttempt(value: CheckoutAttempt | null) {
  try {if (value) sessionStorage.setItem(attemptStorageKey, JSON.stringify(value)); else sessionStorage.removeItem(attemptStorageKey)} catch {}
}
export function returnPath(id: string, token: string) {
  return `/checkout/return?reference=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
}
