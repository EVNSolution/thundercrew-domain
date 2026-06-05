package com.thundercrew.opsapi.testmatching.rider.service;

import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderReadResponse;
import com.thundercrew.opsapi.testmatching.rider.repository.TestRiderRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestRiderReadService {

    private final TestRiderRepository repository;

    public TestRiderReadService(TestRiderRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TestRiderReadResponse> listAll() {
        return repository.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestRiderReadResponse::from).toList();
    }
}
