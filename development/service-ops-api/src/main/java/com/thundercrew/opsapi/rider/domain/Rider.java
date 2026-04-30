package com.thundercrew.opsapi.rider.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

    @Column(length = 100)
    private String areaName;

    @Column(nullable = false)
    private boolean appAccountLinked;

    private UUID appAccountId;

    private Instant appLinkedAt;

    private String memo;

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
            String memo
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

    protected Rider() {
    }
}
