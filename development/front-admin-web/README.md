# ThunderCrew Front Admin Web

전기 이륜차 운영을 위한 지도 기반 관제/관리 웹 서비스 MVP입니다. 핵심 화면은 지도 관제이며, 차량·라이더·계약·계약 양식·보험·스테이션·장비·단말·무결성 점검 테이블 화면은 좌측 사이드바의 `운영 관리` 하위 메뉴로 둡니다.

## 기술 스택

- Next.js App Router + TypeScript
- Spring Boot service-ops-api 연결 baseline + Supabase fallback
- Vercel 배포 준비
- Zod validation schema
- `development/front-admin-web/DESIGN.md` 기준 Baemin Mint Core UI (`#0CEFD3` 단일 액센트)

## 핵심 원칙

사용자가 객체 ID나 FK ID를 직접 입력하지 않습니다.

- 차량: `vehicle_id` 입력 금지 → 차량번호/모델/상태/위치와 라이더 선택
- 라이더: `rider_id` 입력 금지 → 이름/연락처/소속/구역 입력
- 계약: `contract_id`, `rider_id`, `vehicle_id`, `contract_template_id` 입력 금지 → 라이더 이름/연락처, 차량번호, 계약 양식 선택
- 계약 양식: `contract_template_id`, `idx`, `systemTemplate` 입력 금지 → 양식명, 기간, 설명, 사용 상태만 관리
- 보험: `insurance_id`, `rider_id`, `vehicle_id`, `insurance_item_id` 입력 금지 → 라이더 이름/연락처와 보험 항목 선택
- 스테이션: `station_id` 입력 금지 → 이름/주소/운영 상태/재고 입력
- 장비: `bikeId`, `equipmentTypeId`, `equipmentId` 직접 입력 금지 → 차량번호/장비 종류명 기준 선택
- 단말 설치: `bikeId`, `deviceId`, `installationId` 직접 입력 금지 → 차량번호/단말 UID 기준 선택
- 무결성 점검: read-only 결과 표시만 제공, DB ID/FK 수정 입력 금지

DB PK/FK는 backend/Postgres에서 자동 생성·관리합니다. 화면 route에 backend UUID가 쓰이더라도 사용자가 직접 입력하거나 수정하는 필드로 노출하지 않습니다.

## 실행

루트에서 실행할 때:

```bash
npm install
npm run dev
```

프론트엔드 디렉터리에서 직접 실행할 때:

```bash
cd development/front-admin-web
npm run dev
```

검증:

```bash
npm run lint
npm run test:service-ops
npm run typecheck
npm run build
```

## 환경변수

`.env.example`을 복사해 `.env.local`을 만들고 실제 값은 로컬 또는 Vercel 환경변수로만 관리합니다.

```bash
cp .env.example .env.local
```

필요 값:

