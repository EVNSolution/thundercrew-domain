# Design System — Baemin Mint Core Page Composition

> 목적: 기존 Vercel 기반 디자인 문서를 제거하고, 페이지 구성용 디자인 기준을 **배민 핵심 민트 색상 중심**으로 재정의한다.  
> 적용 범위: 랜딩/운영 페이지, 대시보드, 리스트/상세 화면, 관리자성 웹 UI.  
> 색상 기준: 본 문서는 작업용 기준으로 `#0CEFD3`를 Baemin Mint Core로 사용한다. 최종 상용 반영 전에는 공식 브랜드 가이드 또는 실제 앱/브랜드 에셋 기준으로 재확인한다.

---

## 1. Visual Theme & Atmosphere

이 디자인 시스템은 배민의 핵심 민트 컬러를 중심으로 한 **밝고 명확한 정보형 UI**를 목표로 한다.

전체 분위기는 다음 세 가지를 기준으로 한다.

1. **화이트 기반의 깨끗한 화면**
   - 페이지 전체는 흰색 또는 거의 흰색에 가까운 배경을 사용한다.
   - 민트는 화면 전체를 덮는 배경색이 아니라, 핵심 행동과 상태를 구분하는 포인트로 사용한다.

2. **민트 단일 액센트**
   - 주요 CTA, 선택 상태, 활성 탭, 핵심 배지, 포커스 링에만 민트를 사용한다.
   - 레드/핑크/블루/옐로우 등 다른 브랜드성 액센트는 기본 시스템에 포함하지 않는다.

3. **운영자가 빠르게 읽는 구조**
   - 시각적 장식보다 정보 판독성, 상태 구분, 액션 접근성을 우선한다.
   - 카드, 리스트, 테이블, 필터, 상세 패널은 명확한 간격과 얇은 경계로 구분한다.

### Key Characteristics

- 배경: `#FFFFFF` 중심
- 핵심 브랜드 액센트: `#0CEFD3`
- 본문/제목: near-black 계열
- 보조 텍스트: neutral gray 계열
- 카드/패널: white surface + shadow-as-border
- 민트 사용 범위: CTA, selected, active, focus, highlight
- 과한 그라데이션, 다중 컬러, 화려한 장식은 사용하지 않음

---

## 2. Color Palette & Roles

### 2.1 Core Brand

```css
:root {
  --baemin-mint: #0CEFD3;
}
```

| Token | Value | Role |
|---|---:|---|
| `--baemin-mint` | `#0CEFD3` | Primary CTA, active state, selected filter, focus ring, key marker |

### 2.2 Background & Surface

```css
:root {
  --color-bg: #FFFFFF;
  --color-bg-soft: #F8FAFA;
  --color-bg-muted: #F3F6F6;

  --color-surface: #FFFFFF;
  --color-surface-raised: #FFFFFF;
  --color-surface-mint: rgba(12, 239, 211, 0.08);
}
```

| Token | Use |
|---|---|
| `--color-bg` | 전체 페이지 배경 |
| `--color-bg-soft` | 섹션 배경, 페이지 헤더 하단 배경 |
| `--color-bg-muted` | 비활성 영역, 테이블 헤더, 빈 상태 배경 |
| `--color-surface` | 카드, 패널, 모달, 드롭다운 |
| `--color-surface-mint` | 선택 카드, 강조 안내 영역, 민트 톤 배경 |

### 2.3 Text

```css
:root {
  --color-text-primary: #111111;
  --color-text-secondary: #4D4D4D;
  --color-text-muted: #777777;
  --color-text-disabled: #A3A3A3;
  --color-text-inverse: #FFFFFF;
  --color-text-on-mint: #061B1A;
}
```

| Token | Use |
|---|---|
| `--color-text-primary` | 제목, 주요 수치, 핵심 라벨 |
| `--color-text-secondary` | 본문, 설명, 테이블 값 |
| `--color-text-muted` | 보조 설명, 메타 정보, 힌트 |
| `--color-text-disabled` | disabled 상태, 사용 불가 텍스트 |
| `--color-text-inverse` | 어두운 배경 위 텍스트 |
| `--color-text-on-mint` | 민트 배경 위 텍스트 |

