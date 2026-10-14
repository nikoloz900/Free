# Topuria Premium V6 — Vercel + Neon + Cloudinary

## What changed
- Product editor: upload an image directly from your computer using the Cloudinary widget.
- Authenticated signature endpoint `/api/admin/cloudinary-sign` checks the active admin session.
- Uploaded secure HTTPS image URL automatically populates the product editor field; click **Save** to persist to Neon.
- Prisma Client generation on `postinstall` for Vercel deployments.

## Configuration
1. Register Cloudinary and copy Cloud name, API key, API secret from the console.
2. Add these environment variables to `.env` locally and to Vercel Project > Settings > Environment Variables:
   - `DATABASE_URL` (Neon pooled connection URL)
   - `AUTH_SECRET` (unique strong secret; preserve it across deploys)
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
   - `NEXT_PUBLIC_CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET` (server only, never `NEXT_PUBLIC_`)
3. `npm install`, then `npm run dev`. Admin > Products > Upload photo.
4. `npm run build` and check all routes, login, upload, cart, checkout, and order management before launch.
5. Push source to a private GitHub repository, import into Vercel, add environment variables, deploy.

## Security and launch notes
- Never commit `.env` or connection strings to Git.
- Rotate the Neon password if it has ever been pasted into a chat, before public launch.
- Change all demo passwords; do not run `prisma/seed.ts` on production (it creates fake products, orders and analytics).
- Existing schema has a **single imageUrl** per product. Multi-image gallery needs a separate data model and UI change.
- Cloudinary upload is signed and restricted to logged-in admins, but a full production audit (role authorization, rate limiting, stock concurrency, payment flow, CSP, backups) is still required.
- The original V5 application has not been independently verified end-to-end. Do not enable public orders/payments until tests pass.
