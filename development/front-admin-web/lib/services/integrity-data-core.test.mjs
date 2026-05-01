import assert from "node:assert/strict";
import test from "node:test";

import { mockIntegrityData, toCategoryLabel, toFrontendIntegrityData } from "./integrity-data-core.ts";

test("toFrontendIntegrityData maps labels and recalculates visible summary", () => {
  const data = toFrontendIntegrityData({
    generatedAt: "2026-04-30T00:00:00Z",
    totalFindings: 3,
    summary: [
      { category: "REFERENCE_NOT_FOUND", count: 2 },
      { category: "REFERENCE_DELETED", count: 1 }
    ],
    findings: [
      {
        category: "REFERENCE_NOT_FOUND",
        message: "missing bike",
        referenceField: "bike_id",
        referenceId: "11111111-1111-4111-8111-111111111111",
        sourceId: "22222222-2222-4222-8222-222222222222",
        sourceIdx: 2,
        sourceTable: "rider_bike_contracts",
        targetTable: "bikes"
      },
      {
        category: "REFERENCE_DELETED",
        message: "deleted station",
        referenceField: "station_id",
        referenceId: "33333333-3333-4333-8333-333333333333",
        sourceId: "44444444-4444-4444-8444-444444444444",
        sourceIdx: 4,
        sourceTable: "station_battery_count_logs",
        targetTable: "battery_stations"
      },
      {
        category: "REFERENCE_NOT_FOUND",
        message: "excluded current state",
        referenceField: "bike_id",
        referenceId: "55555555-5555-4555-8555-555555555555",
        sourceId: "55555555-5555-4555-8555-555555555555",
        sourceIdx: null,
        sourceTable: "bike_current_states",
        targetTable: "bikes"
      }
    ]
  });

  assert.equal(data.totalFindings, 3);
  assert.equal(data.visibleFindingCount, 2);
  assert.equal(data.excludedFindingCount, 1);
  assert.deepEqual(data.summary.map((item) => [item.categoryLabel, item.count]), [["대상 없음", 1], ["삭제 대상 참조", 1]]);
  assert.equal(data.findings[0].sourceLabel, "라이더-차량 계약");
  assert.equal(data.findings[0].targetLabel, "차량");
  assert.equal(data.findings[0].severity, "danger");
});

test("category labels are explicit and mock fallback is visible", () => {
  assert.equal(toCategoryLabel("REFERENCE_NOT_FOUND"), "대상 없음");
  assert.equal(toCategoryLabel("REFERENCE_DELETED"), "삭제 대상 참조");

  const data = mockIntegrityData("no service");
  assert.equal(data.notice, "no service");
  assert.equal(data.source, "mock");
  assert.equal(data.visibleFindingCount, 2);
});

test("integrity findings do not expose generated UUIDs in the frontend display model", () => {
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  const data = toFrontendIntegrityData({
    generatedAt: "2026-04-30T00:00:00Z",
    totalFindings: 1,
    summary: [{ category: "REFERENCE_NOT_FOUND", count: 1 }],
    findings: [
      {
        category: "REFERENCE_NOT_FOUND",
        message: "missing rider 11111111-1111-4111-8111-111111111111",
        referenceField: "rider_id",
        referenceId: "11111111-1111-4111-8111-111111111111",
        sourceId: "22222222-2222-4222-8222-222222222222",
        sourceIdx: 7,
        sourceTable: "rider_bike_contracts",
        targetTable: "riders"
      }
    ]
  });

  assert.equal(Object.hasOwn(data.findings[0], "sourceId"), false);
  assert.equal(Object.hasOwn(data.findings[0], "referenceId"), false);
  assert.doesNotMatch(JSON.stringify(data.findings), uuidPattern);
});
