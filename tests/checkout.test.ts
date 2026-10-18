import {after, afterEach, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient, type Prisma} from '@prisma/client';
import {BogError, type NormalizedBogOrder} from '../lib/bog';
import {CheckoutError, createCheckoutService} from '../lib/checkout';
import type {CheckoutConfig} from '../lib/checkout-config';

// Fail before opening a connection. These destructive fixtures are never
// permitted to use DATABASE_URL, Neon, another host, or another database name.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('TEST_DATABASE_URL must name the disposable local topuria_v7_test database');
const parsedUrl = new URL(testUrl);
if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname) || parsedUrl.pathname !== '/topuria_v7_test') {
  throw new Error('Refusing checkout fixtures against a non-local or non-test database');
}
process.env.DATABASE_URL = testUrl;
const db = new PrismaClient({datasourceUrl: testUrl});
let prepared = false;
let sharedDb: PrismaClient | undefined;

const config: CheckoutConfig = {
  enabled: true, mode: 'sandbox', appUrl: 'https://store.example.test',
  secret: 'local-checkout-validation-secret-not-for-production',
  delivery: 'pickup', methods: ['card', 'apple_pay', 'bnpl', 'bog_loan'],
};
type Gateway = NonNullable<Parameters<typeof createCheckoutService>[2]>;
type BankInput = Parameters<Gateway['createOrder']>[0];

function harness(overrides: Partial<CheckoutConfig> = {}) {
  const receipts = new Map<string, NormalizedBogOrder>();
  const keys = new Map<string, string>();
  const calls: BankInput[] = [];
  const reads: string[] = [];
  let failure: Error | undefined;
  let beforeCreate: ((input: BankInput) => Promise<void>) | undefined;
  const gateway: Gateway = {
    async createOrder(input) {
      calls.push(input);
      await beforeCreate?.(input);
      if (failure instanceof BogError && !failure.ambiguous) throw failure;
      // The fake bank has the same idempotency contract as the real gateway.
      // A lost response can leave a real bank order behind, so record it first.
      let id = keys.get(input.idempotencyKey);
      if (!id) {
        id = 'bank-' + randomUUID();
        keys.set(input.idempotencyKey, id);
        receipts.set(id, {id, reference: input.reference, currency: 'GEL', totalMinor: input.totalMinor, status: 'pending', rawStatus: 'created'});
      }
      if (failure) throw failure;
      return {id, redirectUrl: 'https://payment-sandbox.bog.ge/?order_id=' + id};
    },
    async getOrder(id) {
      reads.push(id);
      const receipt = receipts.get(id);
      assert.ok(receipt, 'Only a previously created local bank fixture can be read');
      return {...receipt};
    },
  };
  return {
    service: createCheckoutService(db, {...config, ...overrides}, gateway), calls, reads, receipts,
    failWith(value?: Error) {failure = value;},
    onCreate(fn: (input: BankInput) => Promise<void>) {beforeCreate = fn;},
    patch(providerId: string, value: Partial<NormalizedBogOrder>) {
      const current = receipts.get(providerId);
      assert.ok(current);
      receipts.set(providerId, {...current, ...value});
    },
    get bankOrders() {return keys.size;},
  };
}

