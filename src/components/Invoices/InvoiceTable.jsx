import { useState, useEffect, useMemo } from 'react';
import {
  subscribeToInvoices,
  updateInvoice,
  deleteInvoice,
} from '../../firebase/invoices';

// Columns for invoice view item rows
const ITEM_COLUMNS = [
  { key: 'confNumber',   label: 'מס׳ אישור',    sortable: true },
  { key: 'materialType', label: 'סוג חומר גלם', sortable: true },
  { key: 'weight',       label: 'משקל',          sortable: true, numeric: true },
  { key: 'color',        label: 'צבע',           sortable: true },
  { key: 'description',  label: 'תיאור',         sortable: true },
  { key: 'quantity',     label: 'כמות',          sortable: true, numeric: true },
  { key: 'unitPrice',    label: 'מחיר יחידה',   sortable: true, numeric: true },
  { key: 'lineTotal',    label: 'סה"כ שורה',    sortable: true, numeric: true },
];

// Columns shown inside each expanded material group
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

// ── Sort helper ───────────────────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
export default function InvoiceTable({ viewMode = 'invoice' }) {
  const [invoices,  setInvoices]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(new Set());
  const [editState, setEditState] = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [sortKey,   setSortKey]   = useState('');
  const [sortDir,   setSortDir]   = useState('asc');
  const [search,    setSearch]    = useState('');

  // Material view state
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [selectedWeights,   setSelectedWeights]   = useState([]);
  const [selectedOrders,    setSelectedOrders]    = useState([]);
  const [expandedMaterials, setExpandedMaterials] = useState(new Set());

  useEffect(() => {
    const unsub = subscribeToInvoices(data => {
      setInvoices(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Flatten all items from all invoices ───────────────────────────────────
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

  // ── Invoice view: group by orderNumber ───────────────────────────────────
  const groups = useMemo(() => {
    let items = flatItems;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(item =>
        String(item.orderNumber    || '').toLowerCase().includes(q) ||
        String(item.materialType   || '').toLowerCase().includes(q) ||
        String(item.weight         || '').toLowerCase().includes(q) ||
        String(item.color          || '').toLowerCase().includes(q) ||
        String(item.description    || '').toLowerCase().includes(q) ||
        String(item._invoiceNumber || '').toLowerCase().includes(q) ||
        String(item._supplier      || '').toLowerCase().includes(q)
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

  // ── Material view: unique materials for filter ────────────────────────────
  const allMaterials = useMemo(() =>
    [...new Set(flatItems.map(i => i.materialType).filter(Boolean))].sort(),
    [flatItems]
  );

  // ── Material view: available weights (narrows when material selected) ─────
  const availableWeights = useMemo(() => {
    const base = selectedMaterials.length > 0
      ? flatItems.filter(i => selectedMaterials.includes(i.materialType))
      : flatItems;
    return [...new Set(base.map(i => i.weight).filter(Boolean))]
      .sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [flatItems, selectedMaterials]);

  // ── Material view: available order numbers (narrows when material+weight selected) ──
  const availableOrders = useMemo(() => {
    let base = flatItems;
    if (selectedMaterials.length > 0)
      base = base.filter(i => selectedMaterials.includes(i.materialType));
    if (selectedWeights.length > 0)
      base = base.filter(i => selectedWeights.includes(i.weight));
    return [...new Set(base.map(i => i.orderNumber).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'he'));
  }, [flatItems, selectedMaterials, selectedWeights]);

  // ── Material view: aggregated groups ─────────────────────────────────────
  const materialGroups = useMemo(() => {
    let items = flatItems;
    if (selectedMaterials.length > 0)
      items = items.filter(i => selectedMaterials.includes(i.materialType));
    if (selectedWeights.length > 0)
      items = items.filter(i => selectedWeights.includes(i.weight));
    if (selectedOrders.length > 0)
      items = items.filter(i => selectedOrders.includes(i.orderNumber));
    const map = new Map();
    items.forEach(item => {
      const key = item.materialType?.trim() || '—';
      if (!map.has(key)) map.set(key, { materialType: key, totalQuantity: 0, rows: [] });
      const grp = map.get(key);
      grp.totalQuantity += parseFloat(item.quantity) || 0;
      grp.rows.push(item);
    });
    return Array.from(map.values())
      .sort((a, b) => a.materialType.localeCompare(b.materialType, 'he'));
  }, [flatItems, selectedMaterials, selectedWeights, selectedOrders]);

  // ── Invoice view: expand/collapse ────────────────────────────────────────
  function toggleExpand(orderNumber) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(orderNumber) ? next.delete(orderNumber) : next.add(orderNumber);
      return next;
    });
  }
  function expandAll()   { setExpanded(new Set(groups.map(g => g.orderNumber))); }
  function collapseAll() { setExpanded(new Set()); }

  // ── Material view: expand/collapse ───────────────────────────────────────
  function toggleExpandMaterial(key) {
    setExpandedMaterials(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Filter toggles ───────────────────────────────────────────────────────
  function toggleMaterial(m) {
    setSelectedMaterials(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
    setSelectedWeights([]);
    setSelectedOrders([]);
  }
  function toggleWeight(w) {
    setSelectedWeights(prev =>
      prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]
    );
    setSelectedOrders([]);
  }
  function toggleOrder(o) {
    setSelectedOrders(prev =>
      prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]
    );
  }

  // ── Sort ─────────────────────────────────────────────────────────────────
  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortIcon(key) {
    if (sortKey !== key) return <span className="text-gray-400 ms-0.5">⇅</span>;
    return <span className="ms-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

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

  // ══════════════════════════════════════════════════════════════════════════
  // MATERIAL VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (viewMode === 'material') {
    return (
      <div className="space-y-4">

        {/* Filters */}
        <div className="card">
          <div className="card-body space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">סוג חומר גלם</p>
              <div className="flex flex-wrap gap-1.5">
                {allMaterials.map(m => (
                  <FilterChip key={m} label={m} active={selectedMaterials.includes(m)} onClick={() => toggleMaterial(m)} />
                ))}
                {selectedMaterials.length > 0 && (
                  <button
                    onClick={() => { setSelectedMaterials([]); setSelectedWeights([]); }}
                    className="px-2.5 py-1 rounded-full text-xs border border-gray-200 text-gray-400 hover:text-gray-600"
                  >
                    נקה ✕
                  </button>
                )}
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
                {selectedWeights.length > 0 && (
                  <button
                    onClick={() => { setSelectedWeights([]); setSelectedOrders([]); }}
                    className="px-2.5 py-1 rounded-full text-xs border border-gray-200 text-gray-400 hover:text-gray-600"
                  >
                    נקה ✕
                  </button>
                )}
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
                {selectedOrders.length > 0 && (
                  <button
                    onClick={() => setSelectedOrders([])}
                    className="px-2.5 py-1 rounded-full text-xs border border-gray-200 text-gray-400 hover:text-gray-600"
                  >
                    נקה ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="text-sm text-gray-400 px-1">
          {materialGroups.length} סוגי חומר · {materialGroups.reduce((s, g) => s + g.rows.length, 0)} שורות
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
                    <th>סה"כ כמות</th>
                    <th>חשבוניות</th>
                    <th>שורות</th>
                  </tr>
                </thead>
                <tbody>
                  {materialGroups.map(({ materialType, totalQuantity, rows }) => {
                    const isExpanded = expandedMaterials.has(materialType);
                    const uniqueInvoiceCount = [...new Set(rows.map(r => r._invoiceId))].length;
                    return [
                      // Summary row
                      <tr
                        key={`mat-${materialType}`}
                        className="cursor-pointer select-none"
                        style={{ backgroundColor: '#FBF5DC' }}
                        onClick={() => toggleExpandMaterial(materialType)}
                      >
                        <td className="text-center font-bold" style={{ color: '#7A5C20' }}>
                          {isExpanded ? '▼' : '▶'}
                        </td>
                        <td className="!text-start !px-3 font-bold" style={{ color: '#7A5C20' }}>
                          {materialType}
                        </td>
                        <td className="font-semibold" style={{ color: '#A07830' }}>
                          {totalQuantity > 0 ? totalQuantity.toFixed(2) : '—'}
                        </td>
                        <td className="text-gray-500 text-xs">{uniqueInvoiceCount}</td>
                        <td className="text-gray-500 text-xs">{rows.length}</td>
                      </tr>,

                      // Expanded detail (nested table inside a full-width cell)
                      ...(isExpanded ? [
                        <tr key={`mat-detail-${materialType}`}>
                          <td colSpan={5} className="p-0">
                            <table className="w-full text-xs border-t border-gray-100">
                              <thead>
                                <tr style={{ backgroundColor: '#F5F0E0' }}>
                                  {MATERIAL_DETAIL_COLS.map(c => (
                                    <th key={c.key} className="px-3 py-1.5 text-center text-gray-500 font-semibold whitespace-nowrap">
                                      {c.label}
                                    </th>
                                  ))}
                                  <th className="px-2 w-6"></th>
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
                                      <td className="px-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          {isEditingRow ? (
                                            <>
                                              <button
                                                onClick={saveEdit}
                                                disabled={saving}
                                                className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                                              >שמור</button>
                                              <button
                                                onClick={cancelEdit}
                                                className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                                              >ביטול</button>
                                            </>
                                          ) : (
                                            <>
                                              {item._pdfFileUrl && (
                                                <a href={item._pdfFileUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">📎</a>
                                              )}
                                              <button
                                                onClick={() => deleteItem(item._invoiceId, item._itemIndex)}
                                                className="text-red-400 hover:text-red-600"
                                                title="מחק שורה"
                                              >🗑</button>
                                            </>
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

  // ══════════════════════════════════════════════════════════════════════════
  // INVOICE VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">

      {/* Search + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="form-input w-full sm:w-80"
          placeholder="חיפוש לפי מספר הזמנה, חומר גלם, ספק, חשבונית…"
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

      {/* Grouped items table */}
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
                  const isExpanded    = expanded.has(orderNumber);
                  const uniqueInvoices = [...new Set(rows.map(r => r._invoiceId))].length;
                  const totalQty      = rows.reduce((s, r) => s + (parseFloat(r.quantity)  || 0), 0);
                  const totalLine     = rows.reduce((s, r) => s + (parseFloat(r.lineTotal) || 0), 0);
                  const sortedRows    = sortItems(rows, sortKey, sortDir);

                  return [
                    // Group header row
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
                      {/* colSpan=4 covers confNumber, materialType, weight, color */}
                      <td className="text-gray-500 text-xs" colSpan={4}>
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

                    // Item rows
                    ...(isExpanded ? sortedRows.map((item, idx) => {
                      const isEditingRow = editState?.invoiceId === item._invoiceId &&
                                          editState?.itemIndex  === item._itemIndex;
                      return (
                        <tr key={`${item._invoiceId}-${item._itemIndex}-${idx}`} className="bg-white">
                          <td></td>
                          <td className="!text-start !px-3">
                            <span className="text-xs text-gray-400 font-mono">
                              {item._invoiceDate || ''}
                            </span>
                          </td>
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

      {/* Invoice management section */}
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
                  <td className="text-xs text-gray-500">{invoice.invoiceDate || '—'}</td>
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
                        >
                          📥 PDF
                        </a>
                      )}
                      <button
                        onClick={() => addRowToInvoice(invoice._id)}
                        className="btn-sm text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium border border-blue-200"
                      >
                        + שורה
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(invoice)}
                        className="btn-sm text-xs px-2 py-1 rounded bg-red-50 text-red-500 hover:bg-red-100 font-medium border border-red-200"
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
