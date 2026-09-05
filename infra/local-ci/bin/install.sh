#!/bin/sh
# Install the Nabatable local CI controller on this Mac. Idempotent.
# --current-user explicitly opts into this non-root account and isolated CI assets.
# --no-start stages the current-user agent with automatic startup disabled.
#
# Run as an administrator (sudo) AFTER the service account exists. The script
# never creates accounts, never stores secrets, never touches the default
# Docker context, and never stops containers or VMs. Everything it does can be
# reverted with bin/uninstall.sh.
#
# Steps:
#   1. require the service account (print creation instructions if missing)
#   2. preflight as that account and print Keychain instructions
#   3. create the docker context "nabatable-ci" for the service account
#   4. write the non-secret config template if absent
#   5. install the LaunchAgent into the service account and load it into the
#      account's GUI session if one exists
set -eu

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../.." && pwd)
label='com.nabatable.ci-controller'
account='nabatable-ci'
home_dir="/Users/${account}"
ci_home="${home_dir}/nabatable-ci"
plist_src="$root/infra/local-ci/launchd/${label}.plist"
plist_dst="${home_dir}/Library/LaunchAgents/${label}.plist"

say() { printf 'install: %s\n' "$*"; }
die() {
  printf 'install: %s\n' "$*" >&2
  exit 1
}

account_mode='dedicated'
no_start=0
for arg in "$@"; do
  case "$arg" in
    --current-user) account_mode='current-user' ;;
    --no-start) no_start=1 ;;
    *) die "unknown flag $arg" ;;
  esac
done

if [ "$account_mode" = 'current-user' ]; then
  uid=$(id -u)
  [ "$uid" -ne 0 ] || die '--current-user must not run as root or through sudo'
  account=$(id -un)
  home_dir="${HOME:?HOME is required}"
  ci_home="$home_dir/nabatable-ci"
  plist_dst="$home_dir/Library/LaunchAgents/$label.plist"
  export LIMA_HOME="$ci_home/lima"
  export DOCKER_CONFIG="$ci_home/docker"
  umask 077
  command -v node >/dev/null || die 'Node 22 is required'
  [ -f "$plist_src" ] || die "plist missing at $plist_src"

  # Validate every managed path before mutation. The reviewed release is read-only
  # to this installer: it must already exist under releases and be linked as current.
  node - "$home_dir" "$uid" <<'CHECK_CURRENT_PATHS' || die 'unsafe current-user paths or missing reviewed current release'
const fs = require('node:fs');
const path = require('node:path');
const [home, owner] = process.argv.slice(2);
const uid = Number(owner);
if (!path.isAbsolute(home) || /[\r\n]/.test(home) || uid !== process.getuid()) process.exit(1);
const homeStat = fs.lstatSync(home);
if (!homeStat.isDirectory() || homeStat.isSymbolicLink() || homeStat.uid !== uid) process.exit(1);
const managed = ['nabatable-ci', 'nabatable-ci/config', 'nabatable-ci/config/controller.env', 'nabatable-ci/releases', 'nabatable-ci/run', 'nabatable-ci/images', 'nabatable-ci/spool', 'nabatable-ci/jobs', 'nabatable-ci/lima', 'nabatable-ci/docker', 'Library/LaunchAgents', 'Library/LaunchAgents/com.nabatable.ci-controller.plist', 'Library/Logs/nabatable-ci'];
for (const relative of managed) {
  let target = home;
  for (const segment of relative.split('/')) {
    target = path.join(target, segment);
    if (!fs.existsSync(target) && !fs.lstatSync(target, { throwIfNoEntry: false })) continue;
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || stat.uid !== uid) process.exit(1);
  }
}
const current = path.join(home, 'nabatable-ci/current');
if (!fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) process.exit(1);
const release = fs.realpathSync(current);
const releases = fs.realpathSync(path.join(home, 'nabatable-ci/releases'));
if (!release.startsWith(releases + path.sep) || fs.statSync(release).uid !== uid) process.exit(1);
for (const file of ['package.json', 'infra/local-ci/bin/controller.sh']) {
  const target = path.join(release, file);
  if (!fs.statSync(target).isFile() || !fs.realpathSync(target).startsWith(release + path.sep)) process.exit(1);
}
CHECK_CURRENT_PATHS
  sh "$here/preflight.sh" || die 'preflight failed; fix the FAIL lines above and re-run'
  mkdir -p "$ci_home/config" "$ci_home/releases" "$ci_home/run" "$ci_home/images" "$ci_home/spool" "$ci_home/jobs" "$ci_home/lima" "$ci_home/docker" "$home_dir/Library/Logs/nabatable-ci" "$home_dir/Library/LaunchAgents"
  chmod 700 "$ci_home" "$ci_home/run" "$ci_home/lima" "$ci_home/docker"
  if ! docker context inspect nabatable-ci >/dev/null 2>&1; then
    docker context create nabatable-ci --description 'Nabatable local CI (rebound per job by the executor)' --docker 'host=unix:///var/empty/nabatable-ci-unbound.sock' >/dev/null
  fi
  config="$ci_home/config/controller.env"
  if [ ! -f "$config" ]; then
    # Reuse the dedicated template; quote path values as data, never shell source.
    node - "$0" "$config" "$ci_home" <<'WRITE_CURRENT_CONFIG'
