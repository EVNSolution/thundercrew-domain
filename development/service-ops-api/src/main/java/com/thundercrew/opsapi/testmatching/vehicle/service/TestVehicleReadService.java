package com.thundercrew.opsapi.testmatching.vehicle.service;

import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.repository.TestVehicleRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestVehicleReadService {

    private final TestVehicleRepository repo;

    public TestVehicleReadService(TestVehicleRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public List<TestVehicleReadResponse> listAll() {
        return repo.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestVehicleReadResponse::from).toList();
    }
}
