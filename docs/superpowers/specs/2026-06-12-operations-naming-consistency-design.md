# 업무 관리 섹션 네이밍 통일 (콜/순차/왕복 배차) Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 업무 관리 3개 섹션의 라벨을 기능·도메인·브랜드 혼재(배차/유모차/배민 콜)에서 **운영 방식 축(콜 배차 / 순차 배차 / 왕복 배차)**으로 통일하고 그 순서로 정렬한다.

**Architecture:** 프론트 표시 문구만 변경 — 섹션 점프 내비 라벨, 패널 제목, 업로드 미리보기 제목, 패널 내 브랜드/도메인 문구. 앵커 id·serviceType enum·서버액션·라우트 무변경. 마이그레이션 없음.

**Tech Stack:** Next.js, TypeScript.

**매핑:** BaeminCallPanel→**콜 배차**(CALL), DispatchPanel→**순차 배차**(SINGLE+SEQUENTIAL, 순번 0=단일 포괄), StrollerRoundPanel→**왕복 배차**(ROUND).

**비범위:** 백엔드/enum/라우트/기능, 지도 필터 칩(이미 정렬됨), 메커니즘 어휘(라운드/콜/수거·배송/순번).

---

## 1. operations 페이지 (`app/management/operations/page.tsx`)
- `SECTIONS` 라벨 + `<section>` 렌더 순서를 **콜 배차 → 순차 배차 → 왕복 배차**로:
  - `{ id: "mgmt-baemin", label: "콜 배차" }` → BaeminCallPanel
  - `{ id: "mgmt-dispatch", label: "순차 배차" }` → DispatchPanel
  - `{ id: "mgmt-stroller", label: "왕복 배차" }` → StrollerRoundPanel
- 앵커 id(`mgmt-baemin`/`mgmt-dispatch`/`mgmt-stroller`)는 **유지**(내부 식별자). 라벨·순서만 변경. 데이터 로딩·패널 props 그대로.

## 2. BaeminCallPanel
- `mgmt-panel-title` "배민 콜" → **"콜 배차"**.
- 본문 "콜 등록"/"콜이 등록되었습니다"/"수락 대기 중인 콜"/"배차 방식" 등 **콜·배차 동작 어휘는 유지**(브랜드 단어 "배민"만 제거 — 현재 배민은 제목에만 존재).

## 3. DispatchPanel
- `mgmt-panel-title` "배차" → **"순차 배차"**.
- 업로드 미리보기 `bulk-preview-title` "배차 업로드 미리보기" → **"순차 배차 업로드 미리보기"**.
- notice "배차 N건 적용 완료"는 일반 동작 문구라 유지.

## 4. StrollerRoundPanel
- `mgmt-panel-title` "유모차 라운드" → **"왕복 배차"**.
- 업로드 미리보기 "유모차 라운드 업로드 미리보기" → **"왕복 배차 업로드 미리보기"**.
- notice "유모차 라운드가 생성되었습니다." → **"왕복 배차 라운드가 생성되었습니다."** (브랜드/도메인 '유모차' 제거, 메커니즘 '라운드' 유지).
- 파일 상단 주석의 "유모차 라운드 섹션"은 "왕복 배차(라운드) 섹션"으로 정리(선택, 혼선 방지).

## 5. 데이터 흐름 / 영향
- 순수 표시 문구. API·serviceType·앵커 id·동작 무변경.
- 영향: `operations/page.tsx`, `BaeminCallPanel.tsx`, `DispatchPanel.tsx`, `StrollerRoundPanel.tsx`.

## 6. 검증
- 프론트 `typecheck + lint + build`.
- 프로덕션 QA: 업무 관리 점프 내비 = 콜 배차/순차 배차/왕복 배차 순서·라벨, 각 패널 제목·미리보기 제목 일치, 라운드 생성 알림 문구 정리. 기능(업로드/콜 등록/라운드)은 그대로.

## 7. 비범위 재확인
백엔드/enum/라우트/기능, 지도 필터, 동작 어휘(라운드/콜/수거·배송)는 변경하지 않는다.
