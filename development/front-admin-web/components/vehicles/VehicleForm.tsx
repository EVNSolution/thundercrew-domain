"use client";

import { MockFormActions } from "@/components/ui/MockActions";
import { Field } from "@/components/ui/FormField";
import { riders, stations } from "@/lib/services/mock-data";

export function VehicleForm({ mode = "등록", cancelHref = "/vehicles" }: { mode?: "등록" | "수정"; cancelHref?: string }) {
  return (
    <form className="card" onSubmit={(event) => event.preventDefault()} aria-label={`차량 ${mode} 폼`}>
      <div className="form-grid">
        <Field label="차량번호"><input className="input" name="plateNumber" placeholder="예: 서울바4821" /></Field>
        <Field label="모델"><input className="input" name="model" placeholder="예: Thundercrew E2" /></Field>
        <Field label="상태"><select className="select" name="status"><option>대기</option><option>운행 중</option><option>정지</option><option>점검 필요</option></select></Field>
        <Field label="라이더 배정" hint="ID를 입력하지 않고 라이더 이름/연락처로 선택합니다."><select className="select" name="rider"><option>미배정</option>{riders.map((r) => <option key={r.slug}>{r.name} · {r.phone}</option>)}</select></Field>
        <Field label="현재 위치 기준"><select className="select" name="location">{stations.map((s) => <option key={s.slug}>{s.name} · {s.address}</option>)}<option>직접 위치 설명 입력</option></select></Field>
        <Field label="배터리 상태"><select className="select" name="battery"><option>충분함 (80% 이상)</option><option>교체 권장 (30~79%)</option><option>즉시 교체 필요 (30% 미만)</option></select></Field>
      </div>
      <MockFormActions cancelHref={cancelHref} submitLabel={`차량 ${mode}`} successMessage={`차량 ${mode} 요청을 확인했습니다. 실제 저장은 Supabase 연결 단계에서 처리됩니다.`} />
    </form>
  );
}
