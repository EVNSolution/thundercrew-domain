"use client";

import Link from "next/link";
import { useId, useState, type ChangeEvent } from "react";

import { Field } from "@/components/ui/FormField";
import type { ContractTemplate, ContractTemplateCategory } from "@/types/domain";

export type ContractTemplateFormInsuranceOption = {
  id: string;
  name: string;
  category: string;
};

type ContractTemplateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  defaultValues?: Partial<
    Pick<
      ContractTemplate,
      | "category"
      | "defaultInsuranceItemId"
      | "description"
      | "durationMinutes"
      | "durationUnit"
      | "durationValue"
      | "enabled"
      | "includesInsurance"
      | "name"
      | "returnType"
      | "unlimited"
    >
  >;
  insuranceOptions: ContractTemplateFormInsuranceOption[];
  insuranceOptionsNotice?: string | null;
  mode?: "등록" | "수정";
  statusMessage?: string | null;
};

const CATEGORY_OPTIONS: { value: ContractTemplateCategory; label: string; hint: string }[] = [
  { value: "SUBSCRIPTION", label: "구독 (12개월)", hint: "12개월 고정 — 인수형/반납형 + 보험 포함 여부 선택." },
  { value: "RENTAL", label: "렌탈 (단기)", hint: "일/주/월/분기/반기 단위 + 인수형/반납형." },
  { value: "CUSTOM", label: "기타 (자유 분 단위)", hint: "기존 무제한 또는 임의 일/시간/분 입력." }
];

const RENTAL_UNIT_OPTIONS = [
  { value: "DAY", label: "일" },
  { value: "WEEK", label: "주" },
  { value: "MONTH", label: "월" },
  { value: "QUARTER", label: "분기" },
  { value: "HALF_YEAR", label: "반기 (6개월)" }
];

export function ContractTemplateForm({
  action,
  cancelHref = "/contract-templates",
  defaultValues,
  insuranceOptions,
  insuranceOptionsNotice,
  mode = "등록",
  statusMessage
}: ContractTemplateFormProps) {
  const initialCategory = (defaultValues?.category as ContractTemplateCategory | undefined) ?? "SUBSCRIPTION";
  const [category, setCategory] = useState<ContractTemplateCategory>(initialCategory);
  const [includesInsurance, setIncludesInsurance] = useState(
    defaultValues?.includesInsurance ?? false
  );
  const insuranceCheckboxId = useId();

  const customDuration = splitDuration(defaultValues?.durationMinutes ?? null);
  const customDurationMode =
    defaultValues?.unlimited || defaultValues?.durationMinutes === null ? "unlimited" : "limited";

  return (
    <form action={action} className="card" aria-label={`계약 양식 ${mode} 폼`}>
      <input type="hidden" name="category" value={category} />
      <div className="form-grid">
        <Field label="계약 양식명">
          <input
            className="input"
            defaultValue={defaultValues?.name ?? ""}
            maxLength={100}
            name="name"
            placeholder="예: 구독 인수형 12개월 (보험 포함)"
            required
          />
        </Field>
        <Field label="사용 상태">
          <select className="select" defaultValue={String(defaultValues?.enabled ?? true)} name="enabled">
            <option value="true">사용</option>
            <option value="false">비활성</option>
          </select>
        </Field>
        <Field
          label="카테고리"
          hint={CATEGORY_OPTIONS.find((option) => option.value === category)?.hint}
        >
          <select
            className="select"
            value={category}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setCategory(event.target.value as ContractTemplateCategory)
            }
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <br />

      {category === "SUBSCRIPTION" ? (
        <SubscriptionFields
          defaultReturnType={defaultValues?.returnType ?? null}
          defaultIncludesInsurance={includesInsurance}
          onIncludesInsuranceChange={setIncludesInsurance}
          insuranceCheckboxId={insuranceCheckboxId}
          insuranceOptions={insuranceOptions}
          insuranceOptionsNotice={insuranceOptionsNotice}
          defaultInsuranceItemId={defaultValues?.defaultInsuranceItemId ?? null}
          includesInsurance={includesInsurance}
        />
      ) : null}

      {category === "RENTAL" ? (
        <RentalFields
          defaultReturnType={defaultValues?.returnType ?? null}
          defaultDurationUnit={defaultValues?.durationUnit ?? "DAY"}
          defaultDurationValue={defaultValues?.durationValue ?? 1}
          defaultIncludesInsurance={includesInsurance}
          onIncludesInsuranceChange={setIncludesInsurance}
          insuranceCheckboxId={insuranceCheckboxId}
          insuranceOptions={insuranceOptions}
          insuranceOptionsNotice={insuranceOptionsNotice}
          defaultInsuranceItemId={defaultValues?.defaultInsuranceItemId ?? null}
          includesInsurance={includesInsurance}
        />
      ) : null}

      {category === "CUSTOM" ? (
        <CustomFields
          customDurationMode={customDurationMode}
          duration={customDuration}
        />
      ) : null}

      <br />
      <Field label="설명">
        <textarea
          className="input"
          defaultValue={defaultValues?.description ?? ""}
          name="description"
          placeholder="운영자가 구분할 수 있는 계약 양식 설명"
          rows={3}
        />
      </Field>
      <p className="notice" style={{ marginTop: 16 }}>
        계약 양식 ID는 DB가 자동 생성합니다. 카테고리에 따라 백엔드가 SUBSCRIPTION × DAY 같은 잘못된 조합을 거부합니다.
      </p>
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">계약 양식 {mode}</button>
      </div>
    </form>
  );
}

