# Group A — Map Full View + Tips Feature Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 지도를 항상-on full viewport 레이아웃으로 개편하고, 하단 패널 탭을 차량/충전소/팁으로 정리하며, 팁(위치 기반 알림) 기능을 full-stack으로 신규 구현한다.

**Architecture:** Spring Boot 백엔드에 `tips` 테이블 + REST API를 추가하고, Next.js 프론트엔드에서 기존 FullscreenMapHost 패턴을 메인 레이아웃으로 승격한다. 팁 마커는 MapShell에 차량/충전소와 동일한 방식으로 렌더링된다.

**Tech Stack:** Spring Boot (Java), Flyway, JPA, Next.js App Router, NCP Maps SDK, TypeScript

---

## 1. 페이지 정리 (삭제)

다음 파일/폴더를 완전히 제거한다:

- `app/test-matching/` — 페이지, 서버 액션, 관련 컴포넌트 전체
- `app/overview/` — 루트로의 redirect 파일
- `app/monitoring/` — 루트로의 redirect 파일
- `components/overview/OverviewMapBanner.tsx` — 인라인 지도 토글 컴포넌트
- `components/overview/OverviewKpiTiles.tsx` — KPI 타일 (운행중 차량/라이더 수)
- `app/page.tsx`에서 OverviewKpiTiles, OverviewMapBanner import 및 사용 제거
- `app/page.tsx`에서 RidersPanel, MaintenancePanel 탭 및 import 제거

---

## 2. 레이아웃 리팩터

### 현재 구조
```
/ (page.tsx)
├── OverviewKpiTiles (항상 표시)
├── OverviewMapBanner (지도 토글 + 인라인 지도)
├── FullscreenMapHost (오버레이, 버튼 눌러야 열림)
└── 하단 탭: 차량 / 라이더 / BSS / 정비
```

### 목표 구조
```
/ (page.tsx)
├── FullscreenMapHost (항상 표시, full viewport)
│   ├── MapShell (차량 마커 + 충전소 마커 + 팁 마커)
│   ├── 필터 / 검색 오버레이
│   └── 하단 접기/펼치기 패널
│       └── 탭: 차량 / 충전소 / 팁
└── (KpiTiles, OverviewMapBanner, 인라인 토글 없음)
```

### FullscreenMapHost 변경사항
- 기존: `position: fixed`, 버튼으로 open/close 토글하는 오버레이
- 변경: 항상 렌더링되는 full viewport 메인 레이아웃 (`position: fixed`, `open` state 제거)
- `fullscreenMapOpen` context state 제거 → 항상 열린 상태

### 하단 패널
- 탭 목록: `차량` | `충전소` | `팁`
  - `차량` → 기존 VehiclesPanel (변경 없음)
  - `충전소` → 기존 StationsPanel (변경 없음, 탭 레이블만 BSS → 충전소로 변경)
  - `팁` → 신규 TipsPanel
- 기본 상태: 접힘 (지도 풀뷰)
- 펼쳤을 때: 하단 30vh 고정 패널, 위로 드래그해서 높이 조절 불필요 (토글만)
- 탭 헤더 클릭 → 패널 펼침 + 해당 탭 활성화
- 접기 버튼 (`▼`) → 패널 닫힘

### 필터 연동
- 기존: 지도 마커 필터 ↔ 하단 테이블 행이 독립적
- 변경: `VehicleFilterContext`를 확장해 팁 탭에도 적용
- 차량 탭: 기존 vehicle 필터 그대로 유지
- 충전소 탭: 기존 station 필터 그대로 유지
- 팁 탭: 팁 마커 클릭 → 하단 팁 테이블 해당 행 하이라이트 (양방향)

### 선택 마커 색상
- 기존: 선택된 차량 마커와 비선택 마커 색상 동일
- 변경: 선택된 마커는 accent 색상 (예: 흰 테두리 + 강조) 으로 구분

---

## 3. 팁(Tip) 기능 — 백엔드

### DB 스키마 (V32 migration)

```sql
create table tips (
    id         uuid primary key default gen_random_uuid(),
    idx        bigserial unique not null,
    address    text not null,
    content    text not null,
    latitude   double precision not null,
    longitude  double precision not null,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);
```

### 엔티티: `Tip`

패키지: `com.thundercrew.opsapi.tip`

필드: `id(UUID)`, `idx(Long)`, `address(String)`, `content(String)`, `latitude(Double)`, `longitude(Double)`, `deletedAt`, `createdAt`, `updatedAt`

