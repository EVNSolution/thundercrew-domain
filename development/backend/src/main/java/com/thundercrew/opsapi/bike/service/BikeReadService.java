package com.thundercrew.opsapi.bike.service;

import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.bike.dto.BikeOperationStatusHistoryReadResponse;
import com.thundercrew.opsapi.bike.dto.BikeReadResponse;
import com.thundercrew.opsapi.bike.repository.BikeOperationStatusHistoryRepository;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BikeReadService {

    private final BikeRepository bikeRepository;
    private final BikeOperationStatusHistoryRepository historyRepository;
    private final RiderBikeContractRepository contractRepository;

    public BikeReadService(BikeRepository bikeRepository,
                           BikeOperationStatusHistoryRepository historyRepository,
                           RiderBikeContractRepository contractRepository) {
        this.bikeRepository = bikeRepository;
        this.historyRepository = historyRepository;
        this.contractRepository = contractRepository;
    }

    /** 차량의 서비스유형 = 활성계약의 값, 없으면 OTHER. */
    private BikeServiceType serviceTypeOf(UUID bikeId) {
        return contractRepository.findActiveByBikeId(bikeId)
                .map(RiderBikeContract::getServiceType)
                .orElse(BikeServiceType.OTHER);
    }

    public PageResponse<BikeReadResponse> listBikes(Pageable pageable) {
        return PageResponse.of(bikeRepository.findByDeletedAtIsNull(pageable)
                .map(b -> BikeReadResponse.from(b, serviceTypeOf(b.getId()))));
    }

    public BikeReadResponse getBike(UUID id) {
        return bikeRepository.findByIdAndDeletedAtIsNull(id)
                .map(b -> BikeReadResponse.from(b, serviceTypeOf(b.getId())))
                .orElseThrow(() -> new ResourceNotFoundException("Bike", id));
    }

    public PageResponse<BikeOperationStatusHistoryReadResponse> listStatusHistories(Pageable pageable) {
        return PageResponse.of(historyRepository.findByDeletedAtIsNull(pageable).map(BikeOperationStatusHistoryReadResponse::from));
    }

    public BikeOperationStatusHistoryReadResponse getStatusHistory(UUID id) {
        return historyRepository.findByIdAndDeletedAtIsNull(id)
                .map(BikeOperationStatusHistoryReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("BikeOperationStatusHistory", id));
    }
}
