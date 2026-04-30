import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveInsuranceStatus,
  mockInsuranceUnconfiguredServiceDetail,
  mockInsuranceUnavailableServiceDetail,
  toFrontendInsurancePolicy
} from "./insurance-data-core.ts";

const mockPolicies = [
  {
    endsAt: "보험기간 후속",
    holderLabel: "김민준 · 010-1111-2222",
    policyNumber: "증권번호 후속",
    provider: "라이더 기본 보험",
    slug: "ins-kim-minjun",
    startsAt: "2026-04-30",
    status: "정상",
    targetType: "라이더"
  }
];

const lookup = {
  items: new Map([
    ["22222222-2222-4222-8222-222222222222", { enabled: true, id: "22222222-2222-4222-8222-222222222222", name: "라이더 기본 보험" }]
  ]),
  riders: new Map([
    ["11111111-1111-4111-8111-111111111111", { area: "강남/역삼", name: "김민준", phone: "010-1111-2222" }]
  ])
};

test("toFrontendInsurancePolicy hydrates rider and insurance labels", () => {
  const policy = toFrontendInsurancePolicy(
    {
      createdAt: "2026-04-30T00:00:00Z",
      enabled: true,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idx: 5,
      insuranceItemId: "22222222-2222-4222-8222-222222222222",
      memo: "보험 메모",
      riderId: "11111111-1111-4111-8111-111111111111",
      updatedAt: "2026-04-30T00:00:00Z"
    },
    lookup
  );

  assert.equal(policy.holderLabel, "김민준 · 010-1111-2222");
  assert.equal(policy.provider, "라이더 기본 보험");
  assert.equal(policy.status, "정상");
  assert.equal(policy.policyNumber, "증권번호 후속");
});

test("deriveInsuranceStatus reflects enabled flag", () => {
  assert.equal(deriveInsuranceStatus(true), "정상");
  assert.equal(deriveInsuranceStatus(false), "비활성");
});

test("UUID insurance detail falls back to visible mock detail when service API is unavailable", () => {
  const missingSession = mockInsuranceUnavailableServiceDetail(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mockPolicies,
    "서비스 API 세션 쿠키가 없어 mock 보험 상세를 표시합니다."
  );
  const missingBaseUrl = mockInsuranceUnconfiguredServiceDetail("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", mockPolicies);

  assert.equal(missingSession?.source, "mock");
  assert.equal(missingSession?.policy.slug, "ins-kim-minjun");
  assert.match(missingBaseUrl?.notice ?? "", /SERVICE_OPS_API_BASE_URL/);
});
