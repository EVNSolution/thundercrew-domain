package com.thundercrew.opsapi.maintenance.repository;

import com.thundercrew.opsapi.maintenance.domain.MaintenanceCategory;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface MaintenanceItemRepository extends Repository<MaintenanceItem, UUID> {

    MaintenanceItem save(MaintenanceItem item);

    Optional<MaintenanceItem> findByIdAndDeletedAtIsNull(UUID id);

    Page<MaintenanceItem> findByDeletedAtIsNull(Pageable pageable);

    @Query("select distinct i from MaintenanceItem i where i.deletedAt is null order by i.name asc")
    List<MaintenanceItem> findAllLiveOrderByName();

    @Query("select distinct i from MaintenanceItem i join i.categories c where c = :category and i.deletedAt is null order by i.name asc")
    List<MaintenanceItem> findByCategory(@Param("category") MaintenanceCategory category);
}
