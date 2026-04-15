/**
 * packingExport.js
 *
 * Produces an Excel file that is byte-for-byte equivalent to the one
 * produced by PK.HTML's "Export to Excel" button.
 *
 * Logic is copied directly from PK.HTML's FileManager.exportToExcel()
 * with zero changes to structure, columns, sheet names, ordering, or formatting.
 *
 * Input:  allBoxes — array matching PK's State.allBoxes format
 * Output: downloads a .xlsx file
 *
 * Sheet layout (per packing number):
 *   Row 0  : "Packing Number: X"  |  "Date: DD-MM-YYYY"
 *   Row 1  : (empty)
 *   Row 2  : BOX NO. | 51 | 52 | ... | 62 | TOTAL IN BOX | Type | Model | Height | Brim | Finish Brim | Order Number | Box Size
 *   Row 3+ : one data row per item-group per box (sorted by boxNumber ASC)
 *   Last   : TOTAL row
 *
 * Summary sheet:
 *   - Summary by Order and Model  (cols 0-2)
 *   - Summary by Model Type       (cols 4-6)
 *   - Summary by Box Size         (cols 8-10)
 *
 * File name: PL{firstPackingNumber}_{DD-MM-YYYY}.xlsx
 */

import * as XLSX from 'xlsx-js-style';

