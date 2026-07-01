# ThunderCrew workspace

## Purpose

`thundercrew-domain`은 전기 이륜차 운영 관제/관리 서비스를 위한 full-stack workspace입니다.

루트는 앱 소스 자체가 아니라 workspace orchestration layer입니다. 실제 runtime slice는 `development/` 아래에 둡니다.

## Runtime slices

| Path | Role | Runtime |
| --- | --- | --- |
| `development/frontend` | 관리자 웹, 지도 관제, 운영관리 화면 | Next.js App Router / TypeScript |
| `development/backend` | 운영 API, domain command/read contracts | Spring Boot / Java 21 |
| `development/app` | 라이더/드라이버 모바일 앱 (배차 수행·내 차량·지도) | Expo / React Native (Android+iOS) |

## Local control plane

| Path | Role |
| --- | --- |
| `clever-agent-workspace/clever-agent-project` | intake/bootstrap entry |
| `clever-agent-workspace/clever-context-monorepo` | canonical interpretation/template context |
| `clever-agent-workspace/clever-change-control` | project-start/change-request trace |

`clever-agent-workspace/`는 target product commit 대상이 아니며 local control-plane context로만 둡니다.

## Operating rules

- New implementation work starts from a CLEVER change-control issue and a target repo issue.
- Each issue must pass an issue-size check before implementation.
- `dev` is the target repository integration branch.
- `main` remains the deploy/promotion branch.
- Product code should stay inside a runtime slice unless it is root orchestration, docs, or shared workflow metadata.

- Keep change-control metadata current: update the CLEVER issue, target issue,
  PR body, `.omx/project-memory.json`, and `.omx/notepad.md` at durable phase
  changes; clear active metadata after merge/branch cleanup.
- Store only non-secret metadata in docs or `.omx` memory. Verify Vercel/Supabase
  operational state with CLI/API evidence before treating memory values as
  current truth.
