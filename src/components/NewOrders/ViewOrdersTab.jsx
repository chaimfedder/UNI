import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { exportOrderToExcel, exportToOriginalExcel } from './exportOrderToExcel';
import { deleteOrderMovements, getOrderMovements } from '../../firebase/inventory';

const SIZES = [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63];

const STATUS_LABELS = {
  ordered:     { label: 'הוזמן',       cls: 'badge-ordered'   },
  in_progress: { label: 'בייצור',      cls: 'badge-progress'  },
  shipped:     { label: 'נשלח',        cls: 'badge-shipped'   },
  completed:   { label: 'הושלם',       cls: 'badge-completed' },
};

function statusBadge(status) {
  const s = STATUS_LABELS[status];
  if (!s) return <span className="text-xs text-gray-400">{status || '—'}</span>;
  return <span className={`badge ${s.cls} text-xs`}>{s.label}</span>;
}

// ── Order detail modal ────────────────────────────────────────────────────────

function OrderDetail({ order, onClose, onDelete }) {
  const h = order.header || order;
  const sizes = order.sizes || [];
  const specs = order.specs || {};
  const summary = order.summary || {};

  const orderNumber   = h.orderNumber   || order.orderNumber   || order._id || '—';
  const model         = h.model         || order.model         || '—';
  const orderedBy     = h.orderedBy     || order.orderedBy     || '—';
  const orderDate     = h.orderDate     || order.orderDate     || '—';
  const brand         = h.brand         || order.brand         || '—';
  const bodyType      = h.bodyType      || order.bodyType      || '—';
  const bodyOrder     = h.bodyOrder     || order.bodyOrder     || '—';
  const invoiceNumber = h.invoiceNumber || order.invoiceNumber || '—';

  const [materials, setMaterials] = useState([]);
  const [matLoading, setMatLoading] = useState(true);

  // Fetch this order's OUT movements when the modal opens
  useEffect(() => {
    let cancelled = false;
    const id = order.orderNumber || order._id;
    if (!id || id === '—') { setMatLoading(false); return; }
    getOrderMovements(id).then(data => {
      if (!cancelled) { setMaterials(data); setMatLoading(false); }
    }).catch(() => { if (!cancelled) setMatLoading(false); });
    return () => { cancelled = true; };
  }, [order._id, order.orderNumber]);

  async function handleExport() {
    const payload = {
      header: { orderNumber, model, orderedBy, orderDate, brand, bodyType, bodyOrder, invoiceNumber },
      sizes,
      specs,
      summary: summary.grandTotal != null ? summary : buildSummary(sizes),
      materials,
    };
    if (order.originalFile?.url) {
      try {
        await exportToOriginalExcel(payload, order.originalFile.url);
        return;
      } catch (err) {
        console.warn('exportToOriginalExcel failed, falling back:', err);
      }
    }
    exportOrderToExcel(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
         style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-3 my-6">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl border-b"
             style={{ backgroundColor: '#FBF5DC', borderColor: '#E8C84A' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#1A1A1A' }}>
              הזמנה {orderNumber}
              {model && model !== '—' && (
                <span className="ms-2 font-mono text-sm" style={{ color: '#A07830' }}>{model}</span>
              )}
            </h2>
            {orderedBy && orderedBy !== '—' && (
              <p className="text-sm text-gray-500">{orderedBy} · {orderDate}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {order.originalFile?.url && (
              <a
                href={order.originalFile.url}
                target="_blank"
                rel="noreferrer"
                className="btn-sm text-xs px-3 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium border border-green-200"
                title={order.originalFile.name}
              >
                📎 הורד מקור
              </a>
            )}
            <button onClick={handleExport} className="btn-primary btn-sm">
              📥 ייצוא לאקסל
            </button>
            <button
              onClick={() => onDelete(order._id, orderNumber)}
              className="btn-sm text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium border border-red-200"
            >
              🗑️ מחק
            </button>
            <button onClick={onClose} className="btn-secondary btn-sm">✕ סגור</button>
          </div>
        </div>

        {/* Header metadata */}
        <div className="px-5 pt-4 pb-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              ['מותג',     brand],
              ['סוג גוף',  bodyType],
              ['הזמנת גוף', bodyOrder],
              ['חשבונית',  invoiceNumber],
            ].filter(([, v]) => v && v !== '—').map(([label, val]) => (
              <div key={label} className="p-2 rounded-lg border" style={{ borderColor: '#E8C84A', backgroundColor: '#FFFBEB' }}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-semibold" style={{ color: '#7A5C20' }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sizes table */}
        {sizes.length > 0 && (
          <div className="px-5 pt-2 pb-3 overflow-x-auto">
            <table className="factory-table text-xs">
              <thead>
                <tr>
                  <th className="text-start">שם כובע</th>
                  <th>איכות</th>
                  <th>גובה כתר</th>
                  <th>שוליים</th>
                  <th>גימור שוליים</th>
                  <th>גובה סרט</th>
                  {SIZES.map(s => <th key={s}>{s}</th>)}
                  <th>סה"כ</th>
                </tr>
              </thead>
              <tbody>
                {sizes.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td className="text-start px-2">{row.hatName}</td>
                    <td>{row.quality}</td>
                    <td>{row.crownHeight}</td>
                    <td>{row.brim}</td>
                    <td>{row.brimFinish}</td>
                    <td>{row.ribbonHeight || row.ribonHeight}</td>
                    {SIZES.map(sz => (
                      <td key={sz}
                          className={row.sizes?.[sz]?.highlighted ? 'bg-yellow-200' : ''}>
                        {row.sizes?.[sz]?.quantity || ''}
                      </td>
                    ))}
                    <td className="font-semibold" style={{ color: '#A07830' }}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
              {summary.totalBySize && (
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={6} className="text-center text-xs">סה"כ</td>
                    {SIZES.map(sz => (
                      <td key={sz} className="text-center" style={{ color: '#A07830' }}>
                        {summary.totalBySize[sz] || 0}
                      </td>
                    ))}
                    <td className="text-center font-bold" style={{ color: '#A07830' }}>
                      {summary.grandTotal || 0}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Specs */}
        {Object.values(specs).some(Boolean) && (
          <div className="px-5 pb-4">
            <div className="rounded-xl border p-3" style={{ borderColor: '#E8C84A', backgroundColor: '#FFFBEB' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#7A5C20' }}>מפרט טכני</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                {[
                  ['עור - רוחב',       specs.leatherWidth],
                  ['עור - סוג',        specs.leatherType],
                  ['עור - צבע',        specs.leatherColor],
                  ['הטבעה שמאל',       specs.leftImprinting],
                  ['הטבעה ימין',       specs.rightImprinting],
                  ['הטבעה חזית',       specs.frontImprinting],
                  ['ביטנה - סוג',      specs.liningType],
                  ['ביטנה - גג',       specs.roofColor],
                  ['ביטנה - קיר',      specs.wallColor],
                  ['פספואל',           specs.pesfoall],
                  ['לוגו',             specs.logo],
                  ['סרט 1',            specs.ribbon1],
                  ['סרט 2',            specs.ribbon2],
                  ['סרט 3',            specs.ribbon3],
                  ['הערות',            specs.comments],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <p key={label}><span className="text-gray-500">{label}: </span><strong>{val}</strong></p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Raw Materials used */}
        <div className="px-5 pb-5">
          <div className="rounded-xl border p-3" style={{ borderColor: '#E8C84A', backgroundColor: '#FFFBEB' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#7A5C20' }}>חומרי גלם בשימוש</p>
            {matLoading ? (
              <p className="text-xs text-gray-400">טוען…</p>
            ) : materials.length === 0 ? (
              <p className="text-xs text-gray-400">לא נבחרו חומרי גלם להזמנה זו</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: '#F5F0E0' }}>
                    <th className="px-2 py-1 text-right text-gray-500 font-semibold">סוג חומר</th>
                    <th className="px-2 py-1 text-center text-gray-500 font-semibold">משקל</th>
                    <th className="px-2 py-1 text-center text-gray-500 font-semibold">צבע</th>
                    <th className="px-2 py-1 text-center text-gray-500 font-semibold">חשבונית</th>
                    <th className="px-2 py-1 text-center text-gray-500 font-semibold">כמות</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, i) => (
                    <tr key={m._id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-1 font-medium" style={{ color: '#7A5C20' }}>{m.materialType || '—'}</td>
                      <td className="px-2 py-1 text-center text-gray-600">{m.weight || '—'}</td>
                      <td className="px-2 py-1 text-center text-gray-600">{m.color || '—'}</td>
                      <td className="px-2 py-1 text-center text-gray-500">{m.invoiceNumber || '—'}</td>
                      <td className="px-2 py-1 text-center font-semibold" style={{ color: '#A07830' }}>
                        {m.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main list view ────────────────────────────────────────────────────────────

export default function ViewOrdersTab() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [selected, setSelected] = useState(null);

  async function deleteOrder(orderId, orderNumber) {
    if (!window.confirm(`למחוק הזמנה ${orderNumber || orderId}?`)) return;
    try {
      // Delete movements first (query + batch), then delete the order document
      await deleteOrderMovements(orderNumber || orderId);
      await deleteDoc(doc(db, 'orders', orderId));
      if (selected?._id === orderId) setSelected(null);
    } catch (err) {
      alert(`שגיאה במחיקה: ${err.message}`);
    }
  }

  useEffect(() => {
    const q = query(collection(db, 'orders'));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const na = parseInt(a.orderNumber || a._id) || 0;
        const nb = parseInt(b.orderNumber || b._id) || 0;
        return nb - na;
      });
      setOrders(docs);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      const on  = String(o.orderNumber || o._id || '').toLowerCase();
      const mod = String(o.model || '').toLowerCase();
      const by  = String(o.orderedBy || '').toLowerCase();
      const br  = String(o.brand || '').toLowerCase();
      return on.includes(q) || mod.includes(q) || by.includes(q) || br.includes(q);
    });
  }, [orders, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        טוען הזמנות…
      </div>
    );
  }

  return (
    <>
      {selected && (
        <OrderDetail
          order={selected}
          onClose={() => setSelected(null)}
          onDelete={deleteOrder}
        />
      )}

      <div className="space-y-3">
        {/* Search */}
        <div className="flex items-center gap-3">
          <input
            className="form-input w-full sm:w-72"
            placeholder="חפש לפי מספר / מודל / לקוח / מותג…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="text-sm text-gray-400 whitespace-nowrap">{filtered.length} הזמנות</span>
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="card-body text-center text-gray-400 py-10">
              {orders.length === 0 ? 'אין הזמנות עדיין' : 'לא נמצאו תוצאות'}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="factory-table">
                <thead>
                  <tr>
                    <th>מס׳ הזמנה</th>
                    <th>מודל</th>
                    <th>מותג</th>
                    <th>לקוח</th>
                    <th>תאריך</th>
                    <th>סה"כ יח׳</th>
                    <th>סטטוס</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(order => {
                    const grand = order.summary?.grandTotal
                      ?? (order.sizes || []).reduce((s, r) => s + (r.total || 0), 0);
                    return (
                      <tr key={order._id}
                          className="cursor-pointer"
                          onClick={() => setSelected(order)}>
                        <td className="font-mono font-semibold" style={{ color: '#7A5C20' }}>
                          {order.orderNumber || order._id}
                        </td>
                        <td className="font-mono font-bold">
                          {order.model || '—'}
                        </td>
                        <td>{order.brand || '—'}</td>
                        <td>{order.orderedBy || '—'}</td>
                        <td className="text-gray-500 text-xs">{order.orderDate || '—'}</td>
                        <td className="font-semibold" style={{ color: '#A07830' }}>
                          {grand || 0}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          {statusBadge(order.status)}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {order.originalFile?.url && (
                              <a
                                href={order.originalFile.url}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-sm text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium border border-green-200"
                                onClick={e => e.stopPropagation()}
                                title={order.originalFile.name}
                              >
                                📎 מקור
                              </a>
                            )}
                            <button
                              className="btn-primary btn-sm"
                              onClick={e => {
                                e.stopPropagation();
                                // Fetch materials then export — open detail for full export
                                setSelected(order);
                              }}
                            >
                              📥 אקסל
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded bg-red-50 text-red-500 hover:bg-red-100 font-medium"
                              onClick={e => {
                                e.stopPropagation();
                                deleteOrder(order._id, order.orderNumber || order._id);
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSummary(sizes) {
  const totalBySize = {};
  SIZES.forEach(sz => {
    totalBySize[sz] = sizes.reduce((s, r) => s + (r.sizes?.[sz]?.quantity || 0), 0);
  });
  const grandTotal = Object.values(totalBySize).reduce((a, b) => a + b, 0);
  return { totalBySize, grandTotal };
}
