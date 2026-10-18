-- Apply only after reviewing coordinated application deployment. Existing stock and orders are preserved.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sizeStock" TEXT;
