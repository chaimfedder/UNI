// חכה עד שה-DOM יטען לחלוטין
document.addEventListener('DOMContentLoaded', function() {
    // הגדרת תאריך היום כברירת מחדל
    document.getElementById('orderDate').valueAsDate = new Date();
    
    // הוסף שורה ראשונית בטבלת המידות
    addNewRow();
    
    // חיבור אירועים לכפתורים
    document.getElementById('addRowBtn').addEventListener('click', addNewRow);
    document.getElementById('clearFormBtn').addEventListener('click', clearForm);
    document.getElementById('saveTemplateBtn').addEventListener('click', saveAsTemplate);
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('orderForm').addEventListener('submit', saveOrder);
    document.getElementById('loadTemplateBtn').addEventListener('click', showLoadTemplateModal);
    document.getElementById('confirmLoadTemplate').addEventListener('click', loadSelectedTemplate);
    
    // טעינת רשימת התבניות בעת הפעלת האפליקציה
    loadTemplatesList();
});

// מספר מזהה של השורה החדשה
let rowCounter = 0;

// פונקציה להוספת שורה חדשה לטבלת המידות
function addNewRow() {
    const tableBody = document.getElementById('sizesTableBody');
    const newRow = document.createElement('tr');
    newRow.id = `row-${rowCounter}`;
    
    // שדות המידע
    let cellsHTML = `
        <td><input type="text" class="form-control form-control-sm" name="hatName" required></td>
        <td><input type="text" class="form-control form-control-sm" name="quality"></td>
        <td><input type="text" class="form-control form-control-sm" name="crownHeight"></td>
        <td><input type="text" class="form-control form-control-sm" name="brim"></td>
        <td><input type="text" class="form-control form-control-sm" name="brimFinish"></td>
        <td><input type="text" class="form-control form-control-sm" name="ribonHeight"></td>
    `;
    
    // שדות המידות (51-63)
    for (let size = 51; size <= 63; size++) {
        cellsHTML += `
            <td>
                <input type="number" min="0" class="size-input" 
                       name="size-${size}" data-size="${size}" 
                       oninput="calculateRowTotal('${rowCounter}'); calculateColumnTotals();">
            </td>
        `;
    }
    
    // שדה סיכום ופעולות
    cellsHTML += `
        <td class="row-total" id="total-row-${rowCounter}">0</td>
        <td class="action-buttons">
            <i class="fas fa-trash delete-row-btn" onclick="deleteRow('${rowCounter}')" title="מחק שורה"></i>
            <i class="fas fa-highlighter highlight-cell-btn ms-2" onclick="toggleRowHighlightMode('${rowCounter}')" title="סמן תא"></i>
        </td>
    `;
    
    newRow.innerHTML = cellsHTML;
    tableBody.appendChild(newRow);
    
    rowCounter++;
}

// פונקציה למחיקת שורה
function deleteRow(rowId) {
    if (confirm('האם אתה בטוח שברצונך למחוק את השורה הזו?')) {
        const row = document.getElementById(`row-${rowId}`);
        if (row) {
            row.remove();
            calculateColumnTotals();
        }
    }
}

// פונקציה לחישוב סה"כ בשורה
function calculateRowTotal(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;
    
    let total = 0;
    const sizeInputs = row.querySelectorAll('.size-input');
    
    sizeInputs.forEach(input => {
        const value = parseInt(input.value) || 0;
        total += value;
    });
    
    const totalCell = document.getElementById(`total-row-${rowId}`);
    if (totalCell) {
        totalCell.textContent = total;
    }
}

// פונקציה לחישוב סה"כ בעמודה (לכל מידה)
function calculateColumnTotals() {
    // איפוס כל הסיכומים
    let grandTotal = 0;
    
    // חישוב סה"כ לכל מידה
    for (let size = 51; size <= 63; size++) {
        let sizeTotal = 0;
        const sizeInputs = document.querySelectorAll(`.size-input[data-size="${size}"]`);
        
        sizeInputs.forEach(input => {
            const value = parseInt(input.value) || 0;
            sizeTotal += value;
        });
        
        // עדכון תא הסיכום של המידה
        const totalCell = document.getElementById(`total-${size}`);
        if (totalCell) {
            totalCell.textContent = sizeTotal;
            grandTotal += sizeTotal;
        }
    }
    
    // עדכון סה"כ כללי
    document.getElementById('grand-total').textContent = grandTotal;
}

// מצב סימון תאים
let highlightMode = false;
let currentHighlightRowId = null;

// הפעלת מצב סימון תאים
function toggleRowHighlightMode(rowId) {
    // אם לחצו שוב על אותה שורה שכבר במצב סימון, כבה את המצב
    if (highlightMode && currentHighlightRowId === rowId) {
        highlightMode = false;
        currentHighlightRowId = null;
        document.querySelectorAll('.highlight-cell-btn').forEach(btn => {
            btn.classList.remove('text-danger');
        });
        return;
    }
    
    // הפעל מצב סימון לשורה הנוכחית
    highlightMode = true;
    currentHighlightRowId = rowId;
    
    // סמן את כפתור ההדגשה באדום לציון מצב פעיל
    document.querySelectorAll('.highlight-cell-btn').forEach(btn => {
        btn.classList.remove('text-danger');
    });
    const highlightBtn = document.querySelector(`#row-${rowId} .highlight-cell-btn`);
    if (highlightBtn) {
        highlightBtn.classList.add('text-danger');
    }
    
    // הוסף אירועי לחיצה לתאי המידות בשורה
    const row = document.getElementById(`row-${rowId}`);
    if (row) {
        const sizeInputs = row.querySelectorAll('.size-input');
        sizeInputs.forEach(input => {
            input.addEventListener('click', function() {
                if (highlightMode && currentHighlightRowId === rowId) {
                    const parentCell = this.parentElement;
                    parentCell.classList.toggle('highlighted-cell');
                }
            });
        });
    }
}

