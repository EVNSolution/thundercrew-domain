import assert from "node:assert/strict";
import test from "node:test";

import {
  ServiceOpsApiError,
  createServiceOpsApiClient,
  normalizeServiceOpsBaseUrl,
  toFrontendBatteryStation,
  toFrontendDashboardMapState,
  toFrontendVehicle,
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





test("bike list request maps service bikes to frontend vehicles", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              idx: 12,
              plateNumber: "서울A-1001",
              vin: "VIN-BIKE-001",
              modelName: "Thunder M1",
              operationStatus: "IN_SERVICE",
              memo: "강남 운영 차량",
              createdAt: "2026-04-01T00:00:00Z",
              updatedAt: "2026-04-30T00:00:00Z"
            }
          ],
          page: { number: 0, size: 20, totalItems: 1, totalPages: 1, hasNext: false, hasPrevious: false }
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    }
  });

  const page = await client.listVehicles({ page: 0, size: 20 });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/api/v1/bikes");
  assert.equal(url.searchParams.get("page"), "0");
  assert.equal(url.searchParams.get("size"), "20");
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
  assert.equal(page.items[0].slug, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(page.items[0].plateNumber, "서울A-1001");
  assert.equal(page.items[0].model, "Thunder M1");
  assert.equal(page.items[0].status, "운행 중");
  assert.equal(page.items[0].vin, "VIN-BIKE-001");
  assert.equal(page.items[0].assignmentStatus, "배정 API 후속");
});

test("invalid backend bike operation status does not display as READY", () => {
  assert.throws(
    () =>
      toFrontendVehicle({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        idx: 12,
        plateNumber: "서울A-1001",
        vin: "VIN-BIKE-001",
        modelName: "Thunder M1",
        operationStatus: "DECOMMISSIONED",
        memo: null,
        createdAt: "2026-04-01T00:00:00Z",
        updatedAt: "2026-04-30T00:00:00Z"
      }),
    (error) =>
      error instanceof ServiceOpsApiError &&
      error.code === "SERVICE_OPS_UNSUPPORTED_BIKE_STATUS" &&
      error.message.includes("Unsupported bike operation status")
  );
});

test("createVehicle sends only operator-editable bike fields", async () => {
  let requestBody = null;
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          idx: 14,
          plateNumber: requestBody.plateNumber,
          vin: requestBody.vin,
          modelName: requestBody.modelName,
          operationStatus: requestBody.operationStatus,
          memo: requestBody.memo,
          createdAt: "2026-04-01T00:00:00Z",
          updatedAt: "2026-04-30T00:00:00Z"
        }),
        { headers: { "content-type": "application/json" }, status: 201 }
      );
    }
  });

  await client.createVehicle({
    memo: "운영 메모",
    modelName: "Thunder M1",
    operationStatus: "READY",
    plateNumber: "서울A-1001",
    vin: "VIN-BIKE-001"
  });

  assert.deepEqual(Object.keys(requestBody).sort(), ["memo", "modelName", "operationStatus", "plateNumber", "vin"]);
  assert.equal("id" in requestBody, false);
  assert.equal("bikeId" in requestBody, false);
  assert.equal("riderId" in requestBody, false);
  assert.equal("deviceId" in requestBody, false);
});



test("updateVehicle uses bike basic-profile endpoint without status or relationship fields", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          idx: 16,
          plateNumber: "서울D-4004",
          vin: "VIN-BIKE-004",
          modelName: "Thunder M4",
          operationStatus: "READY",
          memo: "기본 정보 수정",
          createdAt: "2026-04-01T00:00:00Z",
          updatedAt: "2026-04-30T00:00:00Z"
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    }
  });

  await client.updateVehicle("dddddddd-dddd-4ddd-8ddd-dddddddddddd", {
    memo: "기본 정보 수정",
    modelName: "Thunder M4",
    plateNumber: "서울D-4004",
    vin: "VIN-BIKE-004"
  });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  const requestBody = JSON.parse(String(calls[0].init?.body));
  assert.equal(url.pathname, "/api/v1/bikes/dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  assert.equal(calls[0].init?.method, "PATCH");
  assert.deepEqual(Object.keys(requestBody).sort(), ["memo", "modelName", "plateNumber", "vin"]);
  assert.equal("operationStatus" in requestBody, false);
  assert.equal("riderId" in requestBody, false);
  assert.equal("deviceId" in requestBody, false);
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
});

