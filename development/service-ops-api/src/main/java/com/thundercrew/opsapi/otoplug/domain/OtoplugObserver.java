package com.thundercrew.opsapi.otoplug.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Persisted record of an OTOPLUG NT observer registration. One active row per
 * {@code api} (enforced by a unique index) so the observer can be ignored
 * (unregistered) later using the id/token returned at registration time.
 */
@Entity
@Table(name = "otoplug_observers")
public class OtoplugObserver {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, insertable = false, updatable = false)
    private Long idx;

    @Column(nullable = false, length = 100)
    private String api;

    @Column(name = "observer_id", nullable = false, length = 100)
    private String observerId;

    @Column(name = "channel_token", nullable = false, length = 200)
    private String channelToken;

    @Column(name = "callback_url", nullable = false)
    private String callbackUrl;

    @Column(name = "registered_at", nullable = false)
    private Instant registeredAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected OtoplugObserver() {
    }

    public static OtoplugObserver create(
            String api,
            String observerId,
            String channelToken,
            String callbackUrl,
            Instant registeredAt
    ) {
        OtoplugObserver observer = new OtoplugObserver();
        observer.id = UUID.randomUUID();
        observer.api = api;
        observer.observerId = observerId;
        observer.channelToken = channelToken;
        observer.callbackUrl = callbackUrl;
        observer.registeredAt = registeredAt;
        return observer;
    }

    public UUID getId() {
        return id;
    }

    public Long getIdx() {
        return idx;
    }

    public String getApi() {
        return api;
    }

    public String getObserverId() {
        return observerId;
    }

    public String getChannelToken() {
        return channelToken;
    }

    public String getCallbackUrl() {
        return callbackUrl;
    }

    public Instant getRegisteredAt() {
        return registeredAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
