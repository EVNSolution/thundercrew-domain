package com.thundercrew.opsapi.otoplug.repository;

import com.thundercrew.opsapi.otoplug.domain.OtoplugObserver;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface OtoplugObserverRepository extends Repository<OtoplugObserver, UUID> {

    OtoplugObserver save(OtoplugObserver observer);

    List<OtoplugObserver> findAll();

    Optional<OtoplugObserver> findByApi(String api);

    boolean existsByApi(String api);

    void delete(OtoplugObserver observer);
}
