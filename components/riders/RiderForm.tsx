"use client";

import { MockFormActions } from "@/components/ui/MockActions";
import { Field } from "@/components/ui/FormField";

export function RiderForm({ mode = "등록" }: { mode?: "등록" | "수정" }) {
  return (
    <form className="card" onSubmit={(event) => event.preventDefault()} aria-label={`라이더 ${mode} 폼`}>
      <div className="form-grid">
        <Field label="이름"><input className="input" name="name" placeholder="예: 김민준" /></Field>
        <Field label="연락처"><input className="input" name="phone" placeholder="예: 010-0000-0000" /></Field>
        <Field label="소속"><select className="select" name="team"><option>강남 1팀</option><option>서초 2팀</option><option>송파 1팀</option></select></Field>
        <Field label="담당 구역"><select className="select" name="area"><option>강남/역삼</option><option>서초/방배</option><option>송파/잠실</option></select></Field>
        <Field label="상태"><select className="select" name="status"><option>활동</option><option>대기</option><option>휴면</option></select></Field>
      </div>
      <MockFormActions cancelHref="/riders" submitLabel={`라이더 ${mode}`} successMessage={`라이더 ${mode} 요청을 확인했습니다. 실제 저장은 Supabase 연결 단계에서 처리됩니다.`} />
    </form>
  );
}
