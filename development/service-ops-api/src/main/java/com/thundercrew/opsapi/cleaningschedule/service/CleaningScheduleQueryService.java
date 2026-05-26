package com.thundercrew.opsapi.cleaningschedule.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.cleaningschedule.domain.CleaningSchedule;
import com.thundercrew.opsapi.cleaningschedule.domain.CleaningScheduleRepository;
import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleReadResponse;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class CleaningScheduleQueryService {

    private final CleaningScheduleRepository scheduleRepo;
    private final BikeRepository bikeRepo;

    public CleaningScheduleQueryService(CleaningScheduleRepository scheduleRepo, BikeRepository bikeRepo) {
        this.scheduleRepo = scheduleRepo;
        this.bikeRepo = bikeRepo;
    }

    public List<CleaningScheduleReadResponse> findByBikeId(String bikeIdStr) {
        UUID bikeUuid = UUID.fromString(bikeIdStr);
        Bike bike = bikeRepo.findByIdAndDeletedAtIsNull(bikeUuid)
            .orElseThrow(() -> new EntityNotFoundException("Bike not found: " + bikeIdStr));
        return scheduleRepo.findByBikeIdOrderByScheduledAtAsc(bikeUuid).stream()
            .map(s -> CleaningScheduleReadResponse.of(s, bike.getPlateNumber()))
            .toList();
    }

    public List<CleaningScheduleReadResponse> findAll() {
        List<CleaningSchedule> schedules = scheduleRepo.findAllByOrderByScheduledAtAsc();
        if (schedules.isEmpty()) return List.of();

        Set<UUID> bikeIds = schedules.stream()
            .map(CleaningSchedule::getBikeId)
            .collect(java.util.stream.Collectors.toSet());

        Map<UUID, String> plateByBikeId = bikeRepo.findByIdInAndDeletedAtIsNull(bikeIds).stream()
            .collect(java.util.stream.Collectors.toMap(Bike::getId, Bike::getPlateNumber));

        return schedules.stream()
            .map(s -> CleaningScheduleReadResponse.of(s, plateByBikeId.getOrDefault(s.getBikeId(), "")))
            .toList();
    }
}
