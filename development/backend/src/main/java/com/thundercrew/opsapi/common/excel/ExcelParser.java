package com.thundercrew.opsapi.common.excel;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

/**
 * Utility for extracting data rows from an Excel workbook uploaded by the user.
 *
 * <p>Reads the first sheet only, skipping all rows before {@code dataStartRow}.
 * Blank rows (all cells empty) are omitted from the result.
 */
public class ExcelParser {

    private ExcelParser() {}

    /**
     * Parse data rows from the given Excel stream.
     *
     * @param stream       Excel file input stream (closed by this method)
     * @param dataStartRow 0-based index of the first data row (header rows have lower indices)
     * @return list of non-blank data rows, each row as an ordered list of cell string values
     */
    public static List<List<String>> parseRows(InputStream stream, int dataStartRow) throws IOException {
        try (Workbook wb = WorkbookFactory.create(stream)) {
            Sheet sheet = wb.getSheetAt(0);
            List<List<String>> result = new ArrayList<>();
            for (int i = dataStartRow; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                List<String> cells = new ArrayList<>();
                boolean allEmpty = true;
                for (int j = 0; j < row.getLastCellNum(); j++) {
                    String val = cellString(row.getCell(j));
                    cells.add(val);
                    if (!val.isBlank()) allEmpty = false;
                }
                if (!allEmpty) result.add(cells);
            }
            return result;
        }
    }

    private static String cellString(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double d = cell.getNumericCellValue();
                yield d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default      -> "";
        };
    }
}
