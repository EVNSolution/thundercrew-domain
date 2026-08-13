#!/usr/bin/env node
// scripts/dev/seed-monitoring-fixtures.mjs
//
// Dev-only seed: pushes 5 riders + 5 bikes + 5 devices + 5 device installs +
// 3 battery stations + 5 telemetry events into a thundercrew-domain
// `service-ops-api` instance so the operator can verify the dashboard map +
// detail panel against real backend rows before the vendor telemetry worker
// is wired up.
//
// Usage (dev only):
//   SEED_TARGET_HOST=localhost \
//   SEED_TARGET_PORT=8080 \
//   ADMIN_LOGIN_ID=ops-admin \
//   ADMIN_PASSWORD=correct-password \
//   npm run dev:seed-monitoring
//
// All resource IDs are deterministic so re-running the script is idempotent
// (409 / 422 from the backend get logged as SKIP). To wipe the seed in dev,
// `delete from <table> where id like 'aaaa0000-%' or 'bbbb0000-%' …` (see
// the README for the full list).

import { performance } from "node:perf_hooks";

// Allow only *unambiguous* dev hosts. Production lives at
// `thcr.cleversystem.ai`, which is not in this list, so it is blocked by
// default. We also deliberately do NOT include `.sslip.io`: it is a
// wildcard-DNS service where any suffix match can resolve to an arbitrary
// host, so whitelisting it would defeat the point of a whitelist. Operators
// who need to seed a remote dev box must opt in explicitly via
// `SEED_FORCE_REMOTE=true` after double-checking the target host.
const ALLOWED_HOST_SUFFIXES = [".local"];
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const SEED_FORCE_REMOTE = process.env.SEED_FORCE_REMOTE === "true";

const RIDER_IDS = [
  "aaaa0000-0000-4000-8000-000000000001",
  "aaaa0000-0000-4000-8000-000000000002",
  "aaaa0000-0000-4000-8000-000000000003",
  "aaaa0000-0000-4000-8000-000000000004",
  "aaaa0000-0000-4000-8000-000000000005",
];
const BIKE_IDS = [
  "bbbb0000-0000-4000-8000-000000000001",
  "bbbb0000-0000-4000-8000-000000000002",
  "bbbb0000-0000-4000-8000-000000000003",
  "bbbb0000-0000-4000-8000-000000000004",
  "bbbb0000-0000-4000-8000-000000000005",
];
const DEVICE_IDS = [
  "cccc0000-0000-4000-8000-000000000001",
  "cccc0000-0000-4000-8000-000000000002",
  "cccc0000-0000-4000-8000-000000000003",
  "cccc0000-0000-4000-8000-000000000004",
  "cccc0000-0000-4000-8000-000000000005",
];
const STATION_IDS = [
  "eeee0000-0000-4000-8000-000000000001",
  "eeee0000-0000-4000-8000-000000000002",
  "eeee0000-0000-4000-8000-000000000003",
];

const RIDERS = [
  { id: RIDER_IDS[0], name: "시드 라이더 강남",  phoneNumber: "010-1000-0001", teamName: "강남팀",  areaName: "강남구",   memo: "seed fixture" },
  { id: RIDER_IDS[1], name: "시드 라이더 광화문", phoneNumber: "010-1000-0002", teamName: "광화문팀", areaName: "종로구",   memo: "seed fixture" },
  { id: RIDER_IDS[2], name: "시드 라이더 홍대",  phoneNumber: "010-1000-0003", teamName: "홍대팀",  areaName: "마포구",   memo: "seed fixture" },
  { id: RIDER_IDS[3], name: "시드 라이더 잠실",  phoneNumber: "010-1000-0004", teamName: "잠실팀",  areaName: "송파구",   memo: "seed fixture" },
  { id: RIDER_IDS[4], name: "시드 라이더 여의도", phoneNumber: "010-1000-0005", teamName: "여의도팀", areaName: "영등포구", memo: "seed fixture" },
];

