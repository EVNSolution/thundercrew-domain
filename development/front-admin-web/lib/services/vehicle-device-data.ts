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
