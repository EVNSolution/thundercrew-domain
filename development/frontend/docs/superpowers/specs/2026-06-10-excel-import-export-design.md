# Excel Import/Export 설계 (그룹 B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 차량·라이더·매칭을 Excel로 일괄 등록·수정·조회할 수 있는 Import/Export 기능 구현

**Architecture:** 기존 운영 엔티티(Bike, Rider, RiderBikeContract)에 직접 반영. 업로드 시 서버에서 DB와 diff 계산 → 미리보기 → 저장 확인 2단계. Export는 현재 DB 데이터를 기존 Excel 템플릿 형식으로 반환.

**Tech Stack:** Java/Spring Boot (service-ops-api), Apache POI (기존), Next.js App Router, Server Actions

---

## 데이터 모델 변경

### DB 마이그레이션 (V30)

```sql
-- Bike 엔티티에 2륜/4륜 구분, IMEI 추가
ALTER TABLE bikes ADD COLUMN wheel_type VARCHAR(20) NOT NULL DEFAULT 'TWO_WHEEL';
ALTER TABLE bikes ADD COLUMN imei VARCHAR(15);
```

### 백엔드 엔티티 변경

**`Bike.java`** — 필드 추가:
```java
@Enumerated(EnumType.STRING)
@Column(name = "wheel_type", nullable = false, length = 20)
private BikeWheelType wheelType;   // TWO_WHEEL | FOUR_WHEEL

@Column(length = 15)
private String imei;
```

**`BikeWheelType.java`** — 신규 enum:
```java
public enum BikeWheelType { TWO_WHEEL, FOUR_WHEEL }
```

**`Rider.java`** — 변경 없음 (`teamName` 이미 존재)

**`RiderBikeContract.java`** — 변경 없음 (ContractTemplate 참조 유지)

---

## Excel 컬럼 정의

### 차량 (`vehicles-template.xlsx`)
| 컬럼 | 필드 | 비고 |
|------|------|------|
| 차량번호 | `plateNumber` | upsert 기준키 |
| 차종 | `wheelType` | 2륜 / 4륜 |
| 동력 | `engineType` | 전기 / 내연 |
| IMEI | `imei` | 15자리, 선택 |
| 비고 | `memo` | 선택 |

### 라이더 (`riders-template.xlsx`)
| 컬럼 | 필드 | 비고 |
|------|------|------|
| 이름 | `name` | |
| 연락처 | `phoneNumber` | upsert 기준키, 010-XXXX-XXXX |
| 교육이수 | `trainingStatus` | 온라인 / 오프라인 / 미완료 |
| 팀 | `teamName` | 선택 |

### 매칭 (`matching-template.xlsx`)
| 컬럼 | 필드 | 비고 |
|------|------|------|
| 차량번호 | → `bikeId` | 교차 검증: Bike 존재 여부 |
| 이름 | 참고용 | |
| 연락처 | → `riderId` | 교차 검증: Rider 존재 여부 |
| 계약구분 | `category` | 구독 / 렌탈 |
| 반납형태 | `returnType` | 인수형 / 반납형 |
| 시작일 | `startAt` | YYYY-MM-DD |
| 종료일 | `endAt` | YYYY-MM-DD |
| 보험 | `includesInsurance` | Y / N |

매칭 upsert 기준: `bikeId + riderId` 조합으로 활성 계약(`terminatedAt IS NULL`) 조회. ContractTemplate은 `(category, returnType)`으로 enabled 템플릿 중 첫 번째 매칭.

---

## 백엔드 API

### 차량

```
POST /api/v1/bikes/bulk-preview
  multipart/form-data: file=*.xlsx
  → BulkPreviewResponse

POST /api/v1/bikes/bulk-apply
  multipart/form-data: file=*.xlsx
  → BulkApplyResponse

GET  /api/v1/bikes/export
  → application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

### 라이더

```
POST /api/v1/riders/bulk-preview
POST /api/v1/riders/bulk-apply
GET  /api/v1/riders/export
```

### 매칭

```
POST /api/v1/contracts/bulk-preview   (교차 검증 포함)
POST /api/v1/contracts/bulk-apply
GET  /api/v1/contracts/export
```

### 공통 응답 구조

```json
// BulkPreviewResponse
{
  "rows": [
    {
      "rowNumber": 2,
      "status": "UNCHANGED",    // UNCHANGED | UPDATE | NEW | ERROR
      "key": "12가3456",
      "changes": [],            // 변경된 필드명 목록 (UPDATE일 때)
      "errorMessage": null
    },
    {
      "rowNumber": 3,
      "status": "UPDATE",
      "key": "34나5678",
      "changes": ["wheelType", "imei"],
      "errorMessage": null
    },
    {
      "rowNumber": 4,
      "status": "ERROR",
      "key": "78라9012",
      "changes": [],
      "errorMessage": "차량번호 없음 (매칭 검증 실패)"
    }
  ],
  "summary": {
    "unchanged": 8,
    "update": 2,
    "new": 1,
    "error": 1,
    "total": 12
  }
}
```

Stateless 방식: preview·apply 모두 Excel 파일을 직접 업로드. 서버 세션 불필요.

---

## 백엔드 파일 구조

### 차량 bulk
```
bike/
  controller/BikeBulkController.java       (신규)
  service/BikeBulkService.java             (신규)
  dto/BikeBulkPreviewResponse.java         (신규)
  dto/BikeBulkRowResult.java               (신규)
  dto/BulkRowStatus.java (enum)            (신규, 3개 공용)
