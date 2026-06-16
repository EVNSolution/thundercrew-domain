package com.thundercrew.opsapi.contract.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.contract.domain.ContractTemplate;
import com.thundercrew.opsapi.contract.dto.ContractTemplateReadResponse;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractReadResponse;
import com.thundercrew.opsapi.contract.repository.ContractTemplateRepository;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.rider.domain.Rider;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ContractReadService {

    private final ContractTemplateRepository contractTemplateRepository;
    private final RiderBikeContractRepository riderBikeContractRepository;
    private final BikeRepository bikeRepository;
    private final RiderRepository riderRepository;

    public ContractReadService(
            ContractTemplateRepository contractTemplateRepository,
            RiderBikeContractRepository riderBikeContractRepository,
            BikeRepository bikeRepository,
            RiderRepository riderRepository
    ) {
        this.contractTemplateRepository = contractTemplateRepository;
        this.riderBikeContractRepository = riderBikeContractRepository;
        this.bikeRepository = bikeRepository;
        this.riderRepository = riderRepository;
    }

    public PageResponse<ContractTemplateReadResponse> listTemplates(Pageable pageable) {
        return PageResponse.of(contractTemplateRepository.findByDeletedAtIsNull(pageable).map(ContractTemplateReadResponse::from));
    }

    public ContractTemplateReadResponse getTemplate(UUID id) {
        return contractTemplateRepository.findByIdAndDeletedAtIsNull(id)
                .map(ContractTemplateReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("ContractTemplate", id));
    }

    public PageResponse<RiderBikeContractReadResponse> listRiderBikeContracts(Pageable pageable) {
        Page<com.thundercrew.opsapi.contract.domain.RiderBikeContract> page =
                riderBikeContractRepository.findByDeletedAtIsNull(pageable);

        Set<UUID> bikeIds = page.getContent().stream()
                .map(com.thundercrew.opsapi.contract.domain.RiderBikeContract::getBikeId)
                .collect(Collectors.toSet());
        Set<UUID> riderIds = page.getContent().stream()
                .map(com.thundercrew.opsapi.contract.domain.RiderBikeContract::getRiderId)
                .collect(Collectors.toSet());

        Set<UUID> templateIds = page.getContent().stream()
                .map(com.thundercrew.opsapi.contract.domain.RiderBikeContract::getContractTemplateId)
                .collect(Collectors.toSet());

        Map<UUID, Bike> bikeMap = bikeRepository.findAllByIdIn(bikeIds).stream()
                .collect(Collectors.toMap(Bike::getId, b -> b));
        Map<UUID, Rider> riderMap = riderRepository.findAllByIdIn(riderIds).stream()
                .collect(Collectors.toMap(Rider::getId, r -> r));
        Map<UUID, ContractTemplate> templateMap = contractTemplateRepository.findAllByIdIn(templateIds).stream()
                .collect(Collectors.toMap(ContractTemplate::getId, t -> t));

        return PageResponse.of(page.map(contract -> {
            Bike bike = bikeMap.get(contract.getBikeId());
            Rider rider = riderMap.get(contract.getRiderId());
            ContractTemplate template = templateMap.get(contract.getContractTemplateId());
            return RiderBikeContractReadResponse.from(
                    contract,
                    bike != null ? bike.getPlateNumber() : null,
                    rider != null ? rider.getName() : null,
                    rider != null ? rider.getPhoneNumber() : null,
                    template != null ? template.getCategory() : null,
                    template != null ? template.getReturnType() : null
            );
        }));
    }

    public RiderBikeContractReadResponse getRiderBikeContract(UUID id) {
        return riderBikeContractRepository.findByIdAndDeletedAtIsNull(id)
                .map(RiderBikeContractReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("RiderBikeContract", id));
    }
}
