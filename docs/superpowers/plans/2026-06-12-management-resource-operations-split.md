# /management 자원/업무 2페이지 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/management`를 자원 관리(차량·라이더·매칭)와 업무 관리(배차·유모차·배민콜) 두 라우트로 분리 + 상단 그룹 탭 전환.

**Architecture:** `/management`→`/management/resources` 리다이렉트. 두 라우트 각각 `ManagementGroupTabs` + `ManagementSectionNav`(sections prop) + 패널 3개. 프론트 전용, 마이그레이션 없음.

**Tech Stack:** Next.js App Router, TypeScript, CSS.

**작업 경로:** `development/front-admin-web`. Bash cwd 매 호출 리셋 → 절대경로 cd. 브랜치 `cc-management-split` 체크아웃(이미 생성됨, 새 브랜치 만들지 말 것). 검증 `npm run typecheck && lint && build`.

**현재 `app/management/page.tsx` (이전 대상, 그대로 옮김):**
```tsx
import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";
import { DispatchPanel } from "@/components/management/DispatchPanel";
import { StrollerRoundPanel } from "@/components/management/StrollerRoundPanel";
import { BaeminCallPanel } from "@/components/management/BaeminCallPanel";
import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";
import { getActiveRoundAction, listOfferedCallsAction } from "@/app/dispatch/actions";
import { listVehiclesAction } from "@/app/management/vehicles/actions";
export const dynamic = "force-dynamic";
// ... loads activeRound/offeredCalls/vehiclesPage, deliveryVehicles = CALL∪SINGLE filter, renders 6 <section> panels under <div className="management-page"> + <ManagementSectionNav />
```

---

### Task 1: `ManagementSectionNav` sections prop화 + `ManagementGroupTabs` 신규

**Files:**
- Modify: `development/front-admin-web/components/management/ManagementSectionNav.tsx`
- Create: `development/front-admin-web/components/management/ManagementGroupTabs.tsx`

- [ ] **Step 1: ManagementSectionNav를 sections prop으로**

`ManagementSectionNav.tsx` 전체 교체 (하드코딩 6개 SECTIONS 제거, prop으로):
```tsx
export interface ManagementNavSection {
  id: string;
  label: string;
}

/** /management 그룹 페이지 상단 sticky 섹션 점프 내비 (앵커 링크). */
export function ManagementSectionNav({ sections }: { sections: ManagementNavSection[] }) {
  return (
    <nav className="management-section-nav" aria-label="관리 섹션 이동">
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="management-section-nav-link">
          {s.label}
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: ManagementGroupTabs 신규 (client)**

`ManagementGroupTabs.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/management/resources", label: "자원 관리" },
  { href: "/management/operations", label: "업무 관리" }
];

/** 자원 관리 / 업무 관리 두 페이지 전환 상단 탭. */
export function ManagementGroupTabs() {
  const pathname = usePathname();
  return (
    <nav className="management-group-tabs" aria-label="관리 그룹">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`management-group-tab${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: typecheck (이 시점 page.tsx가 옛 SectionNav 호출로 깨질 수 있음 — Task 2/3에서 정리)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck 2>&1 | tail -20
```
Expected: `ManagementSectionNav`를 prop 없이 부르던 `app/management/page.tsx`에서 타입 에러가 날 수 있음 — Task 2에서 그 파일을 교체하므로 정상. 이 두 파일(ManagementSectionNav/ManagementGroupTabs) 내부 에러는 0이어야 함.

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/management/ManagementSectionNav.tsx development/front-admin-web/components/management/ManagementGroupTabs.tsx && git commit -m "feat(mgmt): section nav sections-prop + group tabs component"
```
Co-Authored-By 라인 포함.

---

### Task 2: 두 그룹 페이지 + 리다이렉트

**Files:**
- Create: `development/front-admin-web/app/management/resources/page.tsx`
- Create: `development/front-admin-web/app/management/operations/page.tsx`
- Modify: `development/front-admin-web/app/management/page.tsx`

- [ ] **Step 1: 자원 관리 페이지**

`app/management/resources/page.tsx`:
```tsx
import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";
import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";
import { ManagementGroupTabs } from "@/components/management/ManagementGroupTabs";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "mgmt-vehicles", label: "차량" },
  { id: "mgmt-riders", label: "라이더" },
  { id: "mgmt-matching", label: "매칭" }
];

