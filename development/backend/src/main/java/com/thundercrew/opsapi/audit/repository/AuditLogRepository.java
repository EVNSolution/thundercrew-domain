package com.thundercrew.opsapi.audit.repository;

import com.thundercrew.opsapi.audit.domain.AuditLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findTop100ByDeletedAtIsNullOrderByOccurredAtDesc();

    List<AuditLog> findByEntityIdAndDeletedAtIsNullOrderByOccurredAtDesc(UUID entityId);

    @Query("select a from AuditLog a where a.deletedAt is null "
            + "and (:entityType is null or a.entityType = :entityType) order by a.occurredAt desc")
    List<AuditLog> findRecentFiltered(
            @Param("entityType") String entityType,
            Pageable pageable);
}
