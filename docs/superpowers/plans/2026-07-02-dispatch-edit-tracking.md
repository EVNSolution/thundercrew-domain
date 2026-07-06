# 배차 주문 편집·재배정·취소 + 진행상황 추적 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 엑셀로 적재된 배차 주문을 운영자가 웹에서 수정·재배정·취소하고, 당일 완료 포함 진행상황을 추적한다.

**Architecture:** 백엔드에 `PATCH /api/v1/dispatch-orders/{id}`(전체 치환 편집·재배정) + 모니터용 "ASSIGNED + 당일 COMPLETED" 조회를 추가하고, 프론트 `DispatchMonitorTable`을 수정/취소 액션 + 진행률 + 15초 폴링으로 확장한다. 완료 처리는 라이더 앱 담당(현행 유지). **DB 스키마 변경 없음.**

**Tech Stack:** Spring Boot / Java 21 / JPA(Flyway) 백엔드, Next.js 16 App Router / TS 프론트. 검증: `./gradlew.bat compileJava compileTestJava`(git-bash), 프론트 `npm run typecheck && npm run lint`.

> **환경 주의:** 워크트리 `C:\Users\user\.config\superpowers\worktrees\thundercrew-domain\cc-dispatch-edit-tracking` (branch `cc-dispatch-edit-tracking`, off dev). Bash 도구는 git-bash. **Docker 없음 → 계약테스트는 실행 불가, `compileTestJava`가 컴파일 게이트.** dev 배포 서버 경쟁 금지(별도 서버 띄우지 말 것). `ddl-auto=validate`라 엔티티-스키마 불일치 시 기동 실패하지만 이 플랜은 컬럼 추가가 없어 해당 없음.

> **참고 사실(반드시 준수):**
> - 차량 실효 서비스유형 = `contractRepository.findActiveByBikeId(bikeId).map(RiderBikeContract::getServiceType).orElse(BikeServiceType.OTHER)` (bike.getServiceType()는 존재하지 않음 — 계약으로 이동됨).
> - `BikeServiceType` 값: `CALL, SINGLE, SEQUENTIAL, ROUND, OTHER`.
> - `DispatchOrderStatus` 값: `OFFERED, ASSIGNED, COMPLETED`.
> - `ServiceOpsDispatchOrder`(프론트 타입)에 `status`, `completedAt`, `bikeId`, `sequence` 이미 존재 — 타입 변경 불필요.
> - `cancelDispatchOrderAction`(actions.ts)·`cancelDispatchOrder`(api client)는 이미 존재 — 취소는 UI 버튼만 붙이면 됨.

---

## File Structure

**백엔드 (development/backend/src/main/java/com/thundercrew/opsapi/dispatch/)**
- `dto/DispatchOrderUpdateRequest.java` — **신규**. PATCH 요청 바디(전체 치환).
- `domain/DispatchOrder.java` — `updateDetails(...)`, `reassign(bikeId, sequence)` 추가.
- `service/DispatchOrderCommandService.java` — `update(id, req)` + serviceType 검증 + 감사.
- `service/DispatchOrderReadService.java` — `listActiveWithTodayCompleted()`.
- `repository/DispatchOrderRepository.java` — `findByStatusAndCompletedAtAfterAndDeletedAtIsNull`.
- `controller/DispatchOrderCommandController.java` — `PATCH /{id}`.
- `controller/DispatchOrderReadController.java` — `/active`에 `includeCompleted` 파라미터.

**백엔드 테스트**
- `development/backend/src/test/java/com/thundercrew/opsapi/DispatchOrderApiContractTests.java` — 편집/재배정/거부/감사 테스트 추가.

**프론트 (development/frontend/)**
- `lib/services/service-ops-api.ts` — `updateDispatchOrder` + 모니터 조회 파라미터.
- `app/dispatch/actions.ts` — `updateDispatchOrderAction`, `listDispatchMonitorAction`.
- `components/management/DispatchOrderEditDialog.tsx` — **신규**. 편집 다이얼로그.
- `components/management/DispatchMonitorTable.tsx` — 액션형(수정/취소) + 상태/진행률 + 폴링.
- `components/management/DispatchPanel.tsx` + `app/management/operations/page.tsx` — 재배정 후보 차량 목록 스레딩.
- `app/globals.css` (또는 관리 CSS) — 신규 클래스 최소 추가.

---

## Task 1: 편집 요청 DTO + DispatchOrder 도메인 mutator

