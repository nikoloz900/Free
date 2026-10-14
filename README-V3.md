# Topuria Premium V3 — Admin Foundation

## First run (Windows PowerShell)
1. Copy `.env.example` to `.env` (already included for local demo).
2. Change `ADMIN_PASSWORD` and `AUTH_SECRET` in `.env` before real use.
3. Run:
   npm install
   npm run setup
   npm run dev
4. Open http://localhost:3000/admin/login

Default local demo admin: admin@topuriapremium.ge / ChangeMe123!

V3 uses SQLite locally so no separate database server is needed. Before production deployment we will switch Prisma datasource to PostgreSQL and migrate the schema.
