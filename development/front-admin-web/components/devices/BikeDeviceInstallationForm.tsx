import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { Device, Vehicle } from "@/types/domain";
import { deviceLabel } from "@/lib/services/device-data-core";

type BikeDeviceInstallationFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  devices?: Device[];
  statusMessage?: string | null;
  vehicles?: Array<Pick<Vehicle, "model" | "plateNumber" | "slug" | "status">>;
};

export function BikeDeviceInstallationForm({
  action,
  cancelHref = "/devices",
  devices = [],
  statusMessage,
  vehicles = []
}: BikeDeviceInstallationFormProps) {
  return (
    <form action={action} className="card" aria-label="차량 단말 설치 폼">
      <div className="form-grid">
        <Field label="차량 선택" hint="차량번호와 모델 기준으로 선택합니다. DB ID를 직접 입력하지 않습니다.">
          <select className="select" name="vehicleSelection" required>
            <option value="">차량 선택</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.slug} value={vehicle.slug}>{vehicle.plateNumber} · {vehicle.model} · {vehicle.status}</option>
            ))}
          </select>
        </Field>
        <Field label="단말 선택" hint="단말 UID와 모델 기준으로 선택합니다. FK ID를 직접 입력하지 않습니다.">
          <select className="select" name="deviceSelection" required>
            <option value="">단말 선택</option>
            {devices.map((device) => (
              <option key={device.id ?? device.slug} value={device.id ?? device.slug}>{deviceLabel(device)}{device.enabled ? "" : " · 비활성"}</option>
            ))}
          </select>
        </Field>
        <Field label="설치일시"><input className="input" name="installedAt" required type="datetime-local" /></Field>
      </div>
      <br />
      <Field label="설치 메모"><textarea className="input" name="memo" placeholder="설치/교체 사유 또는 운영 메모" rows={3} /></Field>
      <p className="notice" style={{ marginTop: 16 }}>설치 ID는 DB가 자동 생성합니다. 동일 차량 또는 동일 단말의 기존 활성 설치는 backend lifecycle 규칙에 따라 이력 보존 후 교체됩니다.</p>
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">차량 단말 설치</button>
      </div>
    </form>
  );
}
