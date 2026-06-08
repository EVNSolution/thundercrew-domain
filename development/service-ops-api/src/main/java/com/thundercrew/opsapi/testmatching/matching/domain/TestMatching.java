package com.thundercrew.opsapi.testmatching.matching.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "test_matchings")
public class TestMatching extends DisplaySequencedEntity {

    @Column(name = "test_vehicle_id", nullable = false)
    private UUID testVehicleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", nullable = false, length = 30)
    private TestServiceType serviceType;

    @Column(name = "test_rider_id", nullable = false)
    private UUID testRiderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "contract_type", nullable = false, length = 20)
    private TestContractType contractType;

    @Enumerated(EnumType.STRING)
    @Column(name = "handover_type", nullable = false, length = 20)
    private TestHandoverType handoverType;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    public static TestMatching create(
            UUID testVehicleId, TestServiceType serviceType, UUID testRiderId,
            TestContractType contractType, TestHandoverType handoverType,
            LocalDate startDate, LocalDate endDate) {
        TestMatching matching = new TestMatching();
        matching.testVehicleId = testVehicleId;
        matching.serviceType = serviceType;
        matching.testRiderId = testRiderId;
        matching.contractType = contractType;
        matching.handoverType = handoverType;
        matching.startDate = startDate;
        matching.endDate = endDate;
        return matching;
    }

    public UUID getTestVehicleId() { return testVehicleId; }
    public TestServiceType getServiceType() { return serviceType; }
    public UUID getTestRiderId() { return testRiderId; }
    public TestContractType getContractType() { return contractType; }
    public TestHandoverType getHandoverType() { return handoverType; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }

    protected TestMatching() {}
}
