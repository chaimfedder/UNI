// חכה עד שה-DOM יטען לחלוטין
document.addEventListener('DOMContentLoaded', function() {
    // חיבור אירועים לכפתורים
    document.getElementById('uploadBtn').addEventListener('click', processExcelFile);
    document.getElementById('saveToDbBtn').addEventListener('click', saveOrderToDb);
    
    // כפתורי עריכת כותרת
    document.getElementById('editHeaderBtn').addEventListener('click', showHeaderEditMode);
    document.getElementById('cancelEditBtn').addEventListener('click', cancelHeaderEdit);
    document.getElementById('saveHeaderBtn').addEventListener('click', saveHeaderEdit);
});

// אובייקט לשמירת נתוני ההזמנה שנקראו מהקובץ
let orderData = {
    header: {},
    sizes: [],
    summary: {
        totalBySize: {},
        grandTotal: 0
    }
};

// פונקציה לעיבוד קובץ האקסל
function processExcelFile() {
    const fileInput = document.getElementById('excelFile');
    const orderNumberInput = document.getElementById('orderNumber');
    const file = fileInput.files[0];
    const orderNumber = orderNumberInput.value.trim();
    
    // בדיקת תקינות הקלט
    if (!file) {
        showToast('אנא בחר קובץ אקסל תחילה', 'danger');
        return;
    }
    
    // בדיקה שהקובץ הוא אכן אקסל
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name;
    const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
        showToast('אנא העלה קובץ אקסל בלבד (.xlsx או .xls)', 'danger');
        return;
    }
    
    // בדיקה שהוזן מספר הזמנה
    if (!orderNumber) {
        showToast('אנא הזן מספר הזמנה', 'danger');
        return;
    }
    
    showToast('מעבד את הקובץ, אנא המתן...', 'info');
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            // קבלת הגיליון הראשון
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // קריאת הנתונים מהאקסל
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ''});
            
            console.log("נתוני האקסל שנקראו:", jsonData);
            
            // איפוס נתוני ההזמנה הקודמים
            resetOrderData();
            
            // שמירת מספר ההזמנה
            orderData.header.orderNumber = orderNumber;
            
            // גישה פשוטה לנתוני הכותרת - הנחה שיש לפחות 2 שורות
            if (jsonData.length >= 2) {
                try {
                    // ניסיון לקרוא את הנתונים מהשורה השנייה (אינדקס 1)
                    const row = jsonData[1];
                    if (row) {
                        // תאריך הזמנה - עמודה A (אינדקס 0)
                        if (row[0] !== undefined) orderData.header.orderDate = row[0].toString();
                        
                        // מזמין - עמודה B (אינדקס 1)
                        if (row[1] !== undefined) orderData.header.orderedBy = row[1].toString();
                        
                        // מודל - עמודה D (אינדקס 3)
                        if (row[3] !== undefined) orderData.header.model = row[3].toString();
                        
                        // סוג גוף - עמודה L (אינדקס 11)
                        if (row[11] !== undefined) orderData.header.bodyType = row[11].toString();
                        
                        // הזמנת גוף - עמודה P (אינדקס 15)
                        if (row[15] !== undefined) orderData.header.bodyOrder = row[15].toString();
                    }
                } catch (error) {
                    console.error("שגיאה בקריאת נתוני כותרת:", error);
                    // ממשיכים למרות השגיאה
                }
            }
            
            // חיפוש שורת המידות והנתונים
            let hatNameRow = -1;
            let sizesRow = -1;
            
            // חיפוש השורה עם "HAT NAME"
            for (let i = 0; i < jsonData.length; i++) {
                if (jsonData[i][0] === 'HAT NAME') {
                    hatNameRow = i;
                    break;
                }
            }
            
            // אם לא מצאנו, לא ממשיכים
            if (hatNameRow === -1) {
                throw new Error('לא נמצאה שורת הכותרות של המידות');
            }
            
            // חיפוש השורה עם המידות (51, 52, וכו')
            for (let i = hatNameRow; i < jsonData.length; i++) {
                for (let j = 0; j < jsonData[i].length; j++) {
                    if (jsonData[i][j] === 51 || 
                        jsonData[i][j] === '51' ||
                        jsonData[i][j] === 52 || 
                        jsonData[i][j] === '52') {
                        sizesRow = i;
                        break;
                    }
                }
                if (sizesRow !== -1) break;
            }
            
            // אם לא מצאנו את שורת המידות, ננסה לקחת את השורה שאחרי HAT NAME
            if (sizesRow === -1) {
                sizesRow = hatNameRow + 1;
            }
            
            // קריאת נתוני המידות מהשורות שאחרי
            extractSizesData(jsonData, sizesRow + 1, sizesRow);
            
            // חישוב סיכומים
            calculateSummary();
            
            // הצגת הנתונים
            displayOrderPreview();
            
            showToast('הקובץ נטען בהצלחה!', 'success');
            
        } catch (error) {
            console.error('שגיאה בעיבוד הקובץ:', error);
            showToast('אירעה שגיאה בעיבוד הקובץ: ' + error.message, 'danger');
        }
    };
    
    reader.onerror = function() {
        showToast('אירעה שגיאה בקריאת הקובץ', 'danger');
    };
    
    reader.readAsArrayBuffer(file);
}

