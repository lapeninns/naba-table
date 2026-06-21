# TODOs and FIXMEs

A current repository scan excluding `droid-wiki/**` found 7 TODO-style comments.

| File                                                                                                                        | Line | Note                                          |
| --------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------- |
| `src/components/common/index.ts`                                                                                            | 1    | Placeholder export TODO.                      |
| `src/app/api/ops/restaurants/[id]/google-business-profile/workflow/route.ts`                                                | 1    | Orphan GBP IA audit route handler breadcrumb. |
| `src/app/api/ops/restaurants/[id]/google-business-profile/drafts/route.ts`                                                  | 1    | Orphan GBP IA audit route handler breadcrumb. |
| `src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/route.ts`                                        | 1    | Orphan GBP IA audit route handler breadcrumb. |
| `src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish/route.ts`                                | 1    | Orphan GBP IA audit route handler breadcrumb. |
| `src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish-jobs/[jobId]/retry-google-push/route.ts` | 1    | Orphan GBP IA audit route handler breadcrumb. |
| `src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish/preflight/route.ts`                      | 1    | Orphan GBP IA audit route handler breadcrumb. |

The GBP breadcrumbs intentionally preserve route handlers while flagging follow-up deletion or rewiring decisions. Treat cleanup there as API/surface work, not just comment removal.

Related: [Development workflow](../how-to-contribute/development-workflow.md).