### 2.4 Border & Divider

```css
:root {
  --color-border: rgba(0, 0, 0, 0.08);
  --color-border-strong: rgba(0, 0, 0, 0.14);
  --color-border-mint: rgba(12, 239, 211, 0.45);
  --color-divider: rgba(0, 0, 0, 0.06);
}
```

| Token | Use |
|---|---|
| `--color-border` | 기본 카드/입력/드롭다운 경계 |
| `--color-border-strong` | 강조 구분선, 테이블 상단 라인 |
| `--color-border-mint` | selected/focus 상태 |
| `--color-divider` | 리스트, 테이블, 섹션 내부 구분 |

### 2.5 Mint Alpha Scale

```css
:root {
  --mint-04: rgba(12, 239, 211, 0.04);
  --mint-08: rgba(12, 239, 211, 0.08);
  --mint-12: rgba(12, 239, 211, 0.12);
  --mint-20: rgba(12, 239, 211, 0.20);
  --mint-32: rgba(12, 239, 211, 0.32);
  --mint-45: rgba(12, 239, 211, 0.45);
}
```

| Token | Use |
|---|---|
| `--mint-04` | 아주 약한 배경 강조 |
| `--mint-08` | 선택 가능 항목 hover |
| `--mint-12` | selected/active 배경 |
| `--mint-20` | focus outer ring |
| `--mint-32` | 강조 구역 배경, marker halo |
| `--mint-45` | border/focus 강조 |

---

## 3. Typography Rules

한국어 UI 기준으로 가독성과 운영성 중심의 폰트 스택을 사용한다.

```css
:root {
  --font-sans: "Pretendard", "Inter", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  --font-mono: "Geist Mono", "SFMono-Regular", "Menlo", "Consolas", monospace;
}
```

### 3.1 Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Color |
|---|---:|---:|---:|---:|---|
| Display Hero | 48px | 700 | 1.12 | -1.2px | `--color-text-primary` |
| Page Title | 36px | 700 | 1.20 | -0.8px | `--color-text-primary` |
| Section Heading | 28px | 700 | 1.28 | -0.4px | `--color-text-primary` |
| Card Title | 22–24px | 700 | 1.32 | -0.2px | `--color-text-primary` |
| Sub Title | 18–20px | 600 | 1.45 | normal | `--color-text-primary` |
| Body Large | 18px | 400 | 1.65 | normal | `--color-text-secondary` |
| Body | 16px | 400 | 1.55 | normal | `--color-text-secondary` |
| Body Small | 14px | 400 | 1.45 | normal | `--color-text-muted` |
| UI Label | 13px | 600 | 1.30 | normal | `--color-text-muted` |
| Caption | 12px | 500 | 1.35 | normal | `--color-text-muted` |
| Number / Metric | 32–48px | 700 | 1.05 | -0.8px | `--color-text-primary` |
| Mono Label | 12px | 600 | 1.20 | 0.02em | `--color-text-muted` |

### 3.2 Typography Principles

- 제목은 민트색으로 칠하지 않는다.
- 민트는 제목 일부 키워드, underline, 상태 배지, CTA에만 사용한다.
- 한국어 본문은 과도한 negative letter-spacing을 피한다.
- 숫자/금액/건수는 tabular number를 권장한다.
- 긴 설명보다 짧은 라벨과 명확한 상태 문구를 우선한다.

```css
.metric-number {
  font-variant-numeric: tabular-nums;
}
```

---

## 4. Component Styling

## 4.1 Buttons

### Primary Button

주요 행동에만 사용한다.

```css
.button-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  height: 40px;
  padding: 0 16px;

  border: 0;
  border-radius: 8px;

  background: var(--baemin-mint);
  color: var(--color-text-on-mint);

  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;

  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06);
  cursor: pointer;
}

.button-primary:hover {
  background: #05E2C8;
}

.button-primary:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 1px var(--baemin-mint),
    0 0 0 4px var(--mint-20);
}

.button-primary:disabled {
  background: #D7DFDF;
  color: #8A9494;
  cursor: not-allowed;
}
```

