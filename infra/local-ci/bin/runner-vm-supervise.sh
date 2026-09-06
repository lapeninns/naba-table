#!/usr/bin/env bash
# Keep the nabatable-runner VM and its GitHub Actions runner service alive.
#
# Runs under launchd (see bin/runner-autostart.sh) with KeepAlive, so this
# script is expected to run forever. It addresses three of the recovery gaps
# identified in the CI/CD audit:
#
#   - host reboot          launchd RunAtLoad starts the VM again
#   - VM crash / shutdown  the loop notices Status != Running and restarts it
#   - agent crash          the loop notices the systemd unit is dead and
#                          restarts it, rather than leaving a Running VM that
#                          silently accepts no jobs
#
# It deliberately does NOT reap job workspaces or enforce disk caps; those are
# the runner's own responsibility. It DOES refuse to start the VM when the host
# is low on disk, so a full disk degrades to "no CI" rather than "corrupt CI".
set -uo pipefail

INSTANCE="${NABATABLE_RUNNER_INSTANCE:-nabatable-runner}"
INTERVAL="${NABATABLE_RUNNER_POLL_SECONDS:-60}"
MIN_FREE_GIB="${NABATABLE_RUNNER_MIN_FREE_GIB:-40}"
LIMACTL="${NABATABLE_LIMACTL:-/opt/homebrew/bin/limactl}"

# Dead-man's switch. When set to an uptime provider's heartbeat URL, this is
# pinged ONLY after a fully healthy check (VM running AND agent active). If the
# runner dies, the pings stop and the provider alerts after its grace period.
#
# This matters more than it looks. The runner publishes the seven status checks
# the `main` ruleset requires, so a dead runner does not degrade CI -- it stops
# merges entirely, silently. Nothing else in this repository would tell anyone.
# Set the provider's grace period comfortably above NABATABLE_RUNNER_POLL_SECONDS.
HEARTBEAT_URL="${NABATABLE_RUNNER_HEARTBEAT_URL:-}"

# Local fallback so an unconfigured heartbeat is not silent on the machine
# itself. Set to 0 to suppress the macOS notification.
NOTIFY="${NABATABLE_RUNNER_NOTIFY:-1}"

STATE_FILE="${NABATABLE_RUNNER_STATE_FILE:-$HOME/Library/Logs/nabatable-ci/runner-state.json}"

log() { printf '%s supervise: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }

# Fire a desktop notification, but only when health CHANGES, so a long outage
# does not produce one alert per poll.
notify() {
  [ "$NOTIFY" = '1' ] || return 0
  command -v osascript >/dev/null 2>&1 || return 0
  osascript -e "display notification \"$1\" with title \"Nabatable CI runner\"" \
    >/dev/null 2>&1 || true
}

heartbeat() {
  [ -n "$HEARTBEAT_URL" ] || return 0
  curl --fail --silent --show-error --max-time 10 --retry 2 \
    -o /dev/null "$HEARTBEAT_URL" 2>/dev/null \
    || log 'heartbeat ping failed (the monitor will alert if this persists)'
}

# $1 = healthy|unhealthy, $2 = detail
record() {
  local dir; dir="$(dirname "$STATE_FILE")"
  mkdir -p "$dir" 2>/dev/null || true
  printf '{"state":"%s","detail":"%s","instance":"%s","checkedAt":"%s"}\n' \
    "$1" "$2" "$INSTANCE" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$STATE_FILE" 2>/dev/null || true

  if [ "$1" != "$LAST_STATE" ]; then
    log "health changed: ${LAST_STATE:-unknown} -> $1 ($2)"
    if [ "$1" = 'healthy' ]; then
      [ -n "$LAST_STATE" ] && notify "Runner recovered: $2"
    else
      notify "Runner unhealthy: $2 -- merges requiring its checks will block"
    fi
    LAST_STATE="$1"
  fi
}

LAST_STATE=''

command -v "$LIMACTL" >/dev/null 2>&1 || { log "limactl not found at $LIMACTL"; exit 78; }

free_gib() { df -g / | awk 'NR==2 {print $4}'; }

vm_status() { "$LIMACTL" list --format '{{.Status}}' "$INSTANCE" 2>/dev/null; }

runner_active() {
  "$LIMACTL" shell "$INSTANCE" -- \
    sudo systemctl is-active --quiet 'actions.runner.*' >/dev/null 2>&1
}

log "supervising instance=$INSTANCE interval=${INTERVAL}s min_free=${MIN_FREE_GIB}GiB"

while true; do
  avail="$(free_gib)"

  if [ "${avail:-0}" -lt "$MIN_FREE_GIB" ]; then
    log "host free disk ${avail}GiB is below ${MIN_FREE_GIB}GiB; refusing to start the VM"
    record unhealthy "host disk ${avail}GiB below ${MIN_FREE_GIB}GiB"
    sleep "$INTERVAL"
    continue
  fi

  status="$(vm_status)"
  case "$status" in
    Running)
      if runner_active; then
        # Only a fully healthy cycle sends the heartbeat. A VM that is up but
        # whose agent is dead must NOT look healthy to the monitor: it accepts
        # no jobs, so every required check stays pending forever.
        record healthy 'VM running, agent active'
        heartbeat
      else
        log 'VM is running but the runner service is not active; restarting it'
        record unhealthy 'agent inactive'
        "$LIMACTL" shell "$INSTANCE" -- \
          sudo /opt/actions-runner/svc.sh start >/dev/null 2>&1 \
          || log 'failed to restart the runner service'
      fi
      ;;
    '')
      log "instance '$INSTANCE' does not exist; nothing to supervise"
      record unhealthy "instance '$INSTANCE' does not exist"
      sleep "$INTERVAL"
      continue
      ;;
    *)
      log "VM status is '${status}'; starting it"
      record unhealthy "VM status ${status}"
      "$LIMACTL" start "$INSTANCE" --tty=false >/dev/null 2>&1 \
        || log 'failed to start the VM'
      ;;
  esac

  sleep "$INTERVAL"
done
