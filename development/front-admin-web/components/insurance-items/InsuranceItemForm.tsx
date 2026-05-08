import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { InsuranceItem } from "@/types/domain";

type InsuranceItemFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  defaultValues?: Partial<
    Pick<
      InsuranceItem,
      | "category"
      | "coverageType"
      | "defaultDurationUnit"
      | "defaultDurationValue"
      | "description"
      | "enabled"
      | "name"
    >
  >;
  mode?: "등록" | "수정";
  statusMessage?: string | null;
};

const CATEGORY_OPTIONS: { value: "PRIMARY" | "ADDON"; label: string; hint: string }[] = [
  { value: "PRIMARY", label: "메인 (12개월)", hint: "유상운송 종합/책임 — 12개월 단위 메인 보험." },
  { value: "ADDON", label: "부가 (시간제/원데이)", hint: "시간 단위 또는 하루 단위 부가 보험." }
];

const COVERAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "지정 안 함" },
  { value: "GENERAL_PAID_TRANSPORT", label: "유상운송종합보험" },
  { value: "LIABILITY_PAID_TRANSPORT", label: "유상운송책임보험" },
  { value: "HOURLY", label: "시간제 보험" },
  { value: "ONE_DAY", label: "원데이 보험" },
  { value: "OTHER", label: "기타" }
];

const DURATION_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "지정 안 함" },
  { value: "HOUR", label: "시간" },
  { value: "DAY", label: "일" },
  { value: "WEEK", label: "주" },
  { value: "MONTH", label: "개월" },
  { value: "QUARTER", label: "분기" },
  { value: "HALF_YEAR", label: "반기" },
  { value: "YEAR", label: "년" }
];

export function InsuranceItemForm({
  action,
  cancelHref = "/insurance/items",
  defaultValues,
  mode = "등록",
  statusMessage
}: InsuranceItemFormProps) {
  const category = defaultValues?.category ?? "PRIMARY";
  const coverageType = defaultValues?.coverageType ?? "";
  const durationUnit = defaultValues?.defaultDurationUnit ?? "";
  const durationValue = defaultValues?.defaultDurationValue ?? "";

  return (
    <form action={action} className="card" aria-label={`보험 항목 ${mode} 폼`}>
      <div className="form-grid">
        <Field label="보험 항목명">
          <input
            className="input"
            defaultValue={defaultValues?.name ?? ""}
            maxLength={100}
            name="name"
            placeholder="예: 유상운송종합보험"
            required
          />
        </Field>
        <Field label="사용 상태">
          <select className="select" defaultValue={String(defaultValues?.enabled ?? true)} name="enabled">
            <option value="true">사용</option>
            <option value="false">비활성</option>
          </select>
        </Field>
        <Field label="카테고리" hint={CATEGORY_OPTIONS.find((option) => option.value === category)?.hint}>
          <select className="select" defaultValue={category} name="category">
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="보장유형">
          <select className="select" defaultValue={coverageType ?? ""} name="coverageType">
            {COVERAGE_OPTIONS.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="기본 기간 단위" hint="단위와 값은 함께 입력합니다.">
          <select className="select" defaultValue={durationUnit ?? ""} name="defaultDurationUnit">
            {DURATION_UNIT_OPTIONS.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="기본 기간 값">
          <input
            className="input"
            defaultValue={durationValue === null || durationValue === undefined ? "" : durationValue}
            min={1}
            name="defaultDurationValue"
            placeholder="예: 12"
            type="number"
          />
        </Field>
      </div>
      <br />
      <Field label="설명">
        <textarea
          className="input"
          defaultValue={defaultValues?.description ?? ""}
          name="description"
          placeholder="운영자가 구분할 수 있는 보험 항목 설명"
          rows={3}
        />
      </Field>
      <p className="notice" style={{ marginTop: 16 }}>
        보험 항목 ID는 DB가 자동 생성합니다. 카테고리(메인/부가)와 보장유형은 라이더-보험 폼에서 선택지로 노출됩니다.
      </p>
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">보험 항목 {mode}</button>
      </div>
    </form>
  );
}
