import Link from "next/link";
import { notFound } from "next/navigation";

import { terminateContractAction, updateContractMemoAction } from "@/app/contracts/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/FormField";
import { loadContractDetail } from "@/lib/services/contract-data";

const statusMessage: Record<string, string> = {
  created: "계약이 등록되었습니다.",
  "mock-updated": "서비스 API가 연결되지 않아 메모 저장을 mock 피드백으로만 처리했습니다.",
  "mock-terminated": "서비스 API가 연결되지 않아 계약 종료를 mock 피드백으로만 처리했습니다.",
  "save-error": "계약 메모 저장에 실패했습니다. 백엔드 연결 상태를 확인하세요.",
  terminated: "계약이 종료 처리되었습니다.",
  "terminate-error": "계약 종료 처리에 실패했습니다. 종료일시와 계약 상태를 확인하세요.",
  updated: "계약 메모가 수정되었습니다."
};

export default async function ContractDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    status?: string;
    autoInsurance?: string;
    autoInsuranceId?: string;
    autoInsuranceSkipReason?: string;
  }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const detail = await loadContractDetail(slug);

  if (!detail) {
    notFound();
  }

  const contract = detail.contract;
  const message = sp.status ? statusMessage[sp.status] : null;
  const autoInsuranceFlash = formatAutoInsuranceFlash(
    sp.autoInsurance,
    sp.autoInsuranceId,
    sp.autoInsuranceSkipReason
  );
  const memoAction = updateContractMemoAction.bind(null, slug);
  const terminateAction = terminateContractAction.bind(null, slug);

  return (
    <div className="page-container">
      <BackToListLink href="/contracts" />
      <PageHeader title={contract.contractType} description={`${contract.riderName} 계약 상세`} />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {autoInsuranceFlash ? (
        <p className="action-feedback" role="status">{autoInsuranceFlash}</p>
      ) : null}
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <section className="content-grid">
        <div className="card">
          <h2>계약 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>라이더</span><strong>{contract.riderLabel ?? contract.riderName}</strong></div>
            <div className="detail-row"><span>차량</span><strong>{contract.bikeLabel ?? "차량 연결 후 표시"}</strong></div>
            <div className="detail-row"><span>계약 양식</span><strong>{contract.contractType}</strong></div>
            <div className="detail-row"><span>기간</span><strong>{contract.startsAt} ~ {contract.endsAt}</strong></div>
            <div className="detail-row"><span>상태</span><Badge>{contract.status}</Badge></div>
            <div className="detail-row"><span>구역</span><strong>{contract.area}</strong></div>
            {contract.memo ? <div className="detail-row"><span>메모</span><strong>{contract.memo}</strong></div> : null}
            {contract.autoIssuedRiderInsuranceId ? (
              <div className="detail-row"><span>자동 발급 보험 ID</span><strong>{contract.autoIssuedRiderInsuranceId}</strong></div>
            ) : null}
            {contract.autoInsuranceSkipReason ? (
              <div className="detail-row"><span>자동 보험 미발급 사유</span><strong>{autoInsuranceSkipLabel(contract.autoInsuranceSkipReason)}</strong></div>
            ) : null}
            {contract.terminatedAt ? <div className="detail-row"><span>종료일시</span><strong>{contract.terminatedAt}</strong></div> : null}
            {contract.terminatedReason ? <div className="detail-row"><span>종료 사유</span><strong>{contract.terminatedReason}</strong></div> : null}
          </div>
          <div className="form-actions">
            <Link className="button-secondary" href="/contracts">목록</Link>
            <Link className="button-secondary" href="/contracts/new">새 계약 등록</Link>
          </div>
        </div>
        <aside className="detail-panel">
          <h2>계약 작업</h2>
          <form action={memoAction} className="action-panel">
            <Field label="운영 메모"><textarea className="input" defaultValue={contract.memo ?? ""} name="memo" placeholder="계약 운영 메모" rows={4} /></Field>
            <div className="form-actions">
              <button className="button-primary" type="submit">메모 저장</button>
            </div>
          </form>
          <hr style={{ border: 0, borderTop: "1px solid var(--color-border)", margin: "20px 0" }} />
          {contract.status === "종료" ? (
            <p className="notice">이미 종료된 계약입니다. 종료 이력은 보존됩니다.</p>
          ) : (
            <form action={terminateAction} className="action-panel">
              <Field label="계약 종료일시" hint="서울 시간(KST) 기준으로 종료 처리합니다."><input className="input" name="terminatedAt" required type="datetime-local" /></Field>
              <Field label="종료 사유"><input className="input" maxLength={200} name="terminatedReason" placeholder="예: 계약 만료, 운영 종료" /></Field>
              <p className="notice">계약 종료는 이력을 보존하는 상태 변경입니다. 계약 ID 직접 입력 없이 현재 상세 대상에만 적용됩니다.</p>
              <div className="form-actions">
                <button className="button-ghost-mint" type="submit">계약 종료</button>
              </div>
            </form>
          )}
        </aside>
      </section>
    </div>
  );
}

function autoInsuranceSkipLabel(reason: string): string {
  switch (reason) {
    case "TEMPLATE_NOT_OPTED_IN":
      return "계약 양식에서 자동 보험을 선택하지 않음";
    case "DEFAULT_INSURANCE_ITEM_MISSING":
      return "계약 양식에 기본 보험 항목이 지정되지 않음";
    case "DEFAULT_INSURANCE_ITEM_NOT_FOUND":
      return "기본 보험 항목을 찾을 수 없음";
    case "DEFAULT_INSURANCE_ITEM_DELETED":
      return "기본 보험 항목이 삭제됨";
    case "DEFAULT_INSURANCE_ITEM_DISABLED":
      return "기본 보험 항목이 비활성 상태";
    case "RIDER_INSURANCE_ALREADY_LINKED":
      return "라이더가 동일 보험 항목에 이미 연결되어 있어 추가 발급 안 됨";
    case "RIDER_INSURANCE_DUPLICATE_ON_INSERT":
      return "동시 등록과의 중복으로 추가 발급 안 됨";
    default:
      return reason;
  }
}

function formatAutoInsuranceFlash(
  outcome: string | undefined,
  autoInsuranceId: string | undefined,
  skipReason: string | undefined
): string | null {
  if (outcome === "issued" && autoInsuranceId) {
    return `자동 보험 발급됨 — RiderInsurance ID ${autoInsuranceId}.`;
  }
  if (outcome === "skip" && skipReason) {
    return `자동 보험 발급 SKIP — ${autoInsuranceSkipLabel(skipReason)}.`;
  }
  return null;
}
