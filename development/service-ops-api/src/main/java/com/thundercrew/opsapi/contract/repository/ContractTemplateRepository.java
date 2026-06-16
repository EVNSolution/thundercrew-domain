package com.thundercrew.opsapi.contract.repository;

import com.thundercrew.opsapi.contract.domain.ContractCategory;
import com.thundercrew.opsapi.contract.domain.ContractReturnType;
import com.thundercrew.opsapi.contract.domain.ContractTemplate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface ContractTemplateRepository extends Repository<ContractTemplate, UUID> {

    Page<ContractTemplate> findByDeletedAtIsNull(Pageable pageable);

    Optional<ContractTemplate> findById(UUID id);

    Optional<ContractTemplate> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByNameAndDeletedAtIsNull(String name);

    boolean existsByNameAndIdNotAndDeletedAtIsNull(String name, UUID id);

    ContractTemplate save(ContractTemplate template);

    List<ContractTemplate> findAllByIdIn(Collection<UUID> ids);

    Optional<ContractTemplate> findFirstByCategoryAndReturnTypeAndEnabledTrueAndDeletedAtIsNull(
            ContractCategory category, ContractReturnType returnType);
}
