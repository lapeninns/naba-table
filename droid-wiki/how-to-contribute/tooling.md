# Tooling

Important tooling lives in `package.json`, `scripts/**`, `.github/workflows/**`, `.husky/pre-commit`, `docs/qa/**`, and task folders.

## Key script groups

| Group           | Examples                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Validation      | `lint`, `typecheck`, `validate:env`, `secret:scan`                                                     |
| UI guards       | `guard:no-shadcn:strict`, `guard:luma:strict`                                                          |
| QA packs        | `qa:public-booking`, `qa:ops-lifecycle`, `qa:background-workers`, `qa:gbp-dual-sync`, `qa:reserve-app` |
| Security        | `security:regression`, `security:guard:service-role`, `security:backlog`                               |
| Cloudflare      | `cloudflare:*:deploy`, `cloudflare:*:versions`, `cloudflare:*:smoke`                                   |
| Database safety | `db:*`, `supabase:apply-order:*`, `scripts/db/safe-run.ts`                                             |

Related: [Testing](testing.md), [Deployment](../deployment.md).
