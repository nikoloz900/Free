import {publicCheckoutConfig} from '../../../../lib/checkout-config';
import {checkoutJson} from '../../../../lib/checkout-http';
export const dynamic = 'force-dynamic';
export function GET() {return checkoutJson(publicCheckoutConfig());}
