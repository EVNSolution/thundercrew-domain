-- 엔진 종류에 LPG 추가. 260804 미팅 요구사항.
--
-- 값을 바꾸는 것이 아니라 **허용 범위만 넓히는** 변경이다. 기존 행은 ELECTRIC 또는
-- ICE 이고 둘 다 새 제약을 만족하므로 UPDATE 가 필요 없다. V36 이 겪은
-- DROP → UPDATE → ADD 순서 문제는 여기서는 발생하지 않는다 — 그건 기존 값이 새
-- 제약을 위반하는 재브랜드였기 때문이다. 그래도 DROP 을 먼저 두는 것은
-- 같은 이름의 제약이 이미 있으면 ADD 가 실패하기 때문이다.
alter table bikes drop constraint if exists ck_bikes_engine_type;

alter table bikes
    add constraint ck_bikes_engine_type
        check (engine_type in ('ELECTRIC', 'ICE', 'LPG'));
