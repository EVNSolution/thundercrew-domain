import assert from "node:assert/strict";
import test from "node:test";

import {
  mockBikeEquipmentUnavailableServiceDetail,
  mockEquipmentTypeUnavailableServiceDetail,
  toFrontendBikeEquipment,
  toFrontendManagementStatus
} from "./equipment-data-core.ts";

const lookup = {
  equipmentTypes: new Map([["22222222-2222-4222-8222-222222222222", { name: "브레이크 패드" }]]),
  vehicles: new Map([["11111111-1111-4111-8111-111111111111", { model: "Thunder M1", plateNumber: "서울바4821", status: "대기" }]])
};

const mockTypes = [{ description: "제동계", enabled: true, name: "브레이크 패드", slug: "brake-pad" }];
const mockEquipments = [
  {
    bikeLabel: "서울바4821 · Thunder M1",
    equipmentLabel: "전륜 브레이크 패드",
    equipmentTypeName: "브레이크 패드",
    installedAt: "2026-04-30T10:30:00+09:00",
    managementDueDate: "2026-05-30",
    managementStatus: "정상",
    slug: "equip-brake"
  }
];

test("toFrontendBikeEquipment hydrates vehicle/type labels and management status", () => {
  const equipment = toFrontendBikeEquipment(
    {
      bikeId: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-04-30T00:00:00Z",
      equipmentLabel: "전륜 브레이크 패드",
      equipmentTypeId: "22222222-2222-4222-8222-222222222222",
      id: "33333333-3333-4333-8333-333333333333",
      idx: 3,
      installedAt: "2026-04-30T01:30:00Z",
      managementDueDate: "2026-05-30",
      managementNote: "정기 점검",
      managementStatus: "DUE_SOON",
      memo: "운영 메모",
      modelName: "BP-Urban-01",
      removedAt: null,
      serialNumber: "BP-001",
      updatedAt: "2026-04-30T00:00:00Z"
    },
    lookup
  );

  assert.equal(equipment.bikeLabel, "서울바4821 · Thunder M1");
  assert.equal(equipment.equipmentTypeName, "브레이크 패드");
  assert.equal(equipment.managementStatus, "관리 예정");
  assert.equal(equipment.slug, "33333333-3333-4333-8333-333333333333");
});

test("removed bike equipment displays removed status", () => {
  const equipment = toFrontendBikeEquipment(
    {
      bikeId: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-04-30T00:00:00Z",
      equipmentLabel: "전륜 브레이크 패드",
      equipmentTypeId: "22222222-2222-4222-8222-222222222222",
      id: "33333333-3333-4333-8333-333333333333",
      idx: 3,
      installedAt: "2026-04-30T01:30:00Z",
      managementDueDate: "2026-05-30",
      managementNote: null,
      managementStatus: "NORMAL",
      memo: null,
      modelName: null,
      removedAt: "2026-05-01T00:00:00Z",
      serialNumber: null,
      updatedAt: "2026-04-30T00:00:00Z"
    },
    lookup
  );

  assert.equal(equipment.managementStatus, "제거됨");
});

test("management status label mapping is explicit", () => {
  assert.equal(toFrontendManagementStatus("NORMAL"), "정상");
  assert.equal(toFrontendManagementStatus("DUE_SOON"), "관리 예정");
  assert.equal(toFrontendManagementStatus("OVERDUE"), "기한 초과");
});

test("UUID equipment detail falls back to visible mock detail when service API is unavailable", () => {
  const missingEquipment = mockBikeEquipmentUnavailableServiceDetail(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mockEquipments,
    "서비스 API 세션 쿠키가 없어 mock 장비 상세를 표시합니다."
  );
  const missingType = mockEquipmentTypeUnavailableServiceDetail(
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    mockTypes,
    "서비스 API 세션 쿠키가 없어 mock 장비 종류 상세를 표시합니다."
  );

  assert.equal(missingEquipment?.source, "mock");
  assert.equal(missingEquipment?.equipment.slug, "equip-brake");
  assert.equal(missingType?.source, "mock");
  assert.equal(missingType?.equipmentType.slug, "brake-pad");
});
