import { Field } from "@/components/ui/FormField";
import { riders } from "@/lib/services/mock-data";

export function ContractForm() {
  return (
    <form className="card" aria-label="계약 등록 폼">
      <div className="form-grid">
        <Field label="계약 대상 라이더" hint="contract_id 또는 rider_id 입력 없이 이름/연락처로 선택합니다."><select className="select" name="rider">{riders.map((r) => <option key={r.slug}>{r.name} · {r.phone} · {r.area}</option>)}</select></Field>
        <Field label="계약 유형"><select className="select" name="contractType"><option>위탁 운영 계약</option><option>정규 운영 계약</option><option>파트타임 계약</option></select></Field>
        <Field label="계약 시작일"><input className="input" name="startsAt" type="date" /></Field>
        <Field label="계약 종료일"><input className="input" name="endsAt" type="date" /></Field>
        <Field label="계약 상태"><select className="select" name="status"><option>초안</option><option>활성</option><option>만료 예정</option><option>종료</option></select></Field>
      </div>
      <div className="form-actions"><button className="button-secondary" type="button">취소</button><button className="button-primary" type="submit">계약 등록</button></div>
    </form>
  );
}
