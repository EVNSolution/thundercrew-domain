import assert from "node:assert/strict";
import test from "node:test";

import { bikeMaintenanceCategory } from "./bike-maintenance-category.ts";

test("6개 휠×엔진 조합이 각각 제 category 로 간다", () => {
  assert.equal(bikeMaintenanceCategory("TWO_WHEEL", "ELECTRIC"), "TWO_WHEEL_ELECTRIC");
  assert.equal(bikeMaintenanceCategory("TWO_WHEEL", "ICE"), "TWO_WHEEL_ICE");
  assert.equal(bikeMaintenanceCategory("TWO_WHEEL", "LPG"), "TWO_WHEEL_LPG");
  assert.equal(bikeMaintenanceCategory("FOUR_WHEEL", "ELECTRIC"), "FOUR_WHEEL_ELECTRIC");
  assert.equal(bikeMaintenanceCategory("FOUR_WHEEL", "ICE"), "FOUR_WHEEL_ICE");
  assert.equal(bikeMaintenanceCategory("FOUR_WHEEL", "LPG"), "FOUR_WHEEL_LPG");
});

// 이 두 건이 실제로 났던 회귀다. `engine === "ICE"` 이분법이면 LPG 가 ELECTRIC
// 으로 떨어져 LPG 봄베 검사가 사라지고 체인 교체가 붙었다.
test("LPG 는 ELECTRIC 으로 떨어지지 않는다", () => {
  assert.notEqual(bikeMaintenanceCategory("TWO_WHEEL", "LPG"), "TWO_WHEEL_ELECTRIC");
  assert.notEqual(bikeMaintenanceCategory("FOUR_WHEEL", "LPG"), "FOUR_WHEEL_ELECTRIC");
});

test("LPG 는 ICE 로도 뭉뚱그려지지 않는다", () => {
  assert.notEqual(bikeMaintenanceCategory("TWO_WHEEL", "LPG"), "TWO_WHEEL_ICE");
  assert.notEqual(bikeMaintenanceCategory("FOUR_WHEEL", "LPG"), "FOUR_WHEEL_ICE");
});

test("미입력 · 알 수 없는 값은 TWO_WHEEL_ELECTRIC 으로 fallback", () => {
  assert.equal(bikeMaintenanceCategory(null, null), "TWO_WHEEL_ELECTRIC");
  assert.equal(bikeMaintenanceCategory(undefined, undefined), "TWO_WHEEL_ELECTRIC");
  assert.equal(bikeMaintenanceCategory("THREE_WHEEL", "HYDROGEN"), "TWO_WHEEL_ELECTRIC");
});

test("휠만 알아도 그 휠 축은 지킨다", () => {
  assert.equal(bikeMaintenanceCategory("FOUR_WHEEL", null), "FOUR_WHEEL_ELECTRIC");
  assert.equal(bikeMaintenanceCategory(null, "LPG"), "TWO_WHEEL_LPG");
});
