import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { FrontendVehicle, ServiceOpsBikeOperationStatus } from "@/lib/services/service-ops-api";

export const vehicleStatusOptions: Array<{ label: string; value: ServiceOpsBikeOperationStatus }> = [
  { label: "대기", value: "READY" },
  { label: "운행 중", value: "IN_SERVICE" },
  { label: "수리", value: "REPAIRING" },
  { label: "점검 필요", value: "INSPECTION_REQUIRED" }
];

type VehicleFormValues = Pick<FrontendVehicle, "memo" | "model" | "operationStatus" | "plateNumber" | "vin">;

type VehicleFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  defaultValues?: Partial<VehicleFormValues>;
  mode?: "등록" | "수정";
  statusMessage?: string | null;
};

export function VehicleForm({ action, cancelHref = "/vehicles", defaultValues, mode = "등록", statusMessage }: VehicleFormProps) {
  const isCreateMode = mode === "등록";

  return (
    <form action={action} className="card" aria-label={`차량 ${mode} 폼`}>
      <div className="form-grid">
        <Field label="차량번호">
          <input className="input" defaultValue={defaultValues?.plateNumber ?? ""} maxLength={50} name="plateNumber" placeholder="예: 서울A-1001" required />
        </Field>
        <Field label="차대번호/VIN">
          <input className="input" defaultValue={defaultValues?.vin ?? ""} maxLength={100} name="vin" placeholder="예: VIN-BIKE-001" required />
        </Field>
        <Field label="모델">
          <input className="input" defaultValue={defaultValues?.model ?? ""} maxLength={100} name="modelName" placeholder="예: Thunder M1" />
        </Field>
        {isCreateMode ? (
          <Field label="초기 차체 상태">
            <select className="select" defaultValue={defaultValues?.operationStatus ?? "READY"} name="operationStatus">
              {vehicleStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="현재 차체 상태" hint="상태 변경은 상세 화면의 전용 상태 변경 영역에서 처리합니다.">
            <input className="input" disabled value={vehicleStatusOptions.find((status) => status.value === defaultValues?.operationStatus)?.label ?? "대기"} />
          </Field>
        )}
      </div>
      <br />
      <Field label="운영 메모"><textarea className="input" defaultValue={defaultValues?.memo ?? ""} name="memo" placeholder="운영자가 볼 내부 메모" rows={4} /></Field>
      <p className="notice" style={{ marginTop: 16 }}>
        라이더/단말기/계약 연결은 ID 직접 입력이 아니라 각 도메인의 선택 UI에서 별도 처리합니다. 이 폼은 차량 기본 정보와 차체 상태만 다룹니다.
      </p>
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">차량 {mode}</button>
      </div>
    </form>
  );
}
