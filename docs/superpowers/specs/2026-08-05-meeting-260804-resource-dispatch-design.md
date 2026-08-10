# 썬더크루 260804 미팅 요구사항 구체화

- 작성일: 2026-08-05
- 미팅일: 2026-08-04
- 상태: 설계 확정, 구현 착수 전 (코드 변경 없음)

## 1. 문서의 성격

2026-08-04 미팅에서 나온 rough note를 현재 코드베이스와 대조해 구체화한 문서입니다.
각 항목마다 **미팅 원문 → 현재 코드 상태 → 확정 변경안 → 영향 범위 → 미결**을 남깁니다.

이 문서 하나로 구현하지 않습니다. 12개 항목이 bike/rider/contract/dispatch/maintenance/zone/theme/notification
8개 모듈에 걸쳐 있어 단일 implementation plan 범위를 넘습니다. §8에 구현 슬라이스 분해를 둡니다.

## 2. 미팅 원문

```
오토바이

자원 관리:
- 차량에 용도(배송용/클린차량) 추가 (자주 안 바꿀 거임)
- 이용자: 라이더/클리너 구분 + 초보/고수 등 기입

오토바이: 인수/반납
클리닝: 직영/협력
- 계약 형태 + 인수방식 통합 위와 같이

관리 추가 (함체(배송물 넣는 곳) 관리) - 오토바이만
체크 표시로 정비 관리
정비 체크를 자원 관리 차량을 클릭하면 되게

엔진에 LPG

배송용 - 단일 배차 (한건 = 콜배차), 순차 배차 (여러건)
클리닝 - 단일 배차, 순차 배차 (서비스 시간 + 예상 시간 + 카톡 연락 혹은 사이트 알람)

권역 구분 + 용도별로 화면 다르게

색을 설정할 수 있게

실시간 cctv api 검토
```

## 3. 확정 결정 요약

| # | 항목 | 결정 |
| --- | --- | --- |
| 1 | 용도 축 | 배차 방식을 용도로 되돌림. 용도는 차량, 배차 방식은 배차 단위 |
| 2 | 배차 방식 값 | `CALL`은 단일 배차에 흡수, `ROUND`(왕복) 유지 |
| 3 | 이용자 구분 | 직무(`role`) + 숙련도(`skill_level`) 2개 축 신규 |
| 4 | 계약 형태/인수방식 | 용도별 별도 필드 |
| 5 | 함체 | 기존 장비(equipment) 모듈 재사용 |
| 6 | 정비 체크 | 차량 상세 + 정비 페이지 양방향 유지 |
| 7 | LPG | 엔진 3값 + 정비 분류 6분류로 확장 |
| 8 | 권역 | 권역 마스터 + 색상 신설 (경계 폴리곤은 후속) |
| 9 | 클리닝 알림 | 시각 데이터 + 사내 사이트 알람까지. 카카오 알림톡은 후속 |
| 10 | 화면 분기 | 전역 용도 스위치 |
| 11 | 색 설정 | 관리자 웹 테마/브랜드 액센트 색 |
| 12 | CCTV | 검토 항목으로만 기록 |

## 4. 핵심: 축 재정의

### 4.1 지금 왜 꼬여 있는가

"용도(배송용/클린차량)"는 이 저장소에 있었다가 사라진 개념입니다.

1. 원래 `bikes.service_type` = `DELIVERY` / `CLEANING` / `OTHER` — 용도 축이었습니다.
2. `V36__rebrand_bikes_service_type_to_operating_mode.sql` 이 같은 컬럼을 **배차 방식**으로
   재해석해 덮어썼습니다. `DELIVERY→SINGLE`, `CLEANING→SEQUENTIAL`, 신규 값은
   `CALL`/`SINGLE`/`SEQUENTIAL`/`ROUND`/`OTHER`.
3. `V50__move_service_type_to_contract.sql` 이 그 컬럼을 차량에서 떼어
   `rider_bike_contracts.service_type` 으로 옮기고 `bikes.service_type` 을 삭제했습니다.

미팅 노트는 **배송용도 단일/순차**, **클리닝도 단일/순차** 라고 말합니다.
즉 용도와 배차 방식은 직교하는 두 축인데, 현재 코드는 하나의 `service_type` 안에 뭉개 놓았습니다.
V36이 두 개념을 같은 컬럼에 겹쳐 쓴 것이 원인입니다.

### 4.2 확정 구조

