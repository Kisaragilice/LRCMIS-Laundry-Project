-- Add the pickup pin snapshot to delivery tasks so couriers can navigate to
-- the exact location even if the customer edits or deletes the address later.
ALTER TABLE "delivery_tasks" ADD COLUMN "latitude" DECIMAL(10, 7),
ADD COLUMN "longitude" DECIMAL(10, 7);
