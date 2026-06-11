package com.thundercrew.opsapi.dispatch.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * Request body for {@code POST /api/v1/dispatch-orders/bulk-apply} (JSON, not Excel).
 *
 * <p>Carries the frontend-geocoded rows derived from a prior bulk preview. Each row is validated;
 * the backend appends every row for its bike via {@code appendForBike}.
 *
 * @param rows the geocoded dispatch rows to create
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DispatchBulkApplyRequest(
        @NotEmpty @Valid List<DispatchBulkApplyRow> rows
) {}
