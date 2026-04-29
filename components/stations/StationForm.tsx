import { Field } from "@/components/ui/FormField";

export function StationForm() {
  return (
    <form className="card" aria-label="스테이션 등록 폼">
      <div className="form-grid">
        <Field label="스테이션명"><input className="input" name="name" placeholder="예: 강남 교체 스테이션" /></Field>
        <Field label="주소"><input className="input" name="address" placeholder="도로명 주소" /></Field>
        <Field label="운영 상태"><select className="select" name="status"><option>운영 중</option><option>점검 중</option><option>운영 중지</option></select></Field>
        <Field label="보유 배터리 수량"><input className="input" name="batteryCount" type="number" min="0" placeholder="0" /></Field>
        <Field label="교체 가능 수량"><input className="input" name="replaceableCount" type="number" min="0" placeholder="0" /></Field>
        <Field label="위치 메모"><input className="input" name="locationNote" placeholder="예: 지하 1층 우측 출입구" /></Field>
      </div>
      <div className="form-actions"><button className="button-secondary" type="button">취소</button><button className="button-primary" type="submit">스테이션 등록</button></div>
    </form>
  );
}
