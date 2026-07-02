# 작업 로그 열람 + actor·핵심 CRUD 감사 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** 감사로그에 actor(로그인 관리자)를 기록하고, 차량·라이더·매칭·배차 핵심 CRUD에 서버사이드 감사를 추가하고, 관리 화면에 작업 로그 조회 UI를 붙인다.

**Architecture:** 기존 `audit_logs`/`AuditLog*` 인프라 재사용. actor는 `AuditLogCommandService`가 SecurityContext에서 한 번에 채움. 각 command 서비스는 신규 `AuditLogCommandService.log(...)`로 이벤트 감사 기록. 읽기 API에 entityType/limit 추가. 프론트는 기존 `listAuditLogs` 클라이언트 + 신규 패널.

**Tech Stack:** Spring Boot(JWT resource server) / JPA / Gradle, Next.js/TS. 스키마 변경 없음.

**Worktree:** `C:\Users\user\.config\superpowers\worktrees\thundercrew-domain\cc-audit-log-viewer` (branch `cc-audit-log-viewer`, off dev). Bash 툴, `./gradlew.bat`. 계약테스트는 Docker 필요 — 없으면 `compileJava`/`compileTestJava`로 게이트([[reference_no_backend_test_ci]]).

**Reference spec:** `docs/superpowers/specs/2026-07-02-audit-log-viewer-design.md`

**감사 이벤트 규약(전 태스크 공통):** `field` sentinel = `__created__` / `__updated__` / `__deleted__` / `__terminated__`. `newValue` = 사람이 읽는 식별자/요약, `oldValue`는 삭제/종료 시 식별자 그 외 null. entityType = `BIKE`/`RIDER`/`CONTRACT`/`DISPATCH_ORDER`.

---

## Task 1: actor 캡처 + 내부 log() 헬퍼 (AuditLogCommandService)

**Files:** Modify `development/backend/src/main/java/com/thundercrew/opsapi/audit/service/AuditLogCommandService.java`

- [ ] **Step 1:** `record(req)`의 actor `null` → `currentActor()`, 그리고 내부용 `log(...)` + `currentActor()` 추가. 전체 클래스 본문의 메서드부를 아래로:

```java
    public AuditLogReadResponse record(AuditLogCreateRequest req) {
        AuditLog auditLog = AuditLog.create(
                req.entityType(), req.entityId(), req.field(),
                req.oldValue(), req.newValue(), currentActor(), java.time.Instant.now());
        return AuditLogReadResponse.from(auditLogRepository.save(auditLog));
    }

    /** 서버사이드 감사 기록(command 서비스용). actor는 인증 컨텍스트에서 자동. */
    public void log(String entityType, java.util.UUID entityId, String field, String oldValue, String newValue) {
        auditLogRepository.save(AuditLog.create(
                entityType, entityId, field, oldValue, newValue, currentActor(), java.time.Instant.now()));
    }

    /** 현재 인증 관리자 식별자(JWT subject). 미인증/익명이면 null. */
    private String currentActor() {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            return null;
        }
        return auth.getName();
    }
```

- [ ] **Step 2:** `cd development/backend && ./gradlew.bat compileJava` → BUILD SUCCESSFUL.
- [ ] **Step 3:** Commit
```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/audit/service/AuditLogCommandService.java
git commit -m "$(cat <<'EOF'
feat(audit): 감사 기록에 actor(SecurityContext) 자동 캡처 + 내부 log() 헬퍼

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 읽기 API에 entityType 필터 + limit

**Files:** Modify `audit/repository/AuditLogRepository.java`, `audit/service/AuditLogReadService.java`, `audit/controller/AuditLogReadController.java`

- [ ] **Step 1: Repository** — 추가:
```java
    @org.springframework.data.jpa.repository.Query(
        "select a from AuditLog a where a.deletedAt is null "
        + "and (:entityType is null or a.entityType = :entityType) order by a.occurredAt desc")
    List<AuditLog> findRecentFiltered(
        @org.springframework.data.repository.query.Param("entityType") String entityType,
        org.springframework.data.domain.Pageable pageable);
