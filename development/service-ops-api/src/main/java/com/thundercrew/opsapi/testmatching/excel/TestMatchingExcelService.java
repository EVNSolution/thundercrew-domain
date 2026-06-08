package com.thundercrew.opsapi.testmatching.excel;

import com.thundercrew.opsapi.testmatching.matching.domain.TestContractType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestHandoverType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestServiceType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestValidationStatus;
import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingReadResponse;
import com.thundercrew.opsapi.testmatching.matching.service.TestMatchingReadService;
import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderReadResponse;
import com.thundercrew.opsapi.testmatching.rider.service.TestRiderReadService;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestBikeType;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestEngineType;
import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.service.TestVehicleReadService;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

@Service
public class TestMatchingExcelService {

    private final TestVehicleReadService vehicleReadService;
    private final TestRiderReadService riderReadService;
    private final TestMatchingReadService matchingReadService;

    public TestMatchingExcelService(
            TestVehicleReadService vehicleReadService,
            TestRiderReadService riderReadService,
            TestMatchingReadService matchingReadService) {
        this.vehicleReadService = vehicleReadService;
        this.riderReadService = riderReadService;
        this.matchingReadService = matchingReadService;
    }

    public byte[] exportVehicles() throws IOException {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("차량 등록");
            CellStyle headerStyle = buildHeaderStyle(wb);
            String[] headers = {"차량번호", "구분 (2륜/4륜)", "엔진 (전기/내연)", "IMEI"};
            writeHeaderRow(sheet, headers, headerStyle);

            List<TestVehicleReadResponse> vehicles = vehicleReadService.listAll();
            for (int i = 0; i < vehicles.size(); i++) {
                TestVehicleReadResponse v = vehicles.get(i);
                Row row = sheet.createRow(i + 1);
                row.createCell(0).setCellValue(v.plateNumber());
                row.createCell(1).setCellValue(v.bikeType() == TestBikeType.TWO_WHEEL ? "2륜" : "4륜");
                row.createCell(2).setCellValue(v.engineType() == TestEngineType.ELECTRIC ? "전기" : "내연");
                row.createCell(3).setCellValue(v.imei() != null ? v.imei() : "");
            }
            autoSizeColumns(sheet, headers.length);
            return toBytes(wb);
        }
    }

    public byte[] exportRiders() throws IOException {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("라이더 등록");
            CellStyle headerStyle = buildHeaderStyle(wb);
            String[] headers = {"이름", "연락처", "교육이수 (완료/미완료)", "팀"};
            writeHeaderRow(sheet, headers, headerStyle);

            List<TestRiderReadResponse> riders = riderReadService.listAll();
            for (int i = 0; i < riders.size(); i++) {
                TestRiderReadResponse r = riders.get(i);
                Row row = sheet.createRow(i + 1);
                row.createCell(0).setCellValue(r.name());
                row.createCell(1).setCellValue(r.phoneNumber());
                row.createCell(2).setCellValue(r.trainingCompleted() ? "완료" : "미완료");
                row.createCell(3).setCellValue(r.teamName() != null ? r.teamName() : "");
            }
            autoSizeColumns(sheet, headers.length);
            return toBytes(wb);
        }
    }

    public byte[] exportMatchings() throws IOException {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("차량-라이더 매칭");
            CellStyle headerStyle = buildHeaderStyle(wb);
            CellStyle warnStyle = buildWarnStyle(wb);
            String[] headers = {
                "차량번호", "서비스유형", "라이더이름", "연락처",
                "계약형태", "인수방식", "시작일", "종료일", "검증결과"
            };
            writeHeaderRow(sheet, headers, headerStyle);

            List<TestMatchingReadResponse> matchings = matchingReadService.listAll();
            for (int i = 0; i < matchings.size(); i++) {
                TestMatchingReadResponse m = matchings.get(i);
                Row row = sheet.createRow(i + 1);
                boolean isInvalid = m.validationStatus() == TestValidationStatus.INVALID;

                setValue(row, 0, m.plateNumber(), isInvalid ? warnStyle : null);
                setValue(row, 1, serviceTypeLabel(m.serviceType()), isInvalid ? warnStyle : null);
                setValue(row, 2, m.riderName(), isInvalid ? warnStyle : null);
                setValue(row, 3, m.phoneNumber(), isInvalid ? warnStyle : null);
                setValue(row, 4, contractTypeLabel(m.contractType()), isInvalid ? warnStyle : null);
                setValue(row, 5, handoverTypeLabel(m.handoverType()), isInvalid ? warnStyle : null);
                setValue(row, 6, m.startDate().toString(), isInvalid ? warnStyle : null);
                setValue(row, 7, m.endDate().toString(), isInvalid ? warnStyle : null);
                setValue(row, 8, m.validationMessage(), isInvalid ? warnStyle : null);
            }
            autoSizeColumns(sheet, headers.length);
            return toBytes(wb);
        }
    }

    private void writeHeaderRow(Sheet sheet, String[] headers, CellStyle style) {
        Row row = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(style);
        }
    }

    private void setValue(Row row, int col, String value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value != null ? value : "");
        if (style != null) cell.setCellStyle(style);
    }

    private CellStyle buildHeaderStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        return style;
    }

    private CellStyle buildWarnStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setFillForegroundColor(IndexedColors.ROSE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private void autoSizeColumns(Sheet sheet, int count) {
        for (int i = 0; i < count; i++) sheet.autoSizeColumn(i);
    }

    private byte[] toBytes(Workbook wb) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        return out.toByteArray();
    }

    private String serviceTypeLabel(TestServiceType t) {
        return switch (t) {
            case CALL_DELIVERY -> "콜배송";
            case DESIGNATED_DELIVERY -> "지정배송";
            case COLLECTION_CARE -> "수거케어";
            case BATCH_COLLECTION -> "일괄수거";
        };
    }

    private String contractTypeLabel(TestContractType t) {
        return switch (t) { case SUBSCRIPTION -> "구독"; case RENTAL -> "렌탈"; };
    }

    private String handoverTypeLabel(TestHandoverType t) {
        return switch (t) { case TAKEOVER -> "인수형"; case RETURN -> "반납형"; };
    }
}
