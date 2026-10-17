import {NextResponse} from 'next/server';
import {db} from './db';
import {checkoutConfig} from './checkout-config';
import {CheckoutError, createCheckoutService} from './checkout';

export function checkoutService() {return createCheckoutService(db, checkoutConfig());}
export function checkoutJson(value: unknown, status = 200) {
  return NextResponse.json(value, {status, headers: {'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer'}});
}
export function checkoutFailure(error: unknown) {
  // Never serialize raw Prisma/bank errors: they can contain URLs or payer data.
  return checkoutJson({error: error instanceof CheckoutError ? error.message : 'გადახდის სერვისი დროებით მიუწვდომელია. სცადეთ ხელახლა.', ...(error instanceof CheckoutError && error.safeToRestart ? {safeToRestart: true} : {})}, error instanceof CheckoutError ? error.status : 503);
}
export async function boundedBody(req: Request, maxBytes = 32_000) {
  const reader = req.body?.getReader();
  if (!reader) throw new CheckoutError('მოთხოვნა ცარიელია.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {await reader.cancel(); throw new CheckoutError('მოთხოვნა მეტისმეტად დიდია.', 413);}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  return Buffer.concat(chunks).toString('utf8');
}
export async function checkoutBody(req: Request) {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new CheckoutError('მოთხოვნის ფორმატი არასწორია.', 415);
  const raw = await boundedBody(req);
  try {return JSON.parse(raw) as unknown;} catch {throw new CheckoutError('მოთხოვნის მონაცემები არასწორია.');}
}