function SubscriptionFields({
  defaultReturnType,
  defaultIncludesInsurance,
  onIncludesInsuranceChange,
  insuranceCheckboxId,
  insuranceOptions,
  insuranceOptionsNotice,
  defaultInsuranceItemId,
  includesInsurance
}: {
  defaultReturnType: string | null;
  defaultIncludesInsurance: boolean;
  onIncludesInsuranceChange: (next: boolean) => void;
  insuranceCheckboxId: string;
  insuranceOptions: ContractTemplateFormInsuranceOption[];
  insuranceOptionsNotice: string | null | undefined;
  defaultInsuranceItemId: string | null;
  includesInsurance: boolean;
}) {
  return (
    <div className="form-grid">
      <Field label="형태 (인수형 / 반납형)">
        <select className="select" defaultValue={defaultReturnType ?? "TAKEOVER"} name="returnType" required>
          <option value="TAKEOVER">인수형 (TAKEOVER)</option>
          <option value="RETURN">반납형 (RETURN)</option>
        </select>
      </Field>
      <Field label="기간" hint="구독은 12개월 고정 — 운영자가 변경 불가.">
        <input className="input" disabled value="12개월" />
        <input type="hidden" name="durationUnit" value="MONTH" />
        <input type="hidden" name="durationValue" value="12" />
      </Field>
      <InsuranceFields
        defaultIncludesInsurance={defaultIncludesInsurance}
        onIncludesInsuranceChange={onIncludesInsuranceChange}
        insuranceCheckboxId={insuranceCheckboxId}
        insuranceOptions={insuranceOptions}
        insuranceOptionsNotice={insuranceOptionsNotice}
        defaultInsuranceItemId={defaultInsuranceItemId}
        includesInsurance={includesInsurance}
      />
    </div>
  );
}

