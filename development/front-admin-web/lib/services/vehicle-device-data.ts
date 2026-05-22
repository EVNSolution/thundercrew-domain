import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

/**
 * `/overview` 의 차량 상세 다이얼로그가 현재 부착된 단말기(IMEI) 를 확인하기
 * 위해 lazy 로 호출하는 loader. 차량 한 대에 활성 installation 은 1:1 이라는
 * 백엔드 보장을 그대로 따른다.
 *
 * 현재 백엔드의 `listBikeDeviceInstallations` 가 bikeId 필터 파라미터를 안
 * 받기 때문에 페이지 한 장(200개)을 받아 클라이언트 측에서 매칭한다. MVP
 * 단말기 수에선 충분하지만, 단말기가 200대를 넘어가기 전에 backend 측에
 * `?bikeId=` 필터 또는 `/bike-device-installations/by-bike/{bikeId}` 같은
 * 전용 조회를 추가해야 한다.
 */
export type VehicleDeviceResult = {
  bikeId: string;
  /** 현재 부착된 단말기의 deviceUid (UI 상 "IMEI"). 없으면 null. */
  deviceUid: string | null;
  /** 현재 활성 installation 의 row id. 해제 시 이 id 로 `removeBikeDeviceInstallation` 호출. */
  installationId: string | null;
};

export async function loadVehicleDevice(bikeId: string): Promise<VehicleDeviceResult> {
  const empty: VehicleDeviceResult = { bikeId, deviceUid: null, installationId: null };
  if (!serviceOpsApiConfigured()) return empty;
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return empty;

  try {
    const page = await client.listBikeDeviceInstallations({ page: 0, size: 200 });
    const active = page.items.find((row) => row.bikeId === bikeId && row.removedAt === null);
    if (!active) return empty;
    const device = await client.getDevice(active.deviceId);
    return { bikeId, deviceUid: device.deviceUid, installationId: active.id };
  } catch {
    // 조회 실패 = 잘 모름 상태. UI 는 "—" 로 표시하고 운영자가 새로 입력하면
    // 부착 액션이 그 입력 대로 진행된다 — 백엔드가 어차피 active 1:1 보장이라
    // 신규 attach 가 기존 attach 를 자동으로 close 한다.
    return empty;
  }
}

/**
 * `/overview` 차량 테이블의 IMEI 컬럼이 N+1 호출 없이 한 번에 채워지도록
 * 페이지 진입 시점에 모든 active 설치를 일괄 조회한다.
 *
 * 백엔드 `listBikeDeviceInstallations` 가 bikeId 필터를 받지 않으므로 한
 * 페이지(200건)를 받아 클라이언트에서 매핑. `listDevices` 도 같은 방식으로
 * id→deviceUid 사전을 구성해 두 결과를 조인한다. MVP 규모(< 200 단말기)에서
 * 충분하고, 그 이상이 되기 전엔 서버 측 `?bikeId=` 필터를 추가해야 한다.
 */
export type VehicleDeviceMap = {
  /** bikeId → 현재 부착된 단말기의 deviceUid (IMEI 노출용). */
  deviceUidByBikeId: Map<string, string>;
  /** bikeId → 활성 installation row id. (현재는 표시 용도는 없고 후속 detach 액션이 쓸 수 있게 보존.) */
  installationIdByBikeId: Map<string, string>;
};

const EMPTY_DEVICE_MAP: VehicleDeviceMap = {
  deviceUidByBikeId: new Map(),
  installationIdByBikeId: new Map()
};

export async function loadVehicleDeviceMap(): Promise<VehicleDeviceMap> {
  if (!serviceOpsApiConfigured()) return EMPTY_DEVICE_MAP;
  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) return EMPTY_DEVICE_MAP;

  try {
    const [installationsPage, devicesPage] = await Promise.all([
      client.listBikeDeviceInstallations({ page: 0, size: 200 }),
      client.listDevices({ page: 0, size: 200 })
    ]);
    const deviceUidById = new Map<string, string>();
    for (const device of devicesPage.items) {
      deviceUidById.set(device.id, device.deviceUid);
    }
    const deviceUidByBikeId = new Map<string, string>();
    const installationIdByBikeId = new Map<string, string>();
    for (const installation of installationsPage.items) {
      if (installation.removedAt) continue;
      const uid = deviceUidById.get(installation.deviceId);
      if (uid) deviceUidByBikeId.set(installation.bikeId, uid);
      installationIdByBikeId.set(installation.bikeId, installation.id);
    }
    return { deviceUidByBikeId, installationIdByBikeId };
  } catch {
    return EMPTY_DEVICE_MAP;
  }
}
