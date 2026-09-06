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

log() { printf '%s supervise: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }

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
    sleep "$INTERVAL"
    continue
  fi

  status="$(vm_status)"
  case "$status" in
    Running)
      if ! runner_active; then
        log 'VM is running but the runner service is not active; restarting it'
        "$LIMACTL" shell "$INSTANCE" -- \
          sudo /opt/actions-runner/svc.sh start >/dev/null 2>&1 \
          || log 'failed to restart the runner service'
      fi
      ;;
    '')
      log "instance '$INSTANCE' does not exist; nothing to supervise"
      sleep "$INTERVAL"
      continue
      ;;
    *)
      log "VM status is '${status}'; starting it"
      "$LIMACTL" start "$INSTANCE" --tty=false >/dev/null 2>&1 \
        || log 'failed to start the VM'
      ;;
  esac

  sleep "$INTERVAL"
done
