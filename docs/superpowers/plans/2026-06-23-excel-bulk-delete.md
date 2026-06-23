# 엑셀 일괄 삭제 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 라이더/차량/매칭 엑셀 일괄 업로드에 `관리구분` 열을 추가해 행 단위 삭제(매칭은 종료)를 지원한다.

**Architecture:** 공용 `BulkRowStatus.DELETE` + `BulkRowResult.delete()` 추가, 각 BulkService의 `preview()`/`apply()`에 삭제 분기 추가(기존 CommandService.softDelete/terminate 재사용, 활성참조 차단), 템플릿에 헤더 열 추가, 프론트 모달에 DELETE 표시.

**Tech Stack:** Spring Boot/Java 21, Apache POI, Next.js/TS.

**Base dir:** `C:/Users/user/repositories/clever/thundercrew-domain`
- 백엔드 빌드: `cd development/service-ops-api && ./gradlew compileJava compileTestJava test --tests "*BulkServiceTest"`
- 프론트 빌드: `cd development/front-admin-web && npm run typecheck && npm run lint && npm run build`

---

### Task 1: 공용 bulk 인프라 — DELETE 상태

**Files:**
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/common/bulk/BulkRowStatus.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/common/bulk/BulkRowResult.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/common/bulk/BulkSummary.java`

- [ ] **Step 1: BulkRowStatus에 DELETE 추가**

`BulkRowStatus` enum에 `DELETE` 값 추가 (기존: `UNCHANGED, UPDATE, NEW, ERROR`).

- [ ] **Step 2: BulkRowResult.delete 팩토리 추가**

```java
public static BulkRowResult delete(int row, String key) {
    return new BulkRowResult(row, BulkRowStatus.DELETE, key, List.of(), null);
}
```

- [ ] **Step 3: BulkSummary에 delete 카운트 추가**

```java
public record BulkSummary(long unchanged, long update, @JsonProperty("new") long newRows,
                          long delete, long error, long total) {
    public static BulkSummary of(List<BulkRowResult> rows) {
        long unchanged = rows.stream().filter(r -> r.status() == BulkRowStatus.UNCHANGED).count();
        long update    = rows.stream().filter(r -> r.status() == BulkRowStatus.UPDATE).count();
        long newRows   = rows.stream().filter(r -> r.status() == BulkRowStatus.NEW).count();
        long delete    = rows.stream().filter(r -> r.status() == BulkRowStatus.DELETE).count();
        long error     = rows.stream().filter(r -> r.status() == BulkRowStatus.ERROR).count();
        return new BulkSummary(unchanged, update, newRows, delete, rows.size() == 0 ? 0 : rows.size());
    }
}
```
(total = rows.size())

- [ ] **Step 4: 컴파일**

Run: `cd development/service-ops-api && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: 커밋**

```bash
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/common/bulk
git commit -m "feat: add DELETE status to bulk infra"
```

---

### Task 2: 공용 — 관리구분 열 파싱 헬퍼

**Files:**
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/common/bulk/BulkActionColumn.java`

- [ ] **Step 1: 헬퍼 작성**

```java
package com.thundercrew.opsapi.common.bulk;

/** 관리구분(삭제 표시) 열 해석 헬퍼. */
public final class BulkActionColumn {
    private BulkActionColumn() {}

    public static final String DELETE_TOKEN = "삭제";

    /** 빈 값/미입력 = upsert(false), "삭제" = 삭제(true). */
    public static boolean isDelete(String raw) {
        return raw != null && DELETE_TOKEN.equals(raw.trim());
    }

    /** 빈 값도 아니고 "삭제"도 아닌 잘못된 값인지. */
    public static boolean isInvalid(String raw) {
        if (raw == null) return false;
        String t = raw.trim();
        return !t.isEmpty() && !DELETE_TOKEN.equals(t);
    }
}
```

- [ ] **Step 2: 컴파일 + 커밋**

Run: `cd development/service-ops-api && ./gradlew compileJava`
```bash
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/common/bulk/BulkActionColumn.java
git commit -m "feat: add BulkActionColumn helper"
```

---

### Task 3: RiderBulkService 삭제 분기 + 테스트

**Files:**
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/rider/service/RiderBulkService.java`
- Modify: rider bulk service 테스트 파일 (기존 `*BulkServiceTest` 위치 확인 후)

관리구분 = col 4.

- [ ] **Step 1: 의존성 주입** — 생성자에 `RiderCommandService riderCommandService` 추가.

- [ ] **Step 2: apply() 삭제 분기**

각 행 처리 맨 앞에서:
```java
String action = cell(cols, 4);
if (BulkActionColumn.isInvalid(action)) { skipped++; continue; }
if (BulkActionColumn.isDelete(action)) {
    String phone = PhoneNumbers.format(cell(cols, 1));
    Optional<Rider> target = (phone == null || phone.isBlank())
            ? Optional.empty()
            : riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
    if (target.isEmpty()) { skipped++; continue; }
    try {
        riderCommandService.softDelete(target.get().getId());
        applied++;
    } catch (Exception e) {
        skipped++;
    }
    continue;
}
// ... 기존 upsert 로직 ...
```

