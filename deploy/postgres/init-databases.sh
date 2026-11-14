#!/bin/sh
# Creates the two Abaqo databases with one owner role each. Runs once, on first
# start of an empty data volume (official postgres image: /docker-entrypoint-initdb.d).
# Passwords come from the container environment; nothing is hard-coded here, so the `dev`
# profile, the owner-only banktest stack (docker-compose.banktest.yml) and the future `full`
# profile can share this script with different secrets.
set -eu

: "${FIREFLY_DB_PASSWORD:?FIREFLY_DB_PASSWORD is required}"
: "${ABAQO_DB_PASSWORD:?ABAQO_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v ff_pw="$FIREFLY_DB_PASSWORD" -v ab_pw="$ABAQO_DB_PASSWORD" <<'SQL'
CREATE ROLE firefly LOGIN PASSWORD :'ff_pw';
CREATE ROLE abaqo   LOGIN PASSWORD :'ab_pw';
CREATE DATABASE firefly OWNER firefly;
CREATE DATABASE abaqo   OWNER abaqo;
-- Each role can only reach its own database.
REVOKE CONNECT ON DATABASE firefly FROM PUBLIC;
REVOKE CONNECT ON DATABASE abaqo   FROM PUBLIC;
GRANT  CONNECT ON DATABASE firefly TO firefly;
GRANT  CONNECT ON DATABASE abaqo   TO abaqo;
SQL
