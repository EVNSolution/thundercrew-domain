package com.thundercrew.opsapi.rider.dto;

import com.thundercrew.opsapi.rider.domain.RiderEducationRecord;
import com.thundercrew.opsapi.rider.domain.RiderEducationType;
import java.time.Instant;
import java.util.UUID;

public record RiderEducationRecordReadResponse(
        UUID id,
        Long idx,
        UUID riderId,
        RiderEducationType educationType,
        String courseName,
        Instant completedAt,
        Instant expiresAt,
        String certificateNo,
        String issuingAuthority,
        String evidenceUrl,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
    public static RiderEducationRecordReadResponse from(RiderEducationRecord record) {
        return new RiderEducationRecordReadResponse(
                record.getId(),
                record.getIdx(),
                record.getRiderId(),
                record.getEducationType(),
                record.getCourseName(),
                record.getCompletedAt(),
                record.getExpiresAt(),
                record.getCertificateNo(),
                record.getIssuingAuthority(),
                record.getEvidenceUrl(),
                record.getMemo(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }
}
