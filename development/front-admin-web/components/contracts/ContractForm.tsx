"use client";

import { MockFormActions } from "@/components/ui/MockActions";
import { Field } from "@/components/ui/FormField";
import { riders } from "@/lib/services/mock-data";

export function ContractForm() {
  return (
    <form className="card" onSubmit={(event) => event.preventDefault()} aria-label="계약 등록 폼">
      <div className="form-grid">
        <Field label="계약 대상 라이더" hint="contract_id 또는 rider_id 입력 없이 이름/연락처로 선택합니다."><select className="select" name="rider">{riders.map((r) => <option key={r.slug}>{r.name} · {r.phone} · {r.area}</option>)}</select></Field>
        <Field label="계약 유형"><select className="select" name="contractType"><option>위탁 운영 계약</option><option>정규 운영 계약</option><option>파트타임 계약</option></select></Field>
        <Field label="계약 시작일"><input className="input" name="startsAt" type="date" /></Field>
        <Field label="계약 종료일"><input className="input" name="endsAt" type="date" /></Field>
        <Field label="계약 상태"><select className="select" name="status"><option>초안</option><option>활성</option><option>만료 예정</option><option>종료</option></select></Field>
      </div>
      <MockFormActions cancelHref="/contracts" submitLabel="계약 등록" successMessage="계약 등록 요청을 확인했습니다. 실제 저장은 Supabase 연결 단계에서 처리됩니다." />
    </form>
  );
}
