package com.thundercrew.opsapi.insurance.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.insurance.domain.InsuranceCategory;
import com.thundercrew.opsapi.insurance.domain.InsuranceCoverageType;
import com.thundercrew.opsapi.insurance.domain.InsuranceDurationUnit;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public class InsuranceItemUpdateRequest {

    @Size(max = 100)
    @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided")
    private String name;

    private String description;

    private Boolean enabled;

    private InsuranceCategory category;

    private InsuranceCoverageType coverageType;
    private boolean coverageTypeProvided;

    private InsuranceDurationUnit defaultDurationUnit;
    private boolean defaultDurationUnitProvided;

    @Positive
    private Integer defaultDurationValue;
    private boolean defaultDurationValueProvided;

    public String name() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String description() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Boolean enabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public InsuranceCategory category() {
        return category;
    }

    public void setCategory(InsuranceCategory category) {
        this.category = category;
    }

    public InsuranceCoverageType coverageType() {
        return coverageType;
    }

    public boolean coverageTypeProvided() {
        return coverageTypeProvided;
    }

    public void setCoverageType(InsuranceCoverageType coverageType) {
        this.coverageType = coverageType;
        this.coverageTypeProvided = true;
    }

    public InsuranceDurationUnit defaultDurationUnit() {
        return defaultDurationUnit;
    }

    public void setDefaultDurationUnit(InsuranceDurationUnit defaultDurationUnit) {
        this.defaultDurationUnit = defaultDurationUnit;
        this.defaultDurationUnitProvided = true;
    }

    public Integer defaultDurationValue() {
        return defaultDurationValue;
    }

    public void setDefaultDurationValue(Integer defaultDurationValue) {
        this.defaultDurationValue = defaultDurationValue;
        this.defaultDurationValueProvided = true;
    }

    public boolean defaultDurationProvided() {
        return defaultDurationUnitProvided || defaultDurationValueProvided;
    }
}
