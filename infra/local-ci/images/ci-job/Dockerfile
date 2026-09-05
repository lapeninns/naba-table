# syntax=docker/dockerfile:1.7
#
# Nabatable CI job image.
#
# Runtime policy: activeRuntime = node22 (matches hosted workflows).
# Candidate: node24 (production Vercel). To qualify the candidate, build with
#   --build-arg NODE_IMAGE_REF=node:24-bookworm-slim \
#   --build-arg NODE_IMAGE_DIGEST=sha256:<pinned digest>
# and run the Phase 2 qualification list in docs/runbooks/local-ci.md before
# switching the default below. Do not flip the default in the same change as
# the package.json engines / workflow node-version flip.
#
# Invariants (asserted by tests/scripts/ci/infra/dockerfile.test.ts):
# - base image is pinned by digest; the REPLACE_ME placeholder is an invalid
#   reference so an unpinned build fails instead of pulling a floating tag
# - no ADD (and no remote URLs); all downloads are explicit RUN steps that go
#   through the egress proxy at build time only
# - no secrets, tokens, or registry credentials are baked in
# - the final stage runs as the non-root user `ci` (uid/gid 1000, the pair the
#   executor passes as `--user`)
#
# Build context should be an empty directory (`docker build -f ... /path/to/empty`)
# so that no repository file can leak into a layer. The build runs inside the
# golden VM (bin/build-base-image.sh), never on the Mac.

ARG NODE_IMAGE_REF=node:22-bookworm-slim
ARG NODE_IMAGE_DIGEST=sha256:REPLACE_ME_NODE_22_BOOKWORM_SLIM_ARM64_DIGEST

FROM ${NODE_IMAGE_REF}@${NODE_IMAGE_DIGEST}

# Keep in lock-step with root package.json:
#   devDependencies["@playwright/test"] and packageManager.
ARG PLAYWRIGHT_VERSION=1.58.1
ARG PNPM_VERSION=10.34.5
ARG CI_UID=1000
ARG CI_GID=1000

ENV DEBIAN_FRONTEND=noninteractive \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    COREPACK_ENABLE_STRICT=1 \
    COREPACK_HOME=/opt/corepack \
    COREPACK_DEFAULT_TO_LATEST=0 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright \
    PNPM_HOME=/opt/pnpm \
    CI=1 \
    UV_USE_IO_URING=0 \
    LANG=C.UTF-8

# Base tooling used by repository scripts (git for the bundle checkout inside
# the job, ca-certificates for the proxy's TLS CONNECT targets, tini as PID 1).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    tini \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

# pnpm via corepack, pinned to the repository packageManager version.
RUN corepack enable \
  && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
  && pnpm --version \
  && chmod -R a+rX,go-w "${COREPACK_HOME}"

# All runtime users share this root-owned cache even when the executor changes HOME.
# Package-manager resolution must not download or update the prepared version.
ENV COREPACK_ENABLE_NETWORK=0

# Chromium system dependencies for exactly the pinned @playwright/test
# version. `install-deps` resolves the package list that this Playwright
# release was validated against, so the list cannot drift from the lockfile.
# Only Chromium is installed; WebKit/Firefox packs are not part of the
# hosted profile either.
RUN npx --yes "playwright@${PLAYWRIGHT_VERSION}" install-deps chromium \
  && rm -rf /var/lib/apt/lists/* /root/.npm

# Non-root job user. The official node image ships a `node` user on 1000:1000;
# it is removed so `ci` can own that pair, which the executor passes as
# `--user 1000:1000` and which gives the workspace volume stable ownership.
RUN userdel --remove node \
  && groupadd --gid "${CI_GID}" ci \
  && useradd --uid "${CI_UID}" --gid ci --create-home --shell /usr/sbin/nologin ci \
  && install -d -m 0755 -o ci -g ci /workspace "${PLAYWRIGHT_BROWSERS_PATH}" /home/ci/.cache

USER ci
WORKDIR /workspace

# Exercise the runtime identity and executor HOME before accepting the image.
RUN test "$(pnpm --version)" = "$PNPM_VERSION" \
  && test "$(HOME=/workspace/.home pnpm --version)" = "$PNPM_VERSION"

# Browser binaries are installed as the job user so no root-owned files sit in
# the browsers path. The version is the same pinned Playwright release.
RUN npx --yes "playwright@${PLAYWRIGHT_VERSION}" install chromium \
  && rm -rf /home/ci/.npm

# Keep additional test tooling after the browser layer so a previously pinned
# image can supply Docker's verified build cache without downloading Chromium again.
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
  && rm -rf /var/lib/apt/lists/*
USER ci

# Marker consumed by the executor to verify it is running the expected image
# generation before it trusts the layer (tuple: runtime + playwright + pnpm).
RUN printf 'activeRuntime=node22\nplaywright=%s\npnpm=%s\n' "${PLAYWRIGHT_VERSION}" "${PNPM_VERSION}" \
  > /home/ci/.nabatable-ci-image

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/bin/bash"]