- `SERVICE_OPS_API_BASE_URL` — Next.js server action/component가 호출하는 Spring Boot API base URL, 예: `http://localhost:8080`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL` — service-ops 미설정 시 Supabase Auth fallback
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — service-ops 미설정 시 Supabase Auth fallback
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용 secret
- `SUPABASE_DB_URL` — 서버 전용 secret

secret은 코드, README, `.omx/project-memory.json`, `.omx/notepad.md`에 저장하지 않습니다.

## Backend API integration baseline

- `SERVICE_OPS_API_BASE_URL`이 설정되면 `/login`은 `POST /api/v1/auth/login`으로 관리자 인증을 수행합니다.
- access/refresh token은 localStorage, URL, rendered HTML, editable form field에 두지 않고 HTTP-only cookie로 저장합니다.
- access-token cookie가 없고 refresh-token cookie가 남아 있는 server action은 `/api/v1/auth/refresh`로 cookie를 회전할 수 있습니다.
- 좌측 sidebar의 관리자 로그아웃은 `/api/v1/auth/logout`을 Bearer access token으로 호출하고, backend 호출 실패 시에도 local HTTP-only cookie를 삭제합니다.
- 라이더 목록/상세/등록/수정은 server action/server component에서 `/api/v1/riders`를 호출합니다.
- 차량 목록/상세/등록/수정/차체 상태 변경은 server action/server component에서 `/api/v1/bikes`와 `/api/v1/bikes/{id}/operation-status`를 호출합니다.
- 차량 기본 정보 폼은 차량번호, VIN, 모델, 메모와 상태 선택만 다루며 `bikeId`, `vehicle_id`, `riderId`, `deviceId` 같은 직접 입력 필드를 만들지 않습니다.
- 계약 목록/상세/등록/메모 수정/종료는 server action/server component에서 `/api/v1/contract-templates`와 `/api/v1/rider-bike-contracts`를 호출합니다.
- 계약 등록 폼은 라이더, 차량, 계약 양식을 select로 고르게 하며 `contractId`, `riderId`, `bikeId`, `contractTemplateId` 같은 직접 입력 필드를 만들지 않습니다. 종료일은 선택한 계약 양식의 기간으로 백엔드가 계산합니다.
- 계약 양식 목록/상세/등록/수정/비활성 삭제는 server action/server component에서 `/api/v1/contract-templates`를 호출합니다. 시스템 계약 양식은 UI에서 읽기 전용으로 보호합니다.
- 보험 목록/상세/등록/수정은 server action/server component에서 `/api/v1/insurance-items`와 `/api/v1/rider-insurances`를 호출합니다.
- 보험 등록 폼은 라이더와 보험 항목을 select로 고르게 하며 `insuranceId`, `riderId`, `insuranceItemId`, `vehicle_id` 같은 직접 입력 필드를 만들지 않습니다. 현재 backend 범위는 라이더 보험 연결이며 증권번호/보험기간/차량 보험은 후속 확장 범위입니다.
- 배터리 스테이션 목록/상세/등록/수정/재고 변경은 server action/server component에서 `/api/v1/battery-stations`와 `/api/v1/battery-stations/{id}/battery-counts`를 호출합니다.
- 스테이션 폼은 이름, 주소, 좌표, 운영 상태, 수량만 다루며 `stationId`, `station_id`, `batteryStationId` 같은 직접 입력 필드를 만들지 않습니다.
- 장비 종류와 바이크 장비 목록/상세/등록/수정/제거는 server action/server component에서 `/api/v1/equipment-types`와 `/api/v1/bike-equipments`를 호출합니다.
- 바이크 장비 등록 폼은 차량과 장비 종류를 select로 고르게 하며 `bikeId`, `equipmentTypeId`, `equipmentId` 같은 직접 입력 필드를 만들지 않습니다.
- 단말 등록/수정은 단말 자체 UID와 제조사/모델/상태만 다루고, 차량 단말 설치 폼은 차량과 단말을 select로 고르게 하며 `bikeId`, `deviceId`, `installationId` 같은 직접 입력 필드를 만들지 않습니다.
- 무결성 점검 화면은 `/api/v1/integrity/reference-checks`를 read-only로 표시하고, repair/scheduler/write 입력을 제공하지 않습니다. Telemetry/current-state 소스 테이블은 이번 범위에서 화면 표시 제외합니다.
- 지도 관제 대시보드는 server component에서 `GET /api/v1/dashboard/map-state`를 호출해 summary, bike pins, station pins를 표시합니다.
- `SERVICE_OPS_API_BASE_URL`이 없거나 placeholder이면 mock fallback을 명시 notice로 표시합니다.
- 라이더 route slug는 backend 응답 UUID를 내부 route 식별자로 사용하지만, form에는 `id`, `riderId`, `appAccountId` 같은 직접 입력 필드를 만들지 않습니다.

## 구현된 화면

- `/` 랜딩/소개
- `/login` 관리자 로그인 준비 화면
- `/dashboard` 지도 기반 관제 화면(현재 빈 지도 배경)
- `/vehicles` 차량 목록
- `/vehicles/new` 차량 등록
- `/vehicles/[slug]` 차량 상세
- `/vehicles/[slug]/edit` 차량 수정
- `/riders` 라이더 목록
- `/riders/new` 라이더 등록
- `/riders/[slug]` 라이더 상세
- `/riders/[slug]/edit` 라이더 수정
- `/contracts` 계약 목록
- `/contracts/new` 계약 등록
- `/contracts/[slug]` 계약 상세
- `/contract-templates` 계약 양식 목록
- `/contract-templates/new` 계약 양식 등록
- `/contract-templates/[slug]` 계약 양식 상세 + 비활성 삭제
- `/contract-templates/[slug]/edit` 계약 양식 수정
- `/insurance` 보험 목록
- `/insurance/new` 보험 등록
- `/insurance/[slug]` 보험 상세
- `/stations` 배터리 스테이션 목록 + mock 지도 영역
- `/stations/new` 스테이션 등록
- `/stations/[slug]` 스테이션 상세 + 재고 수량 변경
- `/stations/[slug]/edit` 스테이션 기본 정보 수정
- `/equipment` 장비 목록 + 장비 종류 관리
- `/equipment/new` 바이크 장비 등록
- `/equipment/[slug]` 바이크 장비 상세 + 제거 처리
- `/equipment/[slug]/edit` 바이크 장비 수정
- `/equipment/types/new` 장비 종류 등록
- `/equipment/types/[slug]` 장비 종류 상세/수정
- `/devices` 단말 목록 + 차량 단말 설치 이력
- `/devices/new` 단말 등록
- `/devices/[slug]` 단말 상세 + 비활성 삭제
- `/devices/[slug]/edit` 단말 기본 정보 수정
- `/devices/installations/new` 차량 단말 설치
- `/devices/installations/[slug]` 차량 단말 설치 상세 + 제거 처리
- `/integrity` 무-FK 참조 무결성 점검 read-only 화면
- `/settings` 연결 설정 확인

## Supabase

초안 파일:

- `supabase/migrations/202604290001_initial_thundercrew_domain.sql`
- `supabase/seed.sql`

적용 예시:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase db reset
```

