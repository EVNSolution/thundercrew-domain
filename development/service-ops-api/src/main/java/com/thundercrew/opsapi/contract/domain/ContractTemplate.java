package com.thundercrew.opsapi.contract.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "contract_templates")
public class ContractTemplate extends DisplaySequencedEntity {

    @Column(nullable = false, length = 100)
    private String name;

    private Integer durationMinutes;

    private String description;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(nullable = false)
    private boolean systemTemplate;

    public static ContractTemplate create(
            String name,
            Integer durationMinutes,
            String description,
            Boolean enabled
    ) {
        ContractTemplate template = new ContractTemplate();
        template.name = name;
        template.durationMinutes = durationMinutes;
        template.description = description;
        template.enabled = enabled == null || enabled;
        template.systemTemplate = false;
        return template;
    }

    public void updateAdminManagedFields(
            String name,
            boolean durationMinutesProvided,
            Integer durationMinutes,
            String description,
            Boolean enabled
    ) {
        if (name != null) {
            this.name = name;
        }
        if (durationMinutesProvided) {
            this.durationMinutes = durationMinutes;
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

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public String getDescription() {
        return description;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public boolean isSystemTemplate() {
        return systemTemplate;
    }

    protected ContractTemplate() {
    }
}