```

### 라이더 bulk
```
rider/
  controller/RiderBulkController.java      (신규)
  service/RiderBulkService.java            (신규)
  dto/RiderBulkPreviewResponse.java        (신규)
```

### 매칭 bulk
```
contract/
  controller/ContractBulkController.java   (신규)
  service/ContractBulkService.java         (신규)
  dto/ContractBulkPreviewResponse.java     (신규)
```

### Excel 유틸
```
common/excel/
  ExcelParser.java          (신규 — POI 파싱 공용)
  ExcelExporter.java        (신규 — 템플릿 기반 export 공용)
```

---

## 프론트엔드

### 새 페이지
```
app/
  management/
    vehicles/page.tsx        (신규 — 기존 VehiclesPanel 대체)
    riders/page.tsx          (신규 — 기존 RidersPanel 대체)
    matching/page.tsx        (신규 — 운영 매칭, test-matching과 별개)
```

### 컴포넌트
```
components/management/
  ExcelImportButton.tsx      (신규 — 업로드 + 미리보기 모달 공용)
  BulkPreviewModal.tsx       (신규 — diff 테이블, 상태별 색상)
  VehiclesManagementPanel.tsx (신규)
  RidersManagementPanel.tsx   (신규)
  MatchingManagementPanel.tsx (신규)
```

### 서버 액션
```
app/management/vehicles/actions.ts
app/management/riders/actions.ts
app/management/matching/actions.ts
  — bulkPreviewAction(formData)   → BulkPreviewResponse
  — bulkApplyAction(formData)     → void
  — exportAction()                → redirect to /api/.../export
```

### UI 흐름
```
페이지 진입
  → 현재 DB 데이터 테이블 표시 (default)
  → [Excel 내려받기] 버튼: GET /export → 브라우저 다운로드
  → [Excel 업로드] 버튼: 파일 선택 → POST /bulk-preview
       → BulkPreviewModal 열림
            변경 없음(회색) / 업데이트(노란색) / 신규(초록색) / 오류(빨간색) 행 표시
            summary: "변경 없음 8 / 업데이트 2 / 신규 1 / 오류 1"
            오류 있어도 저장 가능 (오류 행만 스킵)
       → [저장] 클릭 → POST /bulk-apply → 모달 닫힘 → 테이블 갱신
```

---

## 서비스 API 클라이언트 타입

```typescript
// lib/services/service-ops-api.ts 에 추가
export type BulkRowStatus = 'UNCHANGED' | 'UPDATE' | 'NEW' | 'ERROR';

export interface BulkRowResult {
  rowNumber: number;
  status: BulkRowStatus;
  key: string;
  changes: string[];
  errorMessage: string | null;
}

export interface BulkPreviewResponse {
  rows: BulkRowResult[];
  summary: {
    unchanged: number;
    update: number;
    new: number;
    error: number;
    total: number;
  };
}
```

---

## 기존 템플릿 활용

`service-ops-api/src/main/resources/templates/excel/` 에 이미 존재:
- `vehicles-template.xlsx` — 차량 컬럼 구조 (wheelType, imei 컬럼 추가 필요)
- `riders-template.xlsx` — 라이더 컬럼 구조
- `matching-template.xlsx` — 매칭 컬럼 구조

Export 시 이 템플릿에 현재 DB 데이터를 채워서 반환. Import 시 동일 컬럼 구조로 파싱.

---

## 계약 테스트

```
bike/BikeBulkControllerTest.java
  - POST /bulk-preview: UNCHANGED / UPDATE / NEW / ERROR 케이스
  - POST /bulk-apply: upsert 적용 확인
  - GET /export: 응답 Content-Type, 행 수 확인

rider/RiderBulkControllerTest.java
  - 동일 패턴

contract/ContractBulkControllerTest.java
  - 교차 검증: 차량번호 없음 → ERROR
  - 교차 검증: 연락처 없음 → ERROR
  - ContractTemplate 매핑: category+returnType → 정상 매칭
```
