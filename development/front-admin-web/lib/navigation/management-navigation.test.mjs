import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  managementGroups,
  resolveManagementGroupForHref,
  sidebarManagementItems
} from "./management-navigation.ts";

test("sidebar exposes three management groups after the rider-centric refactor", () => {
  assert.deepEqual(sidebarManagementItems.map((item) => item.label), ["차량 관리", "라이더 관리", "스테이션 관리"]);
  assert.deepEqual(sidebarManagementItems.map((item) => item.href), ["/vehicles", "/riders", "/stations"]);
});

test("management groups keep only list-level sub-pages", () => {
  assert.deepEqual(managementGroups.vehicles.items.map((item) => item.href), ["/vehicles", "/equipment", "/devices"]);
  assert.deepEqual(managementGroups.riders.items.map((item) => item.href), ["/riders", "/insurance/items"]);
  assert.deepEqual(managementGroups.stations.items.map((item) => item.href), ["/stations"]);
});

test("known child routes resolve to their parent management group", () => {
  assert.equal(resolveManagementGroupForHref("/devices"), "vehicles");
  assert.equal(resolveManagementGroupForHref("/equipment/types/new"), "vehicles");
  assert.equal(resolveManagementGroupForHref("/insurance/items"), "riders");
  assert.equal(resolveManagementGroupForHref("/stations/new"), "stations");
  assert.equal(resolveManagementGroupForHref("/vehicles/new"), "vehicles");
});

test("non-list management pages expose a list-return link", () => {
  const pages = [
    ["app/vehicles/new/page.tsx", "/vehicles"],
    ["app/vehicles/[slug]/page.tsx", "/vehicles"],
    ["app/vehicles/[slug]/edit/page.tsx", "/vehicles"],
    ["app/equipment/new/page.tsx", "/equipment"],
    ["app/equipment/[slug]/page.tsx", "/equipment"],
    ["app/equipment/[slug]/edit/page.tsx", "/equipment"],
    ["app/equipment/types/new/page.tsx", "/equipment"],
    ["app/equipment/types/[slug]/page.tsx", "/equipment"],
    ["app/devices/new/page.tsx", "/devices"],
    ["app/devices/[slug]/page.tsx", "/devices"],
    ["app/devices/[slug]/edit/page.tsx", "/devices"],
    ["app/devices/installations/new/page.tsx", "/devices"],
    ["app/devices/installations/[slug]/page.tsx", "/devices"],
    ["app/riders/new/page.tsx", "/riders"],
    ["app/riders/[slug]/page.tsx", "/riders"],
    ["app/riders/[slug]/edit/page.tsx", "/riders"],
    ["app/insurance/items/new/page.tsx", "/insurance/items"],
    ["app/insurance/items/[slug]/page.tsx", "/insurance/items"],
    ["app/insurance/items/[slug]/edit/page.tsx", "/insurance/items"],
    ["app/contract-templates/new/page.tsx", "/contract-templates"],
    ["app/contract-templates/[slug]/page.tsx", "/contract-templates"],
    ["app/contract-templates/[slug]/edit/page.tsx", "/contract-templates"],
    ["app/stations/new/page.tsx", "/stations"],
    ["app/stations/[slug]/page.tsx", "/stations"],
    ["app/stations/[slug]/edit/page.tsx", "/stations"]
  ];

  for (const [page, href] of pages) {
    const source = readFileSync(page, "utf8");
    const renderedPageContainers = source.match(/<div className="page-container">/gu) ?? [];
    const renderedBackLinks = source.match(new RegExp(`<BackToListLink href="${href}" />`, "gu")) ?? [];

    assert.ok(source.includes('import { BackToListLink } from "@/components/layout/BackToListLink";'), page);
    assert.equal(renderedBackLinks.length, renderedPageContainers.length, page);
  }
});
