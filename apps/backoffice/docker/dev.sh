#!/bin/sh
# Local Docker only. Octane loads the app once and keeps it in memory, so code
# edits need a worker reload. The Windows bind mount delivers no file events, so
# poll for changed PHP/config/Blade files and reload (and drop compiled views).
set -u

storage="${LARAVEL_STORAGE_PATH:-/var/lib/backoffice/storage}"
mkdir -p "$storage/logs" "$storage/framework/sessions" "$storage/framework/views" "$storage/framework/cache/data"

php artisan octane:start --server=frankenphp --host=0.0.0.0 --port=8080 --workers=4 --max-requests=500 &
octane=$!
trap 'kill "$octane" 2>/dev/null' TERM INT

stamp=/tmp/octane-reload.stamp
touch "$stamp"
while kill -0 "$octane" 2>/dev/null; do
    sleep 1
    if [ -n "$(find app bootstrap config routes resources/views -type f -newer "$stamp" -print -quit 2>/dev/null)" ]; then
        touch "$stamp"
        rm -f "$storage"/framework/views/*.php
        php artisan octane:reload >/dev/null 2>&1
    fi
done
wait "$octane"
