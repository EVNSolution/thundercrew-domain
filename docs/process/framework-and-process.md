# Framework and process baseline

## Purpose

This document is the durable working contract for `thundercrew-domain` after the
workspace split. It summarizes the current framework choices and the process that
keeps implementation work traceable through CLEVER change-control.

## Framework baseline

| Slice | Path | Framework/runtime | Role |
| --- | --- | --- | --- |
| Admin web | `development/front-admin-web` | Next.js App Router / TypeScript | 지도 관제와 운영관리 관리자 UI |
| Operations API | `development/service-ops-api` | Spring Boot / Java 21 / Gradle Kotlin DSL | 운영 도메인 API와 command/read contracts |
| Database | backend Flyway migrations | PostgreSQL baseline | 운영 데이터 schema baseline |
| Legacy MVP DB assets | `development/front-admin-web/supabase` | Supabase SQL migration/seed | frontend-first prototype evidence; not the canonical Spring Boot schema |
| Workspace root | repository root | npm workspace orchestration | command delegation, docs, traceability, process metadata |

The repository root is not a runtime app root. Runtime source must stay in the
slice that owns it unless the change is explicitly root orchestration, shared
docs, or workflow metadata.

## Branch and issue process

Every non-trivial implementation or durable process change follows this loop:

1. Identify or create the CLEVER change-control issue in
   `EVNSolution/clever-change-control`.
2. Identify or create the target repository issue in
   `EVNSolution/thundercrew-domain`.
3. Cross-link both issues with explicit issue mentions.
4. Create a trace branch named with the change-control issue, for example
   `cc-63-framework-process-docs`.
5. Record the concurrent-work gate on both issues before implementation.
6. Implement only the accepted issue-size scope.
7. Verify with commands appropriate to the changed surface.
8. Open a PR into `dev`; repeat the concurrent-work decision in the PR body.
9. Merge to `dev`, close both issues, delete the trace branch, and prune remotes.
10. Update metadata and handoff notes.

## Branch roles

| Branch | Meaning |
| --- | --- |
| `main` | production deploy/promotion branch; push/merge to this branch runs AWS EC2 deployment |
| `dev` | target repository integration branch; normal issue PRs merge here first |
| `cc-<change-control-issue>-<slug>` | scoped trace branch for a concrete issue; never a production deploy trigger |

### Production promotion rule

Do not treat `dev` merges as production deployments. Promote to production by merging the already-verified integration state into `main`. The `main` push is the deployment trigger and must only contain work that is accepted for the current production update.

## Change-control metadata maintenance

Metadata is part of the work, not a cleanup afterthought. Keep these records in
sync with the issue loop:

| Record | When to update | What to keep |
| --- | --- | --- |
| `clever-change-control` issue | before work, before PR, after merge | phase, target repo, branch, commits, PR, status, next action |
| target repo issue | before work, before PR, after merge | change-control link, branch, concurrent decision, verification, completion |
| PR body | when opening PR | trace links, final concurrent-work decision, verification evidence |
| `.omx/project-memory.json` | after durable milestones | non-secret IDs/URLs/status, active issue/branch/PR fields, merge commits |
| `.omx/notepad.md` | after durable milestones or before context loss | narrative handoff, decisions, verification, next candidates |
| repository docs | when framework/process/runtime boundary changes | durable rules only; avoid per-issue noise in README |

### Active vs completed metadata

During an active issue, `.omx/project-memory.json` should show the active
change-control issue, target issue, branch, and PR when one exists. After merge
and cleanup, clear active fields and move the final URLs/merge commit into a
completed-scope entry.

### Secret and deployment metadata rules

- Never store DB passwords, service-role keys, JWT secrets, or connection strings
  in README, docs, `.omx/project-memory.json`, or `.omx/notepad.md`.
- It is acceptable to store non-secret deployment metadata such as Vercel project
  ID, Supabase project ref, public API URL, production URL, PR URL, and merge
  commit.
- Treat deployment metadata as a cached record. Before making operational claims
  such as "current production deployment" or "Supabase project is healthy",
  verify with CLI/API evidence.

## Verification expectations

Minimum verification is selected by changed surface:

| Changed surface | Required verification |
| --- | --- |
| workspace/root docs or process only | `npm run check:workspace`, `git diff --check` |
| frontend source/config | `npm run check:workspace`, `npm run lint`, `npm run typecheck`, `npm run build` |
| backend source/config | `(cd development/service-ops-api && ./gradlew test)`, `(cd development/service-ops-api && ./gradlew build)` |
| cross-slice changes | frontend and backend verification together |
| deployment claims | Vercel/Supabase CLI or API inspection plus local build where relevant |

Verification output must be read before claiming completion.
