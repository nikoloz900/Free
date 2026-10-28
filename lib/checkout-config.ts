export type CheckoutMethod = 'card' | 'apple_pay' | 'bnpl' | 'bog_loan';
export type CheckoutConfig = {
  enabled: boolean;
  mode: 'sandbox' | 'production';
  appUrl: string;
  secret: string;
  delivery: 'pickup' | 'free' | 'courier';
  methods: CheckoutMethod[];
};

export const methodLabels: Record<CheckoutMethod, string> = {
  card: 'Visa / Mastercard', apple_pay: 'Apple Pay', bnpl: 'BOG ნაწილ-ნაწილ', bog_loan: 'BOG განვადება',
};

// Explicit activation follows schema installation and the bank's merchant activation.
// Never derive bank callback URLs from user input, Host, or forwarded headers.
export function checkoutConfig(): CheckoutConfig {
  const mode = process.env.BOG_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  let appUrl = '';
  try {
    const url = new URL(process.env.APP_URL || '');
    if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/') appUrl = url.origin;
  } catch {}
  const secret = process.env.AUTH_SECRET || '';
  const methods: CheckoutMethod[] = ['card'];
  if (process.env.BOG_APPLE_PAY_ENABLED === 'true') methods.push('apple_pay');
  if (process.env.BOG_BNPL_ENABLED === 'true') methods.push('bnpl');
  if (process.env.BOG_LOAN_ENABLED === 'true') methods.push('bog_loan');
  const enabled = process.env.CHECKOUT_ENABLED === 'true' &&
    ['sandbox', 'production'].includes(process.env.BOG_ENVIRONMENT || 'sandbox') &&
    !!appUrl && secret.length >= 32 && !!process.env.BOG_CLIENT_ID && !!process.env.BOG_CLIENT_SECRET &&
    // Sandbox must use a disposable DB/Neon branch on a Preview deployment.
    // This acknowledgement is deliberate; live Vercel Production is blocked.
    (mode !== 'sandbox' || (process.env.VERCEL_ENV !== 'production' && process.env.CHECKOUT_SANDBOX_ISOLATED === 'true'));
  return {enabled, mode, appUrl, secret, delivery: process.env.CHECKOUT_DELIVERY === 'free' ? 'free' : process.env.CHECKOUT_DELIVERY === 'pickup' ? 'pickup' : 'courier', methods};
}

export function publicCheckoutConfig() {
  const config = checkoutConfig();
  return {
    enabled: config.enabled, mode: config.enabled ? config.mode : 'disabled',
    delivery: {mode: config.delivery, label: config.delivery === 'courier' ? 'მიწოდების საფასურს გადაიხდით კურიერთან' : config.delivery === 'free' ? 'უფასო მიწოდება' : 'ადგილზე გატანა · უფასო'},
    methods: (Object.keys(methodLabels) as CheckoutMethod[]).map(id => ({id, label: methodLabels[id], enabled: config.enabled && config.methods.includes(id)})),
    ...(!config.enabled ? {message: 'ონლაინ გადახდა ჯერ არ არის გააქტიურებული. ბარათი, Apple Pay და ნაწილ-ნაწილ გადახდა ხელმისაწვდომი გახდება ბანკთან დაკავშირების შემდეგ.'} : {}),
  };
}
