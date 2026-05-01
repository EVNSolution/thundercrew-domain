package com.thundercrew.opsapi.common.domain;

import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import java.util.UUID;

@MappedSuperclass
public abstract class SoftDeletableEntity extends AuditableEntity {

    private Instant deletedAt;

    private UUID deletedBy;

    public void markDeleted(UUID actorId, Instant deletedAt) {
        this.deletedBy = actorId;
        this.deletedAt = deletedAt;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public UUID getDeletedBy() {
        return deletedBy;
    }
}
