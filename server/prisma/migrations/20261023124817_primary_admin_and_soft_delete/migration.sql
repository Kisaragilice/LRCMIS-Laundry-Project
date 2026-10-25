-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMPTZ(3),
ADD COLUMN     "deleted_by" UUID,
ADD COLUMN     "is_primary_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "users_is_primary_admin_idx" ON "users"("is_primary_admin");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- At most one primary administrator can exist at any time.
CREATE UNIQUE INDEX "users_single_primary_admin_key"
  ON "users"("is_primary_admin")
  WHERE "is_primary_admin" = true;

-- Defence in depth: the API cannot remove, deactivate or delete the primary
-- administrator, and this trigger enforces the same rule for direct SQL writes.
CREATE OR REPLACE FUNCTION lrcmis_protect_primary_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."is_primary_admin" THEN
      RAISE EXCEPTION 'Primary administrator account cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."is_primary_admin" THEN
    IF NEW."is_primary_admin" IS DISTINCT FROM OLD."is_primary_admin" THEN
      RAISE EXCEPTION 'Primary administrator designation cannot be changed';
    END IF;
    IF NEW."is_active" = false THEN
      RAISE EXCEPTION 'Primary administrator account cannot be deactivated';
    END IF;
    IF NEW."deleted_at" IS NOT NULL THEN
      RAISE EXCEPTION 'Primary administrator account cannot be deleted';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "users_protect_primary_admin" ON "users";
CREATE TRIGGER "users_protect_primary_admin"
  BEFORE UPDATE OR DELETE ON "users"
  FOR EACH ROW EXECUTE FUNCTION lrcmis_protect_primary_admin();

-- The primary administrator must always retain the admin role.
CREATE OR REPLACE FUNCTION lrcmis_protect_primary_admin_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  is_primary boolean;
  role_name varchar(50);
BEGIN
  SELECT "is_primary_admin" INTO is_primary FROM "users" WHERE "id" = OLD."user_id";
  SELECT "name" INTO role_name FROM "roles" WHERE "id" = OLD."role_id";
  IF is_primary AND role_name = 'admin' THEN
    RAISE EXCEPTION 'Primary administrator must retain the admin role';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "user_roles_protect_primary_admin" ON "user_roles";
CREATE TRIGGER "user_roles_protect_primary_admin"
  BEFORE DELETE ON "user_roles"
  FOR EACH ROW EXECUTE FUNCTION lrcmis_protect_primary_admin_role();
