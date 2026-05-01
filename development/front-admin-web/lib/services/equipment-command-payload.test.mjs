import assert from "node:assert/strict";
import test from "node:test";

import {
  EquipmentCommandPayloadError,
  toBikeEquipmentCreatePayload,
  toBikeEquipmentRemovePayload,
  toBikeEquipmentUpdatePayload,
  toEquipmentTypeCreatePayload,
  toEquipmentTypeUpdatePayload
} from "./equipment-command-payload.ts";

test("equipment type payloads keep operator fields only", () => {
  const formData = new FormData();
  formData.set("name", "브레이크 패드");
  formData.set("description", "제동계 소모품");
  formData.set("enabled", "true");
  formData.set("equipmentTypeId", "99999999-9999-4999-8999-999999999999");

  assert.deepEqual(toEquipmentTypeCreatePayload(formData), {
    description: "제동계 소모품",
    enabled: true,
    name: "브레이크 패드"
  });
  assert.deepEqual(toEquipmentTypeUpdatePayload(formData), {
    description: "제동계 소모품",
    enabled: true,
    name: "브레이크 패드"
  });
});

test("equipment type update payload preserves blank description as clear command", () => {
  const formData = new FormData();
  formData.set("name", "브레이크 패드");
  formData.set("description", "");
  formData.set("enabled", "true");

  assert.deepEqual(toEquipmentTypeUpdatePayload(formData), {
    description: "",
    enabled: true,
    name: "브레이크 패드"
  });
});

test("bike equipment create payload uses selector fields and ignores direct raw ID field names", () => {
  const formData = new FormData();
  formData.set("bikeSelection", "11111111-1111-4111-8111-111111111111");
  formData.set("equipmentTypeSelection", "22222222-2222-4222-8222-222222222222");
  formData.set("equipmentLabel", "전륜 브레이크 패드");
  formData.set("modelName", "BP-Urban-01");
  formData.set("serialNumber", "BP-001");
  formData.set("installedAt", "2026-04-30T10:30");
  formData.set("managementDueDate", "2026-05-30");
  formData.set("managementNote", "정기 점검");
  formData.set("memo", "운영 메모");
  formData.set("bikeId", "99999999-9999-4999-8999-999999999999");
  formData.set("equipmentTypeId", "99999999-9999-4999-8999-999999999999");
  formData.set("equipmentId", "99999999-9999-4999-8999-999999999999");

  assert.deepEqual(toBikeEquipmentCreatePayload(formData), {
    bikeId: "11111111-1111-4111-8111-111111111111",
    equipmentLabel: "전륜 브레이크 패드",
    equipmentTypeId: "22222222-2222-4222-8222-222222222222",
    installedAt: "2026-04-30T01:30:00.000Z",
    managementDueDate: "2026-05-30",
    managementNote: "정기 점검",
    memo: "운영 메모",
    modelName: "BP-Urban-01",
    serialNumber: "BP-001"
  });
});

test("bike equipment update and remove payloads do not include relationship fields", () => {
  const updateData = new FormData();
  updateData.set("equipmentLabel", "후륜 브레이크 패드");
  updateData.set("modelName", "BP-Urban-02");
  updateData.set("serialNumber", "BP-002");
  updateData.set("managementDueDate", "2026-06-30");
  updateData.set("managementNote", "교체 예정");
  updateData.set("memo", "수정 메모");
  updateData.set("bikeSelection", "11111111-1111-4111-8111-111111111111");
  updateData.set("equipmentTypeSelection", "22222222-2222-4222-8222-222222222222");

  assert.deepEqual(toBikeEquipmentUpdatePayload(updateData), {
    equipmentLabel: "후륜 브레이크 패드",
    managementDueDate: "2026-06-30",
    managementNote: "교체 예정",
    memo: "수정 메모",
    modelName: "BP-Urban-02",
    serialNumber: "BP-002"
  });

  const removeData = new FormData();
  removeData.set("removedAt", "2026-05-01T12:00");
  removeData.set("memo", "교체 완료");
  removeData.set("equipmentId", "99999999-9999-4999-8999-999999999999");

  assert.deepEqual(toBikeEquipmentRemovePayload(removeData), {
    memo: "교체 완료",
    removedAt: "2026-05-01T03:00:00.000Z"
  });
});

test("bike equipment update and remove payloads preserve blank text as clear commands", () => {
  const updateData = new FormData();
  updateData.set("equipmentLabel", "");
  updateData.set("modelName", "");
  updateData.set("serialNumber", "");
  updateData.set("managementDueDate", "");
  updateData.set("managementNote", "");
  updateData.set("memo", "");

  assert.deepEqual(toBikeEquipmentUpdatePayload(updateData), {
    equipmentLabel: "",
    managementDueDate: null,
    managementNote: "",
    memo: "",
    modelName: "",
    serialNumber: ""
  });

  const removeData = new FormData();
  removeData.set("removedAt", "");
  removeData.set("memo", "");

  assert.deepEqual(toBikeEquipmentRemovePayload(removeData), {
    memo: "",
    removedAt: null
  });
});

test("bike equipment payloads reject blank selectors and invalid dates", () => {
  const formData = new FormData();
  formData.set("bikeSelection", "서울바4821");
  formData.set("equipmentTypeSelection", "22222222-2222-4222-8222-222222222222");
  formData.set("installedAt", "2026-04-30T10:30");
  formData.set("managementDueDate", "2026-05-30");

  assert.throws(() => toBikeEquipmentCreatePayload(formData), EquipmentCommandPayloadError);

  formData.set("bikeSelection", "11111111-1111-4111-8111-111111111111");
  formData.set("managementDueDate", "2026-5-30");
  assert.throws(() => toBikeEquipmentCreatePayload(formData), EquipmentCommandPayloadError);
});
