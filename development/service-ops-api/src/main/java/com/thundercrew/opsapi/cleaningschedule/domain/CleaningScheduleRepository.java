package com.thundercrew.opsapi.cleaningschedule.domain;

import org.springframework.data.repository.Repository;
import java.util.List;
import java.util.UUID;

public interface CleaningScheduleRepository extends Repository<CleaningSchedule, UUID> {

    CleaningSchedule save(CleaningSchedule schedule);

    List<CleaningSchedule> findByBikeIdOrderByScheduledAtAsc(UUID bikeId);

    List<CleaningSchedule> findAllByOrderByScheduledAtAsc();
}
