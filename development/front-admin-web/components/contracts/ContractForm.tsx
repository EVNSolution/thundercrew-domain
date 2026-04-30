import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { ContractSelectionOption } from "@/lib/services/contract-data";

type ContractFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  options: {
    riders: ContractSelectionOption[];
    templates: ContractSelectionOption[];
    vehicles: ContractSelectionOption[];
  };
  statusMessage?: string | null;
};

export function ContractForm({ action, cancelHref = "/contracts", options, statusMessage }: ContractFormProps) {
  return (
    <form action={action} className="card" aria-label="계약 등록 폼">
      <div className="form-grid">
        <Field label="계약 대상 라이더" hint="rider_id 직접 입력 없이 이름/연락처 기준으로 선택합니다.">
          <select className="select" name="riderSelection" required>
            <option value="">라이더 선택</option>
            {options.riders.map((rider) => (
              <option key={rider.value} value={rider.value}>{rider.label}{rider.helper ? ` · ${rider.helper}` : ""}</option>
            ))}
          </select>
        </Field>
        <Field label="연결 차량" hint="vehicle_id 직접 입력 없이 차량번호/모델 기준으로 선택합니다.">
          <select className="select" name="bikeSelection" required>
            <option value="">차량 선택</option>
            {options.vehicles.map((vehicle) => (
              <option key={vehicle.value} value={vehicle.value}>{vehicle.label}{vehicle.helper ? ` · ${vehicle.helper}` : ""}</option>
            ))}
          </select>
        </Field>
        <Field label="계약 양식" hint="계약 기간과 종료일은 선택한 양식 기준으로 백엔드가 계산합니다.">
          <select className="select" name="contractTemplateSelection" required>
            <option value="">계약 양식 선택</option>
            {options.templates.map((template) => (
              <option key={template.value} value={template.value}>{template.label}</option>
            ))}
          </select>
        </Field>
        <Field label="계약 시작일시" hint="서울 시간(KST) 기준으로 저장합니다. 종료일시는 계약 양식 기간으로 자동 계산됩니다.">
          <input className="input" name="startAt" required type="datetime-local" />
        </Field>
      </div>
      <br />
      <Field label="운영 메모"><textarea className="input" name="memo" placeholder="계약 운영 메모" rows={4} /></Field>
      <p className="notice" style={{ marginTop: 16 }}>
        계약/라이더/차량/계약양식 ID는 입력받지 않습니다. 운영자는 사람이 읽을 수 있는 선택지만 사용하고, 저장 payload는 선택 UI 결과로 생성됩니다.
      </p>
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">계약 등록</button>
      </div>
    </form>
  );
}
