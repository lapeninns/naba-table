# Tooling

Important tooling lives in `package.json`, `scripts/**`, `.github/workflows/**`, and `.husky/pre-commit`.

## Key script groups

| Group           | Examples                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| Validation      | `lint`, `typecheck`, `validate:env`, `secret:scan`                       |
| UI guards       | `guard:no-shadcn:strict`, `guard:luma:strict`                            |
| Security        | `security:regression`, `security:guard:service-role`, `security:backlog` |
| Cloudflare      | `cloudflare:*:deploy`, `cloudflare:*:versions`, `cloudflare:*:smoke`     |
| Database safety | `db:*`, `supabase:apply-order:*`, `scripts/db/safe-run.ts`               |

Related: [Testing](testing.md), [Deployment](../deployment.md).