// פונקציה לאיסוף הנתונים מהטופס
function collectFormData() {
    // נתוני הכותרת
    const headerData = {
        orderDate: document.getElementById('orderDate').value,
        orderedBy: document.getElementById('orderedBy').value,
        model: document.getElementById('model').value,
        orderNumber: document.getElementById('orderNumber').value,
        bodyType: document.getElementById('bodyType').value,
        bodyOrder: document.getElementById('bodyOrder').value,
        invoiceNumber: document.getElementById('invoiceNumber').value
    };
    
    // נתוני המידות
    const sizesData = [];
    const rows = document.querySelectorAll('#sizesTableBody tr');
    
    rows.forEach(row => {
        const rowData = {
            hatName: row.querySelector('[name="hatName"]').value,
            quality: row.querySelector('[name="quality"]').value,
            crownHeight: row.querySelector('[name="crownHeight"]').value,
            brim: row.querySelector('[name="brim"]').value,
            brimFinish: row.querySelector('[name="brimFinish"]').value,
            ribonHeight: row.querySelector('[name="ribonHeight"]').value,
            sizes: {}
        };
        
        // איסוף המידות והסימונים
        for (let size = 51; size <= 63; size++) {
            const sizeInput = row.querySelector(`[name="size-${size}"]`);
            const isHighlighted = sizeInput.parentElement.classList.contains('highlighted-cell');
            
            rowData.sizes[size] = {
                quantity: parseInt(sizeInput.value) || 0,
                highlighted: isHighlighted
            };
        }
        
        // חישוב סה"כ לשורה
        rowData.total = Object.values(rowData.sizes).reduce((sum, item) => sum + item.quantity, 0);
        
        sizesData.push(rowData);
    });
    
   // נתוני המפרט הטכני
const specData = {
    // פרטי עור
    leatherWidth: document.getElementById('leatherWidth').value,
    leatherType: document.getElementById('leatherType').value,
    leatherColor: document.getElementById('leatherColor').value,
    leftImprinting: document.getElementById('leftImprinting').value,
    rightImprinting: document.getElementById('rightImprinting').value,
    frontImprinting: document.getElementById('frontImprinting').value,
    
    // פרטי ביטנה
    liningType: document.getElementById('liningType').value,
    roofColor: document.getElementById('roofColor').value,
    wallColor: document.getElementById('wallColor').value,
    pesfoall: document.getElementById('pesfoall').value,
    logo: document.getElementById('logo').value,
    
    // פרטי סרט
    ribbon1: document.getElementById('ribbon1').value,
    ribbon2: document.getElementById('ribbon2').value,
    ribbon3: document.getElementById('ribbon3').value,
    
    // הערות
    comments: document.getElementById('comments').value
};
    
    // נתונים מסכמים
    const summaryData = {
        totalBySize: {},
        grandTotal: 0
    };
    
    // חישוב סה"כ לכל מידה
    for (let size = 51; size <= 63; size++) {
        summaryData.totalBySize[size] = parseInt(document.getElementById(`total-${size}`).textContent) || 0;
        summaryData.grandTotal += summaryData.totalBySize[size];
    }
    
    return {
        header: headerData,
        sizes: sizesData,
        specs: specData,
        summary: summaryData,
        createdAt: new Date(),
        status: 'הוזמן'
    };
}

// פונקציה לשמירת ההזמנה ב-Firebase
async function saveOrder(event) {
    event.preventDefault();
    
    try {
        // איסוף הנתונים מהטופס
        const orderData = collectFormData();
        
        // בדיקת תקינות
        if (!orderData.header.orderNumber) {
            alert('אנא הזן מספר הזמנה');
            return;
        }
        
        // בדיקה שיש לפחות פריט אחד עם כמות
        const hasItems = orderData.sizes.some(row => {
            return Object.values(row.sizes).some(size => size.quantity > 0);
        });
        
        if (!hasItems) {
            alert('אנא הזן לפחות פריט אחד עם כמות');
            return;
        }
        
        // בדיקה שאין כבר הזמנה עם אותו מספר
        const orderRef = db.collection('orders').doc(orderData.header.orderNumber);
        const doc = await orderRef.get();
        
        if (doc.exists) {
            const confirm = window.confirm('קיימת כבר הזמנה עם מספר זה. האם לדרוס?');
            if (!confirm) return;
        }
        
        // שמירת ההזמנה ב-Firestore
        await orderRef.set(orderData);
        
        alert('ההזמנה נשמרה בהצלחה!');
        
        // ניקוי הטופס
        if (window.confirm('האם לנקות את הטופס?')) {
            clearForm();
        }
    } catch (error) {
        console.error('שגיאה בשמירת ההזמנה:', error);
        alert('אירעה שגיאה בשמירת ההזמנה: ' + error.message);
    }
}

// פונקציית ייצוא לאקסל משופרת המשתמשת בספריית xlsx-js-style עם תמיכה במיזוג תאים
function exportToExcel() {
    try {
        // איסוף נתונים מהטופס
        const orderData = collectFormData();

        // יצירת חוברת עבודה חדשה
        const wb = XLSX.utils.book_new();
        
        // הגדרת סגנונות בסיסיים למסגרות
        const thinBorder = {
            style: "thin",
            color: { rgb: "000000" }
        };
        
        const mediumBorder = {
            style: "medium",
            color: { rgb: "000000" }
        };
        
        // סגנונות לתאים שונים
        const headerStyle = {
            font: { name: 'Arial', sz: 12, bold: true },
            alignment: { 
                horizontal: "center", 
                vertical: "center",
                wrapText: true
            },
            border: {
                top: mediumBorder,
                bottom: mediumBorder,
                left: mediumBorder,
                right: mediumBorder
            }
        };

        const titleStyle = {
            font: { name: 'Arial', sz: 14, bold: true },
            alignment: { 
                horizontal: "center", 
                vertical: "center",
                wrapText: true
            },
            border: {
                top: mediumBorder,
                bottom: mediumBorder,
                left: mediumBorder,
                right: mediumBorder
            }
        };
        
        const dataStyle = {
            font: { name: 'Arial', sz: 11 },
            alignment: { 
                horizontal: "center", 
                vertical: "center",
                wrapText: true
            },
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        };

        const grayHeaderStyle = {
            ...headerStyle,
            fill: { patternType: "solid", fgColor: { rgb: "E0E0E0" } },
            border: {
                top: mediumBorder,
                bottom: mediumBorder,
                left: mediumBorder,
                right: mediumBorder
            }
        };
        
        const highlightStyle = {
            ...dataStyle,
            fill: { patternType: "solid", fgColor: { rgb: "FFFF00" } }
        };
        
        const totalRowStyle = {
            ...dataStyle,
            font: { name: 'Arial', sz: 11, bold: true },
            fill: { patternType: "solid", fgColor: { rgb: "F2F2F2" } },
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        };

        // יצירת גיליון עבודה
        const ws = XLSX.utils.aoa_to_sheet([]);
        
        // מערך של תאים (אובייקט) שיקבלו ערכים וסגנונות
        const cells = {};
        
        // מיזוגי תאים
        const merges = [];

 // ----- שורה 1: כותרות -----
cells['A1'] = { v: 'DATE', s: headerStyle };

// מיזוג תאים B1 ו-C1
merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: 2 } }); // B-C

// הגדרת הסגנון של התא הממוזג B1
cells['B1'] = { 
    v: 'ORDERED BY', 
    s: headerStyle // שימוש ב-headerStyle במקום הגדרה ידנית
};

