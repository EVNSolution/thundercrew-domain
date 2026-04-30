import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { InsuranceItem } from "@/types/domain";

type InsuranceItemFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  defaultValues?: Partial<Pick<InsuranceItem, "description" | "enabled" | "name">>;
  mode?: "등록" | "수정";
  statusMessage?: string | null;
};

export function InsuranceItemForm({ action, cancelHref = "/insurance/items", defaultValues, mode = "등록", statusMessage }: InsuranceItemFormProps) {
  return (
    <form action={action} className="card" aria-label={`보험 항목 ${mode} 폼`}>
      <div className="form-grid">
        <Field label="보험 항목명">
          <input className="input" defaultValue={defaultValues?.name ?? ""} maxLength={100} name="name" placeholder="예: 라이더 기본 보험" required />
        </Field>
        <Field label="사용 상태">
          <select className="select" defaultValue={String(defaultValues?.enabled ?? true)} name="enabled">
            <option value="true">사용</option>
            <option value="false">비활성</option>
          </select>
        </Field>
      </div>
      <br />
      <Field label="설명"><textarea className="input" defaultValue={defaultValues?.description ?? ""} name="description" placeholder="운영자가 구분할 수 있는 보험 항목 설명" rows={3} /></Field>
      <p className="notice" style={{ marginTop: 16 }}>보험 항목 ID는 DB가 자동 생성합니다. 라이더와의 연결은 보험 등록 화면에서 이름 기준 선택 UI로 처리합니다.</p>
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">보험 항목 {mode}</button>
      </div>
    </form>
  );
}
