#!/usr/bin/env bash
# Idempotently provision the local Postgres role + database used by apps/api.
# Safe to run multiple times.
set -euo pipefail

DB_NAME="${DB_NAME:-govnotice}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-password}"

# Create the login role if it doesn't exist, then (re)set its password.
if ! psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  psql -d postgres -c "CREATE ROLE ${DB_USER} LOGIN SUPERUSER PASSWORD '${DB_PASS}';"
  echo "Created role ${DB_USER}"
else
  echo "Role ${DB_USER} already exists"
fi
psql -d postgres -c "ALTER ROLE ${DB_USER} WITH LOGIN SUPERUSER PASSWORD '${DB_PASS}';" >/dev/null

# Create the database if it doesn't exist.
if ! psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  psql -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  echo "Created database ${DB_NAME}"
else
  echo "Database ${DB_NAME} already exists"
fi

echo "Done. (tables are auto-created by the API on first boot)"
