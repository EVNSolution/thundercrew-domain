package com.thundercrew.opsapi.contract.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.contract.domain.ContractCategory;
import com.thundercrew.opsapi.contract.domain.ContractDurationUnit;
import com.thundercrew.opsapi.contract.domain.ContractReturnType;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ContractTemplateUpdateRequest {

    @Size(max = 100)
    @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided")
    private String name;

    @Positive
    private Integer durationMinutes;
    private boolean durationMinutesProvided;

    private String description;

    private Boolean enabled;

    private ContractCategory category;

    private ContractReturnType returnType;
    private boolean returnTypeProvided;

    private ContractDurationUnit durationUnit;
    private boolean durationUnitProvided;

    @Positive
    private Integer durationValue;
    private boolean durationValueProvided;

    private Boolean includesInsurance;

    private UUID defaultInsuranceItemId;
    private boolean defaultInsuranceItemIdProvided;

    public String name() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer durationMinutes() {
        return durationMinutes;
    }

    public boolean durationMinutesProvided() {
        return durationMinutesProvided;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes;
        this.durationMinutesProvided = true;
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

    public ContractCategory category() {
        return category;
    }

    public void setCategory(ContractCategory category) {
        this.category = category;
    }

    public ContractReturnType returnType() {
        return returnType;
    }

    public boolean returnTypeProvided() {
        return returnTypeProvided;
    }

    public void setReturnType(ContractReturnType returnType) {
        this.returnType = returnType;
        this.returnTypeProvided = true;
    }

    public ContractDurationUnit durationUnit() {
        return durationUnit;
    }

    public boolean durationUnitProvided() {
        return durationUnitProvided;
    }

    public void setDurationUnit(ContractDurationUnit durationUnit) {
        this.durationUnit = durationUnit;
        this.durationUnitProvided = true;
    }

    public Integer durationValue() {
        return durationValue;
    }

    public boolean durationValueProvided() {
        return durationValueProvided;
    }

    public void setDurationValue(Integer durationValue) {
        this.durationValue = durationValue;
        this.durationValueProvided = true;
    }

    public boolean structuredDurationProvided() {
        return durationUnitProvided || durationValueProvided;
    }

    public Boolean includesInsurance() {
        return includesInsurance;
    }

    public void setIncludesInsurance(Boolean includesInsurance) {
        this.includesInsurance = includesInsurance;
    }

    public UUID defaultInsuranceItemId() {
        return defaultInsuranceItemId;
    }

    public boolean defaultInsuranceItemIdProvided() {
        return defaultInsuranceItemIdProvided;
    }

    public void setDefaultInsuranceItemId(UUID defaultInsuranceItemId) {
        this.defaultInsuranceItemId = defaultInsuranceItemId;
        this.defaultInsuranceItemIdProvided = true;
    }
}
