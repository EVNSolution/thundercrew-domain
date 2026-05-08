import { PageHeader } from "@/components/layout/PageHeader";
import { ManagementSubnav } from "@/components/layout/ManagementSubnav";
import { ContractsPanel } from "@/components/management/ContractsPanel";
import { loadContractList } from "@/lib/services/contract-data";

const statusMessage: Record<string, string> = {
  created: "계약이 등록되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 화면으로 돌아왔습니다.",
  terminated: "계약이 종료 처리되었습니다.",
  updated: "계약 메모가 수정되었습니다."
};

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data] = await Promise.all([searchParams, loadContractList()]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader
        title="계약 관리"
        description="라이더-차량 계약 목록, 등록, 메모 수정과 종료 처리를 관리합니다. 계약 기간은 선택한 계약 양식 기준으로 계산됩니다."
        actionHref="/contracts/new"
        actionLabel="계약 등록"
      />
      <ManagementSubnav activeHref="/contracts" groupKey="contracts" />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <ContractsPanel data={data} />
    </div>
  );
}