// הפעל את אותו הסגנון על C1
cells['C1'] = { 
    v: '', 
    s: cells['B1'].s // העתק את הסגנון מ-B1 ל-C1
};

// מיזוג תאים D1 עד F1
merges.push({ s: { r: 0, c: 3 }, e: { r: 0, c: 5 } }); // D-F

// הגדרת הסגנון של התא הממוזג D1
cells['D1'] = { 
    v: 'MODEL', 
    s: headerStyle // שימוש ב-headerStyle במקום הגדרה ידנית
};

// הפעל את אותו הסגנון על E1 ו-F1
cells['E1'] = { 
    v: '', 
    s: cells['D1'].s // העתק את הסגנון מ-D1 ל-E1
};
cells['F1'] = { 
    v: '', 
    s: cells['D1'].s // העתק את הסגנון מ-D1 ל-F1
};

// הגדרת הסגנון עבור G1
cells['G1'] = { 
    v: 'ORDER NUMBER', 
    s: headerStyle 
};

// העתק את הסגנון מ-G1 לתאים H1, I1, J1 ו-K1
cells['H1'] = { v: '', s: cells['G1'].s };
cells['I1'] = { v: '', s: cells['G1'].s };
cells['J1'] = { v: '', s: cells['G1'].s };
cells['K1'] = { v: '', s: cells['G1'].s };

// מיזוג תאים G1 עד K1
merges.push({ s: { r: 0, c: 6 }, e: { r: 0, c: 10 } }); // G-K

// הגדרת הסגנון עבור L1
cells['L1'] = { 
    v: 'BODY TYPE', 
    s: headerStyle 
};

// העתק את הסגנון מ-L1 לתאים M1, N1 ו-O1
cells['M1'] = { v: '', s: cells['L1'].s };
cells['N1'] = { v: '', s: cells['L1'].s };
cells['O1'] = { v: '', s: cells['L1'].s };

// מיזוג תאים L1 עד O1
merges.push({ s: { r: 0, c: 11 }, e: { r: 0, c: 14 } }); // L-O

// הגדרת הסגנון עבור P1
cells['P1'] = { 
    v: 'BODY ORDER', 
    s: headerStyle 
};

// העתק את הסגנון מ-P1 לתאים Q1 ו-R1
cells['Q1'] = { v: '', s: cells['P1'].s };
cells['R1'] = { v: '', s: cells['P1'].s };

// מיזוג תאים P1 עד R1
merges.push({ s: { r: 0, c: 15 }, e: { r: 0, c: 17 } }); // P-R

// הגדרת הסגנון עבור S1
cells['S1'] = { 
    v: 'Invoices', 
    s: headerStyle 
};

// העתק את הסגנון מ-S1 לתאים T1 ו-U1
cells['T1'] = { v: '', s: cells['S1'].s };

// מיזוג תאים S1 עד T1
merges.push({ s: { r: 0, c: 18 }, e: { r: 0, c: 19 } }); // S-U
// ----- שורה 2: נתוני כותרת -----
cells['A2'] = { v: orderData.header.orderDate, s: dataStyle };

// מיזוג תאים B2 ו-C2
merges.push({ s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }); // B-C

// הגדרת הסגנון של התא הממוזג B2
cells['B2'] = { 
    v: orderData.header.orderedBy, 
    s: headerStyle 
};

// הפעל את אותו הסגנון על C2
cells['C2'] = { 
    v: '', 
    s: cells['B2'].s // העתק את הסגנון מ-B2 ל-C2
};

// מיזוג תאים D2 עד F2
merges.push({ s: { r: 1, c: 3 }, e: { r: 1, c: 5 } }); // D-F

// הגדרת הסגנון של התא הממוזג D2
cells['D2'] = { 
    v: orderData.header.model, 
    s: headerStyle 
};

// הפעל את אותו הסגנון על E2 ו-F2
cells['E2'] = { 
    v: '', 
    s: cells['D2'].s // העתק את הסגנון מ-D2 ל-E2
};
cells['F2'] = { 
    v: '', 
    s: cells['D2'].s // העתק את הסגנון מ-D2 ל-F2
};

// הגדרת הסגנון עבור G2
cells['G2'] = { 
    v: orderData.header.orderNumber, 
    s: headerStyle 
};

// העתק את הסגנון מ-G2 לתאים H2, I2, J2 ו-K2
cells['H2'] = { v: '', s: cells['G2'].s };
cells['I2'] = { v: '', s: cells['G2'].s };
cells['J2'] = { v: '', s: cells['G2'].s };
cells['K2'] = { v: '', s: cells['G2'].s };

// מיזוג תאים G2 עד K2
merges.push({ s: { r: 1, c: 6 }, e: { r: 1, c: 10 } }); // G-K

// הגדרת הסגנון עבור L2
cells['L2'] = { 
    v: orderData.header.bodyType, 
    s: headerStyle 
};

// העתק את הסגנון מ-L2 לתאים M2, N2 ו-O2
cells['M2'] = { v: '', s: cells['L2'].s };
cells['N2'] = { v: '', s: cells['L2'].s };
cells['O2'] = { v: '', s: cells['L2'].s };

// מיזוג תאים L2 עד O2
merges.push({ s: { r: 1, c: 11 }, e: { r: 1, c: 14 } }); // L-O

// הגדרת הסגנון עבור P2
cells['P2'] = { 
    v: orderData.header.bodyOrder, 
    s: headerStyle 
};

// העתק את הסגנון מ-P2 לתאים Q2 ו-R2
cells['Q2'] = { v: '', s: cells['P2'].s };
cells['R2'] = { v: '', s: cells['P2'].s };

// מיזוג תאים P2 עד R2
merges.push({ s: { r: 1, c: 15 }, e: { r: 1, c: 17 } }); // P-R

// הגדרת הסגנון עבור S2
cells['S2'] = { 
    v: orderData.header.invoiceNumber || '', 
    s: headerStyle 
};

// העתק את הסגנון מ-S2 לתאים T2 ו-U2
cells['T2'] = { v: '', s: cells['S2'].s };

// מיזוג תאים S2 עד T2
merges.push({ s: { r: 1, c: 18 }, e: { r: 1, c: 19 } }); // S-U

        // ----- שורות 3,4,5: מיזוגים מורכבים לכותרות המידות -----
        
        // עמודות A-F ממוזגות לגובה שורות 3-5
        cells['A3'] = { v: 'HAT NAME', s: grayHeaderStyle };
