"use client";

import { MockFormActions } from "@/components/ui/MockActions";
import { Field } from "@/components/ui/FormField";
import { riders, vehicles } from "@/lib/services/mock-data";

export function InsuranceForm() {
  return (
    <form className="card" onSubmit={(event) => event.preventDefault()} aria-label="보험 등록 폼">
      <div className="form-grid">
        <Field label="보험 대상" hint="FK ID를 입력하지 않고 라이더/차량 식별 정보로 선택합니다."><select className="select" name="target"><optgroup label="라이더">{riders.map((r) => <option key={r.slug}>라이더 · {r.name} · {r.phone}</option>)}</optgroup><optgroup label="차량">{vehicles.map((v) => <option key={v.slug}>차량 · {v.plateNumber} · {v.model}</option>)}</optgroup></select></Field>
        <Field label="보험사"><input className="input" name="provider" placeholder="예: 현대해상" /></Field>
        <Field label="증권번호"><input className="input" name="policyNumber" placeholder="예: HD-26-884102" /></Field>
        <Field label="보험 시작일"><input className="input" name="startsAt" type="date" /></Field>
        <Field label="보험 종료일"><input className="input" name="endsAt" type="date" /></Field>
        <Field label="보험 상태"><select className="select" name="status"><option>정상</option><option>만료 예정</option><option>만료</option></select></Field>
      </div>
      <MockFormActions cancelHref="/insurance" submitLabel="보험 등록" successMessage="보험 등록 요청을 확인했습니다. 실제 저장은 Supabase 연결 단계에서 처리됩니다." />
    </form>
  );
}
