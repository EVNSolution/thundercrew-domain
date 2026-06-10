package com.thundercrew.opsapi.bike.controller;

import com.thundercrew.opsapi.bike.service.BikeBulkService;
import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
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
@RequestMapping("/api/v1/bikes")
public class BikeBulkController {

    private final BikeBulkService bikeBulkService;

    public BikeBulkController(BikeBulkService bikeBulkService) {
        this.bikeBulkService = bikeBulkService;
    }

    @PostMapping("/bulk-preview")
    BulkPreviewResponse bulkPreview(@RequestPart("file") MultipartFile file) throws IOException {
        return bikeBulkService.preview(file.getInputStream());
    }

    @PostMapping("/bulk-apply")
    BulkApplyResponse bulkApply(@RequestPart("file") MultipartFile file) throws IOException {
        return bikeBulkService.apply(file.getInputStream());
    }

    @GetMapping("/export")
    ResponseEntity<byte[]> export() throws IOException {
        byte[] bytes = bikeBulkService.export();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"vehicles.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }
}
