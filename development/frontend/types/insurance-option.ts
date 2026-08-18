/**
 * 보험 select/lookup 옵션. id 는 보험 상품(insurance_item)의 id, label 은 표시 이름.
 *
 * 원래 RidersPanel 이 export 했는데 그 패널이 죽은 UI 로 정리되면서(2026-08-18
 * 재편 1단계) 타입만 여기로 옮겼다 — 차량 표의 보험 컬럼 lookup 이 쓴다.
 */
export interface InsuranceOption {
  id: string;
  label: string;
  /** insurance_item 의 category. PRIMARY = 유상운송 기본, ADDON = 시간제/원데이 추가. */
  category?: "PRIMARY" | "ADDON";
}
