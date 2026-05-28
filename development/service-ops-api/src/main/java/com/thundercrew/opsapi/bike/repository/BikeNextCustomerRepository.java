package com.thundercrew.opsapi.bike.repository;

import com.thundercrew.opsapi.bike.domain.BikeNextCustomer;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface BikeNextCustomerRepository extends Repository<BikeNextCustomer, UUID> {
    Optional<BikeNextCustomer> findById(UUID bikeId);
    BikeNextCustomer save(BikeNextCustomer entity);
}
