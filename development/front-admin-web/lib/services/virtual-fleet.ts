import type {
  FrontendDashboardBikePin,
  FrontendRider,
  FrontendVehicle
} from "@/lib/services/service-ops-api";

/**
 * 데모 모드의 가상 fleet — fleet 시뮬레이션이 켜질 때 한 번에 생성되는
 * 결정성 있는 가짜 데이터 스냅샷. 실제 DB / backend 와 무관, 클라이언트
 * 메모리에만 존재. 같은 seedString 이면 모든 호출에 같은 결과.
 *
 * Plate / 모델명 / phone prefix 가 99 / "데모 가상" 으로 운영자가 식별
 * 가능하게 박혀 있어 실제 데이터와 절대 혼동되지 않는다.
 */

export type VirtualFleet = {
  vehicles: FrontendVehicle[];
  riders: FrontendRider[];
  bikePins: FrontendDashboardBikePin[];
  /** bikeId → riderId. 가상 차량별 1:1 매칭. */
  bikeActiveRiderById: Map<string, string>;
  /** riderId → bikeId. 위의 역인덱스. */
  riderActiveBikeId: Map<string, string>;
  /** riderId → plateNumber. */
  riderActiveBikePlate: Map<string, string>;
  /** riderId → { name, phone }. 차량 상세 패널의 라이더 라벨에 사용. */
  riderInfoById: Map<string, { name: string; phone: string }>;
};

const SEOUL_LAT_MIN = 37.44;
const SEOUL_LAT_MAX = 37.65;
const SEOUL_LNG_MIN = 126.87;
const SEOUL_LNG_MAX = 127.10;

const FAMILY_NAMES = ["김", "이", "박", "정", "최", "조", "윤", "장", "임", "한"];
const GIVEN_NAMES = [
  "민수", "지영", "준호", "수빈", "예은",
  "도윤", "서아", "하준", "지우", "윤서"
];

/** 문자열 → 0..2^32-1 deterministic 정수 (cheap, not cryptographic). */
function hash32(seed: string, salt: number): number {
  let h = salt | 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** hash32 결과를 0..1 사이 float 로 매핑. */
function hashUnit(seed: string, salt: number): number {
  return (hash32(seed, salt) % 10_000) / 10_000;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function pad4(n: number): string {
  return n.toString().padStart(4, "0");
}

function makeBikePin(
  bikeId: string,
  plateNumber: string,
  modelName: string,
  riderLabel: string,
  origin: { lat: number; lng: number },
  batteryPercent: number,
  nowIso: string
): FrontendDashboardBikePin {
  return {
    bikeId,
    slug: bikeId,
    bikeIdx: null,
    plateNumber,
    modelName,
    operationStatus: "IN_SERVICE",
    activeRiderLabel: riderLabel,
    deviceId: null,
    lastReceivedAt: nowIso,
    latitude: origin.lat,
    longitude: origin.lng,
    speedKph: 0,
    batteryPercent: Math.round(batteryPercent),
    ignitionStatus: "OFF",
    telemetrySource: "SIMULATED",
    drivingStatus: "PARKED",
    connectionStatus: "ONLINE",
    batteryStatus: batteryPercent < 20 ? "CRITICAL" : batteryPercent <= 50 ? "LOW" : "NORMAL",
    pinLabel: plateNumber
  };
}

function makeVehicle(
  bikeId: string,
  plateNumber: string,
  modelName: string,
  riderName: string,
  origin: { lat: number; lng: number },
  batteryPercent: number,
  nowIso: string
): FrontendVehicle {
  return {
    slug: bikeId,
    id: bikeId,
    idx: null,
    plateNumber,
    vin: null,
    model: modelName,
    engineType: "ELECTRIC",
    status: "운행",
    operationStatus: "IN_SERVICE",
    ignitionBlocked: false,
    assignmentStatus: "ASSIGNED",
    batteryPercent: Math.round(batteryPercent),
    riderName,
    locationLabel: `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`,
    lastSeenAt: nowIso,
    memo: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    source: "mock"
  };
}

function makeRider(
  riderId: string,
  name: string,
  phone: string,
  nowIso: string
): FrontendRider {
  return {
    slug: riderId,
    id: riderId,
    idx: null,
    name,
    phone,
    team: "데모 팀",
    area: "데모 권역",
    status: "활동",
    joinedAt: nowIso,
    appAccountLinked: false,
    appAccountId: null,
    appLinkedAt: null,
    appLinkStatus: "UNLINKED",
    memo: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    source: "mock"
  };
}

export function generateVirtualFleet(input: {
  count?: number;
  seedString?: string;
  nowIso?: string;
} = {}): VirtualFleet {
  const count = input.count ?? 20;
  const seedString = input.seedString ?? "demo-fleet-2026";
  const nowIso = input.nowIso ?? new Date().toISOString();

  const vehicles: FrontendVehicle[] = [];
  const riders: FrontendRider[] = [];
  const bikePins: FrontendDashboardBikePin[] = [];
  const bikeActiveRiderById = new Map<string, string>();
  const riderActiveBikeId = new Map<string, string>();
  const riderActiveBikePlate = new Map<string, string>();
  const riderInfoById = new Map<string, { name: string; phone: string }>();

  for (let i = 1; i <= count; i++) {
    const bikeId = `virtual-bike-${pad2(i)}`;
    const riderId = `virtual-rider-${pad2(i)}`;
    const plateNumber = `99서${pad4(i)}`;
    const modelName = `데모 가상 ${i}호기`;
    const idSeed = `${seedString}|${i}`;

    const lat = SEOUL_LAT_MIN + hashUnit(idSeed, 1) * (SEOUL_LAT_MAX - SEOUL_LAT_MIN);
    const lng = SEOUL_LNG_MIN + hashUnit(idSeed, 2) * (SEOUL_LNG_MAX - SEOUL_LNG_MIN);
    const battery = 70 + hashUnit(idSeed, 3) * 25; // 70..95

    const familyName = FAMILY_NAMES[hash32(idSeed, 4) % FAMILY_NAMES.length];
    const givenName = GIVEN_NAMES[hash32(idSeed, 5) % GIVEN_NAMES.length];
    const riderName = `${familyName}${givenName}`;
    const phoneMid = pad4(hash32(idSeed, 6) % 10_000);
    const phoneTail = pad4(hash32(idSeed, 7) % 10_000);
    const phone = `010-99${phoneMid.slice(2)}-${phoneTail}`;

    bikePins.push(makeBikePin(bikeId, plateNumber, modelName, riderName, { lat, lng }, battery, nowIso));
    vehicles.push(makeVehicle(bikeId, plateNumber, modelName, riderName, { lat, lng }, battery, nowIso));
    riders.push(makeRider(riderId, riderName, phone, nowIso));

    bikeActiveRiderById.set(bikeId, riderId);
    riderActiveBikeId.set(riderId, bikeId);
    riderActiveBikePlate.set(riderId, plateNumber);
    riderInfoById.set(riderId, { name: riderName, phone });
  }

  return {
    vehicles,
    riders,
    bikePins,
    bikeActiveRiderById,
    riderActiveBikeId,
    riderActiveBikePlate,
    riderInfoById
  };
}
