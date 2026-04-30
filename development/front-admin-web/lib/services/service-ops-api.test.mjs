import assert from "node:assert/strict";
import test from "node:test";

import {
  ServiceOpsApiError,
  createServiceOpsApiClient,
  normalizeServiceOpsBaseUrl,
  toFrontendDashboardMapState,
  toFrontendRider
} from "./service-ops-api.ts";

test("normalizeServiceOpsBaseUrl rejects empty and placeholder values", () => {
  assert.equal(normalizeServiceOpsBaseUrl(undefined), null);
  assert.equal(normalizeServiceOpsBaseUrl(""), null);
  assert.equal(normalizeServiceOpsBaseUrl("https://<service-ops-api>"), null);
  assert.equal(normalizeServiceOpsBaseUrl(" http://localhost:8080/ "), "http://localhost:8080");
});

test("rider list request uses backend base url, pagination query, and bearer token", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080/",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "11111111-1111-1111-1111-111111111111",
              idx: 7,
              name: "김민준",
              phoneNumber: "010-1111-2222",
              teamName: "강남 1팀",
              areaName: "강남/역삼",
              appAccountLinked: true,
              appAccountId: "22222222-2222-2222-2222-222222222222",
              appLinkedAt: "2026-04-29T00:00:00Z",
              appLinkStatus: "LINKED",
              memo: "테스트 라이더",
              createdAt: "2026-04-01T12:00:00Z",
              updatedAt: "2026-04-29T00:00:00Z"
            }
          ],
          page: {
            number: 1,
            size: 10,
            totalItems: 1,
            totalPages: 1,
            hasNext: false,
            hasPrevious: true
          }
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    }
  });

  const page = await client.listRiders({ page: 1, size: 10 });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.origin, "http://localhost:8080");
  assert.equal(url.pathname, "/api/v1/riders");
  assert.equal(url.searchParams.get("page"), "1");
  assert.equal(url.searchParams.get("size"), "10");
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
  assert.equal(calls[0].init?.cache, "no-store");
  assert.equal(page.items[0].slug, "11111111-1111-1111-1111-111111111111");
  assert.equal(page.items[0].phone, "010-1111-2222");
});

test("createRider sends only operator-editable fields", async () => {
  let requestBody = null;
  const client = createServiceOpsApiClient({
    baseUrl: "http://localhost:8080",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          id: "44444444-4444-4444-9444-444444444444",
          idx: 4,
          name: requestBody.name,
          phoneNumber: requestBody.phoneNumber,
          teamName: requestBody.teamName,
          areaName: requestBody.areaName,
          appAccountLinked: false,
          appAccountId: null,
          appLinkedAt: null,
          appLinkStatus: "UNLINKED",
          memo: requestBody.memo,
          createdAt: "2026-04-20T00:00:00Z",
          updatedAt: "2026-04-20T00:00:00Z"
        }),
        { headers: { "content-type": "application/json" }, status: 201 }
      );
    }
  });

  await client.createRider({
    areaName: "강남/역삼",
    memo: "운영 메모",
    name: "최지훈",
    phoneNumber: "010-5555-6666",
    teamName: "강남 1팀"
  });

  assert.deepEqual(Object.keys(requestBody).sort(), ["areaName", "memo", "name", "phoneNumber", "teamName"]);
});

test("HTTP error responses throw ServiceOpsApiError with status and backend code", async () => {
  const client = createServiceOpsApiClient({
    baseUrl: "http://localhost:8080",
    fetchImpl: async () =>
      new Response(JSON.stringify({ code: "RESOURCE_NOT_FOUND", message: "Rider not found" }), {
        headers: { "content-type": "application/json" },
        status: 404
      })
  });

  await assert.rejects(
    () => client.getRider("missing"),
    (error) =>
      error instanceof ServiceOpsApiError &&
      error.status === 404 &&
      error.code === "RESOURCE_NOT_FOUND" &&
      error.message.includes("Rider not found")
  );
});

