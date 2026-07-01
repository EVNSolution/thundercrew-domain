import assert from "node:assert/strict";
import test from "node:test";

import { readAccStatus } from "./otoplug-acc-status.ts";

test("accStatus 0 is read as 0 (ignition OFF)", () => {
  assert.equal(readAccStatus({ accStatus: 0 }), 0);
});

test("non-zero accStatus is read through (ignition ON)", () => {
  assert.equal(readAccStatus({ accStatus: 3 }), 3);
});

test("numeric string accStatus is parsed", () => {
  assert.equal(readAccStatus({ accStatus: "1" }), 1);
});

test("missing accStatus is undefined (not 0)", () => {
  assert.equal(readAccStatus({}), undefined);
});

test("null accStatus is undefined, avoiding the Number(null)===0 trap", () => {
  assert.equal(readAccStatus({ accStatus: null }), undefined);
});

test("non-numeric accStatus is undefined", () => {
  assert.equal(readAccStatus({ accStatus: "abc" }), undefined);
});
