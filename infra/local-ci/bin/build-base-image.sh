#!/bin/sh
# Build and export the golden base image that every disposable CI job
# instance is cloned from (see scripts/ci/executor/lima/instance.ts).
#
#   build-base-image.sh [--mode normal|dedicated] [--out <dir>] [--keep-instance] [--plan]
#
# Steps (each printed by --plan without executing anything):
#   1. refuse while any REPLACE_ME placeholder remains in the template, the
#      Dockerfile digest, or the registry digest (fail closed)
#   2. render the golden template for the mode and create/start the
#      nabatable-ci-golden instance (provisioning installs Docker Engine,
#      nftables, tinyproxy; see lima/nabatable-ci.yaml)
#   3. bin/sync-vm-config.sh: seccomp profile, egress policy, proxy config
#   4. build the job image inside the guest through the loopback proxy, give
#      it a RepoDigest via a throwaway local registry, and record the digest
#   5. stop the instance and flatten its disk into <out>/nabatable-ci-golden-<stamp>.qcow2
#   6. print the sha256 digest and the controller.env lines to set
#
# Required on the Mac: limactl, qemu-img (brew install lima qemu). Required
# environment (no defaults; placeholders are rejected):
#   NABATABLE_CI_NODE_IMAGE_DIGEST      sha256:<64 hex> of node:22-bookworm-slim (arm64)
#   NABATABLE_CI_REGISTRY_IMAGE_DIGEST  sha256:<64 hex> of the registry:2 image (arm64)
# Runs as the nabatable-ci service account; the same account must later run
# the controller because Lima names the guest user after the host user and
# the golden image bakes that user's docker group membership and spool dir.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../.." && pwd)
template="$root/infra/local-ci/lima/nabatable-ci.yaml"
dockerfile="$root/infra/local-ci/images/ci-job/Dockerfile"
golden='nabatable-ci-golden'
image_repo='ci-registry.local/nabatable/ci-job'

mode='normal'
out_dir="${HOME}/nabatable-ci/images"
keep_instance=0
plan=0

usage() {
  echo 'usage: build-base-image.sh [--mode normal|dedicated] [--out <dir>] [--keep-instance] [--plan]' >&2
  exit 2
}
while [ $# -gt 0 ]; do
  case "$1" in
    --mode)
      [ $# -ge 2 ] || usage
      mode="$2"
      shift 2
      ;;
    --out)
      [ $# -ge 2 ] || usage
      out_dir="$2"
      shift 2
      ;;
    --keep-instance)
      keep_instance=1
      shift
      ;;
    --plan)
      plan=1
      shift
      ;;
    *) usage ;;
  esac
done
case "$mode" in
  normal | dedicated) ;;
  *) usage ;;
esac

say() { printf 'build-base-image: %s\n' "$*"; }
die() {
  printf 'build-base-image: %s\n' "$*" >&2
  exit 1
}
is_digest() {
  printf '%s' "$1" | grep -Eq '^sha256:[0-9a-f]{64}$'
}

node_digest="${NABATABLE_CI_NODE_IMAGE_DIGEST:-sha256:REPLACE_ME_NODE_22_BOOKWORM_SLIM_ARM64_DIGEST}"
registry_digest="${NABATABLE_CI_REGISTRY_IMAGE_DIGEST:-sha256:REPLACE_ME_REGISTRY_2_ARM64_DIGEST}"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
out_file="$out_dir/${golden}-${stamp}.qcow2"
lima_home="${LIMA_HOME:-$HOME/.lima}"

