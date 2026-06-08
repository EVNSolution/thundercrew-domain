package com.thundercrew.opsapi.testmatching.excel;

import com.thundercrew.opsapi.testmatching.matching.domain.TestContractType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestHandoverType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestServiceType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestValidationStatus;
import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingReadResponse;
import com.thundercrew.opsapi.testmatching.matching.service.TestMatchingReadService;
import com.thundercrew.opsapi.testmatching.rider.domain.TestTrainingStatus;
import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderReadResponse;
import com.thundercrew.opsapi.testmatching.rider.service.TestRiderReadService;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestBikeType;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestEngineType;
import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.service.TestVehicleReadService;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;

@Service
public class TestMatchingExcelService {

    // 0-indexed row where real data begins (after header rows in each template)
    private static final int VEHICLES_DATA_START_ROW = 2;  // row 3 in Excel
    private static final int RIDERS_DATA_START_ROW = 2;    // row 3 in Excel
    private static final int MATCHINGS_DATA_START_ROW = 3; // row 4 in Excel

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
        try (InputStream tpl = template("vehicles-template.xlsx");
                Workbook wb = WorkbookFactory.create(tpl)) {
            Sheet sheet = wb.getSheetAt(0);
            clearDataRows(sheet, VEHICLES_DATA_START_ROW);
            CellStyle unlocked = buildUnlockedStyle(wb);

            List<TestVehicleReadResponse> vehicles = vehicleReadService.listAll();
            for (int i = 0; i < vehicles.size(); i++) {
                TestVehicleReadResponse v = vehicles.get(i);
                Row row = sheet.createRow(VEHICLES_DATA_START_ROW + i);
                setValue(row, 0, v.plateNumber(), unlocked);
                setValue(row, 1, v.bikeType() == TestBikeType.TWO_WHEEL ? "2륜" : "4륜", unlocked);
                setValue(row, 2, v.engineType() == TestEngineType.ELECTRIC ? "전기" : "내연", unlocked);
                setValue(row, 3, v.imei() != null ? v.imei() : "", unlocked);
            }
            sheet.protectSheet("");
            return toBytes(wb);
        }
    }

    public byte[] exportRiders() throws IOException {
        try (InputStream tpl = template("riders-template.xlsx");
                Workbook wb = WorkbookFactory.create(tpl)) {
            Sheet sheet = wb.getSheetAt(0);
            clearDataRows(sheet, RIDERS_DATA_START_ROW);
            CellStyle unlocked = buildUnlockedStyle(wb);

            List<TestRiderReadResponse> riders = riderReadService.listAll();
            for (int i = 0; i < riders.size(); i++) {
                TestRiderReadResponse r = riders.get(i);
                Row row = sheet.createRow(RIDERS_DATA_START_ROW + i);
                setValue(row, 0, r.name(), unlocked);
                setValue(row, 1, r.phoneNumber(), unlocked);
                setValue(row, 2, trainingLabel(r.trainingStatus()), unlocked);
                setValue(row, 3, r.teamName() != null ? r.teamName() : "", unlocked);
            }
            sheet.protectSheet("");
            return toBytes(wb);
        }
    }

    public byte[] exportMatchings() throws IOException {
        try (InputStream tpl = template("matching-template.xlsx");
                Workbook wb = WorkbookFactory.create(tpl)) {
            Sheet sheet = wb.getSheetAt(0);
            clearDataRows(sheet, MATCHINGS_DATA_START_ROW);
            CellStyle unlocked = buildUnlockedStyle(wb);
            CellStyle warn = buildWarnStyle(wb);

            List<TestMatchingReadResponse> matchings = matchingReadService.listAll();
            for (int i = 0; i < matchings.size(); i++) {
                TestMatchingReadResponse m = matchings.get(i);
                Row row = sheet.createRow(MATCHINGS_DATA_START_ROW + i);
                CellStyle style = m.validationStatus() == TestValidationStatus.INVALID ? warn : unlocked;

                setValue(row, 0, m.plateNumber(), style);
                setValue(row, 1, serviceTypeLabel(m.serviceType()), style);
                setValue(row, 2, m.riderName(), style);
                setValue(row, 3, m.phoneNumber(), style);
                setValue(row, 4, contractTypeLabel(m.contractType()), style);
                setValue(row, 5, handoverTypeLabel(m.handoverType()), style);
                setValue(row, 6, m.startDate().toString(), style);
                setValue(row, 7, m.endDate().toString(), style);
                setValue(row, 8, m.validationMessage(), style);
            }
            sheet.protectSheet("");
            return toBytes(wb);
        }
    }

    private InputStream template(String name) {
        InputStream stream = getClass().getResourceAsStream("/templates/excel/" + name);
        if (stream == null) {
            throw new IllegalStateException("Excel template not found: " + name);
        }
        return stream;
    }

    private void clearDataRows(Sheet sheet, int firstDataRowIndex) {
        for (int i = sheet.getLastRowNum(); i >= firstDataRowIndex; i--) {
            Row row = sheet.getRow(i);
            if (row != null) sheet.removeRow(row);
        }
    }

    private void setValue(Row row, int col, String value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value != null ? value : "");
        cell.setCellStyle(style);
    }

    /** Unlocked style for data cells — protection applies only to locked (header) rows. */
    private CellStyle buildUnlockedStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setLocked(false);
        return style;
    }

    /** Unlocked + rose background for INVALID matching rows. */
    private CellStyle buildWarnStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setFillForegroundColor(IndexedColors.ROSE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setLocked(false);
        return style;
    }

    private byte[] toBytes(Workbook wb) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        return out.toByteArray();
    }

    private String trainingLabel(TestTrainingStatus t) {
        return switch (t) {
            case ONLINE -> "온라인";
            case OFFLINE -> "오프라인";
            case INCOMPLETE -> "미완료";
        };
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
