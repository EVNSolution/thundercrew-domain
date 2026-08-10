# 관리자 웹 디자인 정본

- 작성일: 2026-08-10
- 참고 정본: `EVNSolution/clever-dsv-web` (`DESIGN.md`, `AGENTS.md`, `src/styles`)
- 상태: 제안. 화면별 검토 후 확정
- 적용 대상: `development/frontend` (Next.js App Router)

## 1. 이 문서의 위치

`clever-dsv-web`의 디자인 언어를 썬더크루 관리자 웹에 적응시킨 기준입니다.
DSV는 배송 운영 도구이고 썬더크루는 차량 자산 운영 도구라, 그대로 복사하지 않고
**성격·토큰·레이아웃 골간은 따르고 썬더크루 고유 업무는 확장**합니다.

기존 `development/frontend/DESIGN.md`(Baemin Mint 기준)를 대체할 후보입니다.
확정 시 그 문서를 아카이브로 내리고 이 문서를 정본으로 승격합니다.

## 2. 제품 성격

DSV의 정의를 그대로 가져옵니다.

- 성격: 차분하고 정확한 운영 도구
- 목표: 현재 상태, 선택 대상, 다음 행동을 빠르게 읽게 한다
- 금지: 시뮬레이션 문구, 금속성 그라데이션, 광택, 중첩 카드, 장식용 아이콘,
  hover에 따른 레이아웃 이동

썬더크루에 추가되는 성격:

- 차량은 물리 자산이다. 상태(운행/정비/미배차)와 위치는 항상 함께 읽혀야 한다
- 배송용과 클린차량은 다른 업무다. 한 화면에 섞어 보여주지 않는다

### 2.1 기존 화면에서 걷어낼 것

DSV 금지 목록에 걸리는 현재 구현입니다. 확정 시 정리 대상입니다.

| 대상 | 문제 |
| --- | --- |
| 플릿 배달 시뮬레이션 (`FleetSimulationContext`, `use-simulated-bike-pins`) | "시뮬레이션 문구 금지"에 정면으로 걸립니다. 데모 목적이면 운영 화면에서 분리 |
| 중첩 카드 | 관리 화면의 패널 안 패널 구조 점검 필요 |
| 민트 액센트 (`--baemin-mint`, `--rm-accent` 2계열 병존) | 토큰 통합 후 단일 계열로 (§4.1) |

## 3. 명칭 규칙

DSV `AGENTS.md`의 규칙을 그대로 채택합니다.

- 탭, 메뉴, 페이지 제목, 카드 제목, 섹션 제목은 **하나의 개념만** 나타낸다
- 서로 다른 업무 대상을 `·`, `/`, `&`, `+`, 접속어로 결합해 하나의 명칭처럼 만들지 않는다
- 두 대상을 함께 다뤄야 하면 상위 개념으로 명명하거나 상위 메뉴 + 하위 영역으로 분리한다

현재 위반 사례와 정정안:

| 현재 | 문제 | 정정 |
| --- | --- | --- |
| `장비 종류`와 `바이크 장비` 두 화면 | 같은 개념의 분리 노출 | `장비` 하나로 묶고 종류/설치를 하위 영역으로 |
| `보험`과 `보험 항목` | 같음 | `보험` 하나로 묶고 하위 영역으로 |
| `계약`과 `계약 양식` | 같음 | `계약` 하나로 묶고 하위 영역으로 |
| 자원 관리 페이지의 `차량 / 라이더 / 매칭 / 작업 로그` | 4개 대상이 한 페이지 | 관리(기준정보)와 이력으로 재분배 (§5) |

## 4. 시각 언어

### 4.1 색

DSV 팔레트를 기준으로 하고, 썬더크루에 필요한 것만 더합니다.

```css
/* 표면과 글자 */
--color-white: #ffffff;
--color-canvas: #f5f5f7;
--color-surface: var(--color-white);
--color-ink: #1d1d1f;
--color-muted: #6e6e73;
--color-text-subtle: #737b87;
--color-border: #e5e5ea;
--color-row-hover: #f7faff;
--color-row-divider: #eceff3;

/* 의미색 — 색상만으로 상태를 전달하지 않는다 */
--color-primary: #0066cc;        /* 선택, 주요 행동 */
--color-primary-soft: #e8f2ff;
--color-success: #1f8b4c;        /* 진행 */
--color-success-soft: #e9f7ef;
--color-warning: #f79009;        /* 주의 */
--color-warning-soft: #fff7e8;
--color-risk: #d92d20;           /* 오류 */
--color-risk-soft: #fff0ed;
--color-complete: #8e8e93;       /* 완료 */
--color-complete-soft: #f2f2f7;
--color-future: #d1d5db;         /* 미도래 */

/* 지도 */
--color-map-canvas: #eef3f8;
--color-departure: #008060;
--color-control-border: #cfd5dd;
```

