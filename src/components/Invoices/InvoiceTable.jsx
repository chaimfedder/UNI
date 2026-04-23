import { useState, useEffect, useMemo } from 'react';
import {
  subscribeToInvoices,
  updateInvoice,
  deleteInvoice,
} from '../../firebase/invoices';
import { subscribeToMovements } from '../../firebase/inventory';

// ── Invoice view: item detail columns ────────────────────────────────────────
const ITEM_COLUMNS = [
  { key: 'orderNumber',  label: 'מס׳ הזמנה' },
  { key: 'confNumber',   label: 'מס׳ אישור' },
  { key: 'materialType', label: 'סוג חומר גלם' },
  { key: 'weight',       label: 'משקל' },
  { key: 'color',        label: 'צבע' },
  { key: 'description',  label: 'תיאור' },
  { key: 'quantity',     label: 'כמות' },
  { key: 'unitPrice',    label: 'מחיר יחידה' },
  { key: 'lineTotal',    label: 'סה"כ שורה' },
];

// ── Material view: detail columns shown in expanded sub-table ─────────────────
const MATERIAL_DETAIL_COLS = [
  { key: '_invoiceNumber', label: 'חשבונית' },
  { key: '_invoiceDate',   label: 'תאריך' },
  { key: '_supplier',      label: 'ספק' },
  { key: 'orderNumber',    label: 'הזמנה' },
  { key: 'confNumber',     label: 'מס׳ אישור' },
  { key: 'weight',         label: 'משקל' },
  { key: 'color',          label: 'צבע' },
  { key: 'quantity',       label: 'כמות' },
  { key: 'unitPrice',      label: 'מחיר יחידה' },
  { key: 'lineTotal',      label: 'סה"כ שורה' },
];

// ── Inline editable cell ──────────────────────────────────────────────────────
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