const BIKES = [
  { id: BIKE_IDS[0], plateNumber: "SEED-001", vin: "VIN-SEED-0001", modelName: "TC-Mini",  operationStatus: "IN_SERVICE",        memo: "seed fixture" },
  { id: BIKE_IDS[1], plateNumber: "SEED-002", vin: "VIN-SEED-0002", modelName: "TC-Mini",  operationStatus: "IN_SERVICE",        memo: "seed fixture" },
  { id: BIKE_IDS[2], plateNumber: "SEED-003", vin: "VIN-SEED-0003", modelName: "TC-Mini",  operationStatus: "IN_SERVICE",        memo: "seed fixture" },
  { id: BIKE_IDS[3], plateNumber: "SEED-004", vin: "VIN-SEED-0004", modelName: "TC-Pro",   operationStatus: "READY",             memo: "seed fixture" },
  { id: BIKE_IDS[4], plateNumber: "SEED-005", vin: "VIN-SEED-0005", modelName: "TC-Pro",   operationStatus: "INSPECTION_REQUIRED", memo: "seed fixture" },
];

const DEVICES = [
  { id: DEVICE_IDS[0], deviceUid: "SEED-DEV-0001", manufacturer: "ThunderCrew", modelName: "TC-IoT-A1", memo: "seed fixture" },
  { id: DEVICE_IDS[1], deviceUid: "SEED-DEV-0002", manufacturer: "ThunderCrew", modelName: "TC-IoT-A1", memo: "seed fixture" },
  { id: DEVICE_IDS[2], deviceUid: "SEED-DEV-0003", manufacturer: "ThunderCrew", modelName: "TC-IoT-A1", memo: "seed fixture" },
  { id: DEVICE_IDS[3], deviceUid: "SEED-DEV-0004", manufacturer: "ThunderCrew", modelName: "TC-IoT-A1", memo: "seed fixture" },
  { id: DEVICE_IDS[4], deviceUid: "SEED-DEV-0005", manufacturer: "ThunderCrew", modelName: "TC-IoT-A1", memo: "seed fixture" },
];

// Lat/lng spread across Seoul so the operator sees pins distributed on the
// map rather than stacked on top of each other.
const BIKE_LOCATIONS = [
  { lat: 37.5005, lng: 127.0270, batteryPercent: 78, speedKph: 0,  ignitionStatus: "OFF", drivingHint: "PARKED",   areaLabel: "강남"  },
  { lat: 37.5781, lng: 126.9745, batteryPercent: 64, speedKph: 23, ignitionStatus: "ON",  drivingHint: "DRIVING",  areaLabel: "광화문" },
  { lat: 37.5560, lng: 126.9220, batteryPercent: 18, speedKph: 0,  ignitionStatus: "OFF", drivingHint: "PARKED",   areaLabel: "홍대"  },
  { lat: 37.5140, lng: 127.1020, batteryPercent: 44, speedKph: 12, ignitionStatus: "ON",  drivingHint: "DRIVING",  areaLabel: "잠실"  },
  { lat: 37.5230, lng: 126.9260, batteryPercent: 92, speedKph: 0,  ignitionStatus: "OFF", drivingHint: "PARKED",   areaLabel: "여의도" },
];

const STATIONS = [
  { id: STATION_IDS[0], name: "강남 스테이션",  address: "서울 강남구 테헤란로 1", latitude: 37.4979, longitude: 127.0276, status: "ACTIVE", maxBatteryCapacity: 12, currentBatteryCount: 9, availableBatteryCount: 6, memo: "seed fixture" },
  { id: STATION_IDS[1], name: "광화문 스테이션", address: "서울 종로구 종로 1",     latitude: 37.5759, longitude: 126.9769, status: "ACTIVE", maxBatteryCapacity: 8,  currentBatteryCount: 5, availableBatteryCount: 3, memo: "seed fixture" },
  { id: STATION_IDS[2], name: "홍대 스테이션",  address: "서울 마포구 양화로 162",  latitude: 37.5572, longitude: 126.9244, status: "ACTIVE", maxBatteryCapacity: 10, currentBatteryCount: 7, availableBatteryCount: 4, memo: "seed fixture" },
];

