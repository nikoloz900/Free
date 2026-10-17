import {timingSafeEqual} from 'node:crypto';
import {checkoutFailure, checkoutJson, checkoutService} from '../../../../lib/checkout-http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '', supplied = req.headers.get('authorization') || '';
  const expected = Buffer.from('Bearer ' + secret), actual = Buffer.from(supplied);
  if (secret.length < 32 || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return checkoutJson({error: 'Unauthorized'}, 401);
  try {return checkoutJson(await checkoutService().reconcileDue());} catch (error) {return checkoutFailure(error);}
}
