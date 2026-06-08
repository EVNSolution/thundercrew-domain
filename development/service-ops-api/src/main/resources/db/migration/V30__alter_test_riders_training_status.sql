-- Replace boolean training_completed with a 3-way enum: ONLINE / OFFLINE / INCOMPLETE
alter table test_riders add column training_status varchar(20);
update test_riders set training_status = case when training_completed then 'ONLINE' else 'INCOMPLETE' end;
alter table test_riders alter column training_status set not null;
alter table test_riders drop column training_completed;
