# 단일 배차 / 순차 배차 분리 (순번 컬럼) Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 업무 관리의 배차 업로드를 **단일 배차**(순번 없음 = 현재 동작)와 **순차 배차**(순번 컬럼으로 순서 지정)로 분리해, 업무 관리 = 콜/단일/순차/왕복 4패널로 지도 필터와 정렬한다.

**핵심 정의(사용자 확정):** 둘 다 1:N(차량→목적지 큐). 차이는 **순번 컬럼/순서 지정 유무** 하나뿐.
- **단일 배차** = 현재 `DispatchPanel` 그대로 (엑셀 `[차량번호, 고객명, 연락처, 배송지주소]`, 순번 입력 없음, append).
- **순차 배차** = 신규 (엑셀에 `순번` 추가 → 차량별 순번 정렬해 큐 append).

**Architecture:** 기존 배차 벌크(single) 경로는 그대로 두고, `-sequential` 변형(preview/apply 엔드포인트 + 서비스 메서드 + 패널)을 추가. `DispatchOrder.sequence` 컬럼 재사용 → **마이그레이션 없음**.

**Tech Stack:** Spring Boot (Java 21), POI(ExcelParser), Next.js, TypeScript.

**비범위:** 콜/왕복 패널 변경, N:N, serviceType별 차량 제약(차량번호로 아무 차량 허용), 재업로드 교체 시맨틱(현행 append 유지), 다운로드 템플릿 파일.

---

## 1. 라벨 정정 (단일)
- 직전 네이밍 작업에서 `DispatchPanel`을 "순차 배차"로 바꿨으나, 정의상 **현재 패널(순번 없음)=단일 배차**가 맞음. `DispatchPanel`의 `mgmt-panel-title`·미리보기 제목·operations 섹션 라벨을 **"단일 배차"**로 정정. 동작·엔드포인트 무변경.

## 2. 백엔드 — 순차 변형

`com.thundercrew.opsapi.dispatch`:

- **DTO**:
  - `DispatchBulkApplyRow`에 `Long sequence`(nullable) 추가 — 단일 경로는 null, 순차 경로는 값 보유. (또는 순차 전용 row DTO. 재사용 권장.)
  - `DispatchBulkPreviewRow`에 순번 표시 필드(`Integer sequence` 또는 문자열) 추가 — 순차 미리보기에서 노출.
- **`DispatchOrderBulkService`**:
  - `previewSequential(InputStream)` — 엑셀 5컬럼 `[차량번호, 고객명, 연락처, 배송지주소, 순번]` 파싱·검증. 순번 비정수/누락은 ERROR 행. (단일 `preview`는 4컬럼 그대로.)
  - `applySequential(DispatchBulkApplyRequest)` — 차량별로 `sequence` 오름차순 정렬 후 `commandService.appendForBike(...)` 순서대로 호출(순번=정렬 키, 저장 sequence는 append 연속값 — 기존 큐와 충돌 없음). 단일 `apply`는 현행대로 행 순서 append.
- **`DispatchOrderCommandController`** (`/api/v1/dispatch-orders`, arch allow-list 기존 커버):
  - `POST /bulk-preview-sequential` → `previewSequential`.
  - `POST /bulk-apply-sequential` → `applySequential`.
  - 기존 `/bulk-preview`·`/bulk-apply`(단일)는 무변경.
- **테스트**: 순차 preview가 순번 파싱(정상/누락→ERROR), apply가 차량별 큐를 순번 순서로 생성(예: 순번 2,1,3 → 큐 1,2,3 순). 단일 경로 회귀 없음.

## 3. 프론트 — 순차 패널 + 단일 정정

`development/front-admin-web`:

- **service-ops-api 클라이언트**: `previewSequentialDispatchOrders(file)` / `applySequentialDispatchOrders(rows)` 추가(`-sequential` 엔드포인트 호출). 순차 row 타입에 `sequence` 포함.
- **서버액션** (`app/dispatch/actions.ts`): `previewSequentialDispatchAction` / `applySequentialDispatchAction` 추가(단일 액션 패턴 복제, 지오코딩 동일). `revalidatePath("/management/operations")`, `("/")`.
- **신규 `SequentialDispatchPanel`** (`components/management/`): `DispatchPanel` 복제 기반 — 업로드 → 순차 preview(테이블에 순번 컬럼 노출) → apply. 제목 "순차 배차", 미리보기 "순차 배차 업로드 미리보기". 안내 문구에 "엑셀에 순번 컬럼 포함(차량별 방문 순서)".
- **`DispatchPanel`**: 제목·미리보기 "순차 배차" → **"단일 배차"** 정정(§1).
- **operations 페이지**: SECTIONS·렌더 = **콜 배차 / 단일 배차 / 순차 배차 / 왕복 배차** 4개. 신규 앵커 id `mgmt-sequential`(순차). 기존 `mgmt-dispatch`(단일)·`mgmt-baemin`(콜)·`mgmt-stroller`(왕복) 유지.

## 4. 데이터 흐름
```
단일: 엑셀[차량,고객,연락처,배송지] → bulk-preview → 지오코딩 → bulk-apply(append) → 차량 큐(순서 무의미)
순차: 엑셀[…,순번] → bulk-preview-sequential → 지오코딩 → bulk-apply-sequential(차량별 순번 정렬 append) → 차량 큐(순번 순)
```
- DispatchOrder 1건 = 차량+목적지+sequence. 모델·테이블 무변경.

## 5. 검증
- 백엔드 `compileJava + compileTestJava`(순차 계약 테스트 포함). 프론트 `typecheck + lint + build`.
- 프로덕션 QA: 업무 관리 4패널(콜/단일/순차/왕복), 순차 엑셀(순번 포함) 업로드→미리보기 순번 노출→적용 시 차량 큐가 순번 순서, 단일은 현행대로. **마이그레이션 없음.**

## 6. 비범위 재확인
콜/왕복 변경, N:N, serviceType 제약, 재업로드 교체, 템플릿 파일은 포함하지 않는다.
