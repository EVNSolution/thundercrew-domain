package com.thundercrew.opsapi.settings.service;

import com.thundercrew.opsapi.audit.service.AuditLogCommandService;
import com.thundercrew.opsapi.common.api.ValidationFailedException;
import com.thundercrew.opsapi.settings.domain.AppSetting;
import com.thundercrew.opsapi.settings.repository.AppSettingRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 운영 설정 (4단계 §6). 코드 기본값(@Value) 위에 DB 행이 오버레이되는 구조 —
 * 행이 없으면 기본값이 그대로 산다.
 *
 * 소비처: DispatchCompletionEvaluator(틱마다 {@link #dispatchTuning()} 1회),
 * DispatchOrderCommandService/BulkService(요청당 기본 소요분 조회). 캐시는
 * 두지 않는다 — 행 4개 findAll 은 틱당 비용이 무의미하고, 설정 변경이 다음
 * 요청/틱에 바로 반영되는 편이 운영 보정 목적에 맞다.
 */
@Service
@Transactional(readOnly = true)
public class AppSettingService {

    /** §6 이 노출하는 운영 기준값 키 — 이 목록 밖의 키는 쓰기를 거부한다. */
    public static final String KEY_DEFAULT_SERVICE_MINUTES = "dispatch.default-service-minutes";
    public static final String KEY_DUE_LEAD_MINUTES = "dispatch.due-lead-minutes";
    public static final String KEY_ARRIVAL_RADIUS_M = "dispatch.arrival-radius-m";
    public static final String KEY_ARRIVAL_STOP_MINUTES = "dispatch.arrival-stop-minutes";

    /** key → [min, max] 허용 범위. 어긋난 값은 400. */
    private static final Map<String, int[]> BOUNDS = Map.of(
            KEY_DEFAULT_SERVICE_MINUTES, new int[]{5, 1440},
            KEY_DUE_LEAD_MINUTES, new int[]{5, 720},
            KEY_ARRIVAL_RADIUS_M, new int[]{30, 2000},
            KEY_ARRIVAL_STOP_MINUTES, new int[]{1, 60});

    /** 완료 추정·시간 배차가 쓰는 기준값 스냅숏 — 틱/요청당 1회 조회용. */
    public record DispatchTuning(
            int defaultServiceMinutes,
            int dueLeadMinutes,
            int arrivalRadiusMeters,
            int arrivalStopMinutes
    ) {}

    private final AppSettingRepository repository;
    private final AuditLogCommandService auditLogCommandService;
    private final Clock clock;

    private final int fallbackServiceMinutes;
    private final int fallbackDueLead;
    private final int fallbackRadius;
    private final int fallbackStopMinutes;

    public AppSettingService(
            AppSettingRepository repository,
            AuditLogCommandService auditLogCommandService,
            Clock clock,
            @Value("${thundercrew.dispatch.default-service-minutes:60}") int fallbackServiceMinutes,
            @Value("${thundercrew.dispatch.due-lead-minutes:30}") int fallbackDueLead,
            @Value("${thundercrew.dispatch.arrival-radius-m:100}") int fallbackRadius,
            @Value("${thundercrew.dispatch.arrival-stop-minutes:3}") int fallbackStopMinutes
    ) {
        this.repository = repository;
        this.auditLogCommandService = auditLogCommandService;
        this.clock = clock;
        this.fallbackServiceMinutes = fallbackServiceMinutes;
        this.fallbackDueLead = fallbackDueLead;
        this.fallbackRadius = fallbackRadius;
        this.fallbackStopMinutes = fallbackStopMinutes;
    }

    public DispatchTuning dispatchTuning() {
        Map<String, String> stored = new LinkedHashMap<>();
        repository.findAll().forEach(s -> stored.put(s.getKey(), s.getValue()));
        return new DispatchTuning(
                intOr(stored.get(KEY_DEFAULT_SERVICE_MINUTES), fallbackServiceMinutes),
                intOr(stored.get(KEY_DUE_LEAD_MINUTES), fallbackDueLead),
                intOr(stored.get(KEY_ARRIVAL_RADIUS_M), fallbackRadius),
                intOr(stored.get(KEY_ARRIVAL_STOP_MINUTES), fallbackStopMinutes));
    }

    /** 현재 유효값(기본값 오버레이 적용) — 설정 화면 표시용. */
    public Map<String, Integer> effectiveValues() {
        DispatchTuning tuning = dispatchTuning();
        Map<String, Integer> values = new LinkedHashMap<>();
        values.put(KEY_DEFAULT_SERVICE_MINUTES, tuning.defaultServiceMinutes());
        values.put(KEY_DUE_LEAD_MINUTES, tuning.dueLeadMinutes());
        values.put(KEY_ARRIVAL_RADIUS_M, tuning.arrivalRadiusMeters());
        values.put(KEY_ARRIVAL_STOP_MINUTES, tuning.arrivalStopMinutes());
        return values;
    }

    @Transactional
    public Map<String, Integer> update(Map<String, Integer> changes, UUID updatedBy) {
        Instant now = Instant.now(clock);
        for (Map.Entry<String, Integer> entry : changes.entrySet()) {
            String key = entry.getKey();
            Integer value = entry.getValue();
            int[] bounds = BOUNDS.get(key);
            if (bounds == null) {
                throw new ValidationFailedException("알 수 없는 설정 키입니다: " + key);
            }
            if (value == null || value < bounds[0] || value > bounds[1]) {
                throw new ValidationFailedException(
                        key + " 값은 " + bounds[0] + "~" + bounds[1] + " 이어야 합니다.");
            }
            AppSetting existing = repository.findById(key).orElse(null);
            String old = existing != null ? existing.getValue() : null;
            if (existing != null) {
                existing.update(String.valueOf(value), now, updatedBy);
            } else {
                repository.save(AppSetting.of(key, String.valueOf(value), now, updatedBy));
            }
            auditLogCommandService.log("APP_SETTING", null, key, old, String.valueOf(value));
        }
        return effectiveValues();
    }

    private static int intOr(String raw, int fallback) {
        if (raw == null) return fallback;
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