# 1. fail-closed configuration check
problems=''
add_problem() { problems="${problems}
  - $1"; }
grep -Eq '^[[:space:]]*(- location:|digest:|DOCKER_CE_VERSION=).*REPLACE_ME' "$template" && add_problem 'lima/nabatable-ci.yaml still contains REPLACE_ME placeholders (Ubuntu release date/digest, docker-ce version)'
is_digest "$node_digest" || add_problem 'NABATABLE_CI_NODE_IMAGE_DIGEST must be sha256:<64 hex> (node:22-bookworm-slim arm64)'
is_digest "$registry_digest" || add_problem 'NABATABLE_CI_REGISTRY_IMAGE_DIGEST must be sha256:<64 hex> (registry:2 arm64)'
command -v limactl >/dev/null 2>&1 || add_problem 'limactl not found (brew install lima)'
command -v qemu-img >/dev/null 2>&1 || add_problem 'qemu-img not found (brew install qemu)'
[ "$(id -un)" = 'nabatable-ci' ] || add_problem "must run as the nabatable-ci service account (got $(id -un))"

if [ "$plan" -eq 1 ]; then
  cat <<PLAN
build-base-image plan (mode=$mode, nothing executed)
  golden instance: $golden
  template:        $(basename "$template") rendered via bin/render-lima.sh $mode
  job image:       $image_repo (Dockerfile $(basename "$dockerfile"), base digest $node_digest)
  registry image:  registry@$registry_digest (loopback only, removed after push/pull)
  output:          $out_dir/${golden}-<stamp>.qcow2 + sha256 digest
  steps:
    1. render template          -> bin/render-lima.sh $mode
    2. create + start instance  -> limactl create --tty=false --name=$golden <rendered>; limactl start --tty=false $golden
    3. sync guest config        -> bin/sync-vm-config.sh $golden
    4. build job image in guest -> limactl copy Dockerfile; docker build --network=host (proxy 127.0.0.1:8888); push/pull via ci-registry.local; docker builder prune
    5. stop + export            -> limactl stop $golden; qemu-img convert -O qcow2 -c <diffdisk> <output>
    6. digest + env lines       -> shasum -a 256 <output>; NABATABLE_CI_IMAGE_DIGEST = job image digest
PLAN
  if [ -n "$problems" ]; then
    printf 'UNCONFIGURED: a real run would refuse because:%s\n' "$problems"
  fi
  exit 0
fi

[ -z "$problems" ] || die "refusing to build:$problems"

# 2. render + create + start
work=$(mktemp -d "${TMPDIR:-/tmp}/nabatable-ci-golden.XXXXXX")
rendered="$work/${golden}.yaml"
sh "$here/render-lima.sh" "$mode" "$rendered" >/dev/null
if limactl list --format '{{.Name}}' 2>/dev/null | grep -qx "$golden"; then
  die "instance $golden already exists; delete it first (limactl delete --force $golden) so the build starts from the pinned image"
fi
say "creating $golden (mode $mode)"
limactl create --tty=false "--name=${golden}" "$rendered"
limactl start --tty=false "$golden"

# 3. guest config
sh "$here/sync-vm-config.sh" "$golden"

# 4. job image (built inside the guest; the Mac never runs docker build)
say 'building job image inside the guest'
limactl shell "$golden" -- mkdir -p /tmp/ci-job/empty
limactl copy "$dockerfile" "${golden}:/tmp/ci-job/Dockerfile"
job_image=$(limactl shell "$golden" -- sudo sh -c "
  set -eu
  docker run --detach --name ci-registry --publish 127.0.0.1:80:5000 'registry@${registry_digest}' >/dev/null
  docker build --network=host \
    --build-arg HTTP_PROXY=http://127.0.0.1:8888 --build-arg HTTPS_PROXY=http://127.0.0.1:8888 \
    --build-arg http_proxy=http://127.0.0.1:8888 --build-arg https_proxy=http://127.0.0.1:8888 \
    --build-arg NODE_IMAGE_DIGEST='${node_digest}' \
    --tag '${image_repo}:build' --file /tmp/ci-job/Dockerfile /tmp/ci-job/empty >/dev/null
  docker push '${image_repo}:build' >/dev/null
  digest=\$(docker image inspect --format '{{index .RepoDigests 0}}' '${image_repo}:build')
  docker image rm '${image_repo}:build' >/dev/null
  docker pull \"\$digest\" >/dev/null
  docker rm --force ci-registry >/dev/null
  docker image rm 'registry@${registry_digest}' >/dev/null 2>&1 || true
  docker builder prune --all --force >/dev/null
  rm -rf /tmp/ci-job
  printf '%s\n' \"\$digest\"
" | tr -d '\r' | tail -n 1)
case "$job_image" in
  "${image_repo}@sha256:"*) ;;
  *) die "job image digest capture failed (got '$job_image')" ;;
esac
say "job image: $job_image"

# 5. stop + export
say "stopping $golden and exporting its disk"
limactl stop "$golden"
mkdir -p "$out_dir"
diffdisk="$lima_home/$golden/diffdisk"
[ -f "$diffdisk" ] || die "expected disk at $diffdisk"
qemu-img convert -O qcow2 -c "$diffdisk" "$out_file"
chmod 600 "$out_file"
if [ "$keep_instance" -eq 0 ]; then
  limactl delete --force "$golden"
fi
rm -rf "$work"

# 6. digests. The request tuple's imageDigest is the JOB image digest
#    (NABATABLE_CI_IMAGE_DIGEST, stamped by the controller and checked by the
#    executor); the golden disk digest is verified separately before cloning.
digest=$(shasum -a 256 "$out_file" | awk '{print $1}')
job_digest=${job_image#*@}
cat <<TXT

build-base-image: done
  NABATABLE_CI_BASE_IMAGE_PATH=$out_file
  NABATABLE_CI_BASE_IMAGE_DIGEST=sha256:$digest
  NABATABLE_CI_JOB_IMAGE=$job_image
  NABATABLE_CI_IMAGE_DIGEST=$job_digest
Set these in ~/nabatable-ci/config/controller.env, keep the previous image until
the new one has passed one operating window, then remove it.
TXT
