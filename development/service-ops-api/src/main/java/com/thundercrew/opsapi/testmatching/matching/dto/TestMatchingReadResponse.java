package com.thundercrew.opsapi.testmatching.matching.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.thundercrew.opsapi.testmatching.matching.domain.TestContractType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestHandoverType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestMatching;
import com.thundercrew.opsapi.testmatching.matching.domain.TestServiceType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestValidationStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record TestMatchingReadResponse(
        UUID id,
        Long idx,
        UUID testVehicleId,
        String plateNumber,
        TestServiceType serviceType,
        UUID testRiderId,
        String riderName,
        String phoneNumber,
        TestContractType contractType,
        TestHandoverType handoverType,
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate endDate,
        TestValidationStatus validationStatus,
        String validationMessage,
        Instant createdAt,
        Instant updatedAt
) {
    public static TestMatchingReadResponse of(
            TestMatching matching,
            String plateNumber, String riderName, String phoneNumber,
            TestValidationStatus status, String message) {
        return new TestMatchingReadResponse(
                matching.getId(), matching.getIdx(), matching.getTestVehicleId(), plateNumber,
                matching.getServiceType(), matching.getTestRiderId(), riderName, phoneNumber,
                matching.getContractType(), matching.getHandoverType(),
                matching.getStartDate(), matching.getEndDate(),
                status, message,
                matching.getCreatedAt(), matching.getUpdatedAt());
    }
}
