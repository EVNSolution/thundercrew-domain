import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { Device } from "@/types/domain";

type DeviceFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  defaultValues?: Partial<Pick<Device, "deviceUid" | "enabled" | "manufacturer" | "memo" | "modelName">>;
  mode?: "등록" | "수정";
  statusMessage?: string | null;
};

export function DeviceForm({ action, cancelHref = "/devices", defaultValues, mode = "등록", statusMessage }: DeviceFormProps) {
  return (
    <form action={action} className="card" aria-label={`단말 ${mode} 폼`}>
      <div className="form-grid">
        <Field label="단말 UID" hint="단말기가 자체 보유한 유니크 ID를 입력합니다. DB ID가 아닙니다.">
          <input className="input" defaultValue={defaultValues?.deviceUid ?? ""} maxLength={100} name="deviceUid" placeholder="예: TDEV-SEOUL-4821" required />
        </Field>
        <Field label="사용 상태">
          <select className="select" defaultValue={String(defaultValues?.enabled ?? true)} name="enabled">
            <option value="true">사용</option>
            <option value="false">비활성</option>
          </select>
        </Field>
        <Field label="제조사"><input className="input" defaultValue={defaultValues?.manufacturer ?? ""} maxLength={100} name="manufacturer" placeholder="예: ThunderDevice" /></Field>
        <Field label="모델명"><input className="input" defaultValue={defaultValues?.modelName ?? ""} maxLength={100} name="modelName" placeholder="예: TD-100" /></Field>
      </div>
      <br />
      <Field label="운영 메모"><textarea className="input" defaultValue={defaultValues?.memo ?? ""} name="memo" placeholder="운영자가 볼 내부 메모" rows={3} /></Field>
      <p className="notice" style={{ marginTop: 16 }}>단말 DB ID는 서버가 자동 생성합니다. 설치 연결은 차량번호와 단말 UID 선택 UI에서만 처리합니다.</p>
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">단말 {mode}</button>
      </div>
    </form>
  );
}