**Files:**
- Create: `development/backend/src/main/java/com/thundercrew/opsapi/dispatch/dto/DispatchOrderUpdateRequest.java`
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/dispatch/domain/DispatchOrder.java`

- [ ] **Step 1: DTO 생성**

`DispatchOrderUpdateRequest.java` 전체:

```java
package com.thundercrew.opsapi.dispatch.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * 배차 주문 편집(전체 치환). 프론트가 편집 다이얼로그의 현재값 전체를 채워 보낸다.
 * sequence 는 선택 — null 이면 재배정 시 대상 큐 tail+1, 미재배정 시 현재 순번 유지.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DispatchOrderUpdateRequest(
        @NotNull UUID bikeId,
        @NotBlank @Size(max = 255) String customerName,
        @NotBlank @Size(max = 255) String customerPhone,
        @NotBlank @Size(max = 2000) String address,
        @DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude,
        Long sequence
) {}
```

- [ ] **Step 2: 도메인 mutator 추가**

`DispatchOrder.java` — `setOrigin(...)` 메서드 바로 위(또는 아래, `assign` 다음 적당한 위치)에 추가. 기존 import `InvalidStateTransitionException`·`DispatchOrderStatus` 이미 있음.

```java
    /** 고객/주소 정보 수정. 배정 상태에서만 허용. */
    public void updateDetails(String customerName, String customerPhone,
                              String address, double latitude, double longitude) {
        if (this.status != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 수정할 수 있습니다. 현재: " + this.status);
        }
        this.customerName = customerName;
        this.customerPhone = customerPhone;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    /** 배정 차량·순번 변경(재배정). 배정 상태에서만 허용. */
    public void reassign(UUID bikeId, long sequence) {
        if (this.status != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 재배정할 수 있습니다. 현재: " + this.status);
        }
        this.bikeId = bikeId;
        this.sequence = sequence;
    }

    /** 큐 내 순번만 변경(재정렬). 배정 상태에서만 허용. */
    public void changeSequence(long sequence) {
        if (this.status != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 순번 변경할 수 있습니다. 현재: " + this.status);
        }
        this.sequence = sequence;
    }
```

- [ ] **Step 3: 컴파일 검증**

Run: `cd development/backend && ./gradlew.bat compileJava`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: 커밋**

```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/dispatch/dto/DispatchOrderUpdateRequest.java src/main/java/com/thundercrew/opsapi/dispatch/domain/DispatchOrder.java
git commit -m "feat(dispatch): 편집 요청 DTO + DispatchOrder updateDetails/reassign/changeSequence"
```

---

## Task 2: DispatchOrderCommandService.update() — 검증·재배정·감사

**Files:**
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/dispatch/service/DispatchOrderCommandService.java`

- [ ] **Step 1: 의존성 주입 추가**

현재 생성자는 `dispatchOrderRepository, dispatchBatchRepository, auditLogCommandService, clock`. `BikeRepository`, `RiderBikeContractRepository`를 추가한다. 상단 import에 추가:

```java
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderUpdateRequest;
```

필드 + 생성자 확장(기존 4개 + 신규 2개):

```java
    private final BikeRepository bikeRepository;
    private final RiderBikeContractRepository contractRepository;
```

생성자 시그니처에 `BikeRepository bikeRepository, RiderBikeContractRepository contractRepository` 추가하고 `this.bikeRepository = bikeRepository; this.contractRepository = contractRepository;` 대입.

- [ ] **Step 2: serviceTypeOf 헬퍼 + update() 추가**

`create(...)` 아래(또는 클래스 하단 private 영역 위)에 추가:

```java
    /** 차량의 서비스유형 = 활성계약의 값, 없으면 OTHER. (DeliveryCallService/BulkService 와 동일 규칙) */
    private BikeServiceType serviceTypeOf(UUID bikeId) {
        return contractRepository.findActiveByBikeId(bikeId)
                .map(RiderBikeContract::getServiceType)
                .orElse(BikeServiceType.OTHER);
    }

    private static final java.util.Set<BikeServiceType> REASSIGNABLE_TYPES =
            java.util.EnumSet.of(BikeServiceType.CALL, BikeServiceType.SINGLE, BikeServiceType.SEQUENTIAL);

    /**
     * 배차 주문 편집(전체 치환). ASSIGNED 만 가능(완료건 409). batch(왕복) 주문은 고객/주소만 허용,
     * 재배정·순번변경 거부. 성공 시 감사 1건.
     */
    public DispatchOrderReadResponse update(UUID id, DispatchOrderUpdateRequest req) {
        DispatchOrder order = dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
        if (order.getStatus() != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 수정할 수 있습니다. 현재: " + order.getStatus());
        }

        boolean isBatch = order.getBatchId() != null;
        boolean reassigning = !req.bikeId().equals(order.getBikeId());
        boolean resequencing = req.sequence() != null && req.sequence() != order.getSequence();

        if (isBatch && (reassigning || resequencing)) {
            throw new InvalidStateTransitionException("왕복(배치) 배차는 차량/순번을 변경할 수 없습니다.");
        }

        // 고객/주소 갱신(항상)
        order.updateDetails(req.customerName(), req.customerPhone(), req.address(),
                req.latitude(), req.longitude());

        if (reassigning) {
            bikeRepository.findByIdAndDeletedAtIsNull(req.bikeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Bike", req.bikeId()));
            if (!REASSIGNABLE_TYPES.contains(serviceTypeOf(req.bikeId()))) {
                throw new InvalidStateTransitionException("콜/단일/순차 배차 차량이 아닙니다.");
            }
            long seq = req.sequence() != null ? req.sequence()
                    : dispatchOrderRepository
                        .findTopByBikeIdAndDeletedAtIsNullOrderBySequenceDesc(req.bikeId())
                        .map(o -> o.getSequence() + 1)
                        .orElse(1L);
            order.reassign(req.bikeId(), seq);
        } else if (resequencing) {
            order.changeSequence(req.sequence());
        }

        auditLogCommandService.log("DISPATCH_ORDER", id, "__updated__", null, req.customerName());
        return DispatchOrderReadResponse.from(order);
    }
```

> 참고: `order.updateDetails(...)`가 이미 ASSIGNED 가드를 하지만, 서비스 진입부 가드로 완료건을 먼저 409 처리한다(감사·재배정 로직 진입 전 차단). `@Transactional` 클래스 레벨이라 mutate 는 dirty-checking flush.

- [ ] **Step 3: 컴파일 검증**

Run: `cd development/backend && ./gradlew.bat compileJava`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: 커밋**

```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/dispatch/service/DispatchOrderCommandService.java
git commit -m "feat(dispatch): 배차 주문 편집 서비스(update) — 재배정 검증 + 배치 가드 + 감사"
```

---

## Task 3: PATCH 컨트롤러 엔드포인트

**Files:**
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/dispatch/controller/DispatchOrderCommandController.java`

- [ ] **Step 1: import + 엔드포인트 추가**

상단 import에 추가:

```java
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderUpdateRequest;
import org.springframework.web.bind.annotation.PatchMapping;
```

`create(...)` 메서드 바로 아래에 추가:

```java
    @PatchMapping("/{id}")
    DispatchOrderReadResponse update(@PathVariable UUID id,
                                     @Valid @RequestBody DispatchOrderUpdateRequest request) {
        return dispatchOrderCommandService.update(id, request);
    }
```

- [ ] **Step 2: 컴파일 검증**

Run: `cd development/backend && ./gradlew.bat compileJava`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: 커밋**

```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/dispatch/controller/DispatchOrderCommandController.java
git commit -m "feat(dispatch): PATCH /api/v1/dispatch-orders/{id} 편집 엔드포인트"
```

---

## Task 4: 모니터용 조회 — ASSIGNED + 당일 COMPLETED

**Files:**
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/dispatch/repository/DispatchOrderRepository.java`
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/dispatch/service/DispatchOrderReadService.java`
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/dispatch/controller/DispatchOrderReadController.java`

- [ ] **Step 1: 리포지토리 메서드 추가**

`DispatchOrderRepository.java` — `save(...)` 위에 추가(import `java.time.Instant` 추가):

```java
    List<DispatchOrder> findByStatusAndCompletedAtAfterAndDeletedAtIsNull(
            DispatchOrderStatus status, java.time.Instant completedAtAfter);
```

- [ ] **Step 2: 읽기 서비스에 조회 추가 + Clock 주입**

`DispatchOrderReadService.java`:
- 생성자에 `Clock clock` 추가(import `java.time.Clock`, `java.time.Instant`, `java.time.LocalDate`, `java.time.ZoneId`), 필드 `private final Clock clock;` + 대입.
- `listActiveAssigned()` 아래에 추가:

```java
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    /** 모니터용: 활성(ASSIGNED) 전체 + 당일(KST 0시 이후) 완료(COMPLETED). 프론트가 차량별로 묶어 진행률 계산. */
    public List<DispatchOrderReadResponse> listActiveWithTodayCompleted() {
        Instant todayStart = LocalDate.ofInstant(clock.instant(), SEOUL).atStartOfDay(SEOUL).toInstant();
        List<DispatchOrderReadResponse> result = new java.util.ArrayList<>(
                dispatchOrderRepository.findByStatusAndDeletedAtIsNull(DispatchOrderStatus.ASSIGNED).stream()
                        .map(DispatchOrderReadResponse::from)
                        .toList());
        dispatchOrderRepository
                .findByStatusAndCompletedAtAfterAndDeletedAtIsNull(DispatchOrderStatus.COMPLETED, todayStart).stream()
                .map(DispatchOrderReadResponse::from)
                .forEach(result::add);
        return result;
    }
```

> `Clock`은 애플리케이션에 이미 빈으로 등록되어 있다(`DispatchOrderCommandService`가 주입받아 사용 중). 테스트 프로파일도 동일 빈을 쓴다.

- [ ] **Step 3: 읽기 컨트롤러 파라미터 추가**

`DispatchOrderReadController.java` — `activeOrders()`를 파라미터 분기로 교체:

```java
    /** 배송 상태 탭 / 모니터: 활성(ASSIGNED) 배차. includeCompleted=true 면 당일 완료도 포함. */
    @GetMapping("/active")
    List<DispatchOrderReadResponse> activeOrders(
            @RequestParam(name = "includeCompleted", defaultValue = "false") boolean includeCompleted) {
        return includeCompleted
                ? dispatchOrderReadService.listActiveWithTodayCompleted()
                : dispatchOrderReadService.listActiveAssigned();
    }
```

(`@RequestParam` import은 이미 있음.)

- [ ] **Step 4: 컴파일 검증**

Run: `cd development/backend && ./gradlew.bat compileJava`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: 커밋**

```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/dispatch/repository/DispatchOrderRepository.java src/main/java/com/thundercrew/opsapi/dispatch/service/DispatchOrderReadService.java src/main/java/com/thundercrew/opsapi/dispatch/controller/DispatchOrderReadController.java
git commit -m "feat(dispatch): 모니터 조회 — ASSIGNED + 당일 완료(includeCompleted)"
```

---

## Task 5: 프론트 API 클라이언트 + 서버 액션

**Files:**
- Modify: `development/frontend/lib/services/service-ops-api.ts`
- Modify: `development/frontend/app/dispatch/actions.ts`

- [ ] **Step 1: API 클라이언트 — 타입·메서드 추가**

`service-ops-api.ts`:
1. 편집 페이로드 타입을 `ServiceOpsDispatchOrder` 정의(라인 ~1055) 근처에 추가:

```ts
/** 배차 주문 편집 페이로드 — backend DispatchOrderUpdateRequest 와 1:1. */
export type DispatchOrderUpdatePayload = {
  bikeId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
  sequence?: number | null;
};
```

2. 클라이언트 인터페이스(타입 선언부, `listActiveDispatchOrders` 근처 라인 ~1303)에 추가:

```ts
  updateDispatchOrder: (id: string, payload: DispatchOrderUpdatePayload) => Promise<ServiceOpsDispatchOrder>;
  listDispatchMonitor: () => Promise<ServiceOpsDispatchOrder[]>;
```

3. 구현부(`listActiveDispatchOrders` 구현 근처 라인 ~1906)에 추가:

```ts
    updateDispatchOrder: (id, payload) =>
      request<ServiceOpsDispatchOrder>(
        `/dispatch-orders/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify(payload) }
      ),
    listDispatchMonitor: () =>
      request<ServiceOpsDispatchOrder[]>(
        "/dispatch-orders/active",
        { method: "GET" },
        { includeCompleted: "true" }
      ),
