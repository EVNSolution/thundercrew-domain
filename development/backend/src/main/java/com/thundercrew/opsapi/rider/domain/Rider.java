package com.thundercrew.opsapi.rider.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "riders")
public class Rider extends DisplaySequencedEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 30)
    private String phoneNumber;

    @Column(length = 100)
    private String teamName;

    /**
     * 직무 — 라이더인지 클리너인지. 차량의 용도({@code BikePurpose})와 짝을 이루는
     * 축이다. 이 단계에서는 배차 로직이 직무로 분기하지 않는 서술 값이다.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private RiderRole role = RiderRole.RIDER;

    /**
     * 숙련도. <b>null 을 허용한다</b> — "아직 판단하지 않았다"와 "초보다"는 다른
     * 상태이고, 기본값을 초보로 두면 전원이 초보로 표시된다.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "skill_level", length = 20)
    private RiderSkillLevel skillLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "training_status", length = 20)
    private RiderTrainingStatus trainingStatus;

    @Column(length = 100)
    private String areaName;

    @Column(nullable = false)
    private boolean appAccountLinked;

    private UUID appAccountId;

    private Instant appLinkedAt;

    private String memo;

    @Column(name = "primary_insurance", columnDefinition = "text")
    private String primaryInsurance;

    @Column(name = "addon_insurance", columnDefinition = "text")
    private String addonInsurance;

    public static Rider create(
            String name,
            String phoneNumber,
            String teamName,
            String areaName,
            String memo
    ) {
        Rider rider = new Rider();
        rider.name = name;
        rider.phoneNumber = phoneNumber;
        rider.teamName = teamName;
        rider.areaName = areaName;
        rider.memo = memo;
        rider.appAccountLinked = false;
        return rider;
    }

    public void updateBasicProfile(
            String name,
            String phoneNumber,
            String teamName,
            String areaName,
            String memo,
            String primaryInsurance,
            String addonInsurance
    ) {
        if (name != null) {
            this.name = name;
        }
        if (phoneNumber != null) {
            this.phoneNumber = phoneNumber;
        }
        if (teamName != null) {
            // 빈 문자열은 "팀 없음" 의도다 — placeholder 문자열이 데이터로
            // 굳지 않도록 null 로 정규화한다. (null 은 여전히 "무변경".)
            this.teamName = teamName.isBlank() ? null : teamName;
        }
        if (areaName != null) {
            this.areaName = areaName;
        }
        if (memo != null) {
            this.memo = memo;
        }
        if (primaryInsurance != null) {
            this.primaryInsurance = primaryInsurance;
        }
        if (addonInsurance != null) {
            this.addonInsurance = addonInsurance;
        }
    }

    public void linkAppAccount(UUID appAccountId, Instant appLinkedAt) {
        this.appAccountLinked = true;
        this.appAccountId = appAccountId;
        this.appLinkedAt = appLinkedAt;
    }

    public void unlinkAppAccount() {
        this.appAccountLinked = false;
        this.appAccountId = null;
        this.appLinkedAt = null;
    }

    public String getName() {
        return name;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public String getTeamName() {
        return teamName;
    }

    public String getAreaName() {
        return areaName;
    }

    public boolean isAppAccountLinked() {
        return appAccountLinked;
    }

    public java.util.UUID getAppAccountId() {
        return appAccountId;
    }

    public java.time.Instant getAppLinkedAt() {
        return appLinkedAt;
    }

    public String getMemo() {
        return memo;
    }

    public String getPrimaryInsurance() {
        return primaryInsurance;
    }

    public String getAddonInsurance() {
        return addonInsurance;
    }

    public RiderRole getRole() {
        return role;
    }

    public void setRole(RiderRole role) {
        this.role = role;
    }

    public RiderSkillLevel getSkillLevel() {
        return skillLevel;
    }

    public void setSkillLevel(RiderSkillLevel skillLevel) {
        this.skillLevel = skillLevel;
    }

    public RiderTrainingStatus getTrainingStatus() {
        return trainingStatus;
    }

    public void updateTrainingStatus(RiderTrainingStatus trainingStatus) {
        if (trainingStatus != null) {
            this.trainingStatus = trainingStatus;
        }
    }

    protected Rider() {
    }
}
