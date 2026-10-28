-- Apply to the isolated Preview database BEFORE deploying Telegram-enabled checkout.
-- Additive and safe to rerun. No existing orders or payment records are deleted.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "telegramClaimedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "telegramSentAt" TIMESTAMP(3);
