package com.thundercrew.opsapi.testmatching.rider.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "test_riders")
public class TestRider extends DisplaySequencedEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 30)
    private String phoneNumber;

    @Column(nullable = false)
    private boolean trainingCompleted;

    @Column(length = 100)
    private String teamName;

    public static TestRider create(
            String name, String phoneNumber, boolean trainingCompleted, String teamName) {
        TestRider rider = new TestRider();
        rider.name = name;
        rider.phoneNumber = phoneNumber;
        rider.trainingCompleted = trainingCompleted;
        rider.teamName = teamName;
        return rider;
    }

    public String getName() { return name; }
    public String getPhoneNumber() { return phoneNumber; }
    public boolean isTrainingCompleted() { return trainingCompleted; }
    public String getTeamName() { return teamName; }

    protected TestRider() {}
}