test("changeVehicleOperationStatus uses dedicated status endpoint", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          idx: 15,
          plateNumber: "서울C-3003",
          vin: "VIN-BIKE-003",
          modelName: "Thunder M3",
          operationStatus: "INSPECTION_REQUIRED",
          memo: "점검 필요",
          createdAt: "2026-04-01T00:00:00Z",
          updatedAt: "2026-04-30T00:00:00Z"
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    }
  });

  await client.changeVehicleOperationStatus("cccccccc-cccc-4ccc-8ccc-cccccccccccc", {
    memo: "브레이크 점검",
    operationStatus: "INSPECTION_REQUIRED",
    reason: "운영자 확인"
  });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/api/v1/bikes/cccccccc-cccc-4ccc-8ccc-cccccccccccc/operation-status");
  assert.equal(calls[0].init?.method, "PATCH");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    memo: "브레이크 점검",
    operationStatus: "INSPECTION_REQUIRED",
    reason: "운영자 확인"
  });
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
});

test("contract template list request uses backend path and bearer token", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              idx: 1,
              name: "무제한 계약",
              durationMinutes: null,
              unlimited: true,
              description: "기간 제한 없음",
              enabled: true,
              systemTemplate: true,
              createdAt: "2026-04-30T00:00:00Z",
              updatedAt: "2026-04-30T00:00:00Z"
            }
          ],
          page: { number: 0, size: 100, totalItems: 1, totalPages: 1, hasNext: false, hasPrevious: false }
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    }
  });

  const page = await client.listContractTemplates({ page: 0, size: 100 });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/api/v1/contract-templates");
  assert.equal(url.searchParams.get("page"), "0");
  assert.equal(url.searchParams.get("size"), "100");
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
  assert.equal(page.items[0].name, "무제한 계약");
  assert.equal(page.items[0].unlimited, true);
});

test("rider-bike contract create/update/terminate use dedicated contract endpoints", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          idx: 10,
          riderId: body.riderId ?? "22222222-2222-4222-8222-222222222222",
          bikeId: body.bikeId ?? "33333333-3333-4333-8333-333333333333",
          contractTemplateId: body.contractTemplateId ?? "44444444-4444-4444-8444-444444444444",
          startAt: body.startAt ?? "2026-05-01T00:00:00Z",
          endAt: null,
          terminatedAt: body.terminatedAt ?? null,
          terminatedReason: body.terminatedReason ?? null,
          memo: body.memo ?? null,
          createdAt: "2026-04-30T00:00:00Z",
          updatedAt: "2026-04-30T00:00:00Z"
        }),
        { headers: { "content-type": "application/json" }, status: init?.method === "POST" ? 201 : 200 }
      );
    }
  });

  await client.createRiderBikeContract({
    bikeId: "33333333-3333-4333-8333-333333333333",
    contractTemplateId: "44444444-4444-4444-8444-444444444444",
    memo: "운영 메모",
    riderId: "22222222-2222-4222-8222-222222222222",
    startAt: "2026-04-30T15:00:00.000Z"
  });
  await client.updateRiderBikeContract("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { memo: "메모 수정" });
  await client.terminateRiderBikeContract("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
    terminatedAt: "2026-05-10T00:00:00.000Z",
    terminatedReason: "운영 종료"
  });

  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    "/api/v1/rider-bike-contracts",
    "/api/v1/rider-bike-contracts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "/api/v1/rider-bike-contracts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/terminate"
  ]);
  assert.deepEqual(calls.map((call) => call.init?.method), ["POST", "PATCH", "PATCH"]);
  assert.deepEqual(Object.keys(JSON.parse(String(calls[0].init?.body))).sort(), ["bikeId", "contractTemplateId", "memo", "riderId", "startAt"]);
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { memo: "메모 수정" });
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), {
    terminatedAt: "2026-05-10T00:00:00.000Z",
    terminatedReason: "운영 종료"
  });
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
});

test("refresh request posts refresh token without bearer token", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          accessToken: "new-access-token",
          admin: {
            displayName: "운영자",
            email: "admin@example.com",
            id: "admin-id",
            loginId: "admin",
            role: "ADMIN"
          },
          expiresAt: "2026-04-30T09:30:00Z",
          refreshExpiresAt: "2026-05-30T09:30:00Z",
          refreshToken: "new-refresh-token",
          tokenType: "Bearer"
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    }
  });

  const response = await client.refresh({ refreshToken: "old-refresh-token" });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(url.pathname, "/api/v1/auth/refresh");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.cache, "no-store");
  assert.equal(headers.get("authorization"), null);
  assert.equal(headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { refreshToken: "old-refresh-token" });
  assert.equal(response.accessToken, "new-access-token");
});

