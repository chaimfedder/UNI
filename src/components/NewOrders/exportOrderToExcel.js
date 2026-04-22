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
 *     summary: { totalBySize: { [sz]: number }, grandTotal: number } }
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

  // ── Build worksheet ─────────────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet([]);
  const cells = {};
  const merges = [];

  const h = orderData.header || {};
  const specs = orderData.specs || {};
  const summary = orderData.summary || { totalBySize: {}, grandTotal: 0 };

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

  merges.push({ s: { r: 1, c: 11 }, e: { r: 1, c: 14 } }); // L-O
  cells['L2'] = { v: h.bodyType || '', s: headerStyle };
  cells['M2'] = { v: '', s: headerStyle };
  cells['N2'] = { v: '', s: headerStyle };
  cells['O2'] = { v: '', s: headerStyle };

  merges.push({ s: { r: 1, c: 15 }, e: { r: 1, c: 17 } }); // P-R
  cells['P2'] = { v: h.bodyOrder || '', s: headerStyle };
  cells['Q2'] = { v: '', s: headerStyle };
  cells['R2'] = { v: '', s: headerStyle };

  merges.push({ s: { r: 1, c: 18 }, e: { r: 1, c: 19 } }); // S-T
  cells['S2'] = { v: h.invoiceNumber || '', s: headerStyle };
  cells['T2'] = { v: '', s: headerStyle };

  // ── Rows 3-5: column headers for sizes section ──────────────────────────────
  // A-F merged 3 rows tall
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

  // G3-S4 merged (sizes label area)
  cells['G3'] = { v: '', s: grayHeaderStyle };
  cells['G4'] = { v: '', s: grayHeaderStyle };
  merges.push({ s: { r: 2, c: 6 }, e: { r: 3, c: 18 } });

  // T3-T5 merged: TOTAL
  cells['T3'] = { v: 'TOTAL', s: grayHeaderStyle }; cells['T4'] = { v: '', s: grayHeaderStyle }; cells['T5'] = { v: '', s: grayHeaderStyle };
  merges.push({ s: { r: 2, c: 19 }, e: { r: 4, c: 19 } });

  // Row 5: size numbers G-S
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
    const bottomA  = opts.lastRow ? mediumBorder : thinBorder;
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

  // Row: LEATHER WIDTH / LINING TYPE / RIBBON TYPE 1
  specRow('LEATHER WIDTH', specs.leatherWidth, 'LINING TYPE', specs.liningType, 'RIBBON TYPE 1', specs.ribbon1);
  // Row: LEATHER TYPE / ROOF COLOR / RIBBON TYPE 2
  specRow('LEATHER TYPE',  specs.leatherType,  'ROOF COLOR',  specs.roofColor,  'RIBBON TYPE 2', specs.ribbon2);
  // Row: LEATHER COLOR / WALL COLOR / RIBBON TYPE 3
  specRow('LEATHER COLOR', specs.leatherColor, 'WALL COLOR',  specs.wallColor,  'RIBBON TYPE 3', specs.ribbon3);
  // Row: LEFT IMPRINTING / PESFOALL / SPECIAL COMMENTS
  specRow('LEFT IMPRINTING', specs.leftImprinting, 'PESFOALL', specs.pesfoall, 'SPECIAL COMMENTS', specs.comments);
  // Row: RIGHT IMPRINTING / LOGO / empty ribbon col
  specRow('RIGHT IMPRINTING', specs.rightImprinting, 'LOGO', specs.logo, null, null);
  // Last row: FRONT IMPRINTING (bottom medium border)
  // This row has special structure — G-M merged in lining section, N-T empty
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
    { width: 6  }, // L - 56
    { width: 6  }, // M - 57
    { width: 6  }, // N - 58
    { width: 6  }, // O - 59
    { width: 6  }, // P - 60
    { width: 6  }, // Q - 61
    { width: 6  }, // R - 62
    { width: 6  }, // S - 63
    { width: 10 }, // T - TOTAL
  ];

  ws['!rows'] = Array(currentRow + 1).fill({ hpt: 15 });
  ws['!rows'][1] = { hpt: 30 };

  XLSX.utils.book_append_sheet(wb, ws, 'Order');

  const fileName = `Order_${h.orderNumber || 'unknown'}_${h.model || 'unknown'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