// פונקציה לאיפוס נתוני ההזמנה
function resetOrderData() {
    orderData = {
        header: {
            orderNumber: '' // נשמור אותו ריק, יתמלא בהמשך
        },
        sizes: [],
        summary: {
            totalBySize: {},
            grandTotal: 0
        }
    };
}

// פונקציה לחילוץ נתוני המידות
function extractSizesData(jsonData, startRow, sizesHeaderRow) {
    // מציאת העמודות של המידות
    const sizeColumns = {};
    const sizesRow = jsonData[sizesHeaderRow] || [];
    
    // מיפוי המידות לעמודות
    for (let col = 0; col < sizesRow.length; col++) {
        const colValue = sizesRow[col];
        if (colValue === 51 || colValue === '51' ||
            colValue === 52 || colValue === '52' ||
            colValue === 53 || colValue === '53' ||
            colValue === 54 || colValue === '54' ||
            colValue === 55 || colValue === '55' ||
            colValue === 56 || colValue === '56' ||
            colValue === 57 || colValue === '57' ||
            colValue === 58 || colValue === '58' ||
            colValue === 59 || colValue === '59' ||
            colValue === 60 || colValue === '60' ||
            colValue === 61 || colValue === '61' ||
            colValue === 62 || colValue === '62' ||
            colValue === 63 || colValue === '63') {
            // המרת הערך למספר
            const size = parseInt(colValue);
            if (!isNaN(size) && size >= 51 && size <= 63) {
                sizeColumns[size] = col;
            }
        }
    }
    
    console.log("עמודות המידות:", sizeColumns);
    
    // עיבוד השורות עם הנתונים
    for (let rowIdx = startRow; rowIdx < jsonData.length; rowIdx++) {
        const row = jsonData[rowIdx];
        
        // בדיקה שיש נתונים בשורה ושלא הגענו למפרט הטכני
        if (!row || !row[0] || row[0] === 'LEATHER DETAILS') {
            break;
        }
        
        // יצירת אובייקט לשורת המידות
        const sizeRow = {
            hatName: row[0] || '', // עמודה A
            quality: row[1] || '', // עמודה B
            crownHeight: row[2] || '', // עמודה C
            brim: row[3] || '', // עמודה D
            brimFinish: row[4] || '', // עמודה E
            ribonHeight: row[5] || '', // עמודה F
            sizes: {},
            total: 0
        };
        
        // מילוי המידות
        let total = 0;
        
        // עבור על כל המידות האפשריות
        for (let size = 51; size <= 63; size++) {
            // בדיקה אם יש עמודה למידה זו
            if (sizeColumns[size] !== undefined) {
                const col = sizeColumns[size];
                const quantity = parseInt(row[col]) || 0;
                
                // שמירת הכמות
                sizeRow.sizes[size] = {
                    quantity: quantity,
                    highlighted: false
                };
                
                total += quantity;
            } else {
                // אם אין עמודה למידה זו, שמירת 0
                sizeRow.sizes[size] = {
                    quantity: 0,
                    highlighted: false
                };
            }
        }
        
        // שמירת סה"כ
        sizeRow.total = total;
        
        // הוספת השורה למערך רק אם יש בה כמות גדולה מ-0
        if (total > 0) {
            orderData.sizes.push(sizeRow);
        }
    }
    
    console.log("שורות שנקראו:", orderData.sizes);
}

