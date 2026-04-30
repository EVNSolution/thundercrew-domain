import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveContractStatus,
  mockContractUnconfiguredServiceDetail,
  mockContractUnavailableServiceDetail,
  toFrontendContract
} from "./contract-data-core.ts";

const mockContracts = [
  {
    area: "강남/역삼",
    contractType: "위탁 운영 계약",
    endsAt: "2026-12-31",
    riderName: "김민준",
    slug: "contract-kim-minjun-2026",
    startsAt: "2026-01-15",
    status: "활성"
  }
];

const lookup = {
  riders: new Map([
    ["11111111-1111-4111-8111-111111111111", { area: "강남/역삼", name: "김민준", phone: "010-1111-2222" }]
  ]),
  templates: new Map([
    ["33333333-3333-4333-8333-333333333333", { durationMinutes: null, enabled: true, id: "33333333-3333-4333-8333-333333333333", name: "무제한 계약", unlimited: true }]
  ]),
  vehicles: new Map([
    ["22222222-2222-4222-8222-222222222222", { model: "Thunder M1", plateNumber: "서울A-1001", status: "대기" }]
  ])
};

test("toFrontendContract hydrates labels without exposing raw ids as display text", () => {
  const contract = toFrontendContract(
    {
      bikeId: "22222222-2222-4222-8222-222222222222",
      contractTemplateId: "33333333-3333-4333-8333-333333333333",
      createdAt: "2026-04-30T00:00:00Z",
      endAt: null,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idx: 7,
      memo: "계약 메모",
      riderId: "11111111-1111-4111-8111-111111111111",
      startAt: "2026-05-01T00:30:00Z",
      terminatedAt: null,
      terminatedReason: null,
      updatedAt: "2026-04-30T00:00:00Z"
    },
    lookup,
    new Date("2026-05-02T00:00:00Z")
  );

  assert.equal(contract.riderName, "김민준");
  assert.equal(contract.bikeLabel, "서울A-1001 · Thunder M1");
  assert.equal(contract.contractType, "무제한 계약");
  assert.equal(contract.endsAt, "무제한");
  assert.equal(contract.status, "활성");
});

test("deriveContractStatus uses terminatedAt and endAt lifecycle fields", () => {
  const now = new Date("2026-05-01T00:00:00Z");
  assert.equal(deriveContractStatus({ endAt: null, terminatedAt: null }, now), "활성");
  assert.equal(deriveContractStatus({ endAt: "2026-05-10T00:00:00Z", terminatedAt: null }, now), "만료 예정");
  assert.equal(deriveContractStatus({ endAt: "2026-04-01T00:00:00Z", terminatedAt: null }, now), "종료");
  assert.equal(deriveContractStatus({ endAt: null, terminatedAt: "2026-04-15T00:00:00Z" }, now), "종료");
});

test("UUID contract detail falls back to visible mock detail when service API is unavailable", () => {
  const missingSession = mockContractUnavailableServiceDetail(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mockContracts,
    "서비스 API 세션 쿠키가 없어 mock 계약 상세를 표시합니다."
  );
  const missingBaseUrl = mockContractUnconfiguredServiceDetail("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", mockContracts);

  assert.equal(missingSession?.source, "mock");
  assert.equal(missingSession?.contract.slug, "contract-kim-minjun-2026");
  assert.match(missingBaseUrl?.notice ?? "", /SERVICE_OPS_API_BASE_URL/);
});