```

> `request` 시그니처는 기존 호출(`listDispatchOrders`가 3번째 인자로 쿼리객체 전달, `completeDispatchOrder`가 body 전달)을 참고해 맞춘다. PATCH+JSON body 는 `applyDispatchOrders`(POST+JSON.stringify) 패턴과 동일하게 `Content-Type: application/json` 헤더가 request 헬퍼에서 자동 처리되는지 확인하고, 아니면 `applyDispatchOrders` 구현과 동일하게 헤더를 맞춘다.

- [ ] **Step 2: 서버 액션 추가**

`app/dispatch/actions.ts` — `cancelDispatchOrderAction` 근처에 추가. import에 `DispatchOrderUpdatePayload` 추가. 주소는 서버 전용 `geocodeAddress`로 좌표 변환(콜 액션과 동일 패턴):

```ts
export async function updateDispatchOrderAction(
  id: string,
  input: { bikeId: string; customerName: string; customerPhone: string; address: string; sequence?: number | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };

  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();
  const address = input.address.trim();
  if (!input.bikeId || !customerName || !customerPhone || !address) {
    return { ok: false, error: "모든 항목을 입력해주세요." };
  }
  const coords = await geocodeAddress(address);
  if (!coords) return { ok: false, error: "주소를 찾을 수 없습니다. 다시 확인해주세요." };

  try {
    await client.updateDispatchOrder(id, {
      bikeId: input.bikeId,
      customerName,
      customerPhone,
      address,
      latitude: coords.latitude,
      longitude: coords.longitude,
      sequence: input.sequence ?? null
    });
    revalidatePath("/management/operations");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

export async function listDispatchMonitorAction(): Promise<ServiceOpsDispatchOrder[]> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return [];
  return client.listDispatchMonitor().catch(() => []);
}
```

- [ ] **Step 3: 타입·린트 검증**

Run: `cd development/frontend && npm run typecheck && npm run lint`
Expected: 에러 없음(exit 0).

- [ ] **Step 4: 커밋**

```bash
cd development/frontend && git add lib/services/service-ops-api.ts app/dispatch/actions.ts
git commit -m "feat(dispatch): updateDispatchOrder 클라이언트 + updateDispatchOrderAction/listDispatchMonitorAction"
```

---

## Task 6: 편집 다이얼로그 + 액션형 모니터 테이블

**Files:**
- Create: `development/frontend/components/management/DispatchOrderEditDialog.tsx`
- Modify: `development/frontend/components/management/DispatchMonitorTable.tsx`
- Modify: `development/frontend/app/globals.css` (필요한 최소 클래스만)

> 착수 전 읽기: `components/management/DispatchPanel.tsx`(모니터 렌더 위치·props), `components/management/BaeminCallPanel.tsx`(다이얼로그·form·에러표시·CSS 클래스 패턴), `components/management/CreateVehicleDialog.tsx`(다이얼로그 뼈대·close 패턴). 신규 컴포넌트는 이 패턴들의 클래스명(`dialog-*`, `button-primary/secondary`, `form-*`, `management-panel` 등)을 그대로 재사용한다.

- [ ] **Step 1: 편집 다이얼로그 생성**

`DispatchOrderEditDialog.tsx` (client component). 필드: 고객명·연락처·주소(텍스트)·배정차량(select)·순번(number). batch 주문이면 차량/순번 비활성. 제출 → `updateDispatchOrderAction`. 인접 다이얼로그(BaeminCallPanel/CreateVehicleDialog)의 마크업·클래스에 맞춰 작성. 뼈대:

```tsx
"use client";

import { useState } from "react";
import { updateDispatchOrderAction } from "@/app/dispatch/actions";
import type { ServiceOpsDispatchOrder } from "@/lib/services/service-ops-api";

type ReassignVehicle = { id: string; plateNumber: string };

export function DispatchOrderEditDialog({
  order,
  vehicles,
  onClose,
  onSaved
}: {
  order: ServiceOpsDispatchOrder;
  vehicles: ReassignVehicle[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isBatch = order.kind === "PICKUP" || order.kind === "DELIVERY" ? false : false; // batch 여부는 아래 주석 참고
  const [customerName, setCustomerName] = useState(order.customerName);
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone);
  const [address, setAddress] = useState(order.address);
  const [bikeId, setBikeId] = useState(order.bikeId ?? "");
  const [sequence, setSequence] = useState<string>(String(order.sequence));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await updateDispatchOrderAction(order.id, {
      bikeId,
      customerName,
      customerPhone,
      address,
      sequence: sequence.trim() === "" ? null : Number(sequence)
    });
    setSubmitting(false);
    if (result.ok) {
      onSaved();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="dialog-card">
        <h3 className="dialog-title">배차 주문 수정</h3>
        <form onSubmit={handleSubmit} className="form-grid">
          <label>고객명
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </label>
          <label>연락처
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
          </label>
          <label>배송지주소
            <input value={address} onChange={(e) => setAddress(e.target.value)} required />
          </label>
          <label>배정 차량
            <select value={bikeId} onChange={(e) => setBikeId(e.target.value)}>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.plateNumber}</option>
              ))}
            </select>
          </label>
          <label>순번
            <input type="number" min={1} value={sequence} onChange={(e) => setSequence(e.target.value)} />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="dialog-actions">
            <button type="button" className="button-secondary" onClick={onClose} disabled={submitting}>취소</button>
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

