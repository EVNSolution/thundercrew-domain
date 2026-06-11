package com.thundercrew.opsapi.tip.repository;

import com.thundercrew.opsapi.tip.domain.Tip;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface TipRepository extends Repository<Tip, UUID> {

    Page<Tip> findByDeletedAtIsNull(Pageable pageable);

    Optional<Tip> findByIdAndDeletedAtIsNull(UUID id);

    Tip save(Tip tip);

    List<Tip> findAllByDeletedAtIsNull();
}
