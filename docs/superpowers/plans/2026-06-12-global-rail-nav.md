# 좌측 영속 글로벌 레일 내비 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 좌측 영속 레일(지도/자원 관리/업무 관리)을 모든 화면에 두고, 지도 "관리" 링크·management 그룹탭을 레일로 흡수.

**Architecture:** `AppShell`이 인증 시 좌측 고정 레일 렌더(`SidebarPrimaryNav` 부활). 지도 오버레이·본문을 `--rail-width`만큼 좌측 오프셋. 프론트 전용, 마이그레이션 없음.

**Tech Stack:** Next.js App Router, TypeScript, CSS.

**작업 경로:** `development/front-admin-web`. Bash cwd 매 호출 리셋 → 절대경로 cd. 브랜치 `cc-global-rail-nav` 체크아웃(이미 생성됨). 검증 `npm run typecheck && lint && build`.

---

### Task 1: TSX — 레일 + active 보완 + 그룹탭/관리링크 제거

**Files:**
- Modify: `components/layout/AppShell.tsx`
- Modify: `components/layout/SidebarPrimaryNav.tsx`
- Modify: `app/management/resources/page.tsx`
- Modify: `app/management/operations/page.tsx`
- Delete: `components/management/ManagementGroupTabs.tsx`
- Modify: `components/overview/FullscreenMapHost.tsx`

- [ ] **Step 1: SidebarPrimaryNav active 판정 보완**

`SidebarPrimaryNav.tsx`에서:
```tsx
const isActive =
  pathname === item.href || pathname.startsWith(item.href + "/");
```
→
```tsx
const isActive =
  item.href === "/"
    ? pathname === "/"
    : pathname === item.href || pathname.startsWith(item.href + "/");
```
(루트 `/`는 정확 일치만 — 안 그러면 모든 경로에서 지도 항목이 active.)

- [ ] **Step 2: AppShell에 좌측 레일 렌더**

`AppShell.tsx`: `SidebarPrimaryNav` import + NAV 정의 + 인증 시 레일 렌더 + `.app-frame`에 `has-rail` 클래스. 전체 교체:
```tsx
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { PasswordChangeButton } from "@/components/layout/PasswordChangeButton";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SidebarPrimaryNav, type SidebarNavItem } from "@/components/layout/SidebarPrimaryNav";
import { serviceOpsSessionReady } from "@/lib/services/service-ops-session";

const NAV: SidebarNavItem[] = [
  {
    href: "/",
    label: "지도",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
        <path d="M9 4v13M15 6.5v13" />
      </svg>
    )
  },
  {
    href: "/management/resources",
    label: "자원 관리",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 7v10l9 4 9-4V7" />
        <path d="M12 11v10" />
      </svg>
    )
  },
  {
    href: "/management/operations",
    label: "업무 관리",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4" />
      </svg>
    )
  }
];

export async function AppShell({ children }: { children: ReactNode }) {
  const serviceOpsSessionActive = await serviceOpsSessionReady();

  return (
    <div className={`app-frame${serviceOpsSessionActive ? " has-rail" : ""}`}>
      {serviceOpsSessionActive ? (
        <aside className="app-rail" aria-label="기본 메뉴">
          <SidebarPrimaryNav items={NAV} />
        </aside>
      ) : null}
      <div className="top-actions" aria-label="유틸리티">
        <ThemeToggle />
        {serviceOpsSessionActive ? (
          <>
            <PasswordChangeButton />
            <LogoutButton />
          </>
        ) : (
          <a className="sidebar-link" href="/login" title="관리자 로그인" aria-label="관리자 로그인">
            <span className="sidebar-icon" aria-hidden="true">↗</span>
            <span className="sidebar-label">관리자 로그인</span>
          </a>
        )}
      </div>
      <main className="app-main">{children}</main>
    </div>
  );
}
```
(`SidebarNavItem` 타입은 SidebarPrimaryNav에서 export됨 — 확인. icon은 ReactNode라 인라인 SVG OK. AppShell은 server component지만 정적 JSX 전달은 문제없음.)

- [ ] **Step 3: resources 페이지 그룹탭 제거**

