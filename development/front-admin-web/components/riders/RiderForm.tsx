import Link from "next/link";

import { Field } from "@/components/ui/FormField";
import type { RiderContractFormOption } from "@/lib/services/rider-contract-form-options-data";

type RiderFormValues = {
  areaName?: string | null;
  appLinkStatus?: string | null;
  memo?: string | null;
  name?: string | null;
  phoneNumber?: string | null;
  teamName?: string | null;
};

export type RiderFormInsuranceOption = {
  id: string;
  name: string;
  category?: string;
};

type RiderFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  defaultValues?: RiderFormValues;
  /**
   * Slice ④-1b: include the optional "first education record" block in the
   * form. Only meaningful on rider create — the rider edit page handles
   * education through the dedicated detail-page section.
   */
  includeInitialEducation?: boolean;
  /**
   * Slice ④-1c: include the optional "first insurance link" block. The
   * caller must pass {@code insuranceOptions} loaded server-side from the
   * insurance catalog; passing an empty list disables the section with a
   * notice instead of rendering an empty select.
   */
  includeInitialInsurance?: boolean;
  insuranceOptions?: RiderFormInsuranceOption[];
  insuranceOptionsNotice?: string | null;
  /**
   * Slice ④-1d: include the optional "first contract (= vehicle match)"
   * block. The caller must pass {@code contractVehicleOptions} +
   * {@code contractTemplateOptions} loaded server-side; an empty list
   * disables the section with a notice instead of rendering empty selects.
   */
  includeInitialContract?: boolean;
  contractVehicleOptions?: RiderContractFormOption[];
  contractTemplateOptions?: RiderContractFormOption[];
  contractOptionsNotice?: string | null;
  mode?: "등록" | "수정";
  statusMessage?: string | null;
};

const teamOptions = ["강남 1팀", "서초 2팀", "송파 1팀"];
const areaOptions = ["강남/역삼", "서초/방배", "송파/잠실"];

export function RiderForm({
  action,
  cancelHref = "/overview?tab=riders",
  defaultValues,
  includeInitialEducation = false,
  includeInitialInsurance = false,
  insuranceOptions = [],
  insuranceOptionsNotice = null,
  includeInitialContract = false,
  contractVehicleOptions = [],
  contractTemplateOptions = [],
  contractOptionsNotice = null,
  mode = "등록",
  statusMessage
}: RiderFormProps) {
  return (
    <form action={action} className="card" aria-label={`라이더 ${mode} 폼`}>
      <div className="form-grid">
        <Field label="이름"><input className="input" defaultValue={defaultValues?.name ?? ""} maxLength={100} name="name" placeholder="예: 김민준" required /></Field>
        <Field label="연락처"><input className="input" defaultValue={defaultValues?.phoneNumber ?? ""} maxLength={30} name="phoneNumber" placeholder="예: 010-0000-0000" required /></Field>
        <Field label="소속">
          <select className="select" defaultValue={defaultValues?.teamName ?? teamOptions[0]} name="teamName">
            {teamOptions.map((team) => <option key={team}>{team}</option>)}
          </select>
        </Field>
        <Field label="담당 구역">
          <select className="select" defaultValue={defaultValues?.areaName ?? areaOptions[0]} name="areaName">
            {areaOptions.map((area) => <option key={area}>{area}</option>)}
          </select>
        </Field>
        <Field label="앱 계정 연결 상태">
          <input className="input" defaultValue={defaultValues?.appLinkStatus ?? "백엔드 연결 후 자동 판단"} disabled />
        </Field>
      </div>
      <br />
      <Field label="메모"><textarea className="input" defaultValue={defaultValues?.memo ?? ""} name="memo" placeholder="운영자가 볼 내부 메모" rows={4} /></Field>
      {includeInitialEducation ? <InitialEducationFields /> : null}
      {includeInitialInsurance ? (
        <InitialInsuranceFields
          options={insuranceOptions}
          notice={insuranceOptionsNotice}
        />
      ) : null}
      {includeInitialContract ? (
        <InitialContractFields
          vehicles={contractVehicleOptions}
          templates={contractTemplateOptions}
          notice={contractOptionsNotice}
        />
      ) : null}
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">라이더 {mode}</button>
      </div>
    </form>
  );
}

