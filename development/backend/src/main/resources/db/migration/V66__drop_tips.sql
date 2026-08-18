-- 팁 기능 제거 (UI 재편). 화면·API 표면이 사라져 테이블도 정리한다.
--
-- 역방향: V32__create_tips_table.sql 재적용으로 스키마 복구 가능 (데이터는
-- 사전 pg_dump 백업에서).
drop table if exists tips;
