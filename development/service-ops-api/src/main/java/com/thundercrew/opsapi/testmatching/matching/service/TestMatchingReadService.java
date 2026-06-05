package com.thundercrew.opsapi.testmatching.matching.service;

import com.thundercrew.opsapi.testmatching.matching.domain.TestMatching;
import com.thundercrew.opsapi.testmatching.matching.domain.TestValidationStatus;
import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingReadResponse;
import com.thundercrew.opsapi.testmatching.matching.repository.TestMatchingRepository;
import com.thundercrew.opsapi.testmatching.rider.domain.TestRider;
import com.thundercrew.opsapi.testmatching.rider.repository.TestRiderRepository;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestVehicle;
import com.thundercrew.opsapi.testmatching.vehicle.repository.TestVehicleRepository;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestMatchingReadService {

    private final TestMatchingRepository matchingRepository;
    private final TestVehicleRepository vehicleRepository;
    private final TestRiderRepository riderRepository;

    public TestMatchingReadService(
            TestMatchingRepository matchingRepository,
            TestVehicleRepository vehicleRepository,
            TestRiderRepository riderRepository) {
        this.matchingRepository = matchingRepository;
        this.vehicleRepository = vehicleRepository;
        this.riderRepository = riderRepository;
    }

    @Transactional(readOnly = true)
    public List<TestMatchingReadResponse> listAll() {
        List<TestMatching> matchings = matchingRepository.findAllByDeletedAtIsNullOrderByIdxAsc();

        // Load lookup maps to avoid N+1 queries
        Map<UUID, TestVehicle> vehicleById = vehicleRepository.findAll().stream()
                .collect(Collectors.toMap(TestVehicle::getId, v -> v));
        Map<UUID, TestRider> riderById = riderRepository.findAll().stream()
                .collect(Collectors.toMap(TestRider::getId, r -> r));
        Set<UUID> activeVehicleIds = vehicleRepository.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestVehicle::getId).collect(Collectors.toSet());
        Set<UUID> activeRiderIds = riderRepository.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestRider::getId).collect(Collectors.toSet());

        // Count how many times each vehicle/rider appears in active matchings
        Map<UUID, Long> vehicleCounts = matchings.stream()
                .collect(Collectors.groupingBy(TestMatching::getTestVehicleId, Collectors.counting()));
        Map<UUID, Long> riderCounts = matchings.stream()
                .collect(Collectors.groupingBy(TestMatching::getTestRiderId, Collectors.counting()));

        return matchings.stream().map(m -> toResponse(m, vehicleById, riderById,
                activeVehicleIds, activeRiderIds, vehicleCounts, riderCounts)).toList();
    }

    /** Used by command service to return a single matching after create. */
    @Transactional(readOnly = true)
    public TestMatchingReadResponse toResponse(TestMatching matching) {
        Map<UUID, TestVehicle> vehicleById = vehicleRepository.findAll().stream()
                .collect(Collectors.toMap(TestVehicle::getId, v -> v));
        Map<UUID, TestRider> riderById = riderRepository.findAll().stream()
                .collect(Collectors.toMap(TestRider::getId, r -> r));
        Set<UUID> activeVehicleIds = vehicleRepository.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestVehicle::getId).collect(Collectors.toSet());
        Set<UUID> activeRiderIds = riderRepository.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestRider::getId).collect(Collectors.toSet());
        List<TestMatching> allMatchings = matchingRepository.findAllByDeletedAtIsNullOrderByIdxAsc();
        Map<UUID, Long> vehicleCounts = allMatchings.stream()
                .collect(Collectors.groupingBy(TestMatching::getTestVehicleId, Collectors.counting()));
        Map<UUID, Long> riderCounts = allMatchings.stream()
                .collect(Collectors.groupingBy(TestMatching::getTestRiderId, Collectors.counting()));
        return toResponse(matching, vehicleById, riderById, activeVehicleIds, activeRiderIds, vehicleCounts, riderCounts);
    }

    private TestMatchingReadResponse toResponse(
            TestMatching matching,
            Map<UUID, TestVehicle> vehicleById,
            Map<UUID, TestRider> riderById,
            Set<UUID> activeVehicleIds,
            Set<UUID> activeRiderIds,
            Map<UUID, Long> vehicleCounts,
            Map<UUID, Long> riderCounts) {

        TestVehicle vehicle = vehicleById.get(matching.getTestVehicleId());
        TestRider rider = riderById.get(matching.getTestRiderId());
        String plateNumber = vehicle != null ? vehicle.getPlateNumber() : "(삭제됨)";
        String riderName = rider != null ? rider.getName() : "(삭제됨)";
        String phoneNumber = rider != null ? rider.getPhoneNumber() : "";

        TestValidationStatus status;
        String message;
        if (!activeVehicleIds.contains(matching.getTestVehicleId())) {
            status = TestValidationStatus.INVALID;
            message = "⚠️ 차량 미등록";
        } else if (!activeRiderIds.contains(matching.getTestRiderId())) {
            status = TestValidationStatus.INVALID;
            message = "⚠️ 라이더 미등록";
        } else if (vehicleCounts.getOrDefault(matching.getTestVehicleId(), 0L) > 1) {
            status = TestValidationStatus.INVALID;
            message = "⚠️ 차량 중복";
        } else if (riderCounts.getOrDefault(matching.getTestRiderId(), 0L) > 1) {
            status = TestValidationStatus.INVALID;
            message = "⚠️ 라이더 중복";
        } else if (!matching.getStartDate().isBefore(matching.getEndDate())) {
            status = TestValidationStatus.INVALID;
            message = "⚠️ 날짜 오류";
        } else {
            status = TestValidationStatus.VALID;
            message = "✅ 정상";
        }

        return TestMatchingReadResponse.of(matching, plateNumber, riderName, phoneNumber, status, message);
    }
}
