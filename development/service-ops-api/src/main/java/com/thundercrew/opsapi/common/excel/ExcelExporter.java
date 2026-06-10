package com.thundercrew.opsapi.common.excel;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

/**
 * Utility for exporting data into a pre-existing Excel template.
 *
 * <p>Loads the named template from the classpath ({@code /templates/excel/}),
 * clears all rows at or after {@code dataStartRow}, fills in the provided
 * rows with unlocked cell styles, protects the sheet (locks header rows),
 * and returns the result as a byte array.
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
        InputStream tpl = resourceBase.getResourceAsStream("/templates/excel/" + templateName);
        if (tpl == null) {
            throw new IllegalStateException("Excel template not found on classpath: /templates/excel/" + templateName);
        }
        try (tpl; Workbook wb = WorkbookFactory.create(tpl)) {
            Sheet sheet = wb.getSheetAt(0);
            clearDataRows(sheet, dataStartRow);

            CellStyle unlocked = wb.createCellStyle();
            unlocked.setLocked(false);

            for (int i = 0; i < rows.size(); i++) {
                Row row = sheet.createRow(dataStartRow + i);
                List<String> cols = rows.get(i);
                for (int j = 0; j < cols.size(); j++) {
                    Cell cell = row.createCell(j);
                    cell.setCellValue(cols.get(j) != null ? cols.get(j) : "");
                    cell.setCellStyle(unlocked);
                }
            }
            sheet.protectSheet("");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
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