const fs = require('node:fs');
const [source, config, ciHome] = process.argv.slice(2);
const template = fs.readFileSync(source, 'utf8').match(/<<'ENV'\n([\s\S]*?)\nENV\n/)[1];
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const rendered = template.split('\n').map(line => {
  const prefix = '/Users/nabatable-ci/nabatable-ci';
  const equal = line.indexOf('=');
  if (equal < 0 || !line.slice(equal + 1).startsWith(prefix)) return line;
  return line.slice(0, equal + 1) + quote(ciHome + line.slice(equal + 1 + prefix.length));
}).join('\n') + '\n';
fs.writeFileSync(config, rendered, { mode: 0o600, flag: 'wx' });
WRITE_CURRENT_CONFIG
    say "wrote non-secret template $config; replace placeholders before starting"
  fi
  temporary_plist=$(mktemp "$ci_home/run/agent.XXXXXX")
  trap 'rm -f "$temporary_plist"' EXIT HUP INT TERM
  cp "$plist_src" "$temporary_plist"
  plutil -replace ProgramArguments.1 -string "$ci_home/current/infra/local-ci/bin/controller.sh" "$temporary_plist"
  plutil -replace WorkingDirectory -string "$ci_home/current" "$temporary_plist"
  plutil -replace EnvironmentVariables.HOME -string "$home_dir" "$temporary_plist"
  plutil -replace EnvironmentVariables.NABATABLE_CI_HOME -string "$ci_home" "$temporary_plist"
  plutil -insert EnvironmentVariables.NABATABLE_CI_ACCOUNT_MODE -string current-user "$temporary_plist"
  plutil -insert EnvironmentVariables.NABATABLE_CI_OWNER_UID -string "$uid" "$temporary_plist"
  plutil -insert EnvironmentVariables.LIMA_HOME -string "$ci_home/lima" "$temporary_plist"
  plutil -insert EnvironmentVariables.DOCKER_CONFIG -string "$ci_home/docker" "$temporary_plist"
  plutil -replace StandardOutPath -string "$home_dir/Library/Logs/nabatable-ci/controller.log" "$temporary_plist"
  plutil -replace StandardErrorPath -string "$home_dir/Library/Logs/nabatable-ci/controller.err.log" "$temporary_plist"
  if [ "$no_start" -eq 1 ]; then
    plutil -replace RunAtLoad -bool false "$temporary_plist"
    plutil -replace KeepAlive -bool false "$temporary_plist"
  fi
  plutil -lint "$temporary_plist" >/dev/null || die 'rendered plist failed validation'
  cp "$temporary_plist" "$plist_dst"
  chmod 600 "$plist_dst"
  if [ "$no_start" -eq 1 ]; then
    say 'staged with RunAtLoad=false and KeepAlive=false; no agent was started (an already loaded agent is unchanged)'
  elif launchctl print "gui/$uid" >/dev/null 2>&1; then
    if launchctl print "gui/$uid/$label" >/dev/null 2>&1; then
      # kickstart reuses the loaded definition, including KeepAlive=false from
      # a staged install. Reload so activation applies the newly rendered plist.
      launchctl bootout "gui/$uid/$label"
    fi
    launchctl bootstrap "gui/$uid" "$plist_dst"
  else
    say 'no GUI session; the agent will load at the next login'
  fi
  say "current-user assets installed under $ci_home; credentials were not read or changed"
  exit 0
