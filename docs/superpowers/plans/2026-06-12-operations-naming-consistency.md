# 업무 관리 섹션 네이밍 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 업무 관리 라벨을 콜 배차 / 순차 배차 / 왕복 배차로 통일·정렬. 프론트 문구만, 마이그레이션 없음.

**Tech Stack:** Next.js, TypeScript. 브랜치 `cc-operations-naming` (이미 생성됨). 경로 `development/front-admin-web`. Bash 절대경로 cd.

**매핑:** BaeminCallPanel=콜 배차, DispatchPanel=순차 배차, StrollerRoundPanel=왕복 배차. 앵커 id·동작 어휘(라운드/콜/수거·배송/순번) 유지.

---

### Task 1: 라벨·순서·제목 문구 변경

**Files:**
- Modify: `app/management/operations/page.tsx`
- Modify: `components/management/BaeminCallPanel.tsx`
- Modify: `components/management/DispatchPanel.tsx`
- Modify: `components/management/StrollerRoundPanel.tsx`

- [ ] **Step 1: operations 페이지 SECTIONS + 렌더 순서**

`app/management/operations/page.tsx`의 `SECTIONS` 배열을 콜→순차→왕복 순으로 교체:
```tsx
const SECTIONS = [
  { id: "mgmt-baemin", label: "콜 배차" },
  { id: "mgmt-dispatch", label: "순차 배차" },
  { id: "mgmt-stroller", label: "왕복 배차" }
];
```
그리고 `<section>` 렌더 순서도 동일하게 재정렬(콜→순차→왕복):
```tsx
      <section id="mgmt-baemin" className="management-anchor">
        <BaeminCallPanel initialOffered={offeredCalls} deliveryVehicles={deliveryVehicles} />
      </section>
      <section id="mgmt-dispatch" className="management-anchor">
        <DispatchPanel exportUrl="/api/management/dispatch/export" />
      </section>
      <section id="mgmt-stroller" className="management-anchor">
        <StrollerRoundPanel initialRound={activeRound} />
      </section>
```
(import·데이터 로딩·props 그대로. 앵커 id 유지.)

- [ ] **Step 2: BaeminCallPanel 제목**

`components/management/BaeminCallPanel.tsx`: `<span className="mgmt-panel-title">배민 콜</span>` → `<span className="mgmt-panel-title">콜 배차</span>`. (다른 "콜" 문구 — "콜 등록"/"콜이 등록되었습니다"/"수락 대기 중인 콜"/"배차 방식" — 유지.)

- [ ] **Step 3: DispatchPanel 제목 + 미리보기**

`components/management/DispatchPanel.tsx`:
- `<span className="mgmt-panel-title">배차</span>` → `<span className="mgmt-panel-title">순차 배차</span>`
- `<h2 className="bulk-preview-title">배차 업로드 미리보기</h2>` → `<h2 className="bulk-preview-title">순차 배차 업로드 미리보기</h2>`
- notice `배차 ${result.applied}건 적용 완료`는 유지(일반 동작 문구).

- [ ] **Step 4: StrollerRoundPanel 제목 + 미리보기 + 알림**

`components/management/StrollerRoundPanel.tsx`:
- `<span className="mgmt-panel-title">유모차 라운드</span>` → `<span className="mgmt-panel-title">왕복 배차</span>`
- `<h2 className="bulk-preview-title">유모차 라운드 업로드 미리보기</h2>` → `<h2 className="bulk-preview-title">왕복 배차 업로드 미리보기</h2>`
- `setNotice("유모차 라운드가 생성되었습니다.")` → `setNotice("왕복 배차 라운드가 생성되었습니다.")`
- 파일 상단 주석 "유모차 라운드 섹션" → "왕복 배차(라운드) 섹션"(선택).
- "진행 라운드 없음"/"라운드 생성"/stage 등 라운드 메커니즘 문구는 유지.

- [ ] **Step 5: typecheck + lint + build**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
```
Expected: 전부 통과.

- [ ] **Step 6: 잔존 확인 + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && grep -rn "배민\|유모차" development/front-admin-web/components/management/BaeminCallPanel.tsx development/front-admin-web/components/management/StrollerRoundPanel.tsx development/front-admin-web/components/management/DispatchPanel.tsx development/front-admin-web/app/management/operations/page.tsx || echo "no brand/domain labels left"
git add development/front-admin-web/app/management/operations/page.tsx development/front-admin-web/components/management/BaeminCallPanel.tsx development/front-admin-web/components/management/DispatchPanel.tsx development/front-admin-web/components/management/StrollerRoundPanel.tsx && git commit -m "feat(mgmt): unify operations labels (콜/순차/왕복 배차) + reorder"
```
(주석 외 사용자 표시 '배민/유모차' 잔존 0 기대. Co-Authored-By 라인 포함.)

---

### Task 2: 최종 검증 + PR

- [ ] **Step 1: 검증**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain && (git diff dev --name-only | grep -i "db/migration" && echo MIGRATION || echo "no migration")
```
Expected: 통과, 마이그레이션 0.

- [ ] **Step 2: PR (→ dev)**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git push -u origin cc-operations-naming && gh pr create --base dev --title "업무 관리 라벨 통일 (콜/순차/왕복 배차)" --body "$(cat <<'EOF'
## Summary
- 업무 관리 섹션을 콜 배차 / 순차 배차 / 왕복 배차로 통일·재정렬 (기존 배차/유모차/배민 콜 — 기능·도메인·브랜드 혼재 해소)
- 매핑: 배민 콜→콜 배차, 배차→순차 배차, 유모차 라운드→왕복 배차
- 점프 내비 라벨·순서 + 패널 제목 + 업로드 미리보기 제목 + 라운드 생성 알림 정리
- 앵커 id·serviceType·서버액션·동작 어휘(라운드/콜/수거·배송) 유지

## 배포 영향
- 프론트 문구만, **마이그레이션 없음**.

## Test Plan
- [x] typecheck + lint + build, 마이그레이션 0
- [ ] 프로덕션 QA: 업무 관리 내비/제목 = 콜·순차·왕복 배차 순서·라벨, 기능 정상

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec 커버리지:** SECTIONS 라벨+순서(Step1), 3 패널 제목/미리보기/알림(Step2-4), 검증·PR(Task2). ✓ 앵커 id·동작 어휘 유지. ✓ 마이그레이션 없음.

**2. 플레이스홀더 스캔:** 모든 문구 변경이 before→after 구체 명시. 잔존 grep 검증 포함.

**3. 타입/이름 일관성:** 매핑 일관(콜=배민, 순차=배차, 왕복=유모차). 앵커 id 변경 없음(mgmt-baemin/dispatch/stroller 유지) → 섹션 내비 href·section id 일치. 패널 props 무변경.
