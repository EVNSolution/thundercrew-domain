# thundercrew-domain

ThunderCrew 전기 이륜차 운영 관제/관리 서비스 워크스페이스입니다.

이 저장소의 루트는 product runtime을 직접 담는 곳이 아니라, 프론트엔드/백엔드/문서/변화관리 작업을 묶는 orchestration layer입니다.

## Workspace layout

- `development/front-admin-web` — Next.js App Router 기반 관리자 웹/지도 관제 MVP
- `development/service-ops-api` — Spring Boot 기반 운영 API
- `docs/` — backend 설계, trace, 작업 기록
- `clever-agent-workspace/` — 로컬 CLEVER 3대 control-plane repo workspace이며 target product commit 대상이 아닙니다.

자세한 구조는 `WORKSPACE.md`와 `repo-map.md`를 봅니다.

## Framework and process

상세한 프레임워크/프로세스 기준은 `docs/process/framework-and-process.md`에 둡니다.

현재 기준:

- Frontend runtime: `development/front-admin-web` — Next.js App Router / TypeScript.
- Backend runtime: `development/service-ops-api` — Spring Boot / Java 21 / Gradle Kotlin DSL.
- Integration branch: `dev`.
- Deploy/promotion branch: `main`.
- Work branch pattern: `cc-<clever-change-control-issue>-<scope-slug>`.
- 모든 비사소한 변경은 `clever-change-control` 이슈와 target repository 이슈를
  양방향으로 연결한 뒤 진행합니다.

### Change-control metadata maintenance

Change-control 기반 메타데이터는 각 이슈 루프의 일부로 유지합니다.

- 작업 전: change-control 이슈, target 이슈, trace branch, concurrent-work
  decision을 양쪽 GitHub 이슈에 기록합니다.
- 작업 중: phase, branch, 관련 commit, PR 링크, status, next action을 이슈
  comment에 갱신합니다.
- PR body: trace link, 최종 concurrent-work decision, verification evidence를
  반복해서 남깁니다.
- merge 후: 양쪽 이슈를 닫고 trace branch를 삭제하며 merge commit을 기록합니다.
- Local agent memory: `.omx/project-memory.json`과 `.omx/notepad.md`에는
  non-secret 상태/링크만 기록하고, 완료 후 active issue/branch/PR 필드는 비웁니다.
- DB password, JWT secret, service-role key, connection string 같은 secret은
  README, docs, `.omx/project-memory.json`, `.omx/notepad.md`에 저장하지 않습니다.

Local memory의 deployment metadata는 기록일 뿐 source of truth가 아닙니다.
Vercel/Supabase의 현재 상태를 말할 때는 CLI/API로 다시 확인합니다.


### AWS production deployment

Current production promotion policy:

- `dev` is the integration branch for normal issue/PR work.
- `main` is the production promotion branch.
- A push/merge to `main` runs `.github/workflows/aws-ec2-deploy.yml`.
- The workflow uses GitHub OIDC to assume the production AWS role and updates the existing EC2/EBS host.
- The workflow does not create EC2/EBS resources; it rebuilds the app on the host and restarts the systemd services.
- Required runtime secrets stay in GitHub Actions secrets or on the EC2 host, never in committed files.

See `docs/deployment/aws-ec2-main-merge-deploy.md` for the exact variables, secrets, and verification behavior.


## Control-change metadata

| 항목 | 기준 이슈/PR | 현재 의미 | 정본 위치 | 비고 |
| --- | --- | --- | --- | --- |
| MVP 1 완료/운영 promotion anchor | `EVNSolution/thundercrew-domain#106`, `EVNSolution/clever-change-control#98` | MVP 1 완료 상태를 README/context에 고정하고 `dev` → `main` promotion으로 AWS 배포를 검증하는 최종 anchor | 이 README, `docs/deployment/aws-ec2-main-merge-deploy.md`, GitHub Actions run | 이 행은 main promotion 검증 후 완료 상태가 된다. |
| AWS EC2/EBS MVP runtime baseline | `EVNSolution/thundercrew-domain#102`, `EVNSolution/clever-change-control#96`, PR `#103` | Next.js admin web + Spring Boot API + PostgreSQL을 단일 EC2/EBS 호스트에 배포한 baseline | `docs/deployment/aws-ec2-ebs-deployment.md` | secret 값은 문서/README에 저장하지 않는다. |
| Main-merge deploy automation | `EVNSolution/thundercrew-domain#104`, `EVNSolution/clever-change-control#97`, PR `#105` | `main` push/merge 시 GitHub Actions가 기존 EC2 host를 업데이트하는 배포 구조 | `.github/workflows/aws-ec2-deploy.yml`, `docs/deployment/aws-ec2-main-merge-deploy.md` | EC2 생성/IaC는 범위 밖, 기존 host update만 수행. |
| Template lineage | `Clever-OIDC-deploy`, `msa-template` | OIDC 기반 deploy authority와 MSA umbrella repo boundary를 따른다. 단, 현재 EC2 배포는 image-build-once가 아니라 기존 host update 방식의 runtime override다. | `clever-context-monorepo:docs/templates/index.md` | template을 맹신하지 않고 현재 서비스 제약에 맞춘 override를 명시한다. |
| Context-monorepo pointer | `EVNSolution/clever-context-monorepo#21` | 서비스 해석/템플릿/정본 위치 pointer만 context-monorepo에 둔다. runtime proof와 secret은 target repo에 둔다. | `clever-context-monorepo:docs/services/thundercrew-domain/index.md` | context-monorepo는 runtime 상세 복제 저장소가 아니다. |