fi

[ "$(id -u)" -eq 0 ] || die 'run with sudo (writes into the service account home)'
[ -f "$plist_src" ] || die "plist missing at $plist_src"

if ! id "$account" >/dev/null 2>&1; then
  cat <<TXT

install: service account "$account" does not exist. Create it as an administrator, then re-run:

  sudo sysadminctl -addUser $account -fullName "Nabatable CI" -home $home_dir -shell /bin/zsh -password -
  sudo createhomedir -c -u $account
  # Standard (non-admin) account; do not add it to the admin group.
  # Give it a secure token / FileVault enablement so it can unlock the disk after a cold boot:
  #   sudo sysadminctl -secureTokenOn $account -password - -adminUser <admin> -adminPassword -
  #   sudo fdesetup add -usertoadd $account
  # Log in once as $account in a GUI session so its login Keychain is created,
  # then install its account-local pnpm shim as described in docs/runbooks/local-ci.md.

TXT
  exit 1
fi
uid=$(id -u "$account")
say "service account $account present (uid $uid)"

# Check the account that will own the VMs, not root's disk/tool configuration.
# This is the same fixed PATH used by controller.sh (Node 22 + account-local pnpm).
say 'running preflight as the service account'
if ! sudo -u "$account" -H env \
  PATH='/opt/homebrew/opt/node@22/bin:/Users/nabatable-ci/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' \
  sh "$here/preflight.sh"; then
  die 'preflight failed; fix the FAIL lines above and re-run'
fi

cat <<TXT

install: Keychain items (create as the $account user in its own login session; values are prompted, never passed on the command line):

  # GitHub App nabatable-local-ci private key. The controller accepts the PEM verbatim or
  # as single-line base64; the prompt takes one line, so:
  #   base64 < nabatable-local-ci.private-key.pem | pbcopy   (paste at the prompt)
  security add-generic-password -s 'nabatable-ci/github-app/nabatable-local-ci/private-key' -a '$account' -w
  # Controller heartbeat bearer token (ops:verify):
  security add-generic-password -s 'nabatable-ci/monitoring/heartbeat-token' -a '$account' -w
  # R2 evidence bucket credentials (write-only token):
  security add-generic-password -s 'nabatable-ci/r2/evidence/access-key-id' -a '$account' -w
  security add-generic-password -s 'nabatable-ci/r2/evidence/secret-access-key' -a '$account' -w

TXT

# Docker context for the service account. The executor re-points this context
# at each disposable instance's forwarded docker socket; the default and
# desktop-linux contexts are never modified.
say 'ensuring docker context nabatable-ci for the service account'
sudo -u "$account" -H sh -c '
  set -eu
  export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
  if docker context inspect nabatable-ci >/dev/null 2>&1; then
    echo "install:   docker context nabatable-ci already exists (unchanged)"
  else
    docker context create nabatable-ci --description "Nabatable local CI (rebound per job by the executor)" --docker "host=unix:///var/empty/nabatable-ci-unbound.sock" >/dev/null
    echo "install:   docker context nabatable-ci created (unbound until a job starts)"
  fi
'

say 'ensuring config, run, spool, job, image, and log directories'
sudo -u "$account" -H mkdir -p "$ci_home/config" "$ci_home/releases" "$ci_home/images" "$ci_home/spool" "$ci_home/jobs" "$home_dir/Library/Logs/nabatable-ci" "$home_dir/Library/LaunchAgents"
sudo -u "$account" -H sh -c "mkdir -p '$ci_home/run' && chmod 700 '$ci_home/run'"
config="$ci_home/config/controller.env"
if [ ! -f "$config" ]; then
  sudo -u "$account" -H sh -c "cat > '$config'" <<'ENV'
# Non-secret controller + executor settings. Secrets live in the login Keychain
# (see bin/install.sh output). Replace every REPLACE_ME before starting;
# controller.sh refuses to start while placeholders remain or any line looks
# like a secret. Variable names are the ones scripts/ci/controller/main.ts and
# scripts/ci/executor/config.ts read.