> **batch 판정:** `ServiceOpsDispatchOrder`에 `batchId`가 없다(모니터는 단일/순차/콜 통합 풀만 표시하므로 batch 주문은 이 화면에 원칙적으로 안 뜬다). 따라서 다이얼로그의 batch-비활성 분기는 불필요 — 위 `isBatch` 라인은 삭제하고 차량/순번 필드를 항상 활성으로 둔다. (백엔드가 batch 주문 재배정을 400으로 이중 방어한다.) 위 뼈대의 잘못된 `isBatch` 라인을 제거할 것.
> 클래스명(`dialog-backdrop`, `dialog-card`, `dialog-title`, `form-grid`, `form-error`, `dialog-actions`)은 인접 다이얼로그(CreateVehicleDialog/BaeminCallPanel)의 실제 클래스로 맞춘다. 없으면 그 파일들이 쓰는 이름을 그대로 사용.

- [ ] **Step 2: 모니터 테이블 액션형 전환**

`DispatchMonitorTable.tsx` 교체. 변경점: (a) `vehicles` prop 추가(재배정 후보), (b) 상태 컬럼 + 진행률(완료/전체), (c) ASSIGNED 행에 수정/취소 버튼, (d) 완료 행 muted, (e) 15초 폴링(`onRefresh` 주기 호출). 완료건 정렬은 차량→상태(ASSIGNED 먼저)→순번.

