# 정비 카탈로그 단일 4분류(2륜전기/2륜내연/4륜전기/4륜내연) 재설계 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement the plan derived from this spec.

**Goal:** 정비 카탈로그 분류를 2축 독립(엔진 전기/내연/공통 × 휠 2륜/4륜/공통)에서 **단일 4분류 다중선택**(2륜전기 / 2륜내연 / 4륜전기 / 4륜내연)으로 바꾸고, 부수 컬럼(라벨·정렬·활성·그룹부모)을 제거해 카탈로그를 단순·명확화한다.

**핵심 결정(사용자 확정):**
- 분류 = `MaintenanceCategory { TWO_WHEEL_ELECTRIC, TWO_WHEEL_ICE, FOUR_WHEEL_ELECTRIC, FOUR_WHEEL_ICE }`.
- 항목당 **분류 다중 선택**(한 항목이 여러 분류 보유 가능). 예: 브레이크패드=4분류 전부.
- `applies_to`(엔진) + `applies_to_wheel`(휠) 두 컬럼은 이 4분류로 **대체·제거**.
- 추가 제거 컬럼: `parent_item_id`(그룹), `cycle_label`, `display_order`, `enabled`.
- 정렬은 품목명 오름차순. 그룹/활성 개념 제거.

**Architecture:** 정비항목 ↔ 분류 다대다 = `maintenance_item_categories` element-collection 테이블. 차량별 필터 = 차량의 (휠,엔진)으로 1개 분류 산출 → 그 분류를 포함한 항목만 반환. V38 마이그레이션은 **신규 테이블에 기존 2축 교차곱 백필 → 구 컬럼 drop** 순서(백필 후 drop이라 제약 위반 창 없음).

**Tech Stack:** Spring Boot(Java 21), Flyway, JPA(@ElementCollection), Next.js, TS.

**비범위:** 정비 이력 기록 UI, 알림, serviceType 연계, 정비 항목 표시 순서 커스터마이즈(품명순 고정), 그룹/하위 항목 계층(제거됨).

---

## 1. 백엔드 — 4분류 다중선택

`com.thundercrew.opsapi.maintenance`:

- **신규 enum** `MaintenanceCategory { TWO_WHEEL_ELECTRIC, TWO_WHEEL_ICE, FOUR_WHEEL_ELECTRIC, FOUR_WHEEL_ICE }`.
- **`MaintenanceItem`**:
  - 제거 필드: `appliesTo`, `appliesToWheel`, `parentItemId`, `cycleLabel`, `displayOrder`, `enabled`(+ 관련 getter).
  - 추가: `@ElementCollection(fetch = EAGER) @CollectionTable(name="maintenance_item_categories", joinColumns=@JoinColumn(name="maintenance_item_id")) @Column(name="category") @Enumerated(EnumType.STRING) private Set<MaintenanceCategory> categories = new HashSet<>();` + `getCategories()`.
  - `create(...)`/`updateCatalog(...)` 시그니처에서 제거 필드 파라미터 삭제, `Set<MaintenanceCategory> categories` 추가. updateCatalog은 categories non-null일 때 교체.
- **V38 마이그레이션** `V38__maintenance_single_category.sql` (순서 엄수):
  1. `create table maintenance_item_categories (maintenance_item_id uuid not null references maintenance_items(id), category varchar(40) not null, primary key (maintenance_item_id, category));`
  2. 그룹 헤더 행 소프트삭제: `update maintenance_items set deleted_at = now() where deleted_at is null and id in (select distinct parent_item_id from maintenance_items where parent_item_id is not null);`
  3. 교차곱 백필(live 행만) — 4개 INSERT…SELECT:
     - TWO_WHEEL_ELECTRIC: `applies_to in ('ELECTRIC','BOTH') and applies_to_wheel in ('TWO_WHEEL','BOTH')`
     - TWO_WHEEL_ICE: `applies_to in ('ICE','BOTH') and applies_to_wheel in ('TWO_WHEEL','BOTH')`
     - FOUR_WHEEL_ELECTRIC: `applies_to in ('ELECTRIC','BOTH') and applies_to_wheel in ('FOUR_WHEEL','BOTH')`
     - FOUR_WHEEL_ICE: `applies_to in ('ICE','BOTH') and applies_to_wheel in ('FOUR_WHEEL','BOTH')`
     (각 `where deleted_at is null` 포함)
  4. 구 컬럼 제거(컬럼 drop 시 해당 check/FK 자동 제거): `alter table maintenance_items drop column applies_to;` / `drop column applies_to_wheel;` / `drop column parent_item_id;` / `drop column cycle_label;` / `drop column display_order;` / `drop column enabled;`
  - 백필이 drop보다 먼저라 제약 위반 창 없음(값-재브랜드 아님).
- **Repository** `MaintenanceItemRepository`:
  - 제거: `findByAppliesToIn...` 계열(2축 메서드들).
  - 추가: 전체 카탈로그 `@Query("select distinct i from MaintenanceItem i where i.deletedAt is null order by i.name asc")` (또는 derived `findByDeletedAtIsNullOrderByNameAsc`).
  - 추가: 차량 분류 필터 `@Query("select distinct i from MaintenanceItem i join i.categories c where c = :category and i.deletedAt is null order by i.name asc")`.
