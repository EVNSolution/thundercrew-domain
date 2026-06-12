# 단일 배차 / 순차 배차 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배차 업로드를 단일 배차(순번 없음=현행)와 순차 배차(순번 컬럼)로 분리. 업무 관리 = 콜/단일/순차/왕복 4패널. `DispatchOrder.sequence` 재사용 → 마이그레이션 없음.

**Architecture:** 기존 single 배차 벌크는 그대로, `-sequential` 변형(엔드포인트/서비스/패널) 추가. 순번 = 차량별 정렬 키(저장은 append). 단일 라벨 정정(순차 배차→단일 배차).

**Tech Stack:** Spring Boot (Java 21), POI, Next.js, TS. 브랜치 `cc-sequential-dispatch`(생성됨). Bash 절대경로 cd. 백엔드 게이트 `compileJava compileTestJava`(계약테스트 Docker→CI). 프론트 `typecheck && lint && build`.

**현재 핵심:**
- 백엔드 엔드포인트(`DispatchOrderCommandController`, `/api/v1/dispatch-orders`): `POST /bulk-preview`→`bulkService.preview`, `POST /bulk-apply`→`bulkService.apply`.
- `evaluateRow(cols,rowNum)`: cols[0]차량번호 [1]고객명 [2]연락처 [3]배송지주소. `cell(cols,idx)` 안전 접근.
- `apply`: 행마다 `commandService.appendForBike(bikeId,name,phone,addr,lat,lng)`(순번 자동).
- 프론트: client `previewDispatchOrders(file)`/`applyDispatchOrders(rows)`; actions `previewDispatchAction`/`applyDispatchAction`; `DispatchPanel`.

---

### Task 1: 백엔드 순차 변형 (DTO + 서비스 + 엔드포인트 + 테스트)

**Files:**
- Modify: `.../dispatch/dto/DispatchBulkPreviewRow.java`
- Modify: `.../dispatch/dto/DispatchBulkApplyRow.java`
- Modify: `.../dispatch/service/DispatchOrderBulkService.java`
- Modify: `.../dispatch/controller/DispatchOrderCommandController.java`
- Test: dispatch bulk 계약 테스트

- [ ] **Step 1: Preview DTO에 순번**

`DispatchBulkPreviewRow.java`: 레코드에 `Integer sequence`(null 허용) 추가. 기존 두 팩토리(`newRow`/`error`)는 `null`을 넘기게 수정하고, 순차용 팩토리 추가:
```java
public record DispatchBulkPreviewRow(
        int rowNumber, String plateNumber, UUID bikeId,
        String customerName, String customerPhone, String address,
        Integer sequence,
        BulkRowStatus status, String message
) {
    public static DispatchBulkPreviewRow newRow(int rowNumber, String plateNumber, UUID bikeId,
                                                String customerName, String customerPhone, String address) {
        return new DispatchBulkPreviewRow(rowNumber, plateNumber, bikeId,
                customerName, customerPhone, address, null, BulkRowStatus.NEW, null);
    }
    public static DispatchBulkPreviewRow error(int rowNumber, String plateNumber, UUID bikeId,
                                               String customerName, String customerPhone, String address, String message) {
        return new DispatchBulkPreviewRow(rowNumber, plateNumber, bikeId,
                customerName, customerPhone, address, null, BulkRowStatus.ERROR, message);
    }
    public static DispatchBulkPreviewRow newRowSeq(int rowNumber, String plateNumber, UUID bikeId,
                                                   String customerName, String customerPhone, String address, Integer sequence) {
        return new DispatchBulkPreviewRow(rowNumber, plateNumber, bikeId,
                customerName, customerPhone, address, sequence, BulkRowStatus.NEW, null);
    }
    public static DispatchBulkPreviewRow errorSeq(int rowNumber, String plateNumber, UUID bikeId,
                                                  String customerName, String customerPhone, String address, Integer sequence, String message) {
        return new DispatchBulkPreviewRow(rowNumber, plateNumber, bikeId,
                customerName, customerPhone, address, sequence, BulkRowStatus.ERROR, message);
    }
}
```

- [ ] **Step 2: Apply DTO에 순번**

`DispatchBulkApplyRow.java`: 레코드에 `Long sequence`(nullable, 검증 애너테이션 없음) 추가 — 마지막 컴포넌트. 단일 경로는 null, 순차 경로는 값. (`@JsonIgnoreProperties(ignoreUnknown=true)` 유지.)
```java
public record DispatchBulkApplyRow(
        @NotNull UUID bikeId,
        @NotBlank @Size(max = 255) String customerName,
        @NotBlank @Size(max = 255) String customerPhone,
        @NotBlank @Size(max = 2000) String address,
        @DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude,
        Long sequence
) {}
```

