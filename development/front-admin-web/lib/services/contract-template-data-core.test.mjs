import assert from "node:assert/strict";
import test from "node:test";

import {
  mockContractTemplateUnavailableServiceDetail,
  toContractTemplateDurationLabel,
  toFrontendContractTemplate
} from "./contract-template-data-core.ts";

test("toFrontendContractTemplate preserves system flags and readable duration label", () => {
  const template = toFrontendContractTemplate({
    createdAt: "2026-04-30T00:00:00Z",
    description: "12일 운영 계약",
    durationMinutes: 17280,
    enabled: true,
    id: "11111111-1111-4111-8111-111111111111",
    idx: 12,
    name: "표준 12일",
    systemTemplate: false,
    unlimited: false,
    updatedAt: "2026-04-30T00:00:00Z"
  });

  assert.equal(template.slug, "11111111-1111-4111-8111-111111111111");
  assert.equal(template.durationLabel, "12일");
  assert.equal(template.systemTemplate, false);
  assert.equal(template.source, "service-ops");
});

test("duration labels support unlimited and mixed day/hour/minute values", () => {
  assert.equal(toContractTemplateDurationLabel(null, true), "무제한");
  assert.equal(toContractTemplateDurationLabel(1500, false), "1일 1시간");
  assert.equal(toContractTemplateDurationLabel(90, false), "1시간 30분");
  assert.equal(toContractTemplateDurationLabel(35, false), "35분");
});

test("UUID contract template detail falls back to visible mock detail when service API is unavailable", () => {
  const detail = mockContractTemplateUnavailableServiceDetail(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    [
      {
        description: "기간 제한 없음",
        durationLabel: "무제한",
        durationMinutes: null,
        enabled: true,
        name: "무제한 계약",
        slug: "unlimited-contract",
        systemTemplate: true,
        unlimited: true
      }
    ],
    "서비스 API 세션 쿠키가 없어 mock 계약 양식 상세를 표시합니다."
  );

  assert.equal(detail?.source, "mock");
  assert.equal(detail?.template.slug, "unlimited-contract");
  assert.equal(detail?.template.systemTemplate, true);
});
