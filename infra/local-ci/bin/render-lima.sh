#!/bin/sh
# Render the golden Lima template for one resource mode.
#
#   render-lima.sh normal     -> 6 vCPU / 16GiB  (shared workstation)
#   render-lima.sh dedicated  -> 10 vCPU / 24GiB (dedicated CI Mac)
#
# Output goes to stdout (or to the path given as second argument). Mode values
# come from bin/vm-mode.sh (which reads infra/local-ci/operating.json) so
# there is a single source of truth for the numbers; this script only
# substitutes them into the template. Portable to macOS /bin/sh and bash 3.2.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
template="$here/../lima/nabatable-ci.yaml"

mode="${1:-}"
out="${2:-}"

case "$mode" in
  normal | dedicated) ;;
  *)
    echo "usage: render-lima.sh <normal|dedicated> [output-path]" >&2
    exit 2
    ;;
esac

cpus=$(sh "$here/vm-mode.sh" "$mode" | sed -n 's/^NABATABLE_CI_LIMA_CPUS=//p')
memory_gib=$(sh "$here/vm-mode.sh" "$mode" | sed -n 's/^NABATABLE_CI_LIMA_MEMORY_GIB=//p')

if [ -z "$cpus" ] || [ -z "$memory_gib" ]; then
  echo "render-lima.sh: vm-mode.sh returned no values for $mode" >&2
  exit 1
fi

render() {
  sed \
    -e "s/^cpus: [0-9][0-9]*\$/cpus: $cpus/" \
    -e "s/^memory: '[0-9A-Za-z]*'\$/memory: '${memory_gib}GiB'/" \
    "$template"
}

if [ -n "$out" ]; then
  render > "$out"
  echo "rendered mode=$mode cpus=$cpus memory=${memory_gib}GiB -> $out"
else
  render
fi
