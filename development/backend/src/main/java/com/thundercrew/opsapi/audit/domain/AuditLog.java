package com.thundercrew.opsapi.audit.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
public class AuditLog extends DisplaySequencedEntity {

    @Column(name = "entity_type", nullable = false, columnDefinition = "text")
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(nullable = false, columnDefinition = "text")
    private String field;

    @Column(name = "old_value", columnDefinition = "text")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "text")
    private String newValue;

    @Column(columnDefinition = "text")
    private String actor;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    public static AuditLog create(String entityType, UUID entityId, String field,
                                   String oldValue, String newValue, String actor, Instant occurredAt) {
        AuditLog auditLog = new AuditLog();
        auditLog.entityType = entityType;
        auditLog.entityId = entityId;
        auditLog.field = field;
        auditLog.oldValue = oldValue;
        auditLog.newValue = newValue;
        auditLog.actor = actor;
        auditLog.occurredAt = occurredAt;
        return auditLog;
    }

    public String getEntityType() {
        return entityType;
    }

    public UUID getEntityId() {
        return entityId;
    }

    public String getField() {
        return field;
    }

    public String getOldValue() {
        return oldValue;
    }

    public String getNewValue() {
        return newValue;
    }

    public String getActor() {
        return actor;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    protected AuditLog() {
    }
}
