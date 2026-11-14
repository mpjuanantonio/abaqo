# Abaqo deploy

Two Compose files, two separate projects:

| File                          | Project          | Contents                                                         |
| ----------------------------- | ---------------- | ---------------------------------------------------------------- |
| `docker-compose.yml`          | `abaqo`          | Profile `dev` (implemented); `full` and `companion` placeholders |
| `docker-compose.banktest.yml` | `abaqo-banktest` | OWNER-ONLY real-bank test (Enable Banking), no profiles          |

The bank test is deliberately a separate file with external volumes: nothing you do to the dev
stack (`down -v`, resets) can reach it. Dev services are named `dev-*` so `full` can later use the
plain names (`postgres`, `firefly`, ...) with `deploy/.env`.

**About `deploy/.env`.** With `-f deploy/docker-compose.yml`, Compose uses `deploy/` as the
project directory and automatically loads `deploy/.env` for `${VAR}` interpolation. The `dev`
services therefore contain no `${VAR}` interpolation at all and read only the committed
fake-value files in `deploy/dev/*.env`: nothing in `deploy/.env` can reach them.

**Compose version.** The dev importer uses `env_file` with `path:` / `required: false`, which
needs Docker Compose v2.24 or newer (tested with 5.5.0; I could not confirm the exact release
that added `required`).

## Dev stack

A throwaway Firefly III + Firefly Data Importer + Postgres with fake data. It is isolated
from any real installation: project `abaqo`, profile `dev`, its own network and volumes
(`abaqo_dev_*`), loopback-only ports, and fake credentials in `deploy/dev/*.env` (committed,
dev only, never reused by `full` or the bank test). Postgres runs in UTC; Firefly and the
importer in Europe/Madrid.

| Service        | Image                                    | Host URL               | Memory limit |
| -------------- | ---------------------------------------- | ---------------------- | ------------ |
| `dev-firefly`  | `fireflyiii/core:version-6.7.9`          | http://127.0.0.1:18080 | 512 MB       |
| `dev-importer` | `fireflyiii/data-importer:version-2.3.5` | http://127.0.0.1:18081 | 256 MB       |
| `dev-postgres` | `postgres:18-alpine`                     | `127.0.0.1:15432`      | 256 MB       |

Postgres holds two databases, `firefly` and `abaqo`, each owned by its own role
(`deploy/postgres/init-databases.sh`; passwords come from the environment). Ports are bound
to 127.0.0.1 only. The Abaqo API dev port stays 3100 and the web dev port 5173.

### Commands (from the repo root)

```sh
# start (first start takes about a minute: Firefly runs its migrations)
docker compose -f deploy/docker-compose.yml --profile dev up -d
docker compose -f deploy/docker-compose.yml --profile dev ps

# create the dev user and a personal access token (saved in deploy/dev/.dev-token, gitignored;
# it also configures the dev importer through deploy/dev/importer-token.env, gitignored)
deploy/dev/bootstrap.sh

# load the fake data through the Firefly REST API (safe to run twice). It reads only
# DEV_FIREFLY_URL / DEV_FIREFLY_TOKEN (never FIREFLY_URL / FIREFLY_TOKEN) and refuses to write
# unless the URL is loopback AND the token belongs to dev@abaqo.invalid. Optional SEED_TODAY=YYYY-MM-DD.
npm run seed -w api

# stop, keeping data
docker compose -f deploy/docker-compose.yml --profile dev down

# reset everything (containers AND volumes), then start again from scratch
docker compose -f deploy/docker-compose.yml --profile dev down -v
rm -f deploy/dev/.dev-token deploy/dev/importer-token.env
```

Firefly UI login: `dev@abaqo.invalid` and the fake password in `deploy/dev/bootstrap.env`.

### Seed data

`api/test/fixtures/seed.json`: 4 asset accounts (Santander nómina, Santander diario,
Trade Republic, Efectivo), 17 categories (the optional template plus Ingresos), and 43
transactions across the previous and current calendar month (the current month is clamped
to today). Amounts are integer cents in the file and become decimal strings only when sent
to Firefly. Every transaction has `external_id = seed-NNN` (that is how the seed skips
existing ones) and the tag `seed-dev`. It covers Santander-style card descriptions, salary,
internal transfers, Bizum sent with a concept, Bizum received with and without a concept, a
5-person dinner repaid by three Bizums (one diner still owes), a refund and two
subscriptions charged in both months. All names, card numbers and IBANs are fake. The
Bizum description formats are guesses until real Santander samples are recorded (see the
`enable-banking` skill).

`GET /api/v1/transactions?type=all` also counts the 4 opening-balance transactions
Firefly creates for the accounts, so the total after seeding is 47.

### Bank credentials

The dev stack never gets real bank credentials, and its importer has no Enable Banking
variables. Real-bank tests use the owner-only bank test stack below.

### Memory

Measured with `docker stats --no-stream` after bootstrap and seed (see the numbers below):

| Container   | Memory (idle, after seed) |
| ----------- | ------------------------- |
| Firefly III | 67 MiB                    |
| Importer    | 54 MiB                    |
| Postgres    | 39 MiB                    |
| **Total**   | **about 160 MiB**         |

(Measured on 2026-11-14 on a 7 GB host. Peaks while Firefly runs its first migrations or
renders heavy pages will be higher; the limits above cap each container.)

The `full` profile target remains under 1.5 GB in total.

### Notes

