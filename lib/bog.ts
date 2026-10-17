import {verify as verifySignature} from 'node:crypto';

// Server-side only. Never import this module from a Client Component.
// Official contracts (including their sandbox equivalents):
// https://api.bog.ge/docs/en/payments/authentication
// https://api.bog.ge/docs/en/payments/standard-process/create-order
// https://api.bog.ge/docs/en/payments/standard-process/get-payment-details
// https://api.bog.ge/docs/en/payments/standard-process/callback
const ENDPOINTS = {
  sandbox: {
    token: 'https://oauth2-sandbox.bog.ge/auth/realms/bog/protocol/openid-connect/token',
    api: 'https://api-sandbox.bog.ge/payments/v1',
    checkoutHost: 'payment-sandbox.bog.ge',
    publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqczfAuhtxw2iF68kS0Hy
bGSv0ZlDAjsXh6VC8avDl3Vxa9qCn6Pzl37Tl2Z21WodiISLeXdhCtOMTeLNUBeb
CYD31y2/MwnhLYqlCk2bOh29fyPc1iT5Eu/k/1IaNRrK9/UVZaTkhOMeEm+aL4y8
5XsE4UjqftEmwrAdbO2G4cCpuoMC9ZXG9gAdr2BFN6i2Vt9eCen5Poj7E1ik7s8T
GyzploVV0NflhwBGeWnvQANUQGr87gsP5k2JG1z5EwnMybJQ7i3XT726rJMaV6QW
sY5hP72Mtv1I1zL2d9FXm9FWOzbpcXCyxuEBXvqqOHzogri8C7KRRYKyk97Ri7D6
8wIDAQAB
-----END PUBLIC KEY-----`,
  },
  production: {
    token: 'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token',
    api: 'https://api.bog.ge/payments/v1',
    checkoutHost: 'payment.bog.ge',
    publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQh
zHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q
1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrr
TYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhx
tcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g
4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPn
PwIDAQAB
-----END PUBLIC KEY-----`,
  },
} as const;

export type BogMethod = 'card' | 'apple_pay' | 'bnpl' | 'bog_loan';
export type NormalizedBogOrder = {
  id: string;
  reference: string;
  currency: string;
  totalMinor: number;
  status: 'paid' | 'failed' | 'expired' | 'pending' | 'review';
  rawStatus: string;
  method?: string;
};

export class BogError extends Error {
  constructor(message: string, readonly ambiguous = false) {
    super(message);
    this.name = 'BogError';
  }
}

function endpoints() {
  const environment = process.env.BOG_ENVIRONMENT || 'sandbox';
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new BogError('გადახდის გარემო არასწორადაა კონფიგურირებული.');
  }
  return ENDPOINTS[environment];
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,150}$/.test(value);
}

function money(value: unknown): number | null {
  // Receipts return decimal strings in major currency units, not tetri.
  if (typeof value !== 'string' || !/^\d{1,13}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

function minorAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

async function responseJson(response: Response, ambiguous: boolean): Promise<unknown> {
  // Do not log the bank's response: it may contain credentials or payer details.
  const reader = response.body?.getReader();
  if (!reader) throw new BogError('ბანკის პასუხი არასრულია.', ambiguous);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > 256_000) {
        await reader.cancel();
        throw new BogError('ბანკის პასუხი არასწორია.', ambiguous);
      }
      chunks.push(result.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new BogError('ბანკის პასუხი ვერ დამუშავდა.', ambiguous);
  } finally {
    reader.releaseLock();
  }
}

async function requestJson(url: string, init: RequestInit, mayCreateOrder: boolean): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new BogError('ბანკთან დაკავშირება ვერ მოხერხდა. სტატუსი ხელახლა უნდა გადამოწმდეს.', mayCreateOrder);
  }
  if (!response.ok) {
    // Network/5xx and requests still in progress must retain the reservation:
    // the bank may have already created the order. A retry uses the SAME key.
    const ambiguous = mayCreateOrder && (response.status >= 500 || response.status === 408 || response.status === 409 || response.status === 429);
    await response.body?.cancel();
    throw new BogError('ბანკმა მოთხოვნა ვერ დაასრულა.', ambiguous);
  }
  return responseJson(response, mayCreateOrder);
}

