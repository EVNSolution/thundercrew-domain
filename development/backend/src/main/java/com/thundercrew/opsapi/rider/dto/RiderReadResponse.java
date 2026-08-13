package com.thundercrew.opsapi.rider.dto;

import com.thundercrew.opsapi.rider.domain.Rider;
import com.thundercrew.opsapi.rider.domain.RiderEducationRecord;
import com.thundercrew.opsapi.rider.domain.RiderEducationType;
import com.thundercrew.opsapi.rider.domain.RiderRole;
import com.thundercrew.opsapi.rider.domain.RiderSkillLevel;
import com.thundercrew.opsapi.rider.domain.RiderTrainingStatus;
import java.time.Instant;
import java.util.UUID;

public record RiderReadResponse(
        UUID id,
        Long idx,
        String name,
        String phoneNumber,
        String teamName,
        /** 직무. 차량의 용도와 짝을 이루는 축이다. */
        RiderRole role,
        /** 숙련도. null 이면 아직 판단하지 않은 상태다. */
        RiderSkillLevel skillLevel,
        String areaName,
        boolean appAccountLinked,
        UUID appAccountId,
        Instant appLinkedAt,
        String appLinkStatus,
        String memo,
        String primaryInsurance,
        String addonInsurance,
        boolean educationCompleted,
        RiderEducationType latestEducationType,
        Instant latestEducationCompletedAt,
        boolean educationExpired,
        RiderTrainingStatus trainingStatus,
        Instant createdAt,
        Instant updatedAt
) {
    /**
     * Page 응답에서 사용하는 N+1 free 형태. 교육 요약은 모두 비어 있고,
     * 단건 상세 조회({@link #from(Rider, RiderEducationRecord, Instant)}) 에서
     * 채워진다.
     */
    public static RiderReadResponse from(Rider rider) {
        return new RiderReadResponse(
                rider.getId(),
                rider.getIdx(),
                rider.getName(),
                rider.getPhoneNumber(),
                rider.getTeamName(),
                rider.getRole(),
                rider.getSkillLevel(),
                rider.getAreaName(),
                rider.isAppAccountLinked(),
                rider.getAppAccountId(),
                rider.getAppLinkedAt(),
                rider.isAppAccountLinked() ? "LINKED" : "NOT_LINKED",
                rider.getMemo(),
                rider.getPrimaryInsurance(),
                rider.getAddonInsurance(),
                false,
                null,
                null,
                false,
                rider.getTrainingStatus(),
                rider.getCreatedAt(),
                rider.getUpdatedAt()
        );
    }

    /**
     * 단건 상세 조회용. 가장 최근 교육 record + 현재 시점을 받아 만료 여부를
     * 계산한다. {@code latest} 가 {@code null} 이면 educationCompleted=false 로
     * 비어 있는 상태가 된다.
     */
    public static RiderReadResponse from(Rider rider, RiderEducationRecord latest, Instant now) {
        boolean completed = latest != null;
        Instant completedAt = completed ? latest.getCompletedAt() : null;
        RiderEducationType type = completed ? latest.getEducationType() : null;
        boolean expired = completed
                && latest.getExpiresAt() != null
                && now != null
                && !now.isBefore(latest.getExpiresAt());
        return new RiderReadResponse(
                rider.getId(),
                rider.getIdx(),
                rider.getName(),
                rider.getPhoneNumber(),
                rider.getTeamName(),
                rider.getRole(),
                rider.getSkillLevel(),
                rider.getAreaName(),
                rider.isAppAccountLinked(),
                rider.getAppAccountId(),
                rider.getAppLinkedAt(),
                rider.isAppAccountLinked() ? "LINKED" : "NOT_LINKED",
                rider.getMemo(),
                rider.getPrimaryInsurance(),
                rider.getAddonInsurance(),
                completed,
                type,
                completedAt,
                expired,
                rider.getTrainingStatus(),
                rider.getCreatedAt(),
                rider.getUpdatedAt()
        );
    }
}
