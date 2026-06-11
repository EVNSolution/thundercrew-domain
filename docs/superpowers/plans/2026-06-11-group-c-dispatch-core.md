# Group C (C0+C2) — 배차 코어 + 엑셀 배차형 배송 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 차량(bike)에 종속된 배차(DispatchOrder) 큐를 full-stack으로 신규 구축하고, 엑셀로 배차형 배송 주문을 벌크 적재(담당 차량번호 명시)하며, 운영자가 콘솔에서 큐를 확인·완료 처리하고 현재 배차를 지도/차량 상세에 실데이터로 표시한다.

**Architecture:** 새 `com.thundercrew.opsapi.dispatch` 도메인을 기존 클리닝 `BikeNextCustomer`·프론트 시뮬레이션과 독립으로 만든다. 가장 가까운 기존 분석 대상: **Tip 도메인(V32, 가장 최근에 추가된 깨끗한 CRUD 도메인)**과 **BikeNextCustomer(bike-scoped + promote)**, **Group B bulk 인프라**(BikeBulkService/Controller, common bulk DTO, ExcelParser/Exporter, BulkPreviewModal/ExcelImportButton). 구현자는 이 파일들을 읽고 패턴을 그대로 미러링한다.

**Tech Stack:** Spring Boot (Java 21), Flyway, JPA `Repository<T,UUID>`, Apache POI, NCP Geocoding, Next.js App Router, NCP Maps SDK, TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-11-group-c-dispatch-core-design.md`

---

## 미러링 원칙 (모든 태스크 공통)

이 계획의 코드는 **가이드**다. 패키지 경로·getter 이름·DTO 컨벤션·검증 어노테이션은 반드시 실제 코드와 대조해 맞춘다. 각 태스크는 "어떤 기존 파일을 미러링하라"를 명시한다. 백엔드는 `com.thundercrew.opsapi.tip.*`(가장 최근 CRUD 도메인)와 `...bike.domain.BikeNextCustomer`/`...bike.controller.BikeNextCustomer*`/`...bike.service.BikeNextCustomer*`, bulk는 `...bike.*Bulk*` + `...common`의 bulk DTO/ExcelParser/ExcelExporter를 그대로 따른다.

**경로:** 백엔드 `development/service-ops-api`, 프론트 `development/front-admin-web`. 셸 cwd는 리셋되며 다른 레포가 기본 — 항상 `cd /c/Users/user/repositories/clever/thundercrew-domain/...` 절대경로. Windows + git-bash, `./gradlew`. 루트에서 `npm run typecheck|lint|build`.

**검증 주의 (이미 알려진 사실):**
- 백엔드 테스트는 Docker(Testcontainers) 필요. 없으면 `compileTestJava`까지만 하고 BLOCKED 보고.
- `ArchitectureBoundaryTests`는 dev에서 pre-existing red(타 도메인). 신규 컨트롤러는 Read/Command 분리 + `isDispatchCommand` allow-list 등록으로 **dispatch 관련 위반 0건**을 만들 것. (자기 도메인만 검증: `--tests "...DispatchOrderApiContractTests"`)
- 배포는 `bootJar -x test`라 테스트 스킵 → 마이그레이션/스키마 매핑 일치가 재기동 시 검증됨. 엔티티↔V33 컬럼 1:1 필수.

## 파일 구조

### 백엔드 신규 (`development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/`)
- `DispatchPackage.java`
- `domain/DispatchOrder.java`, `domain/DispatchOrderStatus.java`
- `repository/DispatchOrderRepository.java`
- `dto/DispatchOrderReadResponse.java`, `dto/DispatchOrderCreateRequest.java`
- `service/DispatchOrderReadService.java`, `service/DispatchOrderCommandService.java`, `service/DispatchOrderBulkService.java`
- `controller/DispatchOrderReadController.java`, `controller/DispatchOrderCommandController.java`
- `src/main/resources/db/migration/V33__create_dispatch_orders_table.sql`
- `src/main/resources/templates/excel/dispatch-template.xlsx`
- `src/test/java/com/thundercrew/opsapi/DispatchOrderApiContractTests.java`

### 백엔드 수정
- `dashboard/dto/DashboardMapStateResponse.java` (BikePin에 현재 배차 + 큐 수)
- `dashboard/service/DashboardMapStateService.java` (DispatchOrderRepository 주입, 집계)
- `src/test/java/com/thundercrew/opsapi/ArchitectureBoundaryTests.java` (`isDispatchCommand` allow-list)

### 프론트 신규/수정
- `lib/services/service-ops-api.ts` (타입 + 클라이언트 메서드 + BikePin 정규화)
- `app/dispatch/actions.ts` (서버 액션)
- `components/management/DispatchPanel.tsx` (관리 페이지 배차 섹션) + `app/management/page.tsx` 연결
- `components/management/Create... (불필요 — 엑셀 업로드 중심)` — ExcelImportButton/BulkPreviewModal 재사용
- `components/dashboard/MapShell.tsx` (배지 N 연결) — 또는 use-simulated-bike-pins
- `components/management/VehicleDetailDialog.tsx` (배차 큐 섹션 + 완료/취소)
- `app/globals.css` (배차 큐 섹션 스타일)

---

## Task 1: 백엔드 V33 마이그레이션 + DispatchOrder 도메인 + Repository + DTO

**Files:**
- Create: `.../dispatch/DispatchPackage.java`, `.../dispatch/domain/DispatchOrder.java`, `.../dispatch/domain/DispatchOrderStatus.java`, `.../dispatch/repository/DispatchOrderRepository.java`, `.../dispatch/dto/DispatchOrderReadResponse.java`, `.../dispatch/dto/DispatchOrderCreateRequest.java`
- Create: `src/main/resources/db/migration/V33__create_dispatch_orders_table.sql`

**미러링:** `tip/domain/Tip.java`, `tip/repository/TipRepository.java`, `tip/dto/Tip*.java`, `V32__create_tips_table.sql`. bike-scoped 필드(bikeId/sequence/status/completedAt)는 `bike/domain/BikeNextCustomer.java` 참고.

- [ ] **Step 1: 최신 마이그레이션 번호 확인** — `ls src/main/resources/db/migration/` 로 V33이 다음 번호인지 확인(아니면 올바른 Vxx로). 기존 `create table`(battery_stations/tips) 스타일 확인.

- [ ] **Step 2: V33 마이그레이션 작성** — `V33__create_dispatch_orders_table.sql`:

```sql
create table dispatch_orders (
    id             uuid             primary key,
    idx            bigserial        unique not null,
    bike_id        uuid             not null,
    customer_name  text             not null,
    customer_phone text             not null,
    address        text             not null,
    latitude       double precision not null,
    longitude      double precision not null,
    sequence       bigint           not null,
    status         varchar(20)      not null,
    completed_at   timestamptz,
    created_at     timestamptz      not null default now(),
    updated_at     timestamptz      not null default now(),
    deleted_at     timestamptz,
    created_by     uuid,
    updated_by     uuid,
    deleted_by     uuid,
    constraint ck_dispatch_orders_status check (status in ('ASSIGNED','COMPLETED'))
);
create index ix_dispatch_orders_bike_queue on dispatch_orders (bike_id, status, sequence) where deleted_at is null;
```
(주의: `tips` 테이블이 audit 컬럼 created_by/updated_by/deleted_by + id에 DB default 없음[Java 생성]을 썼다면 동일하게. 실제 V32를 열어 컬럼 셋·default 정책을 그대로 복제할 것.)

- [ ] **Step 3: `DispatchOrderStatus` enum**

```java
package com.thundercrew.opsapi.dispatch.domain;

