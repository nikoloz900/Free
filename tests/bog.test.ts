import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createBogOrder, getBogOrder, verifyBogCallback, extractBogCallbackId, BogError} from '../lib/bog';

// No database, bank network request, real credentials or real charge is used.
const initialEnvironment = Object.fromEntries(['BOG_CLIENT_ID', 'BOG_CLIENT_SECRET', 'BOG_ENVIRONMENT', 'APP_URL'].map(key => [key, process.env[key]]));
beforeEach(() => {
  process.env.BOG_CLIENT_ID = 'adapter-test-id';
  process.env.BOG_CLIENT_SECRET = 'adapter-test-secret';
  process.env.BOG_ENVIRONMENT = 'sandbox';
  process.env.APP_URL = 'https://shop.example.test';
});
afterEach(() => {
  for (const [key, value] of Object.entries(initialEnvironment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
const id = '97cc9a52-b2c1-4ab6-b191-1ccba19e61a5';
const input = () => ({
  reference: 'TP-test-order',
  idempotencyKey: '7af9ed98-a7cd-4ab2-b8c1-c6e85d0f47d4',
  totalMinor: 12345,
  items: [{productId: '123', name: 'Test garment', quantity: 1, unitPriceMinor: 12345}],
  callbackUrl: 'https://shop.example.test/api/payments/bog/callback',
  successUrl: 'https://shop.example.test/checkout/result?token=test-token',
  failUrl: 'https://shop.example.test/checkout/result?token=test-token',
  methods: ['card', 'apple_pay', 'bnpl'] as ('card' | 'apple_pay' | 'bnpl')[],
});
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status});
const auth = () => json({access_token: 'mock-access-token', token_type: 'Bearer', expires_in: 300});
const receipt = (status = 'completed') => ({
  order_id: id, external_order_id: input().reference,
  order_status: {key: status},
  purchase_units: {request_amount: '123.45', transfer_amount: '123.45', currency_code: 'GEL'},
  payment_detail: {transfer_method: {key: 'card'}},
});

test('Sandbox create sends exact tetri conversion, stable idempotency and fixed official bank endpoints', async t => {
  const calls: {url: string; init?: RequestInit}[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push({url: String(url), init});
    return calls.length === 1 ? auth() : json({id, _links: {redirect: {href: `https://payment-sandbox.bog.ge/?order_id=${id}`}}});
  });
  const result = await createBogOrder(input());
  assert.equal(result.id, id);
  assert.equal(calls[0].url, 'https://oauth2-sandbox.bog.ge/auth/realms/bog/protocol/openid-connect/token');
  assert.equal(calls[0].init?.body, 'grant_type=client_credentials');
  assert.equal(calls[1].url, 'https://api-sandbox.bog.ge/payments/v1/ecommerce/orders');
  const headers = new Headers(calls[1].init?.headers);
  assert.equal(headers.get('Idempotency-Key'), input().idempotencyKey);
  assert.equal(headers.get('Authorization'), 'Bearer mock-access-token');
  assert.equal(calls[1].init?.cache, 'no-store');
  assert.equal(calls[1].init?.redirect, 'error');
  const body = JSON.parse(String(calls[1].init?.body));
  assert.equal(body.purchase_units.total_amount, 123.45);
  assert.equal(body.purchase_units.basket[0].unit_price, 123.45);
  assert.equal(body.capture, 'automatic');
  assert.equal(body.ttl, 15);
  assert.deepEqual(body.payment_method, ['card', 'apple_pay', 'bnpl']);
});

test('Missing credentials, unsafe callback origins, unbalanced prices and loan-only bypass fail before network', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network'); });
  delete process.env.BOG_CLIENT_SECRET;
  await assert.rejects(createBogOrder(input()), error => error instanceof BogError && !error.ambiguous);
  process.env.BOG_CLIENT_SECRET = 'adapter-test-secret';
  await assert.rejects(createBogOrder({...input(), callbackUrl: 'https://attacker.example/callback'}));
  await assert.rejects(createBogOrder({...input(), totalMinor: 100}));
  await assert.rejects(createBogOrder({...input(), methods: ['bnpl']}));
  await assert.rejects(createBogOrder({...input(), idempotencyKey: 'not-a-uuid'}));
  assert.equal(fetch.mock.callCount(), 0);
});

test('Delivery fee is distinct from the goods basket and included in the exact gross amount', async t => {
  let body: {purchase_units?: {total_amount: number; delivery?: {amount: number}; basket: {total_price: number}[]}} = {};
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('openid-connect')) return auth();
    body = JSON.parse(String(init?.body));
    return json({id, _links: {redirect: {href: `https://payment-sandbox.bog.ge/?order_id=${id}`}}});
  });
  await createBogOrder({...input(), totalMinor: 13595, deliveryMinor: 1250});
  assert.equal(body.purchase_units?.total_amount, 135.95);
  assert.deepEqual(body.purchase_units?.delivery, {amount: 12.5});
  assert.equal(body.purchase_units?.basket.length, 1);
  assert.equal(body.purchase_units?.basket[0].total_price, 123.45);
});

