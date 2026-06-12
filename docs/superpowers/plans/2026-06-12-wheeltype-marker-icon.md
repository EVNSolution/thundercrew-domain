# 휠타입별 지도 마커 아이콘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도 차량 마커를 `wheelType` 으로 분기 — `TWO_WHEEL`→오토바이(현행), `FOUR_WHEEL`→박스트럭.

**Architecture:** `bikes.wheel_type`(이미 존재)를 대시보드 핀 DTO까지 전달하고 프론트 `bikeIconSvg(wheelType)`에서 분기. 마이그레이션 없음.

**Tech Stack:** Spring Boot (Java 21), JDBC, Next.js, TypeScript, NCP Maps.

**작업 경로:** 백엔드 `development/service-ops-api`, 프론트 `development/front-admin-web`. Bash 절대경로 cd (cwd 매 호출 리셋). 브랜치 `cc-wheeltype-marker` 체크아웃(이미 생성됨). 계약 테스트 Docker 필요 → 컴파일만 로컬 게이트. 프론트 `npm run typecheck && lint && build`.

---

### Task 1: 백엔드 — wheelType을 대시보드 핀까지 전달

**Files:**
- Modify: `.../dashboard/repository/DashboardMapQueryRepository.java`
- Modify: `.../dashboard/dto/DashboardMapStateResponse.java`
- Modify: `.../dashboard/service/DashboardMapStateService.java`
- Test: 대시보드 계약 테스트

- [ ] **Step 1: 쿼리 SELECT + 매핑 + BikePinRow**

`DashboardMapQueryRepository.java`:
- `findCurrentBikeStates` SQL의 `b.service_type,` 다음 줄에 `b.wheel_type,` 추가.
- `mapBikePinRow`에서 `BikeServiceType.valueOf(rs.getString("service_type")),` 다음에 `BikeWheelType.valueOf(rs.getString("wheel_type")),` 추가.
- `BikePinRow` record에서 `BikeServiceType serviceType,` 다음에 `BikeWheelType wheelType,` 추가.
- import 추가: `import com.thundercrew.opsapi.bike.domain.BikeWheelType;`

- [ ] **Step 2: BikePin DTO 필드**

`DashboardMapStateResponse.java`의 `BikePin` record에서 `BikeServiceType serviceType,` 다음에 `BikeWheelType wheelType,` 추가. import `com.thundercrew.opsapi.bike.domain.BikeWheelType;` 추가(없으면).

- [ ] **Step 3: toBikePin 전달**

`DashboardMapStateService.java` `toBikePin`의 `new BikePin(...)` 에서 `row.serviceType(),` 다음에 `row.wheelType(),` 추가. (import `BikeWheelType` 불필요 — 값 패스스루. 컴파일 에러면 추가.)

- [ ] **Step 4: 컴파일**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: 계약 테스트 단언**

`grep -rln "DashboardMapApiContractTests\|map-state\|BikePin" src/test/java` 에서 대시보드 핀 테스트를 찾아, 시드 차량의 `wheel_type`(기본 'TWO_WHEEL'; 한 차량은 `'FOUR_WHEEL'`로 명시 시드)에 따라 핀 응답 `bikePins[n].wheelType` 가 `"TWO_WHEEL"`/`"FOUR_WHEEL"` 로 노출되는지 단언 추가. 기존 핀 필드 단언은 유지. 시드 insert에 `wheel_type` 컬럼이 빠져 있으면 NOT NULL DEFAULT 라 자동 'TWO_WHEEL' — 4륜 검증용으로 한 행만 명시 지정.