- [ ] **Step 3: evaluateRow() 삭제 분기 (preview)**

```java
String action = cell(cols, 4);
if (BulkActionColumn.isInvalid(action)) {
    return BulkRowResult.error(rowNum, cell(cols, 1), "관리구분 값 오류: " + action.trim());
}
if (BulkActionColumn.isDelete(action)) {
    String phone = cell(cols, 1);
    Optional<Rider> target = riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
    if (target.isEmpty()) {
        return BulkRowResult.error(rowNum, phone, "삭제 대상 없음");
    }
    UUID id = target.get().getId();
    if (riderRepository.existsActiveContractReference(id)
            || riderRepository.existsActiveInsuranceReference(id)) {
        return BulkRowResult.error(rowNum, phone, "삭제불가: 활성 매칭/보험 존재");
    }
    return BulkRowResult.delete(rowNum, phone);
}
// ... 기존 평가 ...
```
(주의: `existsActiveContractReference` / `existsActiveInsuranceReference` 시그니처는 RiderRepository에서 확인. preview 조회 phone은 정규화 없이 원본으로 비교하던 기존 동작과 동일 — 기존 evaluateRow가 phone 원본을 쓰면 동일하게.)

- [ ] **Step 4: export() — 관리구분 열 빈값 추가**

export rows 매핑에 마지막 빈 컬럼 추가: `List.of(name, phone, trainingLabel, team, "")`.

- [ ] **Step 5: 테스트 추가** (기존 RiderBulkServiceTest 패턴 따라)
  - 관리구분="삭제" + 대상 존재 + 참조 없음 → preview DELETE, apply 후 rider.deletedAt != null.
  - 관리구분="삭제" + 대상 없음 → ERROR.
  - 관리구분="삭제" + 활성 매칭 존재 → preview ERROR("삭제불가"), apply skipped.
  - 관리구분="" → 기존 upsert 회귀.
  - 관리구분="xyz" → ERROR.

- [ ] **Step 6: 빌드 + 커밋**

Run: `cd development/service-ops-api && ./gradlew compileJava compileTestJava test --tests "*RiderBulkServiceTest"`
```bash
git commit -am "feat: rider bulk delete via 관리구분 column"
```

---

### Task 4: BikeBulkService 삭제 분기 + 테스트

**Files:**
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/service/BikeBulkService.java`
- Modify: bike bulk service 테스트

관리구분 = col 5. 패턴은 Task 3과 동일.

- [ ] **Step 1: 생성자에 `BikeCommandService bikeCommandService` 주입.**

- [ ] **Step 2: apply() 삭제 분기** — `cell(cols, 5)` 읽고, 조회 키 = 차량번호(`findByPlateNumberAndDeletedAtIsNull`), `bikeCommandService.softDelete(id)` 호출, 예외 catch → skipped.

- [ ] **Step 3: evaluateRow() 삭제 분기** — 대상 없음 → error("삭제 대상 없음"); 활성 참조(`existsActiveContractReference`/`existsActiveEquipmentReference`/`existsActiveDeviceInstallationReference`) → error("삭제불가: 활성 매칭/장비/단말 존재"); 그 외 delete().

- [ ] **Step 4: export()** — 매핑 끝에 빈 컬럼 `""` 추가.

- [ ] **Step 5: 테스트** — Task 3과 동일 매트릭스(대상존재/없음/활성참조/빈값/잘못된값).

- [ ] **Step 6: 빌드 + 커밋**

Run: `./gradlew compileJava compileTestJava test --tests "*BikeBulkServiceTest"`
```bash
git commit -am "feat: bike bulk delete via 관리구분 column"
```

---

### Task 5: ContractBulkService 삭제(=종료) 분기 + 테스트

**Files:**
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/contract/service/ContractBulkService.java`
- Modify: contract bulk service 테스트

관리구분 = col 9. 삭제 = terminate.

- [ ] **Step 1: 의존성** — `RiderBikeContractCommandService` (terminate 호출용) + `Clock` 주입 여부 확인. 종료 시각은 주입된 `Clock` 또는 `Instant.now()`. 기존 서비스 패턴(다른 CommandService가 Clock 주입받음)을 따른다.

- [ ] **Step 2: 활성 계약 조회 경로 확인** — 차량번호+연락처로 활성(미종료, deletedAt null) 계약을 찾는 방법. 기존 `evaluateRow`/`apply`에서 contract를 composite key로 조회하던 로직 재사용(`contractRepository`의 해당 finder). 그 finder가 종료된 계약도 포함하면, 미종료 조건 필터 추가.

