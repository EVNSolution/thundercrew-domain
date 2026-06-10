package com.thundercrew.opsapi.testmatching.rider.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "test_riders")
public class TestRider extends DisplaySequencedEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 30)
    private String phoneNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TestTrainingStatus trainingStatus;

    @Column(length = 100)
    private String teamName;

    public static TestRider create(
            String name, String phoneNumber, TestTrainingStatus trainingStatus, String teamName) {
        TestRider rider = new TestRider();
        rider.name = name;
        rider.phoneNumber = phoneNumber;
        rider.trainingStatus = trainingStatus;
        rider.teamName = teamName;
        return rider;
    }

    public String getName() { return name; }
    public String getPhoneNumber() { return phoneNumber; }
    public TestTrainingStatus getTrainingStatus() { return trainingStatus; }
    public String getTeamName() { return teamName; }

    protected TestRider() {}
}
