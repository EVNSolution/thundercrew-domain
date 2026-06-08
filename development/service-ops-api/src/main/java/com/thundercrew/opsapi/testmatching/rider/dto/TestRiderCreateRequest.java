package com.thundercrew.opsapi.testmatching.rider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TestRiderCreateRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Pattern(regexp = "010-\\d{4}-\\d{4}", message = "연락처 형식: 010-XXXX-XXXX") String phoneNumber,
        @NotNull Boolean trainingCompleted,
        @Size(max = 100) String teamName
) {}
