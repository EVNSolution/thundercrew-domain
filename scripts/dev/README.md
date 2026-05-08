# scripts/dev — Dev-only verification helpers

이 디렉토리의 스크립트는 **로컬 개발 환경**에서만 사용한다.
스크립트는 시작 시 호스트 화이트리스트(localhost / 127.0.0.1 / `*.local`)를
검증하며, 그 외 호스트는 명시적인 `SEED_FORCE_REMOTE=true` 옵트인이 없으면
즉시 종료한다. **운영 도메인을 절대 대상으로 삼지 말 것.**

## seed-monitoring-fixtures.mjs

Vendor telemetry 폴링 워커가 가동되기 전에도 모니터링 화면(`/dashboard`)을
진짜 백엔드 데이터로 검증할 수 있도록 라이더/차량/디바이스/디바이스 설치/
충전소/telemetry 이벤트를 한 번에 시드한다.

### 시드되는 데이터

| 종류 | 행 수 | UUID prefix | 비고 |
|------|------|-------------|-----|
| 라이더              | 5 | `aaaa0000-…` | 강남/광화문/홍대/잠실/여의도팀 |
| 차량(bike)         | 5 | `bbbb0000-…` | TC-Mini × 3, TC-Pro × 2 |
| 디바이스           | 5 | `cccc0000-…` | TC-IoT-A1 |
| 디바이스 설치       | 5 | (서버 발급)   | bike[i] ↔ device[i] |
| 충전소             | 3 | `eeee0000-…` | 강남/광화문/홍대 |
| Telemetry 이벤트    | 5 | (vendorEventId) | 시드 시점의 lat/lng/배터리/시동 상태 |

### 사용법

로컬 백엔드(`localhost:8080`)에 시드:

```bash
SEED_TARGET_HOST=localhost \
SEED_TARGET_PORT=8080 \
ADMIN_LOGIN_ID=ops-admin \
ADMIN_PASSWORD=correct-password \
npm run dev:seed-monitoring
```

| 환경변수 | 필수 | 기본값 | 설명 |
|---------|------|-------|------|
| `SEED_TARGET_HOST` | ✅ | — | `localhost` / `127.0.0.1` / `0.0.0.0` / `::1` / `*.local` 만 기본 허용. |
| `SEED_TARGET_PORT` | — | `8080` | service-ops-api 포트. |
| `SEED_TARGET_PROTOCOL` | — | `http` | `https` 사용 시 명시. |
| `ADMIN_LOGIN_ID` | ✅ | — | 어드민 로그인 ID. **운영 자격증명 사용 금지**. |
| `ADMIN_PASSWORD` | ✅ | — | 어드민 비밀번호. |
| `SEED_FORCE_REMOTE` | — | `false` | 비-로컬 dev 호스트(예: 자체 dev sslip 환경)를 대상으로 할 때만 `true`. **운영 호스트 확인 후** 사용. |

### 멱등성

모든 ID 가 deterministic UUID 라 재실행해도 중복 INSERT 가 일어나지 않는다.
이미 존재하는 행에 대해서는 백엔드가 `409 DUPLICATE_ACTIVE_RESOURCE` 또는
`422` 를 반환하고, 스크립트는 `SKIP` 으로 로그에 남기고 다음 단계로 넘어간다.

### 검증

스크립트 실행 후 dev 환경에서 `/dashboard` 를 새로고침하면:

- 지도 위에 차량 핀 5개 (서울 시내 분산)
- 충전소 핀 3개 (강남/광화문/홍대)
- 차량 마커 클릭 시 디테일 패널 노출

`/api/dashboard/map-state` 응답에 `bikePins.length === 5`, `stationPins.length === 3` 인지
DevTools Network 탭에서 확인 가능.

### 시드 정리 (로컬 dev 만)

가장 안전한 방법은 **로컬 dev DB 자체를 초기화**하는 것:

```bash
# Flyway clean 또는 db drop & recreate (운영자 본인 환경에서만)
```

특정 시드 행만 삭제하려는 경우, 시드 행은 `aaaa0000-…` / `bbbb0000-…` /
`cccc0000-…` / `eeee0000-…` UUID prefix 로 식별 가능하다. **운영 DB 에는
이 prefix 가 들어 있을 수 없으므로** 잘못 실행해도 운영 행은 영향받지 않지만,
DELETE 쿼리는 신중히 작성하고 운영자 본인이 직접 한다.

### 운영 환경 보호

스크립트는 다음 단계로 운영 시드를 차단한다:

1. **호스트 화이트리스트** (`localhost`, `127.0.0.1`, `*.local`) 외에는 기본 거부.
2. `*.sslip.io` 같은 모호한 suffix 는 의도적으로 화이트리스트에서 제외 — 운영
   `thundercrew-domain.43.201.57.147.sslip.io` 가 sslip.io 이기 때문.
3. 옵트인(`SEED_FORCE_REMOTE=true`)은 명시적 환경변수 + 경고 로그.
4. `ADMIN_PASSWORD` 가 운영 비밀번호일 경우 `/auth/login` 자체는 통과하지만,
   운영 자격증명을 환경변수에 넣지 말 것 — **운영 시드는 정식 운영자 절차** 로만.
