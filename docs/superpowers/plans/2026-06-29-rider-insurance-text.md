# 라이더 보험 자유 텍스트 전환 + 차량 상세 정리 Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 차량 상세에서 배송/배차/완료내역 섹션을 제거하고, 보험 입력을 카탈로그(드롭다운/체크박스) 대신 **라이더별 자유 텍스트 2칸(기본/추가)** 으로 바꾼다.

**Scope decision (lean):** 백엔드 카탈로그(`insurance_items`/`rider_insurances` 테이블, 엔드포인트, 계약 자동보험발급, 관련 계약/보험 테스트)는 **건드리지 않고 legacy 유지**. 라이더에 텍스트 컬럼 2개를 추가해 UI만 텍스트로 전환. 기존 보험값은 V49 마이그레이션에서 백필. 프론트의 catalog 배선(insuranceOptions 등)은 이번에 안 쓰는 컴포넌트엔 남겨둬도 무방(dead-but-harmless) — 단 보험을 렌더/편집하는 컴포넌트는 텍스트 필드로 전환.

---

## Task 1 (백엔드): riders 텍스트 컬럼 + 백필 + DTO/엔티티/서비스

**Files:**
- Create: `development/service-ops-api/src/main/resources/db/migration/V49__add_rider_insurance_text.sql`
- Modify: `rider/domain/Rider.java`
- Modify: `rider/dto/RiderUpdateRequest.java`
- Modify: `rider/dto/RiderReadResponse.java`
- Modify: `rider/service/RiderCommandService.java`
- Test: `src/test/java/com/thundercrew/opsapi/RiderCommandApiContractTests.java`

**V49 migration:**
```sql
alter table riders add column primary_insurance text;
alter table riders add column addon_insurance text;

update riders r
set primary_insurance = ii.name
from rider_insurances ri
join insurance_items ii on ii.id = ri.insurance_item_id
where ri.rider_id = r.id
  and ri.enabled = true and ri.deleted_at is null
  and ii.category = 'PRIMARY' and ii.deleted_at is null;

update riders r
set addon_insurance = sub.addon_names
from (
  select ri.rider_id, string_agg(ii.name, ', ' order by ii.name) as addon_names
  from rider_insurances ri
  join insurance_items ii on ii.id = ri.insurance_item_id
  where ri.enabled = true and ri.deleted_at is null
    and ii.category = 'ADDON' and ii.deleted_at is null
  group by ri.rider_id
) sub
where sub.rider_id = r.id;
```

**Rider.java:** add fields `private String primaryInsurance;` `private String addonInsurance;` (with `@Column(name="primary_insurance")` / `@Column(name="addon_insurance")`, columnDefinition text/length). Add getters `getPrimaryInsurance()`/`getAddonInsurance()`. Extend `updateBasicProfile(...)` with two extra params `primaryInsurance, addonInsurance` using the SAME null-guard pattern (only overwrite when non-null). Update the `create(...)` factory only if needed (leave create defaults null).

**RiderUpdateRequest.java:** add `String primaryInsurance, String addonInsurance` to the record (no validation annotations beyond optional `@Size`).

**RiderReadResponse.java:** add `String primaryInsurance, String addonInsurance` to the record; in BOTH `from(...)` factories pass `rider.getPrimaryInsurance()`, `rider.getAddonInsurance()`.

**RiderCommandService.update:** pass `request.primaryInsurance()`, `request.addonInsurance()` into the expanded `updateBasicProfile(...)` call.

**Contract test (`RiderCommandApiContractTests`):** in the existing PATCH test, add `primaryInsurance`/`addonInsurance` to the request body and assert they come back in the PATCH + GET responses (`$.primaryInsurance`, `$.addonInsurance`). Follow existing test style (MockMvc + JSON).

**Verify:** `cd development/service-ops-api && ./gradlew compileJava compileTestJava` (BUILD SUCCESSFUL). Contract test needs Docker (Testcontainer) → if unavailable, compile only + note CI runs it.

**Commit:** `feat: add rider primary/addon insurance free-text fields`

---

## Task 2 (프론트 types + actions): 라이더 보험 텍스트 배선

**Files:**
- Modify: `development/front-admin-web/lib/services/service-ops-api.ts`
- Modify: `development/front-admin-web/app/actions.ts`

**service-ops-api.ts:**
- `ServiceOpsRider` (raw): add `primaryInsurance?: string | null; addonInsurance?: string | null;`
- `FrontendRider`: add `primaryInsurance?: string | null; addonInsurance?: string | null;`
- `RiderCreateInput`: add `primaryInsurance?: string | null; addonInsurance?: string | null;` (flows to `RiderUpdateInput = Partial<RiderCreateInput>`)
- Rider mapper (inside `listRiders`/`getRider` impl, ~line 1343+): propagate `primaryInsurance: rider.primaryInsurance ?? null, addonInsurance: rider.addonInsurance ?? null`.
- `updateRider` request type already `RiderUpdateInput` → flows automatically.