**Use**
- 저장
- 등록
- 시작하기
- 배차 확정
- 적용
- 다음 단계

### Secondary Button

보조 행동에 사용한다.

```css
.button-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  height: 40px;
  padding: 0 16px;

  border: 0;
  border-radius: 8px;

  background: #FFFFFF;
  color: var(--color-text-primary);

  font-size: 14px;
  font-weight: 600;

  box-shadow: 0 0 0 1px var(--color-border);
  cursor: pointer;
}

.button-secondary:hover {
  background: var(--color-bg-soft);
}

.button-secondary:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 1px var(--baemin-mint),
    0 0 0 4px var(--mint-20);
}
```

**Use**
- 취소
- 뒤로
- 상세 보기
- 초기화
- 보조 액션

### Ghost Mint Button

민트 계열의 약한 버튼이다.

```css
.button-ghost-mint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  height: 40px;
  padding: 0 16px;

  border: 0;
  border-radius: 8px;

  background: var(--mint-08);
  color: var(--color-text-primary);

  font-size: 14px;
  font-weight: 700;

  box-shadow: 0 0 0 1px var(--mint-20);
  cursor: pointer;
}

.button-ghost-mint:hover {
  background: var(--mint-12);
}
```

**Use**
- 지도 보기
- 필터 열기
- 경로 확인
- 선택 전환

---

## 4.2 Cards & Containers

### Base Card

```css
.card {
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow:
    0 0 0 1px var(--color-border),
    0 2px 2px rgba(0, 0, 0, 0.04),
    0 8px 8px -8px rgba(0, 0, 0, 0.04);
}
```

### Highlight Card

```css
.card-highlight {
  background:
    linear-gradient(180deg, var(--mint-08) 0%, #FFFFFF 70%);
  border-radius: 12px;
  box-shadow:
    0 0 0 1px var(--color-border-mint),
    0 4px 12px rgba(0, 0, 0, 0.05);
}
```

### Selected Card

```css
.card-selected {
  background: var(--color-surface-mint);
  box-shadow:
    0 0 0 1px var(--color-border-mint),
    0 6px 16px rgba(0, 0, 0, 0.05);
}
```

**Card Rules**
- 기본 카드는 흰색 배경을 유지한다.
- 민트 배경은 선택/활성/추천 상태에만 사용한다.
- 카드 제목은 검정 계열, 설명은 회색 계열로 둔다.
- 카드 전체를 민트색으로 채우지 않는다.

---

## 4.3 Badges & Status

### Default Badge

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;

  height: 24px;
  padding: 0 10px;

  border-radius: 9999px;

  background: var(--mint-08);
  color: var(--color-text-primary);

  font-size: 12px;
  font-weight: 700;
}
```

### Active Badge

```css
.badge-active {
  background: var(--baemin-mint);
  color: var(--color-text-on-mint);
}
```

### Muted Badge

```css
.badge-muted {
  background: #F1F4F4;
  color: var(--color-text-muted);
}
```

### Outline Badge

```css
.badge-outline {
  background: #FFFFFF;
  color: var(--color-text-secondary);
  box-shadow: 0 0 0 1px var(--color-border);
}
```

**Status Rules**
- 활성/선택/진행 중: 민트
- 대기/비활성: 회색
- 완료: 민트 outline 또는 muted mint
- 오류/경고: 이 문서에서는 브랜드 컬러를 추가하지 않는다. 실제 제품 요구가 있으면 별도 semantic color를 정의한다.

---

## 4.4 Inputs & Forms

```css
.input {
  width: 100%;
  height: 40px;

  padding: 0 12px;

  border: 0;
  border-radius: 8px;

  background: #FFFFFF;
  color: var(--color-text-primary);

  font-family: var(--font-sans);
  font-size: 14px;

  box-shadow: 0 0 0 1px var(--color-border);
}

.input::placeholder {
  color: var(--color-text-disabled);
}

