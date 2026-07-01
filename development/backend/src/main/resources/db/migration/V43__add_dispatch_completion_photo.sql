alter table dispatch_orders add column completion_photo bytea;
alter table dispatch_orders add column completion_photo_content_type varchar(100);
alter table dispatch_orders add column completed_by uuid;
