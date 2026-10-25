#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy --schema ./prisma/schema.prisma

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Seeding reference data..."
  npx prisma db seed
fi

echo "Starting LRCMIS API..."
exec node dist/src/index.js
