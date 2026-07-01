package com.thundercrew.opsapi.insurance.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.insurance.domain.InsuranceCategory;
import com.thundercrew.opsapi.insurance.domain.InsuranceCoverageType;
import com.thundercrew.opsapi.insurance.domain.InsuranceDurationUnit;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Backward-compatible: legacy callers send only {@code name + description +
 * enabled} and the row defaults to {@code category=PRIMARY} with NULL coverage
 * type and NULL default duration. Structured callers add classification and
 * default-period fields.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record InsuranceItemCreateRequest(
        @NotBlank @Size(max = 100) String name,
        String description,
        Boolean enabled,
        InsuranceCategory category,
        InsuranceCoverageType coverageType,
        InsuranceDurationUnit defaultDurationUnit,
        @Positive Integer defaultDurationValue
) {
}