- No cron container in dev: Firefly's recurring transactions and the daily import are not
  needed for development.
- Firefly's docs site blocks automated fetches, so artisan commands were checked against the
  pinned image (`php artisan list`) and the GitHub sources; see `deploy/dev/bootstrap.sh`.

## Bank test (owner only)

Tests Santander through Enable Banking with REAL bank data. Standalone file
`docker-compose.banktest.yml`, project `abaqo-banktest`.

**Who and where.** Only the project owner runs it, under their own Linux user (their own Docker
daemon), from THEIR OWN clone of the repo in their own home, checked out at a reviewed commit.
Never from the agent user's checkout, so agents never see the data or the credentials. Secrets
live outside any repo, in `~/.config/abaqo/banktest.env` (mode 600). No step below creates
`deploy/.env`.

| Service             | Host URL               | Notes                                  |
| ------------------- | ---------------------- | -------------------------------------- |
| `banktest-firefly`  | http://127.0.0.1:28080 | volume `abaqo_banktest_firefly_upload` |
| `banktest-importer` | http://127.0.0.1:28081 | published to your tailnet (step 6)     |
| `banktest-postgres` | no host port           | volume `abaqo_banktest_pgdata`         |

**Security model, in plain words.**

- The loopback ports (28080, 28081) are reachable by every local user of the machine.
- Firefly is protected by its login. Its register form closes once the first user exists
  (single-user mode; see below).
- The importer has no login of its own. It is "protected" only by NOT holding a Firefly
  token: you paste the token in its UI each session. Never put the token in the env file.
- `tailscale serve` exposes the importer to every device and every user shared into your tailnet.
  Confirm the tailnet only has your own devices (or restrict with ACLs) before step 6.
- Stop the stack and turn `tailscale serve` off when the test is done.

Steps:

1. Create the env file outside any repo, and fill it in:

   ```sh
   mkdir -p ~/.config/abaqo
   cp deploy/.env.example ~/.config/abaqo/banktest.env
   chmod 600 ~/.config/abaqo/banktest.env
   openssl rand -hex 24   # for each of the three DB passwords
   openssl rand -hex 16   # for FIREFLY_APP_KEY and FIREFLY_STATIC_CRON_TOKEN (32 chars each)
   ```

   Keep only the banktest variables you need. Use plain `KEY=value` lines; the PEM goes on one
   line with literal `\n` inside double quotes (see `.env.example`). Compose stops with a clear
   message if a required variable (DB passwords, APP_KEY, STATIC_CRON_TOKEN) is missing, and
   Firefly's container refuses to start if the APP_KEY is not 32 characters.

2. Create the external volumes once (Compose never creates or deletes them):

   ```sh
   docker volume create abaqo_banktest_pgdata
   docker volume create abaqo_banktest_firefly_upload
   ```

3. Start (always pass `--env-file` explicitly; use another path to test with a throwaway file):

   ```sh
   BT="docker compose -f deploy/docker-compose.banktest.yml --env-file $HOME/.config/abaqo/banktest.env"
   $BT up -d
   $BT ps
   ```

4. Open http://127.0.0.1:28080 and register the first Firefly user in the web UI. Registration
   then closes: Firefly's `single_user_mode` defaults to `true` (`config/firefly.php` at v6.7.9),
   and `RegisterController::allowedToRegister()` returns false when it is on and a user exists.
   Then go to Options > Profile > OAuth > Personal Access Tokens and create a token.

5. Open the importer (step 6 URL, or http://127.0.0.1:28081 on the machine) and paste the
   token in its UI. Do this each session; the token is not stored in any file.

6. Publish the importer on your tailnet only (**not** `tailscale funnel`):

   ```sh
   tailscale serve --bg --https=<port> http://127.0.0.1:28081
   tailscale serve status
   ```

   `<port>` must be one Tailscale Serve accepts (443 by default; check `tailscale serve --help`).
   If you use a port other than 443, it is part of the URL.

7. The redirect URL to paste in the Enable Banking Control Panel (Allowed Redirect URLs) is

   `https://<your-machine>.<your-tailnet>.ts.net[:<port>]/eb-callback`

   The importer prints the exact value on its `/authenticate-flow/eb` page (open the importer
   through the https URL and check that it starts with `https://`). Then put
   `ENABLE_BANKING_APP_ID` and `ENABLE_BANKING_PRIVATE_KEY` in the env file, re-run `$BT up -d`,
   and follow the Enable Banking guide in `docs/architecture.md`. Use the same https importer
   root as the Privacy Policy and Terms URLs.

8. After each session, turn publishing off and stop (data stays in the external volumes):

   ```sh
   tailscale serve --https=<port> off
   $BT down
   ```

9. To wipe everything, explicitly (`down -v` does NOT remove external volumes):

   ```sh
   $BT down
   docker volume rm abaqo_banktest_pgdata abaqo_banktest_firefly_upload
   ```

How the https redirect URL is built: the importer builds `https://<host>/eb-callback` from the
incoming request (Laravel `route()`), not from a configured variable (its `.env.example` says
`APP_URL` is not used). With `TRUSTED_PROXIES=**` (set in the compose file) it honours
`X-Forwarded-Proto`, `X-Forwarded-Host` and `X-Forwarded-Port` from the proxy. Verified
locally by sending those headers by hand; not verified: that `tailscale serve` actually sends
them (Tailscale's documentation page does not say), nor an end-to-end Enable Banking login
(needs real credentials). If the page shows an `http://` URL, report it.
