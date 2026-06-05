package com.thundercrew.opsapi.testmatching.excel;

import java.io.IOException;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/export")
public class TestMatchingExcelController {

    private final TestMatchingExcelService service;

    public TestMatchingExcelController(TestMatchingExcelService service) {
        this.service = service;
    }

    @GetMapping("/vehicles")
    ResponseEntity<byte[]> exportVehicles() throws IOException {
        return excelResponse(service.exportVehicles(), "test_vehicles.xlsx");
    }

    @GetMapping("/riders")
    ResponseEntity<byte[]> exportRiders() throws IOException {
        return excelResponse(service.exportRiders(), "test_riders.xlsx");
    }

    @GetMapping("/matchings")
    ResponseEntity<byte[]> exportMatchings() throws IOException {
        return excelResponse(service.exportMatchings(), "test_matchings.xlsx");
    }

    private ResponseEntity<byte[]> excelResponse(byte[] data, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(
                ContentDisposition.attachment().filename(filename).build());
        headers.setContentLength(data.length);
        return ResponseEntity.ok().headers(headers).body(data);
    }
}
