import { NextResponse } from "next/server";

import { loadVehicleMaintenanceBundle } from "@/lib/services/vehicle-maintenance-data";

/**
 * 차량 floating 상세 패널이 open 시 호출하는 lazy fetch. 한 차량의 정비 카탈로그
 * (engineType 매칭) + 정비 이력을 한 번에 묶어서 반환. cookie-bound session 은
 * 서버 측에 머무르고 응답만 JSON 으로 내려준다.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ bikeId: string }> }
) {
  const { bikeId } = await context.params;
  const bundle = await loadVehicleMaintenanceBundle(bikeId);
  return NextResponse.json(bundle, {
    headers: { "Cache-Control": "no-store" }
  });
}