async function accessToken(): Promise<string> {
  const clientId = process.env.BOG_CLIENT_ID?.trim();
  const clientSecret = process.env.BOG_CLIENT_SECRET;
  if (!clientId || !clientSecret || clientId.length > 4096 || clientSecret.length > 4096 || /[\r\n]/.test(clientId + clientSecret)) {
    throw new BogError('ბარათით გადახდა ჯერ არ არის გააქტიურებული.');
  }
  const body = record(await requestJson(endpoints().token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  }, false));
  if (typeof body.access_token !== 'string' || !body.access_token || body.access_token.length > 16_384 || body.token_type !== 'Bearer') {
    throw new BogError('ბანკის ავტორიზაცია ვერ დასრულდა.');
  }
  return body.access_token;
}

function validateReturnUrls(callbackUrl: string, successUrl: string, failUrl: string) {
  let urls: URL[];
  try { urls = [callbackUrl, successUrl, failUrl].map(value => new URL(value)); }
  catch { throw new BogError('გადახდის მისამართები არასწორია.'); }
  if (urls.some(url => url.protocol !== 'https:' || url.username || url.password || url.hash || url.origin !== urls[0].origin)) {
    throw new BogError('გადახდის მისამართები ერთ HTTPS დომენზე უნდა იყოს.');
  }
  // The caller must construct these from APP_URL, never from user input/Host.
  let configuredOrigin: string;
  try { configuredOrigin = new URL(process.env.APP_URL || '').origin; }
  catch { throw new BogError('საიტის მისამართი ჯერ არ არის კონფიგურირებული.'); }
  if (urls[0].origin !== configuredOrigin) throw new BogError('გადახდის დომენი არ ემთხვევა საიტის მისამართს.');
}