> **갱신됨 (2026-08-10).** 이 절의 배차 방식 부분은 이후 두 결정으로 바뀌었습니다.
> 용도 축(`purpose`)은 그대로 유효합니다.
>
> - 배송은 **주문 풀 모델**이 되어 순서 개념이 없어졌습니다. 방식은 단일뿐입니다.
> - 클리닝은 **예정 시각이 순서를 정하므로** 단일이 순차에 흡수됐습니다.
>
> 현재 기준: [`docs/frontend/03-screen-feature-map.md`](../../frontend/03-screen-feature-map.md) §3, §7.2

| 축 | 컬럼 | 값 | 소유 | 변경 빈도 |
| --- | --- | --- | --- | --- |
| 용도 | `purpose` | `DELIVERY`(배송용) / `CLEANING`(클린차량) | 차량 | 거의 없음 |
| 배차 방식 | `dispatch_method` | `SINGLE` / `SEQUENTIAL` / `ROUND` | 배차 | 건마다 |

허용 조합 (2026-08-10 기준으로 수정된 값):

| | 단일 | 순차 | 왕복 |
| --- | --- | --- | --- |
| 배송용 | 허용 (유일) | 불허 | 불허 |
| 클린차량 | 불허 (순차에 흡수) | 허용 | 허용 |

`OTHER`는 제거합니다. 용도 축에서 "기타 용도의 차량"은 운영상 의미가 없고,
`V50`이 고아 계약 백필용으로 쓴 값이라 데이터 정리 대상입니다.

### 4.3 `CALL`의 처리

미팅 노트가 "단일 배차 (한건 = 콜배차)"라고 정의했으므로 `CALL`과 `SINGLE`은 같은 것입니다.
`CALL`을 enum에서 제거하고 **단일 배차의 하위 동작**으로 내립니다.

- 콜 배차의 실체는 "라이더가 수락하거나 시스템이 자동 배차하는" 흐름입니다.
- 이것은 배차 방식이 아니라 **배정 방식**입니다. `dispatch_orders.assignment_mode`
  (`OPERATOR`=운영자 지정 / `OFFER`=라이더 수락 / `AUTO`=시스템 자동)로 표현합니다.
- 기존 `DispatchOrderStatus`의 offered 상태(`V35__dispatch_orders_offered_status.sql`)와
  `BaeminCallPanel`은 `assignment_mode = OFFER` 경로로 재해석해 그대로 살립니다.

### 4.4 배차 방식을 어디에 붙일지 — 오더에 둔다

현재 `dispatch_batch`는 왕복 전용입니다. `COLLECTING → DELIVERING → DONE` 2단계 상태기를 갖고,
단일·순차 오더는 `dispatch_orders.batch_id`가 비어 있습니다.

**결정: `dispatch_orders.dispatch_method` 컬럼을 추가하고, `dispatch_batch`는 왕복 그룹핑 전용으로 유지합니다.**

이유: 왕복만 2단계 상태기가 필요해서 배치가 존재합니다. 단일 1건에 배치를 강제하면
실체 없는 래퍼가 생기고 기존 오더 전체를 백필해야 합니다.

트레이드오프: 왕복 배차에서는 `dispatch_method`가 오더마다 중복 기록됩니다.
`batch_id`가 있으면 `dispatch_method = ROUND`라는 불변식을 서비스 레이어에서 검증합니다.

### 4.5 계약에 용도 스냅샷을 남긴다

`rider_bike_contracts.service_type`(V50)을 삭제하지 않고 **`purpose` 스냅샷으로 개명**합니다.

차량 용도가 나중에 바뀌어도 과거 계약의 인수방식(인수/반납 vs 직영/협력)이 어떤 의미였는지
해석이 깨지지 않습니다. 계약 생성 시 차량의 `purpose`를 복사하고, 이후 차량 용도 변경은
기존 계약에 전파하지 않습니다.

순수 되감기보다 컬럼 하나가 더 남지만, 계약은 법적 문서라 시점 값을 보존하는 편이 맞습니다.

## 5. 항목별 상세

### 5.1 차량에 용도 추가

- **미팅 원문**: "차량에 용도(배송용/클린차량) 추가 (자주 안 바꿀 거임)"
- **현재**: `bikes`에 용도 컬럼 없음(V50에서 삭제). `Bike` 엔티티에 `engineType`,
  `wheelType`, `operationStatus`, `ignitionBlocked`만 있음
