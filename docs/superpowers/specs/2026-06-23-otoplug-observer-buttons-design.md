# OTOPLUG observer 등록/해제 버튼 설계

**작성일:** 2026-06-23

## 목표

자원관리 페이지에서 운영자가 버튼으로 OTOPLUG NT observer(`driving`, `drivingDetail`)를
**등록(수신 시작) / 해제(수신 중지)** 할 수 있게 한다. python 스크립트(ops 수동)를 대체.

- 버튼 텍스트: **"단말 데이터 수신 시작"**(등록), **"수신 중지"**(해제). 현재 상태("수신 중"/"중지됨") 표시.
- observer는 계정 단위 1쌍(driving + drivingDetail)이면 충분 — 버튼은 그 1쌍을 일괄 등록/해제.

## 결정

- **채널토큰 = 단일 공유 시크릿** `OTOPLUG_CHANNEL_TOKEN`(env). 백엔드가 등록 시 이 토큰으로 observer를 등록하고, 인앱 수신기(Next.js)도 같은 토큰으로 검증. (수신기의 기존 per-type env는 단일 토큰으로 정리.)
- observer `id`는 백엔드가 등록 시 `UUID.randomUUID()`로 생성하고 **DB에 저장** — 해제 시 `id`+`token` 필요하므로.
- 시크릿 값 입력·env 등록은 **ops/사용자** (클로드는 값 안 넣음).

## 백엔드 (service-ops-api)

### 설정 (application.properties)
```
thundercrew.otoplug.server-url=${OTOPLUG_SERVER_URL:https://otoplug.kt.com}
thundercrew.otoplug.client-id=${OTOPLUG_CLIENT_ID:}
thundercrew.otoplug.secured-code=${OTOPLUG_SECURED_CODE:}
thundercrew.otoplug.channel-token=${OTOPLUG_CHANNEL_TOKEN:}
thundercrew.otoplug.callback-base-url=${OTOPLUG_CALLBACK_BASE_URL:https://thcr.cleversystem.ai/api/otoplug/nt}
```

### 마이그레이션 V48 — otoplug_observers
```sql
create table otoplug_observers (
    id uuid primary key,
    idx bigserial not null unique,
    api varchar(100) not null,          -- csi.terminal.status.data.driving 등
    observer_id varchar(100) not null,  -- 등록 시 우리가 생성한 UUID
    channel_token varchar(200) not null,
    callback_url text not null,
    registered_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);
create unique index ux_otoplug_observers_active_api on otoplug_observers(api);
```
(등록=row insert, 해제=row delete. 활성 1건/api.)

### OTOPLUG 클라이언트 (`otoplug/OtoplugClient.java`)
Spring `RestClient` 사용. server-url/client-id/secured-code 주입.
- `authenticate()`: `GET /ccgf/v1/common.auth/?clientID=&securedCode=&sessionID={uuid}` → `authorizeCode` → `POST /ccgf/v1/common.auth.token` body `{clientID, authorizeCode, redirectURI:null}` → `token`. **60분 캐시**(만료 전 재발급). client-id/secured-code 비어있으면 명확한 예외("OTOPLUG 미설정").
- `registerObserver(api, observerId, callbackUrl, channelToken)`: `POST /ccgf/v1/{api}/{clientId}/observer` body `{id:observerId, type:"otoplug-api@notification", address:callbackUrl, token:channelToken, expiration:"-1", dataOutputType:"simple"}`. 응답 `result==0` 아니면 예외(result 코드 메시지).
- `ignoreObserver(api, observerId, channelToken)`: `POST /ccgf/v1/{api}/{clientId}/ignore` body `{id:observerId, type:"otoplug-api@notification", token:channelToken}`. `result==0` 확인.

### 서비스 (`OtoplugObserverService.java`)
대상 api 2개: `csi.terminal.status.data.driving`(콜백 `/driving`), `csi.terminal.status.data.drivingDetail`(콜백 `/driving-detail`).
- `register()`: 각 api에 대해 DB에 활성 row 있으면 skip, 없으면 `observerId=UUID`, `registerObserver(...)` 성공 시 row 저장. 멱등.
- `ignore()`: 각 활성 row에 대해 `ignoreObserver(...)` 호출 후 row 삭제. (OTOPLUG 호출 실패해도 row는 정리할지 옵션 — 기본: 성공해야 삭제, 실패 메시지 반환.)
- `status()`: 등록된 api 목록 + 전체 등록여부(둘 다 등록=ACTIVE).

### 컨트롤러 (`OtoplugObserverController.java`) — 관리자 권한
- `POST /api/v1/otoplug/observers/register` → `OtoplugObserverStatusResponse`
- `POST /api/v1/otoplug/observers/ignore` → `OtoplugObserverStatusResponse`
- `GET /api/v1/otoplug/observers` → `OtoplugObserverStatusResponse { active: boolean, registeredApis: string[] }`
- SecurityConfig: 별도 permit 불필요(기본 ADMIN 권한 경로).

### 테스트
계약 테스트(Testcontainers) 추가 — register/ignore/status 경로. OTOPLUG 외부 호출은 mock/stub(RestClient를 주입형으로 만들어 테스트에서 가짜 응답). 최소 status 조회 + 미설정 시 에러 케이스.

## 인앱 수신기 토큰 정리 (Next.js)
- `app/api/otoplug/nt/[type]/route.ts`: per-type env(`OTOPLUG_CHANNEL_TOKEN_DRIVING`/`_DRIVING_DETAIL`) → **단일 `OTOPLUG_CHANNEL_TOKEN`** 으로 변경(백엔드 등록 토큰과 일치). 미설정 시 경고+통과 동작 유지.

## 프론트엔드
- api 클라이언트: `registerOtoplugObservers()`, `ignoreOtoplugObservers()`, `getOtoplugObserverStatus()`.
- 서버 액션(자원관리): `startTelemetryReceiveAction`, `stopTelemetryReceiveAction`(결과 `{ok, message?}`), 상태는 서버컴포넌트/route로 조회.
- UI: 자원관리 차량 섹션 헤더 근처에 **"단말 데이터 수신" 카드/줄**:
  - 상태 배지: 등록됨="수신 중"(초록) / 안됨="중지됨"(회색).
  - 버튼 **"단말 데이터 수신 시작"**(미등록일 때 활성) / **"수신 중지"**(등록됨일 때 활성). 처리 중 disable, 실패 시 인라인 에러.
  - 툴팁/보조문구로 "OTOPLUG NT observer 등록/해제" 명시.

## ops (사용자/배포)
- env: `OTOPLUG_CLIENT_ID`, `OTOPLUG_SECURED_CODE`, `OTOPLUG_SERVER_URL`, `OTOPLUG_CHANNEL_TOKEN`, `OTOPLUG_CALLBACK_BASE_URL`. backend + (CHANNEL_TOKEN은) Next.js 양쪽.
- 기존 python으로 등록한 observer가 있으면 **먼저 `test_nt.py unregister-all`** 로 정리(중복 방지) 후, 버튼으로 등록.
- ※ observer가 운영과 같은 OTOPLUG 계정인지 확인.

## 비목표
- RR 폴링, device/driving-result NT — 범위 외(driving + drivingDetail만).
- 채널토큰 자동 회전 — 고정 공유 시크릿.
