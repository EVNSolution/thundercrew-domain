package com.thundercrew.opsapi.cleaningschedule.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.cleaningschedule.domain.CleaningSchedule;
import com.thundercrew.opsapi.cleaningschedule.domain.CleaningScheduleRepository;
import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleCreateRequest;
import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleReadResponse;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
@Transactional
public class CleaningScheduleCommandService {

    private final CleaningScheduleRepository scheduleRepo;
    private final BikeRepository bikeRepo;

    public CleaningScheduleCommandService(CleaningScheduleRepository scheduleRepo, BikeRepository bikeRepo) {
        this.scheduleRepo = scheduleRepo;
        this.bikeRepo = bikeRepo;
    }

    public CleaningScheduleReadResponse create(CleaningScheduleCreateRequest request) {
        UUID bikeUuid = UUID.fromString(request.bikeId());
        Bike bike = bikeRepo.findByIdAndDeletedAtIsNull(bikeUuid)
            .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeUuid));
        if (bike.getServiceType() != BikeServiceType.CLEANING) {
            throw new InvalidStateTransitionException(
                "Bike " + request.bikeId() + " is not a CLEANING service type: " + bike.getServiceType());
        }
        CleaningSchedule schedule = CleaningSchedule.create(
            bikeUuid, request.scheduledAt(), request.address(), request.memo()
        );
        CleaningSchedule saved = scheduleRepo.save(schedule);
        return CleaningScheduleReadResponse.of(saved, bike.getPlateNumber());
    }
}
