import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import * as XLSX from 'xlsx-js-style';

const SIZES = ['51','52','53','54','55','56','57','58','59','60','61','62','63'];

// ─────────────────────────────────────────────────────────────────────────────
// OrderTrackingTab
// ─────────────────────────────────────────────────────────────────────────────
export default function OrderTrackingTab() {
  const { t } = useTranslation();

  const [orders, setOrders] = useState([]);
  const [boxes,  setBoxes]  = useState([]);
  const [selected, setSelected] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    orderNumber: '', brand: '', size: '', brim: '',
  });

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'orders'), s => setOrders(s.docs.map(d => ({ _id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'boxes'),  s => setBoxes(s.docs.map(d => ({ _id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  function setFilter(k, v) { setFilters(f => ({ ...f, [k]: v })); }
  function clearFilters()  { setFilters({ orderNumber: '', brand: '', size: '', brim: '' }); }
  const hasFilter = Object.values(filters).some(v => v !== '');

  // ── Shipped quantities per order ─────────────────────────────────────────
  const shippedByOrder = useMemo(() => {
    const map = {};
    boxes.forEach(box => {
      Object.values(box.items || {}).forEach(item => {
        const on = String(item.orderNumber || '').trim();
        if (!on) return;
        if (!map[on]) map[on] = { _total: 0, _packings: new Set(), _brands: new Set(), _brims: new Set() };
        map[on]._packings.add(String(box.packingNumber));
        if (item.model) map[on]._brands.add(String(item.model).toUpperCase());
        if (item.brim)  map[on]._brims.add(String(item.brim));
        Object.entries(item.sizes || {}).forEach(([sz, qty]) => {
          map[on][sz] = (map[on][sz] || 0) + qty;
          map[on]._total += qty;
        });
      });
    });
    Object.values(map).forEach(v => {
      v._packings = [...v._packings].sort();
      v._brands   = [...v._brands];
      v._brims    = [...v._brims];
    });
    return map;
  }, [boxes]);

  // ── Filter orders ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return orders.filter(order => {
      const shipped = shippedByOrder[order.orderNumber] || {};

      // Order number
      if (filters.orderNumber &&
          !String(order.orderNumber).toLowerCase().includes(filters.orderNumber.toLowerCase()))
        return false;

      // Brand — check order.brand OR item.model in boxes
      if (filters.brand) {
        const b = filters.brand.toUpperCase();
        const orderBrand = String(order.brand || '').toUpperCase();
        const boxBrands  = shipped._brands || [];
        if (!orderBrand.includes(b) && !boxBrands.some(m => m.includes(b)))
          return false;
      }

      // Hat size — check ordered quantities
      if (filters.size) {
        const qty = order.summary?.totalBySize?.[filters.size] || 0;
        if (qty === 0) return false;
      }

      // Brim — check order rows OR packed boxes
      if (filters.brim) {
        const inOrder = (order.sizes || []).some(row =>
          String(row.brim || '').includes(filters.brim));
        const inBoxes = (shipped._brims || []).some(b => b.includes(filters.brim));
        if (!inOrder && !inBoxes) return false;
      }

      return true;
    }).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [orders, filters, shippedByOrder]);

  // ── Export filtered results to Excel ──────────────────────────────────────
  function exportExcel() {
    const hStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '4472C4' } },
      border: { top: { style:'thin' }, bottom: { style:'thin' }, left: { style:'thin' }, right: { style:'thin' } },
      alignment: { horizontal: 'center' },
    };
    const dStyle = {
      border: { top: { style:'thin' }, bottom: { style:'thin' }, left: { style:'thin' }, right: { style:'thin' } },
      alignment: { horizontal: 'center' },
    };
    const greenStyle = { ...dStyle, font: { color: { rgb: '276221' } } };
    const orangeStyle= { ...dStyle, font: { color: { rgb: 'C55A11' } } };

    const ws = XLSX.utils.aoa_to_sheet([]);
    const headers = ['מספר הזמנה','מותג','לקוח','תאריך','הוזמן','נארז','נותר','התקדמות'];
    headers.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: h, s: hStyle };
    });

    filtered.forEach((order, rowIdx) => {
      const r = rowIdx + 1;
      const shipped = shippedByOrder[order.orderNumber] || {};
      const ordered = order.summary?.grandTotal || 0;
      const shipQty = shipped._total || 0;
      const remain  = Math.max(0, ordered - shipQty);
      const pct     = ordered > 0 ? `${Math.round((shipQty / ordered) * 100)}%` : '0%';

      ws[XLSX.utils.encode_cell({r,c:0})] = { v: order.orderNumber,  s: dStyle };
      ws[XLSX.utils.encode_cell({r,c:1})] = { v: order.brand || '',   s: dStyle };
      ws[XLSX.utils.encode_cell({r,c:2})] = { v: order.orderedBy || '',s: dStyle };
      ws[XLSX.utils.encode_cell({r,c:3})] = { v: order.orderDate || '',s: dStyle };
      ws[XLSX.utils.encode_cell({r,c:4})] = { v: ordered,  t:'n', s: dStyle };
      ws[XLSX.utils.encode_cell({r,c:5})] = { v: shipQty,  t:'n', s: greenStyle };
      ws[XLSX.utils.encode_cell({r,c:6})] = { v: remain,   t:'n', s: remain > 0 ? orangeStyle : dStyle };
      ws[XLSX.utils.encode_cell({r,c:7})] = { v: pct,             s: dStyle };
    });

    ws['!ref']  = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:filtered.length,c:7} });
    ws['!cols'] = [14,10,16,10,8,8,8,10].map(w => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'מעקב הזמנות');
    const date = new Date().toLocaleDateString('he-IL').replace(/\//g,'-');
    XLSX.writeFile(wb, `מעקב_הזמנות_${date}.xlsx`);
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (selected) {
    return (
      <OrderDetail
        order={selected}
        shipped={shippedByOrder[selected.orderNumber] || {}}
        onBack={() => setSelected(null)}
      />
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-800">{t('tracking.title')}</h1>
        <div className="flex gap-2">
          {hasFilter && (
            <button onClick={clearFilters} className="btn-secondary btn-sm">
              ✕ נקה פילטרים
            </button>
          )}
          <button
            onClick={exportExcel}
            disabled={filtered.length === 0}
            className="btn-primary btn-sm"
          >
            ייצא לאקסל {filtered.length > 0 && `(${filtered.length})`}
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">סינון</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FilterInput
            label="מספר הזמנה"
            value={filters.orderNumber}
            onChange={v => setFilter('orderNumber', v)}
            placeholder="כל ההזמנות"
          />
          <FilterInput
            label="מותג"
            value={filters.brand}
            onChange={v => setFilter('brand', v.toUpperCase())}
            placeholder="D92, F92, K88..."
            upper
          />
          <div>
            <label className="form-label text-xs">מידה</label>
            <select
              className="form-select text-sm"
              value={filters.size}
              onChange={e => setFilter('size', e.target.value)}
            >
              <option value="">כל המידות</option>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <FilterInput
            label="גודל שוליים"
            value={filters.brim}
            onChange={v => setFilter('brim', v)}
            placeholder='8, 10, 12...'
          />
        </div>
        {hasFilter && (
          <p className="text-xs text-blue-600 mt-2">
            מציג {filtered.length} מתוך {orders.length} הזמנות
          </p>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">{t('tracking.noResults')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                <Th>{t('tracking.orderNumber')}</Th>
                <Th>מותג</Th>
                <Th>{t('tracking.customer')}</Th>
                <Th>{t('tracking.orderDate')}</Th>
                <Th center>{t('tracking.totalOrdered')}</Th>
                <Th center>{t('tracking.totalShipped')}</Th>
                <Th center>{t('tracking.remaining')}</Th>
                <Th>{t('tracking.progress')}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const shipped  = shippedByOrder[order.orderNumber] || {};
                const ordered  = order.summary?.grandTotal || 0;
                const shipQty  = shipped._total || 0;
                const remain   = Math.max(0, ordered - shipQty);
                const pct      = ordered > 0 ? Math.round((shipQty / ordered) * 100) : 0;
                return (
                  <tr key={order._id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelected(order)}
                  >
                    <Td><span className="font-bold text-blue-600">{order.orderNumber}</span></Td>
                    <Td>
                      {order.brand
                        ? <span className="font-mono font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">{order.brand}</span>
                        : <span className="text-gray-300">—</span>}
                    </Td>
                    <Td>{order.orderedBy}</Td>
                    <Td>{order.orderDate}</Td>
                    <Td center>{ordered}</Td>
                    <Td center>
                      <span className={shipQty > 0 ? 'text-green-700 font-semibold' : 'text-gray-300'}>
                        {shipQty || '—'}
                      </span>
                    </Td>
                    <Td center>
                      <span className={remain > 0 ? 'text-orange-600 font-semibold' : 'text-green-700'}>
                        {remain > 0 ? remain : '✓'}
                      </span>
                    </Td>
                    <Td><ProgressBar pct={pct} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OrderDetail
// ─────────────────────────────────────────────────────────────────────────────
function OrderDetail({ order, shipped, onBack }) {
  const { t } = useTranslation();

  const ordered       = order.summary?.totalBySize || {};
  const grandOrdered  = order.summary?.grandTotal || 0;
  const grandShipped  = shipped._total || 0;
  const grandRemain   = Math.max(0, grandOrdered - grandShipped);
  const pct = grandOrdered > 0 ? Math.round((grandShipped / grandOrdered) * 100) : 0;

  const activeSizes = SIZES.filter(sz => (ordered[sz] || 0) > 0 || (shipped[sz] || 0) > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="btn-secondary btn-sm">← חזור</button>
        <h1 className="text-xl font-bold text-gray-800">
          הזמנה {order.orderNumber}
          {order.brand && (
            <span className="ms-2 font-mono text-base bg-gray-100 px-2 py-0.5 rounded text-gray-700">{order.brand}</span>
          )}
        </h1>
        <ProgressBar pct={pct} wide />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard label="מותג"           value={order.brand} highlight="blue" />
        <InfoCard label={t('tracking.customer')}  value={order.orderedBy} />
        <InfoCard label={t('tracking.orderDate')} value={order.orderDate} />
        <InfoCard label={t('tracking.status')}
          value={grandRemain === 0 && grandOrdered > 0 ? 'נשלח' : grandShipped > 0 ? 'חלקי' : 'הוזמן'}
          highlight={grandRemain === 0 && grandOrdered > 0 ? 'green' : grandShipped > 0 ? 'yellow' : 'blue'}
        />
      </div>

      {activeSizes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-center">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-start font-semibold text-gray-600">פירוט לפי מידה</th>
                {activeSizes.map(sz => <th key={sz} className="px-2 py-2 font-semibold text-gray-600">{sz}</th>)}
                <th className="px-3 py-2 font-bold text-gray-800 border-s">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2 text-start font-medium text-gray-700">הוזמן</td>
                {activeSizes.map(sz => <td key={sz} className="px-2 py-2">{ordered[sz] || ''}</td>)}
                <td className="px-3 py-2 font-bold border-s">{grandOrdered}</td>
              </tr>
              <tr className="border-b border-gray-100 bg-green-50">
                <td className="px-3 py-2 text-start font-medium text-green-700">נארז</td>
                {activeSizes.map(sz => <td key={sz} className="px-2 py-2 text-green-700 font-semibold">{shipped[sz] || ''}</td>)}
                <td className="px-3 py-2 font-bold text-green-800 border-s">{grandShipped}</td>
              </tr>
              <tr className="bg-orange-50">
                <td className="px-3 py-2 text-start font-medium text-orange-700">נותר</td>
                {activeSizes.map(sz => {
                  const rem = Math.max(0, (ordered[sz]||0) - (shipped[sz]||0));
                  return <td key={sz} className={`px-2 py-2 font-semibold ${rem > 0 ? 'text-orange-600' : 'text-gray-300'}`}>{rem > 0 ? rem : ''}</td>;
                })}
                <td className="px-3 py-2 font-bold text-orange-700 border-s">{grandRemain}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {shipped._packings?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-700 mb-2 text-sm">אריזות שמכילות הזמנה זו</h3>
          <div className="flex flex-wrap gap-2">
            {shipped._packings.map(pn => (
              <span key={pn} className="badge badge-blue">אריזה #{pn}</span>
            ))}
          </div>
          {shipped._brands?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {shipped._brands.map(b => (
                <span key={b} className="font-mono badge badge-gray">{b}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {order.sizes?.some(r => SIZES.some(sz => (parseInt(r.sizes?.[sz]?.quantity)||0) > 0)) && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <div className="px-4 py-2 bg-gray-50 border-b text-sm font-semibold text-gray-700">פירוט שורות הזמנה</div>
          <table className="w-full text-xs text-center">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-2 py-1 text-start">שם כובע</th>
                <th className="px-2 py-1">שוליים</th>
                {SIZES.map(sz => <th key={sz} className="px-1 py-1">{sz}</th>)}
                <th className="px-2 py-1 font-bold">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {order.sizes.map((row, idx) => {
                const rowTotal = SIZES.reduce((s,sz) => s + (parseInt(row.sizes?.[sz]?.quantity)||0), 0);
                if (!rowTotal) return null;
                return (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1 text-start">{row.hatName}</td>
                    <td className="px-2 py-1">{row.brim}</td>
                    {SIZES.map(sz => <td key={sz} className="px-1 py-1">{(parseInt(row.sizes?.[sz]?.quantity)||0)||''}</td>)}
                    <td className="px-2 py-1 font-bold">{rowTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small components
// ─────────────────────────────────────────────────────────────────────────────
function FilterInput({ label, value, onChange, placeholder, upper }) {
  return (
    <div>
      <label className="form-label text-xs">{label}</label>
      <input
        type="text"
        className={`form-input text-sm ${upper ? 'uppercase font-mono tracking-widest' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Th({ children, center }) {
  return <th className={`px-3 py-2 font-semibold whitespace-nowrap ${center ? 'text-center' : 'text-start'}`}>{children}</th>;
}
function Td({ children, center }) {
  return <td className={`px-3 py-2 text-gray-700 whitespace-nowrap ${center ? 'text-center' : ''}`}>{children}</td>;
}

function ProgressBar({ pct, wide }) {
  const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-400';
  return (
    <div className={`flex items-center gap-2 ${wide ? 'flex-1 max-w-xs' : ''}`}>
      <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${Math.min(100,pct)}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-9 text-end">{pct}%</span>
    </div>
  );
}

function InfoCard({ label, value, highlight }) {
  const cls = {
    green:  'bg-green-50  border-green-200  text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    blue:   'bg-blue-50   border-blue-200   text-blue-700',
  }[highlight] || 'bg-gray-50 border-gray-200 text-gray-700';
  return (
    <div className={`border rounded-xl px-3 py-2 ${cls}`}>
      <div className="text-xs opacity-70 mb-0.5">{label}</div>
      <div className="font-semibold text-sm truncate">{value || '—'}</div>
    </div>
  );
}
