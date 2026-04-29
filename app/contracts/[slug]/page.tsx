import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { DetailActionPanel } from "@/components/ui/MockActions";
import { contracts } from "@/lib/services/mock-data";

export default async function ContractDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const contract = contracts.find((c) => c.slug === slug) ?? contracts[0];

  return (
    <div className="page-container">
      <PageHeader title={contract.contractType} description={`${contract.riderName} 계약 상세`} />
      <section className="card">
        <div className="detail-list">
          <div className="detail-row"><span>라이더</span><strong>{contract.riderName}</strong></div>
          <div className="detail-row"><span>기간</span><strong>{contract.startsAt} ~ {contract.endsAt}</strong></div>
          <div className="detail-row"><span>상태</span><Badge>{contract.status}</Badge></div>
          <div className="detail-row"><span>구역</span><strong>{contract.area}</strong></div>
        </div>
        <DetailActionPanel secondaryHref="/contracts" primaryLabel="계약 상태 변경" logLabel="계약 로그" feedbackMessage="계약 상태 변경 요청을 확인했습니다. MVP mock에서는 실제 저장 없이 피드백만 표시합니다." logItems={["계약 생성: 2026-03-01", "최근 상태 확인: 활성", "만료 30일 전 알림 대상 아님"]} />
      </section>
    </div>
  );
}
