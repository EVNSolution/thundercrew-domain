import {
  serviceOpsApiConfigured,
  type ServiceOpsTestMatching,
  type ServiceOpsTestRider,
  type ServiceOpsTestVehicle,
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type TestMatchingPageData = {
  vehicles: ServiceOpsTestVehicle[];
  riders: ServiceOpsTestRider[];
  matchings: ServiceOpsTestMatching[];
  notice?: string;
};

export async function loadTestMatchingData(): Promise<TestMatchingPageData> {
  if (!serviceOpsApiConfigured()) {
    return { vehicles: [], riders: [], matchings: [] };
  }
  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      vehicles: [],
      riders: [],
      matchings: [],
      notice: "세션이 없어 데이터를 불러올 수 없습니다.",
    };
  }
  try {
    const [vehicles, riders, matchings] = await Promise.all([
      client.listTestVehicles(),
      client.listTestRiders(),
      client.listTestMatchings(),
    ]);
    return { vehicles, riders, matchings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { vehicles: [], riders: [], matchings: [], notice: `로드 실패: ${message}` };
  }
}
