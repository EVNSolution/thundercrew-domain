package com.thundercrew.opsapi.contract.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

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
