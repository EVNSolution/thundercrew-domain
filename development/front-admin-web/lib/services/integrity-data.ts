import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import {
  type IntegrityDataResult,
  mockIntegrityData,
  toFrontendIntegrityData
} from "@/lib/services/integrity-data-core";
import { type ServiceOpsApiError, serviceOpsApiConfigured } from "@/lib/services/service-ops-api";

export async function loadIntegrityReferenceChecks(): Promise<IntegrityDataResult> {
  if (!serviceOpsApiConfigured()) {
    return mockIntegrityData("SERVICE_OPS_API_BASE_URL이 없어 mock 무결성 점검 데이터를 표시합니다. 백엔드 연결 후 실제 reference check로 전환됩니다.");
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return mockIntegrityData("서비스 API 세션 쿠키가 없어 mock 무결성 점검 데이터를 표시합니다. 관리자 로그인 후 실제 점검 결과로 전환됩니다.");
  }

  try {
    const scan = await client.getIntegrityReferenceChecks();
    return toFrontendIntegrityData(scan, "service-ops");
  } catch (error) {
    return mockIntegrityData(`서비스 API 무결성 점검 조회 실패로 mock 데이터를 표시합니다.${formatServiceOpsError(error)}`);
  }
}

function formatServiceOpsError(error: unknown): string {
  const serviceError = error as Partial<ServiceOpsApiError>;
  if (serviceError?.status) {
    return ` (${serviceError.status}${serviceError.code ? `/${serviceError.code}` : ""})`;
  }

  return "";
}