- **변경**:
  - `bikes.purpose` 컬럼 신규 (`DELIVERY`/`CLEANING`, NOT NULL, default `DELIVERY`)
  - `BikePurpose` enum 신규. 기존 `BikeServiceType`은 삭제
  - 차량 등록/수정 폼에 용도 select 추가. "자주 안 바꿈"이므로 수정 시 확인 다이얼로그
  - 백필: `rider_bike_contracts.service_type`의 현재 값에서 역매핑
    (`SEQUENTIAL`/`ROUND` → `CLEANING`, 그 외 → `DELIVERY`).
    활성 계약이 없는 차량은 `DELIVERY`
- **영향**: `Bike.java`, `BikeCommandService`, `BikeReadService`, `BikeReadResponse`,
  `CreateVehicleDialog.tsx`, `VehicleDetailDialog.tsx`, `vehicle-data.ts`, `service-ops-api.ts`
- **미결**: 백필 역매핑이 V36의 손실 변환을 완전히 복원하지 못합니다.
  `DELIVERY→SINGLE`, `CLEANING→SEQUENTIAL`은 되돌려지지만, V36 이후 운영자가 손으로
  `CALL`/`ROUND`로 바꾼 차량은 원래 용도를 알 수 없습니다. 배포 전 운영자 검수 목록 필요

### 5.2 이용자 직무/숙련도 구분

- **미팅 원문**: "이용자: 라이더/클리너 구분 + 초보/고수 등 기입"
- **현재**: `riders`에 `name`, `phoneNumber`, `teamName`, `areaName`,
  `trainingStatus`(`ONLINE`/`OFFLINE`/`INCOMPLETE` — 교육 이수 축), `memo`
- **변경**:
  - `riders.role` 신규 (`RIDER`/`CLEANER`, NOT NULL, default `RIDER`)
  - `riders.skill_level` 신규 (`BEGINNER`/`INTERMEDIATE`/`EXPERT`, nullable)
  - `trainingStatus`는 교육 이수라는 별개 축이므로 그대로 둠
  - 배차 후보 필터링: 차량 `purpose`와 라이더 `role`을 맞춤
    (`DELIVERY`↔`RIDER`, `CLEANING`↔`CLEANER`)
  - 라이더 목록에 직무/숙련도 컬럼 + 필터 추가
- **영향**: `Rider.java`, `RiderCommandService`, `RiderReadResponse`,
  `RiderBulkService`(엑셀 임포트 컬럼 2개 추가), `CreateRiderDialog.tsx`,
  `RiderDetailDialog.tsx`, `RidersManagementPanel.tsx`
- **미결**: 숙련도를 운영자가 손으로 넣을지, 완료 배차 건수에서 자동 산출할지.
  1차는 수동 입력으로 둡니다

### 5.3 계약 형태 + 인수방식 통합

- **미팅 원문**: "오토바이: 인수/반납 / 클리닝: 직영/협력 / 계약 형태 + 인수방식 통합 위와 같이"
- **현재**:
  - `ContractCategory` = `SUBSCRIPTION`(12개월 구독) / `RENTAL`(단기 렌탈) / `CUSTOM`
  - `ContractReturnType` = `TAKEOVER`(인수) / `RETURN`(반납).
    `SUBSCRIPTION`/`RENTAL`에서 필수, `CUSTOM`에서 선택
- **변경**:
  - `ContractCategory`는 그대로 유지 (계약 형태 축)
  - `ContractReturnType`(인수/반납)은 **배송용 계약 전용**으로 의미를 좁힘
  - `ContractOperationType` 신규 (`DIRECT`=직영 / `PARTNER`=협력) — **클리닝 계약 전용**
  - `rider_bike_contracts.operation_type` 컬럼 신규 (nullable)
  - 검증 규칙:
    - `purpose = DELIVERY` → `return_type` 필수, `operation_type`은 NULL이어야 함
    - `purpose = CLEANING` → `operation_type` 필수, `return_type`은 NULL이어야 함
  - 계약 등록 폼은 차량 select 직후 그 차량의 `purpose`를 읽어 해당 필드만 노출
- **영향**: `ContractReturnType.java`, `RiderBikeContract.java`,
  `RiderBikeContractCommandController`, `RiderBikeContractCreateRequest`,
  `ContractBulkService`, `ContractMatchingForm.tsx`
- **미결**: 협력 계약에 협력사 정보(업체명/정산 조건)가 필요한지.
  미팅에서 언급 없었으므로 이번 범위 제외