- [ ] **Step 6: 컴파일(main+test) + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard development/service-ops-api/src/test/java && git commit -m "feat(map): expose bike wheelType on dashboard pin"
```
Co-Authored-By 라인 포함.

---

### Task 2: 프론트 — 핀 타입 + 아이콘 분기

**Files:**
- Modify: `development/front-admin-web/lib/services/service-ops-api.ts`
- Modify: `development/front-admin-web/components/dashboard/MapShell.tsx`

- [ ] **Step 1: 핀 타입에 wheelType**

`service-ops-api.ts` `ServiceOpsDashboardBikePin` 의 `serviceType?: ServiceOpsBikeServiceType;` 다음에 `wheelType?: ServiceOpsBikeWheelType;` 추가. (`ServiceOpsBikeWheelType = "TWO_WHEEL" | "FOUR_WHEEL"` 이미 존재.) `FrontendDashboardBikePin`은 `Omit<ServiceOpsDashboardBikePin, ...>` 인데 wheelType이 Omit 목록에 없으므로 자동 포함 — grep으로 Omit 목록 확인하고 wheelType이 없으면 그대로 둠.

- [ ] **Step 2: bikeIconSvg 분기**

`MapShell.tsx` `bikeIconSvg()` 를 인자 받게 변경:
```ts
function bikeIconSvg(wheelType?: string): string {
  if (wheelType === "FOUR_WHEEL") {
    return `<svg ${ICON_SVG_PROPS}>
    <path d="M2.5 16 V7.5 H13 V16"/>
    <path d="M13 10.5 H16.5 L20.5 13.5 V16 H13"/>
    <path d="M2.5 16 H4.3"/>
    <path d="M8.2 16 H14.8"/>
    <path d="M18.7 16 H20.5"/>
    <path d="M16.5 10.7 V13.5 H20.2"/>
    <circle cx="6.3" cy="17.6" r="1.9"/>
    <circle cx="16.8" cy="17.6" r="1.9"/>
  </svg>`;
  }
  return `<svg ${ICON_SVG_PROPS}>
    <circle cx="6" cy="18" r="2"/>
    <circle cx="18" cy="18" r="2"/>
    <path d="M6 16 L7 10"/>
    <path d="M7 10 L10 8"/>
    <path d="M7 10 H13 L16 14"/>
    <path d="M8 16 H16"/>
    <rect x="13" y="4" width="7" height="6" rx="0.75"/>
    <path d="M13 6.5 H20"/>
  </svg>`;
}
```
(기존 오토바이 path는 현재 `bikeIconSvg` 본문 그대로 — READ해서 정확히 옮길 것. `ICON_SVG_PROPS` 래퍼 동일 사용.)

- [ ] **Step 3: bikeMarkerHtml에 wheelType 전달**

`bikeMarkerHtml(...)` 시그니처에 `wheelType?: string` 인자 추가(끝쪽, `ignitionStatus` 뒤). 본문에서 `markerWrapper(bikeIconSvg(), ...)` → `markerWrapper(bikeIconSvg(wheelType), ...)`. 호출부(약 라인 468) `bikeMarkerHtml(..., pin.connectionStatus, pin.ignitionStatus)` 끝에 `, pin.wheelType` 추가.

- [ ] **Step 4: typecheck + lint + build + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/lib/services/service-ops-api.ts development/front-admin-web/components/dashboard/MapShell.tsx && git commit -m "feat(map): wheel-type marker icon (2륜 bike / 4륜 box truck)"
```
Co-Authored-By 라인 포함. Expected: 전부 통과.

---

### Task 3: 최종 검증 + PR

- [ ] **Step 1: 풀 검증**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain && (git diff dev --name-only | grep -i "db/migration" && echo "MIGRATION!" || echo "no migration (의도대로)")
```
Expected: 백엔드/프론트 성공, 마이그레이션 0.

- [ ] **Step 2: PR (→ dev)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git push -u origin cc-wheeltype-marker && gh pr create --base dev --title "휠타입별 지도 마커 아이콘 (2륜 오토바이 / 4륜 박스트럭)" --body "$(cat <<'EOF'
## Summary
- 대시보드 핀에 `wheelType` 노출(백엔드 쿼리→BikePinRow→BikePin DTO)
- 프론트 `bikeIconSvg(wheelType)` 분기: FOUR_WHEEL → 박스트럭, 그 외 → 오토바이
- 시뮬 차량은 spread로 wheelType 자동 상속

## 배포 영향
- **마이그레이션 없음** (wheel_type 컬럼 기존). 재기동만으로 적용.

## Test Plan
- [x] 백엔드 compileJava + compileTestJava
- [x] 프론트 typecheck + lint + build, 마이그레이션 0
- [ ] 계약 테스트(CI): 핀 wheelType 노출
- [ ] 프로덕션 QA: 4륜(청소차) 마커 = 박스트럭, 2륜(배송) = 오토바이

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec 커버리지:** 백엔드 전달(쿼리/BikePinRow/BikePin/toBikePin) Task1, 계약테스트 Task1 Step5, 프론트 타입+아이콘 분기+배선 Task2, 검증·PR Task3. ✓ 마이그레이션 없음. ✓

**2. 플레이스홀더 스캔:** 박스트럭 SVG·분기 함수·필드 추가 위치 전부 구체적. Task1 Step5(테스트)·Task2 Step1(Omit 확인)은 grep 후 대상 한정 — placeholder 아님.

**3. 타입/이름 일관성:** `wheelType`을 각 record의 `serviceType` 바로 뒤에 일관 삽입(BikePinRow·BikePin DTO·mapBikePinRow·toBikePin 네 곳 모두 serviceType 다음). `BikeWheelType{TWO_WHEEL,FOUR_WHEEL}` ↔ 프론트 `ServiceOpsBikeWheelType="TWO_WHEEL"|"FOUR_WHEEL"` ↔ `bikeIconSvg`의 `=== "FOUR_WHEEL"` 일치. `bikeMarkerHtml(wheelType)` ↔ 호출부 `pin.wheelType` 일관.

**구현자 주의:** 박스트럭/오토바이 SVG는 동일 `ICON_SVG_PROPS` 래퍼·viewBox(0 0 24)를 써야 크기·앵커가 맞음. 기존 오토바이 path는 현재 `bikeIconSvg`에서 그대로 옮길 것. 충전소/팁 아이콘은 건드리지 말 것.
