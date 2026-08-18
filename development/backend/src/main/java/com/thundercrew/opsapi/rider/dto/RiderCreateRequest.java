package com.thundercrew.opsapi.rider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.rider.domain.RiderRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RiderCreateRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(max = 30) String phoneNumber,
        @Size(max = 100) String teamName,
        @Size(max = 100) String areaName,
        String memo,
        RiderRole role
) {
}
