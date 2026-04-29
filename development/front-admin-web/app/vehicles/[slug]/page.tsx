import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { DetailActionPanel } from "@/components/ui/MockActions";
import { vehicles } from "@/lib/services/mock-data";

export default async function VehicleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = vehicles.find((v) => v.slug === slug) ?? vehicles[0];

  return (
    <div className="page-container">
      <PageHeader title={vehicle.plateNumber} description="차량 상세, 상태 변경, 라이더 배정 화면입니다." actionHref={`/vehicles/${vehicle.slug}/edit`} actionLabel="수정" />
      <section className="content-grid">
        <div className="card">
          <h2>차량 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>모델</span><strong>{vehicle.model}</strong></div>
            <div className="detail-row"><span>상태</span><Badge>{vehicle.status}</Badge></div>
            <div className="detail-row"><span>배정</span><strong>{vehicle.riderName ?? vehicle.assignmentStatus}</strong></div>
            <div className="detail-row"><span>배터리</span><strong>{vehicle.batteryPercent}%</strong></div>
            <div className="detail-row"><span>위치</span><strong>{vehicle.locationLabel}</strong></div>
          </div>
          <DetailActionPanel secondaryHref="/vehicles" primaryLabel="상태 변경" logLabel="운행 로그" feedbackMessage="차량 상태 변경 요청을 확인했습니다. MVP mock에서는 실제 저장 없이 피드백만 표시합니다." logItems={[`최근 위치: ${vehicle.locationLabel}`, `배터리 확인: ${vehicle.batteryPercent}%`, `최근 보고: ${vehicle.lastSeenAt}`]} />
        </div>
        <aside className="detail-panel"><h2>ID 입력 금지 확인</h2><p>배정 변경은 차량번호와 라이더 이름/연락처 선택 UI로 처리합니다. 내부 PK/FK는 화면에 입력칸으로 노출하지 않습니다.</p></aside>
      </section>
    </div>
  );
}
