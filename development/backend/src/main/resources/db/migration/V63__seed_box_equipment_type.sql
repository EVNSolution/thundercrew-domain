-- 함체(배송함) 장비 유형 시드. 배송용 차량의 함체 부착 여부를 체크 방식으로
-- 관리한다 (핵심 기능 목록 §2). boolean 컬럼을 새로 파지 않고 기존 장비 도메인
-- (equipment_types + bike_equipments)을 재사용한다 — 부착/탈거 이력이 공짜로 남는다.
--
-- name 에 unique 제약이 없어 존재 검사로 멱등성을 만든다.
insert into equipment_types (id, name, description, enabled)
select gen_random_uuid(), '함체', '배송함. 배송용 차량 전용 — 자원 관리 차량 상세의 함체 체크가 이 유형으로 부착/탈거를 기록한다.', true
 where not exists (select 1 from equipment_types where name = '함체' and deleted_at is null);
