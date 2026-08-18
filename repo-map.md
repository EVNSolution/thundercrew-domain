# Repository map

## Root

- `package.json` — workspace-level command delegation.
- `package-lock.json` — npm workspace lockfile.
- `WORKSPACE.md` — workspace operating model.
- `repo-map.md` — this file.
- `docs/` — design/change ledgers, traceability documents, and process baselines.
- `scripts/check-workspace-layout.mjs` — guard for the intended runtime-slice layout and stale root frontend artifacts.

## Frontend: `development/frontend`

- `app/` — Next.js App Router pages and layout.
- `components/` — UI/layout/domain components.
- `lib/` — frontend services, Supabase helpers, validation utilities.
- `types/` — frontend TypeScript domain types.
- `supabase/` — historical MVP Supabase migration/seed used by the frontend-first prototype.
- `DESIGN.md` — frontend design direction and visual baseline.
- `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs` — frontend runtime configuration.

## Process docs

- `docs/process/framework-and-process.md` — framework/process baseline and change-control metadata maintenance rules.

## Backend: `development/backend`

- `src/main/java/com/thundercrew/opsapi` — Spring Boot modular-monolith packages.
- `src/main/resources/db/migration` — Flyway migrations.
- `src/test/java/com/thundercrew/opsapi` — API/domain/persistence/architecture tests.
- `README.md` — backend runbook.

## 제거된 것: `development/app` (모바일 앱)

2026-08-18 에 라이더 웹과 함께 제거했다. 라이더가 직접 쓰는 표면을 전부 없앤 결정이다.
`riders` 테이블과 계약·매칭·교육기록은 콘솔에서 계속 관리한다.

되살리려면 `scripts/check-workspace-layout.mjs` 의 가드부터 되돌려야 한다.

## Local CLEVER control plane

- `clever-agent-workspace/` is ignored from target product commits.
- Do not treat it as production source.
