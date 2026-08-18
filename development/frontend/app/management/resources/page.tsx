import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";
import { AuditLogManagementPanel } from "@/components/management/AuditLogManagementPanel";
import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";
import { TelemetryReceiveControl } from "@/components/management/TelemetryReceiveControl";
import { getTelemetryReceiveStatusAction } from "@/app/management/telemetry/actions";
import { listVehiclesAction } from "@/app/management/vehicles/actions";
import { listRidersAction } from "@/app/management/riders/actions";
import { listMatchingAction } from "@/app/management/matching/actions";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "mgmt-vehicles", label: "차량" },
  { id: "mgmt-riders", label: "이용자" },
  { id: "mgmt-matching", label: "매칭" },
  { id: "mgmt-logs", label: "작업 로그" }
];

/**
 * 자원 관리 — 목록 3종(차량/이용자/매칭)을 서버에서 한 번에 받아 props 로
 * 내려준다. 패널의 모든 변경(등록/수정/삭제/종료)은 `router.refresh()` 로
 * 이 서버 컴포넌트를 재실행시켜 갱신한다 — 클라이언트 별도 fetch 없음.
 *
 * 차량·이용자 목록은 매칭 표의 생성 다이얼로그와 차량 상세의 라이더 컨텍스트
 * 역참조에도 쓰인다.
 */
// redirect 기반 폼 액션(차량·이용자 상세 수정)의 실패는 ?status=... 로
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
  const [{ status }, telemetryStatus, vehicles, riders, contracts] = await Promise.all([
    searchParams,
    getTelemetryReceiveStatusAction(),
    listVehiclesAction(),
    listRidersAction(),
    listMatchingAction()
  ]);
  const statusMessage = status ? STATUS_MESSAGES[status] ?? null : null;

  return (
    <div className="management-page">
      <ManagementSectionNav sections={SECTIONS} />
      {statusMessage ? (
        <p role="alert" className="mgmt-status-banner">
          {statusMessage}
        </p>
      ) : null}
      <TelemetryReceiveControl initialActive={telemetryStatus?.active ?? false} />
      <section id="mgmt-vehicles" className="management-anchor">
        <VehiclesManagementPanel
          vehicles={vehicles}
          riders={riders}
          contracts={contracts}
          exportUrl="/api/management/vehicles/export"
        />
      </section>
      <section id="mgmt-riders" className="management-anchor">
        <RidersManagementPanel riders={riders} exportUrl="/api/management/riders/export" />
      </section>
      <section id="mgmt-matching" className="management-anchor">
        <MatchingManagementPanel
          contracts={contracts}
          vehicles={vehicles}
          riders={riders}
          exportUrl="/api/management/matching/export"
          logExportUrl="/api/management/matching/log-export"
        />
      </section>
      <section id="mgmt-logs" className="management-anchor">
        <AuditLogManagementPanel />
      </section>
    </div>
  );
}
