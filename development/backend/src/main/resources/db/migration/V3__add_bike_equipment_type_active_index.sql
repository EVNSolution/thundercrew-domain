create index ix_bike_equipments_equipment_type_active
    on bike_equipments(equipment_type_id)
    where removed_at is null and deleted_at is null;