Supabase 프로젝트 `thundercrew-domain`은 `dxpteucgwsrmalocriar`로 생성/링크되었고 초기 migration과 seed를 적용했습니다. DB password, service role key, connection string은 secret으로만 관리합니다.

## Vercel

Vercel 프로젝트 `thundercrew-domain`을 생성했고 production alias는 `https://thundercrew-domain.vercel.app`입니다. 별도 소유 custom domain은 아직 연결하지 않았습니다.

프론트엔드 디렉터리 기준 배포 예시:

```bash
cd development/front-admin-web
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel env add SUPABASE_DB_URL
npx vercel deploy
```

custom domain은 사용자가 확정한 뒤 연결합니다. 임의로 운영 도메인을 만들지 않습니다.

## 1차 MVP 제외/보류

- 실제 지도 API 연동
- 운영 관리자 권한 모델 상세화
- write RLS 정책 확장

위 항목은 사용자 확인 후 진행합니다.

## 현재 배포 상태

- Supabase project ref: `dxpteucgwsrmalocriar`
- Supabase API URL: `https://dxpteucgwsrmalocriar.supabase.co`
- Vercel project id: `prj_xtjs5XK9UHIpB34ysBJKWlTXGUmf`
- Production URL: `https://thundercrew-domain.vercel.app`
- Latest deployment id: `dpl_3ojdhup9TezLsED265mP1aTANP6N`
- Test admin email: `admin@thundercrew-domain.local`
- Test admin password: local `.env.local`의 `SEED_ADMIN_PASSWORD`에만 저장

Preview 환경변수는 현재 Vercel 프로젝트에 Git repository가 연결되지 않아 branch preview 대상으로 등록하지 못했습니다. Git 연결 후 preview env를 다시 등록합니다.

## Navigation UX

- 상단 메뉴 대신 좌측 고정 사이드바를 사용합니다.
- 사이드바는 토글 버튼으로 완전히 접혀 화면에서 사라질 수 있습니다.
- 최상위 핵심 메뉴는 `지도 관제`입니다.
- 기존 테이블/CRUD 화면은 `운영 관리` 상위 그룹의 하위 메뉴입니다.
- 1차 지도 관제 화면은 실제 지도 API 연결 전까지 빈 지도 배경으로 유지합니다.

## Theme

- OS 설정을 기준으로 초기 light/dark theme를 적용합니다.
- 좌측 사이드바 하단의 테마 버튼으로 라이트/다크모드를 전환합니다.
- 다크모드에서도 `#0CEFD3` 민트는 CTA, active, focus, selected 상태의 단일 브랜드 액센트로 유지합니다.

## Map Control Additions

- 지도 관제 화면 좌상단에 지역 검색과 라이더 검색 패널을 둡니다.
- 지역 검색 결과는 지역별 요약 정보로 연결됩니다.
- 라이더 검색 결과는 라이더 상세 정보로 연결됩니다.
- 우측에는 넓은 고정 정보 패널을 둡니다.
- 지도 API 없이도 지도 요소 컴포넌트로 `라이더 위치`와 `배터리 스테이션 위치`를 표시합니다.
- service-ops `map-state`가 연결되면 배터리 스테이션 핀은 backend `pinLabel`을 사용해 `이름 사용가능/최대` 형식으로 표시합니다.
- backend `map-state`는 라이더 전화번호/ID를 노출하지 않으므로, service-ops 모드에서 라이더 상세 링크는 별도 selector/API 통합 범위에서 연결합니다.

## Workspace relocation note

이 앱은 repository root에서 `development/front-admin-web`로 이동되었습니다. Root `npm run dev/lint/typecheck/build` 명령은 이 workspace로 위임됩니다. Vercel Git 연동을 사용할 경우 project root directory도 `development/front-admin-web`로 맞춰야 합니다.
