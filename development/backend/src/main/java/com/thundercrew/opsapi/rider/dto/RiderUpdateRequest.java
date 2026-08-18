package com.thundercrew.opsapi.rider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.rider.domain.RiderRole;
import com.thundercrew.opsapi.rider.domain.RiderSkillLevel;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RiderUpdateRequest(
        @Size(max = 100) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String name,
        @Size(max = 30) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String phoneNumber,
        @Size(max = 100) String teamName,
        RiderRole role,
        RiderSkillLevel skillLevel,
        /** true 면 등급을 미판정(null)으로 되돌린다. JSON null 은 "무변경" 이라 구분자가 필요하다. */
        Boolean clearSkillLevel,
        @Size(max = 100) String areaName,
        String memo,
        @Size(max = 200) String primaryInsurance,
        @Size(max = 200) String addonInsurance
) {
}
