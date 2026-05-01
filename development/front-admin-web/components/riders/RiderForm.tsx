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
  mode?: "등록" | "수정";
  statusMessage?: string | null;
};

const teamOptions = ["강남 1팀", "서초 2팀", "송파 1팀"];
const areaOptions = ["강남/역삼", "서초/방배", "송파/잠실"];

export function RiderForm({ action, cancelHref = "/riders", defaultValues, mode = "등록", statusMessage }: RiderFormProps) {
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
      {statusMessage ? <p className="action-feedback" role="status">{statusMessage}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit">라이더 {mode}</button>
      </div>
    </form>
  );
}
