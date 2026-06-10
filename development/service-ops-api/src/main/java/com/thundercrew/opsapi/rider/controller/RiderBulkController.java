package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.rider.service.RiderBulkService;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/riders")
public class RiderBulkController {

    private final RiderBulkService riderBulkService;

    public RiderBulkController(RiderBulkService riderBulkService) {
        this.riderBulkService = riderBulkService;
    }

    @PostMapping("/bulk-preview")
    BulkPreviewResponse bulkPreview(@RequestPart("file") MultipartFile file) throws IOException {
        return riderBulkService.preview(file.getInputStream());
    }

    @PostMapping("/bulk-apply")
    BulkApplyResponse bulkApply(@RequestPart("file") MultipartFile file) throws IOException {
        return riderBulkService.apply(file.getInputStream());
    }

    @GetMapping("/export")
    ResponseEntity<byte[]> export() throws IOException {
        byte[] bytes = riderBulkService.export();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"riders.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }
}
