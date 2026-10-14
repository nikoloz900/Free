# Topuria Premium V5 — Languages and themes

Languages: Georgian, English, Russian. Theme options: Burgundy Gold, Light Luxury, Dark Premium. Preferences stored in browser localStorage. Public homepage/header/shop UI is localized; **not all legacy product, checkout, account and admin copy is translated yet**. Product translations require DB fields and editorial content.

## Vercel preparation
- Deploy as Next.js app; install dependencies with `npm install`; build via `npm run build`.
- Configure `DATABASE_URL` for an actual PostgreSQL instance, `AUTH_SECRET` with a strong random value, and any other secrets in Vercel project Environment Variables. Do not upload `.env` files.
- Prisma schema changes require a reviewed migration process and real production database setup. No production migrations or payment processing are claimed ready.
- Do not use the seeded demo credentials in production.
- Images uploaded to a local folder will not persist on Vercel; configure persistent object storage before accepting live uploads.
- The legacy storefront still contains demo products and the checkout/payment workflow is not production ready.
