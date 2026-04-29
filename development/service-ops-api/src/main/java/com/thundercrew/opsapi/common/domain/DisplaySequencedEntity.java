package com.thundercrew.opsapi.common.domain;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;

@MappedSuperclass
public abstract class DisplaySequencedEntity extends SoftDeletableEntity {

    @Column(nullable = false, insertable = false, updatable = false)
    private Long idx;

    public Long getIdx() {
        return idx;
    }
}
