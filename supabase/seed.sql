insert into public.riders (name, phone, team, area, status, joined_at) values
('김민준', '010-2411-9021', '강남 1팀', '강남/역삼', '활동', '2026-01-12'),
('이하나', '010-3844-1750', '서초 2팀', '서초/방배', '활동', '2026-02-03'),
('박도윤', '010-7752-3301', '송파 1팀', '송파/잠실', '대기', '2026-03-18');

insert into public.vehicles (plate_number, model, status, assignment_status, battery_percent, location_label, last_seen_at) values
('서울바4821', 'NIU NQi Cargo', '운행 중', '배정됨', 78, '강남역 11번 출구', now() - interval '3 minutes'),
('서울바7390', 'Gogoro 2 Utility', '점검 필요', '미배정', 21, '역삼 정비 거점', now() - interval '18 minutes'),
('서울바1168', 'Thundercrew E2', '대기', '교대 예정', 94, '서초 스테이션', now() - interval '8 minutes');

insert into public.battery_stations (name, address, status, battery_count, replaceable_count, latitude, longitude) values
('강남 교체 스테이션', '서울 강남구 테헤란로 152', '운영 중', 48, 31, 37.5007000, 127.0364000),
('서초 물류 스테이션', '서울 서초구 사임당로 174', '운영 중', 35, 19, 37.4921000, 127.0242000),
('송파 점검 스테이션', '서울 송파구 올림픽로 300', '점검 중', 22, 4, 37.5145000, 127.1059000);

insert into public.rider_contracts (rider_id, contract_type, starts_at, ends_at, status, area)
select id, '위탁 운영 계약', '2026-01-15', '2026-12-31', '활성', area from public.riders where name = '김민준';
insert into public.rider_contracts (rider_id, contract_type, starts_at, ends_at, status, area)
select id, '정규 운영 계약', '2026-02-10', '2026-06-30', '만료 예정', area from public.riders where name = '이하나';

insert into public.insurance_policies (rider_id, provider, policy_number, starts_at, ends_at, status)
select id, '현대해상', 'HD-26-884102', '2026-01-15', '2027-01-14', '정상' from public.riders where name = '김민준';
insert into public.insurance_policies (vehicle_id, provider, policy_number, starts_at, ends_at, status)
select id, 'DB손해보험', 'DB-EM-7712', '2025-07-01', '2026-06-30', '만료 예정' from public.vehicles where plate_number = '서울바4821';
