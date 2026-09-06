#!/usr/bin/env bash
# Register the GitHub Actions self-hosted runner inside the nabatable-runner
# Lima VM and install it as a systemd service.
#
# Runs on the macOS HOST. The host's `gh` credential never enters the guest:
# this script exchanges it for a short-lived registration token (valid ~1 hour,
# consumed on use) and passes only that into the VM over Lima's SSH channel.
#
# Usage:
#   infra/local-ci/bin/runner-install.sh [--ephemeral] [--reconfigure]
#
#   --ephemeral    Register the runner to unregister itself after a single job.
#                  Stronger job-to-job isolation, but the systemd service exits
#                  after each job and must be re-registered, so this is only
#                  useful together with an external re-registration loop.
#                  Not the default; see the isolation note in
#                  infra/local-ci/lima/nabatable-runner.yaml.
#   --reconfigure  Remove an existing runner registration first.
#
# Prerequisites: `limactl` and `gh` on the host, VM `nabatable-runner` running,
# `gh auth status` showing an account with admin rights on the repository.
set -euo pipefail

REPO="${NABATABLE_RUNNER_REPO:-lapeninns/nabatable}"
INSTANCE="${NABATABLE_RUNNER_INSTANCE:-nabatable-runner}"
RUNNER_VERSION="${NABATABLE_RUNNER_VERSION:-2.337.0}"
RUNNER_SHA256="${NABATABLE_RUNNER_SHA256:-9b1dc70626422526e3c94767cf024896beb15da5342a3f4819bf2feac13e0393}"
RUNNER_LABELS="${NABATABLE_RUNNER_LABELS:-nabatable}"
RUNNER_NAME="${NABATABLE_RUNNER_NAME:-nabatable-mac-01}"
RUNNER_DIR='/opt/actions-runner'

EPHEMERAL=0
RECONFIGURE=0
for arg in "$@"; do
  case "$arg" in
    --ephemeral) EPHEMERAL=1 ;;
    --reconfigure) RECONFIGURE=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

die() { echo "runner-install: $*" >&2; exit 1; }
step() { printf '\n== %s\n' "$*"; }

command -v limactl >/dev/null || die 'limactl not found on PATH'
command -v gh >/dev/null || die 'gh not found on PATH'

[ "$(limactl list --format '{{.Status}}' "$INSTANCE" 2>/dev/null)" = 'Running' ] \
  || die "Lima instance '$INSTANCE' is not running (limactl start $INSTANCE)"

in_vm() { limactl shell "$INSTANCE" -- sudo bash -c "$1"; }

step "Verifying repository admin access to $REPO"
gh api "/repos/$REPO" -q '.permissions.admin' | grep -qx true \
  || die "the active gh account lacks admin on $REPO (needed to register a runner)"

step 'Installing the runner agent in the VM (download + checksum verify)'
in_vm "
  set -euo pipefail
  cd '$RUNNER_DIR'
  if [ ! -x ./run.sh ]; then
    tarball=\"actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz\"
    curl -fsSL -o \"\$tarball\" \
      'https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz'
    echo '${RUNNER_SHA256}  '\"\$tarball\" | sha256sum -c -
    tar xzf \"\$tarball\"
    rm -f \"\$tarball\"
    chown -R runner:runner '$RUNNER_DIR'
  else
    echo 'runner agent already extracted; skipping download'
  fi
"

if [ "$RECONFIGURE" -eq 1 ]; then
  step 'Removing the existing registration'
  REMOVE_TOKEN="$(gh api -X POST "/repos/$REPO/actions/runners/remove-token" -q .token)"
  in_vm "
    set -euo pipefail
    cd '$RUNNER_DIR'
    ./svc.sh stop || true
    ./svc.sh uninstall || true
    sudo -u runner ./config.sh remove --token '$REMOVE_TOKEN' || true
  "
  unset REMOVE_TOKEN
fi

step 'Requesting a short-lived registration token'
REG_TOKEN="$(gh api -X POST "/repos/$REPO/actions/runners/registration-token" -q .token)"
[ -n "$REG_TOKEN" ] || die 'failed to obtain a registration token'

CONFIG_FLAGS="--unattended --replace --url https://github.com/$REPO --token $REG_TOKEN"
CONFIG_FLAGS="$CONFIG_FLAGS --name $RUNNER_NAME --labels $RUNNER_LABELS --work _work"
[ "$EPHEMERAL" -eq 1 ] && CONFIG_FLAGS="$CONFIG_FLAGS --ephemeral"

step "Registering runner '$RUNNER_NAME' with labels: self-hosted, Linux, ARM64, $RUNNER_LABELS"
in_vm "
  set -euo pipefail
  cd '$RUNNER_DIR'
  sudo -u runner ./config.sh $CONFIG_FLAGS
"
unset REG_TOKEN

step 'Installing the systemd service (starts on boot, restarts on crash)'
in_vm "
  set -euo pipefail
  cd '$RUNNER_DIR'
  ./svc.sh install runner
  ./svc.sh start
  sleep 3
  ./svc.sh status || true
"

step 'Confirming registration with GitHub'
gh api "/repos/$REPO/actions/runners" \
  -q '.runners[] | "\(.name)  status=\(.status)  busy=\(.busy)  labels=\([.labels[].name]|join(","))"'

cat <<'DONE'

Runner installed.

  Logs      limactl shell nabatable-runner -- sudo journalctl -u 'actions.runner.*' -f
  Restart   limactl shell nabatable-runner -- sudo /opt/actions-runner/svc.sh restart
  Remove    infra/local-ci/bin/runner-install.sh --reconfigure

The VM must be running for the runner to pick up jobs. Autostart on login is
installed separately by infra/local-ci/bin/runner-autostart.sh.
DONE
