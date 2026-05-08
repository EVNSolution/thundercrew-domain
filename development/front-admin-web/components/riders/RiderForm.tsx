import Link from "next/link";

import { Field } from "@/components/ui/FormField";

type RiderFormValues = {
  areaName?: string | null;
  appLinkStatus?: string | null;
  memo?: string | null;
  name?: string | null;
  phoneNumber?: string | null;
  teamName?: string | null;
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
  mode?: "등록" | "수정";
  statusMessage?: string | null;
};

const teamOptions = ["강남 1팀", "서초 2팀", "송파 1팀"];
const areaOptions = ["강남/역삼", "서초/방배", "송파/잠실"];

export function RiderForm({
  action,
  cancelHref = "/riders",
  defaultValues,
  includeInitialEducation = false,
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
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">라이더 {mode}</button>
      </div>
    </form>
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
