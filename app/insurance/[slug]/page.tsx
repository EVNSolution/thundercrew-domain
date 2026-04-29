import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { DetailActionPanel } from "@/components/ui/MockActions";
import { insurancePolicies } from "@/lib/services/mock-data";

export default async function InsuranceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = insurancePolicies.find((p) => p.slug === slug) ?? insurancePolicies[0];

  return (
    <div className="page-container">
      <PageHeader title={`${policy.provider} 보험`} description={policy.holderLabel} />
      <section className="card">
        <div className="detail-list">
          <div className="detail-row"><span>대상 구분</span><strong>{policy.targetType}</strong></div>
          <div className="detail-row"><span>증권번호</span><strong>{policy.policyNumber}</strong></div>
          <div className="detail-row"><span>기간</span><strong>{policy.startsAt} ~ {policy.endsAt}</strong></div>
          <div className="detail-row"><span>상태</span><Badge>{policy.status}</Badge></div>
        </div>
        <DetailActionPanel secondaryHref="/insurance" primaryLabel="보험 상태 변경" logLabel="보험 로그" feedbackMessage="보험 상태 변경 요청을 확인했습니다. MVP mock에서는 실제 저장 없이 피드백만 표시합니다." logItems={["증권 확인 완료", "만료일 알림 기준 등록", "최근 상태: 정상"]} />
      </section>
    </div>
  );
}
