import Link from "next/link";

import { Field } from "@/components/ui/FormField";

export type RiderInsuranceFormItemOption = {
  id: string;
  name: string;
  category?: string;
};

type RiderInsuranceFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  backHref: string;
  mode: "등록" | "수정";
  /** Required on create — the insurance item catalog options. */
  itemOptions?: RiderInsuranceFormItemOption[];
  itemOptionsNotice?: string | null;
  /** Editable fields on update (`memo`, `enabled`). */
  defaultValues?: {
    memo?: string | null;
    enabled?: boolean;
  };
};

/**
 * Rider-scoped insurance form. The rider id is bound to the action so
 * the form does not need a rider select — the URL already pins it.
 *
 * Create mode renders the full set of fields needed by
 * {@link RiderInsuranceCreateInput} (item select + optional dates +
 * memo). Update mode only renders the two backend-mutable fields
 * (`memo`, `enabled`) since `RiderInsuranceUpdateInput` does not
 * accept dates or item swaps.
 */
export function RiderInsuranceForm({
  action,
  backHref,
  mode,
  itemOptions = [],
  itemOptionsNotice = null,
  defaultValues
}: RiderInsuranceFormProps) {
  return (
    <form action={action} className="card" aria-label={`라이더 보험 ${mode} 폼`}>
      {mode === "등록" ? (
        <CreateFields options={itemOptions} notice={itemOptionsNotice} />
      ) : (
        <UpdateFields defaultValues={defaultValues} />
      )}
      <div className="form-actions">
        <Link className="button-secondary" href={backHref}>취소</Link>
        <button className="button-primary" type="submit">보험 {mode}</button>
      </div>
    </form>
  );
}

function CreateFields({
  options,
  notice
}: {
  options: RiderInsuranceFormItemOption[];
  notice: string | null;
}) {
  if (options.length === 0) {
    return (
      <p className="rider-form-insurance-hint">
        {notice
          ?? "보험 항목 catalog 가 비어 있어 보험을 연결할 수 없습니다. 보험 항목을 먼저 등록한 뒤 다시 시도하세요."}
      </p>
    );
  }
  return (
    <>
      <div className="form-grid">
        <Field label="보험 항목">
          <select className="select" defaultValue="" name="insuranceItemId" required>
            <option value="" disabled>
              보험 항목을 선택하세요
            </option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} {option.category ? `(${option.category})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="시작일 (선택)">
          <input className="input" name="startsAt" type="date" />
        </Field>
        <Field label="종료일 (선택)">
          <input className="input" name="endsAt" type="date" />
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
  defaultValues?: { memo?: string | null; enabled?: boolean };
}) {
  const enabled = defaultValues?.enabled ?? true;
  return (
    <>
      <Field label="상태">
        <select className="select" defaultValue={enabled ? "true" : "false"} name="enabled">
          <option value="true">정상 (활성)</option>
          <option value="false">비활성</option>
        </select>
      </Field>
      <br />
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
    </>
  );
}
