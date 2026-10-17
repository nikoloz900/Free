import {rejectCrossOrigin} from '../../../lib/request';
import {checkoutBody, checkoutFailure, checkoutJson, checkoutService} from '../../../lib/checkout-http';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(req: Request) {
  const blocked = rejectCrossOrigin(req); if (blocked) return blocked;
  try {
    const address = (req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const result = await checkoutService().startCheckout(await checkoutBody(req), address);
    return checkoutJson(result, 201);
  } catch (error) {return checkoutFailure(error);}
}