```tsx
"use client";

import { useEffect, useState } from "react";
import type { ServiceOpsDispatchOrder } from "@/lib/services/service-ops-api";
import { cancelDispatchOrderAction } from "@/app/dispatch/actions";
import { DispatchOrderEditDialog } from "@/components/management/DispatchOrderEditDialog";

export function DispatchMonitorTable({
  orders,
  plateById,
  vehicles,
  onRefresh,
  refreshing = false
}: {
  orders: ServiceOpsDispatchOrder[];
  plateById: Record<string, string>;
  vehicles: { id: string; plateNumber: string }[];
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [editing, setEditing] = useState<ServiceOpsDispatchOrder | null>(null);

  // 15초 자동 새로고침
  useEffect(() => {
    if (!onRefresh) return;
    const timer = setInterval(() => onRefresh(), 15000);
    return () => clearInterval(timer);
  }, [onRefresh]);

  const plateFor = (bikeId: string | null): string => {
    if (!bikeId) return "—";
    return plateById[bikeId] ?? bikeId.slice(0, 8);
  };

  const statusOrder = (s: ServiceOpsDispatchOrder["status"]) => (s === "ASSIGNED" ? 0 : 1);
  const sorted = [...orders].sort((a, b) => {
    const pa = plateFor(a.bikeId);
    const pb = plateFor(b.bikeId);
    if (pa !== pb) return pa.localeCompare(pb, "ko");
    if (statusOrder(a.status) !== statusOrder(b.status)) return statusOrder(a.status) - statusOrder(b.status);
    return a.sequence - b.sequence;
  });

  const total = sorted.length;
  const completed = sorted.filter((o) => o.status === "COMPLETED").length;

  async function handleCancel(id: string) {
    if (!window.confirm("이 배차 주문을 취소하시겠어요?")) return;
    const result = await cancelDispatchOrderAction(id);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    onRefresh?.();
  }

  return (
    <div className="dispatch-monitor">
      <div className="dispatch-monitor-toolbar">
        <span className="dispatch-monitor-count">활성/당일 배차 {total}건 · 완료 {completed}/{total}</span>
        {onRefresh ? (
          <button type="button" className="button-secondary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "새로고침 중..." : "새로고침"}
          </button>
        ) : null}
      </div>
      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th>차량</th>
              <th>고객명</th>
              <th>연락처</th>
              <th>배송지주소</th>
              <th>순번</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty-cell">
                  현재 활성 배차가 없습니다. 업로드하면 차량별로 여기에 표시됩니다.
                </td>
              </tr>
            ) : (
              sorted.map((order) => {
                const done = order.status === "COMPLETED";
                return (
                  <tr key={order.id} style={done ? { opacity: 0.5 } : undefined}>
                    <td>{plateFor(order.bikeId)}</td>
                    <td>{order.customerName}</td>
                    <td>{order.customerPhone}</td>
                    <td>{order.address}</td>
                    <td>{order.sequence}</td>
                    <td>{done ? "완료" : "진행중"}</td>
                    <td>
                      {done ? "—" : (
                        <>
                          <button type="button" className="button-secondary" onClick={() => setEditing(order)}>수정</button>
                          <button type="button" className="button-secondary" onClick={() => handleCancel(order.id)}>취소</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {editing ? (
        <DispatchOrderEditDialog
          order={editing}
          vehicles={vehicles}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onRefresh?.(); }}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: CSS 최소 추가(필요 시)**

기존 클래스로 대부분 커버된다. 버튼 간격 등만 필요하면 `app/globals.css`에 `.dispatch-monitor td .button-secondary + .button-secondary { margin-left: 6px; }` 정도만 추가. 새 클래스 남발 금지.

- [ ] **Step 4: 타입·린트 검증**

Run: `cd development/frontend && npm run typecheck && npm run lint`
Expected: 에러 없음.

> `DispatchMonitorTable`에 `vehicles` prop 이 필수로 추가되므로 이 컴포넌트의 호출부(`DispatchPanel.tsx`)에서 타입 에러가 난다 — Task 7에서 prop 을 넘겨 해소한다. Task 6 단독 typecheck 시 이 에러가 예상되면 Task 7까지 함께 완료 후 검증해도 된다(구현자 판단). 커밋은 Task 6/7 각각.

- [ ] **Step 5: 커밋**

```bash
cd development/frontend && git add components/management/DispatchOrderEditDialog.tsx components/management/DispatchMonitorTable.tsx app/globals.css
git commit -m "feat(dispatch): 배차 모니터 액션형(수정/취소) + 진행률 + 15초 폴링 + 편집 다이얼로그"
```

---

## Task 7: 모니터 폴링 데이터 소스 + 재배정 후보 차량 스레딩

**Files:**
- Modify: `development/frontend/components/management/DispatchPanel.tsx`
- Modify: `development/frontend/app/management/operations/page.tsx`

> 착수 전 읽기: `DispatchPanel.tsx` 전체(현재 `activeOrders`·`plateById` props 를 받아 `DispatchMonitorTable`에 넘김), `app/management/operations/page.tsx`(props 계산부).

- [ ] **Step 1: operations 페이지 — 재배정 후보 차량 전달**

`app/management/operations/page.tsx`의 `deliveryVehicles` 계산 근처에 재배정 후보(CALL/SINGLE/SEQUENTIAL)를 추가:

```tsx
  // 재배정 후보 차량 = 콜/단일/순차 (모니터 편집 다이얼로그의 배정차량 select)
  const reassignVehicles = vehiclesPage
    .filter((v) => v.serviceType === "CALL" || v.serviceType === "SINGLE" || v.serviceType === "SEQUENTIAL")
    .map((v) => ({ id: v.id ?? v.slug, plateNumber: v.plateNumber }));
