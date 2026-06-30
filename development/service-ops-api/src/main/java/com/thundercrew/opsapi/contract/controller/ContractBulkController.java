package com.thundercrew.opsapi.contract.controller;

import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.contract.service.ContractBulkService;
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
@RequestMapping("/api/v1/contracts")
public class ContractBulkController {

    private final ContractBulkService contractBulkService;

    public ContractBulkController(ContractBulkService contractBulkService) {
        this.contractBulkService = contractBulkService;
    }

    @PostMapping("/bulk-preview")
    BulkPreviewResponse bulkPreview(@RequestPart("file") MultipartFile file) throws IOException {
        return contractBulkService.preview(file.getInputStream());
    }

    @PostMapping("/bulk-apply")
    BulkApplyResponse bulkApply(@RequestPart("file") MultipartFile file) throws IOException {
        return contractBulkService.apply(file.getInputStream());
    }

    @GetMapping("/export")
    ResponseEntity<byte[]> export() throws IOException {
        byte[] bytes = contractBulkService.export();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"matching.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }

    @GetMapping("/log-export")
    ResponseEntity<byte[]> exportLog() throws IOException {
        byte[] bytes = contractBulkService.exportLog();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"matching-log.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }
}
