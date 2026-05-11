import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { RiderContractFormOption } from "@/lib/services/rider-contract-form-options-data";

type RiderContractFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  backHref: string;
  mode: "등록" | "수정";
  /** Required on create — vehicle + template options. */
  vehicleOptions?: RiderContractFormOption[];
  templateOptions?: RiderContractFormOption[];
  optionsNotice?: string | null;
  /** Used on edit — `RiderBikeContractUpdateInput` only mutates memo. */
  defaultValues?: {
    memo?: string | null;
  };
};

/**
 * Rider-scoped contract form. The rider id is bound to the action so
 * the form does not need a rider select - the URL already pins it.
 *
 * Create mode renders the vehicle + template selects, the start date
 * and the optional memo. Update mode renders only the memo since
 * {@link RiderBikeContractUpdateInput} does not accept bike swaps,
 * template swaps, or start-date moves. Termination is a separate
 * action triggered from the rider detail page row.
 */
export function RiderContractForm({
  action,
  backHref,
  mode,
  vehicleOptions = [],
  templateOptions = [],
  optionsNotice = null,
  defaultValues
}: RiderContractFormProps) {
  return (
    <form action={action} className="card" aria-label={`라이더 계약 ${mode} 폼`}>
      {mode === "등록" ? (
        <CreateFields
          vehicles={vehicleOptions}
          templates={templateOptions}
          notice={optionsNotice}
        />
      ) : (
        <UpdateFields defaultValues={defaultValues} />
      )}
      <div className="form-actions">
        <Link className="button-secondary" href={backHref}>취소</Link>
        <button className="button-primary" type="submit">계약 {mode}</button>
      </div>
    </form>
  );
}

function CreateFields({
  vehicles,
  templates,
  notice
}: {
  vehicles: RiderContractFormOption[];
  templates: RiderContractFormOption[];
  notice: string | null;
}) {
  if (vehicles.length === 0 || templates.length === 0) {
    return (
      <p className="rider-form-insurance-hint">
        {notice
          ?? "차량 또는 계약 양식이 없어 계약을 등록할 수 없습니다. 먼저 차량과 계약 양식을 등록한 뒤 다시 시도하세요."}
      </p>
    );
  }
  return (
    <>
      <div className="form-grid">
        <Field label="차량">
          <select className="select" defaultValue="" name="bikeId" required>
            <option value="" disabled>
              차량을 선택하세요
            </option>
            {vehicles.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.helper ? ` · ${option.helper}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="계약 양식">
          <select className="select" defaultValue="" name="contractTemplateId" required>
            <option value="" disabled>
              계약 양식을 선택하세요
            </option>
            {templates.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="시작일">
          <input className="input" name="startAt" required type="date" />
        </Field>
      </div>
      <br />
      <Field label="메모 (선택)">
        <textarea
          className="input"
          maxLength={200}
          name="memo"
          placeholder="운영자가 볼 내부 메모"
          rows={4}
        />
      </Field>
    </>
  );
}

function UpdateFields({
  defaultValues
}: {
  defaultValues?: { memo?: string | null };
}) {
  return (
    <Field label="메모 (선택)">
      <textarea
        className="input"
        defaultValue={defaultValues?.memo ?? ""}
        maxLength={200}
        name="memo"
        placeholder="운영자가 볼 내부 메모"
        rows={4}
      />
    </Field>
  );
}
