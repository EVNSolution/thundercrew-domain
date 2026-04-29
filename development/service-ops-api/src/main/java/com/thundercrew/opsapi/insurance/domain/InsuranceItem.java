package com.thundercrew.opsapi.insurance.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "insurance_items")
public class InsuranceItem extends DisplaySequencedEntity {

    @Column(nullable = false, length = 100)
    private String name;

    private String description;

    @Column(nullable = false)
    private boolean enabled = true;

    protected InsuranceItem() {
    }
}