```
(엔티티 Java 필드명이 `entityType`/`occurredAt`/`deletedAt`인지 확인; 다르면 JPQL 맞춤.)

- [ ] **Step 2: ReadService** — `listRecent()` 옆에 추가(기존 유지):
```java
    public List<AuditLogReadResponse> list(String entityType, int limit) {
        int capped = Math.max(1, Math.min(limit, 500));
        String type = (entityType == null || entityType.isBlank()) ? null : entityType;
        return auditLogRepository.findRecentFiltered(
                type, org.springframework.data.domain.PageRequest.of(0, capped)).stream()
                .map(AuditLogReadResponse::from).toList();
    }
```

- [ ] **Step 3: Controller** — `list` 시그니처 확장(entityId 분기 유지):
```java
    @GetMapping
    List<AuditLogReadResponse> list(
            @RequestParam(required = false) UUID entityId,
            @RequestParam(required = false) String entityType,
            @RequestParam(defaultValue = "200") int limit) {
        if (entityId != null) {
            return auditLogReadService.listByEntity(entityId);
        }
        return auditLogReadService.list(entityType, limit);
    }
```

- [ ] **Step 4:** `./gradlew.bat compileJava` → SUCCESSFUL.
- [ ] **Step 5:** Commit
```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/audit/
git commit -m "$(cat <<'EOF'
feat(audit): 읽기 API에 entityType 필터 + limit(기본 200)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 차량 CRUD 감사 (BikeCommandService)

**Files:** Modify `bike/service/BikeCommandService.java`

- [ ] **Step 1:** `AuditLogCommandService` 의존성 주입(생성자 파라미터 + 필드; import `com.thundercrew.opsapi.audit.service.AuditLogCommandService`).
- [ ] **Step 2:** 성공 지점에 감사 기록(각 메서드 return 직전, flush 이후):
  - `create`: `auditLogCommandService.log("BIKE", saved.getId(), "__created__", null, saved.getPlateNumber());`
  - `update`: `auditLogCommandService.log("BIKE", bike.getId(), "__updated__", null, bike.getPlateNumber());`
  - `softDelete(id)`: 삭제 대상 bike를 로드(이미 로드하면 재사용)해 `auditLogCommandService.log("BIKE", id, "__deleted__", bike.getPlateNumber(), null);` (softDelete가 id만 받으면 `bikeRepository.findByIdAndDeletedAtIsNull(id)`로 plate 확보 후 삭제).
  - (`changeOperationStatus`는 기존 프론트 감사가 있으니 이번엔 건드리지 않음.)
- [ ] **Step 3:** `./gradlew.bat compileJava` → SUCCESSFUL.
- [ ] **Step 4:** Commit
```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/bike/service/BikeCommandService.java
git commit -m "$(cat <<'EOF'
feat(audit): 차량 생성/수정/삭제 감사 기록

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 라이더 CRUD 감사 (RiderCommandService)

**Files:** Modify `rider/service/RiderCommandService.java`

- [ ] **Step 1:** `AuditLogCommandService` 주입.
- [ ] **Step 2:** 성공 지점에:
  - `create`: `auditLogCommandService.log("RIDER", saved.getId(), "__created__", null, saved.getName());`
  - `update`: `auditLogCommandService.log("RIDER", rider.getId(), "__updated__", null, rider.getName());`
  - `softDelete(id)`: 로드한 rider의 name으로 `auditLogCommandService.log("RIDER", id, "__deleted__", rider.getName(), null);`
  - (`linkAppAccount`/`unlinkAppAccount`는 이번 범위 밖 — 건드리지 않음.)
  (엔티티 변수명/게터는 파일 확인 후 맞춤: `getName()` 등.)
- [ ] **Step 3:** `./gradlew.bat compileJava` → SUCCESSFUL.
- [ ] **Step 4:** Commit
```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/rider/service/RiderCommandService.java
git commit -m "$(cat <<'EOF'
feat(audit): 라이더 생성/수정/삭제 감사 기록

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 매칭 CRUD 감사 (RiderBikeContractCommandService)

**Files:** Modify `contract/service/RiderBikeContractCommandService.java`