# GitHub App nabatable-local-ci and repository identity (fail-closed checks;
# names from scripts/ci/controller/main.ts ENV and scripts/ci/executor/config.ts).
NABATABLE_LOCAL_CI_APP_ID=REPLACE_ME_LOCAL_CI_APP_ID
NABATABLE_LOCAL_CI_INSTALLATION_ID=REPLACE_ME_LOCAL_CI_INSTALLATION_ID
NABATABLE_CI_REPOSITORY=REPLACE_ME_OWNER/REPLACE_ME_REPO
NABATABLE_CI_REPOSITORY_ID=REPLACE_ME_REPOSITORY_ID
NABATABLE_CI_SOURCE_REMOTE_URL=https://github.com/REPLACE_ME_OWNER/REPLACE_ME_REPO.git
NABATABLE_CI_POLICY_VERSION=REPLACE_ME_POLICY_VERSION

# Golden base image and job image (both printed by bin/build-base-image.sh).
# NABATABLE_CI_IMAGE_DIGEST is stamped into every request tuple by the
# controller and must be the job image digest (the sha256 in
# NABATABLE_CI_JOB_IMAGE); the executor rejects requests whose imageDigest
# differs. The golden disk digest is verified separately before every clone.
NABATABLE_CI_BASE_IMAGE_PATH=/Users/nabatable-ci/nabatable-ci/images/REPLACE_ME_GOLDEN_IMAGE.qcow2
NABATABLE_CI_BASE_IMAGE_DIGEST=sha256:REPLACE_ME_GOLDEN_IMAGE_DIGEST
NABATABLE_CI_JOB_IMAGE=ci-registry.local/nabatable/ci-job@sha256:REPLACE_ME_JOB_IMAGE_DIGEST
NABATABLE_CI_IMAGE_DIGEST=sha256:REPLACE_ME_JOB_IMAGE_DIGEST

# Evidence (R2). Credentials come from Keychain items nabatable-ci/r2/evidence/*.
NABATABLE_CI_R2_ENDPOINT=https://REPLACE_ME_ACCOUNT.r2.cloudflarestorage.com
NABATABLE_CI_R2_BUCKET=REPLACE_ME_R2_EVIDENCE_BUCKET

# Heartbeat endpoint on the operational-control Worker.
NABATABLE_CI_HEARTBEAT_URL=https://REPLACE_ME_OPERATIONAL_CONTROL_HOST/heartbeat

# Local paths and VM mode (normal | dedicated; resources resolved from
# infra/local-ci/operating.json by bin/vm-mode.sh).
NABATABLE_CI_SPOOL_ROOT=/Users/nabatable-ci/nabatable-ci/spool
NABATABLE_CI_JOB_ROOT=/Users/nabatable-ci/nabatable-ci/jobs
NABATABLE_CI_WORKSPACE=/Users/nabatable-ci/nabatable-ci
NABATABLE_CI_VM_MODE=normal
ENV
  chmod 600 "$config"
  say "wrote config template $config (fill in REPLACE_ME values)"
else
  say "config present at $config (unchanged)"
fi

if [ ! -e "$ci_home/current" ]; then
  say "NOTE: $ci_home/current does not exist yet. Check out the reviewed release under $ci_home/releases/<tag> and symlink it (runbook: Updates)."
fi

say 'installing LaunchAgent'
if [ -f "$plist_dst" ] && cmp -s "$plist_src" "$plist_dst"; then
  say '  plist unchanged'
else
  install -o "$account" -g staff -m 0644 "$plist_src" "$plist_dst"
  say '  plist installed'
fi
plutil -lint "$plist_dst" >/dev/null || die 'installed plist failed plutil -lint'

if [ "$no_start" -eq 1 ]; then
  say 'agent not started (--no-start); dedicated template still auto-loads at next login'
elif launchctl print "gui/${uid}" >/dev/null 2>&1; then
  if launchctl print "gui/${uid}/${label}" >/dev/null 2>&1; then
    say '  agent already loaded; kickstarting so the new wrapper/config is picked up'
    launchctl kickstart -k "gui/${uid}/${label}"
  else
    launchctl bootstrap "gui/${uid}" "$plist_dst"
    say '  agent bootstrapped into the nabatable-ci session'
  fi
else
  say "  no GUI session for $account right now: the agent loads automatically at that account's next login (fast user switching), or run 'sudo launchctl bootstrap gui/${uid} $plist_dst' once it is logged in"
fi
say "done. Tail ${home_dir}/Library/Logs/nabatable-ci/controller.err.log for startup errors."
