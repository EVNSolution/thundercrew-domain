# 휠타입별 지도 마커 아이콘 (2륜 오토바이 / 4륜 박스트럭) Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 지도 차량 마커 아이콘을 차량의 `wheelType`에 따라 분기한다 — `TWO_WHEEL` → 기존 오토바이, `FOUR_WHEEL` → 박스트럭(물류차량) 아이콘.

**Architecture:** `bikes.wheel_type`(이미 존재, `NOT NULL DEFAULT 'TWO_WHEEL'`)를 대시보드 핀까지 전달하고, 프론트 `bikeIconSvg(wheelType)`에서 아이콘을 분기한다. 마이그레이션 없음.

**Tech Stack:** Spring Boot (Java 21), JPA/JDBC, Next.js, TypeScript, NCP Maps.

**비범위:** 충전소/팁 마커 아이콘, 관리 테이블 행 아이콘, 휠타입 기반 필터, 새 컬럼/마이그레이션.

---

## 1. 백엔드 — wheelType을 대시보드 핀까지 전달

`com.thundercrew.opsapi.dashboard`:

- **`DashboardMapQueryRepository.findCurrentBikeStates`**: bike pin SELECT에 `b.wheel_type` 추가. `mapBikePinRow`에서 `BikeWheelType.valueOf(rs.getString("wheel_type"))` 매핑.
- **`BikePinRow`** record: `BikeWheelType wheelType` 필드 추가.
- **`DashboardMapStateService.toBikePin`**: `BikePin` 생성 시 `row.wheelType()` 전달.
- **`DashboardMapStateResponse.BikePin`** record: `BikeWheelType wheelType` 필드 추가(JSON 직렬화 → `"TWO_WHEEL"`/`"FOUR_WHEEL"`).
- 요약 카운트·다른 핀 로직 무변경. (`BikeWheelType` enum 이미 존재: `{TWO_WHEEL, FOUR_WHEEL}`.)

## 2. 프론트 — 타입 + 아이콘 분기

`development/front-admin-web`:

- **`service-ops-api.ts`**: `ServiceOpsDashboardBikePin`에 `wheelType?: ServiceOpsBikeWheelType` 추가(이미 `ServiceOpsBikeWheelType = "TWO_WHEEL" | "FOUR_WHEEL"` 존재). `FrontendDashboardBikePin`은 Omit 대상이 아니므로 자동 포함 — 확인.
- **`MapShell.tsx`**:
  - `bikeIconSvg()` → `bikeIconSvg(wheelType?: string)`로 변경. `wheelType === "FOUR_WHEEL"` 이면 박스트럭 SVG, 그 외(undefined 포함) 기존 오토바이 SVG 반환.
  - 박스트럭 SVG(viewBox 0 0 24 24, 기존 `ICON_SVG_PROPS` 스타일 재사용):
    ```
    <path d="M2.5 16 V7.5 H13 V16"/>
    <path d="M13 10.5 H16.5 L20.5 13.5 V16 H13"/>
    <path d="M2.5 16 H4.3"/>
    <path d="M8.2 16 H14.8"/>
    <path d="M18.7 16 H20.5"/>
    <path d="M16.5 10.7 V13.5 H20.2"/>
    <circle cx="6.3" cy="17.6" r="1.9"/>
    <circle cx="16.8" cy="17.6" r="1.9"/>
    ```
  - `bikeMarkerHtml`에서 `markerWrapper(bikeIconSvg(...), ...)` 호출 시 `wheelType`을 받아 전달. `bikeMarkerHtml` 시그니처에 `wheelType?: string` 인자 추가 + 호출부(약 라인 468)에서 `pin.wheelType` 전달.

## 3. 동작 / 엣지
- `wheel_type` NOT NULL DEFAULT TWO_WHEEL → null 없음. 방어적으로 `FOUR_WHEEL`이 아니면 오토바이.
- 시뮬 차량(`useSimulatedBikePins`): raw 핀을 `{ ...pin }` spread하므로 `wheelType` 자동 상속. 시뮬 코드 변경 불필요.
- 선택 halo / 상태 칩 / 배송 배지 / 라벨 등 마커의 나머지 로직 무변경.

## 4. 검증
- 백엔드 `compileJava + compileTestJava`. 대시보드 계약 테스트에 wheelType 노출 단언 추가(2륜·4륜 시드 → 핀 응답 `wheelType` 확인).
- 프론트 `typecheck + lint + build`.
- 프로덕션 QA: 4륜 차량(청소차) 마커가 박스트럭 아이콘으로, 2륜(배송)은 오토바이로 표시.

## 5. 비범위 재확인
충전소/팁 아이콘, 관리 테이블 아이콘, 휠타입 필터, 마이그레이션은 포함하지 않는다.