**결정 1 — 민트 액센트를 버리고 DSV 파랑을 기본값으로 씁니다.**
`--baemin-mint`와 `--rm-accent` 두 계열을 `--color-primary` 하나로 통합합니다.
현재 두 계열의 값이 이미 같으므로(`#3B82F6`/`#00E7D0`) 지금이 통합 시점입니다.
260804 미팅의 테마 색 설정 기능은 이 `--color-primary`를 런타임에 바꾸는 것으로 구현합니다.

**결정 2 — 다크모드는 두지 않습니다** (2026-08-10 변경).

처음에는 기존 `ThemeToggle.tsx`와 다크 토큰이 동작하므로 유지하자고 했으나,
사용자 판단으로 폐기했습니다. DSV에 다크모드가 없고(`prefers-color-scheme` 규칙 0건)
"흰 표면 + 검정 텍스트를 기본으로 한다"는 원칙을 그대로 따르는 것이 일관됩니다.

새 관리자 웹(`development/web`)은 `color-scheme: light`로 고정하고
`prefers-color-scheme`·`data-theme` 분기를 두지 않습니다. 설정의 액센트 색
지정도 라이트 한 세트만 받습니다.

기존 Next.js 콘솔의 다크 테마는 그 콘솔이 운영에서 내려갈 때까지 그대로 둡니다.

**용도 색**: 배송용/클린차량은 색으로만 구분하지 않습니다.
전역 스위치(§5.2)로 화면 자체가 분리되므로 마커에 별도 용도 색을 두지 않습니다.

**권역 색**: 권역 마스터가 색을 소유합니다(260804 스펙 §5.7). 이 색은 의미색
팔레트와 충돌하지 않도록 채도를 낮춘 범위에서만 선택 가능하게 제한합니다.
빨강/초록 계열은 상태색과 혼동되므로 권역 색 선택지에서 제외합니다.

### 4.2 글꼴과 크기

```css
--font-sans: "Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif;

--text-page-title: 34px;      /* letter-spacing: -.05em */
--text-section-title: 15px;
--text-body: 14px;
--text-caption: 11px;
```

Pretendard Variable을 전역 글꼴로 씁니다. 현재 프로젝트 글꼴을 확인해 교체합니다.

### 4.3 간격, 반경, 컨트롤 높이

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px;  --space-4: 16px;
--space-5: 20px; --space-6: 24px; --space-7: 28px;

--radius-control: 12px;   /* 입력, 버튼 */
--radius-table: 14px;
--radius-card: 18px;
--radius-panel: 24px;     /* 사이드바, 떠 있는 패널 */
--radius-shell: 30px;     /* page-content */
--radius-pill: 999px;

--control-height-small: 28px;
--control-height-medium: 36px;
--control-height-large: 44px;

--shadow-floating: 0 24px 70px rgba(0, 0, 0, .10);
--motion-fast: .16s;
--motion-standard: .2s;
```

4px 단위를 기본으로 하되 **모든 내부 요소에 동일 패딩을 중첩하지 않습니다.**
큰 반경과 외곽선은 최상위 작업 패널에 집중하고, 표와 내부 제목에는 카드와
그림자를 만들지 않습니다.

## 5. 레이아웃

### 5.1 셸 골간

DSV의 떠 있는 셸 구조를 따릅니다.

```
.page (100vw × 100dvh, overflow hidden)
  --sidebar-width: 76px  (접힘) / 206px (펼침)

  .left-tabs        left:12 top:12, width:var(--sidebar-width)
                    radius 24, 흰 배경, 우측에 접힘 레일(12px)
  .top-cluster      left:calc(12 + sidebar + 12) top:12
                    브랜드, 상태 배너, 알림
  .page-content     left:100 right:12 top:12 bottom:12
                    radius 30, rgba(255,255,255,.94) + backdrop-blur(18px)
                    overflow auto
    .page-hero      제목(34px) + 설명 한 줄, min-height 56
    (콘텐츠)
