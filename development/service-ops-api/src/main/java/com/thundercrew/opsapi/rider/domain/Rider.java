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
            this.teamName = teamName;
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