// פונקציה לחישוב סיכומים
function calculateSummary() {
    // איפוס הסיכומים
    orderData.summary.totalBySize = {};
    orderData.summary.grandTotal = 0;
    
    // איפוס ספירת המידות
    for (let size = 51; size <= 63; size++) {
        orderData.summary.totalBySize[size] = 0;
    }
    
    // חישוב הסיכומים
    orderData.sizes.forEach(row => {
        for (let size = 51; size <= 63; size++) {
            if (row.sizes[size] && row.sizes[size].quantity) {
                orderData.summary.totalBySize[size] += row.sizes[size].quantity;
                orderData.summary.grandTotal += row.sizes[size].quantity;
            }
        }
    });
    
    console.log("סיכום כמויות:", orderData.summary);
}

// פונקציה להצגת תצוגה מקדימה של ההזמנה
function displayOrderPreview() {
    // הצגת פרטי הכותרת
    updateHeaderDisplay();
    
    // הצגת טבלת המידות
    displaySizesPreview();
    
    // הצגת כרטיסיית התצוגה המקדימה
    document.getElementById('previewCard').style.display = 'block';
}

// פונקציה לעדכון תצוגת הכותרת
function updateHeaderDisplay() {
    // עדכון הערכים בתצוגת הכותרת
    document.getElementById('headerOrderNumber').textContent = orderData.header.orderNumber || '-';
    document.getElementById('headerOrderDate').textContent = orderData.header.orderDate || '-';
    document.getElementById('headerModel').textContent = orderData.header.model || '-';
    document.getElementById('headerOrderedBy').textContent = orderData.header.orderedBy || '-';
    document.getElementById('headerBodyType').textContent = orderData.header.bodyType || '-';
    document.getElementById('headerBodyOrder').textContent = orderData.header.bodyOrder || '-';
    
    // עדכון ערכי ברירת מחדל בשדות העריכה
    document.getElementById('editOrderNumber').value = orderData.header.orderNumber || '';
    document.getElementById('editOrderDate').value = orderData.header.orderDate || '';
    document.getElementById('editModel').value = orderData.header.model || '';
    document.getElementById('editOrderedBy').value = orderData.header.orderedBy || '';
    document.getElementById('editBodyType').value = orderData.header.bodyType || '';
    document.getElementById('editBodyOrder').value = orderData.header.bodyOrder || '';
}

// פונקציה להצגת מצב עריכת כותרת
function showHeaderEditMode() {
    document.getElementById('headerViewMode').style.display = 'none';
    document.getElementById('headerEditMode').style.display = 'block';
}

// פונקציה לביטול עריכת כותרת
function cancelHeaderEdit() {
    document.getElementById('headerViewMode').style.display = 'block';
    document.getElementById('headerEditMode').style.display = 'none';
}

// פונקציה לשמירת שינויי עריכת הכותרת
function saveHeaderEdit() {
    // קבלת הערכים המעודכנים
    orderData.header.orderDate = document.getElementById('editOrderDate').value;
    orderData.header.model = document.getElementById('editModel').value;
    orderData.header.orderedBy = document.getElementById('editOrderedBy').value;
    orderData.header.bodyType = document.getElementById('editBodyType').value;
    orderData.header.bodyOrder = document.getElementById('editBodyOrder').value;
    
    // עדכון הממשק
    updateHeaderDisplay();
    
    // חזרה למצב תצוגה
    cancelHeaderEdit();
    
    // הודעה למשתמש
    showToast('פרטי ההזמנה עודכנו בהצלחה', 'success');
}

