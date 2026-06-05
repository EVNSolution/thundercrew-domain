package com.thundercrew.opsapi.testmatching.vehicle.service;

import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.repository.TestVehicleRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestVehicleReadService {

    private final TestVehicleRepository repository;

    public TestVehicleReadService(TestVehicleRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TestVehicleReadResponse> listAll() {
        return repository.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestVehicleReadResponse::from).toList();
    }
}
