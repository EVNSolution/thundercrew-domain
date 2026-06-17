package com.thundercrew.opsapi.notification.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notifications")
public class Notification extends DisplaySequencedEntity {

    @Column(name = "type", nullable = false, length = 40)
    private String type;

    @Column(name = "title", nullable = false, columnDefinition = "text")
    private String title;

    @Column(name = "body", columnDefinition = "text")
    private String body;

    @Column(name = "ref_bike_id")
    private UUID refBikeId;

    @Column(name = "ref_entity_id")
    private UUID refEntityId;

    @Column(name = "ref_rider_id")
    private UUID refRiderId;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "acknowledged_at")
    private Instant acknowledgedAt;

    public static Notification create(
            String type,
            String title,
            String body,
            UUID refBikeId,
            UUID refEntityId,
            UUID refRiderId,
            Instant occurredAt
    ) {
        Notification notification = new Notification();
        notification.type = type;
        notification.title = title;
        notification.body = body;
        notification.refBikeId = refBikeId;
        notification.refEntityId = refEntityId;
        notification.refRiderId = refRiderId;
        notification.occurredAt = occurredAt;
        notification.acknowledgedAt = null;
        return notification;
    }

    public void acknowledge(Instant when) {
        this.acknowledgedAt = when;
    }

    public String getType() {
        return type;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public UUID getRefBikeId() {
        return refBikeId;
    }

    public UUID getRefEntityId() {
        return refEntityId;
    }

    public UUID getRefRiderId() {
        return refRiderId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public Instant getAcknowledgedAt() {
        return acknowledgedAt;
    }

    protected Notification() {
    }
}
