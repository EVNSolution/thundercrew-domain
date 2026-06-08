package com.thundercrew.opsapi.testmatching.rider.dto;

import com.thundercrew.opsapi.testmatching.rider.domain.TestRider;
import com.thundercrew.opsapi.testmatching.rider.domain.TestTrainingStatus;
import java.time.Instant;
import java.util.UUID;

public record TestRiderReadResponse(
        UUID id, Long idx, String name, String phoneNumber,
        TestTrainingStatus trainingStatus, String teamName,
        Instant createdAt, Instant updatedAt
) {
    public static TestRiderReadResponse from(TestRider rider) {
        return new TestRiderReadResponse(
                rider.getId(), rider.getIdx(), rider.getName(), rider.getPhoneNumber(),
                rider.getTrainingStatus(), rider.getTeamName(),
                rider.getCreatedAt(), rider.getUpdatedAt());
    }
}
