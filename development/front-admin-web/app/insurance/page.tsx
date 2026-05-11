import { PageHeader } from "@/components/layout/PageHeader";
import { ManagementSubnav } from "@/components/layout/ManagementSubnav";
import { InsurancePanel } from "@/components/management/InsurancePanel";
import { loadInsuranceList } from "@/lib/services/insurance-data";

const statusMessage: Record<string, string> = {
  created: "보험 연결이 등록되었습니다.",
  deleted: "보험 연결이 비활성 삭제 처리되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 화면으로 돌아왔습니다.",
  updated: "보험 연결 정보가 수정되었습니다."
};

export default async function InsurancePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data] = await Promise.all([searchParams, loadInsuranceList()]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader title="보험 관리" description="라이더 기준 보험 항목 연결과 활성 상태를 관리합니다." actionHref="/insurance/new" actionLabel="보험 등록" />
      <ManagementSubnav activeHref="/insurance" groupKey="riders" />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <InsurancePanel data={data} />
    </div>
  );
}