- [ ] **Step 3: apply() 삭제 분기** — `cell(cols, 9)` 삭제이면: bike/rider 조회 → 활성 계약 조회 → 있으면 `contractCommandService.terminate(contractId, new RiderBikeContractTerminateRequest(now, RiderBikeContractTerminatedReason.OPERATOR_TERMINATE))`, 예외 catch → skipped. (terminatedReason enum 정확한 타입/값은 RiderBikeContractTerminateRequest 정의에서 확인.)

- [ ] **Step 4: evaluateRow() 삭제 분기** — 활성 계약 없음 → error("종료 대상 계약 없음"); 있으면 delete(row, "plate / phone").

- [ ] **Step 5: export()** — 9컬럼 뒤에 관리구분 빈 컬럼 추가(총 10컬럼). DATA_START_ROW=3 유지.

- [ ] **Step 6: 테스트** — 관리구분="삭제" + 활성계약 존재 → preview DELETE, apply 후 contract.terminatedAt != null; 활성계약 없음 → ERROR; 빈값 → 기존 upsert 회귀.

- [ ] **Step 7: 빌드 + 커밋**

Run: `./gradlew compileJava compileTestJava test --tests "*ContractBulkServiceTest"`
```bash
git commit -am "feat: contract bulk delete(=terminate) via 관리구분 column"
```

---

### Task 6: 엑셀 템플릿에 관리구분 헤더 열 추가

**Files:**
- Modify (binary): `development/service-ops-api/src/main/resources/templates/excel/riders-template.xlsx`
- Modify (binary): `.../vehicles-template.xlsx`
- Modify (binary): `.../matching-template.xlsx`
- Create (temporary util): 일회성 POI 스크립트 또는 JUnit 테스트로 헤더 추가 후 삭제

- [ ] **Step 1: 일회성 POI 유틸 작성** — 각 템플릿을 `WorkbookFactory`로 열어, 헤더 행(riders/vehicles=row index 1, matching=row index 2)의 마지막 데이터 컬럼 다음 셀에 `관리구분 (삭제 시 '삭제' 입력)` 값을 쓰고, 같은 파일 경로로 저장. (헤더 행 인덱스와 마지막 컬럼은 각 템플릿 실제 구조 확인 후.)

```java
// 예: 리더 템플릿 헤더 row(index 1)에 col 4 추가
try (Workbook wb = WorkbookFactory.create(new FileInputStream(path))) {
    Row header = wb.getSheetAt(0).getRow(1);
    header.createCell(4).setCellValue("관리구분 (삭제 시 '삭제' 입력)");
    try (FileOutputStream out = new FileOutputStream(path)) { wb.write(out); }
}
```

- [ ] **Step 2: 유틸 실행** — gradle test 또는 main으로 1회 실행. riders=col4, vehicles=col5, matching=col9.

- [ ] **Step 3: 유틸 파일 삭제** — 일회성이므로 제거(템플릿 바이너리만 커밋).

- [ ] **Step 4: 커밋**

```bash
git add development/service-ops-api/src/main/resources/templates/excel
git commit -m "feat: add 관리구분 header column to bulk templates"
```

---

### Task 7: 프론트엔드 — DELETE 표시

**Files:**
- Modify: `development/front-admin-web/lib/services/service-ops-api.ts` (BulkRowStatus, BulkSummary 타입)
- Modify: `development/front-admin-web/components/management/BulkPreviewModal.tsx`

- [ ] **Step 1: 타입** — `BulkRowStatus = 'UNCHANGED' | 'UPDATE' | 'NEW' | 'DELETE' | 'ERROR'`; `BulkPreviewResponse.summary` 에 `delete: number` 추가.

- [ ] **Step 2: BulkPreviewModal** — 상태 라벨 매핑에 `DELETE → "삭제"` (빨강/주황 계열), 요약 바에 삭제 카운트 표시. 필터는 DELETE 노출(UNCHANGED만 숨김 유지).

- [ ] **Step 3: 빌드**

Run: `cd development/front-admin-web && npm run typecheck && npm run lint && npm run build`
Expected: 통과

- [ ] **Step 4: 커밋**

```bash
git commit -am "feat: show DELETE rows in bulk preview modal"
```

---

### Task 8: 최종 검증 + PR

- [ ] 백엔드 전체: `./gradlew compileJava compileTestJava` + ArchUnit (issue_70 pre-red 무시).
- [ ] 프론트 전체: `npm run typecheck && npm run lint && npm run build`.
- [ ] PR → dev.

## Self-Review

- 스펙 커버리지: 공용(T1·T2), 라이더(T3)·차량(T4)·매칭(T5), 템플릿(T6), 프론트(T7) — 전부 매핑됨.
- 타입 일관성: `BulkRowResult.delete(int,String)`, `BulkActionColumn.isDelete/isInvalid`, `BulkRowStatus.DELETE` — 태스크 간 시그니처 일치.
- 미확정 실런타임 세부(예: contract 활성계약 finder, terminatedReason enum 타입, 헤더 행 인덱스)는 각 태스크에서 "확인 후" 명시 — 구현자가 해당 파일에서 정확값 확인.
