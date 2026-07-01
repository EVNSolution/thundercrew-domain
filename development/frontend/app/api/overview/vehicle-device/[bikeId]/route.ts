import { NextResponse } from "next/server";

import { loadVehicleDevice } from "@/lib/services/vehicle-device-data";

/**
 * 차량 상세 다이얼로그가 open 시 호출하는 lazy fetch — 현재 부착된 단말기
 * (IMEI = deviceUid) + 활성 installation id 를 반환. service-ops 쿠키는 서버
 * 측에 그대로 두고 dashboard map-state 라우트들과 같은 패턴.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ bikeId: string }> }
) {
  const { bikeId } = await context.params;
  const result = await loadVehicleDevice(bikeId);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" }
  });
}
