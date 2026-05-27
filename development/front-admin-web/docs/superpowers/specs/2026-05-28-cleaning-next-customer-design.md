# 클리닝 차량 다음 고객 설정 + 시뮬레이션 연동 설계

## 목표

CLEANING 서비스 타입 차량에 한해, 관리자가 다음 방문 고객 정보(이름·전화번호·주소)를 입력하면:
1. 시뮬레이션이 랜덤 좌표 대신 해당 고객 주소를 목적지로 사용해 이동
2. 시동 ON 시 벨 알림에 "📞 {번호판} → {고객이름} {전화번호}" 표시

DELIVERY 차량은 기존 동작(랜덤 목적지, 벨 알림 없음) 그대로 유지.

---

## 아키텍처 개요

```
관리자
  └─ VehicleDetailDialog "다음 고객" 섹션 (CLEANING 전용)
       └─ Server Action → PUT /api/bikes/{id}/next-customer
            └─ NCP 지오코딩 (ncp-geocoder.ts 재사용)
            └─ DB upsert: bike_next_customer 테이블

대시보드 로딩 (SSR)
  └─ GET /api/dashboard → FrontendDashboardBikePin에 nextCustomer 필드 포함

시뮬레이션 (클라이언트)
  └─ FleetSimulationContext
       └─ pin.nextCustomerLat/Lng 있으면 해당 좌표를 destination으로 사용
       └─ 없으면 기존 randomSeoulPoint() 유지
       └─ 시동 ON → IgnitionNotification에 customerName/Phone 포함
            └─ NotificationBell 드롭다운 "📞 {번호판} → {이름} {전화}" 표시
```

---

## 데이터 모델

### 신규 테이블: `bike_next_customer`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `bike_id` | VARCHAR | PK, FK → bike.id | 1:1 관계 |
| `customer_name` | VARCHAR(100) | NOT NULL | 고객 이름 |
| `customer_phone` | VARCHAR(20) | NOT NULL | 전화번호 |
| `address` | VARCHAR(500) | NOT NULL | 주소 (표시용) |
| `latitude` | DOUBLE | NOT NULL | NCP 지오코딩 결과 |
| `longitude` | DOUBLE | NOT NULL | NCP 지오코딩 결과 |
| `updated_at` | TIMESTAMP | NOT NULL | 마지막 저장 시각 |

- CLEANING 차량에만 사용. row 없으면 → 기존 랜덤 시뮬레이션 유지
- 저장 시 upsert (INSERT … ON DUPLICATE KEY UPDATE)

### 기존 API 응답 확장: `FrontendDashboardBikePin`

```ts
nextCustomerName?: string
nextCustomerPhone?: string
nextCustomerLat?: number
nextCustomerLng?: number
```

대시보드 API가 내려줄 때 `bike_next_customer` 테이블 LEFT JOIN으로 포함.

---

## 백엔드 API (`service-ops-api`)

### GET `/api/bikes/{bikeId}/next-customer`

다음 고객 정보 조회.

- **200**: `{ customerName, customerPhone, address, latitude, longitude }`
- **404**: row 없음 (미설정 상태)
- **403**: `serviceType != CLEANING`이면 접근 차단

### PUT `/api/bikes/{bikeId}/next-customer`

다음 고객 정보 저장. 서버에서 NCP 지오코딩 실행 후 upsert.

- **Request body**: `{ customerName: string, customerPhone: string, address: string }`
- **200**: `{ customerName, customerPhone, address, latitude, longitude }`
- **400**: `serviceType != CLEANING`
- **422**: 주소 지오코딩 실패 (NCP API 응답 없음 또는 주소 불명)

지오코딩은 기존 `ncp-geocoder.ts`의 `geocodeAddress(address)` 함수를 서버 액션에서 재사용.

### 대시보드 API 확장

기존 `GET /api/dashboard` (또는 `/api/bikes/dashboard-pins`) 응답에 `bike_next_customer` LEFT JOIN 추가.

---

## 프론트엔드

### 변경 파일 목록

| 파일 | 신규/수정 |
|------|----------|
| `components/management/VehicleDetailDialog.tsx` | 수정 — "다음 고객" 섹션 추가 |
| `app/actions.ts` | 수정 — `setNextCustomerAction` 추가 |
| `lib/services/service-ops-api.ts` | 수정 — `FrontendDashboardBikePin` 타입 확장, API 클라이언트 추가 |
| `components/overview/FleetSimulationContext.tsx` | 수정 — destination 연동, notification customerName/Phone 추가 |
| `components/layout/NotificationContext.tsx` | 수정 — `IgnitionNotification` 타입 확장 |
| `components/layout/NotificationBell.tsx` | 수정 — 고객 정보 표시 |
| `lib/services/fleet-simulation.ts` | 수정 — `SimulatedBikeState`에 `nextCustomerDestination` 추가, `makeInitialState` + `advanceBikeState` 연동 |

