# /management 레이아웃 + 필터 칩 UX 수정 (A3/A4/B1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프론트엔드 전용으로 3개 UX 결함 수정 — A3(플로팅 바가 /management 첫 섹션 액션 가림), A4(관리 테이블 중첩 스크롤 + 섹션 내비 부재), B1(지도 서비스 필터 칩 활성/포커스 대비 약함).

**Architecture:** 백엔드·데이터 무변경. `app/globals.css` 조정 + `app/management/page.tsx`에 섹션 래퍼/내비 추가 + 신규 `ManagementSectionNav.tsx`. 공유 `.table-card`는 `.management-panel` 하위로만 override해 다른 화면 회귀 방지.

**Tech Stack:** Next.js App Router, CSS, TypeScript.

**작업 경로:** `development/front-admin-web`. Bash 절대경로 `cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web` (cwd 매 호출 리셋). 브랜치 `cc-ux-mgmt-layout-filter` 체크아웃 — 새 브랜치 만들지 말 것. 검증은 `npm run typecheck && npm run lint && npm run build`.

**알려진 현재 CSS (globals.css):**
- `.management-page { display: flex; flex-direction: column; gap: 40px; }` (~209행)
- `.page-container { width: min(100% - 48px, 1200px); margin: 0 auto; padding-bottom: 96px; }` (166행)
- `.top-actions { position: fixed; top: 16px; right: 16px; z-index: 80; ... }` (171행, 높이 ~56px)
- `.table-card { overflow: hidden; height: 240px; overflow-y: auto; }` (~400행) — **공유**(RidersPanel `/?tab=riders`, MaintenancePanel 등도 사용)
- `.vehicles-table-scroll { max-height: 560px; overflow: auto; }` (~418행)
- `.service-type-tab` / `.is-active` (~1193–1209행)
- 관리 패널 root = `.management-panel`. page.tsx 순서: VehiclesManagementPanel, RidersManagementPanel, MatchingManagementPanel, DispatchPanel, StrollerRoundPanel, BaeminCallPanel.

---

### Task 1: A3 + A4a — 관리 페이지 컨테이너/여백 + 중첩 스크롤 제거 (globals.css)

**Files:**
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: `.management-page`에 컨테이너/상단 여백 부여 (A3)**

`.management-page { display: flex; flex-direction: column; gap: 40px; }` 를 다음으로 교체:
```css
.management-page {
  display: flex;
  flex-direction: column;
  gap: 40px;
  /* 1200px 중앙 정렬 + 좌우 여백. 상단 88px 로 fixed .top-actions(top16+높이~56) 아래에서 시작. */
  max-width: 1200px;
  margin: 0 auto;
  padding: 88px 24px 96px;
}
```

- [ ] **Step 2: 관리 테이블 중첩 스크롤 제거 (A4a, `.management-panel` 하위로 한정)**

globals.css 의 `.management-page` 규칙 바로 아래에 추가(공유 `.table-card`/`.vehicles-table-scroll` 베이스는 건드리지 않고 management 안에서만 해제):
```css
/* /management 테이블은 내부 고정-높이 스크롤을 쓰지 않고 페이지 전체로 스크롤한다. */
.management-panel .table-card { height: auto; overflow-y: visible; }
.management-panel .vehicles-table-scroll { max-height: none; overflow-y: visible; }
```
(가로 스크롤 `.table-card { overflow-x: auto }`(~1156행, 좁은 화면용)은 유지된다 — 위 override는 세로만 해제.)

- [ ] **Step 3: 검증**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과. (CSS 변경이라 typecheck 영향 없음, lint 통과.)

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/app/globals.css && git commit -m "fix(ux): A3 management page container+top padding; A4 remove nested table scroll (scoped)"
```

---

### Task 2: A4b — sticky 섹션 내비 + page.tsx 섹션 래퍼

**Files:**
- Create: `development/front-admin-web/components/management/ManagementSectionNav.tsx`
- Modify: `development/front-admin-web/app/management/page.tsx`
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: ManagementSectionNav 컴포넌트 (순수 앵커, 서버 컴포넌트)**

`components/management/ManagementSectionNav.tsx`:
```tsx
const SECTIONS: { id: string; label: string }[] = [
  { id: "mgmt-vehicles", label: "차량" },
  { id: "mgmt-riders", label: "라이더" },
  { id: "mgmt-matching", label: "매칭" },
  { id: "mgmt-dispatch", label: "배차" },
  { id: "mgmt-stroller", label: "유모차" },
  { id: "mgmt-baemin", label: "배민 콜" }
];

