# TOPURIA PREMIUM V5 — PostgreSQL-first development

## Important
This is a **development build**, not a live payment-ready production deployment. Existing V4 SQLite data is NOT automatically migrated. Keep a backup of your original V4 `prisma/dev.db`. Do not run the demo seed against a real customer database.

## Requirements
Node.js 22+, PostgreSQL 15+ (local Docker PostgreSQL is convenient), npm.

## Local PostgreSQL
1. Create a PostgreSQL database named `topuria` and a limited-privilege application user.
2. Copy `.env.example` to `.env`; fill in `DATABASE_URL` and a new strong `AUTH_SECRET`.
3. `npm install`
4. `npx prisma generate`
5. `npx prisma db push` (local development bootstrap only; production requires reviewed migrations)
6. `npm run db:seed` **ONLY for an empty development database**. Seed creates demo accounts/orders and should never run on production.
7. `npm run dev` and open `http://localhost:3000`.

## New functionality
Admin category create/activate/hide/delete (deletion blocked while products reference category); product create/edit/archive/delete with category, image URL, description, sizes and colors; customer purchase history grouped from orders; refined admin layout. Admin routes check authentication and roles server-side.

## Known gaps before public launch
- The storefront still contains **static demo products** (`app/data.ts`) and is not yet connected to the PostgreSQL catalog. **Do not publish as a functioning store.**
- No real checkout/payment gateway, inventory reservations, email notifications or shipping workflow.
- Product image field supports a path or URL, not direct uploads or persistent cloud object storage. For local tests place images in `public/products` and enter `/products/filename.jpg`.
- Customer page derives profiles from order phone numbers; it is not a registered-customer CRM. No customer registration is required.
- No production rate limiting, password reset, audit trail, monitoring, backup automation or security review yet.
- Database monetary fields currently store whole GEL as Int (V4 compatibility). Before real payments, migrate to integer tetri or decimal amounts and handle rounding.
- Seeded default passwords are for demo ONLY. Change/remove all demo users before public deployment.

## Hosting
Use a platform supporting a persistent Next.js Node.js process and PostgreSQL. Vercel + managed PostgreSQL is an option. Generic PHP-only cPanel hosting is insufficient. If using cPanel, verify Node.js support, process management, environment variables, outbound TLS and PostgreSQL access. Uploaded images must use persistent object storage in production, not ephemeral application filesystem.

## Migration and backups
V4 SQLite and V5 PostgreSQL are distinct databases. Do not delete the V4 SQLite database. A one-time import of real data must be separately tested and validated. Create and review versioned Prisma migrations before production; use `prisma migrate deploy` for subsequent production changes, maintain off-site database backups, and keep secrets only in the hosting environment.