public enum DispatchOrderStatus { ASSIGNED, COMPLETED }
```

- [ ] **Step 4: `DispatchOrder` 엔티티** — `DisplaySequencedEntity` 상속. `tip/domain/Tip.java`를 열어 어노테이션/생성자/팩토리 스타일을 그대로 미러링:

```java
@Entity
@Table(name = "dispatch_orders")
public class DispatchOrder extends DisplaySequencedEntity {
    @Column(nullable = false) private UUID bikeId;
    @Column(nullable = false, columnDefinition = "text") private String customerName;
    @Column(nullable = false, columnDefinition = "text") private String customerPhone;
    @Column(nullable = false, columnDefinition = "text") private String address;
    @Column(nullable = false) private double latitude;
    @Column(nullable = false) private double longitude;
    @Column(nullable = false) private long sequence;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private DispatchOrderStatus status;
    @Column private Instant completedAt;

    protected DispatchOrder() {}

    public static DispatchOrder create(UUID bikeId, String customerName, String customerPhone,
                                       String address, double latitude, double longitude, long sequence) {
        DispatchOrder o = new DispatchOrder();
        o.bikeId = bikeId; o.customerName = customerName; o.customerPhone = customerPhone;
        o.address = address; o.latitude = latitude; o.longitude = longitude;
        o.sequence = sequence; o.status = DispatchOrderStatus.ASSIGNED;
        return o;
    }
    public void complete(Instant when) { this.status = DispatchOrderStatus.COMPLETED; this.completedAt = when; }
    // getters: getBikeId/getCustomerName/getCustomerPhone/getAddress/getLatitude/getLongitude/getSequence/getStatus/getCompletedAt
}
```

- [ ] **Step 5: `DispatchOrderRepository`** (`Repository<DispatchOrder, UUID>`, NOT JpaRepository — `TipRepository` 미러링):

```java
public interface DispatchOrderRepository extends Repository<DispatchOrder, UUID> {
    List<DispatchOrder> findByBikeIdAndDeletedAtIsNullOrderBySequenceAsc(UUID bikeId);
    List<DispatchOrder> findByBikeIdAndStatusAndDeletedAtIsNullOrderBySequenceAsc(UUID bikeId, DispatchOrderStatus status);
    List<DispatchOrder> findByStatusAndDeletedAtIsNull(DispatchOrderStatus status); // dashboard 집계용
    Optional<DispatchOrder> findByIdAndDeletedAtIsNull(UUID id);
    Optional<DispatchOrder> findTopByBikeIdAndDeletedAtIsNullOrderBySequenceDesc(UUID bikeId); // append 시 max sequence
    DispatchOrder save(DispatchOrder o);
}
```

- [ ] **Step 6: DTO** — `DispatchOrderReadResponse`(record + `from(DispatchOrder)`, `tip/dto/TipReadResponse` 미러링; 필드: id, idx, bikeId, customerName, customerPhone, address, latitude, longitude, sequence, status, completedAt, createdAt). `DispatchOrderCreateRequest`(record; `@NotBlank @Size(255)` customerName/customerPhone/address[2000], `@DecimalMin/@DecimalMax` lat/lng, `@NotNull` bikeId, `@JsonIgnoreProperties(ignoreUnknown=true)` — `TipCreateRequest` 미러링).

- [ ] **Step 7: 컴파일** — `cd .../service-ops-api && ./gradlew compileJava` → BUILD SUCCESSFUL.

- [ ] **Step 8: 커밋** — `git add development/service-ops-api && git commit -m "feat: V33 dispatch_orders + DispatchOrder domain/repository/DTO"` (Co-Authored-By 트레일러 포함; `.superpowers/` 추가 금지).

---

## Task 2: 백엔드 DispatchOrder Read/Command 서비스

**Files:** Create `.../dispatch/service/DispatchOrderReadService.java`, `.../dispatch/service/DispatchOrderCommandService.java`

**미러링:** `tip/service/TipReadService.java`(@Transactional readOnly), `tip/service/TipCommandService.java`(@Transactional, Clock 주입, markDeleted, ResourceNotFoundException("...", id)).

- [ ] **Step 1: `DispatchOrderReadService`** — `@Service @Transactional(readOnly=true)`:
  - `listByBike(UUID bikeId)` → `repo.findByBikeIdAndDeletedAtIsNullOrderBySequenceAsc(bikeId).map(from)` (List)
  - `currentByBike(UUID bikeId)` → ASSIGNED 중 sequence 최소(`findByBikeIdAndStatus...` 의 first), Optional.

- [ ] **Step 2: `DispatchOrderCommandService`** — `@Service @Transactional`, `Clock` 주입 (`TipCommandService` 미러링):
  - `create(DispatchOrderCreateRequest req)` → 해당 bike의 max sequence+1 계산(`findTopBy...OrderBySequenceDesc`, 없으면 1), `DispatchOrder.create(...)` save, return `from`.
  - `complete(UUID id)` → `findByIdAndDeletedAtIsNull(id).orElseThrow(new ResourceNotFoundException("DispatchOrder", id))`, `order.complete(clock.instant())`, save.
  - `cancel(UUID id)` → find-or-404, `markDeleted(null, clock.instant())`(소프트 삭제), save.
  - `appendForBike(UUID bikeId, ...)` 내부 메서드 — bulk service가 재사용(sequence 계산 일원화).

- [ ] **Step 3: 컴파일** — `./gradlew compileJava` → SUCCESSFUL.
- [ ] **Step 4: 커밋** — `feat: DispatchOrder read/command services (append/complete/cancel)`.

---

## Task 3: 백엔드 컨트롤러 (Read/Command 분리) + ArchUnit allow-list

**Files:** Create `.../dispatch/controller/DispatchOrderReadController.java`, `.../dispatch/controller/DispatchOrderCommandController.java`. Modify `src/test/java/com/thundercrew/opsapi/ArchitectureBoundaryTests.java`.

**미러링:** `tip/controller/TipReadController.java` + `tip/controller/TipCommandController.java` + `ArchitectureBoundaryTests`의 `isTipCommand` 등록 방식(쓰기 라우트 규칙 + @RequestBody 규칙 둘 다).

- [ ] **Step 1: `DispatchOrderReadController`** — `@RestController @RequestMapping("/api/v1/dispatch-orders")`, 패키지-프라이빗 메서드:
  - `GET` (query `bikeId`) → `readService.listByBike(bikeId)` (또는 `/by-bike/{bikeId}`). `TipReadController` 스타일.

- [ ] **Step 2: `DispatchOrderCommandController`** — `@RestController @RequestMapping("/api/v1/dispatch-orders")`:
  - `POST` (`@Valid @RequestBody DispatchOrderCreateRequest`) → 201 `ResponseEntity.created(URI.create("/api/v1/dispatch-orders/"+id)).body(...)`
  - `POST /{id}/complete` → 200 또는 204, `commandService.complete(id)`
  - `DELETE /{id}` → 204 `noContent().build()`, `commandService.cancel(id)`
  - (bulk preview/apply는 Task 4의 bulk controller에서)

- [ ] **Step 3: ArchUnit allow-list** — `ArchitectureBoundaryTests.java`에서 `isStationCommand`/`isTipCommand` 패턴을 찾아 `isDispatchCommand`(owner = `...dispatch.controller.DispatchOrderCommandController`, 메서드 create/complete/delete + bulk)를 추가하고 **두 규칙(write-route, @RequestBody)** 모두에 wire. (Task 4의 bulk controller 메서드도 포함하도록 owner 매칭 범위 확인.)

- [ ] **Step 4: 컴파일 + arch 테스트** — `./gradlew compileJava` SUCCESSFUL. Docker 있으면 `./gradlew test --tests "com.thundercrew.opsapi.ArchitectureBoundaryTests"` → dispatch 관련 위반 0건 확인(타 도메인 pre-existing red는 무시). Docker 없으면 allow-list 등록을 코드 인스펙션으로 확인.
- [ ] **Step 5: 커밋** — `feat: DispatchOrder read/command controllers + arch allow-list`.

---

## Task 4: 백엔드 엑셀 벌크 (preview/apply) + 컨트롤러 + 템플릿 + 지오코딩

**Files:** Create `.../dispatch/service/DispatchOrderBulkService.java`, bulk endpoints (DispatchOrderCommandController에 `/bulk-preview`,`/bulk-apply` 추가 또는 별도 `DispatchOrderBulkController`), `src/main/resources/templates/excel/dispatch-template.xlsx`.

**미러링:** `bike/service/BikeBulkService.java`(preview/apply, 행 평가, BulkRowStatus 산출), `common`의 bulk DTO(`BulkRowStatus` UNCHANGED/UPDATE/NEW/ERROR, `BulkSummary`, preview/apply 응답), `common`의 `ExcelParser`/`ExcelExporter`, 컨트롤러는 `bike/controller/BikeBulkController.java`. 지오코딩은 station 등록 경로가 쓰는 방식을 그대로(서버 NCP geocoding 또는 기존 util).

- [ ] **Step 1: 기존 bulk 인프라 정독** — `BikeBulkService`/`BikeBulkController`, `common`의 bulk DTO + `ExcelParser`/`ExcelExporter`, station 주소 지오코딩 경로를 읽어 정확한 시그니처/메서드명 파악.

- [ ] **Step 2: 템플릿 생성** — `templates/excel/dispatch-template.xlsx`: 헤더 1행 = `차량번호 | 고객명 | 연락처 | 배송지주소`, 데이터는 2행부터(기존 `vehicles-template.xlsx` 규약과 동일: 시트 보호/헤더 락 여부 그대로). 기존 템플릿과 동일한 방식으로 만들 것(POI로 생성하거나 기존 템플릿 복제 후 헤더 수정).

- [ ] **Step 3: `DispatchOrderBulkService.preview(file)`** — `BikeBulkService` 미러링. 각 행:
  - col0 차량번호 → `bikeRepository.findByPlateNumberAndDeletedAtIsNull(plate)` 없으면 **ERROR**("차량 없음: {plate}")
  - col1 고객명, col2 연락처 — blank면 ERROR
  - col3 주소 → 지오코딩 시도, 실패 시 **ERROR**("주소 변환 실패: {address}")
  - 정상 행 = **NEW** (배차는 항상 신규 append; UPDATE 없음)
  - `BulkSummary` 집계 반환.

- [ ] **Step 4: `DispatchOrderBulkService.apply(file)`** — preview와 동일 평가 후, 정상(NEW) 행만 `commandService.appendForBike(bikeId, name, phone, address, lat, lng)`로 각 차량 큐에 ASSIGNED append. ERROR 행 스킵. `@Transactional`.

- [ ] **Step 5: bulk export** — 현재 ASSIGNED 주문을 `dispatch-template.xlsx` 형식으로 export(`ExcelExporter` + `BikeBulkService.export` 미러링): 차량번호/고객명/연락처/배송지주소.

- [ ] **Step 6: 컨트롤러 엔드포인트** — `POST /api/v1/dispatch-orders/bulk-preview`, `POST /bulk-apply`, `GET /bulk-export` (또는 기존 export 라우트 규약). `BikeBulkController` 미러링. arch allow-list에 이 메서드들 포함 확인(Task 3).

- [ ] **Step 7: 컴파일** — `./gradlew compileJava` SUCCESSFUL.
- [ ] **Step 8: 커밋** — `feat: DispatchOrder excel bulk preview/apply/export + template`.

---

## Task 5: 백엔드 Dashboard 확장 (현재 배차 + 큐 수)

**Files:** Modify `dashboard/dto/DashboardMapStateResponse.java`, `dashboard/service/DashboardMapStateService.java`.

**미러링:** serviceType/nextCustomer를 BikePin에 넣은 기존 확장(`DashboardMapStateResponse`의 BikePin nested record + `DashboardMapStateService` 주입/집계).

- [ ] **Step 1: 현재 BikePin/서비스 구조 정독** — `DashboardMapStateResponse`의 BikePin record 필드 + `DashboardMapStateService.getMapState()`가 BikePin을 만드는 부분.

- [ ] **Step 2: BikePin 확장** — `currentDispatchCustomerName`, `currentDispatchAddress`, `currentDispatchLatitude/Longitude`(nullable), `dispatchQueueCount`(int) 추가. (또는 nested `DispatchSummary` record — 기존 nextCustomer가 어떻게 했는지 따라감.)

- [ ] **Step 3: 서비스 집계** — `DispatchOrderRepository.findByStatusAndDeletedAtIsNull(ASSIGNED)`로 전체 ASSIGNED를 bikeId별로 그룹핑 → 차량별 현재 배차(sequence 최소) + 큐 수. BikePin 생성 시 주입. `DispatchOrderRepository`를 `DashboardMapStateService` 생성자에 주입.

- [ ] **Step 4: 모든 `new DashboardMapStateResponse(...)`/BikePin 생성부 컴파일 일치** — `git grep "new DashboardMapStateResponse"` 및 BikePin 생성부 확인.

- [ ] **Step 5: 컴파일** — `./gradlew compileJava` SUCCESSFUL.
- [ ] **Step 6: 커밋** — `feat: dashboard BikePin includes current dispatch + queue count`.

---

## Task 6: 백엔드 계약 테스트

**Files:** Create `src/test/java/com/thundercrew/opsapi/DispatchOrderApiContractTests.java`

**미러링:** `TipApiContractTests.java`(인증 로그인 플로우 + admin_users 시드 + jsonPath), `BikeNextCustomerApiContractTests.java`. **PostgresContainerSupport** 상속.

- [ ] **Step 1: 테스트 작성** — 케이스: ① 단건 POST 생성→201, ② 같은 차량에 2건 생성 후 큐 sequence 1,2 확인(GET), ③ `POST /{id}/complete`→해당 건 COMPLETED, 다음 건이 현재(currentByBike) 가 됨, ④ DELETE→소프트삭제(목록 제외), ⑤ bulk-preview: 존재하지 않는 차량번호 행 ERROR + 정상행 NEW + summary, ⑥ bulk-apply 후 차량 큐에 append, ⑦ dashboard map-state에 현재 배차/큐 수 포함. (차량/주소는 admin/bike 시드 필요 — BikeNextCustomer 테스트의 bike 시드 방식 미러링. 지오코딩은 테스트에서 mock 또는 좌표 직접 주입 가능한 경로 사용 — bulk 테스트는 지오코딩 의존을 피하려면 좌표 포함 변형 또는 stub; 실제 ncp 호출 회피 방법을 기존 테스트에서 확인.)

- [ ] **Step 2: 컴파일** — `./gradlew compileTestJava` SUCCESSFUL.
- [ ] **Step 3: 실행 (Docker 필요)** — `./gradlew test --tests "com.thundercrew.opsapi.DispatchOrderApiContractTests"` → GREEN. Docker 없으면 컴파일까지만 + BLOCKED 보고(CI/Docker에서 확인).
- [ ] **Step 4: 커밋** — `test: DispatchOrderApiContractTests`.

---

## Task 7: 프론트 타입 + API 클라이언트 + dashboard 정규화

**Files:** Modify `lib/services/service-ops-api.ts`, `lib/services/dashboard-map-state-data.ts`(emptyMapState).

**미러링:** Tip/nextCustomer 클라이언트 메서드 + `FrontendDashboardBikePin` 정규화.

- [ ] **Step 1: 타입** — `ServiceOpsDispatchOrder`(백엔드 DispatchOrderReadResponse 매핑), `DispatchOrderUpsertPayload`(bikeId/customerName/customerPhone/address[+lat/lng는 백엔드 지오코딩이면 단건 생성 시 필요 여부 확인]). bulk 타입은 `ServiceOpsBulk*` 재사용.

- [ ] **Step 2: 클라이언트 메서드** — factory client `request` 헬퍼로: `listDispatchOrders(bikeId)`, `createDispatchOrder(payload)`, `completeDispatchOrder(id)`(POST `/dispatch-orders/{id}/complete`), `cancelDispatchOrder(id)`(DELETE), `previewDispatchOrders(file)`/`applyDispatchOrders(...)`/`exportDispatchOrders()` (기존 bike bulk client 메서드 미러링).

- [ ] **Step 3: BikePin 정규화 확장** — `FrontendDashboardBikePin`에 `currentDispatch?`(고객/주소/좌표) + `dispatchQueueCount` 추가, `toFrontendDashboardMapState`에서 백엔드 필드 매핑(없으면 안전 기본값). `emptyMapState`/시뮬 경로 영향 없음 확인.

- [ ] **Step 4: 검증** — `npm run typecheck`(루트) 0 errors, `npm run lint` clean.
- [ ] **Step 5: 커밋** — `feat: dispatch API client types + BikePin dispatch fields`.

---

## Task 8: 프론트 서버 액션 + /management 배차 섹션

**Files:** Create `app/dispatch/actions.ts`, `components/management/DispatchPanel.tsx`. Modify `app/management/page.tsx`.

**미러링:** `app/tips/actions.ts`(`{ok,error}` 결과 + revalidate), 관리 페이지의 차량/라이더/매칭 섹션 + `ExcelImportButton`/`BulkPreviewModal` 재사용.

- [ ] **Step 1: 서버 액션** — `completeDispatchOrderAction(id)`, `cancelDispatchOrderAction(id)` → `{ok,error}` 결과(`app/tips/actions.ts` 패턴), bulk preview/apply 액션(기존 management bulk 액션 미러링), `revalidatePath("/")` + management 경로.

- [ ] **Step 2: `DispatchPanel`** — 관리 페이지 "배차" 섹션: 현재 ASSIGNED 주문 테이블(차량번호/고객/연락처/주소/순번) + 내려받기(export)/업로드(`ExcelImportButton`+`BulkPreviewModal` 재사용, dispatch preview/apply 액션 연결). 기존 `*ManagementPanel` 구조 미러링.

- [ ] **Step 3: 관리 페이지 연결** — `app/management/page.tsx`에 DispatchPanel 섹션 추가(차량/라이더/매칭 옆), 데이터 로드(현재 ASSIGNED 주문 목록).

- [ ] **Step 4: 검증** — `npm run typecheck`/`lint`/`build`(루트) green.
- [ ] **Step 5: 커밋** — `feat: /management 배차 section (table + excel upload/download)`.

---

## Task 9: 지도 배지 연결 + 차량 상세 "배차 큐" 섹션

**Files:** Modify `components/dashboard/MapShell.tsx`(또는 `use-simulated-bike-pins.ts`), `components/management/VehicleDetailDialog.tsx`, `app/globals.css`.

**미러링:** MapShell 배지(servicePhase/deliveryCount HTML), VehicleDetailDialog의 NextCustomerSection(CLEANING)·기존 섹션 구조.

- [ ] **Step 1: 마커 배지 N 연결** — 현재 마커 배지 "배송 중 · N건"의 N 소스를 `dispatchQueueCount`(실제 ASSIGNED 잔여)로 연결. 시뮬 deliveryCount와의 관계 정리(배차 데이터가 있으면 실값 우선). MapShell이 받는 pin 데이터 경로 확인 후 최소 변경.

- [ ] **Step 2: 차량 상세 "배차 큐" 섹션** — `VehicleDetailDialog`에 섹션 추가: 현재 배차(고객/주소) + 대기 목록(클라이언트에서 `listDispatchOrders(bikeId)` 또는 상세에 이미 내려온 데이터). 각 건 **완료**(completeDispatchOrderAction)·**취소**(cancelDispatchOrderAction) 버튼 → `{ok,error}` 분기 + 갱신. NextCustomerSection(CLEANING 전용) 패턴 미러링하되 배차는 서비스타입 무관(또는 배차형 차량 대상 — 스펙상 모든 차량 큐 가능).

- [ ] **Step 3: CSS** — `globals.css`에 배차 큐 섹션 스타일(기존 `--rm-*` 토큰, NextCustomerSection/테이블 스타일 재사용).

- [ ] **Step 4: 검증** — `npm run typecheck`/`lint`/`build` green.
- [ ] **Step 5: 커밋** — `feat: map badge dispatch count + vehicle detail 배차 큐 (complete/cancel)`.

---

## Task 10: 최종 검증 + PR

- [ ] **Step 1: 백엔드** — `./gradlew compileJava compileTestJava` SUCCESSFUL. Docker 있으면 `--tests "...DispatchOrderApiContractTests"` GREEN. (전체 `test`는 pre-existing arch red 있음 — dispatch 위반 0 확인.)
- [ ] **Step 2: 프론트** — 루트 `npm run typecheck` 0, `npm run lint` clean, `npm run build` success.
- [ ] **Step 3: PR (dev 대상)** — `gh pr create --base dev --head feat/group-c-dispatch-core --title "feat: Group C (C0+C2) 배차 코어 + 엑셀 배차형" --body ...`. 마이그레이션 **V33 신규** 명시(배포 영향). 백엔드 테스트가 Docker 없을 시 미실행임을 명시.
- [ ] **Step 4: 배포 후 QA 체크리스트** — /management 배차 업로드(차량번호 검증·diff)→저장, 차량 상세 배차 큐 완료/취소, 마커 배지 N 실값, 지오코딩 실패 행 ERROR.

---

## Self-Review (작성자 점검 완료)

**Spec coverage:** ① DispatchOrder 도메인/큐(Task1-2), ② 배정=엑셀 차량번호(Task4), ③ 단일목적지(Task1), ④ 배정→완료 운영자클릭(Task2,9), ⑤ 독립 도메인(Task1), ⑥ 마커 배지 N 실값(Task9), ⑦ 지오코딩 실패 ERROR(Task4), ⑧ /management 배차(Task8), ⑨ dashboard 반영(Task5,7), ⑩ 테스트(Task6) — 전 항목 커버.

**Placeholder scan:** 가이드 코드의 "실제 파일 미러링/확인" 지시는 의도적(Group A 계획과 동일 검증된 방식). 하드 placeholder(TBD/TODO) 없음.

**Type consistency:** DispatchOrderStatus(ASSIGNED/COMPLETED), sequence(long), 메서드명(create/complete/cancel/appendForBike, listByBike/currentByBike) Task 전체 일관. BikePin 확장 필드명(currentDispatch*, dispatchQueueCount) Task5↔7↔9 일치.

**열린 결정(plan 내 명시, 구현자가 기존 코드로 확정):** ① 지오코딩 위치(백엔드 우선, station 경로 확인) ② 단건 create 시 lat/lng 필요 여부(지오코딩 위치에 따라) ③ bike_id 참조(FK vs 논리) — 기존 BikeNextCustomer 컨벤션 따름.