### 5.4 함체 관리

- **미팅 원문**: "관리 추가 (함체(배송물 넣는 곳) 관리) - 오토바이만"
- **현재**: `equipment_types`(이름/설명/사용여부) + `bike_equipments`(차량↔장비 종류 연결,
  `equipmentLabel`, `modelName`, `serialNumber`, `installedAt`, `removedAt`,
  `managementDueDate`, `managementNote`, `memo`) — 신규 테이블 없이 충분합니다
- **변경**:
  - `equipment_types`에 "함체" 항목을 시드로 추가
  - `equipment_types.applies_to_purpose` 컬럼 신규 (nullable, NULL=전 용도)
    → 함체는 `DELIVERY`로 지정
  - 차량 상세의 장비 섹션은 그 차량 `purpose`에 맞는 장비 종류만 select에 노출
- **영향**: `EquipmentType.java`, `EquipmentTypeCommandController`,
  `EquipmentReadController`, `BikeEquipmentCommandController`, `VehicleDetailDialog.tsx`
- **미결**: 함체가 차량 간 이동(탈거 후 다른 차량 장착)하는 자산인지.
  `bike_equipments`는 설치/탈거 이력만 있고 함체 자체의 생애주기 추적은 없습니다.
  운영에서 함체를 개별 자산으로 추적해야 하면 별도 엔티티가 필요합니다

### 5.5 정비 체크 + 차량 상세 진입

- **미팅 원문**: "체크 표시로 정비 관리 / 정비 체크를 자원 관리 차량을 클릭하면 되게"
- **현재**:
  - `/management/maintenance` 페이지 + `MaintenancePanel.tsx`
  - `MaintenanceItem` = 정비 품목 카탈로그(`categories`, `cycleKm`, `cycleMonths`,
    `alertThresholdPercent`)
  - `VehicleMaintenanceRecord` = 차량별 정비 기록
  - 차량 상세(`VehicleDetailDialog.tsx`)에는 정비 요약만 있고 체크 입력이 없음
- **변경**:
  - 차량 상세에 **정비 체크리스트 섹션** 신설. 그 차량의 `MaintenanceCategory`에
    해당하는 품목이 체크박스 목록으로 뜨고, 체크하면 `VehicleMaintenanceRecord`가 생성됨
  - `/management/maintenance` 페이지는 유지 (양방향)
  - 두 입력 경로가 **같은 백엔드 command 서비스**를 공유하게 묶습니다.
    `MaintenanceCommandController`에 단일 체크 엔드포인트를 두고 양쪽이 호출
- **영향**: `MaintenanceCommandController`, `MaintenanceCommandService`,
  `VehicleDetailDialog.tsx`, `MaintenancePanel.tsx`, `vehicle-maintenance-data.ts`
- **미결**: 체크 해제(오입력 취소) 동작. 기록 삭제인지 취소 기록 추가인지.
  감사 로그(`audit_logs`)가 있으므로 취소도 기록으로 남기는 편이 일관됩니다

### 5.6 엔진 LPG 추가

- **미팅 원문**: "엔진에 LPG"
- **현재**:
  - `BikeEngineType` = `ELECTRIC` / `ICE`
  - `MaintenanceCategory` = `TWO_WHEEL_ELECTRIC` / `TWO_WHEEL_ICE` /
    `FOUR_WHEEL_ELECTRIC` / `FOUR_WHEEL_ICE` — (2륜/4륜)×(전기/내연) 4분류
  - `MaintenanceItem.categories`는 다중값이라 한 품목이 여러 분류에 속할 수 있음
- **변경**:
  - `BikeEngineType`에 `LPG` 추가 (3값)
  - `MaintenanceCategory`에 `TWO_WHEEL_LPG`, `FOUR_WHEEL_LPG` 추가 (6분류)
  - 차량 → 정비 분류 매핑을 `(wheelType, engineType)` 조합으로 확장
- **영향**: `BikeEngineType.java`, `MaintenanceCategory.java`,
  `vehicle-maintenance-derive.ts`, 차량 폼의 엔진 select, 정비 품목 폼의 분류 체크박스
- **미결**: 기존 정비 품목의 LPG 분류 재부여가 필요합니다.
  브레이크 패드처럼 동력과 무관한 품목은 6분류 전체에 넣어야 하고,
  엔진오일처럼 내연 전용인 품목은 LPG에 포함되는지 운영 판단이 필요합니다.
  마이그레이션에서 `*_ICE`가 붙은 품목을 `*_LPG`에도 자동 복사한 뒤
  운영자가 검수하는 방식을 제안합니다