.input:hover {
  box-shadow: 0 0 0 1px var(--color-border-strong);
}

.input:focus {
  outline: none;
  box-shadow:
    0 0 0 1px var(--baemin-mint),
    0 0 0 4px var(--mint-20);
}

.input:disabled {
  background: var(--color-bg-muted);
  color: var(--color-text-disabled);
}
```

### Select / Dropdown

```css
.select {
  height: 40px;
  padding: 0 36px 0 12px;
  border: 0;
  border-radius: 8px;
  background: #FFFFFF;
  color: var(--color-text-primary);
  box-shadow: 0 0 0 1px var(--color-border);
}

.select:focus {
  outline: none;
  box-shadow:
    0 0 0 1px var(--baemin-mint),
    0 0 0 4px var(--mint-20);
}
```

### Checkbox

```css
.checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  accent-color: var(--baemin-mint);
}
```

---

## 4.5 Tabs & Segmented Controls

```css
.tabs {
  display: inline-flex;
  gap: 4px;

  padding: 4px;

  border-radius: 10px;
  background: var(--color-bg-muted);
}

.tab {
  height: 32px;
  padding: 0 12px;

  border: 0;
  border-radius: 8px;

  background: transparent;
  color: var(--color-text-muted);

  font-size: 14px;
  font-weight: 600;
}

.tab-active {
  background: #FFFFFF;
  color: var(--color-text-primary);
  box-shadow:
    0 0 0 1px var(--color-border),
    inset 0 -2px 0 var(--baemin-mint);
}
```

**Rules**
- 탭 전체 배경은 회색
- 활성 탭은 흰색 + 민트 하단 라인
- 민트 채움 탭은 핵심 CTA와 충돌하므로 기본 탭에는 쓰지 않는다

---

## 4.6 Tables

운영형 화면에서는 테이블 판독성이 중요하다.

```css
.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #FFFFFF;
}

.table th {
  height: 40px;
  padding: 0 12px;

  background: var(--color-bg-soft);
  color: var(--color-text-muted);

  font-size: 12px;
  font-weight: 700;
  text-align: left;
  white-space: nowrap;

  border-bottom: 1px solid var(--color-divider);
}

.table td {
  height: 48px;
  padding: 0 12px;

  color: var(--color-text-secondary);
  font-size: 14px;

  border-bottom: 1px solid var(--color-divider);
}

.table tr:hover td {
  background: var(--mint-04);
}

