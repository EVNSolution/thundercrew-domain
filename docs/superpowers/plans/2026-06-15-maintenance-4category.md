# 정비 카탈로그 단일 4분류 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** 정비 분류를 2축(엔진×휠)에서 단일 4분류 다중선택(2륜전기/2륜내연/4륜전기/4륜내연)으로 전환, 부수 컬럼 제거.

**Architecture:** 정비항목↔분류 다대다 = `maintenance_item_categories` element-collection. 차량별 필터 = 차량(휠,엔진)→분류 1개→포함 항목 반환. V38 = 신규테이블 백필(2축 교차곱) 후 구 컬럼 drop.

**Tech Stack:** Spring Boot Java21, Flyway, JPA, Next.js, TS. 브랜치 `cc-maintenance-4category`. Bash 절대경로 cd. 백엔드 게이트 `compileJava compileTestJava`. 프론트 typecheck/lint/build.

---

### Task 1: 백엔드 4분류 전면 전환

**Files:**
- Create: `.../maintenance/domain/MaintenanceCategory.java`
- Create: `.../resources/db/migration/V38__maintenance_single_category.sql`
- Modify: `.../maintenance/domain/MaintenanceItem.java`
- Modify: `.../maintenance/repository/MaintenanceItemRepository.java`
- Modify: `.../maintenance/service/MaintenanceReadService.java`
- Modify: `.../maintenance/service/MaintenanceCommandService.java`
- Modify: `.../maintenance/dto/MaintenanceItemReadResponse.java`, `MaintenanceItemCreateRequest.java`, `MaintenanceItemUpdateRequest.java`
- Delete: `.../maintenance/domain/MaintenanceWheelApplies.java`, `MaintenanceAppliesTo.java` (참조 모두 제거 후)
- Test: maintenance 계약 테스트

- [ ] **Step 1: enum**
```java
package com.thundercrew.opsapi.maintenance.domain;
public enum MaintenanceCategory { TWO_WHEEL_ELECTRIC, TWO_WHEEL_ICE, FOUR_WHEEL_ELECTRIC, FOUR_WHEEL_ICE }
```

- [ ] **Step 2: V38 마이그레이션** (순서 엄수)
```sql
create table maintenance_item_categories (
    maintenance_item_id uuid not null references maintenance_items(id),
    category varchar(40) not null,
    primary key (maintenance_item_id, category)
);
-- 그룹 헤더(부모) 행 소프트삭제 — 계층 제거로 무의미
update maintenance_items set deleted_at = now()
 where deleted_at is null
   and id in (select distinct parent_item_id from maintenance_items where parent_item_id is not null);
-- 기존 2축 → 4분류 교차곱 백필 (live 행만)
insert into maintenance_item_categories (maintenance_item_id, category)
 select id, 'TWO_WHEEL_ELECTRIC' from maintenance_items
  where deleted_at is null and applies_to in ('ELECTRIC','BOTH') and applies_to_wheel in ('TWO_WHEEL','BOTH');
insert into maintenance_item_categories (maintenance_item_id, category)
 select id, 'TWO_WHEEL_ICE' from maintenance_items
  where deleted_at is null and applies_to in ('ICE','BOTH') and applies_to_wheel in ('TWO_WHEEL','BOTH');
insert into maintenance_item_categories (maintenance_item_id, category)
 select id, 'FOUR_WHEEL_ELECTRIC' from maintenance_items
  where deleted_at is null and applies_to in ('ELECTRIC','BOTH') and applies_to_wheel in ('FOUR_WHEEL','BOTH');
insert into maintenance_item_categories (maintenance_item_id, category)
 select id, 'FOUR_WHEEL_ICE' from maintenance_items
  where deleted_at is null and applies_to in ('ICE','BOTH') and applies_to_wheel in ('FOUR_WHEEL','BOTH');
-- 구 컬럼 제거 (컬럼 drop이 관련 check/FK 자동 제거)
alter table maintenance_items drop column applies_to;
alter table maintenance_items drop column applies_to_wheel;
alter table maintenance_items drop column parent_item_id;
alter table maintenance_items drop column cycle_label;
alter table maintenance_items drop column display_order;
alter table maintenance_items drop column enabled;
```
(백필이 drop보다 먼저 → 제약 위반 창 없음.)

