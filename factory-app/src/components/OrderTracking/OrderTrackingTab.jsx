import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import * as XLSX from 'xlsx-js-style';

const SIZES = ['51','52','53','54','55','56','57','58','59','60','61','62','63'];

// ─────────────────────────────────────────────────────────────────────────────
// OrderTrackingTab — aggregated view
// ─────────────────────────────────────────────────────────────────────────────
export default function OrderTrackingTab() {
  const [orders, setOrders] = useState([]);
  const [boxes,  setBoxes]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ orderNumber: '', brand: '', size: '', brim: '' });
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'orders'), s => setOrders(s.docs.map(d => ({ _id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'boxes'),  s => setBoxes(s.docs.map(d => ({ _id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  function setFilter(k, v) { setFilters(f => ({ ...f, [k]: v })); }
  function clearFilters()  { setFilters({ orderNumber: '', brand: '', size: '', brim: '' }); }
  const hasFilter = Object.values(filters).some(v => v !== '');

  // ── Unique filter options from live data ─────────────────────────────────
  const filterOptions = useMemo(() => {
    const orderNumbers = [...new Set(
      orders.map(o => String(o.orderNumber || '').trim()).filter(Boolean)
    )].sort();
    // brand and model are the same concept — collect both, normalize to uppercase
    const brandSet = new Set();
    orders.forEach(o => {
      const b = String(o.brand || o.model || '').trim().toUpperCase();
      if (b) brandSet.add(b);
    });
    const brands = [...brandSet].sort();
    const brimSet = new Set();
    orders.forEach(o => (o.sizes || []).forEach(row => {
      if (row.brim) brimSet.add(String(row.brim).trim());
    }));
    const brims = [...brimSet].sort((a, b) => parseFloat(a) - parseFloat(b));
    return { orderNumbers, brands, brims };
  }, [orders]);

  // ── Aggregated computation ────────────────────────────────────────────────
  const aggregated = useMemo(() => {
    const orderNumF = filters.orderNumber.trim();
    const brandF    = filters.brand.trim().toUpperCase();
    const sizeF     = filters.size;
    const brimF     = filters.brim.trim();

    const orderedBySz  = {};
    const shippedBySz  = {};
    SIZES.forEach(sz => { orderedBySz[sz] = 0; shippedBySz[sz] = 0; });

    // orderNum → { total, bySz, brand, orderedBy, orderDate }
    const orderedByOrder = {};
    // orderNum → { total, bySz }
    const shippedByOrder = {};

    // ── Count ordered ─────────────────────────────────────────────────────
    orders.forEach(order => {
      if (orderNumF && String(order.orderNumber || '').trim() !== orderNumF) return;
      const orderBrand = String(order.brand || order.model || '').toUpperCase().trim();
      if (brandF && orderBrand !== brandF) return;

      const onum = String(order.orderNumber || '');
      if (!orderedByOrder[onum]) {
        orderedByOrder[onum] = {
          total: 0, bySz: {},
          brand: order.brand || order.model || '',
          orderedBy: order.orderedBy || '',
          orderDate: order.orderDate || '',
        };
        SIZES.forEach(sz => orderedByOrder[onum].bySz[sz] = 0);
      }

      (order.sizes || []).forEach(row => {
        if (brimF && !String(row.brim || '').includes(brimF)) return;
        SIZES.forEach(sz => {
          if (sizeF && sz !== sizeF) return;
          const qty = parseInt(row.sizes?.[sz]?.quantity) || 0;
          orderedBySz[sz] += qty;
          orderedByOrder[onum].bySz[sz] += qty;
          orderedByOrder[onum].total    += qty;
        });
      });
    });

    // ── Count shipped ─────────────────────────────────────────────────────
    boxes.forEach(box => {
      Object.values(box.items || {}).forEach(item => {
        const itemOrderNum = String(item.orderNumber || '').trim();
        if (orderNumF && itemOrderNum !== orderNumF) return;
        if (brandF && String(item.model || '').toUpperCase().trim() !== brandF) return;
        if (brimF  && !String(item.brim  || '').includes(brimF)) return;

        const onum = itemOrderNum;
        if (!shippedByOrder[onum]) {
          shippedByOrder[onum] = { total: 0, bySz: {} };
          SIZES.forEach(sz => shippedByOrder[onum].bySz[sz] = 0);
        }

        SIZES.forEach(sz => {
          if (sizeF && sz !== sizeF) return;
          const qty = parseInt(item.sizes?.[sz]) || 0;
          if (!qty) return;
          shippedBySz[sz]               += qty;
          shippedByOrder[onum].bySz[sz] += qty;
          shippedByOrder[onum].total    += qty;
        });
      });
    });

    // ── Summary totals ────────────────────────────────────────────────────
    const displaySizes = sizeF
      ? [sizeF]
      : SIZES.filter(sz => (orderedBySz[sz] || 0) > 0 || (shippedBySz[sz] || 0) > 0);

    const totalOrdered = displaySizes.reduce((s, sz) => s + (orderedBySz[sz] || 0), 0);
    const totalShipped = displaySizes.reduce((s, sz) => s + (shippedBySz[sz] || 0), 0);

    // ── Per-order list ────────────────────────────────────────────────────
    // Base set: orders that passed the ordered-side filters.
    // Only add shipped-only rows when no order-level filter is active
    // (orderNumF or brandF already restrict which orders appear).
    const orderedNums = new Set(Object.keys(orderedByOrder));
    const allNums = (orderNumF || brandF)
      ? orderedNums  // strict: only orders that matched both order-level filters
      : new Set([...orderedNums, ...Object.keys(shippedByOrder)]);

    const perOrderList = [...allNums]
      .map(onum => {
        const ord = orderedByOrder[onum] || { total: 0, bySz: {}, brand: '', orderedBy: '', orderDate: '' };
        const shp = shippedByOrder[onum] || { total: 0, bySz: {} };
        return {
          orderNumber: onum,
          brand:       ord.brand,
          orderedBy:   ord.orderedBy,
          orderDate:   ord.orderDate,
          ordered:     ord.total,
          shipped:     shp.total,
          orderedBySz: ord.bySz,
          shippedBySz: shp.bySz,
        };
      })
      .filter(r => r.ordered > 0 || r.shipped > 0)
      .sort((a, b) => b.ordered - a.ordered);

    return { orderedBySz, shippedBySz, displaySizes, totalOrdered, totalShipped, perOrderList };
  }, [orders, boxes, filters]);

  // ── Export to Excel ───────────────────────────────────────────────────────
  function exportExcel() {
    const hStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '4472C4' } },
      border: { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} },
      alignment: { horizontal: 'center' },
    };
    const cell = (v, s) => ({ v, s });
    const d = { border: hStyle.border, alignment: { horizontal: 'center' } };
    const g = { ...d, font: { color: { rgb: '276221' } } };
    const o = { ...d, font: { color: { rgb: 'C55A11' } } };

    const { displaySizes, orderedBySz, shippedBySz, totalOrdered, totalShipped, perOrderList } = aggregated;

    const ws = XLSX.utils.aoa_to_sheet([]);

    // Filter summary row
    const filterDesc = [
      filters.orderNumber && `הזמנה: ${filters.orderNumber}`,
      filters.brand       && `מותג: ${filters.brand}`,
      filters.size        && `מידה: ${filters.size}`,
      filters.brim        && `שוליים: ${filters.brim}`,
    ].filter(Boolean).join(' | ') || 'כל ההזמנות';
    ws[XLSX.utils.encode_cell({r:0,c:0})] = { v: filterDesc, s: { font:{bold:true} } };

    // Per-size table (row 2+)
    const sizeHeaders = ['', ...displaySizes, 'סה"כ'];
    sizeHeaders.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({r:2,c})] = cell(h, hStyle);
    });
    ['הוזמן','נארז','נותר'].forEach((label, ri) => {
      const r = 3 + ri;
      ws[XLSX.utils.encode_cell({r,c:0})] = cell(label, d);
      displaySizes.forEach((sz, ci) => {
        const ord = orderedBySz[sz] || 0;
        const shp = shippedBySz[sz] || 0;
        const val = ri === 0 ? ord : ri === 1 ? shp : Math.max(0, ord - shp);
        ws[XLSX.utils.encode_cell({r,c:ci+1})] = cell(val, ri===1?g:ri===2&&val>0?o:d);
      });
      const tot = ri===0?totalOrdered:ri===1?totalShipped:Math.max(0,totalOrdered-totalShipped);
      ws[XLSX.utils.encode_cell({r,c:displaySizes.length+1})] = cell(tot, ri===1?g:ri===2&&tot>0?o:d);
    });

    // Per-order table
    const oRow = 7;
    ['מספר הזמנה','מותג','לקוח','תאריך','הוזמן','נארז','נותר','%'].forEach((h,c) => {
      ws[XLSX.utils.encode_cell({r:oRow,c})] = cell(h, hStyle);
    });
    perOrderList.forEach((row, i) => {
      const r = oRow + 1 + i;
      const rem = Math.max(0, row.ordered - row.shipped);
      const pct = row.ordered > 0 ? `${Math.round((row.shipped/row.ordered)*100)}%` : '0%';
      [row.orderNumber, row.brand, row.orderedBy, row.orderDate,
        row.ordered, row.shipped, rem, pct].forEach((v, c) => {
        ws[XLSX.utils.encode_cell({r,c})] = cell(v, c===5?g:c===6&&rem>0?o:d);
      });
    });

    const maxR = oRow + perOrderList.length;
    const maxC = Math.max(displaySizes.length + 1, 7);
    ws['!ref']  = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:maxR,c:maxC} });
    ws['!cols'] = [14,10,10,10,10,8,8,8,8,8,8,8,8,8,8,8].map(w=>({wch:w}));

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
        boxes={boxes}
        onBack={() => setSelected(null)}
      />
    );
  }

  const { displaySizes, orderedBySz, shippedBySz, totalOrdered, totalShipped, perOrderList } = aggregated;
  const totalRemain = Math.max(0, totalOrdered - totalShipped);
  const pct = totalOrdered > 0 ? Math.round((totalShipped / totalOrdered) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-800">מעקב הזמנות</h1>
        <div className="flex gap-2">
          {hasFilter && (
            <button onClick={clearFilters} className="btn-secondary btn-sm">✕ נקה פילטרים</button>
          )}
          <button
            onClick={exportExcel}
            disabled={perOrderList.length === 0}
            className="btn-primary btn-sm"
          >
            ייצא לאקסל
          </button>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">סינון</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FilterSelect
            label="מספר הזמנה"
            value={filters.orderNumber}
            onChange={v => setFilter('orderNumber', v)}
            options={filterOptions.orderNumbers}
            placeholder="כל ההזמנות"
          />
          <FilterSelect
            label="מותג"
            value={filters.brand}
            onChange={v => setFilter('brand', v)}
            options={filterOptions.brands}
            placeholder="כל המותגים"
          />
          <FilterSelect
            label="גודל שוליים"
            value={filters.brim}
            onChange={v => setFilter('brim', v)}
            options={filterOptions.brims}
            placeholder="כל השוליים"
          />
          <FilterSelect
            label="מידה"
            value={filters.size}
            onChange={v => setFilter('size', v)}
            options={SIZES}
            placeholder="כל המידות"
          />
        </div>

        {/* ── Active filter chips ── */}
        {hasFilter && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">מסונן לפי:</span>
            {[
              { key: 'orderNumber', label: 'הזמנה' },
              { key: 'brand',       label: 'מותג'  },
              { key: 'brim',        label: 'שוליים' },
              { key: 'size',        label: 'מידה'  },
            ].filter(f => filters[f.key]).map(f => (
              <span
                key={f.key}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: '#FBF5DC', color: '#7A5C20', border: '1px solid #E8C84A' }}
              >
                {f.label}: <strong>{filters[f.key]}</strong>
                <button
                  onClick={() => setFilter(f.key, '')}
                  className="ms-1 font-bold hover:opacity-70"
                >×</button>
              </span>
            ))}
            <span className="text-xs text-gray-400 ms-1">
              ({orders.length} הזמנות במערכת)
            </span>
          </div>
        )}
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="הוזמן סה״כ"  value={totalOrdered} color="gold" />
        <StatCard label="נארז / נשלח" value={totalShipped} color="green" />
        <StatCard label="נותר"        value={totalRemain}  color={totalRemain > 0 ? 'orange' : 'green'} />
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex flex-col justify-center gap-1.5">
          <div className="text-xs text-gray-500">התקדמות</div>
          <ProgressBar pct={pct} />
        </div>
      </div>

      {/* ── Filter summary card (shown only when filters active) ─────────────── */}
      {hasFilter && perOrderList.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E8C84A' }}>
          {/* Header row — click to expand/collapse */}
          <button
            className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-sm font-semibold text-start"
            style={{ backgroundColor: '#FBF5DC', color: '#7A5C20' }}
            onClick={() => setSummaryExpanded(e => !e)}
          >
            <span>סיכום סינון:</span>
            {filters.brand       && <span className="font-mono bg-white px-2 py-0.5 rounded border border-yellow-300">מותג: {filters.brand}</span>}
            {filters.brim        && <span className="bg-white px-2 py-0.5 rounded border border-yellow-300">שולים: {filters.brim}</span>}
            {filters.size        && <span className="bg-white px-2 py-0.5 rounded border border-yellow-300">מידה: {filters.size}</span>}
            {filters.orderNumber && <span className="bg-white px-2 py-0.5 rounded border border-yellow-300">הזמנה: {filters.orderNumber}</span>}
            <span className="ms-auto flex items-center gap-4">
              <span>הוזמן: <strong>{totalOrdered}</strong></span>
              <span className="text-green-700">נשלח: <strong>{totalShipped}</strong></span>
              <span className={totalRemain > 0 ? 'text-orange-600' : 'text-green-700'}>נותר: <strong>{totalRemain}</strong></span>
              <span className="text-gray-400 text-xs">{summaryExpanded ? '▲' : '▼'} פירוט לפי הזמנה</span>
            </span>
          </button>
          {/* Expanded: per-order breakdown */}
          {summaryExpanded && (
            <div className="overflow-x-auto border-t" style={{ borderColor: '#E8C84A' }}>
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b text-xs" style={{ backgroundColor: '#FBF5DC' }}>
                    <Th>מספר הזמנה</Th>
                    <Th>מותג</Th>
                    <Th center>הוזמן</Th>
                    <Th center>נשלח</Th>
                    <Th center>נותר</Th>
                  </tr>
                </thead>
                <tbody>
                  {perOrderList.map(row => {
                    const rem = Math.max(0, row.ordered - row.shipped);
                    return (
                      <tr key={row.orderNumber} className="border-b border-yellow-100 hover:bg-yellow-50">
                        <Td><span className="font-bold" style={{ color: '#C9A84C' }}>{row.orderNumber}</span></Td>
                        <Td><span className="font-mono text-xs font-semibold">{row.brand || '—'}</span></Td>
                        <Td center>{row.ordered}</Td>
                        <Td center><span className={row.shipped > 0 ? 'text-green-700 font-semibold' : 'text-gray-300'}>{row.shipped || '—'}</span></Td>
                        <Td center><span className={rem > 0 ? 'text-orange-600 font-semibold' : 'text-green-700'}>{rem > 0 ? rem : '✓'}</span></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Per-order breakdown ────────────────────────────────────────────────── */}
      {perOrderList.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b text-sm font-semibold text-gray-700">
            פירוט לפי הזמנה ({perOrderList.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500 bg-gray-50">
                  <Th>מספר הזמנה</Th>
                  <Th>מותג</Th>
                  <Th>לקוח</Th>
                  <Th>תאריך</Th>
                  <Th center>הוזמן</Th>
                  <Th center>נארז</Th>
                  <Th center>נותר</Th>
                  <Th>התקדמות</Th>
                </tr>
              </thead>
              <tbody>
                {perOrderList.map(row => {
                  const remain = Math.max(0, row.ordered - row.shipped);
                  const p = row.ordered > 0 ? Math.round((row.shipped / row.ordered) * 100) : 0;
                  const orderObj = orders.find(o => String(o.orderNumber) === row.orderNumber);
                  return (
                    <tr
                      key={row.orderNumber}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => orderObj && setSelected(orderObj)}
                    >
                      <Td>
                        <span className="font-bold" style={{ color: '#C9A84C' }}>{row.orderNumber}</span>
                      </Td>
                      <Td>
                        {row.brand
                          ? <span className="font-mono font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded text-xs">{row.brand}</span>
                          : <span className="text-gray-300">—</span>}
                      </Td>
                      <Td>{row.orderedBy}</Td>
                      <Td>{row.orderDate}</Td>
                      <Td center>{row.ordered || ''}</Td>
                      <Td center>
                        <span className={row.shipped > 0 ? 'text-green-700 font-semibold' : 'text-gray-300'}>
                          {row.shipped || '—'}
                        </span>
                      </Td>
                      <Td center>
                        <span className={remain > 0 ? 'text-orange-600 font-semibold' : row.ordered > 0 ? 'text-green-700' : 'text-gray-300'}>
                          {remain > 0 ? remain : row.ordered > 0 ? '✓' : '—'}
                        </span>
                      </Td>
                      <Td><ProgressBar pct={p} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="text-center py-16 text-gray-400">אין הזמנות עדיין</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OrderDetail — full detail for a single order
// ─────────────────────────────────────────────────────────────────────────────
function OrderDetail({ order, boxes, onBack }) {
  const { shipped, shippedPerRowKey } = useMemo(() => {
    const result = { _total: 0, _packings: new Set(), _brands: new Set(), _brims: new Set() };
    SIZES.forEach(sz => { result[sz] = 0; });
    // per-row map: brim__crownHeight__brimFinish → { sz: qty }
    const perRowKey = {};

    boxes.forEach(box => {
      Object.values(box.items || {}).forEach(item => {
        if (String(item.orderNumber || '').trim() !== String(order.orderNumber || '')) return;
        result._packings.add(String(box.packingNumber));
        if (item.model) result._brands.add(String(item.model).toUpperCase());
        if (item.brim)  result._brims.add(String(item.brim));

        const key = `${String(item.brim||'').trim()}__${String(item.height||'').trim()}__${String(item.finishBrim||'').trim()}`;
        if (!perRowKey[key]) { perRowKey[key] = {}; SIZES.forEach(sz => perRowKey[key][sz] = 0); }

        SIZES.forEach(sz => {
          const qty = parseInt(item.sizes?.[sz]) || 0;
          result[sz]      += qty;
          result._total   += qty;
          perRowKey[key][sz] += qty;
        });
      });
    });

    result._packings = [...result._packings].sort();
    result._brands   = [...result._brands];
    result._brims    = [...result._brims];
    return { shipped: result, shippedPerRowKey: perRowKey };
  }, [order, boxes]);

  const ordered      = order.summary?.totalBySize || {};
  const grandOrdered = order.summary?.grandTotal || 0;
  const grandShipped = shipped._total || 0;
  const grandRemain  = Math.max(0, grandOrdered - grandShipped);
  const pct = grandOrdered > 0 ? Math.round((grandShipped / grandOrdered) * 100) : 0;
  const activeSizes  = SIZES.filter(sz => (ordered[sz] || 0) > 0 || (shipped[sz] || 0) > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="btn-secondary btn-sm">← חזור</button>
        <h1 className="text-xl font-bold text-gray-800">
          הזמנה {order.orderNumber}
          {(order.brand || order.model) && (
            <span className="ms-2 font-mono text-base bg-gray-100 px-2 py-0.5 rounded text-gray-700">
              {order.brand || order.model}
            </span>
          )}
        </h1>
        <ProgressBar pct={pct} wide />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard label="מותג"    value={order.brand || order.model} highlight="gold" />
        <InfoCard label="לקוח"    value={order.orderedBy} />
        <InfoCard label="תאריך"   value={order.orderDate} />
        <InfoCard label="סטטוס"
          value={grandRemain === 0 && grandOrdered > 0 ? 'נשלח' : grandShipped > 0 ? 'חלקי' : 'הוזמן'}
          highlight={grandRemain === 0 && grandOrdered > 0 ? 'green' : grandShipped > 0 ? 'yellow' : 'gold'}
        />
      </div>

      {/* ── Part 1: unified ordered / shipped table ── */}
      {order.sizes?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <div className="px-4 py-2 bg-gray-50 border-b text-sm font-semibold text-gray-700">
            פירוט הזמנה
          </div>
          <table className="w-full text-xs text-center">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-2 py-1 text-start"></th>
                <th className="px-2 py-1 text-start">מודל</th>
                <th className="px-2 py-1 text-start">שם כובע</th>
                <th className="px-2 py-1">שולים</th>
                {SIZES.map(sz => <th key={sz} className="px-1 py-1">{sz}</th>)}
                <th className="px-2 py-1 font-bold">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {order.sizes.map((row, idx) => {
                const brand = order.brand || order.model || '';
                const orderedTotal = SIZES.reduce((s, sz) => s + (parseInt(row.sizes?.[sz]?.quantity) || 0), 0);
                if (!orderedTotal) return null;
                const matchKey = `${String(row.brim||'').trim()}__${String(row.crownHeight||'').trim()}__${String(row.brimFinish||'').trim()}`;
                const rowShipped = shippedPerRowKey[matchKey] || {};
                const shippedTotal = SIZES.reduce((s, sz) => s + (rowShipped[sz] || 0), 0);
                return (
                  <React.Fragment key={idx}>
                    {/* Ordered row */}
                    <tr className="border-b border-gray-100">
                      <td className="px-2 py-1 text-xs font-semibold text-gray-500 whitespace-nowrap">הוזמן</td>
                      <td className="px-2 py-1 text-start font-mono font-bold text-xs" style={{ color: '#A07830' }}>{brand}</td>
                      <td className="px-2 py-1 text-start font-medium">{row.hatName}</td>
                      <td className="px-2 py-1">{row.brim}</td>
                      {SIZES.map(sz => (
                        <td key={sz} className="px-1 py-1">
                          {(parseInt(row.sizes?.[sz]?.quantity) || 0) || ''}
                        </td>
                      ))}
                      <td className="px-2 py-1 font-bold">{orderedTotal}</td>
                    </tr>
                    {/* Shipped row */}
                    <tr className="border-b-2 border-gray-200 bg-green-50">
                      <td className="px-2 py-1 text-xs font-semibold text-green-700 whitespace-nowrap">נשלח</td>
                      <td className="px-2 py-1 text-start font-mono text-xs text-green-700">{brand}</td>
                      <td className="px-2 py-1 text-start text-gray-400 text-xs">{row.hatName}</td>
                      <td className="px-2 py-1 text-gray-500">{row.brim}</td>
                      {SIZES.map(sz => (
                        <td key={sz} className="px-1 py-1 text-green-700 font-semibold">
                          {rowShipped[sz] || ''}
                        </td>
                      ))}
                      <td className="px-2 py-1 font-bold text-green-800">{shippedTotal || ''}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Part 2: packing info ── */}
      {shipped._packings?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-700 mb-2 text-sm">אריזות שמכילות הזמנה זו</h3>
          <div className="flex flex-wrap gap-2">
            {shipped._packings.map(pn => (
              <span key={pn} className="badge badge-ordered">אריזה #{pn}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable components
// ─────────────────────────────────────────────────────────────────────────────
function FilterSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label className="form-label text-xs">{label}</label>
      <select
        className="form-select text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    gold:   '',
    green:  'bg-green-50  border-green-200  text-green-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    gray:   'bg-gray-50   border-gray-200   text-gray-700',
  };
  const goldStyle = color === 'gold' ? { backgroundColor: '#FBF5DC', borderColor: '#E8C84A', color: '#A07830' } : {};
  return (
    <div className={`border rounded-xl px-4 py-3 ${colors[color] || colors.gray}`} style={goldStyle}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
    </div>
  );
}

function Th({ children, center }) {
  return (
    <th className={`px-3 py-2 font-semibold whitespace-nowrap ${center ? 'text-center' : 'text-start'}`}>
      {children}
    </th>
  );
}
function Td({ children, center }) {
  return (
    <td className={`px-3 py-2 text-gray-700 whitespace-nowrap ${center ? 'text-center' : ''}`}>
      {children}
    </td>
  );
}

function ProgressBar({ pct, wide }) {
  const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-gold-600' : 'bg-orange-400';
  return (
    <div className={`flex items-center gap-2 ${wide ? 'flex-1 max-w-xs' : ''}`}>
      <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-9 text-end">{pct}%</span>
    </div>
  );
}

function InfoCard({ label, value, highlight }) {
  const goldCls = highlight === 'gold' ? { backgroundColor: '#FBF5DC', borderColor: '#E8C84A', color: '#A07830' } : {};
  const cls = {
    green:  'bg-green-50  border-green-200  text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    gold:   '',
  }[highlight] || 'bg-gray-50 border-gray-200 text-gray-700';
  return (
    <div className={`border rounded-xl px-3 py-2 ${cls}`} style={goldCls}>
      <div className="text-xs opacity-70 mb-0.5">{label}</div>
      <div className="font-semibold text-sm truncate">{value || '—'}</div>
    </div>
  );
}
