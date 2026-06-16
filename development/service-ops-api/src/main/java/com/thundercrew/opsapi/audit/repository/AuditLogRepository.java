package com.thundercrew.opsapi.audit.repository;

import com.thundercrew.opsapi.audit.domain.AuditLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findTop100ByDeletedAtIsNullOrderByOccurredAtDesc();

    List<AuditLog> findByEntityIdAndDeletedAtIsNullOrderByOccurredAtDesc(UUID entityId);
}