```

그리고 `<DispatchPanel .../>`에 `reassignVehicles={reassignVehicles}` prop 을 추가한다.

- [ ] **Step 2: DispatchPanel — 폴링 데이터 소스 전환 + vehicles 전달**

`DispatchPanel.tsx`를 client component 로 만들어(이미 client 이면 유지) 모니터 데이터를 `listDispatchMonitorAction`으로 로드/새로고침한다. props 에 `reassignVehicles` 추가. 핵심 변경:
- import: `import { listDispatchMonitorAction } from "@/app/dispatch/actions";`, `useState`, `useEffect`.
- 초기값은 서버가 넘긴 `activeOrders`(SSR)로 두고, 클라이언트 상태 `orders`로 관리.
- `refresh()` 함수: `setRefreshing(true); const next = await listDispatchMonitorAction(); setOrders(next); setRefreshing(false);`
- `<DispatchMonitorTable orders={orders} plateById={plateById} vehicles={reassignVehicles} onRefresh={refresh} refreshing={refreshing} />`

DispatchPanel 이 현재 어떤 형태(server/client)인지에 맞춰 최소 변경으로 구현한다. `onRefresh`가 넘어가면 모니터가 15초 폴링 + 편집/취소 후 재조회를 수행한다.

> `listDispatchMonitorAction`은 `includeCompleted=true`로 조회하므로 초기 SSR `activeOrders`(ASSIGNED-only)보다 완료건이 더 붙는다. 첫 렌더 직후 `refresh()`를 1회 호출(`useEffect(() => { refresh(); }, [])`)해 당일 완료까지 채운다.

- [ ] **Step 3: 타입·린트 검증**

Run: `cd development/frontend && npm run typecheck && npm run lint`
Expected: 에러 없음(Task 6의 `vehicles` prop 에러도 여기서 해소).

- [ ] **Step 4: 커밋**

```bash
cd development/frontend && git add components/management/DispatchPanel.tsx app/management/operations/page.tsx
git commit -m "feat(dispatch): 모니터 폴링 데이터 소스(listDispatchMonitor) + 재배정 후보 차량 전달"
```

---

## Task 8: 백엔드 계약테스트 + 최종 검증 + PR

**Files:**
- Modify: `development/backend/src/test/java/com/thundercrew/opsapi/DispatchOrderApiContractTests.java`

> 이 저장소는 `seedBike(id, plate, vin, opStatus, serviceType)`가 bike + 활성계약(serviceType)을 함께 시드한다. `resetRows()`가 `BIKE_ID`(SINGLE), `SEQ_BIKE_ID`(SEQUENTIAL)를 시드하고, `createOrder(name, phone, address)`는 `BIKE_ID`로 ASSIGNED 주문 생성 후 id 반환, `completeOrder(id)`는 사진 포함 완료. 이 헬퍼들을 재사용한다. ⚠️ Docker 없이는 실행 불가 — `compileTestJava`가 컴파일 게이트.

- [ ] **Step 1: 편집 테스트 4건 추가**

`// --- helpers` 위에 추가. PATCH 는 `import static ...MockMvcRequestBuilders.patch;` 추가 필요.

