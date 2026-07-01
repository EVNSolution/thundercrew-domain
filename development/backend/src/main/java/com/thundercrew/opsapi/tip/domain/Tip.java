package com.thundercrew.opsapi.tip.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "tips")
public class Tip extends DisplaySequencedEntity {

    @Column(nullable = false, columnDefinition = "text")
    private String address;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipStatus status;

    @Column(name = "submitted_by_rider_id")
    private UUID submittedByRiderId;

    public static Tip create(String address, String content, double latitude, double longitude) {
        Tip tip = new Tip();
        tip.address = address;
        tip.content = content;
        tip.latitude = latitude;
        tip.longitude = longitude;
        tip.status = TipStatus.PUBLISHED;
        tip.submittedByRiderId = null;
        return tip;
    }

    public static Tip createSubmission(String address, String content, double latitude, double longitude, UUID riderId) {
        Tip tip = new Tip();
        tip.address = address;
        tip.content = content;
        tip.latitude = latitude;
        tip.longitude = longitude;
        tip.status = TipStatus.PENDING;
        tip.submittedByRiderId = riderId;
        return tip;
    }

    public void update(String address, String content, double latitude, double longitude) {
        this.address = address;
        this.content = content;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public void publish() {
        if (this.status == TipStatus.PENDING) {
            this.status = TipStatus.PUBLISHED;
        }
    }

    public String getAddress() {
        return address;
    }

    public String getContent() {
        return content;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public TipStatus getStatus() {
        return status;
    }

    public UUID getSubmittedByRiderId() {
        return submittedByRiderId;
    }

    protected Tip() {
    }
}
