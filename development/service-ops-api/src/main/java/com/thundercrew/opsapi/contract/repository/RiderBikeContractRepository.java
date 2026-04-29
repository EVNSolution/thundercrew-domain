package com.thundercrew.opsapi.contract.repository;

import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface RiderBikeContractRepository extends Repository<RiderBikeContract, UUID> {

    Page<RiderBikeContract> findByDeletedAtIsNull(Pageable pageable);

    Optional<RiderBikeContract> findByIdAndDeletedAtIsNull(UUID id);

    RiderBikeContract save(RiderBikeContract contract);

    @Query(value = "select exists (select 1 from riders where id = :riderId)", nativeQuery = true)
    boolean existsRiderById(@Param("riderId") UUID riderId);

    @Query(value = "select exists (select 1 from riders where id = :riderId and deleted_at is null)", nativeQuery = true)
    boolean existsActiveRiderById(@Param("riderId") UUID riderId);

    @Query(value = "select exists (select 1 from bikes where id = :bikeId)", nativeQuery = true)
    boolean existsBikeById(@Param("bikeId") UUID bikeId);

    @Query(value = "select exists (select 1 from bikes where id = :bikeId and deleted_at is null)", nativeQuery = true)
    boolean existsActiveBikeById(@Param("bikeId") UUID bikeId);

    @Query(value = """
            select exists (
                select 1
                from rider_bike_contracts
                where rider_id = :riderId
                  and deleted_at is null
                  and terminated_at is null
                  and start_at < :newEndAt
                  and :newStartAt < coalesce(end_at, 'infinity'::timestamptz)
            )
            """, nativeQuery = true)
    boolean existsOverlappingRiderPeriod(
            @Param("riderId") UUID riderId,
            @Param("newStartAt") Instant newStartAt,
            @Param("newEndAt") Instant newEndAt
    );

    @Query(value = """
            select exists (
                select 1
                from rider_bike_contracts
                where bike_id = :bikeId
                  and deleted_at is null
                  and terminated_at is null
                  and start_at < :newEndAt
                  and :newStartAt < coalesce(end_at, 'infinity'::timestamptz)
            )
            """, nativeQuery = true)
    boolean existsOverlappingBikePeriod(
            @Param("bikeId") UUID bikeId,
            @Param("newStartAt") Instant newStartAt,
            @Param("newEndAt") Instant newEndAt
    );
}
