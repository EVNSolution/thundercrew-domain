package com.thundercrew.opsapi.bike.service;

import com.thundercrew.opsapi.bike.dto.BikeOperationStatusHistoryReadResponse;
import com.thundercrew.opsapi.bike.dto.BikeReadResponse;
import com.thundercrew.opsapi.bike.repository.BikeOperationStatusHistoryRepository;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BikeReadService {

    private final BikeRepository bikeRepository;
    private final BikeOperationStatusHistoryRepository historyRepository;

    public BikeReadService(BikeRepository bikeRepository, BikeOperationStatusHistoryRepository historyRepository) {
        this.bikeRepository = bikeRepository;
        this.historyRepository = historyRepository;
    }

    public PageResponse<BikeReadResponse> listBikes(Pageable pageable) {
        return PageResponse.of(bikeRepository.findByDeletedAtIsNull(pageable).map(BikeReadResponse::from));
    }

    public BikeReadResponse getBike(UUID id) {
        return bikeRepository.findByIdAndDeletedAtIsNull(id)
                .map(BikeReadResponse::from)
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
