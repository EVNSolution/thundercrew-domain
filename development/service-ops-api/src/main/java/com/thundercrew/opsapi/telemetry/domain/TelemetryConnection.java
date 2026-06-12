package com.thundercrew.opsapi.telemetry.domain;

import java.time.Duration;
import java.time.Instant;

/** 마지막 수신 시각 기준 연결 판정. 120분 무수신이면 OFFLINE. */
public final class TelemetryConnection {

    /** 이 시간 넘게 수신 없으면 미연결. */
    public static final Duration OFFLINE_THRESHOLD = Duration.ofMinutes(120);

    private TelemetryConnection() {
    }

    /** "ONLINE" (<=120분) / "OFFLINE" (>120분). */
    public static String status(Instant lastReceivedAt, Instant now) {
        Duration age = Duration.between(lastReceivedAt, now);
        return age.compareTo(OFFLINE_THRESHOLD) <= 0 ? "ONLINE" : "OFFLINE";
    }
}
