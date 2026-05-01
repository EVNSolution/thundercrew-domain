package com.thundercrew.opsapi.contract.service;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.contract.dto.ContractTemplateReadResponse;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractReadResponse;
import com.thundercrew.opsapi.contract.repository.ContractTemplateRepository;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ContractReadService {

    private final ContractTemplateRepository contractTemplateRepository;
    private final RiderBikeContractRepository riderBikeContractRepository;

    public ContractReadService(ContractTemplateRepository contractTemplateRepository, RiderBikeContractRepository riderBikeContractRepository) {
        this.contractTemplateRepository = contractTemplateRepository;
        this.riderBikeContractRepository = riderBikeContractRepository;
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
        return PageResponse.of(riderBikeContractRepository.findByDeletedAtIsNull(pageable).map(RiderBikeContractReadResponse::from));
    }

    public RiderBikeContractReadResponse getRiderBikeContract(UUID id) {
        return riderBikeContractRepository.findByIdAndDeletedAtIsNull(id)
                .map(RiderBikeContractReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("RiderBikeContract", id));
    }
}