### 5.7 권역 구분

- **미팅 원문**: "권역 구분 + 용도별로 화면 다르게"
- **현재**: `riders.area_name` 자유 텍스트 하나뿐. 권역 엔티티 없음.
  차량·배차에는 권역 개념이 아예 없음
- **변경**:
  - `zones` 테이블 신규: `name`, `color`, `display_sequence`, `enabled`, soft delete
  - `riders.zone_id`, `bikes.zone_id`, `dispatch_orders.zone_id` FK 추가 (nullable)
  - `riders.area_name` → `zone_id` 백필 (문자열 매칭, 미매칭은 NULL + 검수 목록 출력).
    백필 후에도 `area_name`은 한 릴리스 동안 유지해 롤백 여지를 남김
  - 권역 마스터 관리 화면 신규 (이름/색상 picker/표시순서)
  - 지도 마커·범례·목록 필터를 권역 색 기준으로 구동
  - 경계 폴리곤은 **후속**. 좌표 기반 권역 자동 판정도 후속
- **영향**: 신규 `zone` 패키지(도메인/컨트롤러/서비스/리포지토리), `Rider.java`,
  `Bike.java`, `DispatchOrder.java`, 지도 컴포넌트 전반, `RiderFilterControls.tsx`,
  `VehicleFilterControls.tsx`, `filter-compute.ts`
- **미결**: 권역이 계층(시/구/동)을 갖는지. 1차는 단일 레벨 평면 목록으로 둡니다

### 5.8 배차 방식 재정의

- **미팅 원문**: "배송용 - 단일 배차 (한건 = 콜배차), 순차 배차 (여러건) /
  클리닝 - 단일 배차, 순차 배차"
- **현재**:
  - `BikeServiceType` = `CALL`/`SINGLE`/`SEQUENTIAL`/`ROUND`/`OTHER` (계약에 저장)
  - `DispatchOrder`: `kind`(`PICKUP`/`DELIVERY`), `sequence`, `batch_id`(nullable)
  - `DispatchBatch`: `status`(`COLLECTING`/`DELIVERING`/`DONE`) — 왕복 전용
  - 프론트 패널 4개: `BaeminCallPanel`, `DispatchPanel`, `SequentialDispatchPanel`,
    `StrollerRoundPanel`
  - `ServiceTypeFilterTabs`에 5개 탭(전체/콜/단일/순차/왕복/기타)
- **변경**:
  - `DispatchMethod` enum 신규 = `SINGLE` / `SEQUENTIAL` / `ROUND`
  - `dispatch_orders.dispatch_method` 컬럼 신규 (NOT NULL)
  - `dispatch_orders.assignment_mode` 컬럼 신규
    (`OPERATOR`/`OFFER`/`AUTO`, default `OPERATOR`) — `CALL`의 대체
  - `BikeServiceType` 삭제. `rider_bike_contracts.service_type` → `purpose` 개명
  - 불변식: `batch_id IS NOT NULL` → `dispatch_method = ROUND`
  - 불변식: 차량 `purpose = DELIVERY` → `dispatch_method != ROUND`
  - `BaeminCallPanel`은 `dispatch_method = SINGLE` + `assignment_mode = OFFER` 경로로 재해석
  - `ServiceTypeFilterTabs`는 용도 스위치(§5.10)와 배차 방식 탭으로 분리
- **영향**: `dispatch` 패키지 전체, `DispatchOrderReadService`,
  `DispatchOrderCommandController`, `DispatchBatchCommandController`, 배차 패널 4개,
  `DispatchMonitorTable.tsx`, `ServiceTypeFilterTabs.tsx`, `use-focus-dispatch-orders.ts`
- **미결**: 기존 오더 백필. `batch_id`가 있으면 `ROUND`, `sequence > 0`이면 `SEQUENTIAL`,
  나머지는 `SINGLE`로 추정합니다. 계약의 구 `service_type = CALL`이던 오더는
  `SINGLE` + `assignment_mode = OFFER`로 넣습니다

### 5.9 클리닝 순차배차 시각 정보와 알림

