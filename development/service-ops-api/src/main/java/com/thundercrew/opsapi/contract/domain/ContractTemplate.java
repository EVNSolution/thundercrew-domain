package com.thundercrew.opsapi.contract.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContractCategory category = ContractCategory.CUSTOM;

    @Enumerated(EnumType.STRING)
    @Column(name = "return_type", length = 20)
    private ContractReturnType returnType;

    @Enumerated(EnumType.STRING)
    @Column(name = "duration_unit", length = 20)
    private ContractDurationUnit durationUnit;

    @Column(name = "duration_value")
    private Integer durationValue;

    @Column(name = "includes_insurance", nullable = false)
    private boolean includesInsurance = false;

    @Column(name = "default_insurance_item_id")
    private UUID defaultInsuranceItemId;

    /**
     * Legacy create — keeps existing callers (frontend that still sends only
     * {@code durationMinutes}) working as a CUSTOM template.
     */
    public static ContractTemplate createLegacy(
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
        template.category = ContractCategory.CUSTOM;
        return template;
    }

    /**
     * Structured create — caller picks an explicit category/returnType/duration
     * combination. {@code durationMinutes} is derived from
     * {@code (durationUnit, durationValue)} so the legacy column stays in sync.
     */
    public static ContractTemplate createStructured(
            String name,
            String description,
            Boolean enabled,
            ContractCategory category,
            ContractReturnType returnType,
            ContractDurationUnit durationUnit,
            Integer durationValue,
            boolean includesInsurance,
            UUID defaultInsuranceItemId
    ) {
        ContractTemplate template = new ContractTemplate();
        template.name = name;
        template.description = description;
        template.enabled = enabled == null || enabled;
        template.systemTemplate = false;
        template.category = category == null ? ContractCategory.CUSTOM : category;
        template.returnType = returnType;
        template.durationUnit = durationUnit;
        template.durationValue = durationValue;
        template.includesInsurance = includesInsurance;
        template.defaultInsuranceItemId = defaultInsuranceItemId;
        template.durationMinutes = computeDurationMinutes(durationUnit, durationValue);
        return template;
    }

    public void updateBasicFields(String name, String description, Boolean enabled) {
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

    /**
     * Direct update of the legacy {@code durationMinutes} column. Service must
     * only call this when the structured fields are not supplied so we don't
     * silently overwrite the {@code (durationUnit, durationValue)} pair.
     */
    public void applyLegacyDurationMinutes(boolean provided, Integer durationMinutes) {
        if (!provided) {
            return;
        }
        this.durationMinutes = durationMinutes;
        this.durationUnit = null;
        this.durationValue = null;
    }

    public void updateClassification(
            ContractCategory category,
            boolean returnTypeProvided,
            ContractReturnType returnType,
            boolean durationProvided,
            ContractDurationUnit durationUnit,
            Integer durationValue,
            Boolean includesInsurance,
            boolean defaultInsuranceItemIdProvided,
            UUID defaultInsuranceItemId
    ) {
        if (category != null) {
            this.category = category;
        }
        if (returnTypeProvided) {
            this.returnType = returnType;
        }
        if (durationProvided) {
            this.durationUnit = durationUnit;
            this.durationValue = durationValue;
            this.durationMinutes = computeDurationMinutes(durationUnit, durationValue);
        }
        if (includesInsurance != null) {
            this.includesInsurance = includesInsurance;
        }
        if (defaultInsuranceItemIdProvided) {
            this.defaultInsuranceItemId = defaultInsuranceItemId;
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

    public ContractCategory getCategory() {
        return category;
    }

    public ContractReturnType getReturnType() {
        return returnType;
    }

    public ContractDurationUnit getDurationUnit() {
        return durationUnit;
    }

    public Integer getDurationValue() {
        return durationValue;
    }

    public boolean isIncludesInsurance() {
        return includesInsurance;
    }

    public UUID getDefaultInsuranceItemId() {
        return defaultInsuranceItemId;
    }

    private static Integer computeDurationMinutes(ContractDurationUnit unit, Integer value) {
        if (unit == null || value == null || value <= 0) {
            return null;
        }
        return unit.toMinutes(value);
    }

    protected ContractTemplate() {
    }
}
