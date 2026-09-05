# Local CI job images

The job image (`ci-job/Dockerfile`) is the only environment CI requests execute
in. It is built inside the golden `nabatable-ci-golden` VM by
`bin/build-base-image.sh`, never on the Mac, and is baked into the golden
image so that every disposable job instance already holds it. The executor
runs it only as a digest-pinned reference
(`ci-registry.local/nabatable/ci-job@sha256:<digest>`, `NABATABLE_CI_JOB_IMAGE`).

## Layers

| Layer       | Content                                                                | Lifetime                                   |
| ----------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| Base        | `node:22-bookworm-slim@sha256:<digest>` (activeRuntime `node22`)       | Until a reviewed release re-pins it        |
| Job image   | pnpm 10.34.5 via corepack, Playwright 1.58.1 Chromium deps, user `ci`  | Rebuilt with the golden image              |
| Seed cache  | `pnpm store` for one lockfile (design below; not yet used by executor) | Rebuilt when the cache key changes         |
| Job overlay | `<jobId>-workspace` volume: source checkout, `node_modules`, artefacts | One request; removed with the job instance |

`candidateRuntime` is `node24`. It is built with the same Dockerfile by
overriding `NODE_IMAGE_REF`/`NODE_IMAGE_DIGEST` and is only ever used for the
qualification runs listed in `docs/runbooks/local-ci.md` until the switch is
made in a reviewed release.

## Why a local registry alias

Docker resolves `name@sha256:<digest>` through an image's RepoDigests, which a
plain `docker build` does not create. `build-base-image.sh` therefore starts a
throwaway `registry` container bound to `127.0.0.1:80` inside the golden VM,
pushes the freshly built image to `ci-registry.local/nabatable/ci-job`, pulls
it back by digest, and stops the registry. The image then has a RepoDigest that
every clone of the golden image can run offline; `ci-registry.local` resolves
to loopback in the guest and is never a network service during jobs.

## Seed cache key

The seed cache is a Docker volume whose name is derived from a key the
executor computes before it starts a request:

```
seed:<sha256(pnpm-lock.yaml)>:<runtime>:<arch>:<base image digest>
```

- `sha256(pnpm-lock.yaml)` — hash of the lockfile at `testedSha`, not the PR
  head, so the synthetic merge result is what gets cached.
- `runtime` — `node22` or `node24` (from the image marker file
  `/home/ci/.nabatable-ci-image`).
- `arch` — `arm64` today; the key changes if the VM architecture ever changes.
- `base image digest` — the digest used in `FROM`, so a base re-pin always
  invalidates the seed.

If any component is unknown or the marker file is missing, the executor
refuses to reuse a seed and builds a fresh one (fail closed, never guess).

Status: the executor currently runs `pnpm install --frozen-lockfile` through
the proxy in its `prepare` step on every request. Seeds are an optimisation
that can only be produced by a dedicated executor seed step (never by a
request's own commands) and are mounted `:ro` into jobs when introduced.

## Disposable overlays

Every request gets, from the executor (`scripts/ci/executor/docker/command.ts`):

- a fresh container from the job image (`--read-only` root filesystem, tmpfs
  `/tmp` with `noexec,nosuid,nodev`, seccomp profile `seccomp/ci-job.json`,
  `--cap-drop=ALL`, `--security-opt no-new-privileges`, `--ipc none`,
  `--pids-limit`, memory and CPU limits from the profile, `--user 1000:1000`,
  attached only to the internal job network `nabatable-ci-jobs`);
- a fresh named volume `<jobId>-workspace` for `/workspace`;
- a fresh Lima instance, so even the Docker image store is discarded with the
  job.

When the request finishes, artefacts are staged out, the container is removed,
and the whole instance is stopped and deleted. Nothing produced by a job is
ever written back into the golden image or the job image.

## What jobs can never do

- publish or refresh a shared cache (there is no writable shared location; the
  instance is destroyed);
- reach the proxy outside phase `prep` (see `network/`);
- read host files (the VM has no mounts) or host environment variables (the
  executor passes only the sanitized profile env);
- run as root or gain capabilities (`USER ci`, `no-new-privileges`, seccomp
  denies `ptrace`, `mount`, `keyctl`, `bpf`, `unshare`, `setns`, and friends).

## Chromium sandbox note

The seccomp profile denies user namespaces (`clone` with `CLONE_NEW*` flags,
`unshare`, `setns`). Chromium's own sandbox needs them, so Playwright must be
launched with `chromiumSandbox: false` inside jobs. The container itself is the
sandbox boundary; this is the same posture as Playwright's official Docker
images when run without `--cap-add SYS_ADMIN`.
