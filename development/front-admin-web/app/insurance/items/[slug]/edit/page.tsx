import { notFound } from "next/navigation";

import { updateInsuranceItemAction } from "@/app/insurance/items/actions";
import { InsuranceItemForm } from "@/components/insurance-items/InsuranceItemForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { loadInsuranceItemDetail } from "@/lib/services/insurance-item-data";

const statusMessage: Record<string, string> = {
  "save-error": "보험 항목 수정에 실패했습니다. 이름 중복 또는 백엔드 연결 상태를 확인하세요."
};

export default async function EditInsuranceItemPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadInsuranceItemDetail(slug);

  if (!detail) {
    notFound();
  }

  const item = detail.item;
  const updateAction = updateInsuranceItemAction.bind(null, item.slug);

  return (
    <div className="page-container">
      <PageHeader title="보험 항목 수정" description="보험 항목명, 설명, 사용 상태만 수정합니다. 보험 항목 ID는 입력받지 않습니다." />
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <InsuranceItemForm
        action={updateAction}
        cancelHref={`/insurance/items/${item.slug}`}
        defaultValues={{ description: item.description, enabled: item.enabled, name: item.name }}
        mode="수정"
        statusMessage={status ? statusMessage[status] : null}
      />
    </div>
  );
}
