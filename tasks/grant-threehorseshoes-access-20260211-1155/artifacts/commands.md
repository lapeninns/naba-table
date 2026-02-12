# Command Summary

```bash
CONFIRM_PRODUCTION=true EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm RESTAURANT_SLUG=three-horseshoes USER_EMAIL='hello@threehorseshoes-pub.com' ROLE=owner pnpm -s tsx scripts/grant-restaurant-access.ts
```

Initial result: user not found.

Auth user provisioned via Supabase admin API (service-role), then grant command re-run successfully.
