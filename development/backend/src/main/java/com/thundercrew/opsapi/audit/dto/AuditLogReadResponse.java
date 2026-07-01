package com.thundercrew.opsapi.audit.dto;

import com.thundercrew.opsapi.audit.domain.AuditLog;
import java.time.Instant;
import java.util.UUID;

public record AuditLogReadResponse(
        UUID id,
        Long idx,
        String entityType,
        UUID entityId,
        String field,
        String oldValue,
        String newValue,
        String actor,
        Instant occurredAt,
        Instant createdAt
) {
    public static AuditLogReadResponse from(AuditLog auditLog) {
        return new AuditLogReadResponse(
                auditLog.getId(),
                auditLog.getIdx(),
                auditLog.getEntityType(),
                auditLog.getEntityId(),
                auditLog.getField(),
                auditLog.getOldValue(),
                auditLog.getNewValue(),
                auditLog.getActor(),
                auditLog.getOccurredAt(),
                auditLog.getCreatedAt()
        );
    }
}
