-- Payment reconciliation guard: a bank reference cannot be recorded twice for one order.
-- The application-level partial unique index for default addresses is replaced by
-- service-layer enforcement so that Prisma schema diffing remains stable.
DROP INDEX IF EXISTS "uq_addresses_one_default";
CREATE UNIQUE INDEX "payments_order_id_reference_code_key" ON "payments"("order_id", "reference_code");
