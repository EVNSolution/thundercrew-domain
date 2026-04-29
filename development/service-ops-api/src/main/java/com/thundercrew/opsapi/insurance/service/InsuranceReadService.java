package com.thundercrew.opsapi.insurance.service;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.insurance.dto.InsuranceItemReadResponse;
import com.thundercrew.opsapi.insurance.dto.RiderInsuranceReadResponse;
import com.thundercrew.opsapi.insurance.repository.InsuranceItemRepository;
import com.thundercrew.opsapi.insurance.repository.RiderInsuranceRepository;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class InsuranceReadService {

    private final InsuranceItemRepository insuranceItemRepository;
    private final RiderInsuranceRepository riderInsuranceRepository;

    public InsuranceReadService(InsuranceItemRepository insuranceItemRepository, RiderInsuranceRepository riderInsuranceRepository) {
        this.insuranceItemRepository = insuranceItemRepository;
        this.riderInsuranceRepository = riderInsuranceRepository;
    }

    public PageResponse<InsuranceItemReadResponse> listItems(Pageable pageable) {
        return PageResponse.of(insuranceItemRepository.findByDeletedAtIsNull(pageable).map(InsuranceItemReadResponse::from));
    }

    public InsuranceItemReadResponse getItem(UUID id) {
        return insuranceItemRepository.findByIdAndDeletedAtIsNull(id)
                .map(InsuranceItemReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("InsuranceItem", id));
    }

    public PageResponse<RiderInsuranceReadResponse> listRiderInsurances(Pageable pageable) {
        return PageResponse.of(riderInsuranceRepository.findByDeletedAtIsNull(pageable).map(RiderInsuranceReadResponse::from));
    }

    public RiderInsuranceReadResponse getRiderInsurance(UUID id) {
        return riderInsuranceRepository.findByIdAndDeletedAtIsNull(id)
                .map(RiderInsuranceReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("RiderInsurance", id));
    }
}
