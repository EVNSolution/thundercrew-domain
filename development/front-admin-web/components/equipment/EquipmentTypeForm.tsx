import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { EquipmentType } from "@/types/domain";

type EquipmentTypeFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  defaultValues?: Partial<Pick<EquipmentType, "description" | "enabled" | "name">>;
  mode?: "등록" | "수정";
  statusMessage?: string | null;
};

export function EquipmentTypeForm({ action, cancelHref = "/equipment", defaultValues, mode = "등록", statusMessage }: EquipmentTypeFormProps) {
  return (
    <form action={action} className="card" aria-label={`장비 종류 ${mode} 폼`}>
      <div className="form-grid">
        <Field label="장비 종류명">
          <input className="input" defaultValue={defaultValues?.name ?? ""} maxLength={100} name="name" placeholder="예: 브레이크 패드" required />
        </Field>
        <Field label="사용 상태">
          <select className="select" defaultValue={String(defaultValues?.enabled ?? true)} name="enabled">
            <option value="true">사용</option>
            <option value="false">비활성</option>
          </select>
        </Field>
      </div>
      <br />
      <Field label="설명"><textarea className="input" defaultValue={defaultValues?.description ?? ""} name="description" placeholder="운영자가 구분할 수 있는 장비 종류 설명" rows={3} /></Field>
      <p className="notice" style={{ marginTop: 16 }}>장비 종류 ID는 DB가 자동 생성합니다. 운영자는 종류명, 설명, 사용 상태만 관리합니다.</p>
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">장비 종류 {mode}</button>
      </div>
    </form>
  );
}
