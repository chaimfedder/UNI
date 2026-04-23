import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import * as XLSX from 'xlsx-js-style';
import { saveOrderMovements } from '../../firebase/inventory';
import MaterialSelector from '../Inventory/MaterialSelector';

const SIZES = [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63];

// ── Row validation helpers ────────────────────────────────────
// Rows containing any of these keywords are decorative/attribute rows
// and must never be saved to the DB.
const FORBIDDEN_ROW_KEYWORDS = [
  'LEATHER', 'IMPRINTING', 'COLOR', 'DETAILS', 'WIDTH', 'LINING', 'ROOF', 'WALL',
];

function isForbiddenRow(row) {
  return row.some(cell => {
    const val = String(cell ?? '').trim().toUpperCase();
    return FORBIDDEN_ROW_KEYWORDS.some(kw => val.includes(kw));
  });
}

function isRealOrderRow(row, sizeColMap) {
  if (!row || row.length === 0) return false;
  if (isForbiddenRow(row)) return false;

  const col0 = String(row[0] ?? '').trim().toUpperCase();
  if (col0.includes('TOTAL')) return false;

  let count = 0;
  for (let c = 0; c <= 5; c++) {
    if (String(row[c] ?? '').trim() !== '') count++;
  }

  const hasQty = Object.values(sizeColMap).some(col => {
    const qty = parseInt(row[col]);
    return !isNaN(qty) && qty > 0;
  });
  if (hasQty) count++;

  return count >= 2;
}