- **미팅 원문**: "순차 배차 (서비스 시간 + 예상 시간 + 카톡 연락 혹은 사이트 알람)"
- **현재**:
  - `DispatchOrder`에 시간 필드는 `completedAt`만 있음. 예정 시각/소요 시간 없음
  - `Notification` = `type`(자유 문자열), `title`, `body`, `refBikeId`, `refEntityId`,
    `refRiderId`, `occurredAt`, `acknowledgedAt` — 사내 알림 인프라 있음
  - 카카오 알림톡 연동 없음. 외부 발송 채널 자체가 없음
- **변경 (이번 범위)**:
  - `dispatch_orders.service_scheduled_at` (예정 서비스 시각, nullable)
  - `dispatch_orders.estimated_duration_minutes` (예상 소요 시간, nullable)
  - 순차 배차 패널에 두 필드 입력 + 배차 모니터 테이블에 표시
  - 사내 사이트 알람: 예정 시각 임박/초과 시 `Notification` 생성
    (`type = CLEANING_SERVICE_DUE`). 기존 알림 벨(`NotificationBell.tsx`)에 그대로 뜸
- **후속 범위 (별도 이슈)**:
  - 카카오 알림톡 발송. 발신프로필 등록, 템플릿 심사, 발송 이력/재시도,
    수신 동의 관리가 필요하고 외부 승인 리드타임이 불확실합니다
- **영향**: `DispatchOrder.java`, `DispatchOrderCommandController`,
  `NotificationCommandService`, `SequentialDispatchPanel.tsx`, `DispatchMonitorTable.tsx`
- **미결**: "임박"의 기준. 정비 알림이 `alert_threshold_percent`를 쓰는 것처럼
  설정 가능한 값으로 둘지, 고정 분 단위로 둘지

### 5.10 용도별 화면 분기 — 전역 스위치

- **미팅 원문**: "권역 구분 + 용도별로 화면 다르게"
- **현재**: 사이드바 4개 메뉴(지도 / 자원 관리 / 업무 관리 / 정비 관리).
  용도 개념이 없어 모든 차량·배차가 한 화면에 섞임.
  `ServiceTypeFilterTabs`가 배차 방식 탭으로 부분 대응
- **변경**:
  - 앱 셸(`AppShell.tsx`)에 **전역 용도 스위치**(배송용 / 클린차량) 추가
  - 선택값에 따라 통째로 바뀌는 것:
    - 지도: 마커 대상 차량, 범례
    - 자원 관리: 차량 목록 필터, 장비 섹션(함체는 배송용만), 계약 폼 필드
    - 업무 관리: 노출되는 배차 패널 (배송용=단일/순차, 클린차량=단일/순차/왕복)
    - 정비 관리: 해당 용도 차량만
  - 선택값 보존: URL query param + 쿠키. 서버 컴포넌트가 읽을 수 있어야
    데이터 로드 단계에서 필터링됩니다
- **영향**: `AppShell.tsx`, `SidebarPrimaryNav.tsx`, 모든 `/management/*` 페이지의
  서버 로더, `app/page.tsx`, `OverviewClientShell.tsx`, `VehicleFilterContext.tsx`
- **미결**: "전체" 옵션을 둘지. 운영자가 두 용도를 동시에 봐야 하는 상황이 있으면
  필요합니다. 1차는 배송용/클린차량 2택으로 두고, 요청 시 추가합니다

### 5.11 테마 색 설정

- **미팅 원문**: "색을 설정할 수 있게"
- **현재**:
  - 액센트는 이미 CSS 변수로 토큰화돼 있습니다 (`app/globals.css`). 단 **두 계열이 병존**합니다.
    - `--baemin-mint` — 라이트 `#3B82F6`, 다크 `#00E7D0`.
      변수명만 브랜드 reference로 남아 있고 값은 이미 민트가 아닙니다
    - `--rm-accent` — 라이트 `#3B82F6`, 다크 `#00E7D0`. 라이더 모니터 계열로 분리 도입
  - 두 계열의 값이 현재 동일합니다. 즉 분리 이유가 사라진 상태입니다
  - 파생 토큰(`--rm-accent-soft`/`-halo`/`-halo-strong`/`-outline`/`-outline-strong`,
    `--mint-20` 등)이 rgba 하드코딩으로 각각 정의돼 있어 base 색만 바꿔도 따라오지 않습니다
  - `development/frontend/README.md`와 `DESIGN.md`가 말하는 `#0CEFD3` 단일 액센트는
    **현재 코드와 다릅니다** (문서 stale). 루트 `README.md`는 색상값 서술 없이
    `DESIGN.md`를 가리키기만 합니다
