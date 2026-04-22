import { useState, useEffect, useMemo } from 'react';
import {
  subscribeToInvoices,
  updateInvoice,
  deleteInvoice,
} from '../../firebase/invoices';

const ITEM_COLUMNS = [
  { key: 'confNumber',  label: 'מס׳ אישור',   sortable: true },
  { key: 'itemCode',    label: 'קוד פריט',     sortable: true },
  { key: 'description', label: 'תיאור',         sortable: true },
  { key: 'quantity',    label: 'כמות',          sortable: true, numeric: true },
  { key: 'unitPrice',   label: 'מחיר יחידה',   sortable: true, numeric: true },
  { key: 'lineTotal',   label: 'סה"כ שורה',    sortable: true, numeric: true },
];

// ── Inline editable cell ───────────────────────────────────────────────────────

function EditableCell({ value, isEditing, onChange, onSave, onCancel }) {
  if (isEditing) {
    return (
      <input
        autoFocus
        className="w-full border border-yellow-400 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-yellow-500"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  onSave();
          if (e.key === 'Escape') onCancel();
        }}
      />
    );
  }
  return (
    <span
      className="cursor-pointer hover:bg-yellow-50 px-1 rounded block min-w-[2rem] text-center"
      title="לחץ לעריכה"
    >
      {value || <span className="text-gray-300">—</span>}
    </span>
  );
}

// ── Sort helper ────────────────────────────────────────────────────────────────