// ── Filter chip ───────────────────────────────────────────────────────────────
function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
      style={active
        ? { backgroundColor: '#C9A84C', color: '#111', borderColor: '#C9A84C' }
        : { backgroundColor: 'white', color: '#555', borderColor: '#D1D5DB' }}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InvoiceTable({ viewMode = 'invoice' }) {
  const [invoices,  setInvoices]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(new Set());
  const [editState, setEditState] = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');

  // Material view state
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [selectedWeights,   setSelectedWeights]   = useState([]);
  const [selectedOrders,    setSelectedOrders]    = useState([]);
  const [expandedMaterials, setExpandedMaterials] = useState(new Set());
  const [expandedOrders,    setExpandedOrders]    = useState(new Set()); // "orders used" toggle per group

  // Inventory movements (subscribed when in material view)
  const [movements, setMovements] = useState([]);

  useEffect(() => {
    const unsub = subscribeToInvoices(data => {
      setInvoices(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Subscribe to OUT movements only in material view
  useEffect(() => {
    if (viewMode !== 'material') return;
    return subscribeToMovements(data => setMovements(data));
  }, [viewMode]);

  // ── Flatten all items ─────────────────────────────────────────────────────
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
          _itemIndex:     itemIndex,
        });
      });
    });
    return result;
  }, [invoices]);

  // ── Faceted filter options ────────────────────────────────────────────────
  const allMaterials = useMemo(() => {
    let items = flatItems;
    if (selectedWeights.length > 0) items = items.filter(i => selectedWeights.includes(i.weight));
    if (selectedOrders.length  > 0) items = items.filter(i => selectedOrders.includes(i.orderNumber));
    return [...new Set(items.map(i => i.materialType).filter(Boolean))].sort();
  }, [flatItems, selectedWeights, selectedOrders]);

  const availableWeights = useMemo(() => {
    let items = flatItems;
    if (selectedMaterials.length > 0) items = items.filter(i => selectedMaterials.includes(i.materialType));
    if (selectedOrders.length    > 0) items = items.filter(i => selectedOrders.includes(i.orderNumber));
    return [...new Set(items.map(i => i.weight).filter(Boolean))]
      .sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [flatItems, selectedMaterials, selectedOrders]);

  const availableOrders = useMemo(() => {
    let items = flatItems;
    if (selectedMaterials.length > 0) items = items.filter(i => selectedMaterials.includes(i.materialType));
    if (selectedWeights.length   > 0) items = items.filter(i => selectedWeights.includes(i.weight));
    return [...new Set(items.map(i => i.orderNumber).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'he'));
  }, [flatItems, selectedMaterials, selectedWeights]);

  // ── Auto-cleanup ──────────────────────────────────────────────────────────
  useEffect(() => {
    setSelectedMaterials(prev => {
      const valid = prev.filter(m => allMaterials.includes(m));
      return valid.length === prev.length ? prev : valid;
    });
  }, [allMaterials]);

  useEffect(() => {
    setSelectedWeights(prev => {
      const valid = prev.filter(w => availableWeights.includes(w));
      return valid.length === prev.length ? prev : valid;
    });
  }, [availableWeights]);

  useEffect(() => {
    setSelectedOrders(prev => {
      const valid = prev.filter(o => availableOrders.includes(o));
      return valid.length === prev.length ? prev : valid;
    });
  }, [availableOrders]);

  // ── Material view: aggregated groups (keyed by materialType||weight||color||invoiceNumber) ──
  const materialGroups = useMemo(() => {
    let items = flatItems;
    if (selectedMaterials.length > 0) items = items.filter(i => selectedMaterials.includes(i.materialType));
    if (selectedWeights.length   > 0) items = items.filter(i => selectedWeights.includes(i.weight));
    if (selectedOrders.length    > 0) items = items.filter(i => selectedOrders.includes(i.orderNumber));

    const map = new Map();
    items.forEach(item => {
      if (!item.materialType) return;
      const key = `${item.materialType.trim()}||${item.weight || ''}||${item.color || ''}||${item._invoiceNumber || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          materialType:  item.materialType.trim(),
          weight:        item.weight        || '',
          color:         item.color         || '',
          invoiceNumber: item._invoiceNumber || '',
          totalQuantity: 0,
          rows: [],
        });
      }
      const grp = map.get(key);
      grp.totalQuantity += parseFloat(item.quantity) || 0;
      grp.rows.push(item);
    });
    return Array.from(map.values()).sort((a, b) => {
      const mc = a.materialType.localeCompare(b.materialType, 'he');
      if (mc !== 0) return mc;
      const wc = (parseFloat(a.weight) || 0) - (parseFloat(b.weight) || 0);
      if (wc !== 0) return wc;
      return a.invoiceNumber.localeCompare(b.invoiceNumber, 'he');
    });
  }, [flatItems, selectedMaterials, selectedWeights, selectedOrders]);

  // ── Stock per exact row (keyed by materialType||weight||color||invoiceNumber) ──
  const outByMaterial = useMemo(() => {
    const map = new Map();
    movements.forEach(mov => {
      if (!mov.materialType) return;
      const key = `${mov.materialType.trim()}||${mov.weight || ''}||${mov.color || ''}||${mov.invoiceNumber || ''}`;
      map.set(key, (map.get(key) || 0) + (parseFloat(mov.quantity) || 0));
    });
    return map;
  }, [movements]);

  // Orders that used each exact material row: Map<4-field-key, [{orderNumber, qty}]>
  const ordersByMaterial = useMemo(() => {
    const map = new Map();
    movements.forEach(mov => {
      if (!mov.materialType) return;
      const key = `${mov.materialType.trim()}||${mov.weight || ''}||${mov.color || ''}||${mov.invoiceNumber || ''}`;
      if (!map.has(key)) map.set(key, new Map());
      const orderMap = map.get(key);
      const orderKey = mov.orderNumber || mov.referenceId || '—';
      orderMap.set(orderKey, (orderMap.get(orderKey) || 0) + (parseFloat(mov.quantity) || 0));
    });
    const result = new Map();
    map.forEach((orderMap, matKey) => {
      result.set(matKey, Array.from(orderMap.entries())
        .map(([orderNumber, qty]) => ({ orderNumber, qty }))
        .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, 'he')));
    });
    return result;
  }, [movements]);

  // ── Invoice view: search filter ───────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(inv =>
      String(inv.invoiceNumber || '').toLowerCase().includes(q) ||
      String(inv.supplier      || '').toLowerCase().includes(q) ||
      String(inv.customer      || '').toLowerCase().includes(q)
    );
  }, [invoices, search]);

  // ── Expand / collapse ─────────────────────────────────────────────────────
  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function expandAll()   { setExpanded(new Set(filteredInvoices.map(i => i._id))); }
  function collapseAll() { setExpanded(new Set()); }

  function toggleExpandMaterial(key) {
    setExpandedMaterials(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleExpandOrders(key) {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Faceted filter toggles ────────────────────────────────────────────────
  const toggleMaterial = m =>
    setSelectedMaterials(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const toggleWeight = w =>
    setSelectedWeights(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);

  const toggleOrder = o =>
    setSelectedOrders(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]);

  // ── Inline edit ──────────────────────────────────────────────────────────
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

  // ── Delete ───────────────────────────────────────────────────────────────
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
      { orderNumber: '', confNumber: '', materialType: '', weight: '', color: '', description: '', quantity: '', unitPrice: '', lineTotal: '' },
    ];
    await updateInvoice(invoiceId, { items: newItems });
  }

  // ── Loading / empty ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        <svg className="animate-spin h-5 w-5 me-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        טוען…
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

  // ══════════════════════════════════════════════════════════════════════════
  // MATERIAL VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (viewMode === 'material') {
    const clearAll = () => { setSelectedMaterials([]); setSelectedWeights([]); setSelectedOrders([]); };
    const hasFilters = selectedMaterials.length > 0 || selectedWeights.length > 0 || selectedOrders.length > 0;

    return (
      <div className="space-y-4">

        {/* Filters card */}
        <div className="card">
          <div className="card-body space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">סוג חומר גלם</p>
              <div className="flex flex-wrap gap-1.5">
                {allMaterials.length === 0
                  ? <span className="text-xs text-gray-400">—</span>
                  : allMaterials.map(m => (
                    <FilterChip key={m} label={m} active={selectedMaterials.includes(m)} onClick={() => toggleMaterial(m)} />
                  ))
                }
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">משקל</p>
              <div className="flex flex-wrap gap-1.5">
                {availableWeights.length === 0
                  ? <span className="text-xs text-gray-400">—</span>
                  : availableWeights.map(w => (
                    <FilterChip key={w} label={w} active={selectedWeights.includes(w)} onClick={() => toggleWeight(w)} />
                  ))
                }
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">מספר הזמנה</p>
              <div className="flex flex-wrap gap-1.5">
                {availableOrders.length === 0
                  ? <span className="text-xs text-gray-400">—</span>
                  : availableOrders.map(o => (
                    <FilterChip key={o} label={o} active={selectedOrders.includes(o)} onClick={() => toggleOrder(o)} />
                  ))
                }
              </div>
            </div>
            {hasFilters && (
              <div className="pt-1 border-t border-gray-100">
                <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-600">
                  נקה את כל הפילטרים ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="text-sm text-gray-400 px-1">
          {materialGroups.length} שורות מלאי · {materialGroups.reduce((s, g) => s + g.rows.length, 0)} פריטי חשבונית
        </div>

        {/* Groups table */}
        {materialGroups.length === 0 ? (
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
                    <th className="text-start !px-3">סוג חומר גלם</th>
                    <th>משקל</th>
                    <th>צבע</th>
                    <th>חשבונית</th>
                    <th>כניסות (IN)</th>
                    <th>שימוש (OUT)</th>
                    <th>נותר</th>
                  </tr>
                </thead>
                <tbody>
                  {materialGroups.map(group => {
                    const { key, materialType, weight, color, invoiceNumber, totalQuantity, rows } = group;
                    const isExpanded       = expandedMaterials.has(key);
                    const isOrdersExpanded = expandedOrders.has(key);
                    const totalOut         = outByMaterial.get(key) || 0;
                    const remaining        = totalQuantity - totalOut;
                    const usedOrders       = ordersByMaterial.get(key) || [];

                    return [
                      // Summary row
                      <tr
                        key={`mat-${key}`}
                        className="cursor-pointer select-none"
                        style={{ backgroundColor: '#FBF5DC' }}
                        onClick={() => toggleExpandMaterial(key)}
                      >
                        <td className="text-center font-bold" style={{ color: '#7A5C20' }}>
                          {isExpanded ? '▼' : '▶'}
                        </td>
                        <td className="!text-start !px-3 font-bold" style={{ color: '#7A5C20' }}>
                          {materialType}
                        </td>
                        <td className="text-center text-gray-600 text-xs">{weight || '—'}</td>
                        <td className="text-center text-gray-600 text-xs">{color  || '—'}</td>
                        <td className="text-center text-gray-500 text-xs font-mono">{invoiceNumber || '—'}</td>
                        <td className="font-semibold" style={{ color: '#A07830' }}>
                          {totalQuantity > 0 ? totalQuantity.toFixed(2) : '—'}
                        </td>
                        <td className="font-semibold text-center" style={{ color: totalOut > 0 ? '#B45309' : '#9CA3AF' }}>
                          {totalOut > 0 ? totalOut.toFixed(2) : '—'}
                        </td>
                        <td className="font-bold text-center" style={{ color: remaining > 0 ? '#166534' : remaining < 0 ? '#991B1B' : '#9CA3AF' }}>
                          {remaining.toFixed(2)}
                        </td>
                      </tr>,

                      // Expanded detail
                      ...(isExpanded ? [
                        <tr key={`mat-detail-${key}`}>
                          <td colSpan={8} className="p-0">

                            {/* Items sub-table */}
                            <table className="w-full text-xs border-t border-gray-100">
                              <thead>
                                <tr style={{ backgroundColor: '#F5F0E0' }}>
                                  {MATERIAL_DETAIL_COLS.map(c => (
                                    <th key={c.key} className="px-3 py-1.5 text-center text-gray-500 font-semibold whitespace-nowrap">
                                      {c.label}
                                    </th>
                                  ))}
                                  <th className="px-2 w-16"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((item, idx) => {
                                  const isEditingRow = editState?.invoiceId === item._invoiceId &&
                                                       editState?.itemIndex  === item._itemIndex;
                                  return (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                      {MATERIAL_DETAIL_COLS.map(c => {
                                        const isEditingCell = isEditingRow && editState.field === c.key;
                                        return (
                                          <td
                                            key={c.key}
                                            className="px-3 py-1.5 text-center"
                                            onClick={c.key === 'quantity' ? e => {
                                              e.stopPropagation();
                                              if (!isEditingRow)
                                                startEdit(item._invoiceId, item._itemIndex, c.key, item[c.key]);
                                            } : undefined}
                                          >
                                            {c.key === '_invoiceNumber' ? (
                                              <span className="font-semibold" style={{ color: '#7A5C20' }}>
                                                {item[c.key] || '—'}
                                              </span>
                                            ) : c.key === 'quantity' ? (
                                              <EditableCell
                                                value={isEditingCell ? editState.value : (item[c.key] || '')}
                                                isEditing={isEditingCell}
                                                onChange={value => setEditState(prev => ({ ...prev, value }))}
                                                onSave={saveEdit}
                                                onCancel={cancelEdit}
                                              />
                                            ) : (
                                              item[c.key] || '—'
                                            )}
                                          </td>
                                        );
                                      })}
                                      <td className="px-2 text-center" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1">
                                          {isEditingRow ? (
                                            <>
                                              <button onClick={saveEdit} disabled={saving}
                                                className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium">שמור</button>
                                              <button onClick={cancelEdit}
                                                className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">ביטול</button>
                                            </>
                                          ) : (
                                            <>
                                              {item._pdfFileUrl && (
                                                <a href={item._pdfFileUrl} target="_blank" rel="noreferrer"
                                                  className="text-blue-500 hover:text-blue-700">📎</a>
                                              )}
                                              <button onClick={() => deleteItem(item._invoiceId, item._itemIndex)}
                                                className="text-red-400 hover:text-red-600" title="מחק שורה">🗑</button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>

                            {/* Orders that used this material */}
                            <div className="border-t border-gray-200 bg-gray-50">
                              <button
                                onClick={e => { e.stopPropagation(); toggleExpandOrders(key); }}
                                className="w-full text-xs text-right px-4 py-2 font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2"
                                style={{ color: '#7A5C20' }}
                              >
                                <span>{isOrdersExpanded ? '▼' : '▶'}</span>
                                <span>הזמנות ששמשו חומר זה ({usedOrders.length})</span>
                              </button>

                              {isOrdersExpanded && (
                                usedOrders.length === 0 ? (
                                  <p className="text-xs text-gray-400 px-4 pb-3">לא נמצאו הזמנות</p>
                                ) : (
                                  <table className="w-full text-xs border-t border-gray-100 mb-1">
                                    <thead>
                                      <tr style={{ backgroundColor: '#F5F0E0' }}>
                                        <th className="px-4 py-1.5 text-right text-gray-500 font-semibold">מספר הזמנה</th>
                                        <th className="px-4 py-1.5 text-center text-gray-500 font-semibold">כמות שנלקחה</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {usedOrders.map(({ orderNumber, qty }, i) => (
                                        <tr key={orderNumber} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                          <td className="px-4 py-1.5 font-mono font-semibold" style={{ color: '#7A5C20' }}>
                                            {orderNumber}
                                          </td>
                                          <td className="px-4 py-1.5 text-center font-semibold" style={{ color: '#B45309' }}>
                                            {qty % 1 === 0 ? qty : qty.toFixed(2)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )
                              )}
                            </div>

                          </td>
                        </tr>,
                      ] : []),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INVOICE VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">

      {/* Search + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="form-input w-full sm:w-80"
          placeholder="חיפוש לפי מספר חשבונית, ספק, לקוח…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={expandAll}   className="btn-sm btn-secondary text-xs">▼ הרחב הכל</button>
          <button onClick={collapseAll} className="btn-sm btn-secondary text-xs">▲ כווץ הכל</button>
        </div>
        <span className="text-sm text-gray-400 ms-auto">
          {filteredInvoices.length} חשבוניות
        </span>
      </div>

      {filteredInvoices.length === 0 ? (
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
                  <th className="text-start !px-3">מספר חשבונית</th>
                  <th>תאריך</th>
                  <th>ספק</th>
                  <th>סה"כ כמות</th>
                  <th>סה"כ סכום</th>
                  <th>פריטים</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(invoice => {
                  const isExpanded = expanded.has(invoice._id);
                  const totalQty   = (invoice.items || []).reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);

                  return [
                    <tr
                      key={`inv-${invoice._id}`}
                      className="cursor-pointer select-none"
                      style={{ backgroundColor: '#FBF5DC' }}
                      onClick={() => toggleExpand(invoice._id)}
                    >
                      <td className="text-center font-bold" style={{ color: '#7A5C20' }}>
                        {isExpanded ? '▼' : '▶'}
                      </td>
                      <td className="!text-start !px-3 font-bold" style={{ color: '#7A5C20' }}>
                        {invoice.invoiceNumber || '—'}
                      </td>
                      <td className="text-xs text-gray-500">{invoice.invoiceDate || '—'}</td>
                      <td>{invoice.supplier || '—'}</td>
                      <td className="font-semibold" style={{ color: '#A07830' }}>
                        {totalQty > 0 ? totalQty.toFixed(2) : '—'}
                      </td>
                      <td className="font-semibold" style={{ color: '#A07830' }}>
                        {invoice.total || '—'}
                      </td>
                      <td className="text-gray-500 text-xs">{(invoice.items || []).length}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {invoice.pdfFileUrl && (
                            <a href={invoice.pdfFileUrl} target="_blank" rel="noreferrer"
                              className="text-blue-500 hover:text-blue-700 text-xs" title="הורד PDF">📎</a>
                          )}
                          <button
                            onClick={() => addRowToInvoice(invoice._id)}
                            className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 font-medium"
                          >+ שורה</button>
                          <button
                            onClick={() => handleDeleteInvoice(invoice)}
                            className="text-red-400 hover:text-red-600 text-xs"
                            title="מחק חשבונית"
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>,

                    ...(isExpanded ? [
                      <tr key={`inv-detail-${invoice._id}`}>
                        <td colSpan={8} className="p-0">
                          <table className="w-full text-xs border-t border-gray-100">
                            <thead>
                              <tr style={{ backgroundColor: '#F5F0E0' }}>
                                {ITEM_COLUMNS.map(c => (
                                  <th key={c.key} className="px-3 py-1.5 text-center font-semibold text-gray-500 whitespace-nowrap">
                                    {c.label}
                                  </th>
                                ))}
                                <th className="px-2 w-16"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {(invoice.items || []).length === 0 && (
                                <tr>
                                  <td colSpan={ITEM_COLUMNS.length + 1} className="text-center text-gray-400 py-3">
                                    אין פריטים — לחץ "+ שורה" להוספה
                                  </td>
                                </tr>
                              )}
                              {(invoice.items || []).map((item, itemIndex) => {
                                const isEditingRow = editState?.invoiceId === invoice._id &&
                                                     editState?.itemIndex  === itemIndex;
                                return (
                                  <tr key={itemIndex} className={itemIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    {ITEM_COLUMNS.map(({ key }) => {
                                      const isEditingCell = isEditingRow && editState.field === key;
                                      return (
                                        <td
                                          key={key}
                                          className="px-1 py-1.5 text-center"
                                          onClick={e => {
                                            e.stopPropagation();
                                            if (!isEditingRow) startEdit(invoice._id, itemIndex, key, item[key]);
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
                                    <td className="px-2 text-center" onClick={e => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-1">
                                        {isEditingRow ? (
                                          <>
                                            <button onClick={saveEdit} disabled={saving}
                                              className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium">שמור</button>
                                            <button onClick={cancelEdit}
                                              className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">ביטול</button>
                                          </>
                                        ) : (
                                          <button onClick={() => deleteItem(invoice._id, itemIndex)}
                                            className="text-red-400 hover:text-red-600" title="מחק שורה">🗑</button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>,
                    ] : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