/** /management 상단 sticky 섹션 점프 내비 (앵커 링크). */
export function ManagementSectionNav() {
  return (
    <nav className="management-section-nav" aria-label="관리 섹션 이동">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="management-section-nav-link">
          {s.label}
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: page.tsx — 내비 + 각 패널을 앵커 섹션으로 래핑**

`app/management/page.tsx` 의 return 블록을 다음으로 교체(기존 import + Promise.all + deliveryVehicles 계산은 유지, import 에 `ManagementSectionNav` 추가):
```tsx
  return (
    <div className="management-page">
      <ManagementSectionNav />
      <section id="mgmt-vehicles" className="management-anchor">
        <VehiclesManagementPanel exportUrl="/api/management/vehicles/export" />
      </section>
      <section id="mgmt-riders" className="management-anchor">
        <RidersManagementPanel exportUrl="/api/management/riders/export" />
      </section>
      <section id="mgmt-matching" className="management-anchor">
        <MatchingManagementPanel exportUrl="/api/management/matching/export" />
      </section>
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
```
상단 import 에 추가: `import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";`

- [ ] **Step 3: globals.css — sticky 내비 + 앵커 scroll-margin**

globals.css 의 Task1 management 블록 아래에 추가:
```css
.management-section-nav {
  position: sticky;
  top: 16px;
  z-index: 60; /* fixed .top-actions(z80) 보다 아래 — 우상단 코너에서만 겹치고 링크는 좌측이라 실사용 충돌 없음 */
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--rm-bg-panel);
  box-shadow: var(--shadow-panel);
}
.management-section-nav-link {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-decoration: none;
  transition: background .12s ease, color .12s ease;
}
.management-section-nav-link:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-muted);
}
/* 앵커 점프 시 sticky 내비 + fixed 바 아래로 가려지지 않게 여백 확보. */
.management-anchor { scroll-margin-top: 96px; }
```
(`--rm-bg-panel`, `--shadow-panel`, `--color-text-muted`, `--color-text-primary`, `--color-bg-muted` 는 globals.css 에 이미 정의됨 — 확인 후 사용.)

- [ ] **Step 4: 검증**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과.

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/management/ManagementSectionNav.tsx development/front-admin-web/app/management/page.tsx development/front-admin-web/app/globals.css && git commit -m "feat(ux): A4 sticky section nav + anchored management sections"
```

---

### Task 3: B1 — 서비스 필터 칩 활성/포커스 대비 (globals.css)

**Files:**
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: `.service-type-tab*` 규칙 교체**

기존(~1193–1209행):
```css
.service-type-tab {
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid var(--rm-line-subtle);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background .12s ease, color .12s ease, border-color .12s ease;
}
.service-type-tab:hover { color: var(--color-text-primary); }
.service-type-tab.is-active {
  background: var(--baemin-mint);
  color: #fff;
  border-color: var(--baemin-mint);
}
```
를 다음으로 교체:
```css
.service-type-tab {
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid transparent;        /* 비활성은 상시 테두리 제거 */
  background: var(--color-bg-muted);     /* 비활성 = 옅은 채움(off pill) */
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background .12s ease, color .12s ease, border-color .12s ease, box-shadow .12s ease;
}
.service-type-tab:hover {
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--baemin-mint) 14%, transparent);
}
.service-type-tab.is-active {
  background: var(--baemin-mint);
  color: #fff;
  border-color: var(--baemin-mint);
  box-shadow: 0 1px 6px color-mix(in srgb, var(--baemin-mint) 45%, transparent); /* 선택을 또렷하게 */
}
/* 키보드 포커스만 별도 아웃라인 — 마우스 클릭 후엔 안 보여 '선택'과 혼동 없음. */
.service-type-tab:focus-visible {
  outline: 2px solid var(--baemin-mint);
  outline-offset: 2px;
}
```
(`--baemin-mint`, `--color-bg-muted`, `--color-text-muted`, `--color-text-primary` 이미 정의됨. `ServiceTypeFilterTabs.tsx` 마크업은 변경 없음 — `is-active`/`aria-selected` 그대로.)

- [ ] **Step 2: 검증**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/app/globals.css && git commit -m "fix(ux): B1 service-type filter chip active/focus contrast"
```