async function product(data: Partial<Prisma.ProductUncheckedCreateInput> = {}) {
  const id = randomUUID();
  return db.product.create({data: {
    name: 'Checkout validation only', slug: 'checkout-' + id, sku: 'CHECKOUT-' + id,
    category: 'checkout-active', price: 120, salePrice: 100, cost: 40, stock: 5, sizes: 'S, M', ...data,
    sizeStock: data.sizeStock ?? JSON.stringify({S:0,M:data.stock??5}),
  }});
}
function input(slug: string, extra: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(), expectedTotalMinor: 10_000,
    items: [{slug, size: 'M', qty: 1}],
    customer: {name: 'Local test customer', phone: '+995 555 123 456', email: 'customer@example.test', address: ''},
    delivery: 'pickup', method: 'card', ...extra,
  };
}
async function stock(id: number) {return (await db.product.findUniqueOrThrow({where: {id}})).stock;}
async function payment(id: string) {return db.payment.findUniqueOrThrow({where: {id}, include: {order: {include: {items: true}}}});}
function status(expected: number) {return (e: unknown) => e instanceof CheckoutError && e.status === expected;}
function restartStatus(expected: number, safeToRestart: boolean) {
  return (error: unknown) => error instanceof CheckoutError && error.status === expected && error.safeToRestart === safeToRestart;
}
async function emptyCheckout() {
  assert.equal(await db.payment.count(), 0);
  assert.equal(await db.order.count(), 0);
  assert.equal(await db.orderItem.count(), 0);
}
async function cleanFixtures() {
  if (!prepared) return;
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
}

before(async () => {
  // Set the cleanup guard only after EVERY prerequisite has passed. A failed
  // prerequisite must leave pre-existing local data untouched, too.
  for (const [name, count] of await Promise.all([
    db.payment.count().then(n => ['payments', n] as const),
    db.order.count().then(n => ['orders', n] as const),
    db.orderItem.count().then(n => ['order items', n] as const),
    db.product.count().then(n => ['products', n] as const),
    db.category.count().then(n => ['categories', n] as const),
    db.adminUser.count().then(n => ['admins', n] as const),
    db.analyticsEvent.count().then(n => ['analytics', n] as const),
  ])) assert.equal(count, 0, `Disposable database must initially have no ${name}`);
  prepared = true;
});
afterEach(cleanFixtures);
after(async () => {
  try {await cleanFixtures();}
  finally {await db.$disconnect(); await sharedDb?.$disconnect();}
});

test('Disabled checkout returns 503 without reserving stock or calling a bank', async () => {
  const p = await product(), bank = harness({enabled: false});
  await assert.rejects(bank.service.startCheckout(input(p.slug)), status(503));
  assert.equal(await stock(p.id), 5); await emptyCheckout();
  assert.equal(bank.calls.length + bank.reads.length, 0);
});

test('Inactive products/categories and invalid sizes or quantities never reserve stock', async () => {
  await db.category.create({data: {name: 'Hidden fixture category', slug: 'checkout-hidden', active: false}});
  const active = await product(), hidden = await product({category: 'checkout-hidden'}), draft = await product({status: 'DRAFT'});
  const bank = harness();
  for (const [payload, expected] of [
    [input(hidden.slug), 409], [input(draft.slug), 409], [input('does-not-exist'), 409],
    [input(active.slug, {items: [{slug: active.slug, size: 'XXXL', qty: 1}]}), 409],
    [input(active.slug, {items: [{slug: active.slug, size: 'M', qty: 0}]}), 400],
    [input(active.slug, {items: [{slug: active.slug, size: 'M', qty: 1.5}]}), 400],
    [input(active.slug, {items: [{slug: active.slug, size: 'M', qty: 11}]}), 400],
  ] as const) await assert.rejects(bank.service.startCheckout(payload), status(expected));
  assert.equal(await stock(active.id), 5); assert.equal(await stock(hidden.id), 5); assert.equal(await stock(draft.id), 5);
  await emptyCheckout(); assert.equal(bank.calls.length, 0);
});

test('Client price manipulation or a stale total cannot create an order', async () => {
  const p = await product(), bank = harness();
  await assert.rejects(bank.service.startCheckout(input(p.slug, {
    expectedTotalMinor: 100, items: [{slug: p.slug, size: 'M', qty: 1, price: 1}],
  })), status(409));
  await emptyCheckout(); assert.equal(await stock(p.id), 5); assert.equal(bank.calls.length, 0);
  const result = await bank.service.startCheckout(input(p.slug, {items: [{slug: p.slug, size: 'M', qty: 1, price: 1}]}));
  assert.equal(result.amountMinor, 10_000);
  assert.equal(bank.calls[0].totalMinor, 10_000);
});

