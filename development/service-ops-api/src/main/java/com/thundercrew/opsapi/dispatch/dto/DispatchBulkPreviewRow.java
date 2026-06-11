package com.thundercrew.opsapi.dispatch.dto;

import com.thundercrew.opsapi.common.bulk.BulkRowStatus;
import java.util.UUID;

/**
 * One row of a dispatch bulk preview.
 *
 * <p>Unlike the generic {@code BulkRowResult}, this carries the parsed payload plus the resolved
 * {@code bikeId} so the frontend can geocode the address and call the JSON apply endpoint. The
 * backend deliberately does NOT geocode: there is no NCP secret here (geocoding is frontend-only,
 * matching the BSS/station flow), so coordinates are absent from the preview.
 *
 * @param rowNumber     1-based Excel row number (for user-facing messages)
 * @param plateNumber   차량번호 as typed in the sheet (may be blank on ERROR rows)
 * @param bikeId        resolved bike id; null when the plate is blank or unknown (ERROR row)
 * @param customerName  고객명
 * @param customerPhone 연락처
 * @param address       배송지주소 (frontend geocodes this before apply)
 * @param status        NEW for valid rows, ERROR for invalid ones (never UPDATE/UNCHANGED)
 * @param message       human-readable reason for ERROR rows; null otherwise
 */
public record DispatchBulkPreviewRow(
        int rowNumber,
        String plateNumber,
        UUID bikeId,
        String customerName,
        String customerPhone,
        String address,
        BulkRowStatus status,
        String message
) {
    public static DispatchBulkPreviewRow newRow(int rowNumber, String plateNumber, UUID bikeId,
                                                String customerName, String customerPhone, String address) {
        return new DispatchBulkPreviewRow(rowNumber, plateNumber, bikeId,
                customerName, customerPhone, address, BulkRowStatus.NEW, null);
    }

    public static DispatchBulkPreviewRow error(int rowNumber, String plateNumber, UUID bikeId,
                                               String customerName, String customerPhone, String address,
                                               String message) {
        return new DispatchBulkPreviewRow(rowNumber, plateNumber, bikeId,
                customerName, customerPhone, address, BulkRowStatus.ERROR, message);
    }
}
