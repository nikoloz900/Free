import {extractBogCallbackId, verifyBogCallback} from '../../../../../lib/bog';
import {CheckoutError} from '../../../../../lib/checkout';
import {boundedBody, checkoutFailure, checkoutJson, checkoutService} from '../../../../../lib/checkout-http';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const raw = await boundedBody(req, 256_000);
    if (!verifyBogCallback(raw, req.headers.get('callback-signature') || '')) return checkoutJson({error: 'Invalid signature'}, 401);
    const id = extractBogCallbackId(raw);
    try {await checkoutService().reconcileProvider(id);}
    catch (error) {
      // Another integration on this merchant account may own this reference.
      if (!(error instanceof CheckoutError) || error.status !== 404) throw error;
    }
    return checkoutJson({received: true});
  } catch (error) {return checkoutFailure(error);}
}
