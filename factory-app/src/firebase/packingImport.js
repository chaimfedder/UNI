/**
 * packingImport.js
 *
 * Parses an Excel file that was exported by PK.HTML (or by packingExport.js).
 * Reconstructs the allBoxes structure and writes every box to Firestore.
 *
 * Expected Excel format (identical to export format):
 *   Sheet names : "Packing 1", "Packing 2", … (Summary sheet is skipped)
 *   Row 0       : "Packing Number: X"  |  …  |  "Date: DD-MM-YYYY"
 *   Row 1       : (empty)
 *   Row 2       : BOX NO. | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60 | 61 | 62
 *                         | TOTAL IN BOX | Type | Model | Height | Brim | Finish Brim
 *                         | Order Number | Box Size
 *   Row 3+      : one data row per item-group per box
 *   Last row    : TOTAL row (skipped — value starts with "TOTAL")
 *
 * Column indices (0-based):
 *   0  → BOX NO.
 *   1–12 → sizes 51–62
 *   13 → TOTAL IN BOX
 *   14 → Type  (ignored — derived from model)
 *   15 → Model
 *   16 → Height
 *   17 → Brim
 *   18 → Finish Brim
 *   19 → Order Number
 *   20 → Box Size
 *
 * Returns: { imported: number, packingNumbers: string[] }
 */

import * as XLSX from 'xlsx';
import { batchSyncBoxesToFirebase } from './packing';

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Read a File object (from <input type="file">) and import all boxes to Firebase.
 *
 * @param {File} file — the .xlsx file chosen by the user
 * @returns {Promise<{ imported: number, packingNumbers: string[] }>}
 */
export async function importPackingFromExcel(file) {
  const data = await file.arrayBuffer();
  const wb   = XLSX.read(data, { type: 'array' });

  const allBoxes = [];

  for (const sheetName of wb.SheetNames) {
    // Only process "Packing X" sheets — skip Summary and anything else
    if (!sheetName.startsWith('Packing ')) continue;

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const boxes = _parsePackingSheet(sheetName, rows);
    allBoxes.push(...boxes);
  }

  if (allBoxes.length === 0) {
    throw new Error('No valid packing data found in the uploaded file');
  }

  await batchSyncBoxesToFirebase(allBoxes);

  const packingNumbers = [...new Set(allBoxes.map(b => b.packingNumber))];
  return { imported: allBoxes.length, packingNumbers };
}

// ── Sheet parser ──────────────────────────────────────────────────────────────

/**
 * Parse one "Packing X" worksheet.
 * Returns an array of box objects in State.allBoxes format.
 *
 * @param {string} sheetName  e.g. "Packing 3"
 * @param {Array[]}  rows     2-D array from sheet_to_json( header:1 )
 * @returns {Array}  boxes in allBoxes format
 */
function _parsePackingSheet(sheetName, rows) {
  // Extract packing number from sheet name: "Packing 3" → "3"
  const packingNumber = sheetName.replace('Packing ', '').trim();

  // Find the header row (the row that contains "BOX NO." in column 0)
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === 'BOX NO.') {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) return [];   // malformed sheet

  // ── Collect data rows ────────────────────────────────────────────────────────
  // rows after the header row are data rows until we hit an empty row or "TOTAL"
  const dataRows = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const col0 = String(row[0] ?? '').trim().toUpperCase();

    // TOTAL row → end of data
    if (col0 === 'TOTAL') break;
    // Completely empty row → skip (merge artefact)
    if (col0 === '') continue;

    dataRows.push(row);
  }

  // ── Group rows by boxNumber, building the items object ───────────────────────
  const boxMap = {}; // boxNumber → box object

  for (const row of dataRows) {
    const boxNum   = String(row[0] ?? '').trim();
    const model    = String(row[15] ?? '').trim();
    const height   = String(row[16] ?? '').trim();
    const brim     = String(row[17] ?? '').trim();
    const finishBrim = String(row[18] ?? '').trim();
    const orderNumber = String(row[19] ?? '').trim();
    const boxSize  = String(row[20] ?? '').trim();

    if (!boxNum || !model) continue; // skip malformed rows

    // Build or retrieve box entry
    if (!boxMap[boxNum]) {
      boxMap[boxNum] = {
        packingNumber,
        boxNumber: boxNum,
        boxSize:   boxSize || 'M',
        timestamp: new Date().toISOString(),
        items: {},
      };
    }
    const box = boxMap[boxNum];

    // Box size can appear on any row — keep the first non-empty value
    if (!box.boxSize && boxSize) box.boxSize = boxSize;

    // Build sizes object from columns 1–12 (sizes 51–62)
    const sizes = {};
    let totalQuantity = 0;
    for (let col = 1; col <= 12; col++) {
      const hatSize = String(50 + col);   // col 1 → "51", col 12 → "62"
      const qty = parseInt(row[col] ?? 0);
      if (!isNaN(qty) && qty > 0) {
        sizes[hatSize] = qty;
        totalQuantity += qty;
      }
    }

    // If size columns are all zero, fall back to TOTAL IN BOX column (col 13)
    if (totalQuantity === 0) {
      const total = parseInt(row[13] ?? 0);
      if (!isNaN(total) && total > 0) totalQuantity = total;
    }

    // Variant key: unique within a box (same logic as PK uses internally)
    const variantKey = `${model}_${height}_${brim}_${orderNumber}`;

    if (!box.items[variantKey]) {
      box.items[variantKey] = {
        model,
        height,
        brim,
        orderNumber,
        finishBrim,
        sizes,
        totalQuantity,
      };
    } else {
      // Duplicate variantKey in same box → merge sizes (shouldn't happen in
      // well-formed exports, but handle gracefully)
      const existing = box.items[variantKey];
      for (const [sz, qty] of Object.entries(sizes)) {
        existing.sizes[sz] = (existing.sizes[sz] || 0) + qty;
      }
      existing.totalQuantity += totalQuantity;
    }
  }

  return Object.values(boxMap);
}
