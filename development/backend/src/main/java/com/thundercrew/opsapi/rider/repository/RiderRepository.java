package com.thundercrew.opsapi.rider.repository;

import com.thundercrew.opsapi.rider.domain.Rider;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface RiderRepository extends Repository<Rider, UUID> {

    Page<Rider> findByDeletedAtIsNull(Pageable pageable);

    Optional<Rider> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsById(UUID id);

    boolean existsByPhoneNumberAndDeletedAtIsNull(String phoneNumber);

    boolean existsByPhoneNumberAndIdNotAndDeletedAtIsNull(String phoneNumber, UUID id);

    boolean existsByAppAccountIdAndDeletedAtIsNull(UUID appAccountId);

    boolean existsByAppAccountIdAndIdNotAndDeletedAtIsNull(UUID appAccountId, UUID id);

    Rider save(Rider rider);

    @Query(value = """
            select exists (
                select 1
                from rider_bike_contracts
                where rider_id = :riderId
                  and deleted_at is null
                  and terminated_at is null
            )
            """, nativeQuery = true)
    boolean existsActiveContractReference(@Param("riderId") UUID riderId);

    @Query(value = """
            select exists (
                select 1
                from rider_insurances
                where rider_id = :riderId
                  and deleted_at is null
                  and enabled = true
            )
            """, nativeQuery = true)
    boolean existsActiveInsuranceReference(@Param("riderId") UUID riderId);

    Optional<Rider> findByPhoneNumberAndDeletedAtIsNull(String phoneNumber);

    /**
     * 전화번호를 숫자만으로 정규화해 비교한다 ('-'·공백 유무 무관). 라이더 로그인/가입에서
     * 입력 전화번호와 저장값의 포맷이 달라도 매칭되도록.
     */
    @Query(value = "select * from riders where regexp_replace(phone_number, '[^0-9]', '', 'g') = :digits and deleted_at is null limit 1", nativeQuery = true)
    Optional<Rider> findActiveByNormalizedPhone(@Param("digits") String digits);

    List<Rider> findAllByDeletedAtIsNull();

    List<Rider> findAllByIdIn(Iterable<UUID> ids);
}