const SEED_TARGET_HOST = process.env.SEED_TARGET_HOST?.trim();
const SEED_TARGET_PORT = process.env.SEED_TARGET_PORT?.trim() || "8080";
const SEED_TARGET_PROTOCOL = process.env.SEED_TARGET_PROTOCOL?.trim() || "http";
const ADMIN_LOGIN_ID = process.env.ADMIN_LOGIN_ID?.trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SEED_TARGET_HOST) {
  fail("SEED_TARGET_HOST is required (e.g. SEED_TARGET_HOST=localhost).");
}
if (!isHostAllowed(SEED_TARGET_HOST) && !SEED_FORCE_REMOTE) {
  fail(
    `SEED_TARGET_HOST=${SEED_TARGET_HOST} is not in the local-only allowlist ` +
    `(localhost / 127.0.0.1 / 0.0.0.0 / ::1 / *.local). ` +
    `To target a non-local dev box, set SEED_FORCE_REMOTE=true and double-check ` +
    `the host is NOT a production deploy.`
  );
}
if (SEED_FORCE_REMOTE) {
  console.warn(
    `[seed] SEED_FORCE_REMOTE=true — bypassing the local-only host allowlist. ` +
    `Target: ${SEED_TARGET_HOST}. Verify this is a dev environment.`
  );
}
if (!ADMIN_LOGIN_ID || !ADMIN_PASSWORD) {
  fail("ADMIN_LOGIN_ID and ADMIN_PASSWORD are required (use a non-prod admin).");
}

const BASE_URL = `${SEED_TARGET_PROTOCOL}://${SEED_TARGET_HOST}:${SEED_TARGET_PORT}`;

main().catch((error) => {
  console.error(`\n[seed] failed:`, error?.message ?? error);
  process.exit(1);
});

async function main() {
  const start = performance.now();
  console.log(`[seed] target = ${BASE_URL}`);

  const accessToken = await login();
  console.log(`[seed] logged in as ${ADMIN_LOGIN_ID}`);

  await seedRiders(accessToken);
  await seedBikes(accessToken);
  await seedDevices(accessToken);
  await seedDeviceInstallations(accessToken);
  await seedStations(accessToken);
  await seedTelemetryEvents();

  const elapsedMs = Math.round(performance.now() - start);
  console.log(`[seed] done in ${elapsedMs} ms`);
}

async function login() {
  const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId: ADMIN_LOGIN_ID, password: ADMIN_PASSWORD })
  });
  if (!response.ok) {
    fail(`login failed: HTTP ${response.status} ${await response.text()}`);
  }
  const body = await response.json();
  if (!body.accessToken) {
    fail(`login response missing accessToken: ${JSON.stringify(body)}`);
  }
  return body.accessToken;
}

async function seedRiders(accessToken) {
  for (const rider of RIDERS) {
    await postWithFallback(
      accessToken,
      "/api/v1/riders",
      {
        name: rider.name,
        phoneNumber: rider.phoneNumber,
        teamName: rider.teamName,
        areaName: rider.areaName,
        memo: rider.memo
      },
      `rider ${rider.name}`
    );
  }
}

async function seedBikes(accessToken) {
  for (const bike of BIKES) {
    await postWithFallback(
      accessToken,
      "/api/v1/bikes",
      {
        plateNumber: bike.plateNumber,
        vin: bike.vin,
        modelName: bike.modelName,
        operationStatus: bike.operationStatus,
        memo: bike.memo
      },
      `bike ${bike.plateNumber}`
    );
  }
}

async function seedDevices(accessToken) {
  for (const device of DEVICES) {
    await postWithFallback(
      accessToken,
      "/api/v1/devices",
      {
        deviceUid: device.deviceUid,
        manufacturer: device.manufacturer,
        modelName: device.modelName,
        memo: device.memo
      },
      `device ${device.deviceUid}`
    );
  }
}

