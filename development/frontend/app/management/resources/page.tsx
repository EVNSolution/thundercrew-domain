import { ResourcesClient } from "@/components/management/ResourcesClient";
import { listVehiclesAction } from "@/app/management/vehicles/actions";
import { listRidersAction } from "@/app/management/riders/actions";
import { listMatchingAction } from "@/app/management/matching/actions";
import { listBoxAttachedBikeIdsAction } from "@/app/management/resources/actions";

export const dynamic = "force-dynamic";

/**
 * 자원 관리 — 목록 3종(차량/라이더/클리너/매칭)을 서버에서 한 번에 받아
 * ResourcesClient(필터 탭 골격)에 내려준다. 패널의 모든 변경(등록/수정/삭제/
 * 종료)은 `router.refresh()` 로 이 서버 컴포넌트를 재실행시켜 갱신한다.
 */
// redirect 기반 폼 액션(차량·라이더/클리너 상세 수정)의 실패는 ?status=... 로
// 돌아온다. 배너로 표시하지 않으면 저장 실패가 조용히 사라진다 — 특히
// "활성 매칭 중 용도/직무 변경 금지" 검증에 걸린 경우.
const STATUS_MESSAGES: Record<string, string> = {
  "update-error":
    "수정 사항을 저장하지 못했습니다. 입력 값과 매칭 제약(활성 매칭 중 용도·직무 변경 불가)을 확인하세요.",
  "create-error": "등록에 실패했습니다. 입력 값을 확인하세요.",
  "create-device-error": "등록은 됐지만 단말기 연동에 실패했습니다. 상세에서 다시 연동하세요.",
  "update-device-error": "저장은 됐지만 단말기 연동 변경에 실패했습니다."
};

export default async function ManagementResourcesPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status }, vehicles, riders, contracts, boxAttachedBikeIds] = await Promise.all([
    searchParams,
    listVehiclesAction(),
    listRidersAction(),
    listMatchingAction(),
    listBoxAttachedBikeIdsAction()
  ]);
  const statusMessage = status ? STATUS_MESSAGES[status] ?? null : null;

  return (
    <ResourcesClient
      vehicles={vehicles}
      riders={riders}
      contracts={contracts}
      boxAttachedBikeIds={boxAttachedBikeIds}
      statusMessage={statusMessage}
    />
  );
}
