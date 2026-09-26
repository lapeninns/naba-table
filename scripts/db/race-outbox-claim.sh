#!/usr/bin/env bash
# Concurrency regression for public.claim_capacity_outbox_batch.
#
# N psql sessions call the claim at the same instant over the same committed, due
# capacity_outbox rows. Every row must be handed to exactly one worker (FOR UPDATE
# SKIP LOCKED + claim-in-one-statement). A regression to SELECT-then-UPDATE, or a
# missing SKIP LOCKED, makes rows appear twice or attempt_count exceed 1.
#
# The single-session tests/db/capacity-outbox-claim.sql cannot observe this, so it
# lives here as a script.
#
# LOCAL, DISPOSABLE DATABASES ONLY. The target must already have the repository
# migrations applied (including 20260927160000_booking_side_effect_claims.sql).
#
#   PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres \
#     scripts/db/race-outbox-claim.sh <database> [workers=3] [rounds=5] [rows=50]
#
# The script refuses any host other than 127.0.0.1, localhost, ::1 or a socket
# directory, refuses DATABASE_URL-style targets, and refuses a database that
# already holds due outbox rows it did not create. Its own rows are deleted on exit.
set -euo pipefail

db="${1:-}"
workers="${2:-3}"
rounds="${3:-5}"
rows="${4:-50}"

if [[ -z "$db" ]]; then
  echo "usage: $0 <database> [workers] [rounds] [rows]" >&2
  exit 2
fi
if [[ -n "${DATABASE_URL:-}${SUPABASE_DB_URL:-}${PGSERVICE:-}${PGHOSTADDR:-}" ]]; then
  echo "refusing: unset DATABASE_URL, SUPABASE_DB_URL, PGSERVICE and PGHOSTADDR" >&2
  exit 2
fi
case "${PGHOST:-}" in
  127.0.0.1 | localhost | ::1 | /*) ;;
  *)
    echo "refusing: PGHOST must be a local host or socket directory" >&2
    exit 2
    ;;
esac
for n in "$workers" "$rounds" "$rows"; do
  [[ "$n" =~ ^[1-9][0-9]*$ ]] || { echo "workers, rounds and rows must be positive integers" >&2; exit 2; }
done

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$db")
tag="nt-race-$$-$(date +%s)"
out="$(mktemp -d)"

cleanup() {
  "${PSQL[@]}" -c "DELETE FROM public.capacity_outbox WHERE dedupe_key LIKE '${tag}-%'" >/dev/null 2>&1 || true
  rm -rf "$out"
}
trap cleanup EXIT

foreign_due=$("${PSQL[@]}" -At -c "SELECT count(*) FROM public.capacity_outbox WHERE status IN ('pending','processing')")
if [[ "$foreign_due" != "0" ]]; then
  echo "refusing: $db already has $foreign_due pending/processing outbox rows" >&2
  exit 2
fi

"${PSQL[@]}" -c "
  INSERT INTO public.capacity_outbox (event_type, dedupe_key, payload)
  SELECT 'capacity.assignment.sync', '${tag}-' || g, '{}'::jsonb
  FROM generate_series(1, ${rows}) AS g" >/dev/null

uuid_re='^[0-9a-f-]{36}$'
for round in $(seq 1 "$rounds"); do
  "${PSQL[@]}" -c "
    UPDATE public.capacity_outbox
    SET status = 'pending', next_attempt_at = NULL, attempt_count = 0
    WHERE dedupe_key LIKE '${tag}-%'" >/dev/null
  start_at=$("${PSQL[@]}" -At -c "SELECT extract(epoch FROM clock_timestamp()) + 0.5")
  for i in $(seq 1 "$workers"); do
    "${PSQL[@]}" -At \
      -c "SELECT pg_sleep(greatest(0, ${start_at} - extract(epoch FROM clock_timestamp())))" \
      -c "SELECT id FROM public.claim_capacity_outbox_batch(${rows}, 300)" >"$out/worker.$i" 2>&1 &
  done
  wait
  total=$(cat "$out"/worker.* | grep -cE "$uuid_re" || true)
  unique=$(cat "$out"/worker.* | grep -E "$uuid_re" | sort -u | wc -l | tr -d ' ')
  over=$("${PSQL[@]}" -At -c "
    SELECT count(*) FROM public.capacity_outbox
    WHERE dedupe_key LIKE '${tag}-%' AND attempt_count <> 1")
  echo "round $round: claimed=$total unique=$unique rows_with_attempt_count_ne_1=$over"
  if [[ "$total" != "$rows" || "$unique" != "$rows" || "$over" != "0" ]]; then
    echo "RACE FAIL: a row was claimed more than once or not at all" >&2
    exit 1
  fi
done
echo "RACE PASS: $workers concurrent workers x $rounds rounds, each of $rows rows claimed exactly once"
