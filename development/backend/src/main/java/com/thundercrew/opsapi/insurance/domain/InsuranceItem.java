package com.thundercrew.opsapi.insurance.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InsuranceCategory category = InsuranceCategory.PRIMARY;

    @Enumerated(EnumType.STRING)
    @Column(name = "coverage_type", length = 40)
    private InsuranceCoverageType coverageType;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_duration_unit", length = 20)
    private InsuranceDurationUnit defaultDurationUnit;

    @Column(name = "default_duration_value")
    private Integer defaultDurationValue;

    public static InsuranceItem create(
            String name,
            String description,
            Boolean enabled,
            InsuranceCategory category,
            InsuranceCoverageType coverageType,
            InsuranceDurationUnit defaultDurationUnit,
            Integer defaultDurationValue
    ) {
        InsuranceItem item = new InsuranceItem();
        item.name = name;
        item.description = description;
        item.enabled = enabled == null || enabled;
        item.category = category == null ? InsuranceCategory.PRIMARY : category;
        item.coverageType = coverageType;
        item.defaultDurationUnit = defaultDurationUnit;
        item.defaultDurationValue = defaultDurationValue;
        return item;
    }

    public void updateOperatorManagedFields(
            String name,
            String description,
            Boolean enabled,
            InsuranceCategory category,
            boolean coverageTypeProvided,
            InsuranceCoverageType coverageType,
            boolean defaultDurationProvided,
            InsuranceDurationUnit defaultDurationUnit,
            Integer defaultDurationValue
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
        if (category != null) {
            this.category = category;
        }
        if (coverageTypeProvided) {
            this.coverageType = coverageType;
        }
        if (defaultDurationProvided) {
            this.defaultDurationUnit = defaultDurationUnit;
            this.defaultDurationValue = defaultDurationValue;
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

    public InsuranceCategory getCategory() {
        return category;
    }

    public InsuranceCoverageType getCoverageType() {
        return coverageType;
    }

    public InsuranceDurationUnit getDefaultDurationUnit() {
        return defaultDurationUnit;
    }

    public Integer getDefaultDurationValue() {
        return defaultDurationValue;
    }

    protected InsuranceItem() {
    }
}
