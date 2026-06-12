# /management 레이아웃 + 필터 칩 UX 수정 (A3/A4/B1) Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 운영자 관점 UX 점검에서 드러난 3가지 결함을 프론트엔드 전용으로 수정한다 — (A3) /management 첫 섹션 액션 버튼이 플로팅 유틸바에 가림, (A4) 관리 테이블의 중첩(내부) 스크롤 + 섹션 내비 부재, (B1) 지도 서비스 필터 칩의 활성/선택 상태 대비 약함.

**Architecture:** 백엔드·데이터 변경 없음. `globals.css` + `app/management/page.tsx` 래퍼 + 신규 작은 sticky 섹션 내비 컴포넌트만 손댄다. 기존 패널·테이블 마크업은 유지하되 스크롤/레이아웃 CSS만 조정한다.

**Tech Stack:** Next.js App Router, CSS (globals.css), TypeScript.

**비범위:** 관리 테이블 검색·상태 필터·정렬·페이지네이션(A1/A2), 차량 '운영 방식' 분류 태그 + 방식별 지도 필터, 마커 declutter, 범례 — 모두 별도 사이클.

---

## 1. A3 — 플로팅 유틸바가 첫 섹션 액션을 가림

**현상:** `.top-actions`(`position:fixed; top:16; right:16; z-index:80`, 높이 ~56px)가 `/management` 첫 섹션(차량)의 헤더 우측 "내려받기/업로드" 버튼 위에 겹친다. `app/management/page.tsx`는 `<div className="management-page">`를 컨테이너(`.page-container`: 1200px 중앙+좌우 여백) 없이 full-bleed로 렌더해, 콘텐츠가 화면 최상단·최우측까지 차서 고정 바와 충돌한다.

**수정:**
- `management-page`를 `.page-container`(또는 동등한 max-width/중앙정렬/좌우 여백)로 감싼다 → 콘텐츠가 1200px 중앙 정렬 + 좌우 여백 확보.
- `/management` 콘텐츠 상단에 `padding-top`을 줘(약 **72px**: 바 top16 + 높이56) 첫 섹션 헤더가 고정 바 **아래에서** 시작하도록 한다. (management 전용 — 다른 페이지엔 영향 없게 `.management-page` 또는 management 래퍼에만 적용.)
- 결과: 차량 섹션의 내려받기/업로드가 더 이상 플로팅 바에 가리지 않음. 라이더 이하 섹션은 기존대로 정상.

---

## 2. A4 — 중첩 스크롤 해소 + 섹션 내비

**현상:** 관리 테이블이 고정 높이 + 내부 `overflow` 스크롤이라, 표 위에서 스크롤하면 페이지가 아니라 표만 움직이고 과도 스크롤 시 검은 빈 영역이 보인다(중첩 스크롤). 원인 CSS:
- `.table-card { overflow: hidden; height: 240px; overflow-y: auto; }` (globals.css 라인 ~400) — 라이더/매칭 테이블 240px 고정.
- `.vehicles-table-scroll { max-height: 560px; overflow: auto; }` (라인 ~418) — 차량 테이블 560px 캡.

또한 6개 섹션(차량/라이더/매칭/배차/유모차/배민)이 한 페이지에 길게 쌓이는데 섹션 이동 내비가 없다.

**수정:**
1. **내부 스크롤 제거** — 관리 테이블이 내용만큼 자라고 **페이지 전체가 하나로 스크롤**되게 한다:
   - `.table-card`: `height: 240px; overflow-y: auto;` 제거(높이 고정·세로 내부 스크롤 해제). 가로 스크롤(`overflow-x: auto`, 라인 ~1156)은 좁은 화면용으로 유지.
   - `.vehicles-table-scroll`: `max-height: 560px; overflow: auto;` 제거(또는 세로 스크롤 해제).
   - **주의:** `.table-card`가 management 외 다른 테이블에서도 쓰이면 그쪽 회귀가 없는지 확인하고, 공유 시 management 전용 modifier(예: 패널에 클래스 추가)로 범위를 한정한다. 구현 단계에서 사용처를 grep으로 확인.
2. **sticky 섹션 내비 추가** — `/management` 상단(플로팅 바 아래)에 sticky 앵커 내비 바: `차량 · 라이더 · 매칭 · 배차 · 유모차 · 배민`. 각 링크는 해당 섹션으로 스크롤.
   - 신규 컴포넌트 `components/management/ManagementSectionNav.tsx`(`"use client"` 불필요하면 서버 컴포넌트; 앵커 `<a href="#vehicles">` 등 순수 링크).
   - 각 패널 래퍼에 `id`(`vehicles`/`riders`/`matching`/`dispatch`/`stroller`/`baemin`) 부여 — `page.tsx`에서 각 패널을 `<section id=...>`로 감싸거나 패널에 id prop 전달.
   - 앵커 점프 시 섹션이 sticky 내비/고정 바 아래로 가려지지 않게 각 섹션에 `scroll-margin-top`(내비+바 높이만큼) 지정.
   - sticky CSS: `.management-section-nav { position: sticky; top: <바 아래>; z-index: 1; ... }`.

---

## 3. B1 — 필터 칩 활성/선택 대비 강화

**현상:** `.service-type-tab`은 비활성에도 항상 `border: 1px solid subtle`를 갖고, 활성(`.is-active`)은 `background: baemin-mint; color:#fff`. 클릭이 빗나가 브라우저 기본 포커스 링만 생기면 "선택됨"으로 오인되고, 활성 채움이 충분히 또렷하지 않다. (overview 헤더 + 차량 패널 공용 컴포넌트 `ServiceTypeFilterTabs`.)

**수정 (globals.css `.service-type-tab*`):**
- 비활성: 상시 테두리 제거(또는 매우 옅게) + 투명 배경 + muted 텍스트. hover는 기존대로 텍스트 강조.
- 활성(`.is-active`): mint 채움 + 흰 텍스트 유지 + 약간의 강조(예: 미세 box-shadow 또는 더 진한 mint)로 선택을 또렷하게.
- `:focus-visible`: 선택 채움과 **명확히 구분되는** 아웃라인(예: 2px accent ring + offset). 키보드 포커스 ≠ 선택. 마우스 클릭 후 포커스 링이 선택처럼 보이지 않도록 `:focus-visible`만 사용.
- 컴포넌트 마크업(`ServiceTypeFilterTabs.tsx`)은 `aria-selected` + `is-active` 그대로 유지 — CSS만 조정.

---

## 4. 데이터 흐름 / 영향
- 순수 프레젠테이션 변경. API·상태·데이터 흐름 변화 없음.
- 영향 표면: `app/globals.css`, `app/management/page.tsx`, 신규 `ManagementSectionNav.tsx`. (필요 시 각 management 패널에 `id`/modifier 클래스 소폭 추가.)

## 5. 검증
- 프론트 `npm run typecheck && npm run lint && npm run build`.
- 프로덕션/로컬 육안: (A3) /management 첫 섹션 내려받기/업로드가 플로팅 바에 안 가림. (A4) 표 위 스크롤이 페이지를 움직이고 검은 빈 영역 없음 + 섹션 내비로 점프. (B1) 필터 칩 활성이 또렷하고 포커스와 구분됨.

## 6. 비범위 재확인
관리 테이블 검색/필터/정렬/페이지네이션, 차량 운영방식 태그 + 방식별 지도 필터, 마커 declutter/범례, 차량상세 "배송" 라벨·IMEI 마스킹 등은 이 스펙에 포함하지 않는다(후속).