cells['A4'] = { v: '', s: cells['A3'].s }; // העתק את העיצוב מ-A3 ל-A4
cells['A5'] = { v: '', s: cells['A3'].s }; // העתק את העיצוב מ-A3 ל-
        merges.push({ s: { r: 2, c: 0 }, e: { r: 4, c: 0 } }); // A3-A5
        
        cells['B3'] = { v: 'QUIALITY', s: grayHeaderStyle };
cells['B4'] = { v: '', s: cells['B3'].s }; // העתק את העיצוב מ-B3 ל-B4
cells['B5'] = { v: '', s: cells['B3'].s };
        merges.push({ s: { r: 2, c: 1 }, e: { r: 4, c: 1 } }); // B3-B5
        
        cells['C3'] = { v: 'HEIGHT CROWN', s: grayHeaderStyle };
cells['C4'] = { v: '', s: cells['C3'].s }; // העתק את העיצוב מ-C3 ל-C4
cells['C5'] = { v: '', s: cells['C3'].s };
        merges.push({ s: { r: 2, c: 2 }, e: { r: 4, c: 2 } }); // C3-C5
        
        cells['D3'] = { v: 'BRIM', s: grayHeaderStyle };
cells['D4'] = { v: '', s: cells['D3'].s }; // העתק את העיצוב מ-D3 ל-D4
cells['D5'] = { v: '', s: cells['D3'].s };
        merges.push({ s: { r: 2, c: 3 }, e: { r: 4, c: 3 } }); // D3-D5
        
        cells['E3'] = { v: 'BRIM FINISH', s: grayHeaderStyle };
cells['E4'] = { v: '', s: cells['E3'].s }; // העתק את העיצוב מ-E3 ל-E4
cells['E5'] = { v: '', s: cells['E3'].s };
        merges.push({ s: { r: 2, c: 4 }, e: { r: 4, c: 4 } }); // E3-E5
        
        cells['F3'] = { v: 'HEIGHT RIBON', s: grayHeaderStyle };
cells['F4'] = { v: '', s: cells['F3'].s }; // העתק את העיצוב מ-F3 ל-F4
cells['F5'] = { v: '', s: cells['F3'].s }; 
        merges.push({ s: { r: 2, c: 5 }, e: { r: 4, c: 5 } }); // F3-F5
        
   // עמודות G-S ממוזגות לרוחב ולגובה בשורות 3-4
cells['G3'] = { v: '', s: grayHeaderStyle };
cells['G4'] = { v: '', s: cells['G3'].s }; // העתק את העיצוב מ-G3 ל-G4
merges.push({ s: { r: 2, c: 6 }, e: { r: 3, c: 18 } }); // G3-S4

// עמודה T בשורה 3-5: TOTAL 
cells['T3'] = { v: 'TOTAL', s: grayHeaderStyle };
cells['T4'] = { v: '', s: cells['T3'].s }; // העתק את העיצוב מ-T3 ל-T4
cells['T5'] = { v: '', s: cells['T3'].s }; // העתק את העיצוב מ-T3 ל-T5
merges.push({ s: { r: 2, c: 19 }, e: { r: 4, c: 19 } }); // T3-T5
        
        // מספרי המידות בשורה 5 (אינדקס 4) - עמודות G-S
        for (let i = 0; i < 13; i++) {
            const col = i + 6; // מתחיל מעמודה G
            const size = 51 + i; // מתחיל ממידה 51
            const cellRef = XLSX.utils.encode_cell({ r: 4, c: col });
            cells[cellRef] = { 
                v: size.toString(), 
                s: {
                    ...grayHeaderStyle,
                    border: {
                        top: mediumBorder,
                        bottom: mediumBorder,
                        left: thinBorder,
                        right: thinBorder
                    }
                } 
            };
        }
        
        // ----- שורות 6 ואילך: נתוני המידות -----
        let currentRow = 5; // מתחיל משורה 6 (אינדקס 5)

        orderData.sizes.forEach(row => {
            // תאי מאפיינים עם מסגרת שמאלית מודגשת
            cells[`A${currentRow + 1}`] = { 
                v: row.hatName, 
                s: {
                    ...dataStyle,
                    border: {
                        top: thinBorder,
                        bottom: thinBorder,
                        left: mediumBorder,
                        right: thinBorder
                    }
                } 
            };
            cells[`B${currentRow + 1}`] = { v: row.quality, s: dataStyle };
            cells[`C${currentRow + 1}`] = { v: row.crownHeight, s: dataStyle };
            cells[`D${currentRow + 1}`] = { v: row.brim, s: dataStyle };
            cells[`E${currentRow + 1}`] = { v: row.brimFinish, s: dataStyle };
            cells[`F${currentRow + 1}`] = { v: row.ribonHeight, s: dataStyle };
            
            // הוספת כמויות לכל מידה
            for (let i = 0; i < 13; i++) {
                const col = i + 6;
                const size = 51 + i;
                const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
                
                const quantity = row.sizes[size]?.quantity || '';
                const isHighlighted = row.sizes[size]?.highlighted;
                
                // בדיקה אם התא צריך להיות מסומן
                let cellStyle = dataStyle;
                if (isHighlighted) {
                    cellStyle = highlightStyle;
                } else if (size >= 54 && size <= 60 && quantity) {
                    // סגנון מותאם עם מסגרת אדומה
                    cellStyle = {
                        ...dataStyle,
                        border: {
                            top: { style: "thin", color: { rgb: "FF0000" } },
                            bottom: { style: "thin", color: { rgb: "FF0000" } },
                            left: { style: "thin", color: { rgb: "FF0000" } },
                            right: { style: "thin", color: { rgb: "FF0000" } }
                        }
                    };
                }
                
                cells[cellRef] = { v: quantity, s: cellStyle };
            }
            
            // הוספת סה"כ בשורה עם מסגרת ימנית מודגשת
            cells[`T${currentRow + 1}`] = { 
                v: row.total, 
                s: {
                    ...totalRowStyle,
                    border: {
                        top: thinBorder,
                        bottom: thinBorder,
                        left: thinBorder,
                        right: mediumBorder
                    }
                } 
            };
            
            currentRow++;
        });
        
        // הוספת שורות ריקות כנדרש
        while (currentRow < 12) { // לפחות 7 שורות של נתונים
            // תא ראשון עם מסגרת שמאלית מודגשת
            cells[XLSX.utils.encode_cell({ r: currentRow, c: 0 })] = { 
                v: '', 
                s: {
                    ...dataStyle,
                    border: {
                        top: thinBorder,
                        bottom: thinBorder,
                        left: mediumBorder,
                        right: thinBorder
                    }
                } 
            };
            
            // תאים אמצעיים רגילים
            for (let col = 1; col <= 18; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
                cells[cellRef] = { v: '', s: dataStyle };
            }
            
            // תא אחרון עם מסגרת ימנית מודגשת
            cells[XLSX.utils.encode_cell({ r: currentRow, c: 19 })] = { 
                v: '', 
                s: {
                    ...dataStyle,
                    border: {
                        top: thinBorder,
                        bottom: thinBorder,
                        left: thinBorder,
                        right: mediumBorder
                    }
                } 
            };
            
            currentRow++;
        }
        
        // ----- שורת סיכום -----
        // תא ראשון עם מסגרת שמאלית ותחתונה מודגשת
        cells[XLSX.utils.encode_cell({ r: currentRow, c: 0 })] = { 
            v: '', 
            s: {
                ...totalRowStyle,
                border: {
                    top: thinBorder,
                    bottom: mediumBorder,
                    left: mediumBorder,
                    right: thinBorder
                }
            } 
        };
        
        // תאים אמצעיים עם מסגרת תחתונה מודגשת
        for (let col = 1; col <= 5; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
            cells[cellRef] = { 
                v: '', 
                s: {
                    ...totalRowStyle,
                    border: {
                        top: thinBorder,
                        bottom: mediumBorder,
                        left: thinBorder,
                        right: thinBorder
                    }
                } 
            };
        }
        
        // הוספת סה"כ לכל מידה
        for (let i = 0; i < 13; i++) {
            const col = i + 6;
            const size = 51 + i;
            const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
            cells[cellRef] = { 
                v: orderData.summary.totalBySize[size] || 0, 
                s: {
                    ...totalRowStyle,
                    border: {
                        top: thinBorder,
                        bottom: mediumBorder,
                        left: thinBorder,
                        right: thinBorder
                    }
                } 
            };
        }
        
        // סה"כ כללי - מסגרת ימנית ותחתונה מודגשת
        cells[XLSX.utils.encode_cell({ r: currentRow, c: 19 })] = { 
            v: orderData.summary.grandTotal, 
            s: {
                ...totalRowStyle,
                border: {
                    top: thinBorder,
                    bottom: mediumBorder,
                    left: thinBorder,
                    right: mediumBorder
                }
            } 
        };
        
    
        
        // ----- חלק תחתון - מפרט טכני -----

