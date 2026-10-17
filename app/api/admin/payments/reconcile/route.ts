import {getAdmin} from '../../../../../lib/auth';
import {rejectCrossOrigin} from '../../../../../lib/request';
import {serializeAdminPayment} from '../../../../../lib/admin-payments';
import {CheckoutError} from '../../../../../lib/checkout';
import {checkoutBody, checkoutFailure, checkoutJson, checkoutService} from '../../../../../lib/checkout-http';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(req: Request) {
  const blocked = rejectCrossOrigin(req); if (blocked) return blocked;
  const admin = await getAdmin(); if (!admin?.manageOrders) return checkoutJson({error: 'შეკვეთების მართვის უფლება არ გაქვთ.'}, 403);
  try {
    const input = await checkoutBody(req) as {id?: unknown};
    if (!input || typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.id)) throw new CheckoutError('არასწორი გადახდა.');
    const payment = await checkoutService().reconcilePayment(input.id, true);
    return checkoutJson({payment: serializeAdminPayment(payment), order: {id: payment.orderId, status: payment.order.status}});
  } catch (error) {return checkoutFailure(error);}
}
