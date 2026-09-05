#!/bin/sh
# Resolve one VM resource mode from infra/local-ci/operating.json.
#
#   vm-mode.sh normal      -> NABATABLE_CI_LIMA_CPUS=6
#                             NABATABLE_CI_LIMA_MEMORY_GIB=16
#                             NABATABLE_CI_LIMA_DISK_GIB=120
#   vm-mode.sh dedicated   -> 10 / 24 / 120
#
# Output is `KEY=value` lines that the controller wrapper (bin/controller.sh)
# exports for the executor and that bin/render-lima.sh substitutes into the
# golden template. operating.json is the single source of truth for the
# numbers; this script only reads it. Portable to macOS /bin/sh (bash 3.2).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
operating="${NABATABLE_CI_OPERATING_JSON:-$here/../operating.json}"

mode="${1:-}"
case "$mode" in
  normal | dedicated) ;;
  *)
    echo 'usage: vm-mode.sh <normal|dedicated>' >&2
    exit 2
    ;;
esac
[ -r "$operating" ] || {
  echo "vm-mode.sh: operating.json not readable at $operating" >&2
  exit 1
}

# Minimal JSON extraction without jq: the operating file is formatted by
# prettier, one scalar per line, so a line-anchored match is reliable here and
# is asserted by tests/scripts/ci/infra/operating-config.test.ts.
# Only the object under vm.modes starts with `"<mode>": {`.
mode_block=$(awk -v m="\"$mode\":" '
  $1 == m && $2 == "{" { inblock = 1 }
  inblock { print }
  inblock && /}/ { exit }
' "$operating")
cpus=$(printf '%s\n' "$mode_block" | sed -n 's/.*"cpus": *\([0-9][0-9]*\).*/\1/p' | head -n 1)
memory_gib=$(printf '%s\n' "$mode_block" | sed -n 's/.*"memory": *"\([0-9][0-9]*\)GiB".*/\1/p' | head -n 1)
disk_gib=$(sed -n 's/^ *"disk": *"\([0-9][0-9]*\)GiB",*$/\1/p' "$operating" | head -n 1)

for pair in "cpus=$cpus" "memory=$memory_gib" "disk=$disk_gib"; do
  value=${pair#*=}
  case "$value" in
    '' | *[!0-9]*)
      echo "vm-mode.sh: could not read vm.modes.$mode / vm.disk (${pair%%=*}) from $operating" >&2
      exit 1
      ;;
  esac
done

printf 'NABATABLE_CI_LIMA_CPUS=%s\n' "$cpus"
printf 'NABATABLE_CI_LIMA_MEMORY_GIB=%s\n' "$memory_gib"
printf 'NABATABLE_CI_LIMA_DISK_GIB=%s\n' "$disk_gib"