```

`.nav-expanded`일 때 `.page-content { left: 230px }`.
정적 페이지(로그인 등)는 `.static-page`로 배경을 불투명 흰색으로 바꿉니다.

### 5.2 진입 모드 — 로그인 후 업무를 고른다

업무 모드는 사이드바 토글이 아니라 **진입 시 선택**입니다.
로그인 → 모드 선택 → 그 모드의 운영 화면으로 들어갑니다.

```
/login  →  /select-mode  →  /delivery/*  또는  /cleaning/*  또는  /maintenance/*
```

세 갈래입니다.

| 모드 | 대상 | 담당 |
| --- | --- | --- |
| 배송용 | `purpose=DELIVERY` 차량·라이더 | 배송 운영 |
| 클린차량 | `purpose=CLEANING` 차량·클리너 | 클리닝 운영 |
| **정비** | **전 차량 (용도 무관)** | 정비 담당 |

정비가 별도 모드인 이유: 정비 품목은 `(wheelType, engineType)` 조합으로 결정되고
용도와 무관합니다. 브레이크 패드는 배송용이든 클린차량이든 같은 품목입니다.
정비 담당자는 용도로 나뉘지 않은 전체 차량을 봅니다.
용도 모드 안에 정비를 두면 같은 화면을 두 벌 만들고 품목 카탈로그가
양쪽에 걸린 공유 데이터가 되어 편집 주인이 불분명해집니다.

모드 선택 화면은 `.static-page` 패턴을 씁니다. 세 개의 선택 카드만 두고
다른 요소를 두지 않습니다.

선택값은 쿠키에 저장하고 URL prefix에도 드러냅니다.
서버 컴포넌트가 데이터 로드 단계에서 읽어야 하므로 쿠키가 정본이고,
URL은 북마크·공유 가능성을 위한 것입니다.

### 5.3 사이드바 구성

모드에 따라 상단 메뉴가 다르고, 하단 전역 메뉴는 같습니다.

```
배송용 / 클린차량 모드              정비 모드
──────────────────────────         ──────────────────────────
.sidebar-brand                     .sidebar-brand

.main-tab  관제                    .main-tab  정비
.main-tab  배차                    .main-tab  품목
.main-tab  이력                    .main-tab  이력
.main-tab  관리

(구분선)                            (구분선)
.main-tab  감사                    .main-tab  감사
.main-tab  진단                    .main-tab  진단

.mode-current  현재: 배송용 — 전환  .mode-current  현재: 정비 — 전환
.main-tab  설정                    .main-tab  설정
```

`.mode-current`를 누르면 모드 선택 화면으로 돌아갑니다. 재로그인은 필요 없습니다.
접힌 상태(76px)에서는 모드 아이콘만 남습니다.

### 5.4 용도 축의 적용 범위

| 화면 | 모드 | 용도 | 근거 |
| --- | --- | --- | --- |
| 관제 | 배송용 / 클린차량 | **분리** | 배송은 위치가 핵심, 클리닝은 예정 시각이 핵심 |
| 배차 | 배송용 / 클린차량 | **분리** | 배송은 주문 풀, 클리닝은 시간 슬롯 예약 |
| 이력 | 배송용 / 클린차량 | **분리** | 배송은 완료 시각·증빙, 클리닝은 예정 대비 실제·소요 |
| 관리 | 배송용 / 클린차량 | **분리** | 해당 용도 차량·인력만 다룸 |
| 정비 | 정비 | 통합 | 정비 품목이 (휠 × 엔진)으로 결정. 용도 무관 |
| 품목 | 정비 | 통합 | 카탈로그. 편집 주인이 정비 모드로 확정 |
| 이력 | 정비 | 통합 | 전 차량 정비 실시 기록 |
| 감사 | 전역 | 전역 | 운영자 계정에 용도가 없음. 나눌 수 없음 |
| 진단 | 전역 | 전역 | 단말·수집·정합성은 시스템 단위 |
| 설정 | 전역 | 전역 | 테마·수집 주기·단말 연동은 서비스 하나에 하나 |

감사·진단·설정이 전역인 것은 선택이 아니라 데이터가 강제하는 것입니다.
작업 로그의 행위자는 관리자 계정이고 관리자에게는 용도가 없습니다.
테마 색을 용도별로 둘 이유도 없습니다.

용도 무관 화면(정비 모드, 진단의 미수신 차량)에서는 차량에 **용도 칩**을 표시하고
용도 필터를 선택적으로 제공합니다. 기본값은 전체입니다.

**"분리"는 필터가 아니라 별개 화면이라는 뜻입니다.** 같은 표에 조건만 걸지
않고, 패널 구성과 표 컬럼과 입력 항목이 각각 다릅니다. 상세는
[`03-screen-feature-map.md`](./03-screen-feature-map.md)에 둡니다.

### 5.5 용도 변경은 "이동"이다

용도가 필터가 아니라 **소속**이 되었으므로, 용도 변경은 편집이 아니라 이동입니다.
이동한 차량이 현재 목록에서 사라지는 것은 올바른 동작입니다.
버그로 읽히는 것은 그것이 조용히 일어날 때뿐입니다.

그래서 차량 상세의 용도는 select가 아닙니다.

- 용도는 **읽기 전용 값**으로 표시합니다
- 옆에 `클린차량으로 이동` 버튼을 둡니다
- 누르면 확인 다이얼로그 — 무엇이 함께 이동하고 무엇이 끊기는지 설명합니다
  (진행 중 배차, 활성 계약, 함체 장비가 영향을 받습니다)
- 이동 후 목록에서 사라지며, 토스트로 결과와 이동 경로를 안내합니다
  — "클린차량으로 이동했습니다. → 클린차량 관리에서 보기"

라이더의 직무(라이더/클리너) 변경도 같은 방식입니다.

### 5.6 콘텐츠 패턴 4종

화면마다 새로 만들지 않고 아래 4개 중 하나를 고릅니다.

| 패턴 | 구조 | 쓰는 화면 |
| --- | --- | --- |
| **관제형** | `.map-card`(inset 0) + 떠 있는 `.card.panel.expand-card` | 관제 |
| **표형** | `.page-grid` > `.page-panel`(+`.wide`) > 실제 `<table class="page-table">` | 이력, 배차 목록 |
| **목록+상세형** | `.master-detail-grid` > 목록 / `.management-editor` | 관리, 정비 |
| **폼형** | `.page-grid` > `.page-panel` > 필드 그리드 | 설정 |

## 6. 데이터 표현

- 비교 데이터는 카드보다 **실제 `table` 구조**를 우선합니다
- 표 헤더와 본문 글자 크기는 정보 밀도를 해치지 않는 범위에서 일관되게 유지합니다
- 상태 pill(`.chip`)은 꼭 필요한 짧은 상태에만 씁니다
- 스크롤 영역(`.overlay-scroll`)은 콘텐츠 폭을 밀지 않으며, 시각적 스크롤바를
  숨기더라도 키보드와 포인터 스크롤은 유지합니다
- 지도 마커, 순서 번호, 레이블은 하나의 시각 단위로 다룹니다

### 6.1 상태 칩 매핑

썬더크루 도메인 상태를 DSV 칩 변형에 매핑합니다.
**모든 칩은 색 + 텍스트를 함께 씁니다.**

| 도메인 상태 | 칩 | 근거 |
| --- | --- | --- |
| 차량 `IN_SERVICE` (운행) | `.chip.green` | 진행 |
| 차량 `READY` (대기) | `.chip.gray` | 완료/유휴 |
| 시동 차단 (`ignitionBlocked`) | `.chip.risk` | 오류·차단 |
| 배차 진행 중 | `.chip.green` | 진행 |
| 배차 제안 중 (`assignment_mode=OFFER` 수락 대기) | `.chip.blue` | 선택 대기 |
| 배차 완료 | `.chip.gray` | 완료 |
| 정비 주기 임박 | `.chip.amber` | 주의 |
| 정비 주기 초과 | `.chip.risk` | 오류 |
| 계약 종료됨 | `.chip.gray` | 완료 |
| 텔레메트리 미수신 | `.chip.risk` | 오류 |

## 7. 상호작용

- 선택된 행, 차량, 배송지, 경로는 **같은 상태를 공유**합니다.
  표에서 행을 고르면 지도의 해당 차량이 함께 선택됩니다
- 로딩 중에는 기존 레이아웃 크기를 유지합니다.
  지도 화면은 정적 프리뷰 → 실제 지도 → 운영 데이터 순서로 표시합니다
- **remote 오류를 mock 데이터로 감추지 않습니다.**
  현재 프론트는 `SERVICE_OPS_API_BASE_URL` 미설정 시 mock으로 떨어지고 notice를
  띄웁니다. 이 동작을 유지하되, remote 모드에서 **요청이 실패한 경우**에는
  mock으로 대체하지 않고 오류를 그대로 표시합니다
- 빈 상태는 이유와 다음 행동을 작업 영역 안에서 설명합니다
- 버튼, 표 행, 메뉴는 명확한 `focus-visible`을 유지합니다
- reduced-motion 환경에서는 불필요한 전환을 제거합니다

## 8. 반응형

- 데스크톱 기본. 1500px, 1120px, 920px, 768px 이하 구간을 지원합니다
- 중간 폭에서 사이드 메뉴가 가로 메뉴로 변형되지 않습니다
- 768px 이하는 고정 브랜드 헤더와 전체 화면 메뉴를 씁니다
- 관제의 보조 카드는 작은 화면에서 접힌 상태로 시작하고, 펼치면 전체 영역을 씁니다
- 좁은 관리 화면은 선택 전 목록 / 선택 후 상세를 우선하되 각 영역 최소 폭을 유지합니다

## 9. CSS 소유 구조

DSV의 cascade layer 구조를 채택합니다. 현재 프로젝트는 `app/globals.css` 단일
파일에 전부 들어 있어 소유가 불분명합니다.

```css
@layer vendor, reset, tokens, base, components, features, responsive, overrides;
```

| 경로 | 소유 |
| --- | --- |
| `styles/index.css` | 진입점과 layer 순서 |
| `styles/foundation/tokens.css` | 토큰 |
| `styles/foundation/` | reset, 기본 요소 |
| `styles/components/` | 셸, 내비게이션, 지도, 공통 UI |
| `styles/features/` | 화면별 규칙 |
| `styles/responsive/` | 반응형 보정 |

새 의존성이나 새 전역 스타일 파일보다 기존 layer와 소유 파일을 먼저 씁니다.

## 10. 접근성과 검증

- 실제 표 semantics와 접근 가능한 이름을 유지합니다
- 핵심 정보는 hover 없이 읽을 수 있어야 하며 tooltip은 보조 정보에만 씁니다
- 키보드로 선택, 취소, 펼치기, 주요 명령을 실행할 수 있어야 합니다
- 코드 변경은 빌드와 관련 테스트로 검증합니다
- **최종 화면의 시각적 판단은 사용자가 수행합니다.**
  에이전트 완료 조건에 수동 화면 검증을 포함하지 않습니다

## 11. 검토가 필요한 판단

| # | 항목 | 내용 |
| --- | --- | --- |
| 1 | 민트 → 파랑 | 브랜드 정체성 변경입니다. `DESIGN.md`의 Baemin Mint 기준을 폐기하는 결정 (§4.1) |
| 2 | ~~다크모드 유지~~ | **폐기됨.** 다크모드를 두지 않기로 확정 (§4.1 결정 2) |
| 3 | 시뮬레이션 기능 | 운영 화면에서 분리할지, 완전 제거할지 (§2.1) |
| 4 | Pretendard 도입 | 현재 글꼴 확인 후 교체 범위 결정 (§4.2) |
| 5 | mock fallback 정책 | remote 실패 시 오류 노출로 바꾸면 기존 동작이 변합니다 (§7) |
| 6 | 셸 구조 이식 비용 | DSV는 Vite SPA, 썬더크루는 Next.js App Router입니다. absolute 셸을 서버 컴포넌트 구조에 얹는 비용 확인 필요 (§5.1) |

## 12. 관련 문서

- 화면별 기능 정리: [`03-screen-feature-map.md`](./03-screen-feature-map.md)
- 260804 미팅 요구사항: [`../superpowers/specs/2026-08-05-meeting-260804-resource-dispatch-design.md`](../superpowers/specs/2026-08-05-meeting-260804-resource-dispatch-design.md)
- 기존 디자인 문서(대체 대상): `development/frontend/DESIGN.md`