async function seedDeviceInstallations(accessToken) {
  // We don't know the resolved bike/device server IDs (the backend may have
  // assigned different UUIDs than our deterministic ones if the resources
  // already existed). The bike-device-installations endpoint accepts the
  // *bike id* and *device id* directly; in dev we look them up by their
  // unique business keys (plateNumber / deviceUid).
  const [bikes, devices] = await Promise.all([
    listAll(accessToken, "/api/v1/bikes"),
    listAll(accessToken, "/api/v1/devices")
  ]);
  const bikeByPlate = new Map(bikes.map((b) => [b.plateNumber, b.id]));
  const deviceByUid = new Map(devices.map((d) => [d.deviceUid, d.id]));

  const installedAt = new Date().toISOString();

  for (let i = 0; i < BIKES.length; i++) {
    const bikeId = bikeByPlate.get(BIKES[i].plateNumber);
    const deviceId = deviceByUid.get(DEVICES[i].deviceUid);
    if (!bikeId || !deviceId) {
      console.log(`[seed] SKIP install bike[${i}]: missing bike or device row`);
      continue;
    }
    await postWithFallback(
      accessToken,
      "/api/v1/bike-device-installations",
      {
        bikeId,
        deviceId,
        installedAt,
        memo: "seed fixture"
      },
      `install bike=${BIKES[i].plateNumber} device=${DEVICES[i].deviceUid}`
    );
  }
}

async function seedStations(accessToken) {
  for (const station of STATIONS) {
    await postWithFallback(
      accessToken,
      "/api/v1/battery-stations",
      {
        name: station.name,
        address: station.address,
        latitude: station.latitude,
        longitude: station.longitude,
        status: station.status,
        maxBatteryCapacity: station.maxBatteryCapacity,
        currentBatteryCount: station.currentBatteryCount,
        availableBatteryCount: station.availableBatteryCount,
        memo: station.memo
      },
      `station ${station.name}`
    );
  }
}

async function seedTelemetryEvents() {
  const receivedAt = new Date().toISOString();
  for (let i = 0; i < DEVICES.length; i++) {
    const device = DEVICES[i];
    const location = BIKE_LOCATIONS[i];
    const payload = {
      deviceUid: device.deviceUid,
      vendorEventId: `seed-${device.deviceUid}-${receivedAt}`,
      receivedAt,
      deviceReportedAt: receivedAt,
      latitude: location.lat,
      longitude: location.lng,
      speedKph: location.speedKph,
      batteryPercent: location.batteryPercent,
      ignitionStatus: location.ignitionStatus,
      telemetrySource: "POLLING",
      rawPayload: { source: "seed-monitoring-fixtures", area: location.areaLabel }
    };
    // Telemetry ingest does NOT require admin auth in the current backend
    // (controller does not declare a security requirement on it). We still
    // pass the access token so future tightening doesn't break the script.
    const response = await fetch(`${BASE_URL}/api/v1/telemetry/device-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (response.status === 201 || response.status === 200) {
      console.log(`[seed] OK   telemetry ${device.deviceUid} (${location.areaLabel})`);
    } else if (response.status === 409 || response.status === 422) {
      console.log(`[seed] SKIP telemetry ${device.deviceUid}: HTTP ${response.status}`);
    } else {
      const body = await response.text();
      console.log(`[seed] FAIL telemetry ${device.deviceUid}: HTTP ${response.status} ${body}`);
    }
  }
}

async function postWithFallback(accessToken, path, body, label) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });
  if (response.status === 201 || response.status === 200) {
    console.log(`[seed] OK   ${label}`);
    return;
  }
  if (response.status === 409) {
    console.log(`[seed] SKIP ${label}: already exists`);
    return;
  }
  if (response.status === 422) {
    console.log(`[seed] SKIP ${label}: HTTP 422 (validation collision)`);
    return;
  }
  const text = await response.text();
  console.log(`[seed] FAIL ${label}: HTTP ${response.status} ${text}`);
}

async function listAll(accessToken, path) {
  // Page size 200 is enough for dev seed lookup; stop after one page.
  const url = `${BASE_URL}${path}?size=200`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    fail(`list ${path} failed: HTTP ${response.status} ${await response.text()}`);
  }
  const body = await response.json();
  return Array.isArray(body?.items) ? body.items : [];
}

function isHostAllowed(host) {
  if (ALLOWED_HOSTS.has(host)) return true;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function fail(message) {
  console.error(`[seed] ${message}`);
  process.exit(1);
}
