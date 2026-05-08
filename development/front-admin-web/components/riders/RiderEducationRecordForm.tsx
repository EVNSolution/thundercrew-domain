import Link from "next/link";

import { Field } from "@/components/ui/FormField";

type RiderEducationRecordFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  backHref: string;
};

export function RiderEducationRecordForm({ action, backHref }: RiderEducationRecordFormProps) {
  return (
    <form action={action} className="card" aria-label="라이더 교육 이력 등록 폼">
      <div className="form-grid">
        <Field label="교육 종류">
          <select className="select" defaultValue="ONLINE" name="educationType" required>
            <option value="ONLINE">온라인 교육</option>
            <option value="OFFLINE">오프라인 교육</option>
          </select>
        </Field>
        <Field label="과정명">
          <input
            className="input"
            maxLength={200}
            name="courseName"
            placeholder="예: 전기이륜차 안전 운행 교육 2026"
          />
        </Field>
        <Field label="완료일">
          <input className="input" name="completedAt" required type="date" />
        </Field>
        <Field label="만료일 (선택)">
          <input className="input" name="expiresAt" type="date" />
        </Field>
        <Field label="수료증 번호 (선택)">
          <input
            className="input"
            maxLength={100}
            name="certificateNo"
            placeholder="예: CRT-2026-00001"
          />
        </Field>
        <Field label="발급 기관 (선택)">
          <input
            className="input"
            maxLength={100}
            name="issuingAuthority"
            placeholder="예: 교통안전공단"
          />
        </Field>
      </div>
      <br />
      <Field label="증빙 URL (선택)">
        <input
          className="input"
          name="evidenceUrl"
          placeholder="예: https://evidence.example.com/CRT-2026-00001.pdf"
          type="url"
        />
      </Field>
      <br />
      <Field label="메모 (선택)">
        <textarea
          className="input"
          name="memo"
          placeholder="운영자가 볼 내부 메모"
          rows={4}
        />
      </Field>
      <div className="form-actions">
        <Link className="button-secondary" href={backHref}>취소</Link>
        <button className="button-primary" type="submit">교육 이력 등록</button>
      </div>
    </form>
  );
}
