#!/bin/sh
# Docker entrypoint: apply pending Prisma migrations to the mounted sqlite
# volume, then start the standalone Next.js server.
#
# `migrate deploy` is idempotent: it only applies migrations not yet recorded
# in _prisma_migrations, so repeated container starts are safe.
#
# Prisma CLI is invoked directly via node (not `npx prisma`) because the
# standalone Next.js output does not include the node_modules/.bin symlinks
# that npx relies on.
set -e

echo "[entrypoint] Applying Prisma migrations to DATABASE_URL=$DATABASE_URL"
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] Starting Next.js server: $@"
exec "$@"
