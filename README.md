# thundercrew-domain

전기 이륜차 운영을 위한 지도 기반 관제/관리 웹 서비스 MVP입니다. 핵심 화면은 지도 관제이며, 차량·라이더·계약·보험·스테이션 테이블 화면은 좌측 사이드바의 `운영 관리` 하위 메뉴로 둡니다.

## 기술 스택

- Next.js App Router + TypeScript
- Supabase Auth/Postgres 연결 준비
- Vercel 배포 준비
- Zod validation schema
- `DESIGN.md` 기준 Baemin Mint Core UI (`#0CEFD3` 단일 액센트)

## 핵심 원칙

사용자가 객체 ID나 FK ID를 직접 입력하지 않습니다.

- 차량: `vehicle_id` 입력 금지 → 차량번호/모델/상태/위치와 라이더 선택
- 라이더: `rider_id` 입력 금지 → 이름/연락처/소속/구역 입력
- 계약: `contract_id`, `rider_id` 입력 금지 → 라이더 이름/연락처 선택
- 보험: `insurance_id`, `rider_id`, `vehicle_id` 입력 금지 → 라이더 또는 차량 식별 정보 선택
- 스테이션: `station_id` 입력 금지 → 이름/주소/운영 상태/재고 입력

DB PK/FK는 Supabase/Postgres에서 자동 생성·관리합니다.

## 실행

```bash
npm install
npm run dev
```

검증:

```bash
npm run lint
npm run build
```

## 환경변수

`.env.example`을 복사해 `.env.local`을 만들고 실제 값은 로컬 또는 Vercel 환경변수로만 관리합니다.

```bash
cp .env.example .env.local
```

필요 값:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용 secret
- `SUPABASE_DB_URL` — 서버 전용 secret

secret은 코드, README, `.omx/project-memory.json`, `.omx/notepad.md`에 저장하지 않습니다.

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
- `/insurance` 보험 목록
- `/insurance/new` 보험 등록
- `/insurance/[slug]` 보험 상세
- `/stations` 배터리 스테이션 목록 + mock 지도 영역
- `/stations/new` 스테이션 등록
- `/stations/[slug]` 스테이션 상세
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

배포 준비 후 진행 예시:

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel env add SUPABASE_DB_URL
npx vercel deploy
```

custom domain은 사용자가 확정한 뒤 연결합니다. 임의로 운영 도메인을 만들지 않습니다.

## 1차 MVP 제외/보류

- 실제 Supabase 프로젝트 생성
- 실제 Vercel 프로젝트 생성 및 도메인 연결
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
