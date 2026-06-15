# 정비 관리 페이지 + 휠타입×엔진 2축 카탈로그 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 정비 카탈로그(항목·주기) 편집을 좌측 레일의 **정비 관리** 페이지(`/management/maintenance`)로 되살리고, 분류 기준을 엔진 축(전기/내연)만에서 **휠타입(2륜/4륜) × 엔진(전기/내연) 2축**으로 확장한다.

**Architecture:** `MaintenanceItem`에 휠 축(`appliesToWheel`) 독립 컬럼 추가(엔진 축 `appliesTo` 유지). 차량별 적용 = 엔진 매치 AND 휠 매치. 미마운트 편집기 `MaintenancePanel`을 신규 라우트에 마운트 + 레일 4번째 항목. V37 add-column(기본 BOTH) → 안전.

**Tech Stack:** Spring Boot (Java 21), Flyway, JPA, Next.js App Router, TypeScript.

**비범위:** 정비 이력 기록 UI(기존 유지), 정비 알림, 4조합 단일 enum(2축 독립 채택), serviceType 연계.

---

## 1. 백엔드 — 휠 축 추가

`com.thundercrew.opsapi.maintenance`:
- **신규 enum** `MaintenanceWheelApplies { TWO_WHEEL, FOUR_WHEEL, BOTH }` (엔진 `MaintenanceAppliesTo`와 대칭).
- **`MaintenanceItem`**: 필드 `appliesToWheel`(EnumType.STRING, varchar(20), NOT NULL) 추가. 팩토리/생성자에 반영.
- **V37 마이그레이션** `V37__add_maintenance_applies_to_wheel.sql`:
  ```sql
  alter table maintenance_items add column applies_to_wheel varchar(20) not null default 'BOTH';
  alter table maintenance_items add constraint ck_maintenance_items_applies_to_wheel
      check (applies_to_wheel in ('TWO_WHEEL', 'FOUR_WHEEL', 'BOTH'));
  ```
  (기본 'BOTH'로 기존 항목 전 휠 적용. add-column + check 동시 — 기존 행이 모두 default 'BOTH'라 check 위반 없음. V36 같은 값-재브랜드 아님.)
- **차량별 필터** `MaintenanceReadService.listItemsForBike`: 엔진 목록(전기→ELECTRIC,BOTH / 내연→ICE,BOTH) + 휠 목록(2륜→TWO_WHEEL,BOTH / 4륜→FOUR_WHEEL,BOTH) **둘 다** 매치하는 항목만. `Bike.getWheelType()` 사용. Repository에 `findByAppliesToInAndAppliesToWheelInAndDeletedAtIsNull...OrderByDisplayOrderAsc` 추가(또는 기존 쿼리 확장).
- **DTO**: `MaintenanceItemReadResponse`/`MaintenanceItemCreateRequest`/`MaintenanceItemUpdateRequest`에 `appliesToWheel`(생성은 `@NotNull`, 수정은 nullable) 추가.
- **테스트**: 2륜·전기 / 4륜·내연 / 공통(BOTH) 조합 시드 → `listItemsForBike`가 차량의 (엔진,휠) 조합에 맞는 항목만(+공통) 반환. create/update가 appliesToWheel 저장.

## 2. 프론트 — 정비 관리 페이지 + 레일

- **신규 라우트** `app/management/maintenance/page.tsx`: 카탈로그 SSR 로드(기존 데이터 로더 재사용 — 전체 `maintenance-items` 목록) + `<MaintenancePanel items={...} />` 마운트. `export const dynamic = "force-dynamic"`.
- **AppShell 레일**: NAV에 4번째 `{ href: "/management/maintenance", label: "정비 관리", icon: <정비 SVG> }` 추가. active 판정 기존 로직(startsWith) 그대로.

## 3. 프론트 — 편집기 (안 A: 엔진 3섹션 + 휠 배지/필드)

- **`MaintenancePanel`**: 기존 엔진 3섹션(전기 전용 / 내연 전용 / 공통) 유지. 각 항목 행에 **휠타입 배지/컬럼**(2륜/4륜/공통) 추가.
- **`MaintenanceItemDetailDialog`**: 생성·수정 폼에 **휠타입 select**(2륜/4륜/공통) 추가.
- **서버액션**(`app/actions.ts`) `createMaintenanceItemAction`/`updateMaintenanceItemAction`: `appliesToWheel` 폼 파싱(`parseAppliesToWheel`)·전달. redirect를 stale `/?tab=maintenance` → **`/management/maintenance`** 로 수정(create/update/delete 모두).
- **클라이언트 타입** `ServiceOpsMaintenanceItem` + 신규 `ServiceOpsMaintenanceWheelApplies = "TWO_WHEEL" | "FOUR_WHEEL" | "BOTH"` + create/update 메서드 payload에 `appliesToWheel` 추가.

## 4. 프론트 — 차량 상세 / 요약 derive
- **차량 상세**: 번들 items는 `listMaintenanceItemsForBike`(백엔드, §1에서 엔진+휠 필터됨) → `deriveMaintenanceRows` **무변경**(이미 필터된 항목만 받음).
- **요약** `summarizeMaintenanceByBike`(app/page.tsx): 현재 `bikeEngineTypeById: Map<id,engine>`로 엔진만 필터. → `Map<id,{engine,wheel}>`(또는 wheel 맵 추가)로 확장해 엔진+휠 필터. `app/page.tsx` 호출부에서 각 bike의 wheelType 전달.

## 5. 데이터 흐름
```
정비 관리 페이지 → maintenance-items 전체 → MaintenancePanel(엔진 섹션 + 휠 배지) → 생성/수정(엔진+휠 select) → CRUD API(appliesTo + appliesToWheel)
차량 상세 → listMaintenanceItemsForBike(엔진∈{차량엔진,BOTH} AND 휠∈{차량휠,BOTH}) → derive(무변경)
```

## 6. 검증
- 백엔드 `compileJava + compileTestJava`(2축 필터 계약 테스트). 프론트 `typecheck + lint + build`.
- 프로덕션 QA: 레일 "정비 관리" → 페이지 진입, 항목 생성/수정 시 엔진+휠 지정, 항목 행에 휠 배지, 차량 상세 정비가 차량의 (엔진,휠) 조합 항목만 노출. **마이그레이션 V37(add-column) 재기동 적용.**

## 7. 비범위 재확인
정비 이력 기록 UI, 정비 알림, 단일 4조합 enum, serviceType 연계는 포함하지 않는다.
