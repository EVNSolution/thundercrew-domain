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
export default async function ManagementResourcesPage() {
  const [telemetryStatus, vehicles, riders, contracts] = await Promise.all([
    getTelemetryReceiveStatusAction(),
    listVehiclesAction(),
    listRidersAction(),
    listMatchingAction()
  ]);

  return (
    <div className="management-page">
      <ManagementSectionNav sections={SECTIONS} />
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
