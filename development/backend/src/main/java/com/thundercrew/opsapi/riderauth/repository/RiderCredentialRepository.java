package com.thundercrew.opsapi.riderauth.repository;

import com.thundercrew.opsapi.riderauth.domain.RiderCredential;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface RiderCredentialRepository extends Repository<RiderCredential, UUID> {

    Optional<RiderCredential> findByRiderId(UUID riderId);

    RiderCredential save(RiderCredential credential);
}