- **변경**:
  - 먼저 `--baemin-mint`와 `--rm-accent` 두 계열을 하나로 통합합니다.
    값이 같아진 지금이 통합 시점이고, 통합 없이 설정 기능을 얹으면
    한쪽만 바뀌는 버그가 확정적으로 생깁니다
  - 하드코딩 rgba 파생 토큰을 base 색에서 계산되게 정리
    (`color-mix()` 또는 base를 RGB 채널 변수로 분리)
  - 액센트 base 색을 설정에서 지정 → 런타임에 통합 토큰 주입
  - 저장 위치: 서비스 전역 1개 설정. 관리자별 개인화는 범위 밖
  - 다크/라이트 각각 지정 가능해야 합니다 (현재 두 값이 다름)
  - `development/frontend/README.md`/`DESIGN.md`의 `#0CEFD3` 서술을 실제 값으로 정정
- **영향**: `app/globals.css`, `ThemeToggle.tsx`, 신규 설정 화면,
  신규 `settings` 저장소(백엔드 또는 프론트 전용).
  토큰 통합은 액센트를 쓰는 컴포넌트 전반에 걸칩니다
- **미결**: 설정을 백엔드에 둘지 프론트 전용으로 둘지.
  권역 색상(§5.7)이 이미 백엔드 마스터이므로 테마 색도 백엔드에 두는 편이 일관됩니다

### 5.12 실시간 CCTV API — 검토 항목

- **미팅 원문**: "실시간 cctv api 검토"
- **현재**: 코드베이스에 CCTV 관련 코드 없음
- **이번 범위**: 설계·구현 없이 검토 항목만 기록
- **결정 전 확인해야 할 것**:
  - 대상이 무엇인가 — 공공 교통 CCTV(도로 상황 파악) / 배터리 스테이션 자체 CCTV
    (자산 보안) / 차량 탑재 블랙박스. 세 경우의 제공자·비용·법적 제약이 전부 다릅니다
  - 제공자 후보와 인증 방식, 스트림 포맷(HLS/RTSP/WebRTC),
    동시 시청 수 제한, 과금 모델
  - 개인정보 제약 — 영상에 사람이 찍히면 개인정보 처리 근거, 보관 기간,
    열람 권한, 접근 로그가 필요합니다. `audit_logs`가 있으므로 열람 감사는 붙일 수 있습니다
  - 대역폭·비용 — 관제 화면에 상시 스트림을 띄우면 운영 비용이 선형으로 늘어납니다.
    온디맨드 재생이 현실적입니다
  - RTSP는 브라우저 직접 재생이 불가해 서버 트랜스코딩이 필요합니다.
    이는 현재 단일 EC2 호스트 배포 구조에 부담이 됩니다
- **다음 단계**: 대상과 제공자가 정해지면 별도 설계 문서

## 6. 데이터 모델 변경 요약

Flyway 마이그레이션은 현재 `V50`까지 있습니다. 신규는 `V51` 이후입니다.

| 대상 | 변경 |
| --- | --- |
| `bikes` | `purpose` 추가 (`DELIVERY`/`CLEANING`), `zone_id` FK 추가 |
| `riders` | `role`, `skill_level` 추가, `zone_id` FK 추가 (`area_name`은 한 릴리스 유지) |
| `rider_bike_contracts` | `service_type` → `purpose` 개명 + 값 변환, `operation_type` 추가 |
| `dispatch_orders` | `dispatch_method`, `assignment_mode`, `zone_id`, `service_scheduled_at`, `estimated_duration_minutes` 추가 |
| `equipment_types` | `applies_to_purpose` 추가 + "함체" 시드 |
| `maintenance_item_categories` | `*_LPG` 2개 분류 추가 + 기존 `*_ICE` 품목 복사 |
| `zones` | 신규 테이블 (`name`, `color`, `display_sequence`, `enabled`, soft delete) |
| 설정 저장소 | 테마 액센트 색 (라이트/다크) |

삭제되는 enum: `BikeServiceType` (`CALL`/`SINGLE`/`SEQUENTIAL`/`ROUND`/`OTHER`).

## 7. 되감기 이력 주의

이 작업은 `V36`과 `V50`을 부분적으로 되돌립니다. 다음을 반드시 남깁니다.

