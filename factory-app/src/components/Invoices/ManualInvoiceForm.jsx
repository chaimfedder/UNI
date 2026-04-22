import { useState } from 'react';
import { addInvoice } from '../../firebase/invoices';

const EMPTY_ITEM = {
  orderNumber: '',
  confNumber: '',
  itemCode: '',
  description: '',
  quantity: '',
  unitPrice: '',
  lineTotal: '',
};

const HEADER_FIELDS = [
  { key: 'invoiceNumber', label: 'מספר חשבונית', required: true },
  { key: 'invoiceDate',   label: 'תאריך' },
  { key: 'supplier',      label: 'ספק' },
  { key: 'customer',      label: 'לקוח' },
  { key: 'currency',      label: 'מטבע' },
  { key: 'shippingCost',  label: 'עלות משלוח' },
  { key: 'subtotal',      label: 'סכום לפני מע"מ' },
  { key: 'total',         label: 'סה"כ' },
];

const ITEM_COLUMNS = [
  { key: 'orderNumber', label: 'מס׳ הזמנה' },
  { key: 'confNumber',  label: 'מס׳ אישור' },
  { key: 'itemCode',    label: 'קוד פריט' },
  { key: 'description', label: 'תיאור' },
  { key: 'quantity',    label: 'כמות' },
  { key: 'unitPrice',   label: 'מחיר יחידה' },
  { key: 'lineTotal',   label: 'סה"כ שורה' },
];

export default function ManualInvoiceForm({ onDone, onCancel }) {
  const [invoice, setInvoice] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    supplier: '',
    customer: '',
    currency: '',
    shippingCost: '',
    subtotal: '',
    total: '',
    items: [{ ...EMPTY_ITEM }],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function updateField(field, value) {
    setInvoice(prev => ({ ...prev, [field]: value }));
  }

  function updateItem(index, field, value) {
    setInvoice(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  function addItem() {
    setInvoice(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));
  }

  function removeItem(index) {
    if (invoice.items.length === 1) return;
    setInvoice(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!invoice.invoiceNumber.trim()) {
      setError('יש להזין מספר חשבונית');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addInvoice({ ...invoice, pdfFileUrl: '', storagePath: '' });
      onDone();
    } catch (err) {
      setError(`שגיאה בשמירה: ${err.message}`);
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">✏️ הזנת חשבונית ידנית</div>
      <div className="card-body space-y-5">

        {/* Header fields */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {HEADER_FIELDS.map(({ key, label, required }) => (
            <div key={key}>
              <label className="form-label">
                {label}
                {required && <span className="text-red-500 ms-0.5">*</span>}
              </label>
              <input
                className="form-input"
                value={invoice[key] || ''}
                onChange={e => updateField(key, e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Items table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">
              פריטים
              <span className="ms-1 text-gray-400 font-normal">({invoice.items.length})</span>
            </h3>
            <button onClick={addItem} className="btn-sm btn-secondary">+ הוסף שורה</button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="factory-table">
              <thead>
                <tr>
                  {ITEM_COLUMNS.map(c => <th key={c.key}>{c.label}</th>)}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => (
                  <tr key={idx}>
                    {ITEM_COLUMNS.map(({ key }) => (
                      <td key={key}>
                        <input
                          className="w-full bg-transparent text-center text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 rounded px-1"
                          value={item[key] || ''}
                          onChange={e => updateItem(idx, key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={invoice.items.length === 1}
                        className="text-red-400 hover:text-red-600 text-xs disabled:opacity-30"
                        title="מחק שורה"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
          <button onClick={onCancel} className="btn-secondary">ביטול</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                שומר…
              </span>
            ) : '💾 שמור חשבונית'}
          </button>
        </div>
      </div>
    </div>
  );
}
