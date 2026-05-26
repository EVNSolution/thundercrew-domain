package com.thundercrew.opsapi.cleaningschedule.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface CleaningScheduleRepository extends JpaRepository<CleaningSchedule, UUID> {
    List<CleaningSchedule> findByBikeIdOrderByScheduledAtAsc(UUID bikeId);
    List<CleaningSchedule> findAllByOrderByScheduledAtAsc();
}
