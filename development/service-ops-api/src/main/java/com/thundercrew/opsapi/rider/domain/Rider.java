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

    protected Rider() {
    }
}