`app/management/resources/page.tsx`: `import { ManagementGroupTabs } ...` 줄 삭제, `<ManagementGroupTabs />` 줄 삭제. 나머지(SectionNav + 3 패널) 유지.

- [ ] **Step 4: operations 페이지 그룹탭 제거**

`app/management/operations/page.tsx`: 동일하게 `ManagementGroupTabs` import·사용 삭제. 데이터 로딩·패널 유지.

- [ ] **Step 5: ManagementGroupTabs 컴포넌트 삭제**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git rm development/front-admin-web/components/management/ManagementGroupTabs.tsx
```

- [ ] **Step 6: 지도 헤더 "관리" 링크 제거**

`components/overview/FullscreenMapHost.tsx`에서 아래 블록 삭제(약 327-331):
```tsx
        {/* 데이터 관리(/management) 진입. top-actions 바는 full-viewport 지도
            오버레이에 가려지므로, 항상 보이는 지도 헤더(z-index 110) 안에 둔다. */}
        <a className="fullscreen-map-filter-reopen" href="/management" title="데이터 관리">
          관리
        </a>
```
(`NotificationBell` 등 나머지 헤더 자식 유지.) 다른 사용처 확인: `grep -rn "fullscreen-map-filter-reopen" components` — FullscreenMapHost 외 사용 없으면 CSS도 Task 2에서 제거.

- [ ] **Step 7: typecheck (중간 — CSS 전이라 레일 미스타일이지만 타입/컴파일은 통과해야)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과(레일은 아직 CSS 없어 모양만 거칠 뿐 컴파일/타입 OK). `ManagementGroupTabs` 잔존 import 0(grep `ManagementGroupTabs` → 결과 없어야).

- [ ] **Step 8: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/layout/AppShell.tsx development/front-admin-web/components/layout/SidebarPrimaryNav.tsx development/front-admin-web/app/management/resources/page.tsx development/front-admin-web/app/management/operations/page.tsx development/front-admin-web/components/overview/FullscreenMapHost.tsx && git commit -m "feat(nav): left rail (지도/자원/업무) + remove group tabs & map 관리 link"
```
(ManagementGroupTabs 삭제는 `git rm`으로 이미 스테이지됨 — 같은 커밋에 포함.) Co-Authored-By 라인 포함.

---

### Task 2: CSS — 레일 + 오프셋 + 그룹탭 정리

**Files:**
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: `--rail-width` 변수 + 레일 스타일**

`:root`(라인 1 블록)에 `--rail-width: 68px;` 추가. `.top-actions` 정의 근처(또는 `.sidebar-link` 위)에 추가:
```css
.app-rail {
  position: fixed;
  left: 0; top: 0; bottom: 0;
  width: var(--rail-width);
  z-index: 130;                /* 지도 오버레이(100)·헤더(110)·top-actions(80) 위 */
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  background: var(--rm-bg-panel);
  box-shadow: 0 0 0 1px var(--rm-overlay-line-strong);
  backdrop-filter: blur(20px);
}
.app-rail .sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```
(`.sidebar-link`/`.sidebar-icon`/`.sidebar-label` 기존 정의 재사용 — 44x44 아이콘 + 라벨. 라벨이 68px 폭에 안 맞으면 `.app-rail .sidebar-link{flex-direction:column;height:auto;gap:2px;}` + `.app-rail .sidebar-label{font-size:10px;}` 추가해 아이콘 위/라벨 아래 세로 배치. 기존 `.sidebar-link` 구조 READ 후 맞출 것.)

- [ ] **Step 2: 본문/지도 오프셋**

```css
.app-frame.has-rail .app-main { margin-left: var(--rail-width); }
.app-frame.has-rail .fullscreen-map-overlay { left: var(--rail-width); }
```
(미인증=`has-rail` 없음 → 오프셋 0. `.fullscreen-map-overlay`는 `inset:0`라 `left` 오버라이드로 좌측만 밀림.)

- [ ] **Step 3: 그룹탭 CSS 제거 + sticky 오프셋 복원**

