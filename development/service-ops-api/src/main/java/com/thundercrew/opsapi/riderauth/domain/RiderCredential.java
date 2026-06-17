package com.thundercrew.opsapi.riderauth.domain;

import com.thundercrew.opsapi.common.domain.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "rider_credentials")
public class RiderCredential extends AuditableEntity {

    @Column(nullable = false)
    private UUID riderId;

    @Column(nullable = false)
    private String passwordHash;

    public static RiderCredential create(UUID riderId, String passwordHash) {
        RiderCredential credential = new RiderCredential();
        credential.riderId = riderId;
        credential.passwordHash = passwordHash;
        return credential;
    }

    public void updatePasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public UUID getRiderId() {
        return riderId;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    protected RiderCredential() {
    }
}
