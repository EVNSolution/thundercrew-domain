import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadContractTemplateList } from "@/lib/services/contract-template-data";

const statusMessage: Record<string, string> = {
  created: "계약 양식이 등록되었습니다.",
  deleted: "계약 양식이 비활성 삭제 처리되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 목록으로 돌아왔습니다.",
  updated: "계약 양식이 수정되었습니다."
};

export default async function ContractTemplatesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data] = await Promise.all([searchParams, loadContractTemplateList()]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader
        actionHref="/contract-templates/new"
        actionLabel="계약 양식 등록"
        description="운영자가 계약 양식을 만들고, 계약 등록 시 선택 UI로 연결합니다. 계약 양식 ID는 입력받지 않습니다."
        title="계약 양식 관리"
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <div className="table-card">
        {data.templates.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>양식명</th>
                <th>기간</th>
                <th>사용 상태</th>
                <th>보호</th>
                <th>표시 순번</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {data.templates.map((template) => (
                <tr key={template.slug}>
                  <td>{template.name}<br /><span className="muted-text">{template.description ?? "설명 없음"}</span></td>
                  <td>{template.durationLabel}</td>
                  <td><Badge tone={template.enabled ? "active" : "muted"}>{template.enabled ? "사용" : "비활성"}</Badge></td>
                  <td><Badge tone={template.systemTemplate ? "outline" : "muted"}>{template.systemTemplate ? "시스템" : "운영자"}</Badge></td>
                  <td>{template.idx ?? "mock"}</td>
                  <td><Link className="button-secondary" href={`/contract-templates/${template.slug}`}>보기</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            actionLabel="계약 양식 등록"
            description="아직 등록된 계약 양식이 없습니다. 이름과 기간만 먼저 정의할 수 있습니다."
            href="/contract-templates/new"
            title="계약 양식 없음"
          />
        )}
      </div>
    </div>
  );
}
