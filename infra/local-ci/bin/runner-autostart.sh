#!/usr/bin/env bash
# Install (or remove) the launchd agent that keeps the nabatable-runner VM and
# its GitHub Actions runner alive across logins, reboots and crashes.
#
#   infra/local-ci/bin/runner-autostart.sh install
#   infra/local-ci/bin/runner-autostart.sh uninstall
#   infra/local-ci/bin/runner-autostart.sh status
#
# The agent runs as the logged-in user (not root): starting a Lima VM requires
# the user's own Lima state directory, and running it as root would put the VM
# outside ~/.lima where limactl expects it.
set -euo pipefail

LABEL='com.nabatable.runner-vm'
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SUPERVISOR="$REPO_ROOT/infra/local-ci/bin/runner-vm-supervise.sh"
LOG_DIR="$HOME/Library/Logs/nabatable-ci"
LIMACTL="$(command -v limactl || echo /opt/homebrew/bin/limactl)"

die() { echo "runner-autostart: $*" >&2; exit 1; }

case "${1:-}" in
  install)
    [ -f "$SUPERVISOR" ] || die "supervisor script not found at $SUPERVISOR"
    chmod +x "$SUPERVISOR"
    mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

    cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SUPERVISOR}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NABATABLE_LIMACTL</key>
    <string>${LIMACTL}</string>
    <key>NABATABLE_RUNNER_HEARTBEAT_URL</key>
    <string>${NABATABLE_RUNNER_HEARTBEAT_URL:-}</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/runner-vm.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/runner-vm.log</string>
</dict>
</plist>
PLIST_EOF

    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    launchctl enable "gui/$(id -u)/${LABEL}"
    echo "installed: $PLIST"
    echo "logs:      $LOG_DIR/runner-vm.log"
    ;;

  uninstall)
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    rm -f "$PLIST"
    echo "removed: $PLIST"
    ;;

  status)
    launchctl print "gui/$(id -u)/${LABEL}" 2>/dev/null \
      | grep -E '^\s+(state|pid|last exit code) =' || echo 'not loaded'
    ;;

  *)
    die 'usage: runner-autostart.sh install|uninstall|status'
    ;;
esac