export default function ManagementResourcesPage() {
  return (
    <div className="management-page">
      <ManagementGroupTabs />
      <ManagementSectionNav sections={SECTIONS} />
      <section id="mgmt-vehicles" className="management-anchor">
        <VehiclesManagementPanel exportUrl="/api/management/vehicles/export" />
      </section>
      <section id="mgmt-riders" className="management-anchor">
        <RidersManagementPanel exportUrl="/api/management/riders/export" />
      </section>
      <section id="mgmt-matching" className="management-anchor">
        <MatchingManagementPanel exportUrl="/api/management/matching/export" />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 업무 관리 페이지**

`app/management/operations/page.tsx`:
```tsx
import { DispatchPanel } from "@/components/management/DispatchPanel";
import { StrollerRoundPanel } from "@/components/management/StrollerRoundPanel";
import { BaeminCallPanel } from "@/components/management/BaeminCallPanel";
import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";
import { ManagementGroupTabs } from "@/components/management/ManagementGroupTabs";
import { getActiveRoundAction, listOfferedCallsAction } from "@/app/dispatch/actions";
import { listVehiclesAction } from "@/app/management/vehicles/actions";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "mgmt-dispatch", label: "배차" },
  { id: "mgmt-stroller", label: "유모차" },
  { id: "mgmt-baemin", label: "배민 콜" }
];

export default async function ManagementOperationsPage() {
  const [activeRound, offeredCalls, vehiclesPage] = await Promise.all([
    getActiveRoundAction(),
    listOfferedCallsAction(),
    listVehiclesAction()
  ]);

  // 배민 콜 후보 차량 = CALL∪SINGLE (systemDispatch 자동 배차 후보와 동일; OTHER·청소형 제외)
  const deliveryVehicles = vehiclesPage
    .filter((v) => v.serviceType === "CALL" || v.serviceType === "SINGLE")
    .map((v) => ({ id: v.id ?? v.slug, plateNumber: v.plateNumber }));

  return (
    <div className="management-page">
      <ManagementGroupTabs />
      <ManagementSectionNav sections={SECTIONS} />
      <section id="mgmt-dispatch" className="management-anchor">
        <DispatchPanel exportUrl="/api/management/dispatch/export" />
      </section>
      <section id="mgmt-stroller" className="management-anchor">
        <StrollerRoundPanel initialRound={activeRound} />
      </section>
      <section id="mgmt-baemin" className="management-anchor">
        <BaeminCallPanel initialOffered={offeredCalls} deliveryVehicles={deliveryVehicles} />
      </section>
    </div>
  );
}
```
(필드/시그니처는 현재 page.tsx에서 그대로 옮긴 것 — `v.id ?? v.slug`, `initialRound`, `initialOffered`/`deliveryVehicles` props 동일.)

- [ ] **Step 3: `/management` 리다이렉트**

`app/management/page.tsx` 전체 교체:
```tsx
import { redirect } from "next/navigation";

export default function ManagementPage() {
  redirect("/management/resources");
}
```
(기존 import/데이터로딩/6패널 전부 제거 — 두 새 페이지로 이전됨.)

- [ ] **Step 4: typecheck + lint + build**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
```
Expected: 전부 통과. (`StrollerRoundPanel`/`BaeminCallPanel`/패널 prop 시그니처가 옮긴 그대로라 타입 OK. 빌드시 3개 라우트 생성: /management(redirect), /management/resources, /management/operations.)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/app/management && git commit -m "feat(mgmt): split into resources/operations routes + redirect"
```
Co-Authored-By 라인 포함.

---

### Task 3: CSS — 그룹 탭 + sticky 오프셋

**Files:**
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: 그룹 탭 스타일 + 섹션 내비 오프셋**

READ `globals.css`의 `.management-section-nav`(현재 sticky `top` 값) + `.management-page` 영역. `.management-section-nav` 정의 근처에 추가:
```css
.management-group-tabs {
  position: sticky;
  top: 88px; /* 플로팅 top-actions 바 아래. 기존 .management-page padding-top 과 맞춤 */
  z-index: 2;
  display: flex;
  gap: 8px;
  padding: 8px 0;
  background: var(--color-bg, transparent);
}
.management-group-tab {
  padding: 8px 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: var(--color-bg-muted);
  color: var(--color-text-secondary);
  font-weight: 600;
  text-decoration: none;
}
.management-group-tab.is-active {
  background: var(--color-baemin-mint, #1d9e75);
  color: #fff;
}
.management-group-tab:focus-visible {
  outline: 2px solid var(--color-accent, #1d9e75);
  outline-offset: 2px;
}
```
- `.management-section-nav`의 `top`(sticky)을 그룹 탭 높이만큼 내림(예: 기존 값 + ~44px)해 두 sticky가 겹치지 않게. 실제 현재 값 확인 후 조정.
- `.management-anchor`의 `scroll-margin-top`도 그룹탭+섹션내비 높이만큼 더해 앵커 점프 시 가려지지 않게(현재 값 확인 후 +44px 정도).
- 변수명(`--color-bg-muted`/`--color-baemin-mint`/`--color-accent`)은 globals.css에 이미 쓰이는 토큰으로 맞출 것(grep해서 기존 필터탭 `.service-type-tab` 색 토큰 재사용 권장).

- [ ] **Step 2: typecheck/lint/build + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run build 2>&1 | tail -4
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/app/globals.css && git commit -m "feat(mgmt): group tabs styling + sticky offsets"
```
Co-Authored-By 라인 포함.

---

### Task 4: 최종 검증 + PR

- [ ] **Step 1: 풀 검증**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain && (git diff dev --name-only | grep -i "db/migration" && echo "MIGRATION!" || echo "no migration (의도대로)")
```
Expected: 통과, 마이그레이션 0, 빌드에 `/management`·`/management/resources`·`/management/operations` 3 라우트.

- [ ] **Step 2: PR (→ dev)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git push -u origin cc-management-split && gh pr create --base dev --title "관리 화면 분리: 자원 관리 / 업무 관리 2페이지" --body "$(cat <<'EOF'
## Summary
- `/management` → `/management/resources` 리다이렉트
- 자원 관리(/management/resources): 차량·라이더·매칭
- 업무 관리(/management/operations): 배차·유모차·배민 콜
- 상단 `ManagementGroupTabs`로 두 그룹 전환, `ManagementSectionNav` sections prop화
- 데이터 로딩(activeRound/offeredCalls/deliveryVehicles)은 operations 페이지로 이동

## 배포 영향
- 프론트 전용, **마이그레이션 없음**. 재기동만으로 적용.

## Test Plan
- [x] typecheck + lint + build, 마이그레이션 0
- [ ] 프로덕션 QA: /management 리다이렉트, 자원↔업무 탭 전환, 각 3패널 + 점프 내비, 배민 콜 차량 드롭다운 정상

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec 커버리지:** 라우트 분리+리다이렉트(Task2), 그룹탭(Task1)·SectionNav prop화(Task1), 데이터 operations 이동(Task2), CSS 그룹탭+오프셋(Task3), 검증·PR(Task4). ✓ 진입점 무변경(스펙 §5). ✓ 마이그레이션 없음. ✓

**2. 플레이스홀더 스캔:** 두 페이지·리다이렉트·두 컴포넌트 완전 코드. Task3 CSS는 "기존 top/scroll-margin 값 확인 후 +44px 조정" — 기존 값 의존이라 grep 후 구체화 지시(placeholder 아님). 변수 토큰은 기존 `.service-type-tab` 재사용 지시.

**3. 타입/이름 일관성:** `ManagementSectionNav({ sections })` ↔ 두 페이지가 `sections={SECTIONS}` 전달, `ManagementNavSection{id,label}`. `ManagementGroupTabs` href `/management/resources`·`/management/operations` ↔ 두 페이지 라우트 경로 일치. 패널 props(`exportUrl`/`initialRound`/`initialOffered`/`deliveryVehicles`)는 현재 page.tsx에서 그대로 이전 → 시그니처 동일.

**구현자 주의:** Task1 후 중간 typecheck는 옛 `app/management/page.tsx`(prop 없는 SectionNav 호출) 때문에 실패할 수 있음 — Task2에서 그 파일을 리다이렉트로 교체하면 해소. 전체 통과는 Task2 Step4에서 보장. `.management-anchor`/`.management-section-nav`의 기존 sticky/scroll 값은 globals.css에서 READ 후 그룹탭 높이만큼만 더할 것(하드코딩 추정 금지).
