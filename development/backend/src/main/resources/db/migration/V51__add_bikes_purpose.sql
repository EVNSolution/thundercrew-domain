-- 차량의 용도(배송용/클린차량). 260804 미팅 요구사항.
--
-- 이 축은 V25 에 `bikes.service_type` 으로 존재했다가 사라졌다.
--   V25  service_type = DELIVERY / CLEANING / OTHER   ← 용도였다
--   V36  값을 배차 방식으로 재브랜드: DELIVERY→SINGLE, CLEANING→SEQUENTIAL
--   V50  컬럼을 rider_bike_contracts 로 옮기고 bikes 에서 제거
--
-- 즉 용도와 배차 방식이라는 **직교하는 두 축이 한 컬럼에 겹쳐졌다가** 배차 방식만
-- 남았다. 용도는 차량이 소유하고 배차 방식은 계약이 소유하는 것이 맞으므로,
-- 용도를 차량으로 되돌린다. 계약의 service_type 은 그대로 둔다 — 그건 배차 방식이고
-- 이 컬럼과 겹치지 않는다.
--
-- 백필은 추측이 아니다. V36 의 매핑이 단사(injective)라서 역으로 복원할 수 있고,
-- V50 이 계약에 그 값을 그대로 백필해 두었다. SINGLE 이었던 차량은 원래 DELIVERY,
-- SEQUENTIAL 이었던 차량은 원래 CLEANING 이다.
--
-- 복원되지 않는 경우가 있다.
--   - V36 이후 배차 방식을 바꾼 차량 → 그때의 방식으로 판정된다
--   - CALL / ROUND / OTHER 계약, 또는 계약이 없는 차량 → 판단 근거가 없다
-- 두 경우 모두 DELIVERY 로 둔다. 전량이 배송용으로 시작한 이력이라 그쪽이 안전하고,
-- 어긋난 것은 운영자가 자원 관리 화면에서 고친다.
alter table bikes
    add column purpose varchar(20) not null default 'DELIVERY';

-- 활성 계약의 배차 방식에서 용도를 복원한다. 한 차량에 활성 계약이 여러 개면
-- CLEANING 신호가 하나라도 있으면 클린차량으로 본다 — 클린 작업이 걸려 있는 차량을
-- 배송용으로 표시하는 쪽이 더 나쁜 오류다.
update bikes b
   set purpose = 'CLEANING'
 where exists (
           select 1
             from rider_bike_contracts c
            where c.bike_id = b.id
              and c.terminated_at is null
              and c.deleted_at is null
              and c.service_type = 'SEQUENTIAL'
       );

alter table bikes
    add constraint ck_bikes_purpose
        check (purpose in ('DELIVERY', 'CLEANING'));

-- 용도별 목록 조회가 이 컬럼의 주 사용처다.
create index ix_bikes_purpose_active
    on bikes(purpose)
    where deleted_at is null;