- [ ] **Step 3: 서비스 — previewSequential + applySequential**

`DispatchOrderBulkService.java`에 추가(기존 `preview`/`apply`/`evaluateRow`/`cell` 무변경):
```java
    /** 순차 배차 미리보기. 컬럼: [0]차량번호 [1]고객명 [2]연락처 [3]배송지주소 [4]순번. */
    public DispatchBulkPreviewResponse previewSequential(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        List<DispatchBulkPreviewRow> results = new ArrayList<>();
        int rowNum = DATA_START_ROW + 1;
        for (List<String> cols : rows) {
            results.add(evaluateSequentialRow(cols, rowNum++));
        }
        return DispatchBulkPreviewResponse.of(results);
    }

    /** 차량별로 순번 오름차순 정렬 후 큐에 append (순번=정렬 키, 저장 sequence 는 append 연속값). */
    @Transactional
    public BulkApplyResponse applySequential(DispatchBulkApplyRequest request) {
        long applied = 0;
        List<DispatchBulkApplyRow> ordered = request.rows().stream()
                .sorted(java.util.Comparator
                        .comparing(DispatchBulkApplyRow::bikeId)
                        .thenComparing(r -> r.sequence() == null ? Long.MAX_VALUE : r.sequence()))
                .toList();
        for (DispatchBulkApplyRow row : ordered) {
            commandService.appendForBike(row.bikeId(), row.customerName(), row.customerPhone(),
                    row.address(), row.latitude(), row.longitude());
            applied++;
        }
        return new BulkApplyResponse(applied, 0);
    }

    private DispatchBulkPreviewRow evaluateSequentialRow(List<String> cols, int rowNum) {
        String plate = cell(cols, 0);
        String customerName = cell(cols, 1);
        String customerPhone = cell(cols, 2);
        String address = cell(cols, 3);
        String seqRaw = cell(cols, 4);

        if (plate.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, null, customerName, customerPhone, address, null, "차량번호 없음");
        }
        Optional<Bike> bike = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plate);
        if (bike.isEmpty()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, null, customerName, customerPhone, address, null, "차량 없음: " + plate);
        }
        UUID bikeId = bike.get().getId();
        if (customerName.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null, "고객명 없음");
        }
        if (customerPhone.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null, "연락처 없음");
        }
        if (address.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null, "배송지주소 없음");
        }
        Integer sequence;
        try {
            sequence = Integer.parseInt(seqRaw.trim());
        } catch (NumberFormatException ex) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null,
                    seqRaw.isBlank() ? "순번 없음" : "순번 형식 오류: " + seqRaw);
        }
        return DispatchBulkPreviewRow.newRowSeq(rowNum, plate, bikeId, customerName, customerPhone, address, sequence);
    }
```
(import 필요: `java.util.Comparator`는 정규화 위해 상단 import 추가 권장. `appendForBike` 시그니처 = (bikeId,name,phone,address,lat,lng) — READ로 재확인.)

- [ ] **Step 4: 컨트롤러 — 순차 엔드포인트**

`DispatchOrderCommandController.java`: 기존 `/bulk-preview`·`/bulk-apply` 아래에 추가:
```java
    @PostMapping("/bulk-preview-sequential")
    DispatchBulkPreviewResponse bulkPreviewSequential(@RequestPart("file") MultipartFile file) throws IOException {
        return dispatchOrderBulkService.previewSequential(file.getInputStream());
    }

    @PostMapping("/bulk-apply-sequential")
    BulkApplyResponse bulkApplySequential(@Valid @RequestBody DispatchBulkApplyRequest request) {
        return dispatchOrderBulkService.applySequential(request);
    }
```
(`/api/v1/dispatch-orders`는 arch allow-list 기존 커버. import 필요 없으면 그대로.)

- [ ] **Step 5: 컴파일 + 계약 테스트**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
```
기존 dispatch bulk 계약 테스트 찾기: `grep -rln "bulk-preview\|bulk-apply\|DispatchBulkApply\|previewSequential" src/test/java`. 순차 테스트 추가: (a) 순차 preview가 순번 파싱(정상→NEW+sequence, 순번 누락/비정수→ERROR), (b) applySequential이 한 차량의 행을 순번 순서(예: 입력 순번 3,1,2 → 큐 1,2,3)로 큐 생성 — 차량 큐 조회로 검증. 단일 경로 테스트 회귀 없음(DispatchBulkApplyRow에 sequence 추가돼도 기존 테스트의 행 생성이 컴파일되게 — 기존 테스트가 positional 생성이면 sequence 인자 추가 필요, named/builder면 무변경; READ 후 맞출 것).

- [ ] **Step 6: compileJava compileTestJava + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src && git commit -m "feat(dispatch): sequential bulk variant (순번 column) + endpoints"
```
Co-Authored-By 라인 포함.