---

### Task 4: 최종 검증 + PR

- [ ] **Step 1: 풀 빌드**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
```
Expected: 세 단계 통과, Next 빌드 성공.

- [ ] **Step 2: 변경 요약 + PR (→ dev)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git diff dev --stat && git push -u origin cc-ux-mgmt-layout-filter && gh pr create --base dev --title "UX 수정: /management 레이아웃(A3/A4) + 필터 칩 대비(B1)" --body "$(cat <<'EOF'
## Summary
운영자 UX 점검 3건 수정 (프론트 전용):
- **A3**: /management 를 1200px 컨테이너 + 상단 88px 여백으로 → 첫 섹션 내려받기/업로드가 플로팅 유틸바에 안 가림
- **A4**: 관리 테이블 내부 고정-높이 스크롤 제거(`.management-panel` 하위로 한정 → 다른 화면 무영향) → 페이지 단일 스크롤 + sticky 섹션 내비(차량·라이더·매칭·배차·유모차·배민 앵커)
- **B1**: 서비스 필터 칩 비활성 테두리 제거·활성 mint 강조·`:focus-visible` 별도 아웃라인 → 활성/포커스 또렷

## 배포 영향
- 프론트 전용 (globals.css + management/page.tsx + 신규 ManagementSectionNav). 백엔드/마이그레이션 없음.

## Test Plan
- [x] typecheck + lint + build
- [ ] 프로덕션 QA: (A3) 첫 섹션 버튼 안 가림 / (A4) 표 위 스크롤이 페이지 이동 + 검은 빈영역 없음 + 섹션 내비 점프 / (B1) 필터 칩 활성 또렷

## 비범위(후속)
관리 테이블 검색/필터/정렬, 차량 운영방식 태그 + 방식별 지도 필터, 마커 declutter/범례.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:** A3(컨테이너+상단여백)→Task1. A4a(중첩 스크롤 제거, 공유클래스 scoped)→Task1. A4b(sticky 섹션 내비+앵커+scroll-margin)→Task2. B1(칩 활성/포커스 대비)→Task3. 검증/PR→Task4. ✓ 비범위(테이블 필터·방식 태그·declutter)는 제외 명시.

**2. Placeholder scan:** 모든 CSS/TSX 완전 코드. "적절히" 류 없음. 오프셋 값(88px/96px/top16/z60)은 구체값 — 시각적 미세조정 여지는 있으나 placeholder 아님.

**3. Type consistency:** 섹션 id (`mgmt-vehicles`…`mgmt-baemin`)가 ManagementSectionNav 의 SECTIONS 와 page.tsx `<section id>` 에서 동일. 클래스명(`.management-page`, `.management-panel`, `.management-anchor`, `.management-section-nav(-link)`, `.service-type-tab(.is-active)(:focus-visible)`) 일관. 사용 CSS 변수는 기존 정의 재사용(구현자 확인).

**구현자 주의:** Task1 의 `.management-panel .table-card` override 는 `.table-card` 베이스(다른 화면 RidersPanel/MaintenancePanel)를 건드리지 않는지 — `.management-panel` 루트가 /management 패널에만 있는지 grep 으로 확인(VehiclesManagementPanel 도 `.management-panel` 인지 포함). `.vehicles-table-scroll` 가 VehiclesManagementPanel 외에서 쓰이면 동일하게 scoped 처리.
