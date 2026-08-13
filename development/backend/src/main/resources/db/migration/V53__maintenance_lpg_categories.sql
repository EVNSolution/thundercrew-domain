-- 정비 분류를 4개에서 6개로. 260804 미팅으로 LPG 가 추가되면서
-- (휠 2) × (동력 3) = 6 분류가 된다.
--
--   TWO_WHEEL_ELECTRIC   TWO_WHEEL_ICE   TWO_WHEEL_LPG    ← 신규
--   FOUR_WHEEL_ELECTRIC  FOUR_WHEEL_ICE  FOUR_WHEEL_LPG   ← 신규
--
-- 기존 품목을 LPG 분류에 어떻게 넣을지가 문제다. V38 이 `applies_to` 컬럼을 지웠으므로
-- 동력 축 원본이 없고, 남은 근거는 현재 분류 행뿐이다.
--
-- 규칙: **ICE 에 걸린 품목은 LPG 에도 걸린다.** LPG 는 연소기관이라 엔진오일·점화
-- 계통·배기처럼 ICE 와 같은 정비 항목을 공유한다. 반대로 ELECTRIC 전용 품목(감속기
-- 오일, 배터리 커넥터)을 LPG 에 넣으면 안 된다.
--
-- 이 마이그레이션이 만들어낼 수 없는 것: LPG 에만 있는 품목(봄베 검사, 베이퍼라이저
-- 점검 등)이다. 없던 품목을 추측으로 만들지 않는다 — 운영자가 정비 품목 화면에서
-- 추가해야 한다. 그래서 LPG 차량은 처음에 ICE 와 같은 목록으로 시작한다.
insert into maintenance_item_categories (maintenance_item_id, category)
select mic.maintenance_item_id, 'TWO_WHEEL_LPG'
  from maintenance_item_categories mic
 where mic.category = 'TWO_WHEEL_ICE'
on conflict do nothing;

insert into maintenance_item_categories (maintenance_item_id, category)
select mic.maintenance_item_id, 'FOUR_WHEEL_LPG'
  from maintenance_item_categories mic
 where mic.category = 'FOUR_WHEEL_ICE'
on conflict do nothing;
