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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class OtoplugObserverService {

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
            client.ignoreObserver(observer.getApi(), observer.getObserverId(), observer.getChannelToken());
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
