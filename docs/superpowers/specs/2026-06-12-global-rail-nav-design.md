# 좌측 영속 글로벌 레일 내비 (지도 / 자원 관리 / 업무 관리) Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 지도(`/`)와 management 페이지를 잇는 **좌측 슬림 영속 레일**을 도입해 양방향 이동을 자연스럽게 한다. 레일 항목: 지도 / 자원 관리 / 업무 관리. 이 레일이 기존 지도 헤더의 "관리" 링크와 management 그룹탭을 모두 대체한다.

**Architecture:** `AppShell`에 인증 시 좌측 고정 레일(`SidebarPrimaryNav` 부활)을 렌더. 풀스크린 지도 오버레이·앱 본문을 레일 폭만큼 좌측 오프셋. 그룹탭/지도 "관리" 링크 제거. 프론트 전용, 마이그레이션 없음.

**Tech Stack:** Next.js App Router, TypeScript, CSS.

**비범위:** 추가 라우트, 모바일 햄버거/반응형 접힘, 검색·필터 변경, 백엔드.

---

## 1. 좌측 레일 (AppShell + SidebarPrimaryNav)

- `components/layout/AppShell.tsx`: `serviceOpsSessionActive`일 때 `<SidebarPrimaryNav items={NAV} />`를 좌측 고정 레일로 렌더. 미인증 시 기존 로그인 링크 유지(레일 없음).
- NAV 항목(3):
  - `{ href: "/", label: "지도", icon: <지도 SVG> }`
  - `{ href: "/management/resources", label: "자원 관리", icon: <자원 SVG> }`
  - `{ href: "/management/operations", label: "업무 관리", icon: <업무 SVG> }`
- `SidebarPrimaryNav`(기존)는 그대로 사용 — active 판정 `pathname === href || pathname.startsWith(href + "/")`. **주의:** `/`는 모든 경로의 prefix라 `startsWith("/")`가 항상 true → 지도 항목이 management에서도 active로 뜸. **수정:** `SidebarPrimaryNav`의 active 판정을 `href === "/" ? pathname === "/" : (pathname === href || pathname.startsWith(href + "/"))`로 보완(루트는 정확 일치만).
- 아이콘은 인라인 SVG(currentColor, `.sidebar-icon` 안에서 레일 색 따라감). Tabler류 단순 라인 아이콘(지도=map-pin/route, 자원=차량/박스, 업무=clipboard/list) 사용.
- 레일은 `position: fixed; left:0; top:0; bottom:0; width: var(--rail-width); z-index: 130` (지도 오버레이 100·헤더 110·top-actions 80 위). 세로 정렬, 상단에 항목들.

## 2. 레이아웃 오프셋

- 전역 변수 `--rail-width`(예: 68px). 인증 시에만 적용(미인증은 0).
- `.app-main`(또는 본문 래퍼)에 `margin-left: var(--rail-width)` — management/일반 페이지가 레일에 안 가림.
- 풀스크린 지도 오버레이 `.fullscreen-map-overlay`: `inset: 0` → `inset: 0 0 0 var(--rail-width)`로 좌측만 비움(지도가 레일에 안 가림). 헤더(`left:16px`)는 오버레이 기준이라 자동 정렬.
- `.top-actions`(우상단)는 그대로.
- 미인증(로그인 페이지)에서는 레일이 없으므로 오프셋 0 — `--rail-width`를 인증 상태에 따라 토글하거나, 레일 미렌더 시 본문 margin이 0이 되게 클래스로 제어(예: `.app-frame.has-rail .app-main`).

## 3. 중복 제거

- **지도 헤더 "관리" 링크 제거**: `FullscreenMapHost`의 `<a className="fullscreen-map-filter-reopen" href="/management">관리</a>` 삭제. (🔔·필터·검색·카운트 유지.) 사용처 없어진 `.fullscreen-map-filter-reopen` CSS는 다른 데서 안 쓰면 정리.
- **`ManagementGroupTabs` 제거**: `app/management/resources/page.tsx`·`app/management/operations/page.tsx`에서 `<ManagementGroupTabs />` import·사용 삭제. 컴포넌트 파일 `components/management/ManagementGroupTabs.tsx` 삭제.
- **sticky 오프셋 복원**(그룹탭 제거로 다시 한 줄 줄어듦): `.management-section-nav` `top` 68px → 16px, `.management-anchor` `scroll-margin-top` 140px → 96px (그룹탭 추가 전 값으로). `.management-group-tabs*` CSS 제거.
- 섹션 점프 내비(`ManagementSectionNav`, 차량/라이더/매칭·배차/유모차/배민콜)는 그대로 유지.

## 4. CSS

- `--rail-width` 변수 추가(:root). `.sidebar-nav`/`.sidebar-link`/`.sidebar-icon`/`.sidebar-label` 기존 톤 재사용 + 레일 컨테이너(`.app-rail` 또는 `.sidebar-nav`에 fixed 레이아웃) 스타일. active(`.is-active`) 액센트는 기존 `.sidebar-link.is-active` 사용.
- 다크/라이트 토큰 그대로.

## 5. 데이터 흐름 / 영향
- 순수 네비게이션/레이아웃. API·데이터 변화 없음.
- 영향 표면: `AppShell.tsx`, `SidebarPrimaryNav.tsx`(active 보완), `FullscreenMapHost.tsx`(링크 제거), 두 management 페이지(그룹탭 제거), `ManagementGroupTabs.tsx`(삭제), `globals.css`(레일+오프셋+오프셋복원).

## 6. 검증
- 프론트 `typecheck + lint + build`.
- 프로덕션 QA: 지도·자원 관리·업무 관리 모든 화면에 좌측 레일 노출 + 현재 위치 active; 레일로 지도↔management 양방향 이동; 지도가 레일에 안 가리고 거의 풀스크린 유지; management 콘텐츠가 레일에 안 가림; 그룹탭 사라지고 섹션 점프 내비 정상.

## 7. 비범위 재확인
모바일 반응형 접힘, 추가 메뉴 항목, 검색/필터, 백엔드/마이그레이션은 포함하지 않는다.
