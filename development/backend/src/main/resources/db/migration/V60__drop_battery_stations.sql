-- 충전소(BSS) 기능 제거 (사용자 결정 2026-08-18 — 핵심 기능 목록에서 제외).
-- 지도 마커·하단 탭·백엔드 컨트롤러와 함께 테이블도 걷는다.
--
-- 운영 데이터: battery_stations 2건, station_battery_count_logs 0건.
-- 배포 전 pg_dump 전체 백업이 선행된다(배포 절차에 포함). 되돌리려면 V16(스테이션
-- 생성 마이그레이션)을 재적용하고 백업에서 2행을 복원한다.
drop table if exists station_battery_count_logs;
drop table if exists battery_stations;