---

### Task 2: 프론트 클라이언트 + 서버액션 + 타입

**Files:**
- Modify: `development/front-admin-web/lib/services/service-ops-api.ts`
- Modify: `development/front-admin-web/app/dispatch/actions.ts`

- [ ] **Step 1: 클라이언트 타입 + 메서드**

`service-ops-api.ts`:
- `DispatchBulkApplyRow`(TS, 라인 ~1117) 에 `sequence?: number` 추가.
- `DispatchBulkPreviewResponse`의 row 타입(또는 해당 row 타입)에 `sequence?: number | null` 추가(미리보기 순번 표시용). 실제 타입명 grep으로 확인.
- 클라이언트 인터페이스(라인 ~1272)와 구현에 추가:
```ts
  previewSequentialDispatchOrders: (file: File | FormData) => Promise<DispatchBulkPreviewResponse>;
  applySequentialDispatchOrders: (rows: DispatchBulkApplyRow[]) => Promise<BulkApplyResponse>;
```
구현은 기존 `previewDispatchOrders`/`applyDispatchOrders` 복제 + 경로만 `-sequential`:
```ts
    previewSequentialDispatchOrders: (file) => {
      const form = file instanceof FormData ? file : toFileForm(file);   // 기존 preview 구현의 form 구성 그대로
      return request<DispatchBulkPreviewResponse>("/dispatch-orders/bulk-preview-sequential", { method: "POST", body: form });
    },
    applySequentialDispatchOrders: (rows) =>
      request<BulkApplyResponse>("/dispatch-orders/bulk-apply-sequential", { method: "POST", body: JSON.stringify({ rows }) ... }),
```
(기존 `previewDispatchOrders`/`applyDispatchOrders` 구현을 READ해서 form/headers/JSON 직렬화 방식 그대로 복제 — 경로만 변경.)

- [ ] **Step 2: 서버액션**

`app/dispatch/actions.ts`:
- `DispatchPreviewRow` 타입에 `sequence?: number | null` 추가(미리보기 순번 노출용).
- `previewSequentialDispatchAction(formData)`: `previewDispatchAction` 복제, `client.previewDispatchOrders` → `client.previewSequentialDispatchOrders`. 지오코딩·summary 로직 동일.
- `applySequentialDispatchAction(rows)`: `applyDispatchAction` 복제, `client.applyDispatchOrders` → `client.applySequentialDispatchOrders`. `revalidatePath("/management/operations")`, `("/")`.

- [ ] **Step 3: typecheck + lint + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/lib/services/service-ops-api.ts development/front-admin-web/app/dispatch/actions.ts && git commit -m "feat(dispatch): sequential bulk client methods + server actions"
```
Co-Authored-By 라인 포함.

---

### Task 3: 순차 패널 + 단일 라벨 정정 + operations 4패널

**Files:**
- Create: `development/front-admin-web/components/management/SequentialDispatchPanel.tsx`
- Modify: `development/front-admin-web/components/management/DispatchPanel.tsx`
- Modify: `development/front-admin-web/app/management/operations/page.tsx`

- [ ] **Step 1: SequentialDispatchPanel 신규**

`DispatchPanel.tsx`를 READ해서 그대로 복제하되:
- 컴포넌트명 `SequentialDispatchPanel`.
- `previewDispatchAction`/`applyDispatchAction` → `previewSequentialDispatchAction`/`applySequentialDispatchAction` import·호출.
- apply rows 매핑 시 `sequence: row.sequence` 포함(미리보기 행의 순번을 apply row로 전달).
- 제목 `mgmt-panel-title` = "순차 배차", 미리보기 제목 "순차 배차 업로드 미리보기".
- 미리보기 테이블에 **순번 컬럼** 추가(`<th>순번</th>` + `row.sequence`). 안내 문구에 "엑셀에 순번 컬럼 포함(차량별 방문 순서)".
- 차량 큐 안내 테이블 헤더(차량/고객/연락처/배송지/순번)는 DispatchPanel과 동일 유지.

- [ ] **Step 2: DispatchPanel 단일 라벨 정정**

`DispatchPanel.tsx`: `mgmt-panel-title` "순차 배차" → **"단일 배차"**, 미리보기 "순차 배차 업로드 미리보기" → **"단일 배차 업로드 미리보기"**. (동작·액션 무변경.)

- [ ] **Step 3: operations 페이지 4섹션**

`app/management/operations/page.tsx`:
- import에 `SequentialDispatchPanel` 추가.
- `SECTIONS` = 4개:
```tsx
const SECTIONS = [
  { id: "mgmt-baemin", label: "콜 배차" },
  { id: "mgmt-dispatch", label: "단일 배차" },
  { id: "mgmt-sequential", label: "순차 배차" },
  { id: "mgmt-stroller", label: "왕복 배차" }
];
```
- `<section>` 렌더에 순차 섹션 추가(단일 다음):
```tsx
      <section id="mgmt-sequential" className="management-anchor">
        <SequentialDispatchPanel exportUrl="/api/management/dispatch/export" />
      </section>
