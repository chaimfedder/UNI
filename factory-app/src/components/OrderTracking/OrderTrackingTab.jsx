import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

// Sizes used across the system
const SIZES = ['51','52','53','54','55','56','57','58','59','60','61','62','63'];

// ─────────────────────────────────────────────────────────────────────────────
// OrderTrackingTab
// ─────────────────────────────────────────────────────────────────────────────
export default function OrderTrackingTab() {
  const { t } = useTranslation();

  const [orders,  setOrders]  = useState([]);
  const [boxes,   setBoxes]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [selected, setSelected] = useState(null); // selected order

  // Subscribe to orders
  useEffect(() => {
    return onSnapshot(collection(db, 'orders'), snap => {
      setOrders(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
    });
  }, []);

  // Subscribe to boxes (for shipped quantities)
  useEffect(() => {
    return onSnapshot(collection(db, 'boxes'), snap => {
      setBoxes(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
    });
  }, []);

  // ── Compute shipped quantities per orderNumber (client-side join) ─────────
  const shippedByOrder = useMemo(() => {
    const map = {}; // orderNumber → { [size]: qty, _total: qty, _packings: Set }
    boxes.forEach(box => {
      Object.values(box.items || {}).forEach(item => {
        const on = String(item.orderNumber || '').trim();
        if (!on) return;
        if (!map[on]) map[on] = { _total: 0, _packings: new Set() };
        map[on]._packings.add(String(box.packingNumber));
        Object.entries(item.sizes || {}).forEach(([sz, qty]) => {
          map[on][sz] = (map[on][sz] || 0) + qty;
          map[on]._total += qty;
        });
      });
    });
    // Convert Set → Array for rendering
    Object.values(map).forEach(v => { v._packings = [...v._packings].sort(); });
    return map;
  }, [boxes]);

  // ── Filter orders ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter(o =>
        !q ||
        String(o.orderNumber).toLowerCase().includes(q) ||
        String(o.model     || '').toLowerCase().includes(q) ||
        String(o.orderedBy || '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;  // newest first
      });
  }, [orders, search]);

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
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('tracking.searchPlaceholder')}
          className="input-field input-sm w-64"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">{t('tracking.noResults')}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <Th>{t('tracking.orderNumber')}</Th>
                <Th>{t('tracking.model')}</Th>
                <Th>{t('tracking.customer')}</Th>
                <Th>{t('tracking.orderDate')}</Th>
                <Th>{t('tracking.totalOrdered')}</Th>
                <Th>{t('tracking.totalShipped')}</Th>
                <Th>{t('tracking.remaining')}</Th>
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
                  <tr
                    key={order._id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelected(order)}
                  >
                    <Td>
                      <span className="font-bold text-blue-600">{order.orderNumber}</span>
                    </Td>
                    <Td>{order.model}</Td>
                    <Td>{order.orderedBy}</Td>
                    <Td>{order.orderDate}</Td>
                    <Td center>{ordered}</Td>
                    <Td center>
                      <span className={shipQty > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                        {shipQty}
                      </span>
                    </Td>
                    <Td center>
                      <span className={remain > 0 ? 'text-orange-600' : 'text-green-700 font-semibold'}>
                        {remain}
                      </span>
                    </Td>
                    <Td>
                      <ProgressBar pct={pct} />
                    </Td>
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
// OrderDetail — full breakdown for one order
// ─────────────────────────────────────────────────────────────────────────────
function OrderDetail({ order, shipped, onBack }) {
  const { t } = useTranslation();

  const ordered = order.summary?.totalBySize || {};
  const grandOrdered  = order.summary?.grandTotal || 0;
  const grandShipped  = shipped._total || 0;
  const grandRemain   = Math.max(0, grandOrdered - grandShipped);
  const pct = grandOrdered > 0 ? Math.round((grandShipped / grandOrdered) * 100) : 0;

  // Only show sizes that have any ordered or shipped quantity
  const activeSizes = SIZES.filter(sz =>
    (ordered[sz] || 0) > 0 || (shipped[sz] || 0) > 0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="btn-secondary btn-sm">
          ← {t('common.cancel')}
        </button>
        <h1 className="text-xl font-bold text-gray-800">
          {t('tracking.orderNumber')}: {order.orderNumber}
        </h1>
        <ProgressBar pct={pct} wide />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard label={t('tracking.model')}       value={order.model} />
        <InfoCard label={t('tracking.customer')}    value={order.orderedBy} />
        <InfoCard label={t('tracking.orderDate')}   value={order.orderDate} />
        <InfoCard label={t('tracking.status')}
          value={
            grandRemain === 0 && grandOrdered > 0
              ? t('orders.statusShipped')
              : grandShipped > 0
                ? t('orders.statusPartial')
                : t('orders.statusOrdered')
          }
          highlight={
            grandRemain === 0 && grandOrdered > 0 ? 'green'
            : grandShipped > 0 ? 'yellow'
            : 'blue'
          }
        />
      </div>

      {/* Size breakdown */}
      {activeSizes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm text-center">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-start font-semibold text-gray-600">{t('tracking.sizeBreakdown')}</th>
                {activeSizes.map(sz => (
                  <th key={sz} className="px-2 py-2 font-semibold text-gray-600">{sz}</th>
                ))}
                <th className="px-3 py-2 font-bold text-gray-800 border-s border-gray-200">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {/* Ordered row */}
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2 text-start font-medium text-gray-700">{t('tracking.ordered')}</td>
                {activeSizes.map(sz => (
                  <td key={sz} className="px-2 py-2 text-gray-700">{ordered[sz] || ''}</td>
                ))}
                <td className="px-3 py-2 font-bold text-gray-900 border-s border-gray-200">{grandOrdered}</td>
              </tr>
              {/* Shipped row */}
              <tr className="border-b border-gray-100 bg-green-50">
                <td className="px-3 py-2 text-start font-medium text-green-700">{t('tracking.shipped')}</td>
                {activeSizes.map(sz => (
                  <td key={sz} className="px-2 py-2 text-green-700 font-semibold">{shipped[sz] || ''}</td>
                ))}
                <td className="px-3 py-2 font-bold text-green-800 border-s border-gray-200">{grandShipped}</td>
              </tr>
              {/* Remaining row */}
              <tr className="bg-orange-50">
                <td className="px-3 py-2 text-start font-medium text-orange-700">{t('tracking.remaining')}</td>
                {activeSizes.map(sz => {
                  const rem = Math.max(0, (ordered[sz] || 0) - (shipped[sz] || 0));
                  return (
                    <td key={sz} className={`px-2 py-2 font-semibold ${rem > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                      {rem > 0 ? rem : ''}
                    </td>
                  );
                })}
                <td className="px-3 py-2 font-bold text-orange-700 border-s border-gray-200">{grandRemain}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Packing history */}
      {shipped._packings?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-2">{t('tracking.shipmentHistory')}</h3>
          <div className="flex flex-wrap gap-2">
            {shipped._packings.map(pn => (
              <span key={pn} className="badge badge-blue">
                {t('tracking.packingNo')} {pn}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Per-row order details */}
      {order.sizes?.some(r => Object.values(r.sizes || {}).some(c => (c.quantity || 0) > 0)) && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-sm text-gray-700">
            {t('orders.sizeDetails')}
          </div>
          <table className="w-full text-xs text-center">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-2 py-1 text-start">Hat Name</th>
                <th className="px-2 py-1 text-start">Brim</th>
                {SIZES.map(sz => <th key={sz} className="px-1 py-1">{sz}</th>)}
                <th className="px-2 py-1 font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.sizes.map((row, idx) => {
                const rowTotal = SIZES.reduce((s, sz) => s + (parseInt(row.sizes?.[sz]?.quantity) || 0), 0);
                if (rowTotal === 0) return null;
                return (
                  <tr key={idx} className="border-b border-gray-50">
                    <td className="px-2 py-1 text-start">{row.hatName}</td>
                    <td className="px-2 py-1 text-start">{row.brim}</td>
                    {SIZES.map(sz => (
                      <td key={sz} className="px-1 py-1">
                        {(parseInt(row.sizes?.[sz]?.quantity) || 0) || ''}
                      </td>
                    ))}
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
// Small reusable components
// ─────────────────────────────────────────────────────────────────────────────
function Th({ children }) {
  return (
    <th className="px-3 py-2 text-start font-semibold text-gray-600 whitespace-nowrap">{children}</th>
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
  const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-400';
  return (
    <div className={`flex items-center gap-2 ${wide ? 'flex-1 max-w-xs' : ''}`}>
      <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-9 text-end">{pct}%</span>
    </div>
  );
}

function InfoCard({ label, value, highlight }) {
  const colorMap = {
    green:  'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
  };
  const cls = highlight ? colorMap[highlight] : 'bg-gray-50 border-gray-200 text-gray-700';
  return (
    <div className={`border rounded-lg px-3 py-2 ${cls}`}>
      <div className="text-xs opacity-70 mb-0.5">{label}</div>
      <div className="font-semibold text-sm truncate">{value || '—'}</div>
    </div>
  );
}