test("logout request posts with bearer token and accepts empty success responses", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 204 });
    }
  });

  await client.logout();

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(url.pathname, "/api/v1/auth/logout");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.cache, "no-store");
  assert.equal(headers.get("authorization"), "Bearer access-token");
  assert.equal(headers.get("content-type"), null);
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

test("insurance item list request uses backend path and bearer token", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              idx: 1,
              name: "라이더 기본 보험",
              description: "테스트 보험 항목",
              enabled: true,
              createdAt: "2026-04-30T00:00:00Z",
              updatedAt: "2026-04-30T00:00:00Z"
            }
          ],
          page: { number: 0, size: 100, totalItems: 1, totalPages: 1, hasNext: false, hasPrevious: false }
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    }
  });

  const page = await client.listInsuranceItems({ page: 0, size: 100 });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/api/v1/insurance-items");
  assert.equal(url.searchParams.get("page"), "0");
  assert.equal(url.searchParams.get("size"), "100");
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
  assert.equal(page.items[0].name, "라이더 기본 보험");
});

test("rider insurance create/update use dedicated insurance endpoints", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          idx: 10,
          riderId: body.riderId ?? "22222222-2222-4222-8222-222222222222",
          insuranceItemId: body.insuranceItemId ?? "33333333-3333-4333-8333-333333333333",
          memo: body.memo ?? null,
          enabled: body.enabled ?? true,
          createdAt: "2026-04-30T00:00:00Z",
          updatedAt: "2026-04-30T00:00:00Z"
        }),
        { headers: { "content-type": "application/json" }, status: init?.method === "POST" ? 201 : 200 }
      );
    }
  });

  await client.createRiderInsurance({
    enabled: true,
    insuranceItemId: "33333333-3333-4333-8333-333333333333",
    memo: "보험 연결 메모",
    riderId: "22222222-2222-4222-8222-222222222222"
  });
  await client.updateRiderInsurance("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { enabled: false, memo: "비활성 전환" });

  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    "/api/v1/rider-insurances",
    "/api/v1/rider-insurances/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  ]);
  assert.deepEqual(calls.map((call) => call.init?.method), ["POST", "PATCH"]);
  assert.deepEqual(Object.keys(JSON.parse(String(calls[0].init?.body))).sort(), ["enabled", "insuranceItemId", "memo", "riderId"]);
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { enabled: false, memo: "비활성 전환" });
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
});

test("battery station list request maps service stations to frontend labels", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              idx: 4,
              name: "강남 교체 스테이션",
              address: "서울 강남구 테헤란로 152",
              latitude: "37.5007",
              longitude: "127.0364",
              status: "ACTIVE",
              maxBatteryCapacity: 48,
              currentBatteryCount: 41,
              availableBatteryCount: 31,
              availableBatteryLabel: "31/48",
              capacityPercentage: 85,
              memo: "B1 우측 출입구",
              createdAt: "2026-04-30T00:00:00Z",
              updatedAt: "2026-04-30T00:00:00Z"
            }
          ],
          page: { number: 0, size: 20, totalItems: 1, totalPages: 1, hasNext: false, hasPrevious: false }
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    }
  });

  const page = await client.listBatteryStations({ page: 0, size: 20 });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/api/v1/battery-stations");
  assert.equal(url.searchParams.get("page"), "0");
  assert.equal(url.searchParams.get("size"), "20");
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
  assert.equal(page.items[0].slug, "44444444-4444-4444-8444-444444444444");
  assert.equal(page.items[0].status, "운영 중");
  assert.equal(page.items[0].availableBatteryLabel, "31/48");
  assert.equal(page.items[0].latitude, 37.5007);
  assert.equal(page.items[0].longitude, 127.0364);
});