test("dashboard map-state request uses backend path and preserves station n/m labels", async () => {
  const calls = [];
  const responseBody = {
    generatedAt: "2026-04-30T08:00:00Z",
    summary: {
      totalBikes: 3,
      bikePinCount: 1,
      onlineBikeCount: 1,
      signalLostBikeCount: 0,
      parkedOfflineBikeCount: 0,
      lowBatteryBikeCount: 1,
      activeStationCount: 1,
      stationPinCount: 1,
      availableBatteryCount: 5
    },
    bikePins: [
      {
        bikeId: "55555555-5555-4555-9555-555555555555",
        bikeIdx: 5,
        plateNumber: "서울T-2001",
        modelName: "Thunder M1",
        operationStatus: "IN_SERVICE",
        activeRiderLabel: "김지도",
        deviceId: "66666666-6666-4666-9666-666666666666",
        lastReceivedAt: "2026-04-30T07:59:00Z",
        latitude: 37.5007,
        longitude: 127.0364,
        speedKph: 12.3,
        batteryPercent: 44,
        ignitionStatus: "ON",
        telemetrySource: "DEVICE_API",
        drivingStatus: "DRIVING",
        connectionStatus: "ONLINE",
        batteryStatus: "LOW",
        pinLabel: "서울T-2001 · 김지도"
      }
    ],
    stationPins: [
      {
        stationId: "77777777-7777-4777-9777-777777777777",
        stationIdx: 1,
        name: "강남 스테이션",
        address: "서울 강남구 테헤란로 1",
        latitude: 37.501,
        longitude: 127.037,
        status: "ACTIVE",
        maxBatteryCapacity: 12,
        currentBatteryCount: 7,
        availableBatteryCount: 5,
        availableBatteryLabel: "5/12",
        availableBatteryPercentage: 42,
        pinLabel: "강남 스테이션 5/12"
      }
    ]
  };
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(responseBody), {
        headers: { "content-type": "application/json" },
        status: 200
      });
    }
  });

  const mapState = await client.getDashboardMapState();

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/api/v1/dashboard/map-state");
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
  assert.equal(calls[0].init?.cache, "no-store");
  assert.equal(mapState.stationPins[0].availableBatteryLabel, "5/12");
  assert.equal(mapState.stationPins[0].pinLabel, "강남 스테이션 5/12");
  assert.equal(mapState.bikePins[0].activeRiderLabel, "김지도");
});

test("toFrontendDashboardMapState keeps dashboard summary and avoids rider phone/id fields", () => {
  const mapState = toFrontendDashboardMapState({
    generatedAt: "2026-04-30T08:00:00Z",
    summary: {
      totalBikes: 1,
      bikePinCount: 1,
      onlineBikeCount: 1,
      signalLostBikeCount: 0,
      parkedOfflineBikeCount: 0,
      lowBatteryBikeCount: 0,
      activeStationCount: 0,
      stationPinCount: 0,
      availableBatteryCount: 0
    },
    bikePins: [
      {
        bikeId: "88888888-8888-4888-9888-888888888888",
        bikeIdx: 8,
        plateNumber: "서울T-3001",
        modelName: "Thunder M1",
        operationStatus: "READY",
        activeRiderLabel: "라이더A",
        deviceId: "99999999-9999-4999-9999-999999999999",
        lastReceivedAt: "2026-04-30T07:59:00Z",
        latitude: 37.5,
        longitude: 127,
        speedKph: 0,
        batteryPercent: 88,
        ignitionStatus: "OFF",
        telemetrySource: "DEVICE_API",
        drivingStatus: "PARKED",
        connectionStatus: "ONLINE",
        batteryStatus: "NORMAL",
        pinLabel: "서울T-3001 · 라이더A"
      }
    ],
    stationPins: []
  });

  assert.equal(mapState.summary.totalBikes, 1);
  assert.equal(mapState.bikePins[0].slug, "88888888-8888-4888-9888-888888888888");
  assert.equal("activeRiderId" in mapState.bikePins[0], false);
  assert.equal("activeRiderPhoneNumber" in mapState.bikePins[0], false);
});

test("toFrontendRider maps backend UUID to route slug without exposing editable ids", () => {
  const rider = toFrontendRider({
    id: "33333333-3333-3333-3333-333333333333",
    idx: 13,
    name: "박서연",
    phoneNumber: "010-3333-4444",
    teamName: "서초 2팀",
    areaName: "서초/방배",
    appAccountLinked: false,
    appAccountId: null,
    appLinkedAt: null,
    appLinkStatus: "UNLINKED",
    memo: null,
    createdAt: "2026-04-12T09:30:00Z",
    updatedAt: "2026-04-13T09:30:00Z"
  });

  assert.equal(rider.slug, "33333333-3333-3333-3333-333333333333");
  assert.equal(rider.idx, 13);
  assert.equal(rider.status, "대기");
  assert.equal(rider.joinedAt, "2026-04-12");
  assert.equal(rider.appLinkStatus, "UNLINKED");
});