export function exportPackingToExcel(allBoxes) {
    if (!allBoxes || allBoxes.length === 0) {
        throw new Error('No data to export');
    }

    // ── Styles (identical to PK.HTML) ────────────────────────────────────────

    const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '4472C4' } },
        border: {
            top:    { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left:   { style: 'thin', color: { rgb: '000000' } },
            right:  { style: 'thin', color: { rgb: '000000' } },
        },
        alignment: { horizontal: 'center', vertical: 'center' },
    };

    const dataStyle = {
        border: {
            top:    { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left:   { style: 'thin', color: { rgb: '000000' } },
            right:  { style: 'thin', color: { rgb: '000000' } },
        },
        alignment: { horizontal: 'right', vertical: 'center' },
    };

    const emptyDataStyle = {
        border: {
            top:    { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left:   { style: 'thin', color: { rgb: '000000' } },
            right:  { style: 'thin', color: { rgb: '000000' } },
        },
    };

    const titleStyle = {
        font: { bold: true, color: { rgb: '000000' }, sz: 12 },
        fill: { patternType: 'solid', fgColor: { rgb: 'E2EFDA' } },
        border: {
            top:    { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left:   { style: 'thin', color: { rgb: '000000' } },
            right:  { style: 'thin', color: { rgb: '000000' } },
        },
        alignment: { horizontal: 'center', vertical: 'center' },
    };

    const subtitleStyle = {
        font: { bold: true, color: { rgb: '000000' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'D9E1F2' } },
        border: {
            top:    { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left:   { style: 'thin', color: { rgb: '000000' } },
            right:  { style: 'thin', color: { rgb: '000000' } },
        },
        alignment: { horizontal: 'center', vertical: 'center' },
    };

    const totalRowStyle = {
        font: { bold: true },
        fill: { patternType: 'solid', fgColor: { rgb: 'EEEEEE' } },
        border: {
            top:    { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left:   { style: 'thin', color: { rgb: '000000' } },
            right:  { style: 'thin', color: { rgb: '000000' } },
        },
        alignment: { horizontal: 'center', vertical: 'center' },
    };

    // ── Date format: DD-MM-YYYY (same as PK) ─────────────────────────────────
    const currentDate = new Date();
    const formattedDate = `${String(currentDate.getDate()).padStart(2, '0')}-${
        String(currentDate.getMonth() + 1).padStart(2, '0')}-${currentDate.getFullYear()}`;

    const wb = XLSX.utils.book_new();

    // ── Aggregate data for summary sheet ─────────────────────────────────────
    const summaryData   = {};
    const modelCounts   = { K: 0, F: 0, D: 0, Other: 0 };
    const boxSizeCounts = { S: 0, M: 0, L: 0 };
    let totalBoxes = 0;

    allBoxes.forEach(box => {
        boxSizeCounts[box.boxSize] = (boxSizeCounts[box.boxSize] || 0) + 1;
        totalBoxes++;

        Object.values(box.items).forEach(item => {
            const key = `${item.orderNumber}-${item.model}`;
            if (!summaryData[key]) {
                summaryData[key] = { orderNumber: item.orderNumber, model: item.model, totalQuantity: 0 };
            }
            const itemTotal = item.totalQuantity || 0;
            summaryData[key].totalQuantity += itemTotal;

            const modelType = (item.model || '').charAt(0).toUpperCase();
            if (modelType === 'K' || modelType === 'F' || modelType === 'D') {
                modelCounts[modelType] += itemTotal;
            } else {
                modelCounts.Other += itemTotal;
            }
        });
    });

    // ── Group by packingNumber ────────────────────────────────────────────────
    const groupedByPacking = {};
    allBoxes.forEach(box => {
        if (!groupedByPacking[box.packingNumber]) groupedByPacking[box.packingNumber] = [];
        groupedByPacking[box.packingNumber].push(box);
    });

    // ── One sheet per packing number ─────────────────────────────────────────
    for (const [packingNumber, boxes] of Object.entries(groupedByPacking)) {
        const sortedBoxes = [...boxes].sort((a, b) => parseInt(a.boxNumber) - parseInt(b.boxNumber));

        const headers = [
            'BOX NO.',
            '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62',
            'TOTAL IN BOX', 'Type', 'Model', 'Height', 'Brim', 'Finish Brim', 'Order Number', 'Box Size',
        ];

        const ws = XLSX.utils.aoa_to_sheet([]);
        let rowCount = 0;
        const columnCount = headers.length;

        // Row 0: packing number + date
        ws[XLSX.utils.encode_cell({ r: rowCount, c: 0 })] = { v: `Packing Number: ${packingNumber}`, s: titleStyle };
        ws[XLSX.utils.encode_cell({ r: rowCount, c: 4 })] = { v: `Date: ${formattedDate}`,           s: titleStyle };
        rowCount += 2;  // row 1 is empty

        // Row 2: headers
        headers.forEach((header, idx) => {
            ws[XLSX.utils.encode_cell({ r: rowCount, c: idx })] = { v: header, s: headerStyle };
        });
        rowCount++;

        const sizeTotals  = Array(12).fill(0);  // sizes 51-62 (12 cols)
        let packingTotal = 0;

        // Data rows
        sortedBoxes.forEach(box => {
            Object.values(box.items).forEach(item => {
                const row = rowCount++;

                ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = {
                    v: parseInt(box.boxNumber), t: 'n', s: dataStyle,
                };

                // Empty cells for all size cols first
                for (let i = 1; i <= 12; i++) {
                    ws[XLSX.utils.encode_cell({ r: row, c: i })] = { v: '', s: emptyDataStyle };
                }

                // Fill in actual sizes (51-62 = indices 0-11)
                for (const [size, quantity] of Object.entries(item.sizes || {})) {
                    const numSize = parseInt(size);
                    if (!isNaN(numSize)) {
                        const sizeIndex = numSize - 51;
                        if (sizeIndex >= 0 && sizeIndex < 12) {
                            ws[XLSX.utils.encode_cell({ r: row, c: sizeIndex + 1 })] = {
                                v: quantity, t: 'n', s: dataStyle,
                            };
                            sizeTotals[sizeIndex] += quantity;
                        }
                    }
                }

                const itemTotal = item.totalQuantity || 0;
                packingTotal += itemTotal;

                ws[XLSX.utils.encode_cell({ r: row, c: 13 })] = { v: itemTotal,                     t: 'n', s: dataStyle };
                ws[XLSX.utils.encode_cell({ r: row, c: 14 })] = { v: (item.model || '').charAt(0),         s: dataStyle };
                ws[XLSX.utils.encode_cell({ r: row, c: 15 })] = { v: item.model        || '',               s: dataStyle };
                ws[XLSX.utils.encode_cell({ r: row, c: 16 })] = { v: item.height       || '',               s: dataStyle };
                ws[XLSX.utils.encode_cell({ r: row, c: 17 })] = { v: item.brim         || '',               s: dataStyle };
                ws[XLSX.utils.encode_cell({ r: row, c: 18 })] = { v: item.finishBrim   || '',               s: dataStyle };
                ws[XLSX.utils.encode_cell({ r: row, c: 19 })] = { v: item.orderNumber  || '',               s: dataStyle };
                ws[XLSX.utils.encode_cell({ r: row, c: 20 })] = { v: box.boxSize       || '',               s: dataStyle };
            });
        });

        // Totals row
        const totalRow = rowCount++;
        ws[XLSX.utils.encode_cell({ r: totalRow, c: 0 })] = { v: 'TOTAL', s: totalRowStyle };
        for (let i = 0; i < 12; i++) {
            ws[XLSX.utils.encode_cell({ r: totalRow, c: i + 1 })] = { v: sizeTotals[i], t: 'n', s: totalRowStyle };
        }
        ws[XLSX.utils.encode_cell({ r: totalRow, c: 13 })] = { v: packingTotal, t: 'n', s: totalRowStyle };
        for (let i = 14; i <= 20; i++) {
            ws[XLSX.utils.encode_cell({ r: totalRow, c: i })] = { v: '', s: totalRowStyle };
        }

        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowCount - 1, c: columnCount - 1 } });
        ws['!cols'] = [
            { wch: 8 },  { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 },
            { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 },
            { wch: 12 }, { wch: 6 }, { wch: 8 }, { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 6 },
        ];
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
            { s: { r: 0, c: 4 }, e: { r: 0, c: 7 } },
        ];

        XLSX.utils.book_append_sheet(wb, ws, `Packing ${packingNumber}`);
    }

    // ── Summary sheet ─────────────────────────────────────────────────────────
    const summaryWs = XLSX.utils.aoa_to_sheet([]);
    let summaryRow = 0;

    summaryWs[XLSX.utils.encode_cell({ r: summaryRow, c: 0 })] = {
        v: `Summary Report    Date: ${formattedDate}`, s: titleStyle,
    };
    summaryRow += 2;

    const orderModelTitleRow = summaryRow;
    summaryWs[XLSX.utils.encode_cell({ r: orderModelTitleRow, c: 0 })] = { v: 'Summary by Order and Model', s: subtitleStyle };
    summaryRow++;

    summaryWs[XLSX.utils.encode_cell({ r: summaryRow, c: 0 })] = { v: 'Order Number', s: headerStyle };
    summaryWs[XLSX.utils.encode_cell({ r: summaryRow, c: 1 })] = { v: 'Model',        s: headerStyle };
    summaryWs[XLSX.utils.encode_cell({ r: summaryRow, c: 2 })] = { v: 'TOTAL',        s: headerStyle };
    summaryRow++;

    const sortedSummary = Object.values(summaryData).sort((a, b) => {
        if (a.orderNumber !== b.orderNumber) return a.orderNumber.localeCompare(b.orderNumber);
        return a.model.localeCompare(b.model);
    });

    const firstDataRow = summaryRow;

    sortedSummary.forEach(item => {
        summaryWs[XLSX.utils.encode_cell({ r: summaryRow, c: 0 })] = { v: item.orderNumber  || '', s: dataStyle };
        summaryWs[XLSX.utils.encode_cell({ r: summaryRow, c: 1 })] = { v: item.model        || '', s: dataStyle };
        summaryWs[XLSX.utils.encode_cell({ r: summaryRow, c: 2 })] = { v: item.totalQuantity || 0, t: 'n', s: dataStyle };
        summaryRow++;
    });

    const grandTotalRow = summaryRow;
    const grandTotal = sortedSummary.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
    summaryWs[XLSX.utils.encode_cell({ r: grandTotalRow, c: 0 })] = { v: 'TOTAL', s: totalRowStyle };
    summaryWs[XLSX.utils.encode_cell({ r: grandTotalRow, c: 1 })] = { v: '',      s: totalRowStyle };
    summaryWs[XLSX.utils.encode_cell({ r: grandTotalRow, c: 2 })] = { v: grandTotal, t: 'n', s: totalRowStyle };

    // Summary by Model Type (cols 4-6)
    summaryWs[XLSX.utils.encode_cell({ r: orderModelTitleRow,   c: 4 })] = { v: 'Summary by Model Type', s: subtitleStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow - 1, c: 4 })] = { v: 'Model Type', s: headerStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow - 1, c: 5 })] = { v: '',           s: headerStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow - 1, c: 6 })] = { v: 'TOTAL',      s: headerStyle };

    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow,     c: 4 })] = { v: 'Model K', s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow,     c: 5 })] = { v: '',         s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow,     c: 6 })] = { v: modelCounts.K || 0, t: 'n', s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 1, c: 4 })] = { v: 'Model F', s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 1, c: 5 })] = { v: '',         s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 1, c: 6 })] = { v: modelCounts.F || 0, t: 'n', s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 2, c: 4 })] = { v: 'Model D', s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 2, c: 5 })] = { v: '',         s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 2, c: 6 })] = { v: modelCounts.D || 0, t: 'n', s: dataStyle };

    let otherModelsRow = firstDataRow + 3;
    if ((modelCounts.Other || 0) > 0) {
        summaryWs[XLSX.utils.encode_cell({ r: otherModelsRow, c: 4 })] = { v: 'Other Models', s: dataStyle };
        summaryWs[XLSX.utils.encode_cell({ r: otherModelsRow, c: 5 })] = { v: '',              s: dataStyle };
        summaryWs[XLSX.utils.encode_cell({ r: otherModelsRow, c: 6 })] = { v: modelCounts.Other || 0, t: 'n', s: dataStyle };
        otherModelsRow++;
    }
    const totalModels = Object.values(modelCounts).reduce((a, b) => a + (b || 0), 0);
    summaryWs[XLSX.utils.encode_cell({ r: otherModelsRow, c: 4 })] = { v: 'Total', s: totalRowStyle };
    summaryWs[XLSX.utils.encode_cell({ r: otherModelsRow, c: 5 })] = { v: '',      s: totalRowStyle };
    summaryWs[XLSX.utils.encode_cell({ r: otherModelsRow, c: 6 })] = { v: totalModels, t: 'n', s: totalRowStyle };

    // Summary by Box Size (cols 8-10)
    summaryWs[XLSX.utils.encode_cell({ r: orderModelTitleRow,   c: 8  })] = { v: 'Summary by Box Size', s: subtitleStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow - 1, c: 8  })] = { v: 'Box Size', s: headerStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow - 1, c: 9  })] = { v: '',         s: headerStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow - 1, c: 10 })] = { v: 'TOTAL',    s: headerStyle };

    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow,     c: 8  })] = { v: 'Box Size S', s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow,     c: 9  })] = { v: '',            s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow,     c: 10 })] = { v: boxSizeCounts.S || 0, t: 'n', s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 1, c: 8  })] = { v: 'Box Size M', s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 1, c: 9  })] = { v: '',            s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 1, c: 10 })] = { v: boxSizeCounts.M || 0, t: 'n', s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 2, c: 8  })] = { v: 'Box Size L', s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 2, c: 9  })] = { v: '',            s: dataStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 2, c: 10 })] = { v: boxSizeCounts.L || 0, t: 'n', s: dataStyle };

    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 3, c: 8  })] = { v: 'Total Boxes', s: totalRowStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 3, c: 9  })] = { v: '',             s: totalRowStyle };
    summaryWs[XLSX.utils.encode_cell({ r: firstDataRow + 3, c: 10 })] = { v: totalBoxes,     t: 'n', s: totalRowStyle };

    const maxRow = Math.max(grandTotalRow, otherModelsRow, firstDataRow + 3);
    summaryWs['!ref']  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: 10 } });
    summaryWs['!cols'] = [
        { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 5 },
        { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 5 },
        { wch: 20 }, { wch: 12 }, { wch: 10 },
    ];
    summaryWs['!merges'] = [
        { s: { r: 0,                c: 0 }, e: { r: 0,                c: 10 } },
        { s: { r: orderModelTitleRow, c: 0 }, e: { r: orderModelTitleRow, c: 2  } },
        { s: { r: orderModelTitleRow, c: 4 }, e: { r: orderModelTitleRow, c: 6  } },
        { s: { r: orderModelTitleRow, c: 8 }, e: { r: orderModelTitleRow, c: 10 } },
    ];

    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // ── File name: PL{firstPacking}_{DD-MM-YYYY}.xlsx (same as PK) ───────────
    const firstPackingNumber = Object.keys(groupedByPacking)[0] || '0';
    const fileName = `PL${firstPackingNumber}_${formattedDate}.xlsx`;

    XLSX.writeFile(wb, fileName);
    return fileName;
}