- 마이그레이션 주석에 "V36이 용도와 배차 방식을 한 컬럼에 겹쳐 쓴 것을 분리한다"는 의도 기록
- `V36`의 `DELIVERY→SINGLE` / `CLEANING→SEQUENTIAL` 변환은 **손실 변환**이라
  완전 복원이 불가합니다. 백필 후 운영자 검수 목록을 출력하고, 검수 완료를
  이슈에 evidence로 남깁니다
- `docs/backend/00-change-ledger.md`에 축 재정의 결정을 기록

## 8. 구현 슬라이스 분해

12개 항목을 의존 순서대로 나눕니다. 각 슬라이스가 별도 change-control 이슈 + 별도 plan입니다.

| 순서 | 슬라이스 | 포함 | 의존 |
| --- | --- | --- | --- |
| 1 | **용도 축 분리** | §5.1 차량 용도, §5.8 배차 방식 재정의, §4.5 계약 스냅샷 | 없음 |
| 2 | **이용자 구분** | §5.2 직무/숙련도 | 1 (배차 후보 필터링) |
| 3 | **계약 인수방식** | §5.3 용도별 필드 | 1 |
| 4 | **전역 용도 스위치** | §5.10 화면 분기 | 1, 2, 3 |
| 5 | **권역 마스터** | §5.7 zones + FK + 색상 | 없음 (1과 병행 가능) |
| 6 | **정비 확장** | §5.6 LPG 6분류, §5.5 차량 상세 체크리스트 | 1 (용도별 필터) |
| 7 | **함체 관리** | §5.4 equipment 재사용 | 1 (`applies_to_purpose`) |
| 8 | **클리닝 시각·알람** | §5.9 예정 시각/예상 시간 + 사이트 알람 | 1 |
| 9 | **테마 색 설정** | §5.11 | 없음 |
| — | **카카오 알림톡** | §5.9 후속 | 8 |
| — | **권역 폴리곤** | §5.7 후속 | 5 |
| — | **CCTV** | §5.12 대상·제공자 확정 후 | 없음 |

슬라이스 1이 가장 크고 나머지 대부분의 선행 조건입니다. 여기서 백필 검수까지 끝내야
후속 작업이 안전합니다. 슬라이스 5(권역)와 9(테마 색)는 1과 독립이라 병행 가능합니다.

## 9. 미결 항목 모음

구현 착수 전에 운영 판단이 필요한 것들입니다.

| # | 항목 | 내용 |
| --- | --- | --- |
| 1 | 용도 백필 검수 | V36 손실 변환으로 원래 용도 불명인 차량 목록 검수 (§5.1) |
| 2 | 숙련도 산출 | 수동 입력 vs 배차 실적 자동 산출 (§5.2) |
| 3 | 협력사 정보 | 협력 계약에 업체명/정산 조건이 필요한지 (§5.3) |
| 4 | 함체 자산 추적 | 함체가 차량 간 이동하는 개별 자산인지 (§5.4) |
| 5 | 정비 체크 취소 | 기록 삭제 vs 취소 기록 추가 (§5.5) |
| 6 | LPG 정비 품목 | 어느 품목이 LPG에 해당하는지 운영자 검수 (§5.6) |
| 7 | 권역 계층 | 시/구/동 계층 필요 여부 (§5.7) |
| 8 | 알람 임박 기준 | 설정값 vs 고정값 (§5.9) |
| 9 | 용도 "전체" 옵션 | 두 용도 동시 조회 필요 여부 (§5.10) |
| 10 | 테마 설정 저장 위치 | 백엔드 vs 프론트 전용 (§5.11) |
| 11 | CCTV 대상 | 공공 교통 / 스테이션 / 차량 탑재 중 무엇인지 (§5.12) |

## 10. 문서 정정 필요

이 작업 중에 발견한, 현재 코드와 다른 서술입니다.

- `development/frontend/README.md:11`, `:175` — "Baemin Mint Core UI (`#0CEFD3` 단일 액센트)".
  실제 값은 라이트 `#3B82F6` / 다크 `#00E7D0`
- `development/frontend/DESIGN.md` — `#0CEFD3`를 핵심 브랜드 액센트로 서술하고
  `--baemin-mint: #0CEFD3` 토큰 정의까지 예시로 담고 있으나, `globals.css`의 실제
  `--baemin-mint`는 `#3B82F6`(라이트) / `#00E7D0`(다크)입니다
- `development/frontend/README.md` "구현된 화면" 절 — `/management/*` 그룹(자원/업무/정비),
  `/rider/*`, `/dispatch`, `/tips`가 빠져 있음
