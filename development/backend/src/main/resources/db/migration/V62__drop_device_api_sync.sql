-- 단말 API 동기화 기록 테이블 제거. 화면·호출자가 전무한 미도달 도메인이었고
-- (현행 명세 §7), 운영 데이터도 0건이라 보존할 것이 없다 (2026-08-18 실측).
drop table if exists device_api_sync_results;
drop table if exists device_api_sync_runs;
