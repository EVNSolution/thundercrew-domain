alter table dispatch_orders alter column bike_id drop not null;
alter table dispatch_orders drop constraint ck_dispatch_orders_status;
alter table dispatch_orders add constraint ck_dispatch_orders_status check (status in ('OFFERED', 'ASSIGNED', 'COMPLETED'));
