-- thundercrew-domain 1차 MVP schema
-- 원칙: 주요 객체 PK는 DB에서 자동 생성하고, UI/API는 사용자가 PK/FK ID를 직접 입력하지 않도록 사람이 읽는 검색/선택값으로 연결한다.

create extension if not exists pgcrypto;

create type vehicle_status as enum ('운행 중', '정지', '점검 필요', '대기');
create type assignment_status as enum ('배정됨', '미배정', '교대 예정');
create type rider_status as enum ('활동', '대기', '휴면');
create type contract_status as enum ('활성', '만료 예정', '종료', '초안');
create type insurance_status as enum ('정상', '만료 예정', '만료');
create type station_status as enum ('운영 중', '점검 중', '운영 중지');

create table public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.riders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  team text not null,
  area text not null,
  status rider_status not null default '대기',
  joined_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null unique,
  model text not null,
  status vehicle_status not null default '대기',
  assignment_status assignment_status not null default '미배정',
  battery_percent integer not null default 100 check (battery_percent between 0 and 100),
  location_label text not null default '위치 확인 전',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rider_contracts (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete restrict,
  contract_type text not null,
  starts_at date not null,
  ends_at date not null,
  status contract_status not null default '초안',
  area text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rider_contracts_date_order check (ends_at >= starts_at)
);

create table public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid references public.riders(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete restrict,
  provider text not null,
  policy_number text not null unique,
  starts_at date not null,
  ends_at date not null,
  status insurance_status not null default '정상',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_target_present check ((rider_id is not null)::int + (vehicle_id is not null)::int = 1),
  constraint insurance_date_order check (ends_at >= starts_at)
);

create table public.battery_stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  status station_status not null default '운영 중',
  battery_count integer not null default 0 check (battery_count >= 0),
  replaceable_count integer not null default 0 check (replaceable_count >= 0),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint station_replaceable_lte_total check (replaceable_count <= battery_count)
);

create table public.vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  rider_id uuid not null references public.riders(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status assignment_status not null default '배정됨',
  created_at timestamptz not null default now(),
  constraint vehicle_assignment_date_order check (ends_at is null or ends_at >= starts_at)
);

create table public.vehicle_status_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  status vehicle_status not null,
  battery_percent integer check (battery_percent between 0 and 100),
  location_label text,
  note text,
  created_at timestamptz not null default now()
);

create table public.station_inventory_logs (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.battery_stations(id) on delete cascade,
  battery_count integer not null check (battery_count >= 0),
  replaceable_count integer not null check (replaceable_count >= 0),
  note text,
  created_at timestamptz not null default now(),
  constraint inventory_replaceable_lte_total check (replaceable_count <= battery_count)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger admin_users_updated_at before update on public.admin_users for each row execute function public.set_updated_at();
create trigger riders_updated_at before update on public.riders for each row execute function public.set_updated_at();
create trigger vehicles_updated_at before update on public.vehicles for each row execute function public.set_updated_at();
create trigger rider_contracts_updated_at before update on public.rider_contracts for each row execute function public.set_updated_at();
create trigger insurance_policies_updated_at before update on public.insurance_policies for each row execute function public.set_updated_at();
create trigger battery_stations_updated_at before update on public.battery_stations for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.riders enable row level security;
alter table public.vehicles enable row level security;
alter table public.rider_contracts enable row level security;
alter table public.insurance_policies enable row level security;
alter table public.battery_stations enable row level security;
alter table public.vehicle_assignments enable row level security;
alter table public.vehicle_status_logs enable row level security;
alter table public.station_inventory_logs enable row level security;

create policy "authenticated operators can read riders" on public.riders for select to authenticated using (true);
create policy "authenticated operators can read vehicles" on public.vehicles for select to authenticated using (true);
create policy "authenticated operators can read contracts" on public.rider_contracts for select to authenticated using (true);
create policy "authenticated operators can read insurance" on public.insurance_policies for select to authenticated using (true);
create policy "authenticated operators can read stations" on public.battery_stations for select to authenticated using (true);
create policy "authenticated operators can read assignments" on public.vehicle_assignments for select to authenticated using (true);
create policy "authenticated operators can read vehicle logs" on public.vehicle_status_logs for select to authenticated using (true);
create policy "authenticated operators can read inventory logs" on public.station_inventory_logs for select to authenticated using (true);

-- 쓰기 정책은 관리자 인증/역할 설계 확정 후 확장한다. anon에는 운영 데이터 접근 정책을 부여하지 않는다.
