import type { ServiceOpsMaintenanceCategory } from "@/lib/services/service-ops-api";

/**
 * 차량의 wheelType + engineType 을 단일 ServiceOpsMaintenanceCategory 로 변환한다.
 * 이 값이 그 차량에 어떤 정비 카탈로그가 붙는지를 통째로 결정한다
 * (`summarizeMaintenanceByBike`, 차량 상세 정비 섹션).
 *
 * **엔진은 세 갈래다.** `engine === "ICE"` 같은 이분법으로 쓰면 LPG 가 조용히
 * 반대편으로 떨어진다. 그러면 LPG 차량에 전기 전용 품목(체인 교체, 모터오일)이
 * 붙고 엔진 계열 품목과 LPG 봄베 검사가 통째로 사라진다 — 화면 어디에도 오류가
 * 안 뜨고 목록만 조용히 틀린다. 같은 실수가 세 파일에서 반복돼서 이 변환을 한
 * 곳으로 모으고 테스트로 고정했다.
 *
 * 미입력 / 알 수 없는 값은 TWO_WHEEL_ELECTRIC (가장 흔한 차종) 으로 fallback.
 */
export function bikeMaintenanceCategory(
  wheel: string | null | undefined,
  engine: string | null | undefined
): ServiceOpsMaintenanceCategory {
  const four = wheel === "FOUR_WHEEL";
  if (engine === "LPG") return four ? "FOUR_WHEEL_LPG" : "TWO_WHEEL_LPG";
  if (engine === "ICE") return four ? "FOUR_WHEEL_ICE" : "TWO_WHEEL_ICE";
  return four ? "FOUR_WHEEL_ELECTRIC" : "TWO_WHEEL_ELECTRIC";
}
