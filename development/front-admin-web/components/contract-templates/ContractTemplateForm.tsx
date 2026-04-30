import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { ContractTemplate } from "@/types/domain";

type ContractTemplateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  defaultValues?: Partial<Pick<ContractTemplate, "description" | "durationMinutes" | "enabled" | "name" | "unlimited">>;
  mode?: "등록" | "수정";
  statusMessage?: string | null;
};

export function ContractTemplateForm({
  action,
  cancelHref = "/contract-templates",
  defaultValues,
  mode = "등록",
  statusMessage
}: ContractTemplateFormProps) {
  const duration = splitDuration(defaultValues?.durationMinutes ?? null);
  const durationMode = defaultValues?.unlimited || defaultValues?.durationMinutes === null ? "unlimited" : "limited";

  return (
    <form action={action} className="card" aria-label={`계약 양식 ${mode} 폼`}>
      <div className="form-grid">
        <Field label="계약 양식명">
          <input className="input" defaultValue={defaultValues?.name ?? ""} maxLength={100} name="name" placeholder="예: 표준 12일" required />
        </Field>
        <Field label="사용 상태">
          <select className="select" defaultValue={String(defaultValues?.enabled ?? true)} name="enabled">
            <option value="true">사용</option>
            <option value="false">비활성</option>
          </select>
        </Field>
        <Field label="기간 방식" hint="무제한은 종료일 없이 운영자가 별도 종료할 때까지 유지합니다.">
          <select className="select" defaultValue={durationMode} name="durationMode">
            <option value="limited">기간 지정</option>
            <option value="unlimited">무제한</option>
          </select>
        </Field>
        <Field label="기간 · 일">
          <input className="input" defaultValue={duration.days || ""} min={0} name="durationDays" placeholder="예: 12" type="number" />
        </Field>
        <Field label="기간 · 시간">
          <input className="input" defaultValue={duration.hours || ""} min={0} name="durationHours" placeholder="예: 6" type="number" />
        </Field>
        <Field label="기간 · 분">
          <input className="input" defaultValue={duration.minutes || ""} min={0} name="durationMinutesPart" placeholder="예: 30" type="number" />
        </Field>
      </div>
      <br />
      <Field label="설명"><textarea className="input" defaultValue={defaultValues?.description ?? ""} name="description" placeholder="운영자가 구분할 수 있는 계약 양식 설명" rows={3} /></Field>
      <p className="notice" style={{ marginTop: 16 }}>
        계약 양식 ID는 DB가 자동 생성합니다. 운영자는 양식명, 기간, 설명, 사용 상태만 입력합니다. 라이더/차량 연결은 계약 등록 화면에서 선택 UI로 처리합니다.
      </p>
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">계약 양식 {mode}</button>
      </div>
    </form>
  );
}

function splitDuration(durationMinutes: number | null): { days: number; hours: number; minutes: number } {
  if (!durationMinutes) {
    return { days: 0, hours: 0, minutes: 0 };
  }

  return {
    days: Math.floor(durationMinutes / 1440),
    hours: Math.floor((durationMinutes % 1440) / 60),
    minutes: durationMinutes % 60
  };
}