// === חלק 1: פרטי עור (עמודות A-E) ===
// כותרת פרטי עור
cells[`A${currentRow + 1}`] = { 
    v: 'LEATHER DETAILS', 
    s: {
        ...titleStyle,
        fill: { patternType: "solid", fgColor: { rgb: "E0E0E0" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
            top: mediumBorder,
            bottom: thinBorder,
            left: mediumBorder,
            right: thinBorder
        }
    } 
};
// מיזוג כותרת פרטי עור
merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); // A-E

// כותרת פרטי ביטנה
cells[`F${currentRow + 1}`] = { 
    v: 'LINING DETAILS', 
    s: {
        ...titleStyle,
        fill: { patternType: "solid", fgColor: { rgb: "E0E0E0" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
            top: mediumBorder,
            bottom: thinBorder,
            left: thinBorder,
            right: thinBorder
        }
    } 
};
// מיזוג כותרת פרטי ביטנה
merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 12 } }); // F-M

// כותרת פרטי סרט
cells[`N${currentRow + 1}`] = { 
    v: 'RIBBON DETAILS', 
    s: {
        ...titleStyle,
        fill: { patternType: "solid", fgColor: { rgb: "E0E0E0" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
            top: mediumBorder,
            bottom: thinBorder,
            left: thinBorder,
            right: mediumBorder
        }
    } 
};
// מיזוג כותרת פרטי סרט
merges.push({ s: { r: currentRow, c: 13 }, e: { r: currentRow, c: 19 } }); // N-T

currentRow++;

// === פרטי עור - שורות ===

// רוחב עור
cells[`A${currentRow + 1}`] = { 
    v: 'LEATHER WIDTH', 
    s: { 
        ...dataStyle, 
        font: { ...dataStyle.font, bold: true },
        border: {
            top: thinBorder,
            bottom: thinBorder,
            left: mediumBorder,
            right: thinBorder
        }
    } 
};

// הגדר את סגנון המסגרת לכל התאים בטווח B-E
for (let col = 1; col <= 4; col++) { // B=1, C=2, D=3, E=4
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 1 ? (orderData.specs.leatherWidth || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: col === 4 ? thinBorder : thinBorder // אפשר לשנות אם צריך מסגרת שונה בצד ימין לתא האחרון
            }
        } 
    };
}

// הגדרת המיזוג
merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow, c: 4 } }); // B-E

