package com.thundercrew.opsapi.rider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RiderUpdateRequest(
        @Size(max = 100) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String name,
        @Size(max = 30) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String phoneNumber,
        @Size(max = 100) String teamName,
        @Size(max = 100) String areaName,
        String memo,
        @Size(max = 200) String primaryInsurance,
        @Size(max = 200) String addonInsurance
) {
}