// פונקציה להצגת טבלת המידות בתצוגה מקדימה
function displaySizesPreview() {
    const tableBody = document.getElementById('previewSizesTable');
    tableBody.innerHTML = '';
    
    // הוספת שורות לטבלה
    orderData.sizes.forEach(row => {
        const newRow = document.createElement('tr');
        
        // מילוי פרטי הכותרת של השורה
        let rowHTML = `
            <td>${row.hatName}</td>
            <td>${row.quality}</td>
            <td>${row.crownHeight}</td>
            <td>${row.brim}</td>
            <td>${row.brimFinish}</td>
            <td>${row.ribonHeight}</td>
        `;
        
        // הוספת תאי המידות
        for (let size = 51; size <= 63; size++) {
            const quantity = row.sizes[size] ? row.sizes[size].quantity : 0;
            rowHTML += `<td>${quantity > 0 ? quantity : ''}</td>`;
        }
        
        // הוספת סה"כ
        rowHTML += `<td class="fw-bold">${row.total}</td>`;
        
        newRow.innerHTML = rowHTML;
        
        tableBody.appendChild(newRow);
    });
    
    // עדכון שורת הסיכום
    for (let size = 51; size <= 63; size++) {
        const totalElement = document.getElementById(`preview-total-${size}`);
        if (totalElement) {
            totalElement.textContent = orderData.summary.totalBySize[size] || 0;
        }
    }
    
    // עדכון סה"כ כללי
    document.getElementById('preview-grand-total').textContent = orderData.summary.grandTotal;
}

// פונקציה לשמירת ההזמנה במסד הנתונים
async function saveOrderToDb() {
    try {
        // בדיקת תקינות
        if (!orderData.header.orderNumber) {
            showToast('מספר הזמנה חסר, לא ניתן לשמור', 'danger');
            return;
        }
        
        if (orderData.sizes.length === 0) {
            showToast('אין נתוני מידות להזמנה, לא ניתן לשמור', 'danger');
            return;
        }
        
        // דרישה לעדכון המודל אם חסר או ריק
        if (!orderData.header.model || orderData.header.model.trim() === '') {
            showHeaderEditMode(); // להציג את מצב העריכה
            document.getElementById('editModel').focus();
            showToast('אנא מלא את שדה המודל לפני שמירה', 'warning');
            return;
        }
        
        // הוספת שדות נוספים
        orderData.createdAt = new Date();
        orderData.status = 'הוזמן';
        // הוספת אובייקט specs ריק כדי לשמור על תאימות עם שאר המערכת
        orderData.specs = {};
        
        // בדיקה אם כבר קיימת הזמנה עם מספר זה
        const orderRef = db.collection('orders').doc(orderData.header.orderNumber);
        const doc = await orderRef.get();
        
        if (doc.exists) {
            const confirm = window.confirm('קיימת כבר הזמנה עם מספר זה. האם לדרוס?');
            if (!confirm) return;
        }
        
        // שמירת ההזמנה ב-Firestore
        await orderRef.set(orderData);
        
        showToast('ההזמנה נשמרה בהצלחה!', 'success');
        
        // ניקוי הטופס אחרי שמירה מוצלחת
        if (window.confirm('האם לנקות את הטופס?')) {
            document.getElementById('excelFile').value = '';
            document.getElementById('orderNumber').value = '';
            document.getElementById('previewCard').style.display = 'none';
            resetOrderData();
        }
    } catch (error) {
        console.error('שגיאה בשמירת ההזמנה:', error);
        showToast('אירעה שגיאה בשמירת ההזמנה: ' + error.message, 'danger');
    }
}

// פונקציה להצגת הודעות
function showToast(message, type = 'info') {
    const toast = document.getElementById('statusToast');
    const toastBody = document.getElementById('toastMessage');
    
    // הגדרת הסגנון לפי סוג ההודעה
    toast.className = 'toast';
    toast.classList.add(`bg-${type}`);
    
    if (type === 'success' || type === 'danger' || type === 'dark') {
        toast.classList.add('text-white');
    }
    
    // הגדרת תוכן ההודעה
    toastBody.textContent = message;
    
    // הצגת ההודעה
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}