function sortItems(items, key, direction) {
  if (!key) return items;
  return [...items].sort((a, b) => {
    const av = a[key] ?? '';
    const bv = b[key] ?? '';
    const an = parseFloat(av);
    const bn = parseFloat(bv);
    const cmp = (!isNaN(an) && !isNaN(bn))
      ? an - bn
      : String(av).localeCompare(String(bv), 'he');
    return direction === 'asc' ? cmp : -cmp;
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function InvoiceTable() {
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [editState, setEditState] = useState(null); // { invoiceId, itemIndex, field, value }
  const [saving,   setSaving]   = useState(false);
  const [sortKey,  setSortKey]  = useState('');
  const [sortDir,  setSortDir]  = useState('asc');
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    const unsub = subscribeToInvoices(data => {
      setInvoices(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Flatten all items with their parent invoice metadata attached
  const flatItems = useMemo(() => {
    const result = [];
    invoices.forEach(invoice => {
      (invoice.items || []).forEach((item, itemIndex) => {
        result.push({
          ...item,
          _invoiceId:     invoice._id,
          _invoiceNumber: invoice.invoiceNumber,
          _invoiceDate:   invoice.invoiceDate,
          _supplier:      invoice.supplier,
          _pdfFileUrl:    invoice.pdfFileUrl,
          _storagePath:   invoice.storagePath,
          _itemIndex:     itemIndex,
        });
      });
    });
    return result;
  }, [invoices]);

  // Group by orderNumber; apply search filter
  const groups = useMemo(() => {
    let items = flatItems;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(item =>
        String(item.orderNumber   || '').toLowerCase().includes(q) ||
        String(item.itemCode      || '').toLowerCase().includes(q) ||
        String(item.description   || '').toLowerCase().includes(q) ||
        String(item._invoiceNumber || '').toLowerCase().includes(q) ||
        String(item._supplier     || '').toLowerCase().includes(q)
      );
    }

    const map = new Map();
    items.forEach(item => {
      const key = item.orderNumber?.trim() || '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });

    return Array.from(map.entries())
      .map(([orderNumber, rows]) => ({ orderNumber, rows }))
      .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, 'he'));
  }, [flatItems, search]);

  // ── Expand/collapse ──────────────────────────────────────────────────────────

  function toggleExpand(orderNumber) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(orderNumber) ? next.delete(orderNumber) : next.add(orderNumber);
      return next;
    });
  }

  function expandAll()   { setExpanded(new Set(groups.map(g => g.orderNumber))); }
  function collapseAll() { setExpanded(new Set()); }

  // ── Sort ─────────────────────────────────────────────────────────────────────

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function sortIcon(key) {
    if (sortKey !== key) return <span className="text-gray-400 ms-0.5">⇅</span>;
    return <span className="ms-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  // ── Inline edit ───────────────────────────────────────────────────────────────

  function startEdit(invoiceId, itemIndex, field, currentValue) {
    setEditState({ invoiceId, itemIndex, field, value: currentValue || '' });
  }

  function cancelEdit() { setEditState(null); }

  async function saveEdit() {
    if (!editState) return;
    setSaving(true);
    try {
      const invoice = invoices.find(i => i._id === editState.invoiceId);
      if (!invoice) { cancelEdit(); return; }
      const newItems = [...(invoice.items || [])];
      newItems[editState.itemIndex] = {
        ...newItems[editState.itemIndex],
        [editState.field]: editState.value,
      };
      await updateInvoice(editState.invoiceId, { items: newItems });
      setEditState(null);
    } catch (err) {
      alert(`שגיאה בשמירה: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete actions ────────────────────────────────────────────────────────────

  async function deleteItem(invoiceId, itemIndex) {
    if (!window.confirm('למחוק שורה זו?')) return;
    const invoice = invoices.find(i => i._id === invoiceId);
    if (!invoice) return;
    const newItems = (invoice.items || []).filter((_, i) => i !== itemIndex);
    await updateInvoice(invoiceId, { items: newItems });
  }

  async function handleDeleteInvoice(invoice) {
    if (!window.confirm(`למחוק חשבונית ${invoice.invoiceNumber || invoice._id}?`)) return;
    await deleteInvoice(invoice._id, invoice.storagePath);
  }

  async function addRowToInvoice(invoiceId) {
    const invoice = invoices.find(i => i._id === invoiceId);
    if (!invoice) return;
    const newItems = [
      ...(invoice.items || []),
      { orderNumber: '', confNumber: '', itemCode: '', description: '', quantity: '', unitPrice: '', lineTotal: '' },
    ];
    await updateInvoice(invoiceId, { items: newItems });
  }

  // ── Loading / empty states ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        <svg className="animate-spin h-5 w-5 me-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        טוען חשבוניות…
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center text-gray-400 py-16">
          <p className="text-5xl mb-3">🧾</p>
          <p className="text-base">אין חשבוניות עדיין</p>
          <p className="text-sm mt-1">לחץ "העלה PDF" או "הזנה ידנית" כדי להוסיף חשבונית ראשונה</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Search + controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="form-input w-full sm:w-80"
          placeholder="חיפוש לפי מספר הזמנה, קוד פריט, ספק, חשבונית…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={expandAll}   className="btn-sm btn-secondary text-xs">▼ הרחב הכל</button>
          <button onClick={collapseAll} className="btn-sm btn-secondary text-xs">▲ כווץ הכל</button>
        </div>
        <span className="text-sm text-gray-400 ms-auto">
          {groups.length} קבוצות · {flatItems.length} פריטים
        </span>
      </div>

      {/* ── Grouped items table ── */}
      {groups.length === 0 ? (
        <div className="card">
          <div className="card-body text-center text-gray-400 py-10">לא נמצאו תוצאות</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="factory-table">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th className="text-start !px-3">מספר הזמנה</th>
                  <th>חשבונית</th>
                  {ITEM_COLUMNS.map(col => (
                    <th
                      key={col.key}
                      className={col.sortable ? 'cursor-pointer select-none hover:opacity-80' : ''}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      {col.label} {col.sortable && sortIcon(col.key)}
                    </th>
                  ))}
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(({ orderNumber, rows }) => {
                  const isExpanded = expanded.has(orderNumber);
                  const uniqueInvoices = [...new Set(rows.map(r => r._invoiceId))].length;
                  const totalQty  = rows.reduce((s, r) => s + (parseFloat(r.quantity)  || 0), 0);
                  const totalLine = rows.reduce((s, r) => s + (parseFloat(r.lineTotal) || 0), 0);
                  const sortedRows = sortItems(rows, sortKey, sortDir);

                  return [
                    // ── Group header ──────────────────────────────────────────
                    <tr
                      key={`grp-${orderNumber}`}
                      className="cursor-pointer select-none"
                      style={{ backgroundColor: '#FBF5DC' }}
                      onClick={() => toggleExpand(orderNumber)}
                    >
                      <td className="text-center font-bold" style={{ color: '#7A5C20' }}>
                        {isExpanded ? '▼' : '▶'}
                      </td>
                      <td className="!text-start !px-3 font-bold" style={{ color: '#7A5C20' }}>
                        {orderNumber}
                      </td>
                      <td className="text-gray-500 text-xs">
                        {uniqueInvoices} חשבונית{uniqueInvoices !== 1 ? 'ות' : ''}
                      </td>
                      {/* confNumber col — show item count */}
                      <td className="text-gray-500 text-xs" colSpan={2}>
                        {rows.length} פריט{rows.length !== 1 ? 'ים' : ''}
                      </td>
                      <td></td>
                      <td className="font-semibold" style={{ color: '#A07830' }}>
                        {totalQty > 0 ? totalQty : ''}
                      </td>
                      <td></td>
                      <td className="font-semibold" style={{ color: '#A07830' }}>
                        {totalLine > 0 ? totalLine.toFixed(2) : ''}
                      </td>
                      <td></td>
                    </tr>,

                    // ── Item rows (only when expanded) ────────────────────────
                    ...(isExpanded ? sortedRows.map((item, idx) => {
                      const isEditingRow = editState?.invoiceId === item._invoiceId &&
                                          editState?.itemIndex  === item._itemIndex;
                      return (
                        <tr key={`${item._invoiceId}-${item._itemIndex}-${idx}`} className="bg-white">
                          <td></td>
                          {/* Order number cell — empty, already shown in group header */}
                          <td className="!text-start !px-3">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400 font-mono">
                                {item._invoiceDate || ''}
                              </span>
                            </div>
                          </td>
                          {/* Invoice number + PDF link */}
                          <td>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-xs font-semibold" style={{ color: '#7A5C20' }}>
                                {item._invoiceNumber || '—'}
                              </span>
                              {item._pdfFileUrl && (
                                <a
                                  href={item._pdfFileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="הורד PDF"
                                  onClick={e => e.stopPropagation()}
                                  className="text-blue-500 hover:text-blue-700 text-xs"
                                >📎</a>
                              )}
                            </div>
                          </td>
                          {/* Editable data cells */}
                          {ITEM_COLUMNS.map(({ key }) => {
                            const isEditingCell = isEditingRow && editState.field === key;
                            return (
                              <td
                                key={key}
                                onClick={e => {
                                  e.stopPropagation();
                                  if (!isEditingRow) startEdit(item._invoiceId, item._itemIndex, key, item[key]);
                                }}
                              >
                                <EditableCell
                                  value={isEditingCell ? editState.value : (item[key] || '')}
                                  isEditing={isEditingCell}
                                  onChange={value => setEditState(prev => ({ ...prev, value }))}
                                  onSave={saveEdit}
                                  onCancel={cancelEdit}
                                />
                              </td>
                            );
                          })}
                          {/* Row actions */}
                          <td onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {isEditingRow ? (
                                <>
                                  <button
                                    onClick={saveEdit}
                                    disabled={saving}
                                    className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                                  >שמור</button>
                                  <button
                                    onClick={cancelEdit}
                                    className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  >ביטול</button>
                                </>
                              ) : (
                                <button
                                  onClick={() => deleteItem(item._invoiceId, item._itemIndex)}
                                  className="text-red-400 hover:text-red-600 text-xs"
                                  title="מחק שורה"
                                >🗑</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }) : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Invoice management section ── */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <span>🧾 ניהול חשבוניות</span>
          <span className="text-xs text-gray-400 font-normal">{invoices.length} חשבוניות</span>
        </div>
        <div className="overflow-x-auto">
          <table className="factory-table">
            <thead>
              <tr>
                <th className="text-start !px-3">מספר חשבונית</th>
                <th>תאריך</th>
                <th>ספק</th>
                <th>לקוח</th>
                <th>מטבע</th>
                <th>סה"כ</th>
                <th>פריטים</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(invoice => (
                <tr key={invoice._id}>
                  <td className="!text-start !px-3 font-semibold" style={{ color: '#7A5C20' }}>
                    {invoice.invoiceNumber || '—'}
                  </td>
                  <td className="text-xs text-gray-500">{invoice.invoiceDate  || '—'}</td>
                  <td>{invoice.supplier || '—'}</td>
                  <td>{invoice.customer || '—'}</td>
                  <td>{invoice.currency || '—'}</td>
                  <td className="font-semibold" style={{ color: '#A07830' }}>
                    {invoice.total || '—'}
                  </td>
                  <td>{(invoice.items || []).length}</td>
                  <td>
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {invoice.pdfFileUrl && (
                        <a
                          href={invoice.pdfFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-sm text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium border border-green-200"
                          title="הורד PDF מקורי"
                        >
                          📥 PDF
                        </a>
                      )}
                      <button
                        onClick={() => addRowToInvoice(invoice._id)}
                        className="btn-sm text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium border border-blue-200"
                        title="הוסף שורה לחשבונית זו"
                      >
                        + שורה
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(invoice)}
                        className="btn-sm text-xs px-2 py-1 rounded bg-red-50 text-red-500 hover:bg-red-100 font-medium border border-red-200"
                        title="מחק חשבונית"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
