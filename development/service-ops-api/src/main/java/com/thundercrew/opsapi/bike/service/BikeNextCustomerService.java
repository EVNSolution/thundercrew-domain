package com.thundercrew.opsapi.bike.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeNextCustomer;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.bike.dto.BikeNextCustomerRequest;
import com.thundercrew.opsapi.bike.dto.BikeNextCustomerResponse;
import com.thundercrew.opsapi.bike.repository.BikeNextCustomerRepository;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BikeNextCustomerService {

    private final BikeRepository bikeRepository;
    private final BikeNextCustomerRepository nextCustomerRepository;

    public BikeNextCustomerService(BikeRepository bikeRepository,
                                    BikeNextCustomerRepository nextCustomerRepository) {
        this.bikeRepository = bikeRepository;
        this.nextCustomerRepository = nextCustomerRepository;
    }

    public Optional<BikeNextCustomerResponse> get(UUID bikeId) {
        requireCleaningBike(bikeId);
        return nextCustomerRepository.findById(bikeId).map(BikeNextCustomerResponse::from);
    }

    @Transactional
    public void clear(UUID bikeId) {
        requireCleaningBike(bikeId);
        nextCustomerRepository.deleteById(bikeId);
    }

    @Transactional
    public BikeNextCustomerResponse upsert(UUID bikeId, BikeNextCustomerRequest request) {
        requireCleaningBike(bikeId);
        BikeNextCustomer entity = nextCustomerRepository.findById(bikeId)
                .map(existing -> {
                    existing.update(request.customerName(), request.customerPhone(),
                            request.address(), request.latitude(), request.longitude());
                    return existing;
                })
                .orElseGet(() -> BikeNextCustomer.create(
                        bikeId, request.customerName(), request.customerPhone(),
                        request.address(), request.latitude(), request.longitude()));
        return BikeNextCustomerResponse.from(nextCustomerRepository.save(entity));
    }

    @Transactional
    public void promote(UUID bikeId) {
        requireCleaningBike(bikeId);
        nextCustomerRepository.findById(bikeId).ifPresent(entity -> {
            entity.promote();
            nextCustomerRepository.save(entity);
        });
    }

    private void requireCleaningBike(UUID bikeId) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));
        if (bike.getServiceType() != BikeServiceType.CLEANING) {
            throw new InvalidStateTransitionException(
                    "Bike " + bikeId + " is not of CLEANING service type.");
        }
    }
}
