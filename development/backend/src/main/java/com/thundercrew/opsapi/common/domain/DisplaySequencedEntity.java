package com.thundercrew.opsapi.common.domain;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;

@MappedSuperclass
public abstract class DisplaySequencedEntity extends SoftDeletableEntity {

    /**
     * 표시용 순번. DB 의 `bigserial` 이 값을 만들므로 insert/update 대상이 아니다.
     *
     * <p>그래서 저장 직후의 엔티티에는 값이 없다. 생성 API 가 그 엔티티로 응답을 만들면
     * `idx: null` 이 나가므로, 생성 경로는 `EntityManager.flush()` 후 `refresh()` 로 값을
     * 읽어와야 한다.
     *
     * <p>`@Generated(event = INSERT)` 로 매핑에서 해결하려 시도했지만 동작하지 않았다 —
     * `insertable = false` 와 맞물려 Hibernate 가 생성값을 회수하지 않는다. 조용히 아무
     * 일도 하지 않으면서 생성마다 select 를 추가할 여지만 남기므로 되돌렸다.
     */
    @Column(nullable = false, insertable = false, updatable = false)
    private Long idx;

    public Long getIdx() {
        return idx;
    }
}
