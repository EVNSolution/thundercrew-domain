alter table tips add column status varchar(20) not null default 'PUBLISHED';
alter table tips add column submitted_by_rider_id uuid;