## Root commands

루트 명령은 현재 frontend workspace로 위임됩니다.

```bash
npm install
npm run check:workspace
npm run dev
npm run lint
npm run test:service-ops
npm run typecheck
npm run build
```

Backend 검증은 별도 runtime slice에서 실행합니다.

```bash
cd development/service-ops-api
./gradlew test
./gradlew build
```

## Frontend

관리자 웹 앱 문서는 `development/front-admin-web/README.md`에 있습니다.

- 핵심 화면: 지도 관제
- 운영관리 하위 화면: 차량, 라이더, 계약, 계약 양식, 보험, 보험 항목, 배터리 스테이션, 장비, 단말, 무결성 점검
- 디자인 기준: `development/front-admin-web/DESIGN.md`
- Supabase MVP migration/seed: `development/front-admin-web/supabase/`

## Backend

운영 API 문서는 `development/service-ops-api/README.md`와 `docs/backend/`에 있습니다.

## Deployment note

기존 Vercel 프로젝트는 `thundercrew-domain`입니다. 이 PR은 실제 Vercel project root-directory 설정을 변경하지 않습니다. 다음 배포 시에는 Vercel project root를 `development/front-admin-web`로 맞추거나, 해당 디렉터리 기준으로 CLI deploy를 실행해야 합니다.

Secrets는 `.env.local` 또는 Vercel/Supabase 환경변수에서만 관리하고 committed files에 저장하지 않습니다.

Frontend ↔ backend baseline:

- `SERVICE_OPS_API_BASE_URL`이 설정되면 Next.js server actions/components가
  `development/service-ops-api`의 `/api/v1`을 호출합니다.
- 관리자 로그인은 service-ops JWT access/refresh token을 HTTP-only 쿠키에 저장하고,
  localStorage, URL, rendered HTML, editable form field에 토큰을 노출하지 않습니다.
- refresh-token 쿠키가 남아 있고 access-token 쿠키가 만료된 server action 경로는
  `POST /api/v1/auth/refresh`로 세션 쿠키를 회전할 수 있습니다.
- 사이드바 로그아웃은 `POST /api/v1/auth/logout` 호출을 시도한 뒤, API 실패 여부와
  관계없이 로컬 HTTP-only 쿠키를 제거합니다.
- 라이더 목록/상세/등록/수정/비활성 삭제 server action은 해당 쿠키에서 Bearer token을 붙입니다.
- 차량 목록/상세/등록/수정/차체 상태 변경/비활성 삭제 server action도 같은 service-ops 세션을 사용하며, 차량 상세는 `/api/v1/bike-operation-status-histories`를 read-only 이력 패널로 표시합니다. 차량 폼에는 DB/FK ID 입력칸을 두지 않습니다.
- 계약 목록/상세/등록/메모 수정/종료 server action도 같은 service-ops 세션을 사용하며, 계약 폼은 라이더/차량/계약양식을 사람이 읽을 수 있는 select로 연결합니다.
- 계약 양식 목록/상세/등록/수정/비활성 삭제 server action도 같은 service-ops 세션을 사용하며, 시스템 양식은 읽기 전용으로 보호합니다.
- 보험 목록/상세/등록/수정/비활성 삭제 server action도 같은 service-ops 세션을 사용하며, 보험 폼은 라이더와 보험 항목을 사람이 읽을 수 있는 select로 연결합니다.
- 보험 항목 목록/상세/등록/수정/비활성 삭제 server action도 같은 service-ops 세션을 사용하며, 보험 항목 폼에는 DB/FK ID 입력칸을 두지 않습니다.
- 배터리 스테이션 목록/상세/등록/수정/재고 변경/비활성 삭제 server action도 같은 service-ops 세션을 사용하며, 스테이션 상세는 `/api/v1/station-battery-count-logs`를 read-only 이력 패널로 표시합니다. 스테이션 폼에는 DB ID 입력칸을 두지 않습니다.
- 장비 종류와 바이크 장비 목록/상세/등록/수정/제거 server action도 같은 service-ops 세션을 사용하며, 차량과 장비 종류 연결은 사람이 읽을 수 있는 select로 처리합니다.
- 무결성 점검은 같은 service-ops 세션으로 `GET /api/v1/integrity/reference-checks`를 읽어 read-only로 표시하며, telemetry/current-state 항목은 화면 표시에서 제외합니다.
- 지도 관제는 같은 쿠키 세션으로 `GET /api/v1/dashboard/map-state`를 읽어
  summary, bike pins, station pins를 렌더링합니다.
- 값이 없거나 placeholder이면 프론트는 명시적 notice와 함께 mock 데이터를 사용합니다.