- [ ] **Step 3: 엔티티 `MaintenanceItem`**
  - 필드 제거: `appliesTo`, `appliesToWheel`, `parentItemId`, `cycleLabel`, `displayOrder`, `enabled` + 관련 getter.
  - 추가:
    ```java
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "maintenance_item_categories",
        joinColumns = @JoinColumn(name = "maintenance_item_id"))
    @Column(name = "category")
    @Enumerated(EnumType.STRING)
    private Set<MaintenanceCategory> categories = new HashSet<>();
    public Set<MaintenanceCategory> getCategories() { return categories; }
    ```
  - `create(String name, Set<MaintenanceCategory> categories, Integer cycleKm, Integer cycleMonths, String memo)` — 제거 필드 파라미터 삭제, `item.categories = new HashSet<>(categories);`.
  - `updateCatalog(String name, Set<MaintenanceCategory> categories, Integer cycleKm, Integer cycleMonths, String memo)` — name/cycle은 기존 null-guard 패턴, `if (categories != null && !categories.isEmpty()) { this.categories = new HashSet<>(categories); }`.
  - import `java.util.Set`, `HashSet`, jakarta persistence 어노테이션.

- [ ] **Step 4: Repository**
  - 2축 메서드 제거(`findByAppliesToIn...AppliesToWheelIn...`, `findByAppliesToIn...`).
  - 추가:
    ```java
    @Query("select distinct i from MaintenanceItem i where i.deletedAt is null order by i.name asc")
    List<MaintenanceItem> findAllLiveOrderByName();

    @Query("select distinct i from MaintenanceItem i join i.categories c where c = :category and i.deletedAt is null order by i.name asc")
    List<MaintenanceItem> findByCategory(MaintenanceCategory category);
    ```

- [ ] **Step 5: ReadService**
  - 전체 카탈로그 조회 메서드 → `findAllLiveOrderByName()`.
  - `listItemsForBike(bikeId)`: 헬퍼로 차량 분류 산출 후 `findByCategory`:
    ```java
    MaintenanceCategory category = toCategory(bike.getWheelType(), bike.getEngineType());
    return itemRepository.findByCategory(category).stream().map(MaintenanceItemReadResponse::from).toList();
    ```
    헬퍼:
    ```java
    private static MaintenanceCategory toCategory(BikeWheelType wheel, BikeEngineType engine) {
        boolean four = wheel == BikeWheelType.FOUR_WHEEL;
        boolean ice = engine == BikeEngineType.ICE;
        if (four) return ice ? MaintenanceCategory.FOUR_WHEEL_ICE : MaintenanceCategory.FOUR_WHEEL_ELECTRIC;
        return ice ? MaintenanceCategory.TWO_WHEEL_ICE : MaintenanceCategory.TWO_WHEEL_ELECTRIC;
    }
    ```

- [ ] **Step 6: DTO**
  - `MaintenanceItemReadResponse`: 제거 필드 컴포넌트 삭제, `Set<MaintenanceCategory> categories` 추가, `from`에서 `item.getCategories()` 매핑. (잔여: id, name, cycleKm, cycleMonths, memo, categories.)
  - `MaintenanceItemCreateRequest`: `@NotEmpty Set<MaintenanceCategory> categories` + name(@NotBlank)/cycleKm/cycleMonths/memo. 제거 필드 삭제. (`@NotEmpty` import: jakarta.validation.constraints.)
  - `MaintenanceItemUpdateRequest`: `Set<MaintenanceCategory> categories`(nullable) + 잔여 필드.

- [ ] **Step 7: CommandService**
  - createItem: `MaintenanceItem.create(request.name(), request.categories(), request.cycleKm(), request.cycleMonths(), request.memo())`.
  - updateItem: `item.updateCatalog(request.name(), request.categories(), request.cycleKm(), request.cycleMonths(), request.memo())`.

- [ ] **Step 8: 구 enum 삭제 + 컴파일**
  - 모든 참조 제거 후 `MaintenanceWheelApplies.java`, `MaintenanceAppliesTo.java` 삭제.
  ```bash
  cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
  ```

