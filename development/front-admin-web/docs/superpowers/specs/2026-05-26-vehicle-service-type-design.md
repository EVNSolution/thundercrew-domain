# Vehicle Service Type (serviceType) Implementation Design

## Goal

차량에 서비스 유형(`serviceType`)을 추가해 배송(오토바이)과 클리닝(자동차)을 구분하고, 운영자가 차량 목록과 지도에서 유형별로 필터링할 수 있게 한다.

## Architecture

백엔드(`service-ops-api`)에 `BikeServiceType` enum과 DB 컬럼을 추가하고, 프론트엔드(`front-admin-web`)에서 편집 폼·필터 탭·지도 마커 연동까지 일관되게 반영한다. 일정 관리 및 발송 시뮬레이션(스펙 B)은 이 스펙이 완료된 후 별도 진행한다.

## Tech Stack

- Backend: Java 17, Spring Boot, JPA, Flyway (service-ops-api)
- Frontend: Next.js 14 App Router, TypeScript, React (front-admin-web)

---

## Backend Changes (service-ops-api)

### New: `BikeServiceType.java`

```
path: src/main/java/com/thundercrew/opsapi/bike/domain/BikeServiceType.java
```

```java
package com.thundercrew.opsapi.bike.domain;

public enum BikeServiceType {
    DELIVERY,   // 배송 (오토바이)
    CLEANING,   // 클리닝 (자동차)
    OTHER       // 기타
}
```

### New: DB Migration

```
path: src/main/resources/db/migration/V??__add_bike_service_type.sql
```

버전 번호는 기존 마이그레이션 파일 중 가장 높은 번호 + 1.

```sql
ALTER TABLE bikes
    ADD COLUMN service_type VARCHAR(20) NOT NULL DEFAULT 'DELIVERY';
```

기존 모든 차량은 `DELIVERY`로 초기화된다. 운영자가 클리닝 차량을 등록하거나 기존 차량 유형을 수정할 때 변경.

### Modified: `Bike.java`

`engineType` 필드 바로 아래에 추가:

```java
@Enumerated(EnumType.STRING)
@Column(name = "service_type", nullable = false, length = 20)
private BikeServiceType serviceType;
```

`create()` 정적 팩토리 메서드에 `BikeServiceType serviceType` 파라미터 추가:

```java
public static Bike create(
    String plateNumber, String vin, String modelName,
    BikeEngineType engineType, BikeServiceType serviceType,
    BikeOperationStatus operationStatus, String memo
) {
    Bike bike = new Bike();
    // ... 기존 필드
    bike.serviceType = serviceType;
    return bike;
}
```

`updateBasicProfile()`에 `BikeServiceType serviceType` 파라미터 추가:

```java
public void updateBasicProfile(
    String plateNumber, String vin, String modelName,
    BikeEngineType engineType, BikeServiceType serviceType, String memo
) {
    // ... 기존 필드
    if (serviceType != null) {
        this.serviceType = serviceType;
    }
}
```

getter 추가:

```java
public BikeServiceType getServiceType() {
    return serviceType;
}
```

### Modified: `BikeCreateRequest.java`

```java
private BikeServiceType serviceType = BikeServiceType.DELIVERY; // 기본값
```

### Modified: `BikeUpdateRequest.java`

```java
private BikeServiceType serviceType; // null이면 변경 없음
```

### Modified: `BikeReadResponse.java`

```java
private BikeServiceType serviceType;
```

응답 빌더/생성자에서 `bike.getServiceType()` 매핑.

### Modified: `DashboardBikeSnapshotResponse.java`

지도 마커 필터링을 위해 `serviceType` 포함:

```java
private BikeServiceType serviceType;
```

### Modified: `BikeCommandService.java`

`create` 및 `update` 메서드에서 `serviceType`을 request에서 읽어 Bike 도메인에 전달.

---

## Frontend Changes (front-admin-web)

### Modified: `lib/services/service-ops-api.ts`

새 타입 추가:

```ts
export type ServiceOpsBikeServiceType = "DELIVERY" | "CLEANING" | "OTHER";
```

`ServiceOpsBike` 타입에 추가:

```ts
serviceType?: ServiceOpsBikeServiceType;
```

`FrontendVehicle` 타입에 추가:

```ts
serviceType?: ServiceOpsBikeServiceType;
```

`toFrontendVehicle()` 변환 함수에서 매핑:

```ts
serviceType: raw.serviceType,
```

### Modified: `components/management/VehicleDetailDialog.tsx`

편집 폼에 `serviceType` select 추가 (`engineType` select 바로 아래):

```tsx
<label>
  서비스 유형
  <select name="serviceType" defaultValue={vehicle.serviceType ?? "DELIVERY"}>
    <option value="DELIVERY">배송</option>
    <option value="CLEANING">클리닝</option>
    <option value="OTHER">기타</option>
  </select>
</label>
```

뷰 모드 `DetailField`에도 추가:

```tsx
<DetailField label="유형" value={serviceTypeLabel(vehicle.serviceType)} />
```

헬퍼 함수:

```ts
function serviceTypeLabel(t?: ServiceOpsBikeServiceType): string {
  if (t === "CLEANING") return "클리닝";
  if (t === "OTHER") return "기타";
  return "배송";
}
```

### Modified: `app/actions.ts`

`updateVehicleFromOverviewAction`에서 `formData.get("serviceType")`을 읽어 API 요청에 포함.

### Modified: `components/management/VehiclesPanel.tsx`

필터바 위에 서비스 유형 탭 추가:

```tsx
// serviceType 필터 state
const [serviceTypeFilter, setServiceTypeFilter] =
  useState<ServiceOpsBikeServiceType | "ALL">("ALL");

// 탭 UI (기존 RiderFilterControls 위에)
<div className="service-type-tabs">
  {(["ALL", "DELIVERY", "CLEANING", "OTHER"] as const).map((t) => (
    <button
      key={t}
      type="button"
      className={serviceTypeFilter === t ? "service-type-tab is-active" : "service-type-tab"}
      onClick={() => setServiceTypeFilter(t)}
    >
      {t === "ALL" ? "전체" : t === "DELIVERY" ? "배송" : t === "CLEANING" ? "클리닝" : "기타"}
    </button>
  ))}
</div>
```

`visibleVehicles` 계산에서 필터 적용:

```ts
const filteredByType = serviceTypeFilter === "ALL"
  ? vehicles
  : vehicles.filter((v) => (v.serviceType ?? "DELIVERY") === serviceTypeFilter);
```

### Modified: `components/overview/OverviewMapBanner.tsx` + `FullscreenMapHost.tsx`

`serviceTypeFilter` state 추가. `effectiveBikePins` 계산 시 serviceType 기준 필터링 추가. 지도 위 필터 탭 UI 추가 (VehiclesPanel과 동일한 탭 컴포넌트 공유).

### New: `components/overview/ServiceTypeFilterTabs.tsx`

VehiclesPanel과 지도 양쪽에서 재사용할 탭 컴포넌트. props:

```ts
{
  value: ServiceOpsBikeServiceType | "ALL";
  onChange: (value: ServiceOpsBikeServiceType | "ALL") => void;
}
```

### Modified: `app/globals.css`

```css
.service-type-tabs { display: flex; gap: 4px; margin-bottom: 8px; }
.service-type-tab {
  padding: 4px 12px; border-radius: 999px; font-size: 13px;
  font-weight: 600; border: 1px solid var(--rm-line-subtle);
  background: transparent; color: var(--color-text-muted); cursor: pointer;
}
.service-type-tab.is-active {
  background: var(--baemin-mint); color: #fff; border-color: var(--baemin-mint);
}
```

---

## Data Flow

```
운영자 차량 수정 (편집 폼 serviceType select)
  → updateVehicleFromOverviewAction
  → PATCH /bikes/:id { serviceType: "CLEANING" }
  → Bike.updateBasicProfile(serviceType)
  → bikes 테이블 service_type = 'CLEANING'

페이지 로드
  → GET /bikes → BikeReadResponse.serviceType
  → toFrontendVehicle() → FrontendVehicle.serviceType
  → VehiclesPanel 필터 탭 / 지도 마커 필터링
```

---

## Out of Scope

- 고객 일정 관리 및 시동 ON 발송 시뮬레이션 → 스펙 B에서 별도 진행
- 실제 SMS/카카오 발송 연동
- serviceType별 정비 카탈로그 분리
