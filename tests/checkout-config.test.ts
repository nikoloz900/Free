import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkoutConfig, publicCheckoutConfig} from '../lib/checkout-config';

test('Sandbox activation requires deliberate test DB isolation and is blocked on live Vercel Production', () => {
  const keys = ['CHECKOUT_ENABLED', 'BOG_ENVIRONMENT', 'BOG_CLIENT_ID', 'BOG_CLIENT_SECRET', 'AUTH_SECRET', 'APP_URL', 'VERCEL_ENV', 'CHECKOUT_SANDBOX_ISOLATED', 'BOG_APPLE_PAY_ENABLED', 'BOG_BNPL_ENABLED'];
  const original = new Map(keys.map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, {CHECKOUT_ENABLED: 'true', BOG_ENVIRONMENT: 'sandbox', BOG_CLIENT_ID: 'local-config-test', BOG_CLIENT_SECRET: 'local-config-test', AUTH_SECRET: 'local-config-test-secret-over-thirty-two-characters', APP_URL: 'https://shop.example.test', VERCEL_ENV: 'preview'});
    delete process.env.CHECKOUT_SANDBOX_ISOLATED;
    assert.equal(checkoutConfig().enabled, false);
    process.env.CHECKOUT_SANDBOX_ISOLATED = 'true';
    assert.equal(checkoutConfig().enabled, true);
    process.env.VERCEL_ENV = 'production';
    assert.equal(checkoutConfig().enabled, false);
    process.env.BOG_ENVIRONMENT = 'production';
    assert.equal(checkoutConfig().enabled, true);
    process.env.APP_URL = 'http://shop.example.test';
    assert.equal(checkoutConfig().enabled, false);
    process.env.APP_URL = 'https://attacker.example/shop';
    assert.equal(checkoutConfig().enabled, false);
    process.env.APP_URL = 'https://shop.example.test';
    process.env.BOG_ENVIRONMENT = 'invalid';
    assert.equal(checkoutConfig().enabled, false);
    process.env.BOG_ENVIRONMENT = 'production';
    process.env.BOG_APPLE_PAY_ENABLED = 'true';
    process.env.BOG_BNPL_ENABLED = 'true';
    const config = publicCheckoutConfig();
    assert.equal(config.methods.find(method => method.id === 'bnpl')?.enabled, true);
    assert.equal(config.methods.find(method => method.id === 'apple_pay')?.enabled, true);
    assert.equal(JSON.stringify(config).includes('local-config-test'), false);
    assert.equal('secret' in config, false);
    delete process.env.BOG_CLIENT_SECRET;
    assert.equal(publicCheckoutConfig().methods.every(method => !method.enabled), true);
  } finally {
    for (const [key, value] of original) {if (value === undefined) delete process.env[key]; else process.env[key] = value;}
  }
});
