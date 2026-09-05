#!/bin/sh
# Remove the Nabatable local CI controller from this Mac. Idempotent.
#
# Unloads and deletes the LaunchAgent, removes the materialised App key file,
# and removes ONLY the "nabatable-ci" Docker context. It never touches the
# default/desktop-linux contexts, never stops or removes containers, and
# leaves the golden VM, the release checkouts, the config, and the Keychain
# items in place unless the matching flag is passed:
#   --delete-vm        limactl delete the golden instance and any leftover
#                      nabatable-ci-* job instances (after limactl stop)
#   --delete-config    remove /Users/nabatable-ci/nabatable-ci/config
# Keychain items are always left for the operator to delete by hand:
#   security delete-generic-password -s '<item>' -a 'nabatable-ci'
set -eu

label='com.nabatable.ci-controller'
account='nabatable-ci'
home_dir="/Users/${account}"
plist_dst="${home_dir}/Library/LaunchAgents/${label}.plist"
delete_vm=0
delete_config=0

for arg in "$@"; do
  case "$arg" in
    --delete-vm) delete_vm=1 ;;
    --delete-config) delete_config=1 ;;
    *)
      echo "uninstall: unknown flag $arg" >&2
      exit 2
      ;;
  esac
done

say() { printf 'uninstall: %s\n' "$*"; }
[ "$(id -u)" -eq 0 ] || {
  echo 'uninstall: run with sudo' >&2
  exit 1
}

if id "$account" >/dev/null 2>&1; then
  uid=$(id -u "$account")
  if launchctl print "gui/${uid}/${label}" >/dev/null 2>&1; then
    launchctl bootout "gui/${uid}/${label}" || true
    say 'agent unloaded'
  else
    say 'agent not loaded'
  fi
else
  say "service account $account absent; skipping launchctl"
fi
if [ -f "$plist_dst" ]; then
  rm -f "$plist_dst"
  say 'plist removed'
else
  say 'plist absent'
fi
rm -f "${home_dir}/nabatable-ci/run/github-app.pem"
say 'materialised App key file removed (if any)'
if id "$account" >/dev/null 2>&1; then
  sudo -u "$account" -H sh -c '
    export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
    if docker context inspect nabatable-ci >/dev/null 2>&1; then
      docker context rm -f nabatable-ci >/dev/null && echo "uninstall: docker context nabatable-ci removed"
    else
      echo "uninstall: docker context nabatable-ci absent"
    fi
  '
  if [ "$delete_vm" -eq 1 ]; then
    sudo -u "$account" -H sh -c '
      export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
      found=0
      for vm in $(limactl list --format "{{.Name}}" 2>/dev/null | grep -E "^nabatable-ci(-golden|-[a-z0-9-]+)?$" || true); do
        found=1
        limactl stop --force "$vm" >/dev/null 2>&1 || true
        limactl delete --force "$vm" && echo "uninstall: VM $vm deleted"
      done
      [ "$found" -eq 1 ] || echo "uninstall: no nabatable-ci VMs present"
    '
  else
    say 'VMs left in place (pass --delete-vm to remove the golden instance and leftover job instances)'
  fi
  if [ "$delete_config" -eq 1 ]; then
    rm -rf "${home_dir}/nabatable-ci/config"
    say 'config removed'
  fi
fi

cat <<'TXT'
uninstall: Keychain items were NOT removed. As the nabatable-ci user run:
  security delete-generic-password -s 'nabatable-ci/github-app/nabatable-local-ci/private-key' -a 'nabatable-ci'
  security delete-generic-password -s 'nabatable-ci/monitoring/heartbeat-token' -a 'nabatable-ci'
  security delete-generic-password -s 'nabatable-ci/r2/evidence/access-key-id' -a 'nabatable-ci'
  security delete-generic-password -s 'nabatable-ci/r2/evidence/secret-access-key' -a 'nabatable-ci'
Revoke the GitHub App installation and the R2 token in their consoles as well.
TXT