// סוג עור - בקוביה של פרטי ביטנה
// הגדר את סגנון המסגרת לכל התאים בטווח F-H
for (let col = 5; col <= 7; col++) { // F=5, G=6, H=7
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 5 ? 'LINING TYPE' : '', // טקסט רק בתא הראשון
        s: { 
            ...dataStyle, 
            font: { ...dataStyle.font, bold: true },
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הגדר את סגנון המסגרת לכל התאים בטווח I-M
for (let col = 8; col <= 12; col++) { // I=8, J=9, K=10, L=11, M=12
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 8 ? (orderData.specs.liningType || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// סוג סרט 1 - בקוביה של פרטי סרט
// הגדר את סגנון המסגרת לכל התאים בטווח הראשון (N-P)
for (let col = 13; col <= 15; col++) { // N=13, O=14, P=15
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 13 ? 'RIBBON TYPE 1' : '', // טקסט רק בתא הראשון
        s: { 
            ...dataStyle, 
            font: { ...dataStyle.font, bold: true },
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הגדר את סגנון המסגרת לכל התאים בטווח השני (Q-T)
for (let col = 16; col <= 19; col++) { // Q=16, R=17, S=18, T=19
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 16 ? (orderData.specs.ribbon1 || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הגדרת המיזוגים
merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 7 } }); // F-H
merges.push({ s: { r: currentRow, c: 8 }, e: { r: currentRow, c: 12 } }); // I-M
merges.push({ s: { r: currentRow, c: 13 }, e: { r: currentRow, c: 15 } }); // N-P
merges.push({ s: { r: currentRow, c: 16 }, e: { r: currentRow, c: 19 } }); // Q-T

currentRow++;

// סוג עור
cells[`A${currentRow + 1}`] = { 
    v: 'LEATHER TYPE', 
    s: { 
        ...dataStyle, 
        font: { ...dataStyle.font, bold: true },
        border: {
            top: thinBorder,
            bottom: thinBorder,
            left: mediumBorder,
            right: thinBorder
        }
    } 
};

// הגדר את סגנון המסגרת לכל התאים בטווח B-E
for (let col = 1; col <= 4; col++) { // B=1, C=2, D=3, E=4
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 1 ? (orderData.specs.leatherType || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// צבע גג
// הגדר את סגנון המסגרת לכל התאים בטווח F-H
for (let col = 5; col <= 7; col++) { // F=5, G=6, H=7
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 5 ? 'ROOF COLOR' : '', // טקסט רק בתא הראשון
        s: { 
            ...dataStyle, 
            font: { ...dataStyle.font, bold: true },
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הגדר את סגנון המסגרת לכל התאים בטווח I-M
for (let col = 8; col <= 12; col++) { // I=8, J=9, K=10, L=11, M=12
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 8 ? (orderData.specs.roofColor || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// סוג סרט 2
// הגדר את סגנון המסגרת לכל התאים בטווח N-P
for (let col = 13; col <= 15; col++) { // N=13, O=14, P=15
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 13 ? 'RIBBON TYPE 2' : '', // טקסט רק בתא הראשון
        s: { 
            ...dataStyle, 
            font: { ...dataStyle.font, bold: true },
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הגדר את סגנון המסגרת לכל התאים בטווח Q-T
for (let col = 16; col <= 19; col++) { // Q=16, R=17, S=18, T=19
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 16 ? (orderData.specs.ribbon2 || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow, c: 4 } }); // B-E
merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 7 } }); // F-H
merges.push({ s: { r: currentRow, c: 8 }, e: { r: currentRow, c: 12 } }); // I-M
merges.push({ s: { r: currentRow, c: 13 }, e: { r: currentRow, c: 15 } }); // N-P
merges.push({ s: { r: currentRow, c: 16 }, e: { r: currentRow, c: 19 } }); // Q-T

currentRow++;

// צבע עור
cells[`A${currentRow + 1}`] = { 
    v: 'LEATHER COLOR', 
    s: { 
        ...dataStyle, 
        font: { ...dataStyle.font, bold: true },
        border: {
            top: thinBorder,
            bottom: thinBorder,
            left: mediumBorder,
            right: thinBorder
        }
    } 
};

// הגדר את סגנון המסגרת לכל התאים בטווח B-E
for (let col = 1; col <= 4; col++) { // B=1, C=2, D=3, E=4
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 1 ? (orderData.specs.leatherColor || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// צבע קיר
// הגדר את סגנון המסגרת לכל התאים בטווח F-H
for (let col = 5; col <= 7; col++) { // F=5, G=6, H=7
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 5 ? 'WALL COLOR' : '', // טקסט רק בתא הראשון
        s: { 
            ...dataStyle, 
            font: { ...dataStyle.font, bold: true },
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הגדר את סגנון המסגרת לכל התאים בטווח I-M
for (let col = 8; col <= 12; col++) { // I=8, J=9, K=10, L=11, M=12
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 8 ? (orderData.specs.wallColor || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// סוג סרט 3
// הגדר את סגנון המסגרת לכל התאים בטווח N-P
for (let col = 13; col <= 15; col++) { // N=13, O=14, P=15
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 13 ? 'RIBBON TYPE 3' : '', // טקסט רק בתא הראשון
        s: { 
            ...dataStyle, 
            font: { ...dataStyle.font, bold: true },
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הגדר את סגנון המסגרת לכל התאים בטווח Q-T
for (let col = 16; col <= 19; col++) { // Q=16, R=17, S=18, T=19
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 16 ? (orderData.specs.ribbon3 || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow, c: 4 } }); // B-E
merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 7 } }); // F-H
merges.push({ s: { r: currentRow, c: 8 }, e: { r: currentRow, c: 12 } }); // I-M
merges.push({ s: { r: currentRow, c: 13 }, e: { r: currentRow, c: 15 } }); // N-P
merges.push({ s: { r: currentRow, c: 16 }, e: { r: currentRow, c: 19 } }); // Q-T

currentRow++;

// הטבעה בצד שמאל
cells[`A${currentRow + 1}`] = { 
    v: 'LEFT IMPRINTING', 
    s: { 
        ...dataStyle, 
        font: { ...dataStyle.font, bold: true },
        border: {
            top: thinBorder,
            bottom: thinBorder,
            left: mediumBorder,
            right: thinBorder
        }
    } 
};

// הגדר את סגנון המסגרת לכל התאים בטווח B-E
for (let col = 1; col <= 4; col++) { // B=1, C=2, D=3, E=4
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 1 ? (orderData.specs.leftImprinting || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// פספואל
// הגדר את סגנון המסגרת לכל התאים בטווח F-H
for (let col = 5; col <= 7; col++) { // F=5, G=6, H=7
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 5 ? 'PESFOALL' : '', // טקסט רק בתא הראשון
        s: { 
            ...dataStyle, 
            font: { ...dataStyle.font, bold: true },
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הגדר את סגנון המסגרת לכל התאים בטווח I-M
for (let col = 8; col <= 12; col++) { // I=8, J=9, K=10, L=11, M=12
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 8 ? (orderData.specs.pesfoall || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הערות מיוחדות
// הגדר את סגנון המסגרת לכל התאים בטווח N-P
for (let col = 13; col <= 15; col++) { // N=13, O=14, P=15
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 13 ? 'SPECIAL COMMENTS' : '', // טקסט רק בתא הראשון
        s: { 
            ...dataStyle, 
            font: { ...dataStyle.font, bold: true },
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הגדר את סגנון המסגרת לכל התאים בטווח Q-T
for (let col = 16; col <= 19; col++) { // Q=16, R=17, S=18, T=19
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 16 ? (orderData.specs.comments || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow, c: 4 } }); // B-E
merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 7 } }); // F-H
merges.push({ s: { r: currentRow, c: 8 }, e: { r: currentRow, c: 12 } }); // I-M
merges.push({ s: { r: currentRow, c: 13 }, e: { r: currentRow, c: 15 } }); // N-P
merges.push({ s: { r: currentRow, c: 16 }, e: { r: currentRow, c: 19 } }); // Q-T

currentRow++;

// הטבעה בצד ימין
cells[`A${currentRow + 1}`] = { 
    v: 'RIGHT IMPRINTING', 
    s: { 
        ...dataStyle, 
        font: { ...dataStyle.font, bold: true },
        border: {
            top: thinBorder,
            bottom: thinBorder,
            left: mediumBorder,
            right: thinBorder
        }
    } 
};

// הגדר את סגנון המסגרת לכל התאים בטווח B-E
for (let col = 1; col <= 4; col++) { // B=1, C=2, D=3, E=4
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 1 ? (orderData.specs.rightImprinting || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// לוגו
// הגדר את סגנון המסגרת לכל התאים בטווח F-H
for (let col = 5; col <= 7; col++) { // F=5, G=6, H=7
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 5 ? 'LOGO' : '', // טקסט רק בתא הראשון
        s: { 
            ...dataStyle, 
            font: { ...dataStyle.font, bold: true },
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הגדר את סגנון המסגרת לכל התאים בטווח I-M
for (let col = 8; col <= 12; col++) { // I=8, J=9, K=10, L=11, M=12
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 8 ? (orderData.specs.logo || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// תא ריק בקוביה של פרטי סרט
// הגדר את סגנון המסגרת לתא N
cells[`N${currentRow + 1}`] = { 
    v: '', 
    s: { 
        ...dataStyle,
        border: {
            top: thinBorder,
            bottom: thinBorder,
            left: thinBorder,
            right: thinBorder
        }
    } 
};

// הגדר את סגנון המסגרת לכל התאים בטווח O-T
for (let col = 14; col <= 19; col++) { // O=14, P=15, Q=16, R=17, S=18, T=19
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: '', // תא ריק
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: thinBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow, c: 4 } }); // B-E
merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 7 } }); // F-H
merges.push({ s: { r: currentRow, c: 8 }, e: { r: currentRow, c: 12 } }); // I-M


currentRow++;

// הטבעה חזיתית
cells[`A${currentRow + 1}`] = { 
    v: 'FRONT IMPRINTING', 
    s: { 
        ...dataStyle, 
        font: { ...dataStyle.font, bold: true },
        border: {
            top: thinBorder,
            bottom: mediumBorder,
            left: mediumBorder,
            right: thinBorder
        }
    } 
};

// הגדר את סגנון המסגרת לכל התאים בטווח B-E
for (let col = 1; col <= 4; col++) { // B=1, C=2, D=3, E=4
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: col === 1 ? (orderData.specs.frontImprinting || '') : '', // ערך רק בתא הראשון
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: mediumBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// שורה ריקה בקוביה של פרטי ביטנה, עם קו תחתון מודגש
for (let col = 5; col <= 6; col++) { // F=5, G=6
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: '', // תא ריק
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: mediumBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// הגדר את סגנון המסגרת לכל התאים בטווח G-M
for (let col = 6; col <= 12; col++) { // G=6, H=7, I=8, J=9, K=10, L=11, M=12
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: '', // תא ריק
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: mediumBorder,
                left: thinBorder,
                right: thinBorder
            }
        } 
    };
}

// שורה ריקה בקוביה של פרטי סרט, עם קו תחתון מודגש
// הגדר את סגנון המסגרת לתא N
cells[`N${currentRow + 1}`] = { 
    v: '', 
    s: { 
        ...dataStyle,
        border: {
            top: thinBorder,
            bottom: mediumBorder,
            left: thinBorder,
            right: thinBorder
        }
    } 
};

// הגדר את סגנון המסגרת לכל התאים בטווח O-T
for (let col = 14; col <= 19; col++) { // O=14, P=15, Q=16, R=17, S=18, T=19
    const cellRef = XLSX.utils.encode_cell({r: currentRow, c: col});
    cells[cellRef] = { 
        v: '', // תא ריק
        s: {
            ...dataStyle,
            border: {
                top: thinBorder,
                bottom: mediumBorder,
                left: thinBorder,
                right: col === 19 ? mediumBorder : thinBorder
            }
        } 
    };
}

merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow, c: 4 } }); // B-E
merges.push({ s: { r: currentRow, c: 6 }, e: { r: currentRow, c: 12 } }); // G-M
        
        // הגדרת טווח הנתונים
        const range = { s: { r: 0, c: 0 }, e: { r: currentRow, c: 19 } };
        ws['!ref'] = XLSX.utils.encode_range(range);
        
        // הוספת כל התאים לגיליון
        Object.keys(cells).forEach(cellRef => {
            ws[cellRef] = cells[cellRef];
        });
        
        // הוספת מיזוגי תאים
        ws['!merges'] = merges;
        
        // הגדרת רוחב עמודות
        ws['!cols'] = [
            { width: 20 }, // A - HAT NAME
            { width: 10 }, // B - QUALITY
            { width: 15 }, // C - HEIGHT CROWN
            { width: 8 },  // D - BRIM
            { width: 12 }, // E - BRIM FINISH
            { width: 12 }, // F - HEIGHT RIBON
            { width: 6 },  // G - 51
            { width: 6 },  // H - 52
            { width: 6 },  // I - 53
            { width: 6 },  // J - 54
            { width: 6 },  // K - 55
            { width: 6 },  // L - 56
            { width: 6 },  // M - 57
            { width: 6 },  // N - 58
            { width: 6 },  // O - 59
            { width: 6 },  // P - 60
            { width: 6 },  // Q - 61
            { width: 6 },  // R - 62
            { width: 6 },  // S - 63
            { width: 10 }  // T - TOTAL
        ];
        
        // הגדרת גובה שורות
        ws['!rows'] = Array(currentRow + 1).fill({ hpt: 15 });
        ws['!rows'][1] = { hpt: 30 }; // שורה 2 גבוהה יותר
        
        // הוספת הגיליון לחוברת העבודה
        XLSX.utils.book_append_sheet(wb, ws, "Order");
        
        // הגדרת שם הקובץ
        const fileName = `Order_${orderData.header.orderNumber}_${orderData.header.model}.xlsx`;
        
        // שמירת הקובץ
        XLSX.writeFile(wb, fileName);
        
        alert('הקובץ נוצר בהצלחה!');
        
    } catch (error) {
        console.error('שגיאה בייצוא לאקסל:', error);
        alert('אירעה שגיאה בייצוא לאקסל: ' + error.message);
    }
}
// פונקציה לניקוי הטופס
function clearForm() {
    if (confirm('האם אתה בטוח שברצונך לנקות את כל הטופס?')) {
        // ניקוי שדות הכותרת (מלבד תאריך)
        document.getElementById('orderedBy').value = '';
        document.getElementById('model').value = '';
document.getElementById('orderNumber').value = '';
        document.getElementById('bodyType').value = '';
        document.getElementById('bodyOrder').value = '';
        
        // ניקוי טבלת המידות
        const tableBody = document.getElementById('sizesTableBody');
        tableBody.innerHTML = '';
        
        // הוספת שורה חדשה ריקה
        addNewRow();
        
        // איפוס סיכומים
        for (let size = 51; size <= 63; size++) {
            document.getElementById(`total-${size}`).textContent = '0';
        }
        document.getElementById('grand-total').textContent = '0';
        
      // ניקוי שדות המפרט
document.getElementById('leatherWidth').value = '';
document.getElementById('leatherType').value = 'leather'; // ערך ברירת מחדל לעור
document.getElementById('leatherColor').value = '';
document.getElementById('leftImprinting').value = '';
document.getElementById('rightImprinting').value = '';
document.getElementById('frontImprinting').value = '';
document.getElementById('liningType').value = 'lining'; // ערך ברירת מחדל לביטנה
document.getElementById('roofColor').value = '';
document.getElementById('wallColor').value = '';
document.getElementById('pesfoall').value = '';
document.getElementById('logo').value = '';
document.getElementById('ribbon1').value = '';
document.getElementById('ribbon2').value = '';
document.getElementById('ribbon3').value = '';
document.getElementById('comments').value = '';
        
        // איפוס מצב סימון תאים
        highlightMode = false;
        currentHighlightRowId = null;
    }
}

// פונקציה לשמירת ההזמנה כתבנית
function saveAsTemplate() {
    try {
        const templateName = prompt('הזן שם לתבנית:');
        if (!templateName) return;
        
        const templateData = collectFormData();
        
        // הסרת שדות שאינם רלוונטיים לתבנית
        delete templateData.header.orderNumber;
        delete templateData.header.orderDate;
        delete templateData.createdAt;
        
        // שמירת התבנית ב-Firestore
        db.collection('templates').doc(templateName).set(templateData)
            .then(() => {
                alert(`התבנית "${templateName}" נשמרה בהצלחה!`);
                // רענון רשימת התבניות
                loadTemplatesList();
            })
            .catch((error) => {
                console.error('שגיאה בשמירת התבנית:', error);
                alert('אירעה שגיאה בשמירת התבנית: ' + error.message);
            });
    } catch (error) {
        console.error('שגיאה בשמירת התבנית:', error);
        alert('אירעה שגיאה בשמירת התבנית: ' + error.message);
    }
}

// פונקציה לטעינת רשימת התבניות
function loadTemplatesList() {
    const selectElement = document.getElementById('templateSelect');
    
    // ניקוי הרשימה הקיימת
    selectElement.innerHTML = '';
    
    // הוספת אפשרות ריקה
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- בחר תבנית --';
    selectElement.appendChild(defaultOption);
    
    // טעינת התבניות מ-Firestore
    db.collection('templates').get()
        .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = doc.id;
                selectElement.appendChild(option);
            });
        })
        .catch((error) => {
            console.error('שגיאה בטעינת רשימת התבניות:', error);
        });
}

// פונקציה להצגת מודאל טעינת תבנית
function showLoadTemplateModal() {
    // רענון רשימת התבניות
    loadTemplatesList();
    
    // הצגת המודאל
    new bootstrap.Modal(document.getElementById('loadTemplateModal')).show();
}

// פונקציה לטעינת התבנית הנבחרת
function loadSelectedTemplate() {
    const templateName = document.getElementById('templateSelect').value;
    
    if (!templateName) {
        alert('אנא בחר תבנית');
        return;
    }
    
    // טעינת התבנית מ-Firestore
    db.collection('templates').doc(templateName).get()
        .then((doc) => {
            if (doc.exists) {
                const templateData = doc.data();
                
                // מילוי פרטי הכותרת (למעט מספר הזמנה ותאריך)
                document.getElementById('orderedBy').value = templateData.header.orderedBy || '';
                document.getElementById('model').value = templateData.header.model || '';
                document.getElementById('bodyType').value = templateData.header.bodyType || '';
                document.getElementById('bodyOrder').value = templateData.header.bodyOrder || '';
                document.getElementById('invoiceNumber').value = templateData.header.invoiceNumber || '';
                
                // ניקוי טבלת המידות
                document.getElementById('sizesTableBody').innerHTML = '';
                rowCounter = 0;
                
                // מילוי טבלת המידות
                if (templateData.sizes && templateData.sizes.length > 0) {
                    templateData.sizes.forEach(rowData => {
                        addNewRow();
                        const newRowId = rowCounter - 1;
                        const newRow = document.getElementById(`row-${newRowId}`);
                        
                        // מילוי פרטי השורה
                        newRow.querySelector('[name="hatName"]').value = rowData.hatName || '';
                        newRow.querySelector('[name="quality"]').value = rowData.quality || '';
                        newRow.querySelector('[name="crownHeight"]').value = rowData.crownHeight || '';
                        newRow.querySelector('[name="brim"]').value = rowData.brim || '';
                        newRow.querySelector('[name="brimFinish"]').value = rowData.brimFinish || '';
                        newRow.querySelector('[name="ribonHeight"]').value = rowData.ribonHeight || '';
                        
                        // מילוי המידות
                        for (let size = 51; size <= 63; size++) {
                            const sizeInput = newRow.querySelector(`[name="size-${size}"]`);
                            if (sizeInput && rowData.sizes && rowData.sizes[size]) {
                                sizeInput.value = rowData.sizes[size].quantity || 0;
                                
                                // סימון תאים מודגשים
                                if (rowData.sizes[size].highlighted) {
                                    sizeInput.parentElement.classList.add('highlighted-cell');
                                }
                            }
                        }
                        
                        // חישוב מחדש של הסיכומים
                        calculateRowTotal(newRowId);
                    });
                } else {
                    // אם אין שורות, הוסף שורה ריקה אחת
                    addNewRow();
                }
                
                // מילוי פרטי המפרט
                document.getElementById('leatherWidth').value = templateData.specs.leatherWidth || '';
                document.getElementById('leatherColor').value = templateData.specs.leatherColor || '';
                document.getElementById('printingColor').value = templateData.specs.printingColor || '';
                document.getElementById('leftImprinting').value = templateData.specs.leftImprinting || '';
                document.getElementById('rightImprinting').value = templateData.specs.rightImprinting || '';
                document.getElementById('frontImprinting').value = templateData.specs.frontImprinting || '';
                document.getElementById('liningDetails').value = templateData.specs.liningDetails || '';
                document.getElementById('roofColor').value = templateData.specs.roofColor || '';
                document.getElementById('wallColor').value = templateData.specs.wallColor || '';
                document.getElementById('pesfoall').value = templateData.specs.pesfoall || '';
                document.getElementById('brimStyle').value = templateData.specs.brimStyle || '';
                document.getElementById('quality').value = templateData.specs.quality || '';
                document.getElementById('comments').value = templateData.specs.comments || '';
                
                // חישוב מחדש של כל הסיכומים
                calculateColumnTotals();
                
                // סגירת המודאל
                bootstrap.Modal.getInstance(document.getElementById('loadTemplateModal')).hide();
                
                alert(`התבנית "${templateName}" נטענה בהצלחה!`);
            } else {
                alert(`לא נמצאה תבנית בשם "${templateName}"`);
            }
        })
        .catch((error) => {
            console.error('שגיאה בטעינת התבנית:', error);
            alert('אירעה שגיאה בטעינת התבנית: ' + error.message);
        });
}