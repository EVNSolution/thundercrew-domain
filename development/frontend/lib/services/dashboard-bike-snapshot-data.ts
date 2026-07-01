import {
  type ServiceOpsApiError,
  type ServiceOpsBikeSnapshot,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type BikeSnapshotResult = {
  bikeId: string;
  data: ServiceOpsBikeSnapshot | null;
  /**
   * "시동 방지" 토글의 현재 상태. snapshot endpoint 가 자체적으로 안 내려주므로
   * 별도로 vehicle 조회해서 받아 와서 합친다. 조회 실패 시 false 로 두면
   * 운영자가 토글을 켜서 다시 박을 수 있게 된다 — 패널이 "잘 모름" 상태로
   * 멈추는 것보단 낫다.
   */
  ignitionBlocked: boolean;
  source: "service-ops" | "mock";
  notice?: string;
};

/**
 * Loader for the per-bike join snapshot. Mirrors the dashboard map-state
 * loader pattern: returns {@code data: null} on every fallback (no API base,
 * no session, fetch failed, 404) so the detail panel can keep rendering the
 * BikePin info it already has and surface a small notice.
 */
export async function loadBikeSnapshot(bikeId: string): Promise<BikeSnapshotResult> {
  if (!serviceOpsApiConfigured()) {
    return {
      bikeId,
      data: null,
      ignitionBlocked: false,
      source: "mock"
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      bikeId,
      data: null,
      ignitionBlocked: false,
      source: "mock",
      notice:
        "관리자 세션이 없어 차량 상세 데이터를 표시할 수 없습니다."
    };
  }

  // snapshot 과 vehicle 을 병렬로 받는다. vehicle 은 `ignitionBlocked` 단일
  // 필드만 필요하지만 별도 가벼운 엔드포인트가 없어 전체 객체를 받는다 —
  // 한 번의 round-trip 이라 비용은 무시 가능. vehicle 실패는 snapshot 의
  // 성공/실패와 독립적으로 처리해서, 둘 중 한 쪽이 실패해도 가능한 만큼
  // 정보를 보여준다.
  const [snapshotSettled, vehicleSettled] = await Promise.allSettled([
    client.getBikeSnapshot(bikeId),
    client.getVehicle(bikeId)
  ]);

  const ignitionBlocked =
    vehicleSettled.status === "fulfilled" ? vehicleSettled.value.ignitionBlocked ?? false : false;

  if (snapshotSettled.status === "fulfilled") {
    return {
      bikeId,
      data: snapshotSettled.value,
      ignitionBlocked,
      source: "service-ops"
    };
  }

  return {
    bikeId,
    data: null,
    ignitionBlocked,
    source: "mock",
    notice: `차량 상세 조회 실패.${formatServiceOpsError(snapshotSettled.reason)}`
  };
}

function formatServiceOpsError(error: unknown): string {
  const apiError = error as Partial<ServiceOpsApiError> | undefined;
  if (apiError?.code) {
    return ` (${apiError.code})`;
  }
  if (error instanceof Error) {
    return ` (${error.message})`;
  }
  return "";
}
