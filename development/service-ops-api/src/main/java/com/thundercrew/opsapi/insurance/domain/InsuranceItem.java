package com.thundercrew.opsapi.insurance.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "insurance_items")
public class InsuranceItem extends DisplaySequencedEntity {

    @Column(nullable = false, length = 100)
    private String name;

    private String description;

    @Column(nullable = false)
    private boolean enabled = true;

    public static InsuranceItem create(
            String name,
            String description,
            Boolean enabled
    ) {
        InsuranceItem item = new InsuranceItem();
        item.name = name;
        item.description = description;
        item.enabled = enabled == null || enabled;
        return item;
    }

    public void updateOperatorManagedFields(
            String name,
            String description,
            Boolean enabled
    ) {
        if (name != null) {
            this.name = name;
        }
        if (description != null) {
            this.description = description;
        }
        if (enabled != null) {
            this.enabled = enabled;
        }
    }

    public void disableAndMarkDeleted(UUID actorId, Instant deletedAt) {
        this.enabled = false;
        markDeleted(actorId, deletedAt);
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public boolean isEnabled() {
        return enabled;
    }

    protected InsuranceItem() {
    }
}