test("battery station create/update/count methods use dedicated backend endpoints", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          id: "55555555-5555-4555-8555-555555555555",
          idx: 5,
          name: body.name ?? "강남 교체 스테이션",
          address: body.address ?? "서울 강남구 테헤란로 152",
          latitude: body.latitude ?? 37.5007,
          longitude: body.longitude ?? 127.0364,
          status: body.status ?? "ACTIVE",
          maxBatteryCapacity: body.maxBatteryCapacity ?? 48,
          currentBatteryCount: body.currentBatteryCount ?? 41,
          availableBatteryCount: body.availableBatteryCount ?? 31,
          availableBatteryLabel: `${body.availableBatteryCount ?? 31}/${body.maxBatteryCapacity ?? 48}`,
          capacityPercentage: 85,
          memo: body.memo ?? null,
          createdAt: "2026-04-30T00:00:00Z",
          updatedAt: "2026-04-30T00:00:00Z"
        }),
        { headers: { "content-type": "application/json" }, status: init?.method === "POST" ? 201 : 200 }
      );
    }
  });

  await client.createBatteryStation({
    address: "서울 강남구 테헤란로 152",
    availableBatteryCount: 31,
    currentBatteryCount: 41,
    latitude: 37.5007,
    longitude: 127.0364,
    maxBatteryCapacity: 48,
    memo: "B1 우측 출입구",
    name: "강남 교체 스테이션",
    status: "ACTIVE"
  });
  await client.updateBatteryStation("55555555-5555-4555-8555-555555555555", {
    address: "서울 강남구 테헤란로 153",
    latitude: 37.5008,
    longitude: 127.0365,
    memo: "주소 보정",
    name: "강남 교체 스테이션",
    status: "MAINTENANCE"
  });
  await client.updateBatteryStationCounts("55555555-5555-4555-8555-555555555555", {
    availableBatteryCount: 28,
    currentBatteryCount: 38,
    maxBatteryCapacity: 48,
    memo: "재고 보정",
    reason: "출고"
  });

  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    "/api/v1/battery-stations",
    "/api/v1/battery-stations/55555555-5555-4555-8555-555555555555",
    "/api/v1/battery-stations/55555555-5555-4555-8555-555555555555/battery-counts"
  ]);
  assert.deepEqual(calls.map((call) => call.init?.method), ["POST", "PATCH", "PATCH"]);
  assert.deepEqual(Object.keys(JSON.parse(String(calls[0].init?.body))).sort(), [
    "address",
    "availableBatteryCount",
    "currentBatteryCount",
    "latitude",
    "longitude",
    "maxBatteryCapacity",
    "memo",
    "name",
    "status"
  ]);
  assert.deepEqual(Object.keys(JSON.parse(String(calls[1].init?.body))).sort(), ["address", "latitude", "longitude", "memo", "name", "status"]);
  assert.deepEqual(Object.keys(JSON.parse(String(calls[2].init?.body))).sort(), ["availableBatteryCount", "currentBatteryCount", "maxBatteryCapacity", "memo", "reason"]);
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
});

test("invalid backend station status does not display as active", () => {
  assert.throws(
    () =>
      toFrontendBatteryStation({
        id: "66666666-6666-4666-8666-666666666666",
        idx: 6,
        name: "상태 오류 스테이션",
        address: "서울 강남구",
        latitude: 37.5,
        longitude: 127.0,
        status: "UNKNOWN",
        maxBatteryCapacity: 10,
        currentBatteryCount: 5,
        availableBatteryCount: 3,
        availableBatteryLabel: "3/10",
        capacityPercentage: 50,
        memo: null,
        createdAt: "2026-04-30T00:00:00Z",
        updatedAt: "2026-04-30T00:00:00Z"
      }),
    (error) =>
      error instanceof ServiceOpsApiError &&
      error.code === "SERVICE_OPS_UNSUPPORTED_STATION_STATUS" &&
      error.message.includes("Unsupported battery station status")
  );
});