function RentalFields({
  defaultReturnType,
  defaultDurationUnit,
  defaultDurationValue,
  defaultIncludesInsurance,
  onIncludesInsuranceChange,
  insuranceCheckboxId,
  insuranceOptions,
  insuranceOptionsNotice,
  defaultInsuranceItemId,
  includesInsurance
}: {
  defaultReturnType: string | null;
  defaultDurationUnit: string;
  defaultDurationValue: number;
  defaultIncludesInsurance: boolean;
  onIncludesInsuranceChange: (next: boolean) => void;
  insuranceCheckboxId: string;
  insuranceOptions: ContractTemplateFormInsuranceOption[];
  insuranceOptionsNotice: string | null | undefined;
  defaultInsuranceItemId: string | null;
  includesInsurance: boolean;
}) {
  return (
    <div className="form-grid">
      <Field label="형태 (인수형 / 반납형)">
        <select className="select" defaultValue={defaultReturnType ?? "RETURN"} name="returnType" required>
          <option value="TAKEOVER">인수형 (TAKEOVER)</option>
          <option value="RETURN">반납형 (RETURN)</option>
        </select>
      </Field>
      <Field label="기간 단위">
        <select className="select" defaultValue={defaultDurationUnit} name="durationUnit" required>
          {RENTAL_UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="기간 값">
        <input
          className="input"
          defaultValue={defaultDurationValue}
          min={1}
          name="durationValue"
          required
          type="number"
        />
      </Field>
      <InsuranceFields
        defaultIncludesInsurance={defaultIncludesInsurance}
        onIncludesInsuranceChange={onIncludesInsuranceChange}
        insuranceCheckboxId={insuranceCheckboxId}
        insuranceOptions={insuranceOptions}
        insuranceOptionsNotice={insuranceOptionsNotice}
        defaultInsuranceItemId={defaultInsuranceItemId}
        includesInsurance={includesInsurance}
      />
    </div>
  );
}

function CustomFields({
  customDurationMode,
  duration
}: {
  customDurationMode: "limited" | "unlimited";
  duration: { days: number; hours: number; minutes: number };
}) {
  return (
    <div className="form-grid">
      <Field label="기간 방식" hint="무제한은 종료일 없이 운영자가 별도 종료할 때까지 유지합니다.">
        <select className="select" defaultValue={customDurationMode} name="customDurationMode">
          <option value="limited">기간 지정</option>
          <option value="unlimited">무제한</option>
        </select>
      </Field>
      <Field label="기간 · 일">
        <input
          className="input"
          defaultValue={duration.days || ""}
          min={0}
          name="customDurationDays"
          placeholder="예: 12"
          type="number"
        />
      </Field>
      <Field label="기간 · 시간">
        <input
          className="input"
          defaultValue={duration.hours || ""}
          min={0}
          name="customDurationHours"
          placeholder="예: 6"
          type="number"
        />
      </Field>
      <Field label="기간 · 분">
        <input
          className="input"
          defaultValue={duration.minutes || ""}
          min={0}
          name="customDurationMinutesPart"
          placeholder="예: 30"
          type="number"
        />
      </Field>
    </div>
  );
}

function InsuranceFields({
  defaultIncludesInsurance,
  onIncludesInsuranceChange,
  insuranceCheckboxId,
  insuranceOptions,
  insuranceOptionsNotice,
  defaultInsuranceItemId,
  includesInsurance
}: {
  defaultIncludesInsurance: boolean;
  onIncludesInsuranceChange: (next: boolean) => void;
  insuranceCheckboxId: string;
  insuranceOptions: ContractTemplateFormInsuranceOption[];
  insuranceOptionsNotice: string | null | undefined;
  defaultInsuranceItemId: string | null;
  includesInsurance: boolean;
}) {
  return (
    <>
      <Field label="보험 포함">
        <label className="checkbox-row" htmlFor={insuranceCheckboxId}>
          <input
            id={insuranceCheckboxId}
            type="checkbox"
            name="includesInsurance"
            value="true"
            defaultChecked={defaultIncludesInsurance}
            onChange={(event) => onIncludesInsuranceChange(event.target.checked)}
          />
          <span>구독/렌탈 시 기본 보험 자동 발급</span>
        </label>
      </Field>
      {includesInsurance ? (
        <Field label="기본 보험 항목" hint={insuranceOptionsNotice ?? undefined}>
          <select
            className="select"
            defaultValue={defaultInsuranceItemId ?? insuranceOptions[0]?.id ?? ""}
            name="defaultInsuranceItemId"
            required
            disabled={insuranceOptions.length === 0}
          >
            {insuranceOptions.length === 0 ? (
              <option value="">사용 가능한 보험 항목 없음</option>
            ) : (
              insuranceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} {option.category ? `(${option.category})` : ""}
                </option>
              ))
            )}
          </select>
        </Field>
      ) : null}
    </>
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
