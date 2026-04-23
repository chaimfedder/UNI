/**
 * exportOrderToExcel.js
 *
 * Ported 1-to-1 from OD1.js exportToExcel().
 * Preserves all cell styles, merges, borders, widths, and formatting.
 *
 * @param {object} orderData  — same shape as saved to Firestore:
 *   { header: { orderDate, orderedBy, model, orderNumber, bodyType, bodyOrder, invoiceNumber },
 *     sizes:  [ { hatName, quality, crownHeight, brim, brimFinish, ribbonHeight,
 *                 sizes: { [sz]: { quantity, highlighted } }, total } ],
 *     specs:  { leatherWidth, leatherType, leatherColor, leftImprinting,
 *               rightImprinting, frontImprinting, liningType, roofColor,
 *               wallColor, pesfoall, logo, ribbon1, ribbon2, ribbon3, comments },
 *     summary: { totalBySize: { [sz]: number }, grandTotal: number },
 *     materials: [ { materialType, weight, color, quantity, invoiceNumber, confNumber } ] }
 *
 * MATERIAL PLACEMENT RULES (strictly enforced):
 *   - Only rows 1–5 (indices 0–4), columns L–T (indices 11–19) are used for materials.
 *   - Row 1 (index 0):  headers — unchanged (BODY TYPE / BODY ORDER / Invoices).
 *   - Row 2 (index 1):  material[0] data in L2:O2, P2:R2, S2:T2.
 *   - Row 3 (index 2):  material[1] in L3:O3, P3:R3, S3  (T3 is part of TOTAL merge).
 *   - Row 4 (index 3):  material[2+] combined in L4:O4, P4:R4, S4.
 *   - Row 5 (index 4):  size numbers 56–63 — NOT modified.
 *   - When 2+ materials: G3:S4 merge is trimmed to G3:K4 to free columns L–S in rows 3–4.
 *   - No rows are shifted. All other sections (sizes, summary, specs) are unchanged.
 */
import * as XLSX from 'xlsx-js-style';

