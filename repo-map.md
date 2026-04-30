# Repository map

## Root

- `package.json` — workspace-level command delegation.
- `package-lock.json` — npm workspace lockfile.
- `WORKSPACE.md` — workspace operating model.
- `repo-map.md` — this file.
- `docs/` — design/change ledgers, traceability documents, and process baselines.
- `scripts/check-workspace-layout.mjs` — guard for the intended runtime-slice layout and stale root frontend artifacts.

## Frontend: `development/front-admin-web`

- `app/` — Next.js App Router pages and layout.
- `components/` — UI/layout/domain components.
- `lib/` — frontend services, Supabase helpers, validation utilities.
- `types/` — frontend TypeScript domain types.
- `supabase/` — historical MVP Supabase migration/seed used by the frontend-first prototype.
- `DESIGN.md` — frontend design direction and visual baseline.
- `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs` — frontend runtime configuration.

## Process docs

- `docs/process/framework-and-process.md` — framework/process baseline and change-control metadata maintenance rules.

## Backend: `development/service-ops-api`

- `src/main/java/com/thundercrew/opsapi` — Spring Boot modular-monolith packages.
- `src/main/resources/db/migration` — Flyway migrations.
- `src/test/java/com/thundercrew/opsapi` — API/domain/persistence/architecture tests.
- `README.md` — backend runbook.

## Local CLEVER control plane

- `clever-agent-workspace/` is ignored from target product commits.
- Do not treat it as production source.