test("equipment type list/create/update/delete use dedicated backend endpoints", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify(
          init?.method === "GET"
            ? {
                items: [
                  {
                    id: "11111111-1111-4111-8111-111111111111",
                    idx: 1,
                    name: "브레이크 패드",
                    description: "제동계 소모품",
                    enabled: true,
                    createdAt: "2026-04-30T00:00:00Z",
                    updatedAt: "2026-04-30T00:00:00Z"
                  }
                ],
                page: { number: 0, size: 20, totalItems: 1, totalPages: 1, hasNext: false, hasPrevious: false }
              }
            : {
                id: "11111111-1111-4111-8111-111111111111",
                idx: 1,
                name: body.name,
                description: body.description ?? null,
                enabled: body.enabled ?? true,
                createdAt: "2026-04-30T00:00:00Z",
                updatedAt: "2026-04-30T00:00:00Z"
              }
        ),
        { headers: { "content-type": "application/json" }, status: init?.method === "POST" ? 201 : 200 }
      );
    }
  });

  await client.listEquipmentTypes({ page: 0, size: 20 });
  await client.createEquipmentType({ description: "제동계 소모품", enabled: true, name: "브레이크 패드" });
  await client.updateEquipmentType("11111111-1111-4111-8111-111111111111", { description: "수정", enabled: false, name: "브레이크 패드" });
  await client.deleteEquipmentType("11111111-1111-4111-8111-111111111111");

  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    "/api/v1/equipment-types",
    "/api/v1/equipment-types",
    "/api/v1/equipment-types/11111111-1111-4111-8111-111111111111",
    "/api/v1/equipment-types/11111111-1111-4111-8111-111111111111"
  ]);
  assert.deepEqual(calls.map((call) => call.init?.method), ["GET", "POST", "PATCH", "DELETE"]);
  assert.deepEqual(Object.keys(JSON.parse(String(calls[1].init?.body))).sort(), ["description", "enabled", "name"]);
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
});

test("bike equipment create/update/remove use selector-backed lifecycle endpoints", async () => {
  const calls = [];
  const client = createServiceOpsApiClient({
    accessToken: "access-token",
    baseUrl: "http://localhost:8080",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          id: "22222222-2222-4222-8222-222222222222",
          idx: 2,
          bikeId: body.bikeId ?? "33333333-3333-4333-8333-333333333333",
          equipmentTypeId: body.equipmentTypeId ?? "44444444-4444-4444-8444-444444444444",
          equipmentLabel: body.equipmentLabel ?? "전륜 브레이크 패드",
          modelName: body.modelName ?? "BP-Urban-01",
          serialNumber: body.serialNumber ?? "BP-001",
          installedAt: body.installedAt ?? "2026-04-30T00:00:00Z",
          removedAt: body.removedAt ?? null,
          managementDueDate: body.managementDueDate ?? "2026-05-30",
          managementStatus: "NORMAL",
          managementNote: body.managementNote ?? null,
          memo: body.memo ?? null,
          createdAt: "2026-04-30T00:00:00Z",
          updatedAt: "2026-04-30T00:00:00Z"
        }),
        { headers: { "content-type": "application/json" }, status: init?.method === "POST" ? 201 : 200 }
      );
    }
  });

  await client.createBikeEquipment({
    bikeId: "33333333-3333-4333-8333-333333333333",
    equipmentLabel: "전륜 브레이크 패드",
    equipmentTypeId: "44444444-4444-4444-8444-444444444444",
    installedAt: "2026-04-30T00:00:00Z",
    managementDueDate: "2026-05-30",
    managementNote: "정기 점검",
    memo: "운영 메모",
    modelName: "BP-Urban-01",
    serialNumber: "BP-001"
  });
  await client.updateBikeEquipment("22222222-2222-4222-8222-222222222222", {
    equipmentLabel: "후륜 브레이크 패드",
    managementDueDate: "2026-06-30",
    managementNote: "교체 예정",
    memo: "수정 메모",
    modelName: "BP-Urban-02",
    serialNumber: "BP-002"
  });
  await client.removeBikeEquipment("22222222-2222-4222-8222-222222222222", {
    memo: "교체 완료",
    removedAt: "2026-05-01T00:00:00Z"
  });

  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    "/api/v1/bike-equipments",
    "/api/v1/bike-equipments/22222222-2222-4222-8222-222222222222",
    "/api/v1/bike-equipments/22222222-2222-4222-8222-222222222222/remove"
  ]);
  assert.deepEqual(calls.map((call) => call.init?.method), ["POST", "PATCH", "PATCH"]);
  assert.deepEqual(Object.keys(JSON.parse(String(calls[0].init?.body))).sort(), [
    "bikeId",
    "equipmentLabel",
    "equipmentTypeId",
    "installedAt",
    "managementDueDate",
    "managementNote",
    "memo",
    "modelName",
    "serialNumber"
  ]);
  assert.deepEqual(Object.keys(JSON.parse(String(calls[1].init?.body))).sort(), [
    "equipmentLabel",
    "managementDueDate",
    "managementNote",
    "memo",
    "modelName",
    "serialNumber"
  ]);
  assert.deepEqual(Object.keys(JSON.parse(String(calls[2].init?.body))).sort(), ["memo", "removedAt"]);
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer access-token");
});