```java
    // ⑫ PATCH: 고객/주소 필드 수정 반영
    @Test
    void patchUpdatesCustomerAndAddressFields() throws Exception {
        String orderId = createOrder("원래고객", "010-0000-0000", "원래 주소");

        String body = """
                {"bikeId":"%s","customerName":"수정고객","customerPhone":"010-9999-9999",
                 "address":"수정 주소","latitude":37.51,"longitude":127.02}
                """.formatted(BIKE_ID);

        mockMvc.perform(patch("/api/v1/dispatch-orders/{id}", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("수정고객"))
                .andExpect(jsonPath("$.customerPhone").value("010-9999-9999"))
                .andExpect(jsonPath("$.address").value("수정 주소"))
                .andExpect(jsonPath("$.status").value("ASSIGNED"));
    }

    // ⑬ PATCH 재배정: bikeId 변경 시 대상 큐 tail+1 순번
    @Test
    void patchReassignMovesOrderToTargetBikeQueueTail() throws Exception {
        // SEQ_BIKE 큐에 1건(sequence 1) 만들어 tail 을 확보
        String seqBody = """
                {"bikeId":"%1$s","customerName":"순차기존","customerPhone":"010-1111-1111",
                 "address":"순차 주소","latitude":37.50,"longitude":127.00,"sequence":1}
                """.formatted(SEQ_BIKE_ID);
        mockMvc.perform(post("/api/v1/dispatch-orders/bulk-apply-sequential")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rows\":[" + seqBody + "]}"))
                .andExpect(status().isOk());

        String orderId = createOrder("이동고객", "010-2222-2222", "이동 주소"); // BIKE_ID(SINGLE), seq 1

        String patch = """
                {"bikeId":"%s","customerName":"이동고객","customerPhone":"010-2222-2222",
                 "address":"이동 주소","latitude":37.50,"longitude":127.00}
                """.formatted(SEQ_BIKE_ID);

        mockMvc.perform(patch("/api/v1/dispatch-orders/{id}", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patch))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bikeId").value(SEQ_BIKE_ID.toString()))
                .andExpect(jsonPath("$.sequence").value(2));
    }

    // ⑭ PATCH 완료건 → 409
    @Test
    void patchCompletedOrderIsRejected() throws Exception {
        String orderId = createOrder("완료고객", "010-3333-3333", "완료 주소");
        completeOrder(orderId);

        String body = """
                {"bikeId":"%s","customerName":"수정시도","customerPhone":"010-3333-3333",
                 "address":"수정 주소","latitude":37.50,"longitude":127.00}
                """.formatted(BIKE_ID);

        mockMvc.perform(patch("/api/v1/dispatch-orders/{id}", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isIn(400, 409));
    }

    // ⑮ PATCH → audit_logs 에 DISPATCH_ORDER/__updated__ 행 생성
    @Test
    void patchRecordsUpdatedAuditLog() throws Exception {
        String orderId = createOrder("감사수정고객", "010-4444-4444", "감사 주소");

        String body = """
                {"bikeId":"%s","customerName":"감사수정후","customerPhone":"010-4444-4444",
                 "address":"감사 주소","latitude":37.50,"longitude":127.00}
                """.formatted(BIKE_ID);
        mockMvc.perform(patch("/api/v1/dispatch-orders/{id}", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        int count = jdbcTemplate.queryForObject(
                "select count(*) from audit_logs where entity_type='DISPATCH_ORDER' and entity_id=?::uuid and field='__updated__'",
                Integer.class, orderId);
        assertThat(count).isEqualTo(1);
    }

    // ⑯ 모니터 조회: includeCompleted=true 면 당일 완료도 포함
    @Test
    void activeWithIncludeCompletedReturnsTodayCompleted() throws Exception {
        String a = createOrder("진행중고객", "010-1111-0000", "주소A");
        String b = createOrder("완료대상고객", "010-2222-0000", "주소B");
        completeOrder(b);

        mockMvc.perform(get("/api/v1/dispatch-orders/active")
                        .param("includeCompleted", "true")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        // includeCompleted 기본 false → ASSIGNED 만
        mockMvc.perform(get("/api/v1/dispatch-orders/active")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }
```

