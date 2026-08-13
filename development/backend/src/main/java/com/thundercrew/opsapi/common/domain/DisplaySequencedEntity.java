package com.thundercrew.opsapi.common.domain;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

@MappedSuperclass
public abstract class DisplaySequencedEntity extends SoftDeletableEntity {

    /**
     * 표시용 순번. DB 의 `bigserial` 이 값을 만들므로 insert/update 대상이 아니다.
     *
     * <p>{@code @Generated(INSERT)} 가 필요하다. 이게 없으면 Hibernate 가 insert 뒤에
     * 값을 읽어오지 않아서 **방금 저장한 엔티티의 idx 가 null 로 남는다.** 생성 API 가
     * 그 엔티티로 응답을 만들면 `idx: null` 이 나가고, 응답 계약을 지키지 못한다.
     * 실제로 Tip·AuditLog·DispatchOrder·재시동 알림 생성 응답이 그 상태였다.
     *
     * <p>전에는 `BikeCommandService` 만 `flush()` + `refresh()` 로 우회했다. 그 방식은
     * 생성 경로마다 기억해야 하고, 새 경로를 추가할 때 조용히 빠진다. 매핑에서
     * 해결하는 것이 맞다 — insert 뒤 select 한 번이 추가되지만 생성 경로에서만이다.
     */
    @Generated(event = EventType.INSERT)
    @Column(nullable = false, insertable = false, updatable = false)
    private Long idx;

    public Long getIdx() {
        return idx;
    }
}
