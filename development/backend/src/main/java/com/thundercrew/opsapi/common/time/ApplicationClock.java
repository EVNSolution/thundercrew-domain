package com.thundercrew.opsapi.common.time;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ApplicationClock {

    public static final ZoneId OPERATION_ZONE = ZoneId.of("Asia/Seoul");

    @Bean
    Clock clock() {
        return Clock.system(OPERATION_ZONE);
    }

    public Instant now(Clock clock) {
        return Instant.now(clock);
    }
}