소프트 딜리트 패턴 적용 (`deletedAt`).

### DTOs

- `TipReadResponse(id, idx, address, content, latitude, longitude, createdAt, updatedAt)` — static `from(Tip)` factory
- `TipCreateRequest(address, content, latitude, longitude)` — validation: address/content not blank, lat/lng valid range
- `TipUpdateRequest(address, content, latitude, longitude)`

### Repository: `TipRepository extends Repository<Tip, UUID>`

```java
Page<Tip> findByDeletedAtIsNull(Pageable pageable);
Optional<Tip> findByIdAndDeletedAtIsNull(UUID id);
Tip save(Tip tip);
List<Tip> findAllByDeletedAtIsNull(); // dashboard용
```

### Services

**TipReadService:**
- `listTips(Pageable)` → `PageResponse<TipReadResponse>`
- `getTip(UUID)` → `TipReadResponse`

**TipCommandService:**
- `createTip(TipCreateRequest)` → `TipReadResponse`
- `updateTip(UUID, TipUpdateRequest)` → `TipReadResponse`
- `deleteTip(UUID)` — soft delete

### Controller: `TipController` @ `/api/v1/tips`

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/tips` | 목록 (페이징) |
| GET | `/api/v1/tips/{id}` | 단건 조회 |
| POST | `/api/v1/tips` | 생성 |
| PUT | `/api/v1/tips/{id}` | 수정 |
| DELETE | `/api/v1/tips/{id}` | 삭제 (소프트) |

### Dashboard API 확장

`DashboardResponse`에 `List<TipPin> tips` 추가:
```java
record TipPin(UUID id, String address, String content, double latitude, double longitude) {}
```

### Contract Tests

`TipControllerTest` — 생성/조회/수정/삭제 각 케이스 커버.

---

## 4. 팁(Tip) 기능 — 프론트엔드

### API 클라이언트 (`lib/services/service-ops-api.ts`)

```typescript
interface ServiceOpsTip {
  id: string;
  idx: number;
  address: string;
  content: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

interface TipPin {
  id: string;
  address: string;
  content: string;
  latitude: number;
  longitude: number;
}
```

메서드: `listTips()`, `createTip(data)`, `updateTip(id, data)`, `deleteTip(id)`

### TipsPanel (`components/management/TipsPanel.tsx`)

- 컬럼: 주소 / 내용 / 등록일 / 액션(편집·삭제)
- 헤더 오른쪽: `[+ 팁 추가]` 버튼
- 행 클릭 → 지도에서 해당 팁 마커 포커스

### CreateTipDialog / EditTipDialog

필드:
1. **주소** — text input (도로명주소 직접 입력)
2. **내용** — textarea
3. **위치** — 미니맵 (NCP Map 인스턴스, 클릭 시 핀 이동 + lat/lng 자동 채움)

미니맵 구현: `useEffect`로 NCP Map 초기화, `addListener('click', e => setLatLng(e.coord))`. 초기 중심좌표는 마지막 알려진 차량 위치 or 서울 기본값.

### MapShell 팁 마커

- 팁 핀 아이콘: 기존 bike/station과 구분되는 색상 (보라색 `#7C3AED`)
- `MapShell` props에 `tipPins: TipPin[]` 추가
- 마커 클릭 → `selectedTipId` 설정 → 하단 팁 테이블 행 하이라이트

### 서버 액션 (`app/actions.ts` 또는 tip 전용)

```typescript
export async function listTipsAction(): Promise<ServiceOpsTip[]>
export async function createTipAction(data): Promise<ServiceOpsTip>
export async function updateTipAction(id, data): Promise<ServiceOpsTip>
export async function deleteTipAction(id): Promise<void>
```

---

## 5. 구현 순서 (의존성 기준)

1. **페이지 정리** — 삭제 작업 (독립적)
2. **레이아웃 리팩터** — FullscreenMapHost 항상-on, 하단 패널 탭 정리
3. **백엔드 팁 API** — V32 migration → 엔티티 → service → controller → tests
4. **프론트엔드 팁 연동** — API client → TipsPanel → CreateTipDialog → MapShell 마커
5. **필터/선택 연동** — 팁 마커 ↔ 테이블 양방향 연결
6. **최종 검증 + PR**

---

## 범위 외 (이번 구현에 포함 안 함)

- 라이더 앱에서 팁 제보 기능 (앱 사이드)
- 팁 유형(type) 카테고리 분류
- 팁 해결/확인 상태 워크플로
- NCP 지오코딩 API 연동 (주소 자동완성)