test('Negative, fractional or unbalanced delivery fees fail before any bank request', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network'); });
  for (const deliveryMinor of [-1, 1.5, NaN, Infinity]) {
    await assert.rejects(createBogOrder({...input(), deliveryMinor}));
  }
  await assert.rejects(createBogOrder({...input(), deliveryMinor: 1250, totalMinor: 12345}));
  assert.equal(fetch.mock.callCount(), 0);
});

test('Production selects only production OAuth, API and hosted redirect', async t => {
  process.env.BOG_ENVIRONMENT = 'production';
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(String(url));
    return urls.length === 1 ? auth() : json({id, _links: {redirect: {href: `https://payment.bog.ge/?order_id=${id}`}}});
  });
  assert.equal((await createBogOrder(input())).redirectUrl, `https://payment.bog.ge/?order_id=${id}`);
  assert.ok(urls.every(url => !url.includes('sandbox')));
});

test('A forged bank redirect cannot send a customer to another host or a different order', async t => {
  let redirect = `https://payment.bog.ge.attacker.example/?order_id=${id}`;
  t.mock.method(globalThis, 'fetch', async (url: string) => String(url).includes('openid-connect') ? auth() : json({id, _links: {redirect: {href: redirect}}}));
  await assert.rejects(createBogOrder(input()), error => error instanceof BogError && error.ambiguous);
  redirect = 'https://payment-sandbox.bog.ge/?order_id=different';
  await assert.rejects(createBogOrder(input()), error => error instanceof BogError && error.ambiguous);
});

test('Create timeout/5xx remains ambiguous while definite rejection can release a reservation', async t => {
  let response: 'network' | number = 'network';
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    if (String(url).includes('openid-connect')) return auth();
    if (response === 'network') throw new Error('Simulated connection loss');
    return json({message: 'Not surfaced'}, response);
  });
  for (const value of ['network', 500, 409, 429] as const) {
    response = value;
    await assert.rejects(createBogOrder(input()), error => error instanceof BogError && error.ambiguous);
  }
  response = 422;
  await assert.rejects(createBogOrder(input()), error => error instanceof BogError && !error.ambiguous);
});

test('Receipt confirms completed and parses money without trusting a browser return parameter', async t => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    calls.push(String(url));
    return String(url).includes('openid-connect') ? auth() : json(receipt());
  });
  assert.deepEqual(await getBogOrder(id), {id, reference: 'TP-test-order', currency: 'GEL', totalMinor: 12345, status: 'paid', rawStatus: 'completed', method: 'card'});
  assert.equal(calls[1], `https://api-sandbox.bog.ge/payments/v1/receipt/${id}`);
});

test('Expired, pending, failed, refunded and unknown receipts stay distinct', async t => {
  let body: object = receipt();
  t.mock.method(globalThis, 'fetch', async (url: string) => String(url).includes('openid-connect') ? auth() : json(body));
  for (const [raw, expected] of [
    ['created', 'pending'], ['processing', 'pending'], ['rejected', 'failed'],
    ['refunded', 'review'], ['refunded_partially', 'review'], ['blocked', 'review'], ['future-status', 'review'],
  ] as const) {
    body = receipt(raw);
    assert.equal((await getBogOrder(id)).status, expected);
  }
  body = {...receipt('rejected'), reject_reason: 'expiration'};
  assert.equal((await getBogOrder(id)).status, 'expired');
});

test('Mismatched identifiers and invalid bank amounts cannot confirm payment', async t => {
  let body: object = receipt();
  t.mock.method(globalThis, 'fetch', async (url: string) => String(url).includes('openid-connect') ? auth() : json(body));
  body = {...receipt(), order_id: 'different'};
  await assert.rejects(getBogOrder(id));
  for (const value of ['0', '-1', 'NaN', '123.456', '1e2', '9007199254740993']) {
    body = {...receipt(), purchase_units: {request_amount: value, currency_code: 'GEL'}};
    await assert.rejects(getBogOrder(id));
  }
});

test('Callback verification rejects missing, forged and oversized signatures/body without any network', () => {
  const body = JSON.stringify({event: 'order_payment', body: {order_id: id}});
  for (const environment of ['sandbox', 'production']) {
    process.env.BOG_ENVIRONMENT = environment;
    assert.equal(verifyBogCallback(body, ''), false);
    assert.equal(verifyBogCallback(body, Buffer.alloc(256).toString('base64')), false);
    assert.equal(verifyBogCallback('x'.repeat(256_001), 'AAAA'), false);
    assert.equal(verifyBogCallback(body, 'invalid!'), false);
  }
});

test('Callback extracts only bounded order identifiers from the documented envelope', () => {
  assert.equal(extractBogCallbackId(JSON.stringify({event: 'order_payment', body: {order_id: id}})), id);
  assert.throws(() => extractBogCallbackId(JSON.stringify({event: 'unknown', body: {order_id: id}})));
  assert.throws(() => extractBogCallbackId(JSON.stringify({event: 'order_payment', body: {order_id: '../admin'}})));
  assert.throws(() => extractBogCallbackId('not json'));
});
