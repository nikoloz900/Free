# Topuria Premium V7

Next.js 16 · React 19 · TypeScript · Prisma 6 · Neon PostgreSQL · Cloudinary

V7 keeps the existing database schema, admin accounts, permissions and records.
Start with [the V7 setup and Vercel guide](README-V7.md).
Older version guides are historical; their setup/seed commands must not be used on an existing database.

```sh
npm ci
npm run typecheck
npm run build
npm run dev
```

Configure the names in `.env.example` securely in a local ignored `.env` or Vercel settings.
Never upload credentials, `node_modules`, or `.next` to GitHub.
Cloud environments where Prisma's default download is rejected can use `bash scripts/prepare-cloud.sh`;
it verifies compressed and extracted official engine SHA256 checksums before use.
