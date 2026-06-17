package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.rider.domain.Rider;
import com.thundercrew.opsapi.rider.dto.RiderMeResponse;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiderSelfReadService {

    private final RiderRepository riderRepository;
    private final RiderBikeContractRepository riderBikeContractRepository;

    public RiderSelfReadService(
            RiderRepository riderRepository,
            RiderBikeContractRepository riderBikeContractRepository
    ) {
        this.riderRepository = riderRepository;
        this.riderBikeContractRepository = riderBikeContractRepository;
    }

    @Transactional(readOnly = true)
    public RiderMeResponse getMe(UUID riderId) {
        Rider rider = riderRepository.findByIdAndDeletedAtIsNull(riderId)
                .orElseThrow(() -> new ResourceNotFoundException("Rider", riderId));
        UUID activeBikeId = riderBikeContractRepository.findActiveByRiderId(riderId)
                .map(RiderBikeContract::getBikeId)
                .orElse(null);
        return new RiderMeResponse(
                rider.getId(),
                rider.getName(),
                rider.getPhoneNumber(),
                rider.getTeamName(),
                rider.getAreaName(),
                activeBikeId
        );
    }
}