- `.management-group-tabs` / `.management-group-tab` / `:hover` / `.is-active` / `:focus-visible` 블록(현재 라인 ~221-256) **전부 삭제**.
- `.management-section-nav`의 `top: 68px;` → `top: 16px;` (주석도 정리).
- `.management-anchor`의 `scroll-margin-top: 140px;` → `scroll-margin-top: 96px;`.

- [ ] **Step 4: 미사용 CSS 정리**

`grep -rn "fullscreen-map-filter-reopen" development/front-admin-web/components` 결과가 없으면(Task1에서 제거됨) globals.css의 `.fullscreen-map-filter-reopen` 규칙 삭제. 있으면 유지.

- [ ] **Step 5: 검증 + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run lint && npm run build 2>&1 | tail -4
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/app/globals.css && git commit -m "feat(nav): rail styling + content/map offsets + remove group-tab css"
```
Co-Authored-By 라인 포함. Expected: lint+build 통과.

---

### Task 3: 최종 검증 + PR

- [ ] **Step 1: 풀 검증**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain && (git diff dev --name-only | grep -i "db/migration" && echo "MIGRATION!" || echo "no migration") && echo "=== 그룹탭 잔존? ===" && (grep -rn "ManagementGroupTabs\|management-group-tab" development/front-admin-web && echo "STILL PRESENT" || echo "removed")
```
Expected: 전부 통과, 마이그레이션 0, ManagementGroupTabs/management-group-tab 잔존 0.

- [ ] **Step 2: PR (→ dev)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git push -u origin cc-global-rail-nav && gh pr create --base dev --title "좌측 영속 글로벌 레일 내비 (지도/자원 관리/업무 관리)" --body "$(cat <<'EOF'
## Summary
- AppShell에 좌측 고정 레일(인증 시): 지도(/) · 자원 관리 · 업무 관리. SidebarPrimaryNav 부활
- 지도 오버레이·본문을 --rail-width(68px)만큼 좌측 오프셋(지도 거의 풀스크린 유지)
- 지도 헤더 "관리" 링크 + ManagementGroupTabs 제거(레일이 흡수) + 그룹탭 sticky 오프셋 복원
- SidebarPrimaryNav active 보완: 루트 `/`는 정확 일치만(prefix 오판 방지)

## 배포 영향
- 프론트 전용, **마이그레이션 없음**. 재기동만으로 적용.

## Test Plan
- [x] typecheck + lint + build, 마이그레이션 0, 그룹탭 잔존 0
- [ ] 프로덕션 QA: 모든 화면 좌측 레일 + 현재 위치 active, 레일로 지도↔management 양방향, 지도 안 가림, 그룹탭 사라지고 섹션 점프 내비 정상

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec 커버리지:** 레일(Task1 Step2)·active 보완(Step1)·그룹탭 제거(Step3-5)·지도 관리링크 제거(Step6), CSS 레일+오프셋+그룹탭정리+오프셋복원(Task2), 검증·PR(Task3). ✓ 마이그레이션 없음. ✓

**2. 플레이스홀더 스캔:** AppShell/active/NAV·SVG·제거·CSS 전부 구체 코드. 레일 라벨 세로배치 미세조정은 "기존 .sidebar-link 구조 READ 후 맞춤"(코드베이스 의존) — 대상·방법 명시. fullscreen-map-filter-reopen CSS 제거는 grep 조건부.

**3. 타입/이름 일관성:** `SidebarNavItem`(SidebarPrimaryNav export) ↔ AppShell NAV 타입 일치. `.app-frame.has-rail` ↔ AppShell 클래스 토글 일치. `--rail-width` ↔ 레일 width·app-main margin·overlay left 동일 변수. active 보완은 `/` 루트만 특수처리.

**구현자 주의:** AppShell은 server component(`async`) — SVG JSX를 props로 넘기는 건 정상(직렬화 아님, 같은 렌더 트리). 레일 라벨이 68px에 넘치면 세로배치 CSS 추가(아이콘 위/라벨 아래). 그룹탭 제거 후 `.management-section-nav` top·`.management-anchor` scroll-margin을 반드시 16px/96px로 복원(안 그러면 첫 섹션 위 빈 공간).