export default function ImportOrderExcel() {
  const { t } = useTranslation();
  const fileRef  = useRef();

  const [orderNumber, setOrderNumber] = useState('');
  const [model,       setModel]       = useState('');
  const [preview, setPreview]         = useState(null);
  const [editMode, setEditMode]       = useState(false);
  const [editHeader, setEditHeader]   = useState({});
  const [toast, setToast]             = useState(null);
  const [saving, setSaving]           = useState(false);
  const [waModal, setWaModal]         = useState(null);
  const [sendingWA, setSendingWA]     = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [showMaterials, setShowMaterials]         = useState(false);

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Parse Excel ──────────────────────────────────────────────
  function processFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) { showToast('error', t('orders.chooseExcel')); return; }
    if (!orderNumber.trim()) { showToast('error', t('orders.noOrderNumber')); return; }
    if (!model.trim()) { showToast('error', t('orders.noModel')); return; }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        const order = parseOrderSheet(jsonData);
        order.header.orderNumber = orderNumber.trim();
        order.header.model = model.trim().toUpperCase();
        setPreview(order);
        setEditHeader({ ...order.header });
        setEditMode(false);
        showToast('success', t('orders.importSuccess'));
      } catch (err) {
        console.error(err);
        showToast('error', t('orders.importError') + ': ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function parseOrderSheet(jsonData) {
    const header = {
      orderNumber: '', orderDate: '', orderedBy: '',
      model: '', brand: '', bodyType: '', bodyOrder: '', invoiceNumber: '',
    };

    if (jsonData.length >= 2) {
      const row = jsonData[1] || [];
      if (row[0]) header.orderDate  = row[0].toString();
      if (row[1]) header.orderedBy  = row[1].toString();
      if (row[3]) header.model      = row[3].toString();
      if (row[11]) header.bodyType  = row[11].toString();
      if (row[15]) header.bodyOrder = row[15].toString();
    }

    // Find HAT NAME row
    let hatNameRow = -1;
    for (let i = 0; i < jsonData.length; i++) {
      if (String(jsonData[i][0]).toUpperCase().includes('HAT NAME') ||
          String(jsonData[i][0]).toUpperCase().includes('שם כובע')) {
        hatNameRow = i;
        break;
      }
    }
    if (hatNameRow === -1) {
      throw new Error("Could not find HAT NAME header row");
    }

    // Find sizes row (containing 51 or 52)
    let sizesRow = -1;
    for (let i = hatNameRow; i < Math.min(hatNameRow + 5, jsonData.length); i++) {
      for (let j = 0; j < jsonData[i].length; j++) {
        const v = parseInt(jsonData[i][j]);
        if (v === 51 || v === 52) { sizesRow = i; break; }
      }
      if (sizesRow !== -1) break;
    }
    if (sizesRow === -1) sizesRow = hatNameRow + 1;

    // Map size columns
    const sizeColMap = {};
    const sizeHeaderRow = jsonData[sizesRow] || [];
    for (let c = 0; c < sizeHeaderRow.length; c++) {
      const v = parseInt(sizeHeaderRow[c]);
      if (v >= 51 && v <= 63) sizeColMap[v] = c;
    }

    // Parse data rows — skip decorative/attribute rows
    const sizes = [];
    for (let i = sizesRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!isRealOrderRow(row, sizeColMap)) continue;
      const hatName = String(row[0] || '').trim();

      const sizeData = {};
      SIZES.forEach(sz => {
        const col = sizeColMap[sz];
        const qty = col !== undefined ? (parseInt(row[col]) || 0) : 0;
        sizeData[sz] = { quantity: qty, highlighted: false };
      });
      const total = SIZES.reduce((s, sz) => s + (sizeData[sz]?.quantity || 0), 0);

      sizes.push({
        id: crypto.randomUUID(),
        hatName,
        quality:      String(row[1] || ''),
        crownHeight:  String(row[2] || ''),
        brim:         String(row[3] || ''),
        brimFinish:   String(row[4] || ''),
        ribbonHeight: String(row[5] || ''),
        sizes: sizeData,
        total,
      });
    }

    const totalBySize = {};
    SIZES.forEach(sz => {
      totalBySize[sz] = sizes.reduce((s, r) => s + (r.sizes[sz]?.quantity || 0), 0);
    });
    const grandTotal = Object.values(totalBySize).reduce((a, b) => a + b, 0);

    return { header, sizes, summary: { totalBySize, grandTotal } };
  }

  // ── Save to Firebase ─────────────────────────────────────────
  async function saveToDb() {
    if (!preview) return;
    setSaving(true);
    try {
      const finalHeader = editMode ? editHeader : preview.header;
      const dbRef = doc(db, 'orders', finalHeader.orderNumber.trim());
      const existing = await getDoc(dbRef);
      if (existing.exists()) {
        if (!window.confirm(t('orders.duplicateConfirm'))) { setSaving(false); return; }
      }

      let originalFile = existing.exists() ? (existing.data().originalFile || null) : null;
      const file = fileRef.current?.files?.[0];
      if (file) {
        const storageRef = ref(storage, `orders/${finalHeader.orderNumber.trim()}/${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        originalFile = { url, name: file.name };
      }

      const payload = {
        ...finalHeader,
        sizes: preview.sizes,
        specs: {
          leatherWidth: '', leatherType: 'leather', leatherColor: '',
          leftImprinting: '', rightImprinting: '', frontImprinting: '',
          liningType: 'lining', roofColor: '', wallColor: '', pesfoall: '', logo: '',
          ribbon1: '', ribbon2: '', ribbon3: '', comments: '',
        },
        summary: preview.summary,
        status: 'ordered',
        createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(originalFile ? { originalFile } : {}),
      };
      await setDoc(dbRef, payload);
      await saveOrderMovements(finalHeader.orderNumber.trim(), finalHeader.brand, selectedMaterials);
      showToast('success', t('orders.saveSuccess'));
      const waMessage = buildWAMessage(finalHeader, preview.summary);
      setPreview(null);
      setOrderNumber('');
      setSelectedMaterials([]);
      if (fileRef.current) fileRef.current.value = '';
      setWaModal({
        message:  waMessage,
        fileUrl:  originalFile?.url  || null,
        fileName: originalFile?.name || 'order.xlsx',
      });
    } catch (err) {
      console.error(err);
      showToast('error', t('orders.saveError') + ': ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function buildWAMessage(header, summary) {
    const lines = [
      '🆕 *הזמנה חדשה התקבלה*',
      '━━━━━━━━━━━━━━━━━━',
      `📋 מספר הזמנה: ${header.orderNumber}`,
      header.orderedBy  ? `👤 לקוח: ${header.orderedBy}`   : null,
      header.model      ? `🎩 מודל: ${header.model}`        : null,
      header.orderDate  ? `📅 תאריך: ${header.orderDate}`   : null,
      `📦 סה״כ כובעים: ${summary.grandTotal}`,
      '━━━━━━━━━━━━━━━━━━',
    ];
    return lines.filter(Boolean).join('\n');
  }

  async function handleSendWhatsApp() {
    setSendingWA(true);
    try {
      const res = await fetch(
        'https://us-central1-factory-m.cloudfunctions.net/sendWhatsApp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message:  waModal.message,
            fileUrl:  waModal.fileUrl,
            fileName: waModal.fileName,
          }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      showToast('success', '✅ ' + t('orders.waSentSuccess'));
    } catch (err) {
      showToast('error', t('orders.waError') + ': ' + err.message);
    } finally {
      setSendingWA(false);
      setWaModal(null);
    }
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`alert-${toast.type === 'success' ? 'success' : 'error'} fixed top-4 right-4 z-50 shadow-lg`}>
          {toast.msg}
        </div>
      )}

      {/* WhatsApp confirmation modal */}
      {waModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-bold text-lg">📲 {t('orders.waTitle')}</h3>
            <p className="text-sm text-gray-500">
              {t('orders.waSendFilePrefix')}{' '}
              <strong className="text-green-700">{waModal.fileName}</strong>{' '}
              {t('orders.waSendGroupSuffix')}
            </p>
            <pre
              dir="rtl"
              className="bg-gray-50 border rounded-xl p-3 text-sm whitespace-pre-wrap leading-relaxed font-sans"
            >
              {waModal.message}
            </pre>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setWaModal(null)}
                className="btn-secondary"
                disabled={sendingWA}
              >
                {t('orders.waSkip')}
              </button>
              <button
                onClick={handleSendWhatsApp}
                disabled={sendingWA}
                className="btn-success"
              >
                {sendingWA ? `⏳ ${t('orders.waSending')}` : `📤 ${t('orders.waSend')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload card */}
      <div className="card">
        <div className="card-header">{t('orders.importTab')}</div>
        <div className="card-body">
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Left: inputs */}
            <div className="space-y-3">
              <div>
                <label className="form-label">{t('orders.orderNumber')}</label>
                <input
                  className="form-input"
                  value={orderNumber}
                  onChange={e => setOrderNumber(e.target.value)}
                  placeholder="e.g. PO-2024-001"
                />
              </div>
              <div>
                <label className="form-label">
                  {t('orders.model')}
                  <span className="text-red-500 ms-1">*</span>
                </label>
                <input
                  className="form-input font-mono font-bold tracking-widest uppercase"
                  value={model}
                  onChange={e => setModel(e.target.value.toUpperCase())}
                  placeholder="D92, K88, F94..."
                />
              </div>
              <div>
                <label className="form-label">{t('orders.chooseExcel')}</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="form-input file:mr-3 file:py-1 file:px-3 file:rounded file:border-0
                             file:text-sm file:font-semibold"
                  style={{ '--file-bg': '#FBF5DC', '--file-color': '#7A5C20' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const name = file.name.replace(/\.xlsx?$/i, '');
                    const m = name.match(/^(\d{3,4})\s+([A-Z][A-Z0-9]{1,3})/i);
                    if (!m) return;
                    if (!orderNumber.trim()) setOrderNumber(m[1]);
                    if (!model.trim()) setModel(m[2].toUpperCase());
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">{t('orders.excelHint')}</p>
              </div>
              <button onClick={processFile} className="btn-primary">
                📂 {t('orders.uploadProcess')}
              </button>
            </div>
            {/* Right: instructions */}
            <div className="alert-info text-sm">
              <p className="font-semibold mb-2">{t('orders.instructions')}:</p>
              <ul className="list-disc list-inside space-y-1" style={{ color: '#7A5C20' }}>
                <li>Row 2: order date, customer, model, body type, body order</li>
                <li>Find row with <b>HAT NAME</b> column</li>
                <li>Sizes row must contain 51, 52 … 63</li>
                <li>Data rows follow immediately after</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header bg-green-50">
              <span className="text-green-800">{t('orders.previewSection')}</span>
              <button onClick={saveToDb} disabled={saving} className="btn-success btn-sm">
                {saving ? t('common.loading') : `💾 ${t('orders.saveToDb')}`}
              </button>
            </div>
            <div className="card-body space-y-4">
              {/* Header */}
              <div className="card border border-gray-100">
                <div className="card-header text-sm">
                  <span>{t('orders.orderDetails')}</span>
                  <button
                    onClick={() => setEditMode(m => !m)}
                    className="btn-secondary btn-sm"
                  >
                    {editMode ? t('orders.cancelEdit') : t('orders.editHeader')}
                  </button>
                </div>
                <div className="card-body">
                  {editMode ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(editHeader).map(([field, val]) => (
                        <div key={field}>
                          <label className="form-label capitalize">{field === 'brand' ? 'מותג (3 תווים)' : field.replace(/([A-Z])/g,' $1')}</label>
                          <input
                            className={`form-input ${field === 'brand' ? 'uppercase font-mono tracking-widest' : ''}`}
                            value={val}
                            disabled={field === 'orderNumber'}
                            maxLength={field === 'brand' ? 3 : undefined}
                            onChange={e => setEditHeader(h => ({
                              ...h,
                              [field]: field === 'brand' ? e.target.value.toUpperCase() : e.target.value,
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                      {Object.entries(preview.header).map(([k, v]) => v ? (
                        <p key={k}><span className="text-gray-500">{k}: </span><strong>{v}</strong></p>
                      ) : null)}
                    </div>
                  )}
                </div>
              </div>

              {/* Sizes */}
              <div className="card border border-gray-100">
                <div className="card-header text-sm">{t('orders.sizeDetails')}</div>
                <div className="card-body p-0 overflow-x-auto">
                  <table className="factory-table">
                    <thead>
                      <tr>
                        <th>{t('orders.hatName')}</th>
                        <th>{t('orders.quality')}</th>
                        <th>{t('orders.crownHeight')}</th>
                        <th>{t('orders.brim')}</th>
                        <th>{t('orders.brimFinish')}</th>
                        <th>{t('orders.ribbonHeight')}</th>
                        {SIZES.map(s => <th key={s}>{s}</th>)}
                        <th>{t('orders.total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sizes.map(r => (
                        <tr key={r.id}>
                          <td className="text-start px-2">{r.hatName}</td>
                          <td>{r.quality}</td>
                          <td>{r.crownHeight}</td>
                          <td>{r.brim}</td>
                          <td>{r.brimFinish}</td>
                          <td>{r.ribbonHeight}</td>
                          {SIZES.map(sz => (
                            <td key={sz} className={r.sizes[sz]?.highlighted ? 'bg-yellow-200' : ''}>
                              {r.sizes[sz]?.quantity || ''}
                            </td>
                          ))}
                          <td className="font-semibold" style={{ color: '#A07830' }}>{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-bold">
                        <td colSpan={6} className="text-center text-sm">{t('orders.grandTotal')}</td>
                        {SIZES.map(sz => (
                          <td key={sz} className="text-center" style={{ color: '#A07830' }}>
                            {preview.summary.totalBySize[sz] || 0}
                          </td>
                        ))}
                        <td className="text-center font-bold" style={{ color: '#A07830' }}>
                          {preview.summary.grandTotal}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Raw Materials */}
          <div className="card">
            <div className="card-header">
              <span>
                {t('inventory.rawMaterials')}
                {selectedMaterials.length > 0 && (
                  <span className="ms-2 text-xs font-normal px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: '#C9A84C', color: '#111' }}>
                    {selectedMaterials.length} {t('inventory.selected')}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowMaterials(p => !p)}
                className="btn-secondary btn-sm text-xs"
              >
                {showMaterials ? `▲ ${t('common.collapse')}` : `▼ ${t('common.expand')}`}
              </button>
            </div>
            {showMaterials && (
              <div className="card-body">
                <MaterialSelector
                  value={selectedMaterials}
                  onChange={setSelectedMaterials}
                  orderNumber={(editMode ? editHeader.orderNumber : preview.header.orderNumber) || null}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