**actions.ts:**
- `updateRiderFromOverviewAction` (lines ~275-320): remove the insurance sidecar logic (the `insuranceItemId`/`currentInsuranceId`/`currentInsuranceItemId` reads + `deleteRiderInsurance`/`createRiderInsurance` calls). Instead read `primaryInsurance` + `addonInsurance` from formData and pass into `client.updateRider(riderId, { name, phoneNumber, teamName, areaName, memo, primaryInsurance, addonInsurance })`.
- Add a small `setRiderInsuranceTextAction(riderId, formData)` (or reuse updateRider): reads `primaryInsurance`/`addonInsurance` from formData, calls `client.updateRider(riderId, { primaryInsurance, addonInsurance })`, `revalidatePath("/")`. This replaces `setRiderInsuranceFromVehicleAction`.
- Remove `setRiderInsuranceFromVehicleAction`, `createInsuranceFromOverviewAction`, `deleteInsuranceFromOverviewAction` (after confirming no other usages remain post-Task 3).

**Verify:** `npx tsc --noEmit` (after Task 3, since UI imports change).

**Commit:** `feat: route rider insurance text through updateRider action`

---

## Task 3 (프론트 UI): 섹션 제거 + 보험 텍스트 입력

**Files:**
- Modify: `components/management/VehicleDetailDialog.tsx`
- Modify: `components/management/RidersPanel.tsx`
- Modify: `components/management/RiderDetailDialog.tsx`
- Modify: `components/management/VehiclesPanel.tsx`

**VehicleDetailDialog.tsx:**
- Render block (~233-243): delete `<DeliverySection .../>` and the `<DispatchQueueSection .../>` block.
- Delete the now-unused `DeliverySection` + `DispatchQueueSection` + `CompletedSection` function defs (and helpers only they use). Remove now-unused imports (e.g. dispatch helpers, `isCleaningServiceType` if unused elsewhere in file).
- `InsuranceSection` (738-846): replace the catalog select/checkbox form with **2 text inputs** (기본 보험 / 추가 보험) whose defaultValues are `rider.primaryInsurance` / `rider.addonInsurance`, submitted via `setRiderInsuranceTextAction.bind(null, riderId)` on blur/submit. Remove `insuranceOptions`/`currentPrimary*`/`addonInsurances` props; instead accept `primaryInsurance`/`addonInsurance` strings (passed from `detailRow`/rider). Keep the `if (!riderId) → "배정된 라이더 없음"` guard.
- Update the `VehicleDetailRow` type + `detailRow` builder (in FullscreenMapHost) to carry `primaryInsurance`/`addonInsurance` from the rider — OR pass the rider's text directly. Simplest: add `primaryInsurance`/`addonInsurance` to `VehicleDetailRow` sourced from `riderInfoById`-like lookup. (Check how riderName/phone are sourced and add insurance the same way — may need rider text available in FullscreenMapHost; if not currently passed, add a `riderInsuranceById` map from page.tsx, OR include on the existing rider info map.)

**RidersPanel.tsx:** the "보험" column (line ~162-164) → render `rider.primaryInsurance ?? "—"` (drop `riderActiveInsuranceByRiderId`/`insuranceLabelById` resolution). Keep props for now or remove if cleanly unused.

**RiderDetailDialog.tsx:** insurance edit (~lines 50/54/86/236/239) → 2 text inputs bound to `rider.primaryInsurance`/`addonInsurance`, saved via `updateRiderFromOverviewAction` (now carries the text). Drop `insuranceOptions` usage.

**VehiclesPanel.tsx:** 보험 column (line ~117) → `rider.primaryInsurance ?? "—"`.

**Verify:** `npx tsc --noEmit && npm run lint && npm run test:service-ops` all clean. Manually confirm no remaining references to removed actions/props cause type errors (the Explore blast-radius list is the checklist).

**Commit:** `feat: insurance free-text inputs + drop delivery/dispatch sections in vehicle detail`

---

## Notes
- Dead catalog plumbing (page.tsx insuranceOptions/maps, FullscreenMapHost/BottomMapPanel passthrough) may remain if removing it risks breakage — leave it functional and note for a later cleanup PR. Priority is the visible text behavior.
- `insuredRiderIds` (rider-matching-snapshot) stays on the legacy `rider_insurances` read — unchanged.
