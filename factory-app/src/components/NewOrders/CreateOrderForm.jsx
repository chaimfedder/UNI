import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import * as XLSX from 'xlsx-js-style';

// Sizes range used across the system
const SIZES = [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63];

function emptyRow() {
  const sizes = {};
  SIZES.forEach(s => { sizes[s] = { quantity: 0, highlighted: false }; });
  return {
    id: crypto.randomUUID(),
    hatName: '', quality: '', crownHeight: '',
    brim: '', brimFinish: '', ribbonHeight: '',
    sizes,
    total: 0,
  };
}

function emptySpecs() {
  return {
    leatherWidth: '', leatherType: 'leather', leatherColor: '',
    leftImprinting: '', rightImprinting: '', frontImprinting: '',
    liningType: 'lining', roofColor: '', wallColor: '', pesfoall: '', logo: '',
    ribbon1: '', ribbon2: '', ribbon3: '',
    comments: '',
  };
}

function calcRowTotal(row) {
  return SIZES.reduce((s, sz) => s + (parseInt(row.sizes[sz]?.quantity) || 0), 0);
}

function calcSummary(rows) {
  const totalBySize = {};
  SIZES.forEach(sz => {
    totalBySize[sz] = rows.reduce((s, r) => s + (parseInt(r.sizes[sz]?.quantity) || 0), 0);
  });
  const grandTotal = Object.values(totalBySize).reduce((a, b) => a + b, 0);
  return { totalBySize, grandTotal };
}

