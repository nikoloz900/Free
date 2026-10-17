import {checkoutFailure, checkoutJson, checkoutService} from '../../../../lib/checkout-http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(req: Request, context: {params: Promise<{id: string}>}) {
  try {
    const {id} = await context.params;
    return checkoutJson(await checkoutService().getCheckout(id, new URL(req.url).searchParams.get('token') || ''));
  } catch (error) {return checkoutFailure(error);}
}