- **`MaintenanceReadService`**:
  - `listItemsForBike(bikeId)`: 차량의 `wheelType`+`engineType` → `MaintenanceCategory` 1개 산출(헬퍼) → 분류 필터 쿼리로 반환.
  - 전체 목록 메서드(카탈로그 페이지용)는 품명순 쿼리 사용.
- **DTO**:
  - `MaintenanceItemReadResponse`: 제거 필드 삭제, `Set<MaintenanceCategory> categories` 추가(`from`에서 `item.getCategories()`).
  - `MaintenanceItemCreateRequest`: `@NotEmpty Set<MaintenanceCategory> categories`(+ name, cycleKm, cycleMonths, memo). 제거 필드 삭제.
  - `MaintenanceItemUpdateRequest`: `Set<MaintenanceCategory> categories`(nullable) + 잔여 필드.
- **`MaintenanceCommandService`** create/update: categories 전달, 제거 필드 미사용.
- **테스트**: 다분류 항목 생성/수정(categories 저장·교체), `listItemsForBike` — 2륜전기 차량은 categories에 TWO_WHEEL_ELECTRIC 포함 항목만(4분류 전부 항목 포함, 2륜내연-only 항목 제외). 품명순 정렬.

## 2. 프론트 — 타입 / 액션

`development/front-admin-web`:
- **타입** `service-ops-api.ts`: `ServiceOpsMaintenanceCategory = "TWO_WHEEL_ELECTRIC"|"TWO_WHEEL_ICE"|"FOUR_WHEEL_ELECTRIC"|"FOUR_WHEEL_ICE"`. `ServiceOpsMaintenanceItem`에서 `appliesTo`·`appliesToWheel`·`cycleLabel`·`displayOrder`·`enabled`·`parentItemId` 제거, `categories: ServiceOpsMaintenanceCategory[]` 추가. `ServiceOpsMaintenanceAppliesTo`/`...WheelApplies` 타입 제거. Create/Update Input: `categories` 배열로 교체, 제거 필드 삭제.
- **서버액션** `app/actions.ts`: `parseAppliesTo`/`parseAppliesToWheel` 제거, `parseCategories(formData.getAll("categories"))`(4값 검증, 최소 1개) 추가. create/update가 categories 전달. 제거 필드 파싱 삭제. cycle 최소1 검증은 유지(km/months 중 하나 — label 제거됐으므로 둘 중 하나 필수). redirect/revalidate `/management/maintenance` 유지.

## 3. 프론트 — 패널 / 다이얼로그

- **`MaintenancePanel`**: 섹션을 **4분류**(2륜전기/2륜내연/4륜전기/4륜내연)로. 각 섹션 = `items.filter(i => i.categories.includes(cat))`(중복 표시 OK). 정렬 품명순. 표 컬럼: 삭제 / 품목 / 교환주기 (휠·그룹부모·활성 컬럼 제거). 섹션별 "+ 항목 추가" 버튼은 해당 분류가 미리 체크된 생성 폼 오픈.
- **`MaintenanceItemDetailDialog`**:
  - 보기: 품목 / 분류(체크된 4분류 라벨 나열) / 교환주기(km) / 교환주기(개월).
  - 생성·수정 폼: 적용·휠 select·그룹부모·정렬·활성·라벨 입력 전부 제거 → **분류 체크박스 4개**(`name="categories"`, 다중) + 품목 + 교환주기 km/개월. 생성 시 진입 분류 프리체크. 최소 1개 분류 필요(클라이언트 required 표시는 선택, 서버가 최종 검증).
  - 사용 안 하게 된 헬퍼(appliesToLabel 등) 정리.

## 4. 프론트 — 요약 derive / 차량 상세

- **`vehicle-maintenance-derive.ts`** `summarizeMaintenanceByBike`: 엔진/휠 맵 파라미터 제거 → `bikeCategoryById: Map<string, ServiceOpsMaintenanceCategory>`로 변경. 항목 적용 = `item.categories.includes(bikeCategory)`. 카운트 로직 유지. `deriveMaintenanceRows`는 백엔드 선필터라 타입 외 무변경.
- **`app/page.tsx`**: 차량 목록에서 `bikeCategoryById` 구성(wheelType+engineType→category, 미상은 2륜전기 fallback = 백엔드 기본과 일치) 후 전달.
- **`vehicle-maintenance-data.ts`**: 타입만 영향. `listMaintenanceItemsForBike`(백엔드 분류 선필터) 사용 유지.

## 5. 데이터 흐름
```
카탈로그 페이지 → 전체 items(품명순, categories 보유) → 4섹션 분배 → 생성/수정(분류 체크박스) → CRUD(categories[])
차량 상세 → listItemsForBike(차량 category 포함 항목) → derive(무변경)
```

## 6. 검증
- 백엔드 compileJava + compileTestJava(분류 필터·다분류 저장 계약 테스트). 프론트 typecheck+lint+build.
- 프로덕션 QA: 4섹션 노출, 공통 항목이 해당 섹션들에 중복 표시, 생성 시 분류 다중 체크 저장, 차량 상세가 차량 분류 항목만, **V38 백필로 기존 분류 보존**.

## 7. 비범위 재확인
정비 이력, 알림, serviceType 연계, 표시 순서 커스터마이즈, 그룹/계층은 포함하지 않는다. 되돌릴 수 없는 스키마 변경(컬럼 6개 + 그룹 헤더 행 삭제)이나 백필로 분류 정보는 보존.
