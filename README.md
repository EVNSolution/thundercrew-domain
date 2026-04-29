# thundercrew-domain

ThunderCrew 전기 이륜차 운영 관제/관리 서비스 워크스페이스입니다.

이 저장소의 루트는 product runtime을 직접 담는 곳이 아니라, 프론트엔드/백엔드/문서/변화관리 작업을 묶는 orchestration layer입니다.

## Workspace layout

- `development/front-admin-web` — Next.js App Router 기반 관리자 웹/지도 관제 MVP
- `development/service-ops-api` — Spring Boot 기반 운영 API
- `docs/` — backend 설계, trace, 작업 기록
- `clever-agent-workspace/` — 로컬 CLEVER 3대 control-plane repo workspace이며 target product commit 대상이 아닙니다.

자세한 구조는 `WORKSPACE.md`와 `repo-map.md`를 봅니다.

## Root commands

루트 명령은 현재 frontend workspace로 위임됩니다.

```bash
npm install
npm run check:workspace
npm run dev
npm run lint
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
- 운영관리 하위 화면: 차량, 라이더, 계약, 보험, 배터리 스테이션
- 디자인 기준: `development/front-admin-web/DESIGN.md`
- Supabase MVP migration/seed: `development/front-admin-web/supabase/`

## Backend

운영 API 문서는 `development/service-ops-api/README.md`와 `docs/backend/`에 있습니다.

## Deployment note

기존 Vercel 프로젝트는 `thundercrew-domain`입니다. 이 PR은 실제 Vercel project root-directory 설정을 변경하지 않습니다. 다음 배포 시에는 Vercel project root를 `development/front-admin-web`로 맞추거나, 해당 디렉터리 기준으로 CLI deploy를 실행해야 합니다.

Secrets는 `.env.local` 또는 Vercel/Supabase 환경변수에서만 관리하고 committed files에 저장하지 않습니다.