- [ ] **Step 9: 계약 테스트 갱신**
  - 기존 maintenance 테스트(`MaintenanceItemApiContractTests`)를 4분류로 재작성: create가 categories 저장(다분류), update가 categories 교체, `GET /bikes/{id}/maintenance-items`가 차량 분류 포함 항목만(4분류 전부 항목 포함, 다른 단일분류 항목 제외), 품명순. `@NotEmpty` categories 누락 시 4xx.
  ```bash
  cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
  ```

- [ ] **Step 10: 커밋**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src && git commit -m "feat(maintenance): single 4-category model (V38) + per-bike category filter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 프론트 타입 + 액션 + 패널 + 다이얼로그

**Files:**
- Modify: `lib/services/service-ops-api.ts`, `app/actions.ts`, `components/management/MaintenancePanel.tsx`, `components/management/MaintenanceItemDetailDialog.tsx`

- [ ] **Step 1: 타입** `service-ops-api.ts`
  - `export type ServiceOpsMaintenanceCategory = "TWO_WHEEL_ELECTRIC" | "TWO_WHEEL_ICE" | "FOUR_WHEEL_ELECTRIC" | "FOUR_WHEEL_ICE";`
  - `ServiceOpsMaintenanceItem`: `appliesTo`/`appliesToWheel`/`cycleLabel`/`displayOrder`/`enabled`/`parentItemId` 제거, `categories: ServiceOpsMaintenanceCategory[]` 추가. (잔여: id, name, cycleKm, cycleMonths, memo, categories.)
  - `ServiceOpsMaintenanceAppliesTo`, `ServiceOpsMaintenanceWheelApplies` 타입 삭제.
  - Create/Update Input 타입: 제거 필드 삭제, `categories: ServiceOpsMaintenanceCategory[]`(update는 optional). create/update 메서드 바디는 input 객체 전체 직렬화면 자동 반영.

- [ ] **Step 2: 액션** `app/actions.ts`
  - `parseAppliesTo`/`parseAppliesToWheel` 및 import 제거.
  - `parseCategories(values: FormDataEntryValue[]): ServiceOpsMaintenanceCategory[]` 추가 — 4값만 통과, 빈 배열 시 create는 `redirect("/management/maintenance?status=maintenance-item-invalid-applies-to")`.
  - create/update: `const categories = parseCategories(formData.getAll("categories"));` 후 payload `categories` 전달. 제거 필드 파싱 삭제.
  - cycle 검증: `cycleKm === null && cycleMonths === null` 이면 `?status=maintenance-item-cycle-required`(label 제거됨).
  - redirect/revalidate `/management/maintenance` 유지.

- [ ] **Step 3: 패널** `MaintenancePanel.tsx`
  - 섹션 4개: `{key:"TWO_WHEEL_ELECTRIC",title:"2륜 전기"}`, `TWO_WHEEL_ICE:"2륜 내연"`, `FOUR_WHEEL_ELECTRIC:"4륜 전기"`, `FOUR_WHEEL_ICE:"4륜 내연"`.
  - 각 섹션 items = `sorted.filter(i => i.categories.includes(key))`; `sorted` = 품명순(`[...items].sort((a,b)=>a.name.localeCompare(b.name,"ko"))`).
  - 표 컬럼: 삭제 / 품목 / 교환주기 (휠·그룹부모·활성 제거). `renderCycle`는 km/months만(label 없음). 그룹 들여쓰기/parent 로직 제거.
  - 섹션별 "+ 항목 추가" → `onCreate(key)` (해당 분류 프리체크).
  - `createEngine` 상태 → `createCategory: ServiceOpsMaintenanceCategory | null`로 변경, 다이얼로그에 전달.
  - 미사용 import(wheelLabel 등) 정리.

