import { PageHeader } from "@/components/layout/PageHeader";
import { ManagementSubnav } from "@/components/layout/ManagementSubnav";
import { RidersPanel } from "@/components/management/RidersPanel";
import { loadRiderList } from "@/lib/services/rider-data";
import { loadRiderMatchingSnapshot } from "@/lib/services/rider-matching-snapshot-data";

const statusMessage: Record<string, string> = {
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 화면으로 돌아왔습니다.",
  created: "라이더가 등록되었습니다.",
  deleted: "라이더가 비활성 삭제 처리되었습니다.",
  updated: "라이더 정보가 수정되었습니다."
};

export default async function RidersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data, matching] = await Promise.all([
    searchParams,
    loadRiderList(),
    loadRiderMatchingSnapshot()
  ]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader
        actionHref="/riders/new"
        actionLabel="라이더 등록"
        description="라이더 기본 정보, 소속, 담당 구역과 계약/보험 연결 정보를 조회합니다."
        title="라이더 관리"
      />
      <ManagementSubnav activeHref="/riders" groupKey="riders" />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <RidersPanel
        data={data}
        matchedRiderIds={matching.matchedRiderIds}
        insuredRiderIds={matching.insuredRiderIds}
      />
    </div>
  );
}