export default function CreateOrderForm() {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];

  const [header, setHeader] = useState({
    orderNumber: '', orderDate: today, orderedBy: '',
    brand: '', model: '', bodyType: '', bodyOrder: '', invoiceNumber: '',
  });
  const [rows, setRows]     = useState([emptyRow()]);
  const [specs, setSpecs]   = useState(emptySpecs());
  const [toast, setToast]   = useState(null); // { type, msg }
  const [saving, setSaving] = useState(false);

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Header ──────────────────────────────────────────────────
  function setHeaderField(field, val) {
    setHeader(h => ({ ...h, [field]: val }));
  }

  // ── Rows ────────────────────────────────────────────────────
  function addRow() { setRows(r => [...r, emptyRow()]); }

  function deleteRow(id) {
    setRows(r => r.filter(row => row.id !== id));
  }

  function setRowField(id, field, val) {
    setRows(rows => rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  }

  function setRowSize(id, size, val) {
    setRows(rows => rows.map(r => {
      if (r.id !== id) return r;
      const newSizes = { ...r.sizes, [size]: { ...r.sizes[size], quantity: parseInt(val) || 0 } };
      const total = SIZES.reduce((s, sz) => s + (parseInt(newSizes[sz]?.quantity) || 0), 0);
      return { ...r, sizes: newSizes, total };
    }));
  }

  function toggleHighlight(id, size) {
    setRows(rows => rows.map(r => {
      if (r.id !== id) return r;
      const newSizes = {
        ...r.sizes,
        [size]: { ...r.sizes[size], highlighted: !r.sizes[size].highlighted }
      };
      return { ...r, sizes: newSizes };
    }));
  }

  // ── Save ────────────────────────────────────────────────────
  async function saveOrder(e) {
    e.preventDefault();
    if (!header.orderNumber.trim()) {
      showToast('error', t('orders.noOrderNumber')); return;
    }
    const hasItems = rows.some(r => calcRowTotal(r) > 0);
    if (!hasItems) {
      showToast('error', t('orders.noItems')); return;
    }

    setSaving(true);
    try {
      const ref = doc(db, 'orders', header.orderNumber.trim());
      const existing = await getDoc(ref);
      if (existing.exists()) {
        if (!window.confirm(t('orders.duplicateConfirm'))) { setSaving(false); return; }
      }

      const summary = calcSummary(rows);
      const payload = {
        ...header,
        orderNumber: header.orderNumber.trim(),
        sizes: rows.map(r => ({ ...r })),
        specs,
        summary,
        status: 'ordered',
        createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      showToast('success', t('orders.saveSuccess'));
      if (window.confirm(t('orders.clearForm') + '?')) clearForm();
    } catch (err) {
      console.error(err);
      showToast('error', t('orders.saveError') + ': ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function clearForm() {
    setHeader({ orderNumber: '', orderDate: today, orderedBy: '', brand: '', model: '', bodyType: '', bodyOrder: '', invoiceNumber: '' });
    setRows([emptyRow()]);
    setSpecs(emptySpecs());
  }

  // ── Excel export ─────────────────────────────────────────────
  function exportExcel() {
    const summary = calcSummary(rows);
    const wb = XLSX.utils.book_new();
    const wsData = [];

    // Title row
    wsData.push(['', header.orderDate, header.orderedBy, '', header.model, header.orderNumber, '', '', '', '', '', header.bodyType, '', '', '', header.bodyOrder]);
    wsData.push([]);

    // Header row
    wsData.push(['HAT NAME', 'QUALITY', 'CROWN H.', 'BRIM', 'BRIM FINISH', 'RIBBON H.',
      ...SIZES, 'TOTAL']);

    rows.forEach(r => {
      wsData.push([
        r.hatName, r.quality, r.crownHeight, r.brim, r.brimFinish, r.ribbonHeight,
        ...SIZES.map(s => r.sizes[s]?.quantity || 0),
        calcRowTotal(r),
      ]);
    });

    // Totals
    wsData.push(['', '', '', '', '', 'TOTAL',
      ...SIZES.map(s => summary.totalBySize[s] || 0),
      summary.grandTotal,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Order');
    XLSX.writeFile(wb, `Order_${header.orderNumber || 'draft'}.xlsx`);
  }

  const summary = calcSummary(rows);

  return (
    <form onSubmit={saveOrder} className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`alert-${toast.type === 'success' ? 'success' : 'error'} fixed top-4 right-4 z-50 shadow-lg`}>
          {toast.msg}
        </div>
      )}

      {/* ── Order Details ── */}
      <div className="card">
        <div className="card-header">
          <span>{t('orders.orderDetails')}</span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              { field: 'orderDate',     label: t('orders.orderDate'),     type: 'date' },
              { field: 'orderedBy',     label: t('orders.customer'),      type: 'text' },
              { field: 'brand',         label: 'מותג (3 תווים)',          type: 'text', maxLength: 3, upper: true },
              { field: 'model',         label: t('orders.model'),         type: 'text' },
              { field: 'orderNumber',   label: t('orders.orderNumber'),   type: 'text' },
              { field: 'bodyType',      label: t('orders.bodyType'),      type: 'text' },
              { field: 'bodyOrder',     label: t('orders.bodyOrder'),     type: 'text' },
              { field: 'invoiceNumber', label: t('orders.invoiceNumber'), type: 'text' },
            ].map(({ field, label, type, maxLength, upper }) => (
              <div key={field}>
                <label className="form-label">{label}</label>
                <input
                  type={type}
                  className={`form-input ${field === 'brand' ? 'font-bold tracking-widest uppercase' : ''}`}
                  value={header[field]}
                  maxLength={maxLength}
                  onChange={e => setHeaderField(field, upper ? e.target.value.toUpperCase() : e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sizes Table ── */}
      <div className="card">
        <div className="card-header">
          <span>{t('orders.sizeDetails')}</span>
          <button type="button" onClick={addRow} className="btn-primary btn-sm">
            {t('orders.addRow')}
          </button>
        </div>
        <div className="card-body p-0 overflow-x-auto">
          <table className="factory-table">
            <thead>
              <tr>
                <th className="sticky left-0 bg-gray-100 z-10 min-w-[120px]">{t('orders.hatName')}</th>
                <th>{t('orders.quality')}</th>
                <th>{t('orders.crownHeight')}</th>
                <th>{t('orders.brim')}</th>
                <th>{t('orders.brimFinish')}</th>
                <th>{t('orders.ribbonHeight')}</th>
                {SIZES.map(s => <th key={s}>{s}</th>)}
                <th>{t('orders.total')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  {[
                    { field: 'hatName',      w: 'min-w-[100px]' },
                    { field: 'quality',      w: 'min-w-[80px]' },
                    { field: 'crownHeight',  w: 'min-w-[70px]' },
                    { field: 'brim',         w: 'min-w-[70px]' },
                    { field: 'brimFinish',   w: 'min-w-[80px]' },
                    { field: 'ribbonHeight', w: 'min-w-[70px]' },
                  ].map(({ field, w }) => (
                    <td key={field} className={`p-0 ${field === 'hatName' ? 'sticky left-0 bg-white z-10' : ''}`}>
                      <input
                        type="text"
                        className={`form-input border-0 rounded-none h-8 text-center ${w}`}
                        value={row[field]}
                        onChange={e => setRowField(row.id, field, e.target.value)}
                      />
                    </td>
                  ))}
                  {SIZES.map(sz => (
                    <td
                      key={sz}
                      className={`p-0 ${row.sizes[sz]?.highlighted ? 'bg-yellow-200' : ''}`}
                      onDoubleClick={() => toggleHighlight(row.id, sz)}
                      title="Double-click to highlight"
                    >
                      <input
                        type="number"
                        min="0"
                        className="form-input border-0 rounded-none h-8 w-12 text-center"
                        value={row.sizes[sz]?.quantity || ''}
                        onChange={e => setRowSize(row.id, sz, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="font-semibold text-blue-700">{row.total}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title={t('orders.deleteRow')}
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-bold">
                <td colSpan={6} className="text-center p-1 text-sm">{t('orders.grandTotal')}</td>
                {SIZES.map(sz => (
                  <td key={sz} className="text-center text-blue-700">
                    {summary.totalBySize[sz] || 0}
                  </td>
                ))}
                <td className="text-center text-blue-700 font-bold">{summary.grandTotal}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Technical Spec ── */}
      <div className="card">
        <div className="card-header">{t('orders.technicalSpec')}</div>
        <div className="card-body space-y-4">

          {/* Leather */}
          <div className="card border border-gray-100">
            <div className="card-header bg-sky-50 text-sky-800 text-sm">{t('orders.leatherSection')}</div>
            <div className="card-body">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">{t('orders.leatherWidth')}</label>
                  <input className="form-input" value={specs.leatherWidth}
                    onChange={e => setSpecs(s => ({...s, leatherWidth: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">{t('orders.leatherType')}</label>
                  <select className="form-select" value={specs.leatherType}
                    onChange={e => setSpecs(s => ({...s, leatherType: e.target.value}))}>
                    <option value="leather">{t('orders.leather')}</option>
                    <option value="cotton">{t('orders.cotton')}</option>
                    <option value="cottonSponge">{t('orders.cottonSponge')}</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">{t('orders.leatherColor')}</label>
                  <input className="form-input" value={specs.leatherColor}
                    onChange={e => setSpecs(s => ({...s, leatherColor: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">{t('orders.leftImprinting')}</label>
                  <input className="form-input" value={specs.leftImprinting}
                    onChange={e => setSpecs(s => ({...s, leftImprinting: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">{t('orders.rightImprinting')}</label>
                  <input className="form-input" value={specs.rightImprinting}
                    onChange={e => setSpecs(s => ({...s, rightImprinting: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">{t('orders.frontImprinting')}</label>
                  <input className="form-input" value={specs.frontImprinting}
                    onChange={e => setSpecs(s => ({...s, frontImprinting: e.target.value}))} />
                </div>
              </div>
            </div>
          </div>

          {/* Lining */}
          <div className="card border border-gray-100">
            <div className="card-header bg-sky-50 text-sky-800 text-sm">{t('orders.liningSection')}</div>
            <div className="card-body">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">{t('orders.liningType')}</label>
                  <select className="form-select" value={specs.liningType}
                    onChange={e => setSpecs(s => ({...s, liningType: e.target.value}))}>
                    <option value="lining">{t('orders.lining')}</option>
                    <option value="noLining">{t('orders.noLining')}</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">{t('orders.roofColor')}</label>
                  <input className="form-input" value={specs.roofColor}
                    onChange={e => setSpecs(s => ({...s, roofColor: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">{t('orders.wallColor')}</label>
                  <input className="form-input" value={specs.wallColor}
                    onChange={e => setSpecs(s => ({...s, wallColor: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">{t('orders.pesfoall')}</label>
                  <input className="form-input" value={specs.pesfoall}
                    onChange={e => setSpecs(s => ({...s, pesfoall: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">{t('orders.logo')}</label>
                  <input className="form-input" value={specs.logo}
                    onChange={e => setSpecs(s => ({...s, logo: e.target.value}))} />
                </div>
              </div>
            </div>
          </div>

          {/* Ribbons */}
          <div className="card border border-gray-100">
            <div className="card-header bg-sky-50 text-sky-800 text-sm">{t('orders.ribbonsSection')}</div>
            <div className="card-body">
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3].map(n => (
                  <div key={n}>
                    <label className="form-label">{t(`orders.ribbon${n}`)}</label>
                    <input className="form-input" value={specs[`ribbon${n}`]}
                      onChange={e => setSpecs(s => ({...s, [`ribbon${n}`]: e.target.value}))} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="card border border-gray-100">
            <div className="card-header bg-sky-50 text-sky-800 text-sm">{t('orders.commentsSection')}</div>
            <div className="card-body">
              <textarea
                className="form-input h-20 resize-none"
                value={specs.comments}
                onChange={e => setSpecs(s => ({...s, comments: e.target.value}))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap justify-between gap-3 pb-4">
        <div className="flex gap-2">
          <button type="button" onClick={clearForm} className="btn-secondary">
            {t('orders.clearForm')}
          </button>
          <button type="button" onClick={exportExcel} className="btn-secondary">
            📊 {t('orders.exportExcel')}
          </button>
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t('common.loading') : `💾 ${t('orders.saveOrder')}`}
        </button>
      </div>
    </form>
  );
}