function InitialInsuranceFields({
  options,
  notice
}: {
  options: RiderFormInsuranceOption[];
  notice: string | null;
}) {
  if (options.length === 0) {
    return (
      <fieldset className="rider-form-insurance">
        <legend>초기 보험 (선택)</legend>
        <p className="rider-form-insurance-hint">
          {notice
            ?? "보험 항목 catalog 가 비어 있어 등록 단계에서는 보험을 연결할 수 없습니다. 라이더 등록 후 라이더 상세에서 추가하세요."}
        </p>
      </fieldset>
    );
  }
  return (
    <fieldset className="rider-form-insurance">
      <legend>초기 보험 (선택)</legend>
      <p className="rider-form-insurance-hint">
        보험 항목을 선택하면 라이더 등록 직후 첫 보험 연결도 함께 만들어집니다.
        선택하지 않으면 라이더만 등록되고 보험은 라이더 상세에서 추가로 연결할 수 있습니다.
      </p>
      <div className="form-grid">
        <Field label="보험 항목">
          <select className="select" defaultValue="" name="initialInsuranceItemId">
            <option value="">미선택</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} {option.category ? `(${option.category})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="시작일 (선택)">
          <input className="input" name="initialInsuranceStartsAt" type="date" />
        </Field>
        <Field label="종료일 (선택)">
          <input className="input" name="initialInsuranceEndsAt" type="date" />
        </Field>
      </div>
      <Field label="메모 (선택)">
        <input
          className="input"
          maxLength={200}
          name="initialInsuranceMemo"
          placeholder="예: 운영자 메모"
        />
      </Field>
    </fieldset>
  );
}

function InitialContractFields({
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
      <fieldset className="rider-form-insurance">
        <legend>초기 계약 (선택)</legend>
        <p className="rider-form-insurance-hint">
          {notice
            ?? "차량 또는 계약 양식이 없어 등록 단계에서는 계약을 연결할 수 없습니다. 라이더 등록 후 라이더 상세에서 추가하세요."}
        </p>
      </fieldset>
    );
  }
  return (
    <fieldset className="rider-form-insurance">
      <legend>초기 계약 (선택)</legend>
      <p className="rider-form-insurance-hint">
        차량 / 계약 양식 / 시작일을 모두 입력하면 라이더 등록 직후 첫 계약(차량 매칭)도 함께 만들어집니다.
        하나라도 비어 있으면 라이더만 등록되고 계약은 라이더 상세에서 추가로 연결할 수 있습니다.
      </p>
      <div className="form-grid">
        <Field label="차량">
          <select className="select" defaultValue="" name="initialContractBikeId">
            <option value="">미선택</option>
            {vehicles.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.helper ? ` · ${option.helper}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="계약 양식">
          <select className="select" defaultValue="" name="initialContractTemplateId">
            <option value="">미선택</option>
            {templates.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="시작일">
          <input className="input" name="initialContractStartAt" type="date" />
        </Field>
      </div>
      <Field label="메모 (선택)">
        <input
          className="input"
          maxLength={200}
          name="initialContractMemo"
          placeholder="예: 운영자 메모"
        />
      </Field>
    </fieldset>
  );
}

function InitialEducationFields() {
  return (
    <fieldset className="rider-form-education">
      <legend>초기 교육 이력 (선택)</legend>
      <p className="rider-form-education-hint">
        교육 종류와 완료일을 모두 입력하면 라이더 등록 직후 첫 교육 이력도 함께 등록됩니다.
        둘 중 하나라도 비어 있으면 라이더만 등록되고 교육 이력은 라이더 상세에서 추가로 등록할 수 있습니다.
      </p>
      <div className="form-grid">
        <Field label="교육 종류">
          <select className="select" defaultValue="" name="initialEducationType">
            <option value="">미입력</option>
            <option value="ONLINE">온라인 교육</option>
            <option value="OFFLINE">오프라인 교육</option>
          </select>
        </Field>
        <Field label="과정명">
          <input
            className="input"
            maxLength={200}
            name="initialEducationCourseName"
            placeholder="예: 전기이륜차 안전 운행 교육 2026"
          />
        </Field>
        <Field label="완료일">
          <input className="input" name="initialEducationCompletedAt" type="date" />
        </Field>
        <Field label="만료일 (선택)">
          <input className="input" name="initialEducationExpiresAt" type="date" />
        </Field>
        <Field label="수료증 번호 (선택)">
          <input
            className="input"
            maxLength={100}
            name="initialEducationCertificateNo"
            placeholder="예: CRT-2026-00001"
          />
        </Field>
        <Field label="발급 기관 (선택)">
          <input
            className="input"
            maxLength={100}
            name="initialEducationIssuingAuthority"
            placeholder="예: 교통안전공단"
          />
        </Field>
      </div>
    </fieldset>
  );
}