export function exportOrderToExcel(orderData) {
  const wb = XLSX.utils.book_new();

  // ── Border primitives ───────────────────────────────────────────────────────
  const thinBorder   = { style: 'thin',   color: { rgb: '000000' } };
  const mediumBorder = { style: 'medium', color: { rgb: '000000' } };

  // ── Shared styles ───────────────────────────────────────────────────────────
  const headerStyle = {
    font: { name: 'Arial', sz: 12, bold: true },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: { top: mediumBorder, bottom: mediumBorder, left: mediumBorder, right: mediumBorder },
  };

  const titleStyle = {
    font: { name: 'Arial', sz: 14, bold: true },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: { top: mediumBorder, bottom: mediumBorder, left: mediumBorder, right: mediumBorder },
  };

  const dataStyle = {
    font: { name: 'Arial', sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
  };

  const grayHeaderStyle = {
    ...headerStyle,
    fill: { patternType: 'solid', fgColor: { rgb: 'E0E0E0' } },
    border: { top: mediumBorder, bottom: mediumBorder, left: mediumBorder, right: mediumBorder },
  };

  const highlightStyle = {
    ...dataStyle,
    fill: { patternType: 'solid', fgColor: { rgb: 'FFFF00' } },
  };

  const totalRowStyle = {
    ...dataStyle,
    font: { name: 'Arial', sz: 11, bold: true },
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
  };

  // Compact style used for material cells (rows 3–4 have limited height)
  const matStyle = (leftMedium, rightMedium) => ({
    font: { name: 'Arial', sz: 8, bold: false },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top:    thinBorder,
      bottom: thinBorder,
      left:   leftMedium  ? mediumBorder : thinBorder,
      right:  rightMedium ? mediumBorder : thinBorder,
    },
  });

  // ── Build worksheet ─────────────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet([]);
  const cells = {};
  const merges = [];

  const h = orderData.header || {};
  const specs = orderData.specs || {};
  const summary = orderData.summary || { totalBySize: {}, grandTotal: 0 };

  // ── Normalise materials (max 3 rows: row2, row3, row4) ──────────────────────
  // If >3 materials, row 4 combines materials[2..N-1] with ' / ' separator.
  const rawMats = Array.isArray(orderData.materials) ? orderData.materials.filter(m => m?.materialType) : [];
  const hasMaterials = rawMats.length > 0;

  // Prepare up to 3 display slots
  let matSlots = []; // [{ materialType, confNumber, invoiceNumber }]
  if (hasMaterials) {
    if (rawMats.length <= 3) {
      matSlots = rawMats.map(m => ({
        materialType:  m.materialType  || '',
        confNumber:    m.confNumber    || '',
        invoiceNumber: m.invoiceNumber || '',
      }));
    } else {
      // Slot 0: material 0
      matSlots.push({ materialType: rawMats[0].materialType || '', confNumber: rawMats[0].confNumber || '', invoiceNumber: rawMats[0].invoiceNumber || '' });
      // Slot 1: material 1
      matSlots.push({ materialType: rawMats[1].materialType || '', confNumber: rawMats[1].confNumber || '', invoiceNumber: rawMats[1].invoiceNumber || '' });
      // Slot 2: materials 2..N combined
      matSlots.push({
        materialType:  rawMats.slice(2).map(m => m.materialType  || '').filter(Boolean).join(' / '),
        confNumber:    rawMats.slice(2).map(m => m.confNumber    || '').filter(Boolean).join(' / '),
        invoiceNumber: rawMats.slice(2).map(m => m.invoiceNumber || '').filter(Boolean).join(' / '),
      });
    }
  }

  // ── Row 1: column headers ───────────────────────────────────────────────────
  cells['A1'] = { v: 'DATE', s: headerStyle };

  merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: 2 } }); // B-C
  cells['B1'] = { v: 'ORDERED BY', s: headerStyle };
  cells['C1'] = { v: '', s: headerStyle };

  merges.push({ s: { r: 0, c: 3 }, e: { r: 0, c: 5 } }); // D-F
  cells['D1'] = { v: 'MODEL', s: headerStyle };
  cells['E1'] = { v: '', s: headerStyle };
  cells['F1'] = { v: '', s: headerStyle };

  merges.push({ s: { r: 0, c: 6 }, e: { r: 0, c: 10 } }); // G-K
  cells['G1'] = { v: 'ORDER NUMBER', s: headerStyle };
  cells['H1'] = { v: '', s: headerStyle };
  cells['I1'] = { v: '', s: headerStyle };
  cells['J1'] = { v: '', s: headerStyle };
  cells['K1'] = { v: '', s: headerStyle };

  merges.push({ s: { r: 0, c: 11 }, e: { r: 0, c: 14 } }); // L-O
  cells['L1'] = { v: 'BODY TYPE', s: headerStyle };
  cells['M1'] = { v: '', s: headerStyle };
  cells['N1'] = { v: '', s: headerStyle };
  cells['O1'] = { v: '', s: headerStyle };

  merges.push({ s: { r: 0, c: 15 }, e: { r: 0, c: 17 } }); // P-R
  cells['P1'] = { v: 'BODY ORDER', s: headerStyle };
  cells['Q1'] = { v: '', s: headerStyle };
  cells['R1'] = { v: '', s: headerStyle };

  merges.push({ s: { r: 0, c: 18 }, e: { r: 0, c: 19 } }); // S-T
  cells['S1'] = { v: 'Invoices', s: headerStyle };
  cells['T1'] = { v: '', s: headerStyle };

  // ── Row 2: data values ──────────────────────────────────────────────────────
  cells['A2'] = { v: h.orderDate || '', s: dataStyle };

  merges.push({ s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }); // B-C
  cells['B2'] = { v: h.orderedBy || '', s: headerStyle };
  cells['C2'] = { v: '', s: headerStyle };

  merges.push({ s: { r: 1, c: 3 }, e: { r: 1, c: 5 } }); // D-F
  cells['D2'] = { v: h.model || '', s: headerStyle };
  cells['E2'] = { v: '', s: headerStyle };
  cells['F2'] = { v: '', s: headerStyle };

  merges.push({ s: { r: 1, c: 6 }, e: { r: 1, c: 10 } }); // G-K
  cells['G2'] = { v: h.orderNumber || '', s: headerStyle };
  cells['H2'] = { v: '', s: headerStyle };
  cells['I2'] = { v: '', s: headerStyle };
  cells['J2'] = { v: '', s: headerStyle };
  cells['K2'] = { v: '', s: headerStyle };

  // L-O, P-R, S-T in row 2: material[0] if present, else original fields
  const slot0 = matSlots[0];
  merges.push({ s: { r: 1, c: 11 }, e: { r: 1, c: 14 } }); // L2:O2
  cells['L2'] = { v: slot0 ? slot0.materialType : (h.bodyType || ''), s: headerStyle };
  cells['M2'] = { v: '', s: headerStyle };
  cells['N2'] = { v: '', s: headerStyle };
  cells['O2'] = { v: '', s: headerStyle };

  merges.push({ s: { r: 1, c: 15 }, e: { r: 1, c: 17 } }); // P2:R2
  cells['P2'] = { v: slot0 ? slot0.confNumber : (h.bodyOrder || ''), s: headerStyle };
  cells['Q2'] = { v: '', s: headerStyle };
  cells['R2'] = { v: '', s: headerStyle };

  merges.push({ s: { r: 1, c: 18 }, e: { r: 1, c: 19 } }); // S2:T2
  cells['S2'] = { v: slot0 ? slot0.invoiceNumber : (h.invoiceNumber || ''), s: headerStyle };
  cells['T2'] = { v: '', s: headerStyle };

  // ── Rows 3-5: column headers for sizes section ──────────────────────────────
  cells['A3'] = { v: 'HAT NAME',     s: grayHeaderStyle }; cells['A4'] = { v: '', s: grayHeaderStyle }; cells['A5'] = { v: '', s: grayHeaderStyle };
  merges.push({ s: { r: 2, c: 0 }, e: { r: 4, c: 0 } });

  cells['B3'] = { v: 'QUIALITY',     s: grayHeaderStyle }; cells['B4'] = { v: '', s: grayHeaderStyle }; cells['B5'] = { v: '', s: grayHeaderStyle };
  merges.push({ s: { r: 2, c: 1 }, e: { r: 4, c: 1 } });

  cells['C3'] = { v: 'HEIGHT CROWN', s: grayHeaderStyle }; cells['C4'] = { v: '', s: grayHeaderStyle }; cells['C5'] = { v: '', s: grayHeaderStyle };
  merges.push({ s: { r: 2, c: 2 }, e: { r: 4, c: 2 } });

  cells['D3'] = { v: 'BRIM',         s: grayHeaderStyle }; cells['D4'] = { v: '', s: grayHeaderStyle }; cells['D5'] = { v: '', s: grayHeaderStyle };
  merges.push({ s: { r: 2, c: 3 }, e: { r: 4, c: 3 } });

  cells['E3'] = { v: 'BRIM FINISH',  s: grayHeaderStyle }; cells['E4'] = { v: '', s: grayHeaderStyle }; cells['E5'] = { v: '', s: grayHeaderStyle };
  merges.push({ s: { r: 2, c: 4 }, e: { r: 4, c: 4 } });

  cells['F3'] = { v: 'HEIGHT RIBON', s: grayHeaderStyle }; cells['F4'] = { v: '', s: grayHeaderStyle }; cells['F5'] = { v: '', s: grayHeaderStyle };
  merges.push({ s: { r: 2, c: 5 }, e: { r: 4, c: 5 } });

  // G3:S4 empty area — trimmed to G3:K4 when 2+ materials to free columns L–S in rows 3–4
  cells['G3'] = { v: '', s: grayHeaderStyle };
  cells['G4'] = { v: '', s: grayHeaderStyle };
  if (hasMaterials && matSlots.length >= 2) {
    // Free L-S in rows 3-4 for material data: merge only G3:K4
    merges.push({ s: { r: 2, c: 6 }, e: { r: 3, c: 10 } }); // G3:K4
  } else {
    // No change needed — original full merge
    merges.push({ s: { r: 2, c: 6 }, e: { r: 3, c: 18 } }); // G3:S4
  }

  // T3-T5 merged: TOTAL (always unchanged)
  cells['T3'] = { v: 'TOTAL', s: grayHeaderStyle }; cells['T4'] = { v: '', s: grayHeaderStyle }; cells['T5'] = { v: '', s: grayHeaderStyle };
  merges.push({ s: { r: 2, c: 19 }, e: { r: 4, c: 19 } });

  // Row 5: size numbers G-S (always unchanged)
  for (let i = 0; i < 13; i++) {
    const col = i + 6;
    const size = 51 + i;
    const cellRef = XLSX.utils.encode_cell({ r: 4, c: col });
    cells[cellRef] = {
      v: size.toString(),
      s: {
        ...grayHeaderStyle,
        border: { top: mediumBorder, bottom: mediumBorder, left: thinBorder, right: thinBorder },
      },
    };
  }

  // ── Material rows 3–4 (columns L–S only; T3:T5 is TOTAL merge) ─────────────
  // Row 3 (index 2): material[1]
  // Row 4 (index 3): material[2] (combined if >3 total)
  // Available columns: L(11)–O(14) for materialType, P(15)–R(17) for confNumber, S(18) alone for invoiceNumber
  // T(19) is part of T3:T5 TOTAL merge — must not be written.

  if (hasMaterials && matSlots.length >= 2) {
    const slot1 = matSlots[1];
    // Row 3: L3:O3
    merges.push({ s: { r: 2, c: 11 }, e: { r: 2, c: 14 } });
    cells['L3'] = { v: slot1.materialType,  s: matStyle(true,  false) };
    cells['M3'] = { v: '', s: matStyle(false, false) };
    cells['N3'] = { v: '', s: matStyle(false, false) };
    cells['O3'] = { v: '', s: matStyle(false, false) };
    // P3:R3
    merges.push({ s: { r: 2, c: 15 }, e: { r: 2, c: 17 } });
    cells['P3'] = { v: slot1.confNumber,    s: matStyle(false, false) };
    cells['Q3'] = { v: '', s: matStyle(false, false) };
    cells['R3'] = { v: '', s: matStyle(false, false) };
    // S3 (single cell — T3 is TOTAL merge, cannot write there)
    cells['S3'] = { v: slot1.invoiceNumber, s: matStyle(false, true) };
  }

  if (hasMaterials && matSlots.length >= 3) {
    const slot2 = matSlots[2];
    // Row 4: L4:O4
    merges.push({ s: { r: 3, c: 11 }, e: { r: 3, c: 14 } });
    cells['L4'] = { v: slot2.materialType,  s: matStyle(true,  false) };
    cells['M4'] = { v: '', s: matStyle(false, false) };
    cells['N4'] = { v: '', s: matStyle(false, false) };
    cells['O4'] = { v: '', s: matStyle(false, false) };
    // P4:R4
    merges.push({ s: { r: 3, c: 15 }, e: { r: 3, c: 17 } });
    cells['P4'] = { v: slot2.confNumber,    s: matStyle(false, false) };
    cells['Q4'] = { v: '', s: matStyle(false, false) };
    cells['R4'] = { v: '', s: matStyle(false, false) };
    // S4 (single cell)
    cells['S4'] = { v: slot2.invoiceNumber, s: matStyle(false, true) };
  }

  // ── Data rows ───────────────────────────────────────────────────────────────
  let currentRow = 5; // row index 5 = Excel row 6

  (orderData.sizes || []).forEach(row => {
    const ribbonH = row.ribbonHeight || row.ribonHeight || '';

    cells[`A${currentRow + 1}`] = {
      v: row.hatName || '',
      s: { ...dataStyle, border: { top: thinBorder, bottom: thinBorder, left: mediumBorder, right: thinBorder } },
    };
    cells[`B${currentRow + 1}`] = { v: row.quality    || '', s: dataStyle };
    cells[`C${currentRow + 1}`] = { v: row.crownHeight|| '', s: dataStyle };
    cells[`D${currentRow + 1}`] = { v: row.brim       || '', s: dataStyle };
    cells[`E${currentRow + 1}`] = { v: row.brimFinish || '', s: dataStyle };
    cells[`F${currentRow + 1}`] = { v: ribbonH,              s: dataStyle };

    for (let i = 0; i < 13; i++) {
      const col  = i + 6;
      const size = 51 + i;
      const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
      const sizeData = (row.sizes || {})[size] || {};
      const quantity    = sizeData.quantity    || '';
      const isHighlighted = sizeData.highlighted;

      let cellStyle = dataStyle;
      if (isHighlighted) {
        cellStyle = highlightStyle;
      } else if (size >= 54 && size <= 60 && quantity) {
        cellStyle = {
          ...dataStyle,
          border: {
            top:    { style: 'thin', color: { rgb: 'FF0000' } },
            bottom: { style: 'thin', color: { rgb: 'FF0000' } },
            left:   { style: 'thin', color: { rgb: 'FF0000' } },
            right:  { style: 'thin', color: { rgb: 'FF0000' } },
          },
        };
      }
      cells[cellRef] = { v: quantity, s: cellStyle };
    }

    cells[`T${currentRow + 1}`] = {
      v: row.total || 0,
      s: { ...totalRowStyle, border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: mediumBorder } },
    };

    currentRow++;
  });

  // Pad to at least 12 rows (7 data rows minimum)
  while (currentRow < 12) {
    cells[XLSX.utils.encode_cell({ r: currentRow, c: 0 })] = {
      v: '',
      s: { ...dataStyle, border: { top: thinBorder, bottom: thinBorder, left: mediumBorder, right: thinBorder } },
    };
    for (let col = 1; col <= 18; col++) {
      cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = { v: '', s: dataStyle };
    }
    cells[XLSX.utils.encode_cell({ r: currentRow, c: 19 })] = {
      v: '',
      s: { ...dataStyle, border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: mediumBorder } },
    };
    currentRow++;
  }

  // ── Summary row ─────────────────────────────────────────────────────────────
  cells[XLSX.utils.encode_cell({ r: currentRow, c: 0 })] = {
    v: '',
    s: { ...totalRowStyle, border: { top: thinBorder, bottom: mediumBorder, left: mediumBorder, right: thinBorder } },
  };
  for (let col = 1; col <= 5; col++) {
    cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = {
      v: '',
      s: { ...totalRowStyle, border: { top: thinBorder, bottom: mediumBorder, left: thinBorder, right: thinBorder } },
    };
  }
  for (let i = 0; i < 13; i++) {
    const col  = i + 6;
    const size = 51 + i;
    cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = {
      v: summary.totalBySize?.[size] || 0,
      s: { ...totalRowStyle, border: { top: thinBorder, bottom: mediumBorder, left: thinBorder, right: thinBorder } },
    };
  }
  cells[XLSX.utils.encode_cell({ r: currentRow, c: 19 })] = {
    v: summary.grandTotal || 0,
    s: { ...totalRowStyle, border: { top: thinBorder, bottom: mediumBorder, left: thinBorder, right: mediumBorder } },
  };

  // ── Technical spec section ──────────────────────────────────────────────────

  // Section header row
  cells[`A${currentRow + 1}`] = {
    v: 'LEATHER DETAILS',
    s: { ...titleStyle, fill: { patternType: 'solid', fgColor: { rgb: 'E0E0E0' } },
         border: { top: mediumBorder, bottom: thinBorder, left: mediumBorder, right: thinBorder } },
  };
  merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } });

  cells[`F${currentRow + 1}`] = {
    v: 'LINING DETAILS',
    s: { ...titleStyle, fill: { patternType: 'solid', fgColor: { rgb: 'E0E0E0' } },
         border: { top: mediumBorder, bottom: thinBorder, left: thinBorder, right: thinBorder } },
  };
  merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 12 } });

  cells[`N${currentRow + 1}`] = {
    v: 'RIBBON DETAILS',
    s: { ...titleStyle, fill: { patternType: 'solid', fgColor: { rgb: 'E0E0E0' } },
         border: { top: mediumBorder, bottom: thinBorder, left: thinBorder, right: mediumBorder } },
  };
  merges.push({ s: { r: currentRow, c: 13 }, e: { r: currentRow, c: 19 } });
  currentRow++;

  // Helper to write a spec row
  function specRow(labelA, valueB, labelF, valueI, labelN, valueQ, opts = {}) {
    const bottomA    = opts.lastRow ? mediumBorder : thinBorder;
    const bottomRest = opts.lastRow ? mediumBorder : thinBorder;

    cells[XLSX.utils.encode_cell({ r: currentRow, c: 0 })] = {
      v: labelA,
      s: { ...dataStyle, font: { ...dataStyle.font, bold: true },
           border: { top: thinBorder, bottom: bottomA, left: mediumBorder, right: thinBorder } },
    };
    for (let col = 1; col <= 4; col++) {
      cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = {
        v: col === 1 ? (valueB || '') : '',
        s: { ...dataStyle, border: { top: thinBorder, bottom: bottomRest, left: thinBorder, right: thinBorder } },
      };
    }
    merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow, c: 4 } });

    if (labelF !== null) {
      for (let col = 5; col <= 7; col++) {
        cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = {
          v: col === 5 ? labelF : '',
          s: { ...dataStyle, font: { ...dataStyle.font, bold: col === 5 },
               border: { top: thinBorder, bottom: bottomRest, left: thinBorder, right: thinBorder } },
        };
      }
      for (let col = 8; col <= 12; col++) {
        cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = {
          v: col === 8 ? (valueI || '') : '',
          s: { ...dataStyle, border: { top: thinBorder, bottom: bottomRest, left: thinBorder, right: thinBorder } },
        };
      }
      merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 7 } });
      merges.push({ s: { r: currentRow, c: 8 }, e: { r: currentRow, c: 12 } });
    }

    if (labelN !== null) {
      for (let col = 13; col <= 15; col++) {
        cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = {
          v: col === 13 ? labelN : '',
          s: { ...dataStyle, font: { ...dataStyle.font, bold: col === 13 },
               border: { top: thinBorder, bottom: bottomRest, left: thinBorder, right: thinBorder } },
        };
      }
      for (let col = 16; col <= 19; col++) {
        cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = {
          v: col === 16 ? (valueQ || '') : '',
          s: { ...dataStyle,
               border: { top: thinBorder, bottom: bottomRest, left: thinBorder,
                         right: col === 19 ? mediumBorder : thinBorder } },
        };
      }
      merges.push({ s: { r: currentRow, c: 13 }, e: { r: currentRow, c: 15 } });
      merges.push({ s: { r: currentRow, c: 16 }, e: { r: currentRow, c: 19 } });
    }

    currentRow++;
  }

  specRow('LEATHER WIDTH', specs.leatherWidth, 'LINING TYPE', specs.liningType,  'RIBBON TYPE 1', specs.ribbon1);
  specRow('LEATHER TYPE',  specs.leatherType,  'ROOF COLOR',  specs.roofColor,  'RIBBON TYPE 2', specs.ribbon2);
  specRow('LEATHER COLOR', specs.leatherColor, 'WALL COLOR',  specs.wallColor,  'RIBBON TYPE 3', specs.ribbon3);
  specRow('LEFT IMPRINTING', specs.leftImprinting, 'PESFOALL', specs.pesfoall, 'SPECIAL COMMENTS', specs.comments);
  specRow('RIGHT IMPRINTING', specs.rightImprinting, 'LOGO', specs.logo, null, null);

  // Last row: FRONT IMPRINTING
  cells[XLSX.utils.encode_cell({ r: currentRow, c: 0 })] = {
    v: 'FRONT IMPRINTING',
    s: { ...dataStyle, font: { ...dataStyle.font, bold: true },
         border: { top: thinBorder, bottom: mediumBorder, left: mediumBorder, right: thinBorder } },
  };
  for (let col = 1; col <= 4; col++) {
    cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = {
      v: col === 1 ? (specs.frontImprinting || '') : '',
      s: { ...dataStyle, border: { top: thinBorder, bottom: mediumBorder, left: thinBorder, right: thinBorder } },
    };
  }
  merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow, c: 4 } });

  for (let col = 5; col <= 5; col++) {
    cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = {
      v: '',
      s: { ...dataStyle, border: { top: thinBorder, bottom: mediumBorder, left: thinBorder, right: thinBorder } },
    };
  }
  for (let col = 6; col <= 12; col++) {
    cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = {
      v: '',
      s: { ...dataStyle, border: { top: thinBorder, bottom: mediumBorder, left: thinBorder, right: thinBorder } },
    };
  }
  merges.push({ s: { r: currentRow, c: 6 }, e: { r: currentRow, c: 12 } });

  cells[XLSX.utils.encode_cell({ r: currentRow, c: 13 })] = {
    v: '',
    s: { ...dataStyle, border: { top: thinBorder, bottom: mediumBorder, left: thinBorder, right: thinBorder } },
  };
  for (let col = 14; col <= 19; col++) {
    cells[XLSX.utils.encode_cell({ r: currentRow, c: col })] = {
      v: '',
      s: { ...dataStyle,
           border: { top: thinBorder, bottom: mediumBorder, left: thinBorder,
                     right: col === 19 ? mediumBorder : thinBorder } },
    };
  }

  // ── Assemble worksheet ──────────────────────────────────────────────────────
  const range = { s: { r: 0, c: 0 }, e: { r: currentRow, c: 19 } };
  ws['!ref'] = XLSX.utils.encode_range(range);
  Object.keys(cells).forEach(ref => { ws[ref] = cells[ref]; });
  ws['!merges'] = merges;

  ws['!cols'] = [
    { width: 20 }, // A - HAT NAME
    { width: 10 }, // B - QUALITY
    { width: 15 }, // C - HEIGHT CROWN
    { width: 8  }, // D - BRIM
    { width: 12 }, // E - BRIM FINISH
    { width: 12 }, // F - HEIGHT RIBON
    { width: 6  }, // G - 51
    { width: 6  }, // H - 52
    { width: 6  }, // I - 53
    { width: 6  }, // J - 54
    { width: 6  }, // K - 55
    { width: 6  }, // L - 56 / BODY TYPE
    { width: 6  }, // M - 57
    { width: 6  }, // N - 58
    { width: 6  }, // O - 59
    { width: 6  }, // P - 60 / BODY ORDER
    { width: 6  }, // Q - 61
    { width: 6  }, // R - 62
    { width: 6  }, // S - 63 / Invoices
    { width: 10 }, // T - TOTAL
  ];

  ws['!rows'] = Array(currentRow + 1).fill({ hpt: 15 });
  ws['!rows'][1] = { hpt: 30 };

  XLSX.utils.book_append_sheet(wb, ws, 'Order');

  const fileName = `Order_${h.orderNumber || 'unknown'}_${h.model || 'unknown'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Fetches the original uploaded Excel, writes material data into rows 1-5 cols L-T,
 * and downloads the modified file. Falls back to exportOrderToExcel on any error.
 */
export async function exportToOriginalExcel(orderData, fileUrl) {
  const h = orderData.header || {};

  // Normalise materials — same logic as exportOrderToExcel
  const rawMats = Array.isArray(orderData.materials)
    ? orderData.materials.filter(m => m?.materialType)
    : [];
  const hasMaterials = rawMats.length > 0;

  let matSlots = [];
  if (hasMaterials) {
    if (rawMats.length <= 3) {
      matSlots = rawMats.map(m => ({
        materialType:  m.materialType  || '',
        confNumber:    m.confNumber    || '',
        invoiceNumber: m.invoiceNumber || '',
      }));
    } else {
      matSlots.push({ materialType: rawMats[0].materialType || '', confNumber: rawMats[0].confNumber || '', invoiceNumber: rawMats[0].invoiceNumber || '' });
      matSlots.push({ materialType: rawMats[1].materialType || '', confNumber: rawMats[1].confNumber || '', invoiceNumber: rawMats[1].invoiceNumber || '' });
      matSlots.push({
        materialType:  rawMats.slice(2).map(m => m.materialType  || '').filter(Boolean).join(' / '),
        confNumber:    rawMats.slice(2).map(m => m.confNumber    || '').filter(Boolean).join(' / '),
        invoiceNumber: rawMats.slice(2).map(m => m.invoiceNumber || '').filter(Boolean).join(' / '),
      });
    }
  }

  // Fetch original file from Firebase Storage
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();

  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Set cell value, preserving existing style
  function setCell(row, col, value) {
    const ref = XLSX.utils.encode_cell({ r: row, c: col });
    ws[ref] = { ...(ws[ref] || {}), v: value, t: 's' };
  }

  // Remove a merge that exactly matches the given range
  function removeMerge(r1, c1, r2, c2) {
    if (!ws['!merges']) return;
    ws['!merges'] = ws['!merges'].filter(
      m => !(m.s.r === r1 && m.s.c === c1 && m.e.r === r2 && m.e.c === c2)
    );
  }

  // Remove any merge that overlaps columns 11-18 (L-S) in rows 2-3 (3-4 in Excel)
  function removeMergesInMaterialArea() {
    if (!ws['!merges']) return;
    ws['!merges'] = ws['!merges'].filter(m => {
      const overlapsRows = m.s.r <= 3 && m.e.r >= 2;
      const overlapsCols = m.s.c <= 18 && m.e.c >= 11;
      return !(overlapsRows && overlapsCols);
    });
  }

  function addMerge(r1, c1, r2, c2) {
    if (!ws['!merges']) ws['!merges'] = [];
    const exists = ws['!merges'].some(
      m => m.s.r === r1 && m.s.c === c1 && m.e.r === r2 && m.e.c === c2
    );
    if (!exists) ws['!merges'].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
  }

  // ── Row 2 (index 1): slot0 replaces bodyType / bodyOrder / invoiceNumber ─────
  const slot0 = matSlots[0];
  const v_L2 = slot0 ? slot0.materialType  : (h.bodyType      || '');
  const v_P2 = slot0 ? slot0.confNumber    : (h.bodyOrder     || '');
  const v_S2 = slot0 ? slot0.invoiceNumber : (h.invoiceNumber || '');

  setCell(1, 11, v_L2); setCell(1, 12, ''); setCell(1, 13, ''); setCell(1, 14, ''); // L2:O2
  setCell(1, 15, v_P2); setCell(1, 16, ''); setCell(1, 17, '');                     // P2:R2
  setCell(1, 18, v_S2); setCell(1, 19, '');                                          // S2:T2

  // Ensure row-2 merges exist (original file already has them, but just in case)
  removeMerge(1, 11, 1, 14); addMerge(1, 11, 1, 14); // L2:O2
  removeMerge(1, 15, 1, 17); addMerge(1, 15, 1, 17); // P2:R2
  removeMerge(1, 18, 1, 19); addMerge(1, 18, 1, 19); // S2:T2

  // ── Rows 3-4 (indices 2-3): slot1 and slot2 ──────────────────────────────────
  if (hasMaterials && matSlots.length >= 2) {
    // Remove any merge that covers cols L-S in rows 3-4 (e.g. the big G3:S4 merge)
    removeMergesInMaterialArea();
    // Re-add the trimmed G3:K4 merge (frees L-S for material data)
    addMerge(2, 6, 3, 10); // G3:K4

    const slot1 = matSlots[1];
    setCell(2, 11, slot1.materialType);  setCell(2, 12, ''); setCell(2, 13, ''); setCell(2, 14, ''); // L3:O3
    setCell(2, 15, slot1.confNumber);    setCell(2, 16, ''); setCell(2, 17, '');                      // P3:R3
    setCell(2, 18, slot1.invoiceNumber);                                                               // S3
    addMerge(2, 11, 2, 14); // L3:O3
    addMerge(2, 15, 2, 17); // P3:R3
  }

  if (hasMaterials && matSlots.length >= 3) {
    const slot2 = matSlots[2];
    setCell(3, 11, slot2.materialType);  setCell(3, 12, ''); setCell(3, 13, ''); setCell(3, 14, ''); // L4:O4
    setCell(3, 15, slot2.confNumber);    setCell(3, 16, ''); setCell(3, 17, '');                      // P4:R4
    setCell(3, 18, slot2.invoiceNumber);                                                               // S4
    addMerge(3, 11, 3, 14); // L4:O4
    addMerge(3, 15, 3, 17); // P4:R4
  }

  const fileName = `Order_${h.orderNumber || 'unknown'}_${h.model || 'unknown'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