### VehicleDetailDialog — "다음 고객" 섹션

- `serviceType === "CLEANING"`인 차량에만 렌더링
- 다이얼로그 열릴 때 `GET /api/bikes/{id}/next-customer` 로 기존 값 로드 (없으면 빈 폼)
- 필드: 고객 이름, 전화번호, 주소 (텍스트)
- "저장" 클릭 → `setNextCustomerAction` Server Action 호출
- 저장 성공 시 변환된 좌표 표시: `✓ 좌표: {lat} / {lng}`
- 저장 실패(지오코딩 오류) 시: "주소를 찾을 수 없습니다. 다시 확인해주세요."
- 위치: 배송 상태 섹션 바로 아래

### Server Action: `setNextCustomerAction`

```ts
// app/actions.ts
export async function setNextCustomerAction(bikeId: string, data: {
  customerName: string
  customerPhone: string
  address: string
}): Promise<{ ok: true; lat: number; lng: number } | { ok: false; error: string }>
```

1. `geocodeAddress(data.address)` 호출
2. null 반환 시 `{ ok: false, error: "주소를 찾을 수 없습니다." }`
3. 성공 시 `PUT /api/bikes/{bikeId}/next-customer` 호출
4. `{ ok: true, lat, lng }` 반환

---

## 시뮬레이션 연동

### `fleet-simulation.ts` — `SimulatedBikeState`에 `nextCustomerDestination` 추가

```ts
export type SimulatedBikeState = {
  ...
  /** CLEANING 전용. 다음 고객 좌표. null이면 randomSeoulPoint() 사용. */
  nextCustomerDestination: { lat: number; lng: number } | null
}
```

`advanceBikeState`의 WORKING→MOVING 전환 시:
```ts
const destination = prev.nextCustomerDestination ?? randomSeoulPoint(random)
```

`makeInitialState`에도 `nextCustomerDestination?: { lat; lng }` 파라미터 추가.

### `FleetSimulationContext.tsx` — 초기화 시 destination 주입

```ts
makeInitialState({
  bikeId,
  origin,
  phase: "MOVING",
  serviceType: pin.serviceType ?? "DELIVERY",
  nextCustomerDestination: (pin.serviceType === "CLEANING" && pin.nextCustomerLat)
    ? { lat: pin.nextCustomerLat, lng: pin.nextCustomerLng! }
    : null
})
```

### `FleetSimulationContext.tsx` — tick loop에서 destination 동기화

pin 데이터가 변경될 때(관리자가 다음 고객 업데이트) 시뮬레이션 상태에 반영:

```ts
// tick loop setSimulated 내부 — 매 250ms
const pin = pinsRef.current.find(p => p.bikeId === bikeId)
const pinDest = (pin?.serviceType === "CLEANING" && pin.nextCustomerLat)
  ? { lat: pin.nextCustomerLat, lng: pin.nextCustomerLng! }
  : null
const withDest = { ...advanced, nextCustomerDestination: pinDest }
next.set(bikeId, withDest)
```

이렇게 하면 관리자가 다음 고객을 바꾸면 250ms 이내에 시뮬레이션 상태에 반영되고,
다음 WORKING→MOVING 전환 시 새 고객 좌표로 이동한다.

### `FleetSimulationContext.tsx` — 알림 customerName/Phone 포함

```ts
addNotification({
  plateNumber,
  startedAt: state.ignitionOnAt,
  customerName: pin?.nextCustomerName,
  customerPhone: pin?.nextCustomerPhone
})
```

---

## 알림 시스템

### `IgnitionNotification` 타입 확장

```ts
export type IgnitionNotification = {
  id: string
  plateNumber: string
  startedAt: number
  customerName?: string   // 추가
  customerPhone?: string  // 추가
}
```

### `NotificationBell` 드롭다운 표시

```
// 고객 설정됨
📞 서울12가3456 → 홍길동 010-1234-5678     방금

// 고객 미설정 (기존 동작 유지)
🔑 서울12가3456 이동 시작                  방금
```

---

## 엣지 케이스

| 상황 | 동작 |
|------|------|
| 다음 고객 미설정 CLEANING 차량 | 랜덤 서울 좌표로 이동 (기존 동작 유지), 알림은 "🔑 이동 시작" |
| DELIVERY 차량 | 다음 고객 섹션 미표시, 기존 동작 그대로 |
| 지오코딩 실패 | 저장 차단, 에러 메시지 표시 (좌표 없이 저장 불가) |
| 시뮬레이션 중 고객 변경 | 다음 MOVING 사이클부터 반영 (현재 진행 중인 이동은 변경 없음) |

---

## 비범위 (이번 구현에서 제외)

- 고객 히스토리 (방문 이력 목록)
- 여러 고객 순서 큐 (현재는 "다음 1명"만)
- 실시간 고객 위치 추적
- 고객 SMS/앱 알림
