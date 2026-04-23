import { useState, useEffect, useMemo } from 'react';
import { subscribeToInvoices } from '../../firebase/invoices';
import { useInventory } from '../../hooks/useInventory';

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
      style={
        active
          ? { backgroundColor: '#C9A84C', color: '#111', borderColor: '#C9A84C' }
          : { backgroundColor: 'white', color: '#555', borderColor: '#D1D5DB' }
      }
    >
      {label}
    </button>
  );
}

function rowKey(row) {
  return `${row.materialType}||${row.weight}||${row.color}||${row.invoiceNumber}`;
}

// value  — array of selected material objects (see shape below)
// onChange — (newValue: array) => void
// orderNumber — current order being edited; its existing movements are excluded
//               from stock so the user sees the true available amount
export default function MaterialSelector({ value = [], onChange, orderNumber }) {
  const [invoices, setInvoices] = useState([]);
  const [invLoading, setInvLoading] = useState(true);
  const [filterMaterial, setFilterMaterial] = useState([]);
  const [filterWeight, setFilterWeight] = useState([]);
  const [filterColor, setFilterColor] = useState([]);

  useEffect(() => {
    return subscribeToInvoices(data => {
      setInvoices(data);
      setInvLoading(false);
    });
  }, []);

  // Flatten all invoice items (only those with a materialType)
  const flatItems = useMemo(() => {
    const result = [];
    invoices.forEach(invoice => {
      (invoice.items || []).forEach((item, idx) => {
        if (!item.materialType) return;
        result.push({
          ...item,
          _invoiceId: invoice._id,
          _invoiceNumber: invoice.invoiceNumber,
          _itemIndex: idx,
        });
      });
    });
    return result;
  }, [invoices]);

  const { getStockExcludingOrder } = useInventory(flatItems);

  // One row per unique (materialType, weight, color, invoiceNumber) combination
  const allRows = useMemo(() => {
    const map = new Map();
    flatItems.forEach(item => {
      const key = `${item.materialType}||${item.weight || ''}||${item.color || ''}||${item._invoiceNumber || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          materialType: item.materialType || '',
          weight: item.weight || '',
          color: item.color || '',
          invoiceNumber: item._invoiceNumber || '',
          invoiceId: item._invoiceId,
          confNumber: item.confNumber || '',
          totalInInvoice: 0,
        });
      }
      map.get(key).totalInInvoice += parseFloat(item.quantity) || 0;
    });
    return Array.from(map.values());
  }, [flatItems]);

  // ── Faceted filter options ──────────────────────────────────────────────────

  const availableMaterials = useMemo(() => {
    let rows = allRows;
    if (filterWeight.length > 0) rows = rows.filter(r => filterWeight.includes(r.weight));
    if (filterColor.length > 0)  rows = rows.filter(r => filterColor.includes(r.color));
    return [...new Set(rows.map(r => r.materialType).filter(Boolean))].sort();
  }, [allRows, filterWeight, filterColor]);

  const availableWeights = useMemo(() => {
    let rows = allRows;
    if (filterMaterial.length > 0) rows = rows.filter(r => filterMaterial.includes(r.materialType));
    if (filterColor.length > 0)    rows = rows.filter(r => filterColor.includes(r.color));
    return [...new Set(rows.map(r => r.weight).filter(Boolean))]
      .sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [allRows, filterMaterial, filterColor]);

  const availableColors = useMemo(() => {
    let rows = allRows;
    if (filterMaterial.length > 0) rows = rows.filter(r => filterMaterial.includes(r.materialType));
    if (filterWeight.length > 0)   rows = rows.filter(r => filterWeight.includes(r.weight));
    return [...new Set(rows.map(r => r.color).filter(Boolean))].sort();
  }, [allRows, filterMaterial, filterWeight]);

  // Auto-remove filter selections that are no longer valid
  useEffect(() => {
    setFilterMaterial(p => p.filter(m => availableMaterials.includes(m)));
  }, [availableMaterials]);
  useEffect(() => {
    setFilterWeight(p => p.filter(w => availableWeights.includes(w)));
  }, [availableWeights]);
  useEffect(() => {
    setFilterColor(p => p.filter(c => availableColors.includes(c)));
  }, [availableColors]);

  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      if (filterMaterial.length > 0 && !filterMaterial.includes(row.materialType)) return false;
      if (filterWeight.length  > 0 && !filterWeight.includes(row.weight))          return false;
      if (filterColor.length   > 0 && !filterColor.includes(row.color))            return false;
      return true;
    });
  }, [allRows, filterMaterial, filterWeight, filterColor]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Sum of selected quantities for a given (materialType, weight, color) combo,
  // excluding the row identified by excludeKey so we don't double-count.
  function selectedQtyForCombo(materialType, weight, color, invoiceNumber, excludeKey) {
    return value
      .filter(s => s.materialType  === materialType  &&
                   s.weight        === weight         &&
                   s.color         === color          &&
                   s.invoiceNumber === invoiceNumber  &&
                   s._key          !== excludeKey)
      .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  }

  function getEntry(row) {
    return value.find(s => s._key === rowKey(row));
  }

  function toggleRow(row) {
    const key = rowKey(row);
    if (value.find(s => s._key === key)) {
      onChange(value.filter(s => s._key !== key));
      return;
    }
    const stock = getStockExcludingOrder(row.materialType, row.weight, row.color, row.invoiceNumber, orderNumber);
    const otherSelected = selectedQtyForCombo(row.materialType, row.weight, row.color, row.invoiceNumber, key);
    const available = stock.remaining - otherSelected;
    if (available <= 0) return;
    onChange([...value, { ...row, _key: key, quantity: 1 }]);
  }

  function setQty(row, rawQty) {
    const key = rowKey(row);
    const stock = getStockExcludingOrder(row.materialType, row.weight, row.color, row.invoiceNumber, orderNumber);
    const otherSelected = selectedQtyForCombo(row.materialType, row.weight, row.color, row.invoiceNumber, key);
    const maxQty = Math.max(0, stock.remaining - otherSelected);
    const qty = Math.min(Math.max(0, Number(rawQty) || 0), maxQty);

    if (qty === 0) {
      onChange(value.filter(s => s._key !== key));
    } else {
      onChange(value.map(s => s._key === key ? { ...s, quantity: qty } : s));
    }
  }

  const hasFilters = filterMaterial.length > 0 || filterWeight.length > 0 || filterColor.length > 0;

  if (invLoading) {
    return <div className="text-xs text-gray-400 py-4 text-center">טוען חומרי גלם…</div>;
  }

  if (allRows.length === 0) {
    return (
      <div className="text-center text-xs text-gray-400 py-6">
        אין חומרי גלם זמינים — יש להוסיף חשבוניות עם פריטים
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ── Filters ── */}
      <div className="space-y-2 p-3 rounded-lg border border-gray-100 bg-gray-50">
        {[
          { label: 'סוג חומר', values: availableMaterials, selected: filterMaterial,
            toggle: m => setFilterMaterial(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]) },
          { label: 'משקל',   values: availableWeights,   selected: filterWeight,
            toggle: w => setFilterWeight(p => p.includes(w) ? p.filter(x => x !== w) : [...p, w]) },
          { label: 'צבע',    values: availableColors,    selected: filterColor,
            toggle: c => setFilterColor(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]) },
        ].map(({ label, values, selected, toggle }) => (
          <div key={label}>
            <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
            <div className="flex flex-wrap gap-1">
              {values.length === 0
                ? <span className="text-xs text-gray-300">—</span>
                : values.map(v => (
                    <FilterChip key={v} label={v} active={selected.includes(v)} onClick={() => toggle(v)} />
                  ))
              }
            </div>
          </div>
        ))}
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setFilterMaterial([]); setFilterWeight([]); setFilterColor([]); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            נקה פילטרים ✕
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {filteredRows.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-4">לא נמצאו תוצאות</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: '#F5F0E0' }}>
                <th className="px-2 py-2 w-8"></th>
                <th className="px-3 py-2 text-right text-gray-600 font-semibold">סוג חומר</th>
                <th className="px-3 py-2 text-center text-gray-600 font-semibold">משקל</th>
                <th className="px-3 py-2 text-center text-gray-600 font-semibold">צבע</th>
                <th className="px-3 py-2 text-center text-gray-600 font-semibold">חשבונית</th>
                <th className="px-3 py-2 text-center text-gray-600 font-semibold">מלאי זמין</th>
                <th className="px-3 py-2 text-center text-gray-600 font-semibold">כמות נבחרת</th>
                <th className="px-3 py-2 text-center text-gray-600 font-semibold">יתרה אחרי</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const key = rowKey(row);
                const stock = getStockExcludingOrder(row.materialType, row.weight, row.color, row.invoiceNumber, orderNumber);
                const otherSelected = selectedQtyForCombo(row.materialType, row.weight, row.color, row.invoiceNumber, key);
                const availableForRow = Math.max(0, stock.remaining - otherSelected);
                const entry = getEntry(row);
                const selectedQty = entry ? entry.quantity : 0;
                const afterSelection = availableForRow - selectedQty;
                const isSelected = !!entry;
                const isUnavailable = availableForRow <= 0 && !isSelected;

                return (
                  <tr
                    key={key}
                    className={`border-t border-gray-100 ${
                      isSelected ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } ${isUnavailable ? 'opacity-40' : ''}`}
                  >
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isUnavailable}
                        onChange={() => toggleRow(row)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-right" style={{ color: '#7A5C20' }}>
                      {row.materialType}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">{row.weight || '—'}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{row.color || '—'}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{row.invoiceNumber || '—'}</td>
                    <td
                      className="px-3 py-2 text-center font-semibold"
                      style={{ color: stock.remaining > 0 ? '#166534' : '#991B1B' }}
                    >
                      {stock.remaining % 1 === 0 ? stock.remaining : stock.remaining.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isSelected ? (
                        <input
                          type="number"
                          min="1"
                          max={availableForRow}
                          value={selectedQty}
                          onChange={e => setQty(row, e.target.value)}
                          className="w-20 text-center border border-yellow-400 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2 text-center font-medium"
                      style={{ color: afterSelection < 0 ? '#991B1B' : '#4B5563' }}
                    >
                      {isSelected
                        ? (afterSelection % 1 === 0 ? afterSelection : afterSelection.toFixed(2))
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Selected summary ── */}
      {value.length > 0 && (
        <div
          className="rounded-lg border p-3 space-y-1.5"
          style={{ borderColor: '#E8C84A', backgroundColor: '#FFFBEB' }}
        >
          <p className="text-xs font-semibold" style={{ color: '#7A5C20' }}>
            חומרי גלם נבחרים ({value.length}):
          </p>
          {value.map(sel => (
            <div key={sel._key} className="flex items-center justify-between text-xs gap-2">
              <span className="text-gray-700">
                {sel.materialType}
                {sel.weight ? ` · ${sel.weight}` : ''}
                {sel.color ? ` · ${sel.color}` : ''}
              </span>
              <span className="font-semibold whitespace-nowrap" style={{ color: '#A07830' }}>
                {sel.quantity} יח׳ · {sel.invoiceNumber || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
