import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { InsuranceSelectionOption } from "@/lib/services/insurance-data";

type InsuranceFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  options: {
    items: InsuranceSelectionOption[];
    riders: InsuranceSelectionOption[];
  };
  statusMessage?: string | null;
};

export function InsuranceForm({ action, cancelHref = "/insurance", options, statusMessage }: InsuranceFormProps) {
  return (
    <form action={action} className="card" aria-label="보험 등록 폼">
      <div className="form-grid">
        <Field label="보험 대상 라이더" hint="rider_id 직접 입력 없이 이름/연락처 기준으로 선택합니다.">
          <select className="select" name="riderSelection" required>
            <option value="">라이더 선택</option>
            {options.riders.map((rider) => (
              <option key={rider.value} value={rider.value}>{rider.label}{rider.helper ? ` · ${rider.helper}` : ""}</option>
            ))}
          </select>
        </Field>
        <Field label="보험 항목" hint="insurance_id 직접 입력 없이 운영자가 등록한 보험 항목을 선택합니다.">
          <select className="select" name="insuranceItemSelection" required>
            <option value="">보험 항목 선택</option>
            {options.items.map((item) => (
              <option key={item.value} value={item.value}>{item.label}{item.helper ? ` · ${item.helper}` : ""}</option>
            ))}
          </select>
        </Field>
        <Field label="보험 상태">
          <select className="select" defaultValue="true" name="enabled">
            <option value="true">정상</option>
            <option value="false">비활성</option>
          </select>
        </Field>
      </div>
      <br />
      <Field label="운영 메모"><textarea className="input" name="memo" placeholder="보험 연결 관련 운영 메모" rows={4} /></Field>
      <p className="notice" style={{ marginTop: 16 }}>
        현재 service-ops backend 보험 범위는 라이더-보험 항목 연결입니다. 증권번호/보험기간/차량 보험은 후속 확장 범위이며, 이 폼에서는 ID 직접 입력 없이 선택 UI만 사용합니다.
      </p>
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">보험 등록</button>
      </div>
    </form>
  );
}