```
(콜=BaeminCallPanel, 단일=DispatchPanel, 순차=SequentialDispatchPanel, 왕복=StrollerRoundPanel 순. exportUrl은 DispatchPanel과 동일 재사용 — 순차도 같은 export면 그대로, 아니면 SequentialDispatchPanel이 export 버튼 없이 업로드만 두어도 됨. DispatchPanel 구조 따라 맞출 것.)

- [ ] **Step 4: typecheck + lint + build + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/management/SequentialDispatchPanel.tsx development/front-admin-web/components/management/DispatchPanel.tsx development/front-admin-web/app/management/operations/page.tsx && git commit -m "feat(mgmt): sequential dispatch panel + 단일 라벨 정정 + operations 4 sections"
```
Co-Authored-By 라인 포함.

---

### Task 4: 최종 검증 + PR

- [ ] **Step 1: 풀 검증**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain && (git diff dev --name-only | grep -i "db/migration" && echo MIGRATION || echo "no migration")
```
Expected: 백엔드/프론트 통과, 마이그레이션 0, operations에 4섹션.

- [ ] **Step 2: PR (→ dev)**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git push -u origin cc-sequential-dispatch && gh pr create --base dev --title "단일/순차 배차 분리 (순번 컬럼)" --body "$(cat <<'EOF'
## Summary
- 배차 업로드를 단일(순번 없음=현행)/순차(순번 컬럼)로 분리. 업무 관리 = 콜/단일/순차/왕복 4패널
- 백엔드: `bulk-preview-sequential`/`bulk-apply-sequential`(5컬럼 순번 파싱, 차량별 순번 정렬 append). DispatchBulkApplyRow/PreviewRow에 sequence
- 프론트: SequentialDispatchPanel(순번 컬럼) + 순차 클라이언트/액션. DispatchPanel "순차 배차"→"단일 배차" 정정
- 순번 = 차량별 정렬 키(저장 sequence 는 append). DispatchOrder.sequence 재사용 → **마이그레이션 없음**, 단일 경로 무변경

## Test Plan
- [x] 백엔드 compileJava + compileTestJava, 프론트 typecheck+lint+build, 마이그레이션 0
- [ ] 계약 테스트(CI): 순차 preview 순번 파싱, apply 큐 순번 정렬
- [ ] 프로덕션 QA: 업무 관리 4패널, 순차 엑셀(순번) 업로드→미리보기 순번→적용 큐 순번 순, 단일 현행

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec 커버리지:** 백엔드 순차(DTO/서비스/엔드포인트/테스트, T1), 프론트 클라이언트·액션(T2), 순차 패널+단일 정정+4섹션(T3), 검증·PR(T4). ✓ 마이그레이션 없음, 단일 경로 무변경. ✓

**2. 플레이스홀더 스캔:** 백엔드 신규 메서드/엔드포인트/DTO 완전 코드. 프론트는 "DispatchPanel/기존 client 메서드 READ 후 복제 + 경로/액션/제목/순번컬럼만 변경" — 기존 코드 의존이라 구체 지시. exportUrl·form 구성은 기존 구현 따름.

**3. 타입/이름 일관성:** 백엔드 `previewSequential`/`applySequential` ↔ 엔드포인트 `-sequential` ↔ 프론트 client `previewSequentialDispatchOrders`/`applySequentialDispatchOrders` ↔ 액션 `previewSequentialDispatchAction`/`applySequentialDispatchAction`. `sequence` 필드 백엔드(Long/Integer)·프론트(number) 일관. 앵커 id: 단일=mgmt-dispatch(기존), 순차=mgmt-sequential(신규), 콜=mgmt-baemin, 왕복=mgmt-stroller.

**구현자 주의:** `DispatchBulkApplyRow`에 sequence 추가 시 기존 단일 테스트/프론트가 positional 생성이면 인자 추가 필요(READ 후 확인) — named/object면 무변경. 단일 경로의 `apply`(append)·preview(4컬럼)·DispatchPanel 동작은 절대 바꾸지 말 것(라벨만). 순번은 정렬 키일 뿐 DispatchOrder.sequence에 raw 저장 안 함.