export async function createBogOrder(input: {
  reference: string;
  idempotencyKey: string;
  totalMinor: number;
  deliveryMinor?: number;
  items: {productId: string; name: string; quantity: number; unitPriceMinor: number}[];
  callbackUrl: string;
  successUrl: string;
  failUrl: string;
  methods: BogMethod[];
}): Promise<{id: string; redirectUrl: string}> {
  if (!identifier(input.reference) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey)) {
    throw new BogError('შეკვეთის იდენტიფიკატორი არასწორია.');
  }
  const methods = [...new Set(input.methods)];
  if (!methods.length || methods.some(method => !['card', 'apple_pay', 'bnpl', 'bog_loan'].includes(method)) || !methods.some(method => method === 'card' || method === 'apple_pay')) {
    // Loan-only orders need calculator-supplied config.loan, which this hosted
    // checkout does not guess. Card + bnpl/loan lets the bank collect terms.
    throw new BogError('გადახდის მეთოდი არასწორია.');
  }
  if (!minorAmount(input.totalMinor) || !input.items.length || input.items.length > 100 || input.items.some(item =>
    !identifier(item.productId) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 300 ||
    !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 || !minorAmount(item.unitPriceMinor)
  )) throw new BogError('შეკვეთის თანხა ან პროდუქტები არასწორია.');
  const deliveryMinor = input.deliveryMinor ?? 0;
  if (!Number.isSafeInteger(deliveryMinor) || deliveryMinor < 0) throw new BogError('მიწოდების თანხა არასწორია.');
  const basketTotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPriceMinor, 0);
  if (!Number.isSafeInteger(basketTotal) || !Number.isSafeInteger(basketTotal + deliveryMinor) || basketTotal + deliveryMinor !== input.totalMinor) throw new BogError('კალათის თანხა არ ემთხვევა შეკვეთის თანხას.');
  validateReturnUrls(input.callbackUrl, input.successUrl, input.failUrl);
  const token = await accessToken();
  const result = record(await requestJson(`${endpoints().api}/ecommerce/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'ka',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      callback_url: input.callbackUrl,
      external_order_id: input.reference,
      capture: 'automatic',
      ttl: 15,
      payment_method: methods,
      purchase_units: {
        currency: 'GEL',
        total_amount: input.totalMinor / 100,
        ...(deliveryMinor > 0 ? {delivery: {amount: deliveryMinor / 100}} : {}),
        basket: input.items.map(item => ({
          product_id: item.productId,
          description: item.name,
          quantity: item.quantity,
          unit_price: item.unitPriceMinor / 100,
          total_price: item.quantity * item.unitPriceMinor / 100,
        })),
      },
      redirect_urls: {success: input.successUrl, fail: input.failUrl},
    }),
  }, true));
  const redirect = record(record(result._links).redirect).href;
  if (!identifier(result.id) || typeof redirect !== 'string' || redirect.length > 2048) {
    throw new BogError('ბანკის შეკვეთის პასუხი არასრულია. სტატუსი გადასამოწმებელია.', true);
  }
  let url: URL;
  try { url = new URL(redirect); }
  catch { throw new BogError('ბანკის გადახდის ბმული არასწორია.', true); }
  if (url.protocol !== 'https:' || url.hostname !== endpoints().checkoutHost || url.port || url.username || url.password || url.hash || url.searchParams.get('order_id') !== result.id) {
    throw new BogError('ბანკის გადახდის ბმული არასწორია.', true);
  }
  return {id: result.id, redirectUrl: url.toString()};
}

export async function getBogOrder(id: string): Promise<NormalizedBogOrder> {
  if (!identifier(id)) throw new BogError('ბანკის შეკვეთის ნომერი არასწორია.');
  const token = await accessToken();
  const result = record(await requestJson(`${endpoints().api}/receipt/${encodeURIComponent(id)}`, {
    headers: {Authorization: `Bearer ${token}`},
  }, false));
  const units = record(result.purchase_units);
  const totalMinor = money(units.request_amount);
  const rawStatus = record(result.order_status).key;
  if (result.order_id !== id || !identifier(result.external_order_id) || totalMinor === null || typeof units.currency_code !== 'string' || !/^[A-Z]{3}$/.test(units.currency_code) || typeof rawStatus !== 'string' || rawStatus.length > 80) {
    throw new BogError('ბანკის შეკვეთის დეტალები არასრულია.');
  }
  let status: NormalizedBogOrder['status'] = 'review';
  if (rawStatus === 'completed') status = 'paid';
  if (rawStatus === 'created' || rawStatus === 'processing') status = 'pending';
  if (rawStatus === 'rejected') status = result.reject_reason === 'expiration' ? 'expired' : 'failed';
  // Refunds/preauthorizations/unknown states require review. They must never
  // silently confirm an unpaid checkout or release its stock a second time.
  const method = record(record(result.payment_detail).transfer_method).key;
  return {
    id, reference: result.external_order_id, currency: units.currency_code,
    totalMinor, status, rawStatus,
    ...(typeof method === 'string' && method.length <= 80 ? {method} : {}),
  };
}

export function verifyBogCallback(rawBody: string, signature: string): boolean {
  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > 256_000 || !signature || signature.length > 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) return false;
  try {
    // Official Callback-Signature is RSA-SHA256 over the unmodified request
    // body. Sandbox and production keys are deliberately separate.
    return verifySignature('RSA-SHA256', Buffer.from(rawBody, 'utf8'), endpoints().publicKey, Buffer.from(signature, 'base64'));
  } catch { return false; }
}

export function extractBogCallbackId(rawBody: string): string {
  // Call only AFTER verifyBogCallback. The callback merely identifies a
  // receipt; reconciliation fetches the authoritative details from the bank.
  if (Buffer.byteLength(rawBody, 'utf8') > 256_000) throw new BogError('ბანკის შეტყობინება არასწორია.');
  let data: Record<string, unknown>;
  try { data = record(JSON.parse(rawBody)); }
  catch { throw new BogError('ბანკის შეტყობინება არასწორია.'); }
  const id = record(data.body).order_id;
  if (data.event !== 'order_payment' || !identifier(id)) throw new BogError('ბანკის შეტყობინება არასწორია.');
  return id;
}