test('Server sale price is snapshotted and stock is reserved before any bank request', async () => {
  const p = await product({stock: 3}), bank = harness();
  bank.onCreate(async request => {
    assert.equal(await stock(p.id), 1, 'The bank must not receive an unreserved order');
    const row = await payment(request.reference);
    assert.equal(row.order.status, 'AWAITING_PAYMENT');
    assert.equal(row.order.total, 200); assert.equal(row.amountMinor, 20_000);
    assert.equal(row.order.items.length, 1);
    assert.equal(row.order.items[0].price, 100); assert.equal(row.order.items[0].cost, 40);
    assert.equal(row.order.items[0].quantity, 2);
  });
  const result = await bank.service.startCheckout(input(p.slug, {
    expectedTotalMinor: 20_000, items: [{slug: p.slug, size: 'S', qty: 1}, {slug: p.slug, size: 'S', qty: 1}],
  }));
  assert.equal(result.status, 'PENDING'); assert.match(result.redirectUrl || '', /^https:\/\/payment-sandbox\.bog\.ge\//);
  assert.equal(result.items[0].priceMinor, 10_000); assert.equal('cost' in result.items[0], false);
  assert.equal(bank.calls[0].items[0].unitPriceMinor, 10_000);
  assert.match(bank.calls[0].callbackUrl, /^https:\/\/store\.example\.test\/api\/payments\/bog\/callback$/);
  assert.equal(bank.calls[0].successUrl, bank.calls[0].failUrl);
  assert.match(bank.calls[0].successUrl, /token=/);
});

test('Replaying a checkout and duplicate paid callbacks cannot duplicate orders or decrement stock again', async () => {
  const p = await product({stock: 3}), bank = harness(), payload = input(p.slug);
  const first = await bank.service.startCheckout(payload);
  const second = await bank.service.startCheckout(payload);
  assert.equal(second.id, first.id); assert.equal(second.orderNo, first.orderNo);
  assert.equal(await stock(p.id), 2); assert.equal(bank.calls.length, 1);
  await assert.rejects(bank.service.startCheckout({...payload, customer: {...payload.customer, name: 'Different customer'}}), restartStatus(409, false));
  const row = await payment(first.id); assert.ok(row.providerOrderId);
  bank.patch(row.providerOrderId, {status: 'paid', rawStatus: 'completed'});
  await Promise.all([bank.service.reconcileProvider(row.providerOrderId), bank.service.reconcileProvider(row.providerOrderId)]);
  const paid = await payment(first.id);
  assert.equal(paid.status, 'PAID'); assert.equal(paid.order.status, 'PAYMENT_TEST'); assert.ok(paid.paidAt);
  assert.equal(await stock(p.id), 2); assert.equal(await db.order.count(), 1); assert.equal(await db.payment.count(), 1);
});

test('Concurrent customers competing for the last unit produce exactly one accepted reservation', async () => {
  const p = await product({stock: 1}), bank = harness();
  const results = await Promise.allSettled([
    bank.service.startCheckout(input(p.slug), 'first-customer'),
    bank.service.startCheckout(input(p.slug), 'second-customer'),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const rejected = results.find(r => r.status === 'rejected');
  assert.ok(rejected && rejected.status === 'rejected' && status(409)(rejected.reason));
  assert.equal(await stock(p.id), 0); assert.equal(await db.order.count(), 1);
  assert.equal(bank.bankOrders, 1);
});

test('Two simultaneous browser submissions with the same key share one order and bank-create lease', async () => {
  const p = await product({stock: 2}), bank = harness(), payload = input(p.slug);
  const [first, second] = await Promise.all([
    bank.service.startCheckout(payload, 'same-customer'),
    bank.service.startCheckout(payload, 'same-customer'),
  ]);
  assert.equal(first.id, second.id); assert.equal(await stock(p.id), 1);
  assert.equal(await db.order.count(), 1); assert.equal(await db.payment.count(), 1);
  assert.equal(bank.calls.length, 1); assert.equal(bank.bankOrders, 1);
});

test('A multi-product stock failure rolls back every earlier reservation atomically', async () => {
  const first = await product({stock: 3}), scarce = await product({stock: 1}), bank = harness();
  await assert.rejects(bank.service.startCheckout(input(first.slug, {
    expectedTotalMinor: 30_000,
    items: [{slug: first.slug, size: 'M', qty: 1}, {slug: scarce.slug, size: 'S', qty: 1}, {slug: scarce.slug, size: 'M', qty: 1}],
  })), restartStatus(409, true));
  assert.equal(await stock(first.id), 3); assert.equal(await stock(scarce.id), 1);
  assert.equal(bank.calls.length, 0); await emptyCheckout();
});

for (const terminal of ['failed', 'expired'] as const) test(`Bank-confirmed ${terminal} restores a reservation exactly once`, async () => {
  const p = await product({stock: 3}), bank = harness();
  const result = await bank.service.startCheckout(input(p.slug));
  const row = await payment(result.id); assert.ok(row.providerOrderId);
  bank.patch(row.providerOrderId, {status: terminal, rawStatus: terminal === 'expired' ? 'rejected' : 'rejected'});
  await Promise.all([bank.service.reconcileProvider(row.providerOrderId), bank.service.reconcileProvider(row.providerOrderId)]);
  await bank.service.reconcilePayment(row.id, true);
  const final = await payment(row.id);
  assert.equal(final.status, terminal.toUpperCase()); assert.equal(final.stockReleased, true);
  assert.equal(final.order.status, 'CANCELLED'); assert.equal(final.paidAt, null);
  assert.equal(await stock(p.id), 3);
});

test('A confirmed paid order is never restocked by later failed, expired or pending receipts', async () => {
  const p = await product(), bank = harness();
  const result = await bank.service.startCheckout(input(p.slug));
  const row = await payment(result.id); assert.ok(row.providerOrderId);
  bank.patch(row.providerOrderId, {status: 'paid', rawStatus: 'completed'});
  const paid = await bank.service.reconcilePayment(row.id, true);
  for (const state of ['failed', 'expired', 'pending'] as const) {
    bank.patch(row.providerOrderId, {status: state, rawStatus: state});
    const next = await bank.service.reconcilePayment(row.id, true);
    assert.equal(next.status, 'PAID'); assert.equal(next.stockReleased, false);
    assert.equal(next.paidAt?.getTime(), paid.paidAt?.getTime()); assert.equal(await stock(p.id), 4);
  }
});

test('Mismatched amount, currency, reference or bank order stays in manual review', async () => {
  for (const mismatch of [{totalMinor: 99}, {currency: 'USD'}, {reference: 'forged-reference'}, {id: 'wrong-bank-order'}]) {
    const p = await product(), bank = harness();
    const result = await bank.service.startCheckout(input(p.slug));
    const row = await payment(result.id); assert.ok(row.providerOrderId);
    const original = {...bank.receipts.get(row.providerOrderId)!};
    bank.patch(row.providerOrderId, {...mismatch, status: 'paid', rawStatus: 'completed'});
    const checked = await bank.service.reconcilePayment(row.id, true);
    assert.equal(checked.status, 'REVIEW'); assert.equal(checked.order.status, 'PAYMENT_REVIEW');
    assert.equal(checked.paidAt, null); assert.equal(checked.stockReleased, false); assert.equal(await stock(p.id), 4);
    // A later valid response cannot silently clear a suspicious payment.
    bank.patch(row.providerOrderId, {...original, status: 'paid', rawStatus: 'completed'});
    assert.equal((await bank.service.reconcilePayment(row.id, true)).status, 'REVIEW');
  }
});

test('Refund or unknown bank state requires review and does not release paid inventory', async () => {
  const p = await product(), bank = harness();
  const result = await bank.service.startCheckout(input(p.slug));
  const row = await payment(result.id); assert.ok(row.providerOrderId);
  bank.patch(row.providerOrderId, {status: 'paid', rawStatus: 'completed'});
  await bank.service.reconcilePayment(row.id, true);
  bank.patch(row.providerOrderId, {status: 'review', rawStatus: 'refunded'});
  const review = await bank.service.reconcilePayment(row.id, true);
  assert.equal(review.status, 'REVIEW'); assert.ok(review.paidAt);
  assert.equal(review.stockReleased, false); assert.equal(await stock(p.id), 4);
});

test('Late paid receipt after stock was released is flagged rather than selling the last unit twice', async () => {
  const p = await product({stock: 1}), bank = harness();
  const result = await bank.service.startCheckout(input(p.slug));
  const row = await payment(result.id); assert.ok(row.providerOrderId);
  bank.patch(row.providerOrderId, {status: 'expired', rawStatus: 'rejected'});
  await bank.service.reconcilePayment(row.id, true);
  assert.equal(await stock(p.id), 1);
  const other = await bank.service.startCheckout(input(p.slug), 'another-customer');
  assert.equal(other.status, 'PENDING'); assert.equal(await stock(p.id), 0);
  bank.patch(row.providerOrderId, {status: 'paid', rawStatus: 'completed'});
  const late = await bank.service.reconcilePayment(row.id, true);
  assert.equal(late.status, 'REVIEW'); assert.equal(late.order.status, 'PAYMENT_REVIEW');
  assert.ok(late.paidAt); assert.equal(late.stockReleased, true); assert.equal(await stock(p.id), 0);
});

test('Ambiguous create keeps its reservation/key and retries cannot create a second bank order', async () => {
  const p = await product(), bank = harness(), payload = input(p.slug);
  bank.failWith(new BogError('Simulated lost bank response', true));
  const uncertain = await bank.service.startCheckout(payload);
  assert.equal(uncertain.status, 'CREATING'); assert.equal(await stock(p.id), 4);
  assert.equal((await bank.service.startCheckout(payload)).id, uncertain.id);
  assert.equal(bank.calls.length, 1, 'Concurrent/browser retries must respect the bank-create lease');
  await db.payment.update({where: {id: uncertain.id}, data: {lastCheckedAt: new Date(Date.now() - 31_000)}});
  bank.failWith();
  const retried = await bank.service.startCheckout(payload);
  assert.equal(retried.id, uncertain.id); assert.equal(retried.status, 'PENDING');
  assert.equal(bank.calls.length, 2); assert.equal(bank.bankOrders, 1);
  assert.equal(bank.calls[0].idempotencyKey, bank.calls[1].idempotencyKey);
  assert.equal(await stock(p.id), 4); assert.equal(await db.order.count(), 1);
});

test('A definite error following an ambiguous attempt cannot incorrectly release the original reservation', async () => {
  const p = await product(), bank = harness(), payload = input(p.slug);
  bank.failWith(new BogError('Lost response', true));
  const result = await bank.service.startCheckout(payload);
  await db.payment.update({where: {id: result.id}, data: {lastCheckedAt: new Date(Date.now() - 31_000)}});
  bank.failWith(new BogError('A later authentication rejection', false));
  const retried = await bank.service.startCheckout(payload);
  assert.equal(retried.status, 'CREATING'); assert.equal(await stock(p.id), 4);
  assert.equal((await payment(result.id)).stockReleased, false);
});

test('An uncertain create past local expiry holds stock for review and can resolve from a verified paid receipt', async () => {
  const p = await product(), bank = harness(), payload = input(p.slug);
  bank.failWith(new BogError('Lost response', true));
  const result = await bank.service.startCheckout(payload);
  await db.payment.update({where: {id: result.id}, data: {expiresAt: new Date(Date.now() - 1000)}});
  assert.equal((await bank.service.startCheckout(payload)).status, 'REVIEW');
  assert.equal(await stock(p.id), 4); assert.equal(bank.calls.length, 1);
  const [providerId] = bank.receipts.keys(); assert.ok(providerId);
  bank.patch(providerId, {status: 'paid', rawStatus: 'completed'});
  const resolved = await bank.service.reconcileProvider(providerId);
  assert.equal(resolved.status, 'PAID'); assert.equal(resolved.order.status, 'PAYMENT_TEST');
  assert.equal(await stock(p.id), 4);
});

test('An expired uncertain create can safely release stock after a verified bank rejection', async () => {
  const p = await product(), bank = harness(), payload = input(p.slug);
  bank.failWith(new BogError('Lost response after creation', true));
  const result = await bank.service.startCheckout(payload);
  await db.payment.update({where: {id: result.id}, data: {expiresAt: new Date(Date.now() - 1000)}});
  assert.equal((await bank.service.startCheckout(payload)).status, 'REVIEW');
  assert.equal((await payment(result.id)).rawStatus, 'CREATE_UNCERTAIN');
  const [providerId] = bank.receipts.keys(); assert.ok(providerId);
  bank.patch(providerId, {status: 'expired', rawStatus: 'rejected'});
  await bank.service.reconcileProvider(providerId);
  const released = await bank.service.reconcileProvider(providerId);
  assert.equal(released.status, 'EXPIRED'); assert.equal(released.order.status, 'CANCELLED');
  assert.equal(released.stockReleased, true); assert.equal(await stock(p.id), 5);
});

test('A local timeout cannot release stock while the authoritative bank still reports pending', async () => {
  const p = await product(), bank = harness();
  const result = await bank.service.startCheckout(input(p.slug));
  await db.payment.update({where: {id: result.id}, data: {expiresAt: new Date(Date.now() - 1000)}});
  const checked = await bank.service.reconcilePayment(result.id, true);
  assert.equal(checked.status, 'PENDING'); assert.equal(checked.stockReleased, false);
  assert.equal(checked.order.status, 'AWAITING_PAYMENT'); assert.equal(await stock(p.id), 4);
});

test('Scheduled reconciliation confirms paid, releases failed and preserves pending reservations', async () => {
  const p = await product(), bank = harness();
  const rows = [];
  for (const state of ['paid', 'failed', 'pending'] as const) {
    const result = await bank.service.startCheckout(input(p.slug));
    const row = await payment(result.id); assert.ok(row.providerOrderId);
    bank.patch(row.providerOrderId, {status: state, rawStatus: state});
    await db.payment.update({where: {id: row.id}, data: {lastCheckedAt: new Date(Date.now() - 61_000), expiresAt: new Date(Date.now() - 1000)}});
    rows.push(row);
  }
  assert.deepEqual(await bank.service.reconcileDue(), {checked: 3, errors: 0});
  assert.equal((await payment(rows[0].id)).status, 'PAID');
  assert.equal((await payment(rows[1].id)).status, 'FAILED');
  assert.equal((await payment(rows[2].id)).status, 'PENDING');
  assert.equal(await stock(p.id), 3);
  assert.deepEqual(await bank.service.reconcileDue(), {checked: 0, errors: 0});
});

test('A bank outage leaves the last verified state and inventory intact for an authenticated customer', async () => {
  const p = await product(), bank = harness();
  const result = await bank.service.startCheckout(input(p.slug));
  const row = await payment(result.id); assert.ok(row.providerOrderId);
  bank.receipts.delete(row.providerOrderId);
  await db.payment.update({where: {id: row.id}, data: {lastCheckedAt: new Date(Date.now() - 61_000)}});
  const visible = await bank.service.getCheckout(row.id, result.token);
  assert.equal(visible.status, 'PENDING'); assert.equal(await stock(p.id), 4);
  await db.payment.update({where: {id: row.id}, data: {lastCheckedAt: new Date(Date.now() - 61_000)}});
  assert.deepEqual(await bank.service.reconcileDue(), {checked: 0, errors: 1});
  assert.equal((await payment(row.id)).stockReleased, false); assert.equal(await stock(p.id), 4);
});

test('A definite first bank-create rejection releases stock and never exposes a redirect', async () => {
  const p = await product(), bank = harness();
  bank.failWith(new BogError('Simulated request rejected before bank order creation', false));
  const result = await bank.service.startCheckout(input(p.slug));
  assert.equal(result.status, 'FAILED'); assert.equal('redirectUrl' in result, false);
  assert.equal((await payment(result.id)).stockReleased, true); assert.equal(await stock(p.id), 5);
  assert.equal(bank.bankOrders, 0);
});

test('Missing, wrong or invalid checkout tokens return 404 without bank requests', async () => {
  const p = await product(), bank = harness();
  const result = await bank.service.startCheckout(input(p.slug));
  const reads = bank.reads.length;
  for (const supplied of ['', 'bad', 'a'.repeat(43), result.token.slice(0, -1) + (result.token.endsWith('x') ? 'y' : 'x')]) {
    await assert.rejects(bank.service.getCheckout(result.id, supplied), status(404));
  }
  await assert.rejects(bank.service.getCheckout('../' + result.id, result.token), status(404));
  assert.equal(bank.reads.length, reads);
  const valid = await bank.service.getCheckout(result.id, result.token);
  assert.equal(valid.id, result.id); assert.equal(valid.orderNo, result.orderNo);
});

test('Checkout rate limiting is database-backed and does not reserve an extra unit', async () => {
  const p = await product({stock: 20}), bank = harness();
  for (let n = 0; n < 6; n++) await bank.service.startCheckout(input(p.slug), 'same-local-client');
  await assert.rejects(bank.service.startCheckout(input(p.slug), 'same-local-client'), status(429));
  assert.equal(await stock(p.id), 14); assert.equal(await db.payment.count(), 6); assert.equal(bank.calls.length, 6);
});

test('Configured installment and Apple Pay selections are sent to bank; disabled methods cannot reserve', async () => {
  const p = await product(), bank = harness();
  for (const [method, expected] of [['apple_pay', ['apple_pay']], ['bnpl', ['card', 'bnpl']], ['bog_loan', ['card', 'bog_loan']]] as const) {
    await bank.service.startCheckout(input(p.slug, {method}));
    assert.deepEqual(bank.calls.at(-1)?.methods, [...expected]);
  }
  const disabled = harness({methods: ['card']});
  await assert.rejects(disabled.service.startCheckout(input(p.slug, {method: 'bnpl'})), status(400));
  assert.equal(await stock(p.id), 2); assert.equal(disabled.calls.length, 0);
});

test('Sandbox paid orders remain PAYMENT_TEST and do not contribute to real analytics', async () => {
  const p = await product(), bank = harness();
  const result = await bank.service.startCheckout(input(p.slug));
  const row = await payment(result.id); assert.ok(row.providerOrderId);
  bank.patch(row.providerOrderId, {status: 'paid', rawStatus: 'completed'});
  await bank.service.reconcilePayment(row.id, true);
  const singleton = await import('../lib/db'); sharedDb = singleton.db;
  const {getMetrics} = await import('../lib/metrics');
  const metrics = await getMetrics(7);
  assert.equal(metrics.validOrders, 0); assert.equal(metrics.revenue, 0); assert.equal(metrics.profit, 0);
  assert.equal(metrics.daily.reduce((sum, day) => sum + day.orders, 0), 0);
  assert.equal(metrics.topProducts.length, 0);
});

test('Admin payment summaries omit private hashes/idempotency keys and cannot manufacture paid status', async () => {
  const singleton = await import('../lib/db'); sharedDb = singleton.db;
  const {getOrderPayments, updateAdminOrder, AdminOrderConflictError} = await import('../lib/admin-payments');
  const p = await product(), bank = harness();
  const result = await bank.service.startCheckout(input(p.slug));
  const row = await payment(result.id); assert.ok(row.providerOrderId);
  const summary = (await getOrderPayments([row.orderId])).get(row.orderId); assert.ok(summary);
  for (const privateField of ['payloadHash', 'clientHash', 'idempotencyKey', 'token', 'redirectUrl', 'orderId']) {
    assert.equal(privateField in summary, false, privateField + ' must not reach an admin browser');
  }
  assert.equal(summary.amountMinor, 10_000); assert.equal(summary.status, 'PENDING');
  await assert.rejects(updateAdminOrder(row.orderId, {status: 'CONFIRMED'}), AdminOrderConflictError);
  await assert.rejects(updateAdminOrder(row.orderId, {status: 'CANCELLED'}), AdminOrderConflictError);
  const contact = await updateAdminOrder(row.orderId, {customerName: 'Updated local customer'});
  assert.equal(contact.customerName, 'Updated local customer'); assert.equal(contact.status, 'AWAITING_PAYMENT');
  bank.patch(row.providerOrderId, {status: 'paid', rawStatus: 'completed'});
  await bank.service.reconcilePayment(row.id, true);
  await assert.rejects(updateAdminOrder(row.orderId, {status: 'DELIVERED'}), AdminOrderConflictError);
  assert.equal(await stock(p.id), 4);
});

test('Production verified payment allows fulfillment while legacy order edits remain compatible', async () => {
  const singleton = await import('../lib/db'); sharedDb = singleton.db;
  const {updateAdminOrder, AdminOrderConflictError} = await import('../lib/admin-payments');
  const p = await product(), bank = harness({mode: 'production'});
  const result = await bank.service.startCheckout(input(p.slug));
  const row = await payment(result.id); assert.ok(row.providerOrderId);
  bank.patch(row.providerOrderId, {status: 'paid', rawStatus: 'completed'});
  const paid = await bank.service.reconcilePayment(row.id, true);
  assert.equal(paid.order.status, 'CONFIRMED');
  assert.equal((await updateAdminOrder(row.orderId, {status: 'DELIVERED'})).status, 'DELIVERED');
  await assert.rejects(updateAdminOrder(row.orderId, {status: 'CANCELLED'}), AdminOrderConflictError);
  await assert.rejects(updateAdminOrder(row.orderId, {status: 'PAYMENT_TEST'}), AdminOrderConflictError);
  const legacy = await db.order.create({data: {orderNo: 'LEGACY-' + randomUUID(), customerName: 'Legacy local fixture', phone: 'test', total: 100}});
  assert.equal((await updateAdminOrder(legacy.id, {status: 'CANCELLED'})).status, 'CANCELLED');
  assert.equal(await stock(p.id), 4);
});

test('Per-size checkout cannot oversell a size even when product total is sufficient', async () => {
  const p=await product({stock:4,sizeStock:JSON.stringify({S:3,M:1})}),bank=harness();
  await assert.rejects(bank.service.startCheckout(input(p.slug,{items:[{slug:p.slug,size:'M',qty:2}],expectedTotalMinor:20000})),status(409));
  assert.equal(await stock(p.id),4);
  await bank.service.startCheckout(input(p.slug));
  const current=await db.product.findUniqueOrThrow({where:{id:p.id}});
  assert.equal(current.stock,3);
  assert.deepEqual(JSON.parse(current.sizeStock||'{}'),{S:3,M:0});
  await assert.rejects(bank.service.startCheckout(input(p.slug)),status(409));
});
