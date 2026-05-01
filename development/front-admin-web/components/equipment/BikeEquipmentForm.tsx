import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { BikeEquipment, EquipmentType } from "@/types/domain";
import type { FrontendVehicle } from "@/lib/services/service-ops-api";

type BikeEquipmentFormValues = Pick<
  BikeEquipment,
  | "equipmentLabel"
  | "managementDueDate"
  | "managementNote"
  | "memo"
  | "modelName"
  | "serialNumber"
> & { installedAt?: string };

type BikeEquipmentFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  defaultValues?: Partial<BikeEquipmentFormValues>;
  equipmentTypes?: EquipmentType[];
  mode?: "등록" | "수정";
  statusMessage?: string | null;
  vehicles?: Array<Pick<FrontendVehicle, "model" | "plateNumber" | "slug" | "status">>;
};

export function BikeEquipmentForm({
  action,
  cancelHref = "/equipment",
  defaultValues,
  equipmentTypes = [],
  mode = "등록",
  statusMessage,
  vehicles = []
}: BikeEquipmentFormProps) {
  const isCreateMode = mode === "등록";

  return (
    <form action={action} className="card" aria-label={`바이크 장비 ${mode} 폼`}>
      <div className="form-grid">
        {isCreateMode ? (
          <>
            <Field label="차량 선택" hint="차량번호와 모델 기준으로 선택합니다. DB ID를 직접 입력하지 않습니다.">
              <select className="select" name="bikeSelection" required>
                <option value="">차량 선택</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.slug} value={vehicle.slug}>{vehicle.plateNumber} · {vehicle.model} · {vehicle.status}</option>
                ))}
              </select>
            </Field>
            <Field label="장비 종류 선택" hint="장비 종류명 기준으로 선택합니다. FK ID를 직접 입력하지 않습니다.">
              <select className="select" name="equipmentTypeSelection" required>
                <option value="">장비 종류 선택</option>
                {equipmentTypes.map((type) => (
                  <option key={type.id ?? type.slug} value={type.id ?? type.slug}>{type.name}{type.enabled ? "" : " · 비활성"}</option>
                ))}
              </select>
            </Field>
            <Field label="설치일시"><input className="input" defaultValue={defaultValues?.installedAt ?? ""} name="installedAt" required type="datetime-local" /></Field>
          </>
        ) : null}
        <Field label="장비 표시명"><input className="input" defaultValue={defaultValues?.equipmentLabel ?? ""} maxLength={100} name="equipmentLabel" placeholder="예: 전륜 브레이크 패드" /></Field>
        <Field label="모델명"><input className="input" defaultValue={defaultValues?.modelName ?? ""} maxLength={100} name="modelName" placeholder="예: BP-Urban-01" /></Field>
        <Field label="시리얼 번호"><input className="input" defaultValue={defaultValues?.serialNumber ?? ""} maxLength={100} name="serialNumber" placeholder="제조사 시리얼" /></Field>
        <Field label="관리 기한"><input className="input" defaultValue={defaultValues?.managementDueDate ?? ""} name="managementDueDate" required type="date" /></Field>
      </div>
      <br />
      <Field label="관리 메모"><textarea className="input" defaultValue={defaultValues?.managementNote ?? ""} name="managementNote" placeholder="기한 관리 기준 또는 점검 메모" rows={3} /></Field>
      <br />
      <Field label="운영 메모"><textarea className="input" defaultValue={defaultValues?.memo ?? ""} name="memo" placeholder="운영자가 볼 내부 메모" rows={3} /></Field>
      <p className="notice" style={{ marginTop: 16 }}>바이크 장비 ID는 DB가 자동 생성합니다. 차량과 장비 종류는 사람이 읽을 수 있는 선택 UI로 연결합니다.</p>
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">바이크 장비 {mode}</button>
      </div>
    </form>
  );
}
