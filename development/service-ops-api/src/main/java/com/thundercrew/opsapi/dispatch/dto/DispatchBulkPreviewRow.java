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
 * @param originAddress 출발지주소 (optional; null means use bike's current position)
 * @param sequence      순번 (sequential variant only); null for single-dispatch rows
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
        String originAddress,
        Integer sequence,
        BulkRowStatus status,
        String message
) {
    public static DispatchBulkPreviewRow newRow(int rowNumber, String plateNumber, UUID bikeId,
                                                String customerName, String customerPhone, String address,
                                                String originAddress) {
        return new DispatchBulkPreviewRow(rowNumber, plateNumber, bikeId,
                customerName, customerPhone, address, originAddress, null, BulkRowStatus.NEW, null);
    }

    public static DispatchBulkPreviewRow error(int rowNumber, String plateNumber, UUID bikeId,
                                               String customerName, String customerPhone, String address,
                                               String message) {
        return new DispatchBulkPreviewRow(rowNumber, plateNumber, bikeId,
                customerName, customerPhone, address, null, null, BulkRowStatus.ERROR, message);
    }

    public static DispatchBulkPreviewRow newRowSeq(int rowNumber, String plateNumber, UUID bikeId,
                                                   String customerName, String customerPhone, String address,
                                                   Integer sequence, String originAddress) {
        return new DispatchBulkPreviewRow(rowNumber, plateNumber, bikeId,
                customerName, customerPhone, address, originAddress, sequence, BulkRowStatus.NEW, null);
    }

    public static DispatchBulkPreviewRow errorSeq(int rowNumber, String plateNumber, UUID bikeId,
                                                  String customerName, String customerPhone, String address,
                                                  Integer sequence, String message) {
        return new DispatchBulkPreviewRow(rowNumber, plateNumber, bikeId,
                customerName, customerPhone, address, null, sequence, BulkRowStatus.ERROR, message);
    }
}