- [ ] **Step 1:** `AuditLogCommandService` 주입(생성자에 파라미터 추가).
- [ ] **Step 2:** 성공 지점에(엔티티 id = contract id):
  - `create`: `auditLogCommandService.log("CONTRACT", saved.getId(), "__created__", null, "riderId=" + saved.getRiderId() + " bikeId=" + saved.getBikeId());`
  - `update`: `auditLogCommandService.log("CONTRACT", contract.getId(), "__updated__", null, "riderId=" + contract.getRiderId() + " bikeId=" + contract.getBikeId());`
  - `terminate`: `auditLogCommandService.log("CONTRACT", contract.getId(), "__terminated__", "riderId=" + contract.getRiderId() + " bikeId=" + contract.getBikeId(), null);`
  (변수명은 파일 확인. 사람이 읽기 좋게 plate/이름을 넣으려면 bikeRepository/riderRepository 조회가 필요하므로, 최소구현은 위처럼 id 요약으로. 여력되면 plate/name으로 개선.)
- [ ] **Step 3:** `./gradlew.bat compileJava` → SUCCESSFUL.
- [ ] **Step 4:** Commit
```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/contract/service/RiderBikeContractCommandService.java
git commit -m "$(cat <<'EOF'
feat(audit): 매칭 생성/수정/종료 감사 기록

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 배차 CRUD 감사 (DispatchOrderCommandService)

**Files:** Modify `dispatch/service/DispatchOrderCommandService.java`

- [ ] **Step 1:** 이미 `AuditLogCommandService`를 쓰고 있으면(완료 감사) 그 필드 재사용, 없으면 주입 확인.
- [ ] **Step 2:** 성공 지점에(entityType `DISPATCH_ORDER`, 완료(`complete`)의 기존 status 감사는 유지):
  - `create`: `auditLogCommandService.log("DISPATCH_ORDER", order.getId(), "__created__", null, request.customerName());` (생성 결과 엔티티/식별자는 파일 확인 — 고객명 또는 주소 요약).
  - `cancel(id)`: `auditLogCommandService.log("DISPATCH_ORDER", id, "__deleted__", null, null);` (취소; 식별자 있으면 oldValue에).
  - `appendForBike`/`appendForBatch`는 벌크 경로라 이번 범위 밖(원하면 후속) — 건드리지 않음.
- [ ] **Step 3:** `./gradlew.bat compileJava` → SUCCESSFUL.
- [ ] **Step 4:** Commit
```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/dispatch/service/DispatchOrderCommandService.java
git commit -m "$(cat <<'EOF'
feat(audit): 배차 생성/취소 감사 기록

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 프론트 — 작업 로그 조회 UI

**Files:** Modify `development/frontend/lib/services/service-ops-api.ts`; Create `development/frontend/components/management/AuditLogManagementPanel.tsx`; Modify `development/frontend/app/management/resources/page.tsx`

- [ ] **Step 1: API 클라이언트** — `listAuditLogs`를 옵션 객체로 확장. 현재 `listAuditLogs(entityId?: string)`(타입 정의 ~1333, 구현 ~2021). 시그니처를 아래로 바꾸고 기존 호출부(있으면) 갱신:
```ts
// 타입:
listAuditLogs: (opts?: { entityId?: string; entityType?: string; limit?: number }) => Promise<ServiceOpsAuditLog[]>;
// 구현:
listAuditLogs: (opts) =>
  request<ServiceOpsAuditLog[]>("/audit-logs", { method: "GET" },
    opts && (opts.entityId || opts.entityType || opts.limit)
      ? { ...(opts.entityId ? { entityId: opts.entityId } : {}),
          ...(opts.entityType ? { entityType: opts.entityType } : {}),
          ...(opts.limit ? { limit: String(opts.limit) } : {}) }
      : undefined),
```
`ServiceOpsAuditLog` 타입에 `actor?: string | null` 있는지 확인, 없으면 추가(백엔드 ReadResponse에 `actor` 존재). (기존 `listAuditLogs(entityId)` 호출부가 있으면 `listAuditLogs({ entityId })`로 수정.)

- [ ] **Step 2: 패널 컴포넌트** — `AuditLogManagementPanel.tsx` 신규(클라이언트 컴포넌트). entityType 필터 칩 + 표. 로딩/에러 처리. `listAuditLogsAction`이 없으면 서버액션 추가 대신 기존 관리 패널 패턴(직접 클라이언트 호출 서버액션) 따름 — `app/management/` 하위 actions에 `listAuditLogsAction(entityType?)` 추가(다른 패널의 list 액션 패턴 복제). 표 컬럼: 발생시각(로컬)·작업자(actor ?? "—")·대상(entityType 라벨)·항목(field 라벨)·변경(oldValue → newValue). field 라벨: `__created__`→"생성", `__updated__`→"수정", `__deleted__`→"삭제", `__terminated__`→"종료", else 원문. entityType 라벨: BIKE→차량, RIDER→라이더, CONTRACT→매칭, DISPATCH_ORDER→배차, BIKE_OPERATION_STATUS→운영상태, MAINTENANCE→정비, RIDER_INSURANCE→보험, else 원문. 필터 칩: 전체 + 위 유형들. (구현자는 `VehiclesManagementPanel.tsx`의 로드/표 패턴을 참고해 동일 스타일 사용.)

