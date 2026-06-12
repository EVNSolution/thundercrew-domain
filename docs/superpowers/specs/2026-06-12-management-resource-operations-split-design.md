# /management 자원 관리 / 업무 관리 2페이지 분리 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 한 페이지에 6개 패널이 쌓여 있던 `/management`를 **자원 관리(차량·라이더·매칭)**와 **업무 관리(배차·유모차·배민 콜)** 두 라우트로 분리하고, 상단 탭으로 전환한다.

**Architecture:** `/management`는 `/management/resources`로 리다이렉트. 두 라우트 각각 상단 그룹 탭(`ManagementGroupTabs`) + 그룹별 점프 내비(`ManagementSectionNav`, sections prop화) + 패널 3개. 프론트 전용, 백엔드·마이그레이션 없음.

**Tech Stack:** Next.js App Router, TypeScript, CSS.

**비범위:** 패널 내부 기능 변경, 글로벌 사이드바 부활, 검색/필터/정렬 추가.

---

## 1. 라우트 구조

- **`app/management/page.tsx`** → 본문 제거, `redirect("/management/resources")` 만 수행. (`import { redirect } from "next/navigation"`.)
- **`app/management/resources/page.tsx`** (자원 관리):
  - `ManagementGroupTabs` (active=resources) → `ManagementSectionNav`(차량/라이더/매칭) → `VehiclesManagementPanel` / `RidersManagementPanel` / `MatchingManagementPanel` (각 `<section id=...>` 래퍼 유지).
  - 별도 async 데이터 로딩 없음(패널이 자체 로드). `export const dynamic = "force-dynamic"` 유지.
- **`app/management/operations/page.tsx`** (업무 관리):
  - 현재 `page.tsx`의 데이터 로딩 이전: `getActiveRoundAction`, `listOfferedCallsAction`, `listVehiclesAction`(→ `deliveryVehicles` 계산, CALL∪SINGLE 필터 그대로).
  - `ManagementGroupTabs` (active=operations) → `ManagementSectionNav`(배차/유모차/배민콜) → `DispatchPanel` / `StrollerRoundPanel(initialRound)` / `BaeminCallPanel(initialOffered, deliveryVehicles)`.
  - `export const dynamic = "force-dynamic"`.

## 2. 신규 컴포넌트 — `ManagementGroupTabs` (client)

`components/management/ManagementGroupTabs.tsx` (`"use client"`):
- 두 탭: `자원 관리`(`/management/resources`), `업무 관리`(`/management/operations`). `next/link` + `usePathname`으로 active 판정(`pathname.startsWith(href)`).
- `ServiceTypeFilterTabs`/세그먼트 컨트롤과 유사한 톤. `aria-current="page"` on active.
- 페이지 최상단(스티키 영역 위)에 위치.

## 3. 기존 컴포넌트 조정 — `ManagementSectionNav`

- 하드코딩 `SECTIONS`(6개) → **`sections: { id: string; label: string }[]` prop**으로 변경.
- 자원 페이지: `[{id:"mgmt-vehicles",label:"차량"},{id:"mgmt-riders",label:"라이더"},{id:"mgmt-matching",label:"매칭"}]`.
- 업무 페이지: `[{id:"mgmt-dispatch",label:"배차"},{id:"mgmt-stroller",label:"유모차"},{id:"mgmt-baemin",label:"배민 콜"}]`.
- 앵커 id·`.management-anchor`·`scroll-margin-top`는 기존 그대로(그룹 탭 높이만큼 여백 조정 필요 시 CSS에서).

## 4. CSS

- 기존 `.management-page` / `.management-section-nav` / `.management-anchor` 재사용.
- 신규 `.management-group-tabs` (+ `-link`, `.is-active`): 세그먼트/탭 스타일, sticky 상단(섹션 내비 위). 섹션 내비 `top` 오프셋을 그룹 탭 높이만큼 내려 두 sticky가 겹치지 않게.
- `.management-section-nav` 가 6→3개로 줄어드는 것 외 변경 없음.

## 5. 진입점

- 오버뷰 "관리" 버튼(`FullscreenMapHost` `href="/management"`) 그대로 — 리다이렉트로 자원 관리 도착. 변경 없음.

## 6. 데이터 흐름 / 영향
- 패널·서버액션·API 변경 없음. operations 페이지가 기존 page.tsx의 로딩 책임을 그대로 가져감. resources 페이지는 정적 래퍼.
- `app/management/page.tsx`의 기존 6패널 렌더는 두 새 페이지로 이동하고 자신은 리다이렉트만.

## 7. 검증
- 프론트 `typecheck + lint + build`.
- 프로덕션 QA: `/management` → `/management/resources` 리다이렉트, 상단 탭으로 자원↔업무 전환, 각 페이지 3패널 + 점프 내비 동작, 배민 콜 차량 드롭다운(deliveryVehicles) 정상.

## 8. 비범위 재확인
패널 내부 기능, 글로벌 사이드바, 검색/필터/정렬, 백엔드/마이그레이션은 포함하지 않는다.
