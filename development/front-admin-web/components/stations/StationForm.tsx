import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { BatteryStation } from "@/types/domain";
import type { ServiceOpsStationStatus } from "@/lib/services/service-ops-api";

export const stationStatusOptions: Array<{ label: BatteryStation["status"]; value: ServiceOpsStationStatus }> = [
  { label: "운영 중", value: "ACTIVE" },
  { label: "점검 중", value: "MAINTENANCE" },
  { label: "운영 중지", value: "INACTIVE" }
];

type StationFormValues = Pick<
  BatteryStation,
  | "address"
  | "availableBatteryCount"
  | "currentBatteryCount"
  | "latitude"
  | "longitude"
  | "maxBatteryCapacity"
  | "memo"
  | "name"
  | "stationStatus"
>;

type StationFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  defaultValues?: Partial<StationFormValues>;
  mode?: "등록" | "수정";
  statusMessage?: string | null;
};

export function StationForm({ action, cancelHref = "/stations", defaultValues, mode = "등록", statusMessage }: StationFormProps) {
  const isCreateMode = mode === "등록";

  return (
    <form action={action} className="card" aria-label={`스테이션 ${mode} 폼`}>
      <div className="form-grid">
        <Field label="스테이션명">
          <input className="input" defaultValue={defaultValues?.name ?? ""} maxLength={100} name="name" placeholder="예: 강남 교체 스테이션" required />
        </Field>
        <Field label="주소">
          <input className="input" defaultValue={defaultValues?.address ?? ""} maxLength={255} name="address" placeholder="도로명 주소" required />
        </Field>
        <Field label="운영 상태">
          <select className="select" defaultValue={defaultValues?.stationStatus ?? "ACTIVE"} name="status">
            {stationStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </Field>
        <Field label="위도" hint="지도 API 연동 전에도 핀 상세에 사용할 좌표를 저장합니다.">
          <input className="input" defaultValue={defaultValues?.latitude ?? ""} max="90" min="-90" name="latitude" placeholder="37.5007" required step="0.000001" type="number" />
        </Field>
        <Field label="경도" hint="지도 API 연동 전에도 핀 상세에 사용할 좌표를 저장합니다.">
          <input className="input" defaultValue={defaultValues?.longitude ?? ""} max="180" min="-180" name="longitude" placeholder="127.0364" required step="0.000001" type="number" />
        </Field>
        {isCreateMode ? (
          <>
            <Field label="최대 보관 수량"><input className="input" defaultValue={defaultValues?.maxBatteryCapacity ?? 0} min="0" name="maxBatteryCapacity" required type="number" /></Field>
            <Field label="현재 보유 수량"><input className="input" defaultValue={defaultValues?.currentBatteryCount ?? 0} min="0" name="currentBatteryCount" required type="number" /></Field>
            <Field label="교체 가능 수량"><input className="input" defaultValue={defaultValues?.availableBatteryCount ?? 0} min="0" name="availableBatteryCount" required type="number" /></Field>
          </>
        ) : null}
      </div>
      <br />
      <Field label="운영 메모"><textarea className="input" defaultValue={defaultValues?.memo ?? ""} name="memo" placeholder="운영자가 볼 내부 메모" rows={4} /></Field>
      <p className="notice" style={{ marginTop: 16 }}>
        스테이션 ID는 DB가 자동 생성합니다. 사용자는 이름, 주소, 좌표, 상태와 재고 수량처럼 사람이 이해할 수 있는 값만 입력합니다.
      </p>
      {isCreateMode ? <p className="notice">수량 규칙: 최대 보관 수량 ≥ 현재 보유 수량 ≥ 교체 가능 수량.</p> : null}
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">스테이션 {mode}</button>
      </div>
    </form>
  );
}