- [ ] **Step 2: 백엔드 컴파일 게이트**

Run: `cd development/backend && ./gradlew.bat compileJava compileTestJava`
Expected: `BUILD SUCCESSFUL`. (실행은 Docker 필요 → 로컬 Docker 또는 배포 후 QA.)

- [ ] **Step 3: 프론트 최종 검증**

Run: `cd development/frontend && npm run typecheck && npm run lint`
Expected: 에러 없음.

- [ ] **Step 4: 커밋 + 푸시 + PR(→dev)**

```bash
cd development/backend && git add src/test/java/com/thundercrew/opsapi/DispatchOrderApiContractTests.java
git commit -m "test(dispatch): 편집·재배정·완료거부·감사·모니터조회 계약테스트"
cd .. && git push -u origin cc-dispatch-edit-tracking
```

그 후 `gh pr create --base dev`로 PR 생성(제목: `feat(dispatch): 배차 주문 편집·재배정·취소 + 진행상황 추적`). 본문에 검증 상태(compile green, 계약테스트는 Docker/배포 QA 필요, 스키마 변경 없음)를 명시. 그다음 **superpowers:finishing-a-development-branch**로 마무리(dev 자가 병합 가능, dev→main 은 사용자 게이트).

---

## Self-Review 결과

- **스펙 커버리지:** 편집 API(§3)=Task1-3, 도메인(§4)=Task1, 추적 조회(§5)=Task4, 프론트(§6)=Task5-7, 엣지(§7: 완료 409·batch 400·주소좌표필수)=Task2 로직 + Task8 테스트, 테스트(§8)=Task8. 전부 매핑됨.
- **플레이스홀더:** 없음. 모든 코드 단계에 실제 코드 제공. (Task6 다이얼로그의 잘못된 `isBatch` 라인은 그 자리에서 "삭제하라"고 명시.)
- **타입 일관성:** `DispatchOrderUpdateRequest`(백)/`DispatchOrderUpdatePayload`(프)/`updateDispatchOrderAction` 입력 필드명 일치(bikeId·customerName·customerPhone·address·sequence, 좌표는 액션이 지오코딩으로 채움). `listDispatchMonitor`(client)↔`listDispatchMonitorAction`(action)↔`/active?includeCompleted=true`(백) 일치. `reassign`/`updateDetails`/`changeSequence` 명칭 Task1 정의와 Task2 호출 일치.
