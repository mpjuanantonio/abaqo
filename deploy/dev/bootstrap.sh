#!/usr/bin/env bash
# Creates the dev Firefly user and a personal access token, non-interactively.
# DEV STACK ONLY. Idempotent: reuses the user, and reuses the saved token while it still works.
#
# Why not `php artisan system:create-first-user`? It refuses to run unless APP_ENV=testing
# (checked in firefly-iii/app/Console/Commands/System/CreatesFirstUser.php, v6.7.x) and
# prints a random password. Instead this script uses Firefly's own user repository and
# Laravel Passport inside the container, the same classes the web UI uses.
# Personal access tokens are Laravel Passport tokens; the API takes them as
# `Authorization: Bearer <token>` (https://docs.firefly-iii.org/how-to/firefly-iii/features/api/).
# The docs site blocks automated fetches, so the artisan commands were checked against
# `php artisan list` / `passport:client --help` inside the pinned image and the GitHub sources.
#
# Output (both gitignored, chmod 600; the token is never printed):
#   deploy/dev/.dev-token          read by `npm run seed -w api`
#   deploy/dev/importer-token.env  read by the dev-importer service (FIREFLY_III_ACCESS_TOKEN)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="$(dirname "$HERE")"
TOKEN_FILE="$HERE/.dev-token"
COMPOSE=(docker compose -f "$DEPLOY/docker-compose.yml" --profile dev)
FIREFLY_URL="${DEV_FIREFLY_URL:-http://127.0.0.1:18080}"

IMPORTER_ENV="$HERE/importer-token.env"

set -a
# shellcheck source=bootstrap.env
. "$HERE/bootstrap.env"
set +a

# The token goes to curl on stdin (-H @-), never on its command line.
check_token() {
  [ -s "$TOKEN_FILE" ] && printf 'Authorization: Bearer %s\n' "$(cat "$TOKEN_FILE")" |
    curl -fsS -o /dev/null -H @- -H 'Accept: application/json' "$FIREFLY_URL/api/v1/about"
}

write_importer_env() {
  (umask 077; printf 'FIREFLY_III_ACCESS_TOKEN=%s\n' "$(cat "$TOKEN_FILE")" > "$IMPORTER_ENV")
  # Recreates the importer only if its config changed; no-op otherwise.
  "${COMPOSE[@]}" up -d dev-importer >/dev/null || { echo "Could not recreate dev-importer" >&2; exit 1; }
  echo "Importer configured with the dev token."
}

if check_token; then
  echo "Existing dev token still valid: $TOKEN_FILE"
  write_importer_env
  exit 0
fi

echo "Waiting for Firefly to be healthy..."
ready=""
for _ in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$FIREFLY_URL/health" || true)" = "200" ]; then
    ready=1
    break
  fi
  sleep 2
done
if [ -z "$ready" ]; then
  echo "Timed out after 120 s waiting for $FIREFLY_URL/health. Is the dev stack up? (docker compose -f deploy/docker-compose.yml --profile dev up -d)" >&2
  exit 1
fi

echo "Creating dev user and personal access token..."
status=0
OUTPUT="$("${COMPOSE[@]}" exec -T \
  -e DEV_EMAIL="$DEV_FIREFLY_EMAIL" -e DEV_PASSWORD="$DEV_FIREFLY_PASSWORD" \
  dev-firefly php 2>&1 <<'PHP'
<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Wait for the entrypoint migrations to finish.
for ($i = 0; $i < 60 && !Illuminate\Support\Facades\Schema::hasTable('oauth_clients'); $i++) { sleep(2); }

$email = getenv('DEV_EMAIL');
$user = FireflyIII\User::where('email', $email)->first();
if (null === $user) {
    $repo = app(FireflyIII\Repositories\User\UserRepositoryInterface::class);
    $user = $repo->store(['blocked' => false, 'blocked_code' => null, 'email' => $email, 'role' => 'owner']);
}
if (null === $user->user_group_id) {
    // Same event the official first-user command and the registration form fire; its listener
    // (HandlesNewUserRegistration) attaches the owner role and creates the user group, without
    // which every API call fails with "User has no user group".
    event(new FireflyIII\Events\Security\System\NewUserRegistered(new FireflyIII\Notifications\Notifiables\OwnerNotifiable(), $user));
    $user->refresh();
}
$user->password = Illuminate\Support\Facades\Hash::make(getenv('DEV_PASSWORD'));
$user->save();

// Passport needs one personal access client before createToken() works.
$hasClient = Illuminate\Support\Facades\DB::table('oauth_clients')
    ->where('grant_types', 'like', '%personal_access%')->exists();
if (!$hasClient) {
    Illuminate\Support\Facades\Artisan::call('passport:client', [
        '--personal' => true, '--provider' => 'users', '--name' => 'Abaqo dev personal client', '--no-interaction' => true,
    ]);
}
echo 'TOKEN:' . $user->createToken('abaqo-dev')->accessToken . "\n";
PHP
)" || status=$?

TOKEN="$(printf '%s\n' "$OUTPUT" | sed -n 's/^TOKEN://p')"
if [ "${status:-0}" -ne 0 ] || [ -z "$TOKEN" ]; then
  echo "Bootstrap failed (exit ${status:-0}). Output from the container (token line removed):" >&2
  printf '%s\n' "$OUTPUT" | grep -v '^TOKEN:' >&2
  exit 1
fi
umask 077
printf '%s' "$TOKEN" > "$TOKEN_FILE"
check_token || { echo "Token was created but the API rejected it." >&2; exit 1; }
echo "Dev token saved to $TOKEN_FILE (gitignored)."
echo "UI login: $DEV_FIREFLY_EMAIL / (dev-only password in deploy/dev/bootstrap.env)"
write_importer_env
