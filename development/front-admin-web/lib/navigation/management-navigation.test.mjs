import assert from "node:assert/strict";
import test from "node:test";

import {
  managementGroups,
  resolveManagementGroupForHref,
  sidebarManagementItems
} from "./management-navigation.ts";

test("sidebar exposes only four management groups", () => {
  assert.deepEqual(sidebarManagementItems.map((item) => item.label), ["차량 관리", "라이더 관리", "계약 관리", "스테이션 관리"]);
  assert.deepEqual(sidebarManagementItems.map((item) => item.href), ["/vehicles", "/riders", "/contracts", "/stations"]);
});

test("management groups keep former flat entries as sub-pages", () => {
  assert.deepEqual(managementGroups.vehicles.items.map((item) => item.href), ["/vehicles", "/vehicles/new", "/equipment", "/equipment/types/new", "/devices", "/devices/installations/new"]);
  assert.deepEqual(managementGroups.riders.items.map((item) => item.href), ["/riders", "/riders/new", "/insurance", "/insurance/items"]);
  assert.deepEqual(managementGroups.contracts.items.map((item) => item.href), ["/contracts", "/contracts/new", "/contract-templates"]);
  assert.deepEqual(managementGroups.stations.items.map((item) => item.href), ["/stations", "/stations/new"]);
});

test("known child routes resolve to their parent management group", () => {
  assert.equal(resolveManagementGroupForHref("/devices"), "vehicles");
  assert.equal(resolveManagementGroupForHref("/equipment/types/new"), "vehicles");
  assert.equal(resolveManagementGroupForHref("/insurance/items"), "riders");
  assert.equal(resolveManagementGroupForHref("/contract-templates"), "contracts");
  assert.equal(resolveManagementGroupForHref("/stations/new"), "stations");
});
