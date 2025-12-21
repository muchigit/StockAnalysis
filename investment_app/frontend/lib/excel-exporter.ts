
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface ExportColumn {
    key: string;
    header: string;
    width?: number;
    type?: 'string' | 'number' | 'percentage' | 'currency' | 'date';
}

export interface ExportOptions {
    fileName: string;
    sheetName: string;
    summaryData?: Record<string, string | number>;
    columns: ExportColumn[];
    data: any[];
}

export const exportToExcel = async (options: ExportOptions) => {
    const { fileName, sheetName, summaryData, columns, data } = options;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Investment App';
    workbook.created = new Date();

    // 1. Info Sheet
    const infoSheet = workbook.addWorksheet('Info');
    infoSheet.columns = [
        { header: 'Item', key: 'item', width: 20 },
        { header: 'Value', key: 'value', width: 50 },
    ];

    if (summaryData) {
        Object.entries(summaryData).forEach(([key, value]) => {
            infoSheet.addRow({ item: key, value: value });
        });
    }

    // Style Info Header
    infoSheet.getRow(1).font = { bold: true };

    // 2. Data Sheet
    const dataSheet = workbook.addWorksheet(sheetName);

    // Setup Columns
    dataSheet.columns = columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 15,
    }));

    // Add Data Rows
    data.forEach(item => {
        // Flatten or process item if needed based on key
        const rowData: Record<string, any> = {};
        columns.forEach(col => {
            let val = item[col.key];

            // Handle nested objects if key has dots? (Simple for now)
            // Or custom getters passed in data?
            // User request implies simple mapping from existing objects

            // Format Percentages for Excel value (0.05 instead of 5?)
            // If data is already 5.0 (%), leave as is or divide by 100?
            // The app uses 5.0 for 5%. Let's keep it consistent visually.
            // But Excel users might prefer 0.05 formatted as %. 
            // Current app displays "5.00%".

            rowData[col.key] = val;
        });
        const row = dataSheet.addRow(rowData);

        // --- Styling & Links ---
        columns.forEach((col, colIndex) => {
            const cell = row.getCell(colIndex + 1);
            const val = rowData[col.key];

            // Hyperlink for Symbol
            if (col.key === 'symbol' && val) {
                cell.value = {
                    text: val,
                    hyperlink: `https://www.tradingview.com/chart/?symbol=${val}`,
                    tooltip: 'Open in TradingView'
                };
                cell.font = { color: { argb: 'FF0000FF' }, underline: true }; // Blue Link
            }

            // Apply formatting based on type
            if (col.type === 'percentage' && typeof val === 'number') {
                cell.numFmt = '0.00%';
                cell.value = val / 100; // Convert 1.5 (%) to 0.015 for Excel
            } else if (col.type === 'number' && typeof val === 'number') {
                cell.numFmt = '#,##0.00';
            } else if (col.type === 'currency' && typeof val === 'number') {
                cell.numFmt = '#,##0.00'; // Or specific currency
            } else if (col.type === 'date' && val) {
                cell.numFmt = 'yyyy/mm/dd';
            }

            // Conditional Coloring for Numbers
            if (typeof val === 'number') {
                if (col.key.includes('change') || col.key.includes('return') || col.key.includes('pl') || col.key.includes('deviation') || col.key.includes('dev')) {
                    if (val > 0) {
                        cell.font = { color: { argb: 'FFFF0000' } };
                    } else if (val < 0) {
                        cell.font = { color: { argb: 'FF0000FF' } };
                    }
                }
            }
        });
    });

    // Header Styling
    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF444444' } // Dark Gray header
    };

    // AutoFilter
    dataSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length }
    };

    // Buffer & Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
};
