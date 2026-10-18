-- Per-size inventory: additive preparation only.
-- Do not deploy size-based checkout until admin, catalog, cart and checkout
-- reservation/release paths are updated together and tested.
-- Existing Product.stock and orders remain unchanged.
CREATE TABLE IF NOT EXISTS "ProductSizeStock" (
  "id" SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "size" TEXT NOT NULL,
  "stock" INTEGER NOT NULL DEFAULT 0 CHECK ("stock" >= 0),
  CONSTRAINT "ProductSizeStock_productId_size_key" UNIQUE ("productId", "size"),
  CONSTRAINT "ProductSizeStock_size_not_blank" CHECK (length(trim("size")) > 0)
);
CREATE INDEX IF NOT EXISTS "ProductSizeStock_productId_idx" ON "ProductSizeStock" ("productId");