- [ ] **Step 4: 다이얼로그** `MaintenanceItemDetailDialog.tsx`
  - prop `createEngine` → `createCategory?: ServiceOpsMaintenanceCategory | null`.
  - 보기 모드: 품목 / 분류(체크된 카테고리 라벨 쉼표 나열) / 교환주기(km) / 교환주기(개월).
  - 폼: 적용·휠 select, 그룹부모 select, 정렬, 활성, 라벨 입력 **전부 제거**. **분류 체크박스 4개**(`<input type="checkbox" name="categories" value="TWO_WHEEL_ELECTRIC" defaultChecked={...}>` 등 4개) + 품목 + 교환주기 km/개월.
    - 수정 모드 defaultChecked = `row.categories.includes(key)`. 생성 모드 = `key === createCategory`.
  - actions import: `createMaintenanceItemAction`(유지) — appliesTo 파싱 제거된 버전.
  - 라벨 헬퍼: `categoryLabel(c)`(2륜전기/2륜내연/4륜전기/4륜내연). 미사용 헬퍼(appliesToLabel/wheelAppliesLabel) 제거.

- [ ] **Step 5: (중간 빌드 생략 가능 — Task 3 후 전체 검증). 커밋**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/lib/services/service-ops-api.ts development/front-admin-web/app/actions.ts development/front-admin-web/components/management/MaintenancePanel.tsx development/front-admin-web/components/management/MaintenanceItemDetailDialog.tsx && git commit -m "feat(maintenance): 4-category sections + multi-check dialog + action wiring

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
(타입 변경으로 summarize/page 파일이 아직 깨질 수 있음 — 전체 typecheck는 Task 3에서.)

---

### Task 3: 요약 derive + page + 전체 검증

**Files:**
- Modify: `components/management/vehicle-maintenance-derive.ts`, `app/page.tsx`
- (확인) `lib/services/vehicle-maintenance-data.ts`(타입만 영향)

- [ ] **Step 1: summarize** `vehicle-maintenance-derive.ts`
  - `summarizeMaintenanceByBike(items, records, bikeCategoryById: Map<string, ServiceOpsMaintenanceCategory>, now=new Date())` — 기존 engine/wheel 맵 파라미터 제거.
  - 차량 적용 항목 = `items.filter(i => i.categories.includes(bikeCategoryById.get(bikeId) ?? "TWO_WHEEL_ELECTRIC"))`. 카운트/임박·지연 로직 유지.

- [ ] **Step 2: page** `app/page.tsx`
  - `bikeCategoryById` 구성: 각 bike의 `wheelType`+`engineType`→category (헬퍼 `bikeCategory(wheel,engine)`; 미상 wheel→TWO_WHEEL, 미상 engine→ELECTRIC = 2륜전기 fallback). `summarizeMaintenanceByBike` 호출부 인자 교체. 기존 engine/wheel 맵 구성 코드 제거.

- [ ] **Step 3: 전체 검증 + 커밋**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/management/vehicle-maintenance-derive.ts development/front-admin-web/app/page.tsx && git commit -m "feat(maintenance): summary applicability by single category

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 최종 검증 + PR

- [ ] **Step 1: 풀 검증**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
```
- [ ] **Step 2: PR (→dev)** — V38 백필/드롭, 4분류 전환 명시. push + `gh pr create --base dev`.

---

## Self-Review
- **스펙 커버리지:** enum/V38(백필+drop)/엔티티/repo/service필터/DTO/command/테스트(T1), 타입·액션·패널4섹션·다이얼로그체크박스(T2), summarize·page(T3), 검증·PR(T4). ✓
- **플레이스홀더:** enum/마이그레이션/엔티티/쿼리/필터헬퍼/페이지헬퍼 완전 코드. 패널·다이얼로그·DTO는 "기존 패턴 따라"이나 대상 명시.
- **타입 일관성:** 백엔드 `MaintenanceCategory` 4값 ↔ 프론트 `ServiceOpsMaintenanceCategory` 4값 동일. 테이블 `maintenance_item_categories(category)` ↔ enum STRING. `categories`(Set/array)로 전 계층 통일. 구 타입/메서드(appliesTo*, findByAppliesTo*) 전부 제거.
- **마이그레이션 안전:** 신규 테이블 백필 후 구 컬럼 drop(값-재브랜드 아님, 위반 창 없음). 그룹 헤더 소프트삭제는 drop 전.
- **구현자 주의:** 백엔드는 한 태스크에서 컴파일 유지(구 필드 참조 전부 제거해야 compileJava 통과). 프론트는 T2 중간 typecheck 실패 가능 — 전체 통과는 T3·T4. `@ElementCollection` EAGER로 단건 조회 시 categories 즉시 로드.
