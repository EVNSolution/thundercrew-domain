package com.thundercrew.opsapi.testmatching.matching.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.testmatching.matching.domain.TestContractType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestHandoverType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestServiceType;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TestMatchingCreateRequest(
        @NotNull UUID testVehicleId,
        @NotNull TestServiceType serviceType,
        @NotNull UUID testRiderId,
        @NotNull TestContractType contractType,
        @NotNull TestHandoverType handoverType,
        @NotNull @JsonFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
        @NotNull @JsonFormat(pattern = "yyyy-MM-dd") LocalDate endDate
) {
    @AssertTrue(message = "시작일은 종료일보다 이전이어야 합니다")
    boolean isDateRangeValid() {
        return startDate == null || endDate == null || startDate.isBefore(endDate);
    }
}
