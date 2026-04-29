package com.thundercrew.opsapi.contract.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

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
}
