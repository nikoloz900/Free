import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {Prisma, PrismaClient} from '@prisma/client';
import {parseSizeStock} from './size-stock';
import {notifyPaidOrder} from './telegram-orders';
import {BogError, createBogOrder, getBogOrder, type NormalizedBogOrder} from './bog';
import {type CheckoutConfig, type CheckoutMethod} from './checkout-config';

type Gateway = {createOrder: typeof createBogOrder; getOrder: typeof getBogOrder};
type Input = {
  idempotencyKey: string; expectedTotalMinor: number;
  items: {slug: string; size: string; qty: number}[];
  customer: {name: string; phone: string; email: string; address: string};
  delivery: 'pickup' | 'delivery'; method: CheckoutMethod;
};
const includeOrder = {order: {include: {items: {include: {product: {select: {slug: true}}}}}}} satisfies Prisma.PaymentInclude;
type RecordWithOrder = Prisma.PaymentGetPayload<{include: typeof includeOrder}>;
const pending = ['CREATING', 'PENDING'];

export class CheckoutError extends Error {
  constructor(message: string, readonly status = 400, readonly safeToRestart = false) {super(message); this.name = 'CheckoutError';}
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown, max: number, required = false) {
  if ((value === undefined || value === null || value === '') && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new CheckoutError('შეამოწმეთ შეკვეთის მონაცემები.');
  return value.trim();
}
function parseInput(value: unknown, config: CheckoutConfig, replay = false): Input {
  const x = record(value), customer = record(x.customer);
  if (typeof x.idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x.idempotencyKey)) throw new CheckoutError('განაახლეთ გადახდის გვერდი.');
  if (!Array.isArray(x.items) || !x.items.length || x.items.length > 20) throw new CheckoutError('კალათაში უნდა იყოს 1–20 პროდუქტი.');
  const lines = new Map<string, Input['items'][number]>();
  for (const value of x.items) {
    const row = record(value), slug = text(row.slug, 200, true), size = text(row.size, 80);
    if (!Number.isInteger(row.qty) || Number(row.qty) < 1 || Number(row.qty) > 10) throw new CheckoutError('შეამოწმეთ პროდუქტის რაოდენობა.');
    const key = JSON.stringify([slug, size]);
    const quantity = (lines.get(key)?.qty || 0) + Number(row.qty);
    if (quantity > 10) throw new CheckoutError('ერთ მოდელზე მაქსიმუმ 10 ერთეულის შეკვეთაა შესაძლებელი.');
    lines.set(key, {slug, size, qty: quantity});
  }
  const name = text(customer.name, 100, true), phone = text(customer.phone, 40, true).replace(/[\s()\-]/g, '');
  const email = text(customer.email, 254).toLowerCase();
  if (name.length < 2 || !/^\+?\d{7,15}$/.test(phone)) throw new CheckoutError('შეიყვანეთ სახელი და სწორი ტელეფონის ნომერი.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckoutError('შეიყვანეთ სწორი ელფოსტა.');
  if (x.delivery !== 'pickup' && x.delivery !== 'delivery') throw new CheckoutError('აირჩიეთ მიღების მეთოდი.');
  if (!replay && x.delivery === 'delivery' && config.delivery !== 'free' && config.delivery !== 'courier') throw new CheckoutError('ამ ეტაპზე ხელმისაწვდომია ადგილზე გატანა.');
  const address = x.delivery === 'delivery' ? text(customer.address, 1000, true) : '';
  if (x.delivery === 'delivery' && config.delivery === 'courier' && !/^თბილისი(?:\s|,|$)/iu.test(address)) throw new CheckoutError('კურიერით მიწოდება ამ ეტაპზე მხოლოდ თბილისშია ხელმისაწვდომი. მისამართი დაიწყეთ სიტყვით „თბილისი“.');
  if (x.delivery === 'delivery' && address.length < 10) throw new CheckoutError('შეიყვანეთ სრული მიწოდების მისამართი.');
  if (!config.methods.includes(x.method as CheckoutMethod)) throw new CheckoutError('გადახდის ეს მეთოდი ჯერ არ არის გააქტიურებული.');
  if (!Number.isSafeInteger(x.expectedTotalMinor) || Number(x.expectedTotalMinor) <= 0 || Number(x.expectedTotalMinor) > 100_000_000) throw new CheckoutError('შეკვეთის თანხა არასწორია.');
  return {
    idempotencyKey: x.idempotencyKey.toLowerCase(), expectedTotalMinor: Number(x.expectedTotalMinor),
    items: [...lines.values()].sort((a, b) => a.slug.localeCompare(b.slug) || a.size.localeCompare(b.size)),
    customer: {name, phone, email, address}, delivery: x.delivery, method: x.method as CheckoutMethod,
  };
}

// Dependency injection is restricted to the service constructor in server code.
// HTTP routes always use the official bank gateway; there is no public mock mode.
export function createCheckoutService(db: PrismaClient, config: CheckoutConfig, gateway: Gateway = {createOrder: createBogOrder, getOrder: getBogOrder}) {
  function requireEnabled() {
    if (!config.enabled) throw new CheckoutError('ონლაინ გადახდა ჯერ არ არის გააქტიურებული.', 503);
  }
  function token(id: string) {return createHmac('sha256', config.secret).update('topuria-checkout:' + id).digest('base64url');}
  function verifyToken(id: string, supplied: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !/^[a-zA-Z0-9_-]{43}$/.test(supplied)) throw new CheckoutError('შეკვეთა ვერ მოიძებნა.', 404);
    const expected = Buffer.from(token(id)), actual = Buffer.from(supplied);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new CheckoutError('შეკვეთა ვერ მოიძებნა.', 404);
  }
  async function transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {return await db.$transaction(fn, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000});}
      catch (e) {
        const retry = e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2034' || (e.code === 'P2010' && ['40001', '40P01'].includes(String(e.meta?.code))));
        if (!retry || attempt >= 4) throw e;
      }
    }
  }
  async function load(id: string) {
    const payment = await db.payment.findUnique({where: {id}, include: includeOrder});
    if (!payment) throw new CheckoutError('შეკვეთა ვერ მოიძებნა.', 404);
    if (payment.environment !== config.mode) throw new CheckoutError('შეკვეთა გადახდის სხვა გარემოს ეკუთვნის. მიმართეთ მაღაზიას.', 409);
    return payment;
  }
  function view(payment: RecordWithOrder) {
    return {
      id: payment.id, token: token(payment.id), orderNo: payment.order.orderNo,
      status: payment.status, amountMinor: payment.amountMinor, currency: payment.currency,
      mode: payment.environment, expiresAt: payment.expiresAt.toISOString(),
      ...(payment.status === 'PENDING' && payment.redirectUrl ? {redirectUrl: payment.redirectUrl} : {}),
      items: payment.order.items.map(i => ({slug: i.product.slug, name: i.name, priceMinor: i.price * 100, qty: i.quantity, size: i.size || ''})),
      ...(payment.status === 'CREATING' ? {message: 'ბანკის პასუხი ჯერ დასაზუსტებელია. იგივე მოთხოვნა უსაფრთხოდ შეგიძლიათ გაიმეოროთ.'} : {}),
      ...(payment.status === 'REVIEW' ? {message: 'გადახდას დამატებითი გადამოწმება სჭირდება. ხელახლა ნუ გადაიხდით — მიმართეთ მაღაზიას და მიუთითეთ შეკვეთის ნომერი.'} : {}),
    };
  }
  async function locked(tx: Prisma.TransactionClient, id: string) {
    // Shared lock order with admin edits: Payment first, then Order/Product.
    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.payment.findUnique({where: {id}, include: includeOrder});
    if (!row) throw new CheckoutError('შეკვეთა ვერ მოიძებნა.', 404);
    return row;
  }
  async function release(tx: Prisma.TransactionClient, row: RecordWithOrder, status: 'FAILED' | 'EXPIRED', rawStatus: string) {
    if (row.paidAt || row.status === 'PAID' || (row.status === 'REVIEW' && row.rawStatus !== 'CREATE_UNCERTAIN')) return;
    if (!row.stockReleased) {
      const grouped = new Map<number, {quantity:number; sizes:Map<string,number>}>();
      for (const i of row.order.items) {
        const g=grouped.get(i.productId)||{quantity:0,sizes:new Map<string,number>()};
        g.quantity+=i.quantity;
        if(i.size)g.sizes.set(i.size,(g.sizes.get(i.size)||0)+i.quantity);
        grouped.set(i.productId,g);
      }
      for (const [id, g] of [...grouped].sort((a,b)=>a[0]-b[0])) {
        await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id"=${id} FOR UPDATE`;
        const p=await tx.product.findUniqueOrThrow({where:{id}});
        const sizes=parseSizeStock(p.sizeStock);
        if (sizes && g.sizes.size) for (const [size,qty] of g.sizes) sizes[size]=(sizes[size]||0)+qty;
        await tx.product.update({where:{id},data:{stock:{increment:g.quantity},...(sizes?{sizeStock:JSON.stringify(sizes)}:{})}});
      }
    }
    await tx.payment.update({where: {id: row.id}, data: {status, stockReleased: true, rawStatus, lastCheckedAt: new Date()}});
    await tx.order.update({where: {id: row.orderId}, data: {status: 'CANCELLED'}});
  }
  async function applyReceipt(id: string, receipt: NormalizedBogOrder) {
    await transaction(async tx => {
      const row = await locked(tx, id);
      const matches = receipt.reference === row.id && receipt.currency === row.currency && receipt.totalMinor === row.amountMinor && (!row.providerOrderId || receipt.id === row.providerOrderId);
      if (!matches || receipt.status === 'review') {
        await tx.payment.update({where: {id}, data: {status: 'REVIEW', rawStatus: matches ? receipt.rawStatus : 'RECEIPT_MISMATCH', lastCheckedAt: new Date()}});
        await tx.order.update({where: {id: row.orderId}, data: {status: 'PAYMENT_REVIEW'}});
        return;
      }
      if (!row.providerOrderId) await tx.payment.update({where: {id}, data: {providerOrderId: receipt.id}});
      if (receipt.status === 'paid') {
        // A late charge after a released reservation needs a refund/review;
        // never silently sell the same last item twice.
        if (row.stockReleased || (row.status === 'REVIEW' && row.rawStatus !== 'CREATE_UNCERTAIN')) {
          await tx.payment.update({where: {id}, data: {status: 'REVIEW', paidAt: row.paidAt || new Date(), rawStatus: row.status === 'REVIEW' ? row.rawStatus : 'LATE_PAYMENT', lastCheckedAt: new Date()}});
          await tx.order.update({where: {id: row.orderId}, data: {status: 'PAYMENT_REVIEW'}});
        } else if (row.status !== 'PAID') {
          await tx.payment.update({where: {id}, data: {status: 'PAID', paidAt: new Date(), rawStatus: receipt.rawStatus, lastCheckedAt: new Date()}});
          await tx.order.update({where: {id: row.orderId}, data: {status: config.mode === 'production' ? 'CONFIRMED' : 'PAYMENT_TEST'}});
        }
      } else if (receipt.status === 'failed' || receipt.status === 'expired') {
        await release(tx, row, receipt.status === 'expired' ? 'EXPIRED' : 'FAILED', receipt.rawStatus);
      } else if (pending.includes(row.status)) {
        await tx.payment.update({where: {id}, data: {status: 'PENDING', rawStatus: receipt.rawStatus, lastCheckedAt: new Date()}});
      }
    });
    const updated = await load(id);
    if (updated.status === 'PAID') await notifyPaidOrder(id).catch(() => {});
    return updated;
  }
  async function createProvider(id: string) {
    const row = await load(id);
    if (row.status !== 'CREATING') return row;
    if (row.expiresAt <= new Date()) {
      // A lost create response cannot prove the bank has no live order.
      // Keep stock held for manual investigation, even if our local TTL passed.
      await transaction(async tx => {
        const current = await locked(tx, id);
        if (current.status !== 'CREATING') return;
        await tx.payment.update({where: {id}, data: {status: 'REVIEW', rawStatus: 'CREATE_UNCERTAIN'}});
        await tx.order.update({where: {id: current.orderId}, data: {status: 'PAYMENT_REVIEW'}});
      });
      return load(id);
    }
    // A database lease prevents two browser tabs/instances from creating the
    // same bank request concurrently. All retries retain the original key.
    const claim = await db.payment.updateMany({where: {id, status: 'CREATING', OR: [{lastCheckedAt: null}, {lastCheckedAt: {lt: new Date(Date.now() - 30_000)}}]}, data: {createAttempts: {increment: 1}, lastCheckedAt: new Date()}});
    if (!claim.count) return load(id);
    const returnUrl = `${config.appUrl}/checkout/return?reference=${encodeURIComponent(id)}&token=${encodeURIComponent(token(id))}`;
    try {
      const result = await gateway.createOrder({
        reference: id, idempotencyKey: row.idempotencyKey, totalMinor: row.amountMinor,
        items: row.order.items.map(i => ({productId: String(i.productId), name: i.name, quantity: i.quantity, unitPriceMinor: i.price * 100})),
        callbackUrl: `${config.appUrl}/api/payments/bog/callback`, successUrl: returnUrl, failUrl: returnUrl,
        methods: row.method === 'bnpl' || row.method === 'bog_loan' ? ['card', row.method] : [row.method as CheckoutMethod],
      });
      await transaction(async tx => {
        const current = await locked(tx, id);
        if (current.providerOrderId && current.providerOrderId !== result.id) {
          await tx.payment.update({where: {id}, data: {status: 'REVIEW', rawStatus: 'PROVIDER_ID_MISMATCH'}});
          await tx.order.update({where: {id: current.orderId}, data: {status: 'PAYMENT_REVIEW'}});
        } else {
          await tx.payment.update({where: {id}, data: {providerOrderId: result.id, redirectUrl: result.redirectUrl, ...(current.status === 'CREATING' ? {status: 'PENDING'} : {})}});
        }
      });
    } catch (e) {
      if (e instanceof BogError && !e.ambiguous) await transaction(async tx => {const current = await locked(tx, id); if (!current.providerOrderId && current.status === 'CREATING' && current.createAttempts === 1) await release(tx, current, 'FAILED', 'CREATE_REJECTED');});
      // Unknown/network errors retain stock and the same idempotency key.
    }
    return load(id);
  }
  async function startCheckout(value: unknown, clientAddress = 'unknown') {
    requireEnabled();
    const key = record(value).idempotencyKey;
    let row = typeof key === 'string' && /^[0-9a-f-]{36}$/i.test(key) ? await db.payment.findUnique({where: {idempotencyKey: key.toLowerCase()}, include: includeOrder}) : null;
    let input: Input;
    try {
      // A merchant disabling a method must not strand an already-created bank
      // order or turn an ambiguous retry into a second payment attempt.
      input = parseInput(value, row ? {...config, methods: [...new Set([...config.methods, row.method as CheckoutMethod])]} : config, !!row);
    } catch (error) {
      if (error instanceof CheckoutError) throw new CheckoutError(error.message, error.status, !row);
      throw error;
    }
    const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const clientHash = createHmac('sha256', config.secret).update('checkout-client:' + clientAddress.slice(0, 200)).digest('hex');
    if (!row) {
      try {
        row = await transaction(async tx => {
          const recent = await tx.payment.count({where: {clientHash, createdAt: {gte: new Date(Date.now() - 15 * 60_000)}}});
          if (recent >= 6) throw new CheckoutError('ძალიან ბევრი მცდელობაა. სცადეთ 15 წუთში.', 429);
          const products = await tx.product.findMany({where: {slug: {in: input.items.map(i => i.slug)}}});
          const categories = await tx.category.findMany({where: {slug: {in: products.map(p => p.category)}, active: false}, select: {slug: true}});
          const hidden = new Set(categories.map(c => c.slug));
          const demand = new Map<number, number>();
          const sizeDemand = new Map<number, Map<string,number>>();
          const items = input.items.map(i => {
            const p = products.find(p => p.slug === i.slug);
            if (!p || p.status !== 'ACTIVE' || hidden.has(p.category)) throw new CheckoutError('პროდუქტი აღარ არის ხელმისაწვდომი. განაახლეთ კალათა.', 409);
            const sizes = p.sizes.split(',').map(s => s.trim()).filter(Boolean);
            if (sizes.length ? !sizes.includes(i.size) : !!i.size) throw new CheckoutError('პროდუქტის ზომა შეიცვალა. განაახლეთ კალათა.', 409);
            const price = p.salePrice !== null && p.salePrice >= 0 && p.salePrice < p.price ? p.salePrice : p.price;
            if (price <= 0 || !Number.isSafeInteger(price)) throw new CheckoutError('პროდუქტის ფასი ამ ეტაპზე მიუწვდომელია.', 409);
            demand.set(p.id, (demand.get(p.id) || 0) + i.qty);
            if(sizes.length){const d=sizeDemand.get(p.id)||new Map<string,number>();d.set(i.size,(d.get(i.size)||0)+i.qty);sizeDemand.set(p.id,d)}
            return {productId: p.id, name: p.name, price, cost: p.cost, quantity: i.qty, size: i.size || null};
          });
          const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
          if (!Number.isSafeInteger(total) || total * 100 !== input.expectedTotalMinor) throw new CheckoutError('კალათის ფასი შეიცვალა. განაახლეთ გვერდი და გადაამოწმეთ თანხა.', 409);
          for (const [id, qty] of [...demand].sort((a, b) => a[0] - b[0])) {
            if (qty > 10) throw new CheckoutError('ერთ მოდელზე მაქსიმუმ 10 ერთეულის შეკვეთაა შესაძლებელი.');
            await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id"=${id} FOR UPDATE`;
            const product=await tx.product.findUniqueOrThrow({where:{id}});
            const variants=parseSizeStock(product.sizeStock);
            const required=sizeDemand.get(id);
            if(required){
              if(!variants)throw new CheckoutError('ზომების მარაგი ჯერ არ არის დაზუსტებული. სცადეთ მოგვიანებით.',409);
              for(const [size,count] of required) {
                if(!Object.hasOwn(variants,size)||variants[size]<count)throw new CheckoutError('არჩეული ზომის რაოდენობა მარაგში აღარ არის. განაახლეთ კალათა.',409);
                variants[size]-=count;
              }
            }
            const reserved = await tx.product.updateMany({where: {id, stock: {gte: qty}, status: 'ACTIVE'}, data: {stock: {decrement: qty},...(required?{sizeStock:JSON.stringify(variants)}:{})}});
            if (reserved.count !== 1) throw new CheckoutError('არჩეული რაოდენობა მარაგში აღარ არის. განაახლეთ კალათა.', 409);
          }
          return tx.payment.create({data: {
            idempotencyKey: input.idempotencyKey, payloadHash, clientHash, method: input.method, environment: config.mode,
            amountMinor: total * 100, expiresAt: new Date(Date.now() + 15 * 60_000),
            order: {create: {
              orderNo: 'TP-' + new Date().toISOString().slice(0, 10).replaceAll('-', '') + '-' + randomBytes(5).toString('hex').toUpperCase(),
              customerName: input.customer.name, phone: input.customer.phone, email: input.customer.email || null,
              address: input.delivery === 'delivery' ? input.customer.address : 'ადგილზე გატანა', total, status: 'AWAITING_PAYMENT', source: 'Website', items: {create: items},
            }},
          }, include: includeOrder});
        });
      } catch (e) {
        if (!(e instanceof CheckoutError) && (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002')) throw e;
        row = await db.payment.findUnique({where: {idempotencyKey: input.idempotencyKey}, include: includeOrder});
        if (!row) {
          if (e instanceof CheckoutError) throw new CheckoutError(e.message, e.status, true);
          throw e;
        }
      }
    }
    if (row.payloadHash !== payloadHash || row.environment !== config.mode) throw new CheckoutError('ეს გადახდის მცდელობა სხვა კალათას ეკუთვნის. გახსენით გადახდის გვერდი თავიდან.', 409);
    return view(await createProvider(row.id));
  }
  async function reconcilePayment(id: string, force = false) {
    requireEnabled();
    let row = await load(id);
    if (!row.providerOrderId) return row.status === 'CREATING' ? createProvider(id) : row;
    if (!force && (!pending.includes(row.status) || (row.lastCheckedAt && row.lastCheckedAt.getTime() > Date.now() - 5000))) {
      if (row.status === 'PAID') await notifyPaidOrder(id).catch(() => {});
      return row;
    }
    if (!force) {
      const claim = await db.payment.updateMany({where: {id, OR: [{lastCheckedAt: null}, {lastCheckedAt: {lt: new Date(Date.now() - 5000)}}]}, data: {lastCheckedAt: new Date()}});
      if (!claim.count) return load(id);
    }
    const receipt = await gateway.getOrder(row.providerOrderId);
    row = await applyReceipt(id, receipt);
    return row;
  }
  async function getCheckout(id: string, suppliedToken: string) {
    requireEnabled(); verifyToken(id, suppliedToken);
    let row = await load(id);
    try {row = await reconcilePayment(id);} catch (e) {if (e instanceof CheckoutError) throw e; /* retain the last verified state during a bank outage */}
    return view(row);
  }
  async function reconcileProvider(providerOrderId: string) {
    requireEnabled();
    const receipt = await gateway.getOrder(providerOrderId);
    const row = await load(receipt.reference);
    return applyReceipt(row.id, receipt);
  }
  async function reconcileDue() {
    requireEnabled();
    const rows = await db.payment.findMany({where: {environment: config.mode, status: {in: pending}, OR: [{lastCheckedAt: null}, {lastCheckedAt: {lt: new Date(Date.now() - 60_000)}}]}, orderBy: [{lastCheckedAt: 'asc'}, {createdAt: 'asc'}], take: 10, select: {id: true}});
    let checked = 0, errors = 0;
    // Bounded concurrency keeps the serverless job within its time budget.
    for (let i = 0; i < rows.length; i += 3) await Promise.all(rows.slice(i, i + 3).map(async row => {try {await reconcilePayment(row.id, true); checked++;} catch {errors++;}}));
    return {checked, errors};
  }
  return {startCheckout, getCheckout, reconcilePayment, reconcileProvider, reconcileDue};
}
