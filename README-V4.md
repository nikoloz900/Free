# Topuria Premium V4 — Operations Edition

## Local setup
1. Copy `.env.example` to `.env` (keep `DATABASE_URL="file:./dev.db"`).
2. `npm install`
3. `npm run setup`
4. `npm run dev`

Demo accounts:
- Owner: `admin@topuriapremium.ge` / `Topuria@2026!`
- Operator: `operator@topuriapremium.ge` / `Operator@2026!`

The seed creates 8 fashion products, 14 demo orders and 14 days of analytics events so Dashboard / Orders / Analytics are populated immediately.

## Production database
V4 keeps ONE application data model. Local development uses SQLite for zero-setup development. Production should use PostgreSQL via `prisma/schema.production.prisma`.

Production deploy sequence:
- Set `DATABASE_URL` to your managed PostgreSQL connection string.
- Set a strong `AUTH_SECRET`, `ADMIN_PASSWORD`, `OPERATOR_PASSWORD`.
- `npm run db:prod:generate`
- `npm run db:prod:push`
- `npx prisma db seed --schema prisma/schema.production.prisma`
- `npm run build`

Do not commit `.env` or production credentials.

## Included
- Owner/Admin and Operator accounts
- Per-user permissions (orders, analytics, costs, deletes, export, users/customers)
- Order workflow/status updates
- Analytics KPIs, top products, traffic sources, conversion funnel
- Product inventory + SKU + cost + low-stock indication
- Seeded demo catalog/orders/events
- PostgreSQL-ready production schema
