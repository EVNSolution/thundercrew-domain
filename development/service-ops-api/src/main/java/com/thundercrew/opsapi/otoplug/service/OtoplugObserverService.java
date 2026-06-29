package com.thundercrew.opsapi.otoplug.service;

import com.thundercrew.opsapi.otoplug.OtoplugClient;
import com.thundercrew.opsapi.otoplug.OtoplugProperties;
import com.thundercrew.opsapi.otoplug.domain.OtoplugObserver;
import com.thundercrew.opsapi.otoplug.dto.OtoplugObserverStatusResponse;
import com.thundercrew.opsapi.otoplug.repository.OtoplugObserverRepository;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class OtoplugObserverService {

    private static final Logger log = LoggerFactory.getLogger(OtoplugObserverService.class);

    /** OTOPLUG NT APIs this service registers, paired with their callback suffix. */
    private static final List<TargetApi> TARGET_APIS = List.of(
            new TargetApi("csi.terminal.status.data.driving", "/driving"),
            new TargetApi("csi.terminal.status.data.drivingDetail", "/driving-detail")
    );

    private final OtoplugObserverRepository repository;
    private final OtoplugClient client;
    private final OtoplugProperties properties;
    private final Clock clock;

    public OtoplugObserverService(
            OtoplugObserverRepository repository,
            OtoplugClient client,
            OtoplugProperties properties,
            Clock clock
    ) {
        this.repository = repository;
        this.client = client;
        this.properties = properties;
        this.clock = clock;
    }

    public OtoplugObserverStatusResponse register() {
        for (TargetApi target : TARGET_APIS) {
            if (repository.existsByApi(target.api())) {
                continue;
            }
            String observerId = UUID.randomUUID().toString();
            String callbackUrl = properties.callbackBaseUrl() + target.callbackSuffix();
            client.registerObserver(target.api(), observerId, callbackUrl, properties.channelToken());
            repository.save(OtoplugObserver.create(
                    target.api(),
                    observerId,
                    properties.channelToken(),
                    callbackUrl,
                    clock.instant()
            ));
        }
        return status();
    }

    public OtoplugObserverStatusResponse ignore() {
        for (OtoplugObserver observer : repository.findAll()) {
            // OTOPLUG 해제가 "이미 없음"(result 8000014 등)이거나 일시 오류여도 우리 추적
            // row 는 무조건 정리한다. 안 그러면 stale row 가 남아 "수신 중지" 가 영구히
            // 500 으로 막힌다 — 해제의 목적은 우리 상태 제거이므로 OTOPLUG 측 실패는 로그만.
            try {
                client.ignoreObserver(observer.getApi(), observer.getObserverId(), observer.getChannelToken());
            } catch (RuntimeException exception) {
                log.warn("OTOPLUG observer 해제 실패(무시하고 row 정리) api={}: {}",
                        observer.getApi(), exception.getMessage());
            }
            repository.delete(observer);
        }
        return status();
    }

    @Transactional(readOnly = true)
    public OtoplugObserverStatusResponse status() {
        List<String> registeredApis = new ArrayList<>();
        boolean active = true;
        for (TargetApi target : TARGET_APIS) {
            Optional<OtoplugObserver> existing = repository.findByApi(target.api());
            if (existing.isPresent()) {
                registeredApis.add(target.api());
            } else {
                active = false;
            }
        }
        return new OtoplugObserverStatusResponse(active, registeredApis);
    }

    private record TargetApi(String api, String callbackSuffix) {
    }
}
