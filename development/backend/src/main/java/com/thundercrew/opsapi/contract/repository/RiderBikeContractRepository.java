package com.thundercrew.opsapi.contract.repository;

import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
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
                  and start_at < :newEndAt
                  and :newStartAt < coalesce(terminated_at, end_at, 'infinity'::timestamptz)
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
                  and start_at < :newEndAt
                  and :newStartAt < coalesce(terminated_at, end_at, 'infinity'::timestamptz)
            )
            """, nativeQuery = true)
    boolean existsOverlappingBikePeriod(
            @Param("bikeId") UUID bikeId,
            @Param("newStartAt") Instant newStartAt,
            @Param("newEndAt") Instant newEndAt
    );

    @Query(value = """
            select * from rider_bike_contracts
            where bike_id = :bikeId
              and rider_id = :riderId
              and terminated_at is null
              and deleted_at is null
            """, nativeQuery = true)
    Optional<RiderBikeContract> findActiveByBikeIdAndRiderId(
            @Param("bikeId") UUID bikeId,
            @Param("riderId") UUID riderId);

    Page<RiderBikeContract> findByBikeIdAndDeletedAtIsNull(UUID bikeId, Pageable pageable);

    List<RiderBikeContract> findAllByTerminatedAtIsNullAndDeletedAtIsNull();

    List<RiderBikeContract> findAllByDeletedAtIsNullOrderByStartAtDesc();

    @Query(value = """
            select * from rider_bike_contracts
            where bike_id = :bikeId
              and terminated_at is null
              and deleted_at is null
            limit 1
            """, nativeQuery = true)
    Optional<RiderBikeContract> findActiveByBikeId(@Param("bikeId") UUID bikeId);

    @Query(value = """
            select * from rider_bike_contracts
            where rider_id = :riderId
              and terminated_at is null
              and deleted_at is null
            limit 1
            """, nativeQuery = true)
    Optional<RiderBikeContract> findActiveByRiderId(@Param("riderId") UUID riderId);

    @Query(value = """
            select distinct on (bike_id) *
            from rider_bike_contracts
            where bike_id in (:bikeIds)
              and terminated_at is null
              and deleted_at is null
            order by bike_id, start_at desc
            """, nativeQuery = true)
    List<RiderBikeContract> findActiveByBikeIdIn(@Param("bikeIds") Collection<UUID> bikeIds);
}
