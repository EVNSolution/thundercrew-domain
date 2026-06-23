package com.thundercrew.opsapi.common.excel;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.ss.util.CellReference;

/**
 * Utility for exporting data into a pre-existing Excel template.
 *
 * <p>Loads the named template from the classpath ({@code /templates/excel/}),
 * clears all rows at or after {@code dataStartRow}, fills in the provided
 * data rows, and returns the result as a byte array. The sheet is left
 * unprotected so users can add rows and re-upload (the parser reads by
 * column position and ignores headers).
 */
public class ExcelExporter {

    private ExcelExporter() {}

    /**
     * Fill an Excel template with data rows and return the workbook bytes.
     *
     * @param resourceBase  class used to locate the template on the classpath
     * @param templateName  filename inside {@code /templates/excel/} (e.g. {@code "vehicles-template.xlsx"})
     * @param dataStartRow  0-based row index where data begins
     * @param rows          data rows — each inner list is one row's cell values in column order
     * @return filled workbook as a byte array
     */
    public static byte[] export(Class<?> resourceBase, String templateName,
                                int dataStartRow, List<List<String>> rows) throws IOException {
        return export(resourceBase, templateName, dataStartRow, rows, new int[0]);
    }

    /**
     * {@link #export(Class, String, int, List)} 와 동일하되, {@code textColumns} 로 지정한
     * 0-based 컬럼을 텍스트(@) 서식으로 고정한다. 전화번호처럼 선행 0이 있는 값을 사용자가
     * 입력했을 때 엑셀이 숫자로 변환해 0을 날리는 것을 막는다(빈 셀 기본 서식이 텍스트가 됨).
     */
    public static byte[] export(Class<?> resourceBase, String templateName,
                                int dataStartRow, List<List<String>> rows, int[] textColumns) throws IOException {
        return export(resourceBase, templateName, dataStartRow, rows, textColumns, new int[0]);
    }

    /**
     * {@link #export(Class, String, int, List, int[])} 에 더해, {@code phoneFormatColumns} 로 지정한
     * 0-based 컬럼에 "전화번호 형식(XXX-XXXX-XXXX, 대시 포함)" 데이터 유효성 검사를 건다. 형식이
     * 맞지 않으면 엑셀이 입력을 차단(STOP)한다. 빈 셀은 허용. (붙여넣기는 엑셀 특성상 우회 가능.)
     */
    public static byte[] export(Class<?> resourceBase, String templateName,
                                int dataStartRow, List<List<String>> rows,
                                int[] textColumns, int[] phoneFormatColumns) throws IOException {
        InputStream tpl = resourceBase.getResourceAsStream("/templates/excel/" + templateName);
        if (tpl == null) {
            throw new IllegalStateException("Excel template not found on classpath: /templates/excel/" + templateName);
        }
        try (tpl; Workbook wb = WorkbookFactory.create(tpl)) {
            Sheet sheet = wb.getSheetAt(0);
            clearDataRows(sheet, dataStartRow);

            if (textColumns != null && textColumns.length > 0) {
                CellStyle textStyle = wb.createCellStyle();
                textStyle.setDataFormat(wb.createDataFormat().getFormat("@"));
                for (int col : textColumns) {
                    sheet.setDefaultColumnStyle(col, textStyle);
                }
            }

            if (phoneFormatColumns != null && phoneFormatColumns.length > 0) {
                applyPhoneFormatValidation(sheet, dataStartRow, phoneFormatColumns);
            }

            for (int i = 0; i < rows.size(); i++) {
                Row row = sheet.createRow(dataStartRow + i);
                List<String> cols = rows.get(i);
                for (int j = 0; j < cols.size(); j++) {
                    Cell cell = row.createCell(j);
                    cell.setCellValue(cols.get(j) != null ? cols.get(j) : "");
                }
            }
            // 시트 보호(protectSheet)는 하지 않는다 — 다운로드 후 빈 행에 차량/라이더를 추가
            // 입력하는 라운드트립 용도라, 보호하면 빈 셀이 잠겨 "보호된 셀" 오류가 난다.
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    private static void applyPhoneFormatValidation(Sheet sheet, int dataStartRow, int[] phoneFormatColumns) {
        DataValidationHelper helper = sheet.getDataValidationHelper();
        int lastRow = dataStartRow + 1000;
        for (int col : phoneFormatColumns) {
            // 유효성 검사 수식은 검증 영역 좌상단 셀(첫 데이터 셀)을 기준으로 상대 평가된다.
            String anchor = CellReference.convertNumToColString(col) + (dataStartRow + 1);
            String formula = "AND(LEN(" + anchor + ")=13,"
                    + "MID(" + anchor + ",4,1)=\"-\","
                    + "MID(" + anchor + ",9,1)=\"-\","
                    + "ISNUMBER(VALUE(LEFT(" + anchor + ",3))),"
                    + "ISNUMBER(VALUE(MID(" + anchor + ",5,4))),"
                    + "ISNUMBER(VALUE(MID(" + anchor + ",10,4))))";
            DataValidationConstraint constraint = helper.createCustomConstraint(formula);
            CellRangeAddressList regions = new CellRangeAddressList(dataStartRow, lastRow, col, col);
            DataValidation validation = helper.createValidation(constraint, regions);
            validation.setEmptyCellAllowed(true);
            validation.setSuppressDropDownArrow(true);
            validation.setShowErrorBox(true);
            validation.setErrorStyle(DataValidation.ErrorStyle.STOP);
            validation.createErrorBox("전화번호 형식 오류", "010-1234-5678 형식(숫자 3-4-4, 대시 포함)으로 입력하세요.");
            sheet.addValidationData(validation);
        }
    }

    private static void clearDataRows(Sheet sheet, int firstDataRow) {
        for (int i = sheet.getLastRowNum(); i >= firstDataRow; i--) {
            Row row = sheet.getRow(i);
            if (row != null) {
                sheet.removeRow(row);
            }
        }
    }
}
