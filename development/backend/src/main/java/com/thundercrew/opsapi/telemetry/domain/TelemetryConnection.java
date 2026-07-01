package com.thundercrew.opsapi.telemetry.domain;

import java.time.Duration;
import java.time.Instant;

/** 마지막 수신 시각 + 시동 상태 기준 연결 판정. 시동 ON=2분, OFF/UNKNOWN=120분 무수신이면 OFFLINE. */
public final class TelemetryConnection {

    /** 시동 ON: 보고 주기 빠름(~1분) → 2분 무수신이면 미연결. */
    public static final Duration IGNITION_ON_OFFLINE_THRESHOLD = Duration.ofMinutes(2);

    /** 시동 OFF/UNKNOWN: 보고 주기 느림(~1시간 keep-alive) → 120분 무수신이면 미연결. */
    public static final Duration DEFAULT_OFFLINE_THRESHOLD = Duration.ofMinutes(120);

    private TelemetryConnection() {
    }

    /** "ONLINE"/"OFFLINE". 임계값은 시동 상태에 종속(ON=2분, 그 외=120분). */
    public static String status(Instant lastReceivedAt, Instant now, TelemetryIgnitionStatus ignition) {
        if (lastReceivedAt == null) {
            return "OFFLINE";
        }
        Duration threshold = ignition == TelemetryIgnitionStatus.ON
                ? IGNITION_ON_OFFLINE_THRESHOLD
                : DEFAULT_OFFLINE_THRESHOLD;
        Duration age = Duration.between(lastReceivedAt, now);
        return age.compareTo(threshold) <= 0 ? "ONLINE" : "OFFLINE";
    }
}
