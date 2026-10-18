-- Additive production migration. Run once against the existing PostgreSQL database before deploying geo analytics.
ALTER TABLE "AnalyticsEvent" ADD COLUMN IF NOT EXISTS "country" TEXT;
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_country_createdAt_idx" ON "AnalyticsEvent" ("country", "createdAt");