.table tr.is-selected td {
  background: var(--mint-08);
}
```

**Rules**
- 테이블 헤더는 회색 배경
- hover는 `--mint-04`
- selected row는 `--mint-08`
- 행 전체에 진한 민트 배경을 사용하지 않는다
- 숫자 컬럼은 우측 정렬 또는 tabular number 사용

---

## 4.7 Navigation

### Top Navigation

```css
.header {
  position: sticky;
  top: 0;
  z-index: 50;

  height: 64px;

  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(16px);

  box-shadow: 0 1px 0 var(--color-divider);
}
```

### Nav Item

```css
.nav-item {
  display: inline-flex;
  align-items: center;

  height: 36px;
  padding: 0 10px;

  border-radius: 8px;

  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.nav-item:hover {
  background: var(--color-bg-soft);
  color: var(--color-text-primary);
}

.nav-item-active {
  background: var(--mint-08);
  color: var(--color-text-primary);
  box-shadow: inset 0 -2px 0 var(--baemin-mint);
}
```

**Rules**
- 상단 네비게이션은 흰색 유지
- 현재 위치만 민트로 표시
- CTA 버튼은 오른쪽에 배치
- 헤더 전체를 민트로 채우지 않는다

---

## 4.8 Empty States

```css
.empty-state {
  padding: 48px 24px;
  text-align: center;

  background: var(--color-bg-soft);
  border-radius: 12px;

  box-shadow: 0 0 0 1px var(--color-border);
}

.empty-state-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;

  border-radius: 16px;
  background: var(--mint-12);
  color: var(--color-text-primary);
}
```

**Copy Pattern**
- 제목: 현재 상태를 짧게 말한다.
- 설명: 다음 행동을 안내한다.
- 버튼: 가능한 경우 하나의 primary action만 제공한다.

예시:

```text
아직 등록된 항목이 없습니다.
첫 항목을 등록하면 이 영역에서 바로 확인할 수 있습니다.
[등록하기]
```

---

## 5. Page Layout Principles

### 5.1 Container

```css
.page {
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

.page-container {
  width: min(100% - 48px, 1200px);
  margin: 0 auto;
}
```

### 5.2 Page Structure

```text
Top Navigation
↓
Page Header / Hero
↓
Primary Action Area
↓
Metric Cards
↓
Main Content Grid
↓
Table / Map / Detail Panel
↓
Footer or Bottom Action
```

### 5.3 Spacing Scale

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
}
```

| Context | Recommended Gap |
|---|---:|
| Label ↔ Value | 4–8px |
| Button group | 8px |
| Card internal gap | 16px |
| Card grid gap | 16–24px |
| Section gap | 48–80px |
| Page top/bottom padding | 48–80px |

### 5.4 Grid

```css
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.layout-main-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;
}
```

**Rules**
- 대시보드 지표: 3–4열
- 본문 카드: 2–3열
- 리스트 + 상세: main + right panel
- 모바일에서는 모두 단일 컬럼

---

## 6. Recommended Page Composition

## 6.1 Landing / Intro Page

```text
Header
- Logo / Service Name
- Navigation
- Primary CTA

Hero
- One-line value proposition
- Short description
- Primary CTA + Secondary CTA
- Mint key visual or mint underline

Feature Cards
- 3 cards
- White card surface
- Mint badge only

Metric Section
- Large numbers
- Minimal text
- Mint highlight only on key number marker

Footer
- Neutral links
```

### Hero Example

```css
.hero {
  padding: 96px 0 72px;
  text-align: center;
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;

  border-radius: 9999px;
  background: var(--mint-08);
  color: var(--color-text-primary);

  font-size: 13px;
  font-weight: 700;
}

.hero-title {
  margin: 20px auto 0;
  max-width: 760px;

  font-size: 48px;
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -1.2px;
}

.hero-description {
  margin: 20px auto 0;
  max-width: 640px;

  color: var(--color-text-secondary);
  font-size: 18px;
  line-height: 1.65;
}
```

---

## 6.2 Operations Dashboard

```text
Topbar
- Page title
- Date/filter
- Primary action

Metric Cards
- Total
- Active
- Pending
- Completed

Main Area
- Left: table/list/map
- Right: selected item detail

Bottom/Side Action
- Save/apply/dispatch/export
```

### Metric Card

```css
.metric-card {
  padding: 20px;
  border-radius: 12px;
  background: #FFFFFF;
  box-shadow:
    0 0 0 1px var(--color-border),
    0 2px 2px rgba(0, 0, 0, 0.04);
}

.metric-label {
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 700;
}

.metric-value {
  margin-top: 8px;
  color: var(--color-text-primary);
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.metric-change {
  margin-top: 12px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.metric-change.is-positive {
  color: #087568;
}
```

> 주의: 상태 변화 텍스트에 별도 색을 쓰는 경우도 민트 계열의 어두운 톤으로 제한한다.

---

## 6.3 List / Detail Page

```text
Page Header
- Title
- Description
- Primary CTA

Filter Bar
- Search
- Select filters
- Date range
- Reset

Content
- List/Table
- Detail drawer or right panel
```

### Filter Bar

```css
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;

  padding: 12px;

  border-radius: 12px;
  background: #FFFFFF;

  box-shadow:
    0 0 0 1px var(--color-border),
    0 2px 2px rgba(0, 0, 0, 0.03);
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  height: 32px;
  padding: 0 10px;

  border-radius: 9999px;
  background: var(--color-bg-soft);
  color: var(--color-text-secondary);

  font-size: 13px;
  font-weight: 600;
}

.filter-chip.is-active {
  background: var(--mint-12);
  color: var(--color-text-primary);
  box-shadow: 0 0 0 1px var(--mint-45);
}
```

---

## 6.4 Detail Panel

```css
.detail-panel {
  position: sticky;
  top: 80px;

  padding: 20px;

  border-radius: 12px;
  background: #FFFFFF;

  box-shadow:
    0 0 0 1px var(--color-border),
    0 8px 24px rgba(0, 0, 0, 0.06);
}

.detail-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-divider);
}

.detail-panel-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.detail-panel-section {
  padding: 16px 0;
  border-bottom: 1px solid var(--color-divider);
}
```

**Rules**
- 상세 패널은 정보 요약 중심
- 주요 상태만 badge로 표현
- CTA는 하단 고정 또는 섹션 마지막에 배치
- 패널 배경을 민트로 채우지 않는다

---

## 7. Map / Location UI Rules

지도 또는 위치 기반 UI가 있는 경우, 지도 자체는 중립 톤을 유지하고 민트는 현재 선택/활성 오브젝트에만 사용한다.

### Marker

```css
.map-marker {
  width: 14px;
  height: 14px;

  border-radius: 9999px;
  background: var(--baemin-mint);

  box-shadow:
    0 0 0 4px var(--mint-20),
    0 0 0 1px rgba(0, 0, 0, 0.12);
}
```

### Selected Marker

```css
.map-marker-selected {
  width: 18px;
  height: 18px;

  background: var(--baemin-mint);

  box-shadow:
    0 0 0 6px var(--mint-32),
    0 8px 16px rgba(0, 0, 0, 0.16);
}
```

### Floating Panel

```css
.map-floating-panel {
  position: absolute;

  padding: 12px;

  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px);

  box-shadow:
    0 0 0 1px var(--color-border),
    0 8px 24px rgba(0, 0, 0, 0.12);
}
```

**Rules**
- 도로/행정동/지형 색상은 지도 API 스타일에서 중립 톤으로 구성
- 민트는 선택된 행정동 경계, 현재 기사/차량, 활성 경로에만 사용
- 여러 상태가 필요하면 색상보다 shape, line style, label로 먼저 구분한다

---

## 8. Depth & Elevation

| Level | CSS Treatment | Use |
|---|---|---|
| Level 0 | none | 페이지 배경, 일반 텍스트 |
| Level 1 | `0 0 0 1px var(--color-border)` | 기본 카드, 입력 |
| Level 2 | ring + `0 2px 2px rgba(0,0,0,0.04)` | 일반 패널 |
| Level 3 | ring + `0 8px 24px rgba(0,0,0,0.06)` | 모달, 드롭다운, 상세 패널 |
| Active | mint ring + soft shadow | 선택 카드, 활성 필터 |
| Focus | mint ring + outer glow | 키보드 포커스 |

### Shadow Tokens

```css
:root {
  --shadow-ring: 0 0 0 1px var(--color-border);
  --shadow-card:
    0 0 0 1px var(--color-border),
    0 2px 2px rgba(0, 0, 0, 0.04),
    0 8px 8px -8px rgba(0, 0, 0, 0.04);
  --shadow-panel:
    0 0 0 1px var(--color-border),
    0 8px 24px rgba(0, 0, 0, 0.06);
  --shadow-focus:
    0 0 0 1px var(--baemin-mint),
    0 0 0 4px var(--mint-20);
  --shadow-active:
    0 0 0 1px var(--color-border-mint),
    0 6px 16px rgba(0, 0, 0, 0.05);
}
```

---

## 9. Responsive Behavior

### Breakpoints

| Name | Width | Behavior |
|---|---:|---|
| Mobile Small | `<400px` | 단일 컬럼, 최소 패딩 |
| Mobile | `400–600px` | 카드/필터 stack |
| Tablet | `600–1024px` | 2컬럼 가능 |
| Desktop | `1024–1400px` | 기본 그리드 |
| Large Desktop | `>1400px` | 중앙 정렬, 최대폭 유지 |

### CSS Example

```css
@media (max-width: 1024px) {
  .layout-main-detail {
    grid-template-columns: 1fr;
  }

  .detail-panel {
    position: static;
  }
}

@media (max-width: 768px) {
  .page-container {
    width: min(100% - 32px, 1200px);
  }

  .grid-3,
  .grid-2 {
    grid-template-columns: 1fr;
  }

  .hero-title {
    font-size: 36px;
    letter-spacing: -0.8px;
  }

  .filter-bar {
    align-items: stretch;
    flex-direction: column;
  }
}
```

### Touch Rules

- 버튼 높이: 최소 40px
- 모바일 주요 버튼: 44px 이상 권장
- 필터 chip: 최소 32px
- 테이블 행: 최소 48px
- 아이콘 단독 버튼: 40x40px

---

## 10. Accessibility Rules

### Contrast

- 민트 배경 위에는 `#061B1A` 사용을 기본으로 한다.
- 민트 위 흰색 텍스트는 크기/굵기가 충분할 때만 사용한다.
- 본문은 `#4D4D4D` 이하로 너무 연하게 만들지 않는다.

### Focus

모든 interactive element는 `focus-visible` 상태를 가져야 한다.

```css
:where(button, a, input, select, textarea, [tabindex]):focus-visible {
  outline: none;
  box-shadow:
    0 0 0 1px var(--baemin-mint),
    0 0 0 4px var(--mint-20);
}
```

### State Text

색상만으로 상태를 전달하지 않는다.

```text
나쁜 예: 민트색 점만 표시
좋은 예: 민트색 점 + “진행 중” 텍스트
```

---

## 11. Do's and Don'ts

### Do

- `#0CEFD3`를 핵심 액센트로 사용한다.
- 기본 배경은 `#FFFFFF`를 유지한다.
- 카드/패널은 shadow-as-border로 구분한다.
- 주요 CTA, active, selected, focus에만 민트를 사용한다.
- 텍스트는 검정/회색 계열로 유지한다.
- 민트 배경 위 텍스트는 `#061B1A`를 우선 사용한다.
- hover/focus/selected 상태는 mint alpha scale로 통일한다.
- 운영 화면은 카드, 테이블, 필터, 상세 패널을 명확히 분리한다.

### Don't

- 페이지 전체를 민트 배경으로 채우지 않는다.
- 제목 전체를 민트색으로 칠하지 않는다.
- 레드/핑크/블루/오렌지 등 다른 브랜드성 액센트를 섞지 않는다.
- 모든 아이콘을 민트로 만들지 않는다.
- 카드 테두리를 두껍게 만들지 않는다.
- 민트 그림자/글로우를 남발하지 않는다.
- 장식용 그라데이션을 과하게 사용하지 않는다.
- 오류/경고 상태까지 억지로 민트로 표현하지 않는다.

---

## 12. CSS Token Bundle

```css
:root {
  /* Brand */
  --baemin-mint: #0CEFD3;

  /* Background */
  --color-bg: #FFFFFF;
  --color-bg-soft: #F8FAFA;
  --color-bg-muted: #F3F6F6;

  /* Surface */
  --color-surface: #FFFFFF;
  --color-surface-raised: #FFFFFF;
  --color-surface-mint: rgba(12, 239, 211, 0.08);

  /* Text */
  --color-text-primary: #111111;
  --color-text-secondary: #4D4D4D;
  --color-text-muted: #777777;
  --color-text-disabled: #A3A3A3;
  --color-text-inverse: #FFFFFF;
  --color-text-on-mint: #061B1A;

  /* Border */
  --color-border: rgba(0, 0, 0, 0.08);
  --color-border-strong: rgba(0, 0, 0, 0.14);
  --color-border-mint: rgba(12, 239, 211, 0.45);
  --color-divider: rgba(0, 0, 0, 0.06);

  /* Mint Alpha */
  --mint-04: rgba(12, 239, 211, 0.04);
  --mint-08: rgba(12, 239, 211, 0.08);
  --mint-12: rgba(12, 239, 211, 0.12);
  --mint-20: rgba(12, 239, 211, 0.20);
  --mint-32: rgba(12, 239, 211, 0.32);
  --mint-45: rgba(12, 239, 211, 0.45);

  /* Typography */
  --font-sans: "Pretendard", "Inter", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  --font-mono: "Geist Mono", "SFMono-Regular", "Menlo", "Consolas", monospace;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 9999px;

  /* Shadow */
  --shadow-ring: 0 0 0 1px var(--color-border);
  --shadow-card:
    0 0 0 1px var(--color-border),
    0 2px 2px rgba(0, 0, 0, 0.04),
    0 8px 8px -8px rgba(0, 0, 0, 0.04);
  --shadow-panel:
    0 0 0 1px var(--color-border),
    0 8px 24px rgba(0, 0, 0, 0.06);
  --shadow-focus:
    0 0 0 1px var(--baemin-mint),
    0 0 0 4px var(--mint-20);
  --shadow-active:
    0 0 0 1px var(--color-border-mint),
    0 6px 16px rgba(0, 0, 0, 0.05);
}
```

---

## 13. Agent Prompt Guide

### 13.1 Short Prompt

```text
Create a clean white operations-style web page using Baemin mint as the only brand accent. Use #0CEFD3 for primary CTA, active states, selected filters, focus rings, and key markers. Keep headings in #111111 and body text in #4D4D4D. Cards should be white with shadow-as-border using 0 0 0 1px rgba(0,0,0,0.08). Do not use red, pink, blue, orange, or decorative multi-color gradients. Use mint only as solid accent or alpha tint.
```

### 13.2 Full Prompt

```text
Build a page composition design using a Baemin-inspired mint core color system.

Visual direction:
- White-first interface
- Baemin mint #0CEFD3 as the only brand accent
- Near-black headings #111111
- Secondary body text #4D4D4D
- Muted text #777777
- White cards and panels
- Shadow-as-border instead of thick CSS borders
- Minimal, operational, high-readability UI

Use mint only for:
- Primary CTA
- Active navigation
- Selected filters
- Focus ring
- Key badges
- Map markers or active highlights

Avoid:
- Red, pink, blue, orange brand accents
- Full-page mint backgrounds
- Mint headings
- Heavy decorative gradients
- Thick borders
- Overly playful components

Components to include:
- Sticky white header
- Page hero/header
- Metric cards
- Filter bar
- Table/list
- Detail panel
- Primary/secondary/ghost buttons
- Empty state
- Responsive mobile layout

CSS tokens:
--baemin-mint: #0CEFD3;
--color-bg: #FFFFFF;
--color-surface: #FFFFFF;
--color-text-primary: #111111;
--color-text-secondary: #4D4D4D;
--color-text-muted: #777777;
--color-border: rgba(0,0,0,0.08);
--mint-08: rgba(12,239,211,0.08);
--mint-20: rgba(12,239,211,0.20);
```

---

## 14. Implementation Checklist

- [ ] 기존 Red/Pink/Blue workflow accent 제거
- [ ] 모든 primary CTA를 `#0CEFD3` 기준으로 변경
- [ ] 모든 focus ring을 mint scale로 통일
- [ ] selected/active 상태를 mint alpha scale로 통일
- [ ] 카드/패널은 흰색 + shadow-as-border 유지
- [ ] 제목/본문 텍스트는 검정/회색 계열 유지
- [ ] 민트 배경 위 텍스트는 `#061B1A` 우선 사용
- [ ] 테이블 hover는 `--mint-04`, selected row는 `--mint-08`
- [ ] 헤더는 흰색/blur/얇은 divider 유지
- [ ] 오류/경고 semantic color는 별도 요구 전까지 추가하지 않음
- [ ] 공식 브랜드 가이드 또는 실제 앱 기준으로 최종 색상 검수

---

## 15. Final Principle

> 화면은 흰색으로 읽히고, 행동은 민트로 보이게 한다.  
> 민트는 브랜드를 보여주는 색이 아니라, 사용자가 지금 눌러야 하거나 봐야 할 것을 알려주는 색이다.