- [ ] **Step 3: 페이지 배선** — `app/management/resources/page.tsx`의 `SECTIONS`에 `{ id: "mgmt-logs", label: "작업 로그" }` 추가하고, JSX 끝에 `<section id="mgmt-logs"><AuditLogManagementPanel /></section>` 추가 + import.

- [ ] **Step 4: 검증**
```bash
cd development/frontend && ([ -d node_modules ] || npm install) && npm run typecheck && npm run lint
```
에러 없음 기대.

- [ ] **Step 5:** Commit
```bash
cd development/frontend && git add lib/services/service-ops-api.ts components/management/AuditLogManagementPanel.tsx app/management/resources/page.tsx app/management/
git commit -m "$(cat <<'EOF'
feat(audit): 관리 화면 작업 로그 조회 패널 + entityType 필터

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 테스트 + 최종 검증 + PR

**Files:** Modify `development/backend/src/test/java/com/thundercrew/opsapi/AuditLogApiContractTests.java` (+ 필요 시 CRUD 계약테스트)

- [ ] **Step 1:** `AuditLogApiContractTests`에 (a) 인증 상태 POST 후 GET에서 `actor`가 로그인 id로 채워지는지, (b) `?entityType=` 필터 + `?limit=` 동작 검증 추가. (구현자는 기존 로그인 헬퍼로 인증 토큰 획득 후 요청.)
- [ ] **Step 2:** `cd development/backend && ./gradlew.bat compileJava compileTestJava` → SUCCESSFUL. (Docker 있으면 `./gradlew.bat test --tests "com.thundercrew.opsapi.AuditLogApiContractTests"`; 없으면 미실행 명시.)
- [ ] **Step 3:** 프론트 `npm run typecheck && npm run lint`.
- [ ] **Step 4:** push + PR(→dev)
```bash
git push -u origin cc-audit-log-viewer
gh pr create --base dev --head cc-audit-log-viewer --title "작업 로그 열람 + actor·핵심 CRUD 감사" --body "$(cat <<'EOF'
## Summary
- 감사 기록에 actor(로그인 관리자, SecurityContext) 자동 캡처 — 기존 프론트 감사도 actor 남음.
- 차량·라이더·매칭·배차 핵심 CRUD에 서버사이드 이벤트 감사 추가(생성/수정/삭제·종료).
- 읽기 API에 entityType 필터 + limit(기본 200).
- 관리 `/management/resources`에 "작업 로그" 조회 패널(발생시각·작업자·대상·항목·변경 + 유형 필터).
- audit_logs 스키마 변경 없음.

## Test Plan
- [x] 백엔드 compileJava + compileTestJava
- [ ] AuditLogApiContractTests(actor·필터) — Docker 환경에서 실행 필요(로컬 미실행)
- [x] 프론트 typecheck/lint
- [ ] 배포 후 QA: CRUD 수행 → 작업 로그에 actor·항목 표시 확인
EOF
)"
```
- [ ] **Step 5:** finishing-a-development-branch 스킬로 마무리.

---

## 자기검토 노트
- **스펙 커버리지:** actor(§3→T1)·핵심CRUD(§4→T3-6)·읽기API(§5→T2)·뷰어UI(§6→T7)·테스트(§7→T8). 전부 매핑.
- **타입 정합:** `AuditLogCommandService.log(String,UUID,String,String,String)` — T3-6 호출부 일치. `listAuditLogs(opts?)` — T7 패널 사용 일치. field sentinel 문자열 T1 규약과 T3-6/T7 라벨 매핑 일치.
- **독립성:** 각 태스크 additive·컴파일 green 독립 → subagent-driven 적합.
- **미검증:** 계약테스트는 Docker 필요(로컬 미실행) — CI 없음, 배포 후 QA로 보완.
