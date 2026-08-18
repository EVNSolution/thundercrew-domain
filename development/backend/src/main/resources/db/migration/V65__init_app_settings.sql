-- 운영 설정 key-value (4단계 설정 화면).
--
-- 대상: 클리닝 건별 소요시간 기본값 · 임박 알림 리드타임 · 완료 추정 반경/
-- 정지시간. 행이 없으면 백엔드 @Value 기본값을 쓴다 — 기본값을 시드하지
-- 않는 이유: 롤백 시 코드 기본값으로 자연 복귀하고, 코드 기본값 변경이
-- DB 시드에 가려지지 않게 하기 위함.
--
-- 역방향: drop table app_settings; (설정 화면 배포 이전 상태로 복귀)
create table app_settings (
    setting_key   text primary key,
    setting_value text not null,
    updated_at    timestamptz not null default now(),
    updated_by    uuid
);
