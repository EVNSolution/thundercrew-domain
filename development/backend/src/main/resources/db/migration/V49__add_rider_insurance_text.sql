alter table riders add column primary_insurance text;
alter table riders add column addon_insurance text;

update riders r
set primary_insurance = ii.name
from rider_insurances ri
join insurance_items ii on ii.id = ri.insurance_item_id
where ri.rider_id = r.id
  and ri.enabled = true and ri.deleted_at is null
  and ii.category = 'PRIMARY' and ii.deleted_at is null;

update riders r
set addon_insurance = sub.addon_names
from (
  select ri.rider_id, string_agg(ii.name, ', ' order by ii.name) as addon_names
  from rider_insurances ri
  join insurance_items ii on ii.id = ri.insurance_item_id
  where ri.enabled = true and ri.deleted_at is null
    and ii.category = 'ADDON' and ii.deleted_at is null
  group by ri.rider_id
) sub
where sub.rider_id = r.id;